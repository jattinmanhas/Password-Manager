package repository

import (
	"database/sql"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/password-manager/vault-service/internal/database"
	"github.com/password-manager/vault-service/internal/types"
)

type VaultRepository struct {
	db *database.DB
}

func NewVaultRepository(db *database.DB) *VaultRepository {
	return &VaultRepository{db: db}
}

func (r *VaultRepository) Create(item *types.VaultItem) error {
	query := `
		INSERT INTO vault_items (id, user_id, type, encrypted_data, title_encrypted, tags_encrypted, url_encrypted, username_encrypted, folder_id, favorite, created_at, updated_at, version)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		RETURNING id, created_at, updated_at, version
	`

	now := time.Now()
	err := r.db.QueryRow(
		query,
		item.ID,
		item.UserID,
		item.Type,
		item.EncryptedData,
		item.TitleEncrypted,
		item.TagsEncrypted,
		item.URLEncrypted,
		item.UsernameEncrypted,
		item.FolderID,
		item.Favorite,
		now,
		now,
		1,
	).Scan(&item.ID, &item.CreatedAt, &item.UpdatedAt, &item.Version)

	return err
}

func (r *VaultRepository) GetByID(id, userID uuid.UUID) (*types.VaultItem, error) {
	item := &types.VaultItem{}
	query := `
		SELECT id, user_id, type, encrypted_data, title_encrypted, tags_encrypted, url_encrypted, username_encrypted, folder_id, favorite, created_at, updated_at, version
		FROM vault_items
		WHERE id = $1 AND user_id = $2
	`

	err := r.db.QueryRow(query, id, userID).Scan(
		&item.ID,
		&item.UserID,
		&item.Type,
		&item.EncryptedData,
		&item.TitleEncrypted,
		&item.TagsEncrypted,
		&item.URLEncrypted,
		&item.UsernameEncrypted,
		&item.FolderID,
		&item.Favorite,
		&item.CreatedAt,
		&item.UpdatedAt,
		&item.Version,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}

	return item, err
}

func (r *VaultRepository) GetByUserID(userID uuid.UUID, folderID *uuid.UUID, itemType string) ([]*types.VaultItem, error) {
	var items []*types.VaultItem
	var query string
	var args []interface{}

	baseQuery := `
		SELECT id, user_id, type, encrypted_data, title_encrypted, tags_encrypted, url_encrypted, username_encrypted, folder_id, favorite, created_at, updated_at, version
		FROM vault_items
		WHERE user_id = $1
	`

	args = append(args, userID)

	if folderID != nil {
		query = baseQuery + " AND folder_id = $2"
		args = append(args, *folderID)
	}

	if itemType != "" {
		if folderID != nil {
			query += " AND type = $3"
		} else {
			query += " AND type = $2"
		}
		args = append(args, itemType)
	}

	query += " ORDER BY updated_at DESC"

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		item := &types.VaultItem{}
		err := rows.Scan(
			&item.ID,
			&item.UserID,
			&item.Type,
			&item.EncryptedData,
			&item.TitleEncrypted,
			&item.TagsEncrypted,
			&item.URLEncrypted,
			&item.UsernameEncrypted,
			&item.FolderID,
			&item.Favorite,
			&item.CreatedAt,
			&item.UpdatedAt,
			&item.Version,
		)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}

	return items, rows.Err()
}

func (r *VaultRepository) Update(item *types.VaultItem) error {
	query := `
		UPDATE vault_items
		SET encrypted_data = $1, title_encrypted = $2, tags_encrypted = $3, url_encrypted = $4, username_encrypted = $5, folder_id = $6, favorite = $7, updated_at = $8, version = $9
		WHERE id = $10 AND user_id = $11 AND version = $12
		RETURNING updated_at, version
	`

	var newVersion int
	var updatedAt time.Time
	err := r.db.QueryRow(
		query,
		item.EncryptedData,
		item.TitleEncrypted,
		item.TagsEncrypted,
		item.URLEncrypted,
		item.UsernameEncrypted,
		item.FolderID,
		item.Favorite,
		time.Now(),
		item.Version+1,
		item.ID,
		item.UserID,
		item.Version,
	).Scan(&updatedAt, &newVersion)

	if err == sql.ErrNoRows {
		return sql.ErrNoRows // Version conflict or item not found
	}

	item.UpdatedAt = updatedAt
	item.Version = newVersion
	return err
}

