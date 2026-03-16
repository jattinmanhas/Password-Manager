package repository

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"pmv2/backend/internal/domain"
	"pmv2/backend/internal/util"
)

type PostgresFolderRepository struct {
	db *sql.DB
}

func NewPostgresFolderRepository(db *sql.DB) *PostgresFolderRepository {
	return &PostgresFolderRepository{db: db}
}

func (r *PostgresFolderRepository) CreateFolder(ctx context.Context, input domain.CreateVaultFolderInput) (domain.VaultFolder, error) {
	folderID, err := util.NewUUID()
	if err != nil {
		return domain.VaultFolder{}, err
	}

	folder := domain.VaultFolder{
		ID:             folderID,
		OwnerUserID:    input.OwnerUserID,
		NameCiphertext: input.NameCiphertext,
		Nonce:          input.Nonce,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	query := `
		INSERT INTO vault_folders (id, owner_user_id, name_ciphertext, nonce, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`
	_, err = r.db.ExecContext(ctx, query, folder.ID, folder.OwnerUserID, folder.NameCiphertext, folder.Nonce, folder.CreatedAt, folder.UpdatedAt)
	if err != nil {
		return domain.VaultFolder{}, err
	}

	return folder, nil
}

func (r *PostgresFolderRepository) ListFoldersByOwner(ctx context.Context, ownerUserID string) ([]domain.VaultFolder, error) {
	query := `
		SELECT id, owner_user_id, name_ciphertext, nonce, created_at, updated_at
		FROM vault_folders
		WHERE owner_user_id = $1
		ORDER BY created_at DESC
	`
	rows, err := r.db.QueryContext(ctx, query, ownerUserID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var folders []domain.VaultFolder
	for rows.Next() {
		var f domain.VaultFolder
		if err := rows.Scan(&f.ID, &f.OwnerUserID, &f.NameCiphertext, &f.Nonce, &f.CreatedAt, &f.UpdatedAt); err != nil {
			return nil, err
		}
		folders = append(folders, f)
	}

	return folders, nil
}

func (r *PostgresFolderRepository) GetFolderByIDForOwner(ctx context.Context, folderID string, ownerUserID string) (domain.VaultFolder, error) {
	query := `
		SELECT id, owner_user_id, name_ciphertext, nonce, created_at, updated_at
		FROM vault_folders
		WHERE id = $1 AND owner_user_id = $2
	`
	var f domain.VaultFolder
	err := r.db.QueryRowContext(ctx, query, folderID, ownerUserID).Scan(&f.ID, &f.OwnerUserID, &f.NameCiphertext, &f.Nonce, &f.CreatedAt, &f.UpdatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return domain.VaultFolder{}, domain.ErrNotFound
		}
		return domain.VaultFolder{}, err
	}

	return f, nil
}

func (r *PostgresFolderRepository) UpdateFolderForOwner(ctx context.Context, folderID string, ownerUserID string, nameCiphertext []byte, nonce []byte) (domain.VaultFolder, error) {
	updatedAt := time.Now()
	query := `
		UPDATE vault_folders
		SET name_ciphertext = $1, nonce = $2, updated_at = $3
		WHERE id = $4 AND owner_user_id = $5
		RETURNING id, owner_user_id, name_ciphertext, nonce, created_at, updated_at
	`
	var f domain.VaultFolder
	err := r.db.QueryRowContext(ctx, query, nameCiphertext, nonce, updatedAt, folderID, ownerUserID).Scan(&f.ID, &f.OwnerUserID, &f.NameCiphertext, &f.Nonce, &f.CreatedAt, &f.UpdatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return domain.VaultFolder{}, domain.ErrNotFound
		}
		return domain.VaultFolder{}, err
	}

	return f, nil
}

func (r *PostgresFolderRepository) DeleteFolderForOwner(ctx context.Context, folderID string, ownerUserID string) (bool, error) {
	query := `DELETE FROM vault_folders WHERE id = $1 AND owner_user_id = $2`
	res, err := r.db.ExecContext(ctx, query, folderID, ownerUserID)
	if err != nil {
		return false, err
	}

	rows, err := res.RowsAffected()
	if err != nil {
		return false, err
	}

	return rows > 0, nil
}
