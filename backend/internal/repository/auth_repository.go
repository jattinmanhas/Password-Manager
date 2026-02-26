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
		INSERT INTO users (id, email, name, master_password_hint, created_at, updated_at)
		VALUES ($1, $2, $3, $4, NOW(), NOW())
	`, input.UserID, input.Email, nullableText(input.Name), nullableText(input.PasswordHint))
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
	var secret []byte
	var windowStart sql.NullTime
	var lockedUntil sql.NullTime

	err := r.db.QueryRowContext(ctx, `
		SELECT
			u.id,
			u.email,
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

	_, err := r.db.ExecContext(ctx, `
		INSERT INTO sessions (
			id, user_id, refresh_token_hash, device_name, ip_address, user_agent, expires_at, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
	`, input.SessionID, input.UserID, input.TokenHash, input.DeviceName, ipAddress, input.UserAgent, input.ExpiresAt)
	if err != nil {
		return fmt.Errorf("insert session: %w", err)
	}
	return nil
}

func (r *AuthRepository) GetActiveSessionByTokenHash(ctx context.Context, tokenHash []byte) (domain.Session, error) {
	var session domain.Session
	err := r.db.QueryRowContext(ctx, `
		SELECT s.id, s.user_id, u.email, s.expires_at
		FROM sessions s
		JOIN users u ON u.id = s.user_id
		WHERE s.refresh_token_hash = $1
		  AND s.revoked_at IS NULL
		  AND s.expires_at > NOW()
	`, tokenHash).Scan(&session.ID, &session.UserID, &session.Email, &session.ExpiresAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return domain.Session{}, domain.ErrNotFound
		}
		return domain.Session{}, fmt.Errorf("query session: %w", err)
	}
	return session, nil
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

func (r *AuthRepository) ReplaceRecoveryCodes(ctx context.Context, userID string, codeHashes [][]byte) error {
	tx, err := r.db.BeginTx(ctx, &sql.TxOptions{})
	if err != nil {
		return fmt.Errorf("start replace recovery codes tx: %w", err)
	}

	if _, err := tx.ExecContext(ctx, `DELETE FROM totp_recovery_codes WHERE user_id = $1`, userID); err != nil {
		_ = tx.Rollback()
		return fmt.Errorf("delete old recovery codes: %w", err)
	}

	for _, hash := range codeHashes {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO totp_recovery_codes (user_id, code_hash, created_at)
			VALUES ($1, $2, NOW())
		`, userID, hash); err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("insert recovery code: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit replace recovery codes tx: %w", err)
	}
	return nil
}

func (r *AuthRepository) ConsumeRecoveryCode(ctx context.Context, userID string, codeHash []byte) (bool, error) {
	result, err := r.db.ExecContext(ctx, `
		UPDATE totp_recovery_codes
		SET used_at = NOW()
		WHERE user_id = $1 AND code_hash = $2 AND used_at IS NULL
	`, userID, codeHash)
	if err != nil {
		return false, fmt.Errorf("consume recovery code: %w", err)
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return false, fmt.Errorf("read rows affected: %w", err)
	}
	return affected > 0, nil
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
