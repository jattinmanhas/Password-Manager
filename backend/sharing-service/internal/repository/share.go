package repository

import (
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/password-manager/sharing-service/internal/database"
	"github.com/password-manager/sharing-service/internal/types"
)

type ShareRepository struct {
	db *database.DB
}

func NewShareRepository(db *database.DB) *ShareRepository {
	return &ShareRepository{db: db}
}

func (r *ShareRepository) Create(share *types.Share) error {
	query := `
		INSERT INTO shares (id, vault_item_id, owner_id, shared_with_id, permission, encrypted_key, created_at, expires_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING created_at
	`

	err := r.db.QueryRow(
		query,
		share.ID,
		share.VaultItemID,
		share.OwnerID,
		share.SharedWithID,
		share.Permission,
		share.EncryptedKey,
		time.Now(),
		share.ExpiresAt,
	).Scan(&share.CreatedAt)

	return err
}

func (r *ShareRepository) GetByID(id, userID uuid.UUID) (*types.Share, error) {
	share := &types.Share{}
	query := `
		SELECT id, vault_item_id, owner_id, shared_with_id, permission, encrypted_key, created_at, expires_at
		FROM shares
		WHERE id = $1 AND (owner_id = $2 OR shared_with_id = $2)
	`

	err := r.db.QueryRow(query, id, userID).Scan(
		&share.ID,
		&share.VaultItemID,
		&share.OwnerID,
		&share.SharedWithID,
		&share.Permission,
		&share.EncryptedKey,
		&share.CreatedAt,
		&share.ExpiresAt,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}

	return share, err
}

func (r *ShareRepository) GetByOwnerID(ownerID uuid.UUID) ([]*types.Share, error) {
	query := `
		SELECT id, vault_item_id, owner_id, shared_with_id, permission, encrypted_key, created_at, expires_at
		FROM shares
		WHERE owner_id = $1 AND (expires_at IS NULL OR expires_at > NOW())
		ORDER BY created_at DESC
	`

	rows, err := r.db.Query(query, ownerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var shares []*types.Share
	for rows.Next() {
		share := &types.Share{}
		err := rows.Scan(
			&share.ID,
			&share.VaultItemID,
			&share.OwnerID,
			&share.SharedWithID,
			&share.Permission,
			&share.EncryptedKey,
			&share.CreatedAt,
			&share.ExpiresAt,
		)
		if err != nil {
			return nil, err
		}
		shares = append(shares, share)
	}

	return shares, rows.Err()
}

func (r *ShareRepository) GetBySharedWithID(sharedWithID uuid.UUID) ([]*types.Share, error) {
	query := `
		SELECT id, vault_item_id, owner_id, shared_with_id, permission, encrypted_key, created_at, expires_at
		FROM shares
		WHERE shared_with_id = $1 AND (expires_at IS NULL OR expires_at > NOW())
		ORDER BY created_at DESC
	`

	rows, err := r.db.Query(query, sharedWithID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var shares []*types.Share
	for rows.Next() {
		share := &types.Share{}
		err := rows.Scan(
			&share.ID,
			&share.VaultItemID,
			&share.OwnerID,
			&share.SharedWithID,
			&share.Permission,
			&share.EncryptedKey,
			&share.CreatedAt,
			&share.ExpiresAt,
		)
		if err != nil {
			return nil, err
		}
		shares = append(shares, share)
	}

	return shares, rows.Err()
}

func (r *ShareRepository) GetByVaultItemID(vaultItemID, userID uuid.UUID) ([]*types.Share, error) {
	query := `
		SELECT id, vault_item_id, owner_id, shared_with_id, permission, encrypted_key, created_at, expires_at
		FROM shares
		WHERE vault_item_id = $1 AND owner_id = $2
		ORDER BY created_at DESC
	`

	rows, err := r.db.Query(query, vaultItemID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var shares []*types.Share
	for rows.Next() {
		share := &types.Share{}
		err := rows.Scan(
			&share.ID,
			&share.VaultItemID,
			&share.OwnerID,
			&share.SharedWithID,
			&share.Permission,
			&share.EncryptedKey,
			&share.CreatedAt,
			&share.ExpiresAt,
		)
		if err != nil {
			return nil, err
		}
		shares = append(shares, share)
	}

	return shares, rows.Err()
}

func (r *ShareRepository) Update(share *types.Share) error {
	query := `
		UPDATE shares
		SET permission = $1, expires_at = $2
		WHERE id = $3 AND owner_id = $4
		RETURNING created_at
	`

	err := r.db.QueryRow(
		query,
		share.Permission,
		share.ExpiresAt,
		share.ID,
		share.OwnerID,
	).Scan(&share.CreatedAt)

	if err == sql.ErrNoRows {
		return errors.New("share not found or not authorized")
	}

	return err
}

func (r *ShareRepository) Delete(id, ownerID uuid.UUID) error {
	query := `DELETE FROM shares WHERE id = $1 AND owner_id = $2`
	result, err := r.db.Exec(query, id, ownerID)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return errors.New("share not found or not authorized")
	}

	return nil
}

func (r *ShareRepository) GetSharedItemsForUser(userID uuid.UUID) ([]*types.SharedItem, error) {
	query := `
		SELECT 
			s.id as share_id,
			s.vault_item_id,
			vi.type as vault_item_type,
			vi.encrypted_data,
			s.permission,
			s.encrypted_key,
			u.email as owner_email,
			s.created_at,
			s.expires_at
		FROM shares s
		INNER JOIN vault_items vi ON s.vault_item_id = vi.id
		INNER JOIN users u ON s.owner_id = u.id
		WHERE s.shared_with_id = $1 
			AND (s.expires_at IS NULL OR s.expires_at > NOW())
		ORDER BY s.created_at DESC
	`

	rows, err := r.db.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []*types.SharedItem
	for rows.Next() {
		item := &types.SharedItem{}
		err := rows.Scan(
			&item.ShareID,
			&item.VaultItemID,
			&item.VaultItemType,
			&item.EncryptedData,
			&item.Permission,
			&item.EncryptedKey,
			&item.OwnerEmail,
			&item.CreatedAt,
			&item.ExpiresAt,
		)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}

	return items, rows.Err()
}

func (r *ShareRepository) CheckShareExists(vaultItemID, ownerID, sharedWithID uuid.UUID) (bool, error) {
	query := `
		SELECT EXISTS(
			SELECT 1 FROM shares
			WHERE vault_item_id = $1 
				AND owner_id = $2 
				AND shared_with_id = $3
				AND (expires_at IS NULL OR expires_at > NOW())
		)
	`

	var exists bool
	err := r.db.QueryRow(query, vaultItemID, ownerID, sharedWithID).Scan(&exists)
	return exists, err
}

func (r *ShareRepository) GetUserByEmail(email string) (*struct {
	ID    uuid.UUID
	Email string
}, error) {
	query := `SELECT id, email FROM users WHERE email = $1`

	var user struct {
		ID    uuid.UUID
		Email string
	}
	err := r.db.QueryRow(query, email).Scan(&user.ID, &user.Email)

	if err == sql.ErrNoRows {
		return nil, nil
	}

	return &user, err
}

