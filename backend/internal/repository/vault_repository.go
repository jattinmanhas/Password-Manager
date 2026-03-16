package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"pmv2/backend/internal/domain"
	"pmv2/backend/internal/util"
)

type VaultRepository struct {
	db *sql.DB
}

func NewVaultRepository(db *sql.DB) *VaultRepository {
	return &VaultRepository{db: db}
}

func (r *VaultRepository) CreateVaultItem(ctx context.Context, input domain.CreateVaultItemInput) (domain.VaultItem, error) {
	itemID, err := util.NewUUID()
	if err != nil {
		return domain.VaultItem{}, err
	}

	var item domain.VaultItem
	var metadata []byte
	err = r.db.QueryRowContext(ctx, `
		INSERT INTO vault_items (
			id, owner_user_id, folder_id, ciphertext, nonce, dek_wrapped, wrap_nonce, algo_version, metadata, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
		RETURNING id, owner_user_id, folder_id, ciphertext, nonce, dek_wrapped, wrap_nonce, algo_version, metadata, created_at, updated_at
	`, itemID, input.OwnerUserID, input.FolderID, input.Ciphertext, input.Nonce, input.WrappedDEK, input.WrapNonce, input.AlgoVersion, nullableJSON(input.Metadata)).Scan(
		&item.ID,
		&item.OwnerUserID,
		&item.FolderID,
		&item.Ciphertext,
		&item.Nonce,
		&item.WrappedDEK,
		&item.WrapNonce,
		&item.AlgoVersion,
		&metadata,
		&item.CreatedAt,
		&item.UpdatedAt,
	)
	if err != nil {
		return domain.VaultItem{}, fmt.Errorf("insert vault item: %w", err)
	}

	item.Metadata = metadata
	return item, nil
}

func (r *VaultRepository) ListVaultItemsByOwner(ctx context.Context, ownerUserID string) ([]domain.VaultItem, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, owner_user_id, folder_id, ciphertext, nonce, dek_wrapped, wrap_nonce, algo_version, metadata, created_at, updated_at
		FROM vault_items
		WHERE owner_user_id = $1
		ORDER BY updated_at DESC
	`, ownerUserID)
	if err != nil {
		return nil, fmt.Errorf("query vault items: %w", err)
	}
	defer rows.Close()

	items := make([]domain.VaultItem, 0)
	for rows.Next() {
		var item domain.VaultItem
		var metadata []byte
		if err := rows.Scan(
			&item.ID,
			&item.OwnerUserID,
			&item.FolderID,
			&item.Ciphertext,
			&item.Nonce,
			&item.WrappedDEK,
			&item.WrapNonce,
			&item.AlgoVersion,
			&metadata,
			&item.CreatedAt,
			&item.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan vault item: %w", err)
		}
		item.Metadata = metadata
		items = append(items, item)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate vault items: %w", err)
	}

	return items, nil
}

func (r *VaultRepository) GetVaultItemByIDForOwner(ctx context.Context, itemID string, ownerUserID string) (domain.VaultItem, error) {
	var item domain.VaultItem
	var metadata []byte
	err := r.db.QueryRowContext(ctx, `
		SELECT id, owner_user_id, folder_id, ciphertext, nonce, dek_wrapped, wrap_nonce, algo_version, metadata, created_at, updated_at
		FROM vault_items
		WHERE id = $1 AND owner_user_id = $2
	`, itemID, ownerUserID).Scan(
		&item.ID,
		&item.OwnerUserID,
		&item.FolderID,
		&item.Ciphertext,
		&item.Nonce,
		&item.WrappedDEK,
		&item.WrapNonce,
		&item.AlgoVersion,
		&metadata,
		&item.CreatedAt,
		&item.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return domain.VaultItem{}, domain.ErrNotFound
		}
		return domain.VaultItem{}, fmt.Errorf("get vault item: %w", err)
	}
	item.Metadata = metadata
	return item, nil
}

func (r *VaultRepository) UpdateVaultItemForOwner(ctx context.Context, itemID string, ownerUserID string, input domain.UpdateVaultItemInput) (domain.VaultItem, error) {
	var item domain.VaultItem
	var metadata []byte
	err := r.db.QueryRowContext(ctx, `
		UPDATE vault_items
		SET
			folder_id = $3,
			ciphertext = $4,
			nonce = $5,
			dek_wrapped = $6,
			wrap_nonce = $7,
			algo_version = $8,
			metadata = $9,
			updated_at = NOW()
		WHERE id = $1 AND owner_user_id = $2
		RETURNING id, owner_user_id, folder_id, ciphertext, nonce, dek_wrapped, wrap_nonce, algo_version, metadata, created_at, updated_at
	`, itemID, ownerUserID, input.FolderID, input.Ciphertext, input.Nonce, input.WrappedDEK, input.WrapNonce, input.AlgoVersion, nullableJSON(input.Metadata)).Scan(
		&item.ID,
		&item.OwnerUserID,
		&item.FolderID,
		&item.Ciphertext,
		&item.Nonce,
		&item.WrappedDEK,
		&item.WrapNonce,
		&item.AlgoVersion,
		&metadata,
		&item.CreatedAt,
		&item.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return domain.VaultItem{}, domain.ErrNotFound
		}
		return domain.VaultItem{}, fmt.Errorf("update vault item: %w", err)
	}
	item.Metadata = metadata
	return item, nil
}

func (r *VaultRepository) DeleteVaultItemForOwner(ctx context.Context, itemID string, ownerUserID string) (bool, error) {
	result, err := r.db.ExecContext(ctx, `
		DELETE FROM vault_items WHERE id = $1 AND owner_user_id = $2
	`, itemID, ownerUserID)
	if err != nil {
		return false, fmt.Errorf("delete vault item: %w", err)
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return false, fmt.Errorf("read rows affected: %w", err)
	}
	return affected > 0, nil
}

func (r *VaultRepository) GetVaultSaltForUser(ctx context.Context, userID string) ([]byte, error) {
	var salt []byte
	err := r.db.QueryRowContext(ctx, `
		SELECT salt FROM auth_credentials WHERE user_id = $1
	`, userID).Scan(&salt)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, fmt.Errorf("get vault salt: %w", err)
	}

	return salt, nil
}

func nullableJSON(raw []byte) any {
	if len(raw) == 0 {
		return nil
	}
	return raw
}
