package repository

import (
	"database/sql"
	"time"

	"github.com/google/uuid"
	"github.com/password-manager/auth-service/internal/database"
	"github.com/password-manager/auth-service/internal/types"
)

type UserRepository struct {
	db *database.DB
}

func NewUserRepository(db *database.DB) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) Create(user *types.User) error {
	query := `
		INSERT INTO users (id, email, master_password_hash, encryption_key_encrypted, salt, created_at, account_status)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, created_at
	`
	
	err := r.db.QueryRow(
		query,
		user.ID,
		user.Email,
		user.MasterPasswordHash,
		user.EncryptionKeyEncrypted,
		user.Salt,
		time.Now(),
		"active",
	).Scan(&user.ID, &user.CreatedAt)
	
	return err
}

func (r *UserRepository) GetByEmail(email string) (*types.User, error) {
	user := &types.User{}
	query := `
		SELECT id, email, master_password_hash, encryption_key_encrypted, salt,
		       two_factor_enabled, two_factor_secret_encrypted, backup_codes_encrypted,
		       created_at, last_login, account_status
		FROM users
		WHERE email = $1 AND account_status = 'active'
	`
	
	err := r.db.QueryRow(query, email).Scan(
		&user.ID,
		&user.Email,
		&user.MasterPasswordHash,
		&user.EncryptionKeyEncrypted,
		&user.Salt,
		&user.TwoFactorEnabled,
		&user.TwoFactorSecretEncrypted,
		&user.BackupCodesEncrypted,
		&user.CreatedAt,
		&user.LastLogin,
		&user.AccountStatus,
	)
	
	if err == sql.ErrNoRows {
		return nil, nil
	}
	
	return user, err
}

func (r *UserRepository) GetByID(id uuid.UUID) (*types.User, error) {
	user := &types.User{}
	query := `
		SELECT id, email, master_password_hash, encryption_key_encrypted, salt,
		       two_factor_enabled, two_factor_secret_encrypted, backup_codes_encrypted,
		       created_at, last_login, account_status
		FROM users
		WHERE id = $1 AND account_status = 'active'
	`
	
	err := r.db.QueryRow(query, id).Scan(
		&user.ID,
		&user.Email,
		&user.MasterPasswordHash,
		&user.EncryptionKeyEncrypted,
		&user.Salt,
		&user.TwoFactorEnabled,
		&user.TwoFactorSecretEncrypted,
		&user.BackupCodesEncrypted,
		&user.CreatedAt,
		&user.LastLogin,
		&user.AccountStatus,
	)
	
	if err == sql.ErrNoRows {
		return nil, nil
	}
	
	return user, err
}

func (r *UserRepository) UpdateLastLogin(id uuid.UUID) error {
	query := `UPDATE users SET last_login = $1 WHERE id = $2`
	_, err := r.db.Exec(query, time.Now(), id)
	return err
}

func (r *UserRepository) Update2FA(id uuid.UUID, enabled bool, secretEncrypted, backupCodesEncrypted string) error {
	query := `
		UPDATE users 
		SET two_factor_enabled = $1, 
		    two_factor_secret_encrypted = $2, 
		    backup_codes_encrypted = $3
		WHERE id = $4
	`
	_, err := r.db.Exec(query, enabled, secretEncrypted, backupCodesEncrypted, id)
	return err
}

func (r *UserRepository) UpdatePassword(id uuid.UUID, passwordHash, salt, encryptionKeyEncrypted string) error {
	query := `
		UPDATE users 
		SET master_password_hash = $1, 
		    salt = $2, 
		    encryption_key_encrypted = $3
		WHERE id = $4
	`
	_, err := r.db.Exec(query, passwordHash, salt, encryptionKeyEncrypted, id)
	return err
}

