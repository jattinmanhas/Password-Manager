package repository

import (
	"database/sql"
	"time"

	"github.com/google/uuid"
	"github.com/password-manager/vault-service/internal/database"
	"github.com/password-manager/vault-service/internal/types"
)

type FolderRepository struct {
	db *database.DB
}

func NewFolderRepository(db *database.DB) *FolderRepository {
	return &FolderRepository{db: db}
}

func (r *FolderRepository) Create(folder *types.Folder) error {
	query := `
		INSERT INTO folders (id, user_id, name_encrypted, parent_id, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at, updated_at
	`

	now := time.Now()
	err := r.db.QueryRow(
		query,
		folder.ID,
		folder.UserID,
		folder.NameEncrypted,
		folder.ParentID,
		now,
		now,
	).Scan(&folder.ID, &folder.CreatedAt, &folder.UpdatedAt)

	return err
}

func (r *FolderRepository) GetByID(id, userID uuid.UUID) (*types.Folder, error) {
	folder := &types.Folder{}
	query := `
		SELECT id, user_id, name_encrypted, parent_id, created_at, updated_at
		FROM folders
		WHERE id = $1 AND user_id = $2
	`

	err := r.db.QueryRow(query, id, userID).Scan(
		&folder.ID,
		&folder.UserID,
		&folder.NameEncrypted,
		&folder.ParentID,
		&folder.CreatedAt,
		&folder.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}

	return folder, err
}

func (r *FolderRepository) GetByUserID(userID uuid.UUID, parentID *uuid.UUID) ([]*types.Folder, error) {
	var folders []*types.Folder
	var query string
	var args []interface{}

	baseQuery := `
		SELECT id, user_id, name_encrypted, parent_id, created_at, updated_at
		FROM folders
		WHERE user_id = $1
	`

	args = append(args, userID)

	if parentID != nil {
		query = baseQuery + " AND parent_id = $2"
		args = append(args, *parentID)
	} else {
		query = baseQuery + " AND parent_id IS NULL"
	}

	query += " ORDER BY created_at ASC"

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		folder := &types.Folder{}
		err := rows.Scan(
			&folder.ID,
			&folder.UserID,
			&folder.NameEncrypted,
			&folder.ParentID,
			&folder.CreatedAt,
			&folder.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		folders = append(folders, folder)
	}

	return folders, rows.Err()
}

func (r *FolderRepository) Update(folder *types.Folder) error {
	query := `
		UPDATE folders
		SET name_encrypted = $1, updated_at = $2
		WHERE id = $3 AND user_id = $4
		RETURNING updated_at
	`

	var updatedAt time.Time
	err := r.db.QueryRow(
		query,
		folder.NameEncrypted,
		time.Now(),
		folder.ID,
		folder.UserID,
	).Scan(&updatedAt)

	if err == sql.ErrNoRows {
		return sql.ErrNoRows
	}

	folder.UpdatedAt = updatedAt
	return err
}

func (r *FolderRepository) Delete(id, userID uuid.UUID) error {
	// Check if folder has children
	var childCount int
	checkQuery := `SELECT COUNT(*) FROM folders WHERE parent_id = $1 AND user_id = $2`
	err := r.db.QueryRow(checkQuery, id, userID).Scan(&childCount)
	if err != nil {
		return err
	}

	if childCount > 0 {
		return sql.ErrNoRows // Cannot delete folder with children
	}

	// Check if folder has items
	var itemCount int
	itemQuery := `SELECT COUNT(*) FROM vault_items WHERE folder_id = $1 AND user_id = $2`
	err = r.db.QueryRow(itemQuery, id, userID).Scan(&itemCount)
	if err != nil {
		return err
	}

	if itemCount > 0 {
		return sql.ErrNoRows // Cannot delete folder with items
	}

	// Delete folder
	query := `DELETE FROM folders WHERE id = $1 AND user_id = $2`
	result, err := r.db.Exec(query, id, userID)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return sql.ErrNoRows
	}

	return nil
}