func (r *VaultRepository) Delete(id, userID uuid.UUID) error {
	query := `DELETE FROM vault_items WHERE id = $1 AND user_id = $2`
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

func (r *VaultRepository) Search(userID uuid.UUID, req *types.SearchRequest, searchHashes []string) ([]*types.VaultItem, error) {
	var items []*types.VaultItem
	baseQuery := `
		SELECT id, user_id, type, encrypted_data, title_encrypted, tags_encrypted, url_encrypted, username_encrypted, folder_id, favorite, created_at, updated_at, version
		FROM vault_items
		WHERE user_id = $1
	`

	args := []interface{}{userID}
	argIndex := 2

	// Search in encrypted metadata fields (using deterministic encryption hashes)
	if len(searchHashes) > 0 {
		searchConditions := []string{}
		if req.SearchInTitle {
			for _, hash := range searchHashes {
				searchConditions = append(searchConditions, "title_encrypted LIKE $"+strconv.Itoa(argIndex))
				args = append(args, "%"+hash+"%")
				argIndex++
			}
		}
		if req.SearchInTags {
			for _, hash := range searchHashes {
				searchConditions = append(searchConditions, "tags_encrypted LIKE $"+strconv.Itoa(argIndex))
				args = append(args, "%"+hash+"%")
				argIndex++
			}
		}
		if req.SearchInURL {
			for _, hash := range searchHashes {
				searchConditions = append(searchConditions, "url_encrypted LIKE $"+strconv.Itoa(argIndex))
				args = append(args, "%"+hash+"%")
				argIndex++
			}
		}
		if req.SearchInUsername {
			for _, hash := range searchHashes {
				searchConditions = append(searchConditions, "username_encrypted LIKE $"+strconv.Itoa(argIndex))
				args = append(args, "%"+hash+"%")
				argIndex++
			}
		}

		if len(searchConditions) > 0 {
			baseQuery += " AND (" + strings.Join(searchConditions, " OR ") + ")"
		}
	}

	// Filter by type
	if req.Type != "" {
		baseQuery += " AND type = $" + strconv.Itoa(argIndex)
		args = append(args, req.Type)
		argIndex++
	}

	// Filter by folder
	if req.FolderID != nil {
		baseQuery += " AND folder_id = $" + strconv.Itoa(argIndex)
		args = append(args, *req.FolderID)
		argIndex++
	}

	// Filter by favorite
	if req.Favorite != nil {
		baseQuery += " AND favorite = $" + strconv.Itoa(argIndex)
		args = append(args, *req.Favorite)
		argIndex++
	}

	// Filter by creation date
	if req.CreatedAfter != nil {
		baseQuery += " AND created_at >= $" + strconv.Itoa(argIndex)
		args = append(args, *req.CreatedAfter)
		argIndex++
	}
	if req.CreatedBefore != nil {
		baseQuery += " AND created_at <= $" + strconv.Itoa(argIndex)
		args = append(args, *req.CreatedBefore)
		argIndex++
	}

	// Filter by update date
	if req.UpdatedAfter != nil {
		baseQuery += " AND updated_at >= $" + strconv.Itoa(argIndex)
		args = append(args, *req.UpdatedAfter)
		argIndex++
	}
	if req.UpdatedBefore != nil {
		baseQuery += " AND updated_at <= $" + strconv.Itoa(argIndex)
		args = append(args, *req.UpdatedBefore)
		argIndex++
	}

	baseQuery += " ORDER BY updated_at DESC"

	// Pagination
	if req.Limit > 0 {
		baseQuery += " LIMIT $" + strconv.Itoa(argIndex)
		args = append(args, req.Limit)
		argIndex++
	} else {
		baseQuery += " LIMIT $2" // Default limit
		if len(args) == 1 {
			args = append(args, 100)
		}
	}

	if req.Offset > 0 {
		baseQuery += " OFFSET $" + strconv.Itoa(argIndex)
		args = append(args, req.Offset)
	}

	rows, err := r.db.Query(baseQuery, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		item := &types.VaultItem{}
		err := rows.Scan(
			&item.ID,
			&item.UserID,
			&item.Type,
			&item.EncryptedData,
			&item.TitleEncrypted,
			&item.TagsEncrypted,
			&item.URLEncrypted,
			&item.UsernameEncrypted,
			&item.FolderID,
			&item.Favorite,
			&item.CreatedAt,
			&item.UpdatedAt,
			&item.Version,
		)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}

	return items, rows.Err()
}

