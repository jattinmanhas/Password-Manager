package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/lib/pq"

	"pmv2/backend/internal/domain"
)

type AuthRepository struct {
	db *sql.DB
}

func NewAuthRepository(db *sql.DB) *AuthRepository {
	return &AuthRepository{db: db}
}

func (r *AuthRepository) CreateUserWithCredentials(ctx context.Context, input domain.CreateUserInput) error {
	tx, err := r.db.BeginTx(ctx, &sql.TxOptions{})
	if err != nil {
		return fmt.Errorf("start create user tx: %w", err)
	}

	_, err = tx.ExecContext(ctx, `
		INSERT INTO users (id, email, name, created_at, updated_at)
		VALUES ($1, $2, $3, NOW(), NOW())
	`, input.UserID, input.Email, nullableText(input.Name))
	if err != nil {
		_ = tx.Rollback()
		if isUniqueViolation(err) {
			return domain.ErrEmailTaken
		}
		return fmt.Errorf("insert user: %w", err)
	}

	_, err = tx.ExecContext(ctx, `
		INSERT INTO auth_credentials (
			user_id, algo, params, salt, password_hash, mfa_totp_enabled, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, FALSE, NOW(), NOW())
	`, input.UserID, input.Algo, input.ParamsJSON, input.Salt, input.PasswordHash)
	if err != nil {
		_ = tx.Rollback()
		return fmt.Errorf("insert auth credential: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit create user tx: %w", err)
	}
	return nil
}

func (r *AuthRepository) GetUserAuthByEmail(ctx context.Context, email string) (domain.UserAuthRecord, error) {
	var record domain.UserAuthRecord
	var name sql.NullString
	var secret []byte
	var windowStart sql.NullTime
	var lockedUntil sql.NullTime

	err := r.db.QueryRowContext(ctx, `
		SELECT
			u.id,
			u.email,
			u.name,
			ac.salt,
			ac.password_hash,
			ac.params,
			ac.mfa_totp_enabled,
			ac.mfa_totp_secret_enc,
			ac.totp_failed_attempts,
			ac.totp_window_started_at,
			ac.totp_locked_until
		FROM users u
		JOIN auth_credentials ac ON ac.user_id = u.id
		WHERE u.email = $1
	`, email).Scan(
		&record.UserID,
		&record.Email,
		&name,
		&record.Salt,
		&record.PasswordHash,
		&record.RawParams,
		&record.TOTPEnabled,
		&secret,
		&record.TOTPFailedAttempts,
		&windowStart,
		&lockedUntil,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return domain.UserAuthRecord{}, domain.ErrNotFound
		}
		return domain.UserAuthRecord{}, fmt.Errorf("query auth record: %w", err)
	}

	record.Name = name.String
	record.TOTPSecretEnc = secret
	if windowStart.Valid {
		t := windowStart.Time.UTC()
		record.TOTPWindowStart = &t
	}
	if lockedUntil.Valid {
		t := lockedUntil.Time.UTC()
		record.TOTPLockedUntil = &t
	}
	return record, nil
}

func (r *AuthRepository) CreateSession(ctx context.Context, input domain.CreateSessionInput) error {
	var ipAddress any
	if input.IPAddr != "" {
		ipAddress = input.IPAddr
	}

	purpose := input.Purpose
	if purpose == "" {
		purpose = domain.SessionPurposeAuth
	}

	_, err := r.db.ExecContext(ctx, `
		INSERT INTO sessions (
			id, user_id, refresh_token_hash, device_name, ip_address, user_agent, purpose, expires_at, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
	`, input.SessionID, input.UserID, input.TokenHash, input.DeviceName, ipAddress, input.UserAgent, purpose, input.ExpiresAt)
	if err != nil {
		return fmt.Errorf("insert session: %w", err)
	}
	return nil
}

// getActiveSessionByTokenHashWithPurpose looks up a non-revoked, unexpired
// session by token hash, constrained to the given purpose.
func (r *AuthRepository) getActiveSessionByTokenHashWithPurpose(ctx context.Context, tokenHash []byte, purpose string) (domain.Session, error) {
	var session domain.Session
	var name sql.NullString
	err := r.db.QueryRowContext(ctx, `
		SELECT s.id, s.user_id, u.email, u.name, ac.mfa_totp_enabled, s.expires_at
		FROM sessions s
		JOIN users u ON u.id = s.user_id
		JOIN auth_credentials ac ON ac.user_id = u.id
		WHERE s.refresh_token_hash = $1
		  AND s.purpose = $2
		  AND s.revoked_at IS NULL
		  AND s.expires_at > NOW()
	`, tokenHash, purpose).Scan(&session.ID, &session.UserID, &session.Email, &name, &session.TOTPEnabled, &session.ExpiresAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return domain.Session{}, domain.ErrNotFound
		}
		return domain.Session{}, fmt.Errorf("query session: %w", err)
	}
	session.Name = name.String
	return session, nil
}

