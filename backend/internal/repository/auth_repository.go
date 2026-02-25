package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

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

	err := r.db.QueryRowContext(ctx, `
		SELECT u.id, u.email, ac.salt, ac.password_hash, ac.params, ac.mfa_totp_enabled, ac.mfa_totp_secret_enc
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
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return domain.UserAuthRecord{}, domain.ErrNotFound
		}
		return domain.UserAuthRecord{}, fmt.Errorf("query auth record: %w", err)
	}

	record.TOTPSecret = string(secret)
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

func (r *AuthRepository) SetTOTPSecret(ctx context.Context, userID string, secret string) (bool, error) {
	result, err := r.db.ExecContext(ctx, `
		UPDATE auth_credentials
		SET mfa_totp_secret_enc = $1, mfa_totp_enabled = FALSE, updated_at = NOW()
		WHERE user_id = $2
	`, []byte(secret), userID)
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
		SET mfa_totp_enabled = TRUE, updated_at = NOW()
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
	err := r.db.QueryRowContext(ctx, `
		SELECT mfa_totp_secret_enc, mfa_totp_enabled
		FROM auth_credentials
		WHERE user_id = $1
	`, userID).Scan(&secret, &state.Enabled)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return domain.TOTPState{}, domain.ErrNotFound
		}
		return domain.TOTPState{}, fmt.Errorf("query totp state: %w", err)
	}
	state.Secret = string(secret)
	return state, nil
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
