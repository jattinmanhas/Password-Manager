package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"pmv2/backend/internal/domain"
)

type UserKeysRepository struct {
	db *sql.DB
}

func NewUserKeysRepository(db *sql.DB) *UserKeysRepository {
	return &UserKeysRepository{db: db}
}

func (r *UserKeysRepository) UpsertKeys(ctx context.Context, input domain.UpsertUserKeysInput) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO user_keys (user_id, public_key_x25519, encrypted_private_keys, nonce, created_at, updated_at)
		VALUES ($1, $2, $3, $4, NOW(), NOW())
		ON CONFLICT (user_id) DO UPDATE SET
			public_key_x25519 = EXCLUDED.public_key_x25519,
			encrypted_private_keys = EXCLUDED.encrypted_private_keys,
			nonce = EXCLUDED.nonce,
			updated_at = NOW()
	`, input.UserID, input.PublicKeyX25519, input.EncryptedPrivateKeys, input.Nonce)
	if err != nil {
		return fmt.Errorf("upsert user keys: %w", err)
	}
	return nil
}

func (r *UserKeysRepository) GetKeysByUserID(ctx context.Context, userID string) (domain.UserKeys, error) {
	var keys domain.UserKeys
	var edKey []byte
	err := r.db.QueryRowContext(ctx, `
		SELECT user_id, public_key_x25519, public_key_ed25519, encrypted_private_keys, nonce, created_at, updated_at
		FROM user_keys
		WHERE user_id = $1
	`, userID).Scan(
		&keys.UserID,
		&keys.PublicKeyX25519,
		&edKey,
		&keys.EncryptedPrivateKeys,
		&keys.Nonce,
		&keys.CreatedAt,
		&keys.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return domain.UserKeys{}, domain.ErrNotFound
		}
		return domain.UserKeys{}, fmt.Errorf("get user keys: %w", err)
	}
	keys.PublicKeyEd25519 = edKey
	return keys, nil
}

func (r *UserKeysRepository) GetPublicKeyByEmail(ctx context.Context, email string) (domain.UserKeys, string, error) {
	var keys domain.UserKeys
	var userID string
	err := r.db.QueryRowContext(ctx, `
		SELECT uk.user_id, uk.public_key_x25519, uk.created_at, uk.updated_at
		FROM user_keys uk
		JOIN users u ON u.id = uk.user_id
		WHERE u.email = $1
	`, email).Scan(
		&userID,
		&keys.PublicKeyX25519,
		&keys.CreatedAt,
		&keys.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return domain.UserKeys{}, "", domain.ErrRecipientKeysNotFound
		}
		return domain.UserKeys{}, "", fmt.Errorf("get public key by email: %w", err)
	}
	keys.UserID = userID
	return keys, userID, nil
}