// GetActiveSessionByTokenHash returns a normal auth session. Password-reset
// sessions are excluded so they cannot authenticate ordinary requests.
func (r *AuthRepository) GetActiveSessionByTokenHash(ctx context.Context, tokenHash []byte) (domain.Session, error) {
	return r.getActiveSessionByTokenHashWithPurpose(ctx, tokenHash, domain.SessionPurposeAuth)
}

// GetActiveResetSessionByTokenHash returns a password-reset session, used only
// by the reset-confirm flow.
func (r *AuthRepository) GetActiveResetSessionByTokenHash(ctx context.Context, tokenHash []byte) (domain.Session, error) {
	return r.getActiveSessionByTokenHashWithPurpose(ctx, tokenHash, domain.SessionPurposePasswordReset)
}

func (r *AuthRepository) RevokeSessionByTokenHash(ctx context.Context, tokenHash []byte) (bool, error) {
	result, err := r.db.ExecContext(ctx, `
		UPDATE sessions
		SET revoked_at = NOW()
		WHERE refresh_token_hash = $1 AND revoked_at IS NULL
	`, tokenHash)
	if err != nil {
		return false, fmt.Errorf("revoke session: %w", err)
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return false, fmt.Errorf("read rows affected: %w", err)
	}
	return affected > 0, nil
}

func (r *AuthRepository) SetTOTPSecret(ctx context.Context, userID string, secretEnc []byte) (bool, error) {
	result, err := r.db.ExecContext(ctx, `
		UPDATE auth_credentials
		SET
			mfa_totp_secret_enc = $1,
			mfa_totp_enabled = FALSE,
			totp_failed_attempts = 0,
			totp_window_started_at = NULL,
			totp_locked_until = NULL,
			updated_at = NOW()
		WHERE user_id = $2
	`, secretEnc, userID)
	if err != nil {
		return false, fmt.Errorf("store totp secret: %w", err)
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return false, fmt.Errorf("read rows affected: %w", err)
	}
	return affected > 0, nil
}

func (r *AuthRepository) EnableTOTP(ctx context.Context, userID string) error {
	result, err := r.db.ExecContext(ctx, `
		UPDATE auth_credentials
		SET
			mfa_totp_enabled = TRUE,
			totp_failed_attempts = 0,
			totp_window_started_at = NULL,
			totp_locked_until = NULL,
			updated_at = NOW()
		WHERE user_id = $1
	`, userID)
	if err != nil {
		return fmt.Errorf("enable totp: %w", err)
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("read rows affected: %w", err)
	}
	if affected == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *AuthRepository) DisableTOTP(ctx context.Context, userID string) error {
	result, err := r.db.ExecContext(ctx, `
		UPDATE auth_credentials
		SET
			mfa_totp_enabled = FALSE,
			mfa_totp_secret_enc = NULL,
			totp_failed_attempts = 0,
			totp_window_started_at = NULL,
			totp_locked_until = NULL,
			updated_at = NOW()
		WHERE user_id = $1
	`, userID)
	if err != nil {
		return fmt.Errorf("disable totp: %w", err)
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("read rows affected: %w", err)
	}
	if affected == 0 {
		return domain.ErrNotFound
	}

	return nil
}

func (r *AuthRepository) GetTOTPState(ctx context.Context, userID string) (domain.TOTPState, error) {
	var state domain.TOTPState
	var secret []byte
	var windowStart sql.NullTime
	var lockedUntil sql.NullTime
	err := r.db.QueryRowContext(ctx, `
		SELECT
			mfa_totp_secret_enc,
			mfa_totp_enabled,
			totp_failed_attempts,
			totp_window_started_at,
			totp_locked_until
		FROM auth_credentials
		WHERE user_id = $1
	`, userID).Scan(&secret, &state.Enabled, &state.FailedAttempts, &windowStart, &lockedUntil)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return domain.TOTPState{}, domain.ErrNotFound
		}
		return domain.TOTPState{}, fmt.Errorf("query totp state: %w", err)
	}
	state.SecretEnc = secret
	if windowStart.Valid {
		t := windowStart.Time.UTC()
		state.WindowStart = &t
	}
	if lockedUntil.Valid {
		t := lockedUntil.Time.UTC()
		state.LockedUntil = &t
	}
	return state, nil
}

func (r *AuthRepository) RecordTOTPFailure(ctx context.Context, userID string, now time.Time, maxAttempts int, window time.Duration, lockDuration time.Duration) (*time.Time, error) {
	tx, err := r.db.BeginTx(ctx, &sql.TxOptions{})
	if err != nil {
		return nil, fmt.Errorf("start record totp failure tx: %w", err)
	}

	var failedAttempts int
	var windowStart sql.NullTime
	var lockedUntil sql.NullTime
	err = tx.QueryRowContext(ctx, `
		SELECT totp_failed_attempts, totp_window_started_at, totp_locked_until
		FROM auth_credentials
		WHERE user_id = $1
		FOR UPDATE
	`, userID).Scan(&failedAttempts, &windowStart, &lockedUntil)
	if err != nil {
		_ = tx.Rollback()
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, fmt.Errorf("query totp failure state: %w", err)
	}

	nowUTC := now.UTC()
	if lockedUntil.Valid && lockedUntil.Time.After(nowUTC) {
		lock := lockedUntil.Time.UTC()
		return &lock, tx.Commit()
	}

	if !windowStart.Valid || nowUTC.Sub(windowStart.Time.UTC()) > window {
		failedAttempts = 0
		windowStart = sql.NullTime{Time: nowUTC, Valid: true}
	}

	failedAttempts++

	var nextWindowStart any = windowStart
	var nextLockedUntil any
	if failedAttempts >= maxAttempts {
		lock := nowUTC.Add(lockDuration)
		nextLockedUntil = lock
		nextWindowStart = nil
		failedAttempts = 0
	} else {
		nextLockedUntil = nil
	}

	_, err = tx.ExecContext(ctx, `
		UPDATE auth_credentials
		SET
			totp_failed_attempts = $2,
			totp_window_started_at = $3,
			totp_locked_until = $4,
			updated_at = NOW()
		WHERE user_id = $1
	`, userID, failedAttempts, nextWindowStart, nextLockedUntil)
	if err != nil {
		_ = tx.Rollback()
		return nil, fmt.Errorf("update totp failure state: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit record totp failure tx: %w", err)
	}

	if nextLockedUntil == nil {
		return nil, nil
	}
	lock := nextLockedUntil.(time.Time).UTC()
	return &lock, nil
}

func (r *AuthRepository) ResetTOTPFailures(ctx context.Context, userID string) error {
	result, err := r.db.ExecContext(ctx, `
		UPDATE auth_credentials
		SET
			totp_failed_attempts = 0,
			totp_window_started_at = NULL,
			totp_locked_until = NULL,
			updated_at = NOW()
		WHERE user_id = $1
	`, userID)
	if err != nil {
		return fmt.Errorf("reset totp failures: %w", err)
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("read rows affected: %w", err)
	}
	if affected == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *AuthRepository) DeleteExpiredSessions(ctx context.Context) (int64, error) {
	result, err := r.db.ExecContext(ctx, `
		DELETE FROM sessions WHERE expires_at < NOW() OR revoked_at IS NOT NULL
	`)
	if err != nil {
		return 0, fmt.Errorf("delete expired sessions: %w", err)
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return 0, fmt.Errorf("read rows affected: %w", err)
	}
	return affected, nil
}

func (r *AuthRepository) RevokeAllUserSessions(ctx context.Context, userID string) (int64, error) {
	result, err := r.db.ExecContext(ctx, `
		UPDATE sessions
		SET revoked_at = NOW()
		WHERE user_id = $1 AND revoked_at IS NULL
	`, userID)
	if err != nil {
		return 0, fmt.Errorf("revoke all user sessions: %w", err)
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return 0, fmt.Errorf("read rows affected: %w", err)
	}
	return affected, nil
}

func (r *AuthRepository) UpdatePassword(ctx context.Context, input domain.ResetPasswordInput) error {
	result, err := r.db.ExecContext(ctx, `
		UPDATE auth_credentials
		SET
			algo = $2,
			params = $3,
			salt = $4,
			password_hash = $5,
			updated_at = NOW()
		WHERE user_id = $1
	`, input.UserID, input.Algo, input.ParamsJSON, input.Salt, input.PasswordHash)
	if err != nil {
		return fmt.Errorf("update password: %w", err)
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("read rows affected: %w", err)
	}
	if affected == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *AuthRepository) CreateEmailVerificationCode(ctx context.Context, input domain.EmailVerificationCodeInput) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO email_verification_codes (id, user_id, purpose, code_hash, attempts, expires_at, created_at)
		VALUES ($1, $2, $3, $4, 0, $5, NOW())
	`, input.ID, input.UserID, input.Purpose, input.CodeHash, input.ExpiresAt.UTC())
	if err != nil {
		return fmt.Errorf("create email verification code: %w", err)
	}
	return nil
}

func (r *AuthRepository) GetLatestEmailVerificationCode(ctx context.Context, userID string, purpose string) (domain.EmailVerificationCode, error) {
	var code domain.EmailVerificationCode
	err := r.db.QueryRowContext(ctx, `
		SELECT id, user_id, purpose, code_hash, attempts, expires_at
		FROM email_verification_codes
		WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL
		ORDER BY created_at DESC
		LIMIT 1
	`, userID, purpose).Scan(&code.ID, &code.UserID, &code.Purpose, &code.CodeHash, &code.Attempts, &code.ExpiresAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return domain.EmailVerificationCode{}, domain.ErrNotFound
		}
		return domain.EmailVerificationCode{}, fmt.Errorf("get email verification code: %w", err)
	}
	code.ExpiresAt = code.ExpiresAt.UTC()
	return code, nil
}

func (r *AuthRepository) MarkEmailVerificationCodeConsumed(ctx context.Context, id string) error {
	if _, err := r.db.ExecContext(ctx, `
		UPDATE email_verification_codes SET consumed_at = NOW() WHERE id = $1
	`, id); err != nil {
		return fmt.Errorf("mark email verification code consumed: %w", err)
	}
	return nil
}

func (r *AuthRepository) IncrementEmailVerificationAttempts(ctx context.Context, id string) error {
	if _, err := r.db.ExecContext(ctx, `
		UPDATE email_verification_codes SET attempts = attempts + 1 WHERE id = $1
	`, id); err != nil {
		return fmt.Errorf("increment email verification attempts: %w", err)
	}
	return nil
}

func (r *AuthRepository) InvalidateEmailVerificationCodes(ctx context.Context, userID string, purpose string) error {
	if _, err := r.db.ExecContext(ctx, `
		UPDATE email_verification_codes SET consumed_at = NOW()
		WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL
	`, userID, purpose); err != nil {
		return fmt.Errorf("invalidate email verification codes: %w", err)
	}
	return nil
}

func (r *AuthRepository) WipeUserVault(ctx context.Context, userID string) error {
	tx, err := r.db.BeginTx(ctx, &sql.TxOptions{})
	if err != nil {
		return fmt.Errorf("begin wipe vault tx: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	// Deleting vault_items cascades to its versions, shares, and attachments.
	statements := []string{
		`DELETE FROM vault_shares WHERE user_id = $1`,
		`DELETE FROM vault_items WHERE owner_user_id = $1`,
		`DELETE FROM vault_folders WHERE owner_user_id = $1`,
		`DELETE FROM user_keys WHERE user_id = $1`,
	}
	for _, stmt := range statements {
		if _, err := tx.ExecContext(ctx, stmt, userID); err != nil {
			return fmt.Errorf("wipe user vault: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit wipe vault tx: %w", err)
	}
	return nil
}

func isUniqueViolation(err error) bool {
	var pqErr *pq.Error
	if errors.As(err, &pqErr) {
		return string(pqErr.Code) == "23505"
	}
	return false
}

func nullableText(value string) any {
	if value == "" {
		return nil
	}
	return value
}

func (r *AuthRepository) UpdateDisplayName(ctx context.Context, userID string, name string) error {
	result, err := r.db.ExecContext(ctx, `
		UPDATE users
		SET name = $2, updated_at = NOW()
		WHERE id = $1
	`, userID, nullableText(name))
	if err != nil {
		return fmt.Errorf("update display name: %w", err)
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("read rows affected: %w", err)
	}
	if affected == 0 {
		return domain.ErrNotFound
	}
	return nil
}
