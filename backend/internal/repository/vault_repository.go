package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

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

	row := r.db.QueryRowContext(ctx, `
		INSERT INTO vault_items (
			id, owner_user_id, folder_id, ciphertext, nonce, dek_wrapped, wrap_nonce, algo_version, metadata, version, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1, NOW(), NOW())
		RETURNING
			id, owner_user_id, folder_id, ciphertext, nonce, dek_wrapped, wrap_nonce, algo_version, metadata,
			(SELECT COUNT(*) > 0 FROM vault_shares vs WHERE vs.item_id = vault_items.id) as is_shared,
			version, created_at, updated_at, deleted_at
	`, itemID, input.OwnerUserID, input.FolderID, input.Ciphertext, input.Nonce, input.WrappedDEK, input.WrapNonce, input.AlgoVersion, nullableJSON(input.Metadata))

	item, err := scanVaultItem(row)
	if err != nil {
		return domain.VaultItem{}, fmt.Errorf("insert vault item: %w", err)
	}
	return item, nil
}

func (r *VaultRepository) CreateVaultItemsBulk(ctx context.Context, inputs []domain.CreateVaultItemInput) ([]domain.VaultItem, error) {
	if len(inputs) == 0 {
		return nil, nil
	}

	tx, err := r.db.BeginTx(ctx, &sql.TxOptions{})
	if err != nil {
		return nil, fmt.Errorf("begin bulk insert tx: %w", err)
	}
	defer func() {
		_ = tx.Rollback()
	}()

	stmt, err := tx.PrepareContext(ctx, `
		INSERT INTO vault_items (
			id, owner_user_id, folder_id, ciphertext, nonce, dek_wrapped, wrap_nonce, algo_version, metadata, version, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1, NOW(), NOW())
		RETURNING
			id, owner_user_id, folder_id, ciphertext, nonce, dek_wrapped, wrap_nonce, algo_version, metadata,
			(SELECT COUNT(*) > 0 FROM vault_shares vs WHERE vs.item_id = vault_items.id) as is_shared,
			version, created_at, updated_at, deleted_at
	`)
	if err != nil {
		return nil, fmt.Errorf("prepare bulk insert stmt: %w", err)
	}
	defer stmt.Close()

	items := make([]domain.VaultItem, 0, len(inputs))
	for _, input := range inputs {
		itemID, err := util.NewUUID()
		if err != nil {
			return nil, err
		}

		row := stmt.QueryRowContext(ctx, itemID, input.OwnerUserID, input.FolderID, input.Ciphertext, input.Nonce, input.WrappedDEK, input.WrapNonce, input.AlgoVersion, nullableJSON(input.Metadata))
		item, err := scanVaultItem(row)
		if err != nil {
			return nil, fmt.Errorf("insert vault item in bulk: %w", err)
		}
		items = append(items, item)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit bulk insert tx: %w", err)
	}

	return items, nil
}

func (r *VaultRepository) ListVaultItemsByOwner(ctx context.Context, ownerUserID string) ([]domain.VaultItem, error) {
	return r.listVaultItemsByOwner(ctx, ownerUserID, false)
}

func (r *VaultRepository) ListDeletedVaultItemsByOwner(ctx context.Context, ownerUserID string) ([]domain.VaultItem, error) {
	return r.listVaultItemsByOwner(ctx, ownerUserID, true)
}

func (r *VaultRepository) listVaultItemsByOwner(ctx context.Context, ownerUserID string, deleted bool) ([]domain.VaultItem, error) {
	deletedPredicate := "IS NULL"
	orderBy := "vi.updated_at DESC"
	if deleted {
		deletedPredicate = "IS NOT NULL"
		orderBy = "vi.deleted_at DESC NULLS LAST, vi.updated_at DESC"
	}

	rows, err := r.db.QueryContext(ctx, fmt.Sprintf(`
		SELECT
			vi.id, vi.owner_user_id, vi.folder_id, vi.ciphertext, vi.nonce,
			vi.dek_wrapped, vi.wrap_nonce, vi.algo_version, vi.metadata,
			(SELECT COUNT(*) > 0 FROM vault_shares vs WHERE vs.item_id = vi.id) as is_shared,
			vi.version, vi.created_at, vi.updated_at, vi.deleted_at
		FROM vault_items vi
		WHERE vi.owner_user_id = $1
		  AND vi.deleted_at %s
		ORDER BY %s
	`, deletedPredicate, orderBy), ownerUserID)
	if err != nil {
		return nil, fmt.Errorf("query vault items: %w", err)
	}
	defer rows.Close()

	items := make([]domain.VaultItem, 0)
	for rows.Next() {
		item, err := scanVaultItem(rows)
		if err != nil {
			return nil, fmt.Errorf("scan vault item: %w", err)
		}
		items = append(items, item)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate vault items: %w", err)
	}

	return items, nil
}

func (r *VaultRepository) GetVaultItemByIDForOwner(ctx context.Context, itemID string, ownerUserID string) (domain.VaultItem, error) {
	item, err := scanVaultItem(r.db.QueryRowContext(ctx, `
		SELECT
			vi.id, vi.owner_user_id, vi.folder_id, vi.ciphertext, vi.nonce,
			vi.dek_wrapped, vi.wrap_nonce, vi.algo_version, vi.metadata,
			(SELECT COUNT(*) > 0 FROM vault_shares vs WHERE vs.item_id = vi.id) as is_shared,
			vi.version, vi.created_at, vi.updated_at, vi.deleted_at
		FROM vault_items vi
		WHERE vi.id = $1 AND vi.owner_user_id = $2
	`, itemID, ownerUserID))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return domain.VaultItem{}, domain.ErrNotFound
		}
		return domain.VaultItem{}, fmt.Errorf("get vault item: %w", err)
	}
	return item, nil
}

func (r *VaultRepository) ListVaultItemVersionsByOwner(ctx context.Context, itemID string, ownerUserID string) ([]domain.VaultItemVersion, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT
			viv.id, viv.item_id, viv.owner_user_id, viv.folder_id, viv.ciphertext, viv.nonce,
			viv.dek_wrapped, viv.wrap_nonce, viv.algo_version, viv.metadata, viv.version, viv.created_at
		FROM vault_item_versions viv
		WHERE viv.item_id = $1 AND viv.owner_user_id = $2
		ORDER BY viv.version DESC, viv.created_at DESC
	`, itemID, ownerUserID)
	if err != nil {
		return nil, fmt.Errorf("list vault item versions: %w", err)
	}
	defer rows.Close()

	versions := make([]domain.VaultItemVersion, 0)
	for rows.Next() {
		version, err := scanVaultItemVersion(rows)
		if err != nil {
			return nil, fmt.Errorf("scan vault item version: %w", err)
		}
		versions = append(versions, version)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate vault item versions: %w", err)
	}

	return versions, nil
}

func (r *VaultRepository) UpdateVaultItemForOwner(ctx context.Context, itemID string, ownerUserID string, input domain.UpdateVaultItemInput) (domain.VaultItem, error) {
	tx, err := r.db.BeginTx(ctx, &sql.TxOptions{})
	if err != nil {
		return domain.VaultItem{}, fmt.Errorf("begin update vault item tx: %w", err)
	}
	defer func() {
		_ = tx.Rollback()
	}()

	current, err := scanVaultItem(tx.QueryRowContext(ctx, `
		SELECT
			vi.id, vi.owner_user_id, vi.folder_id, vi.ciphertext, vi.nonce,
			vi.dek_wrapped, vi.wrap_nonce, vi.algo_version, vi.metadata,
			(SELECT COUNT(*) > 0 FROM vault_shares vs WHERE vs.item_id = vi.id) as is_shared,
			vi.version, vi.created_at, vi.updated_at, vi.deleted_at
		FROM vault_items vi
		WHERE vi.id = $1 AND vi.owner_user_id = $2 AND vi.deleted_at IS NULL
		FOR UPDATE
	`, itemID, ownerUserID))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return domain.VaultItem{}, domain.ErrNotFound
		}
		return domain.VaultItem{}, fmt.Errorf("lock vault item for update: %w", err)
	}

	if err := r.insertVaultItemVersion(ctx, tx, current); err != nil {
		return domain.VaultItem{}, err
	}

	nextVersion := current.Version + 1
	updated, err := scanVaultItem(tx.QueryRowContext(ctx, `
		UPDATE vault_items
		SET
			folder_id = $3,
			ciphertext = $4,
			nonce = $5,
			dek_wrapped = $6,
			wrap_nonce = $7,
			algo_version = $8,
			metadata = $9,
			version = $10,
			updated_at = NOW()
		WHERE id = $1 AND owner_user_id = $2
		RETURNING
			id, owner_user_id, folder_id, ciphertext, nonce, dek_wrapped, wrap_nonce, algo_version, metadata,
			(SELECT COUNT(*) > 0 FROM vault_shares vs WHERE vs.item_id = vault_items.id) as is_shared,
			version, created_at, updated_at, deleted_at
	`, itemID, ownerUserID, input.FolderID, input.Ciphertext, input.Nonce, input.WrappedDEK, input.WrapNonce, input.AlgoVersion, nullableJSON(input.Metadata), nextVersion))
	if err != nil {
		return domain.VaultItem{}, fmt.Errorf("update vault item: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return domain.VaultItem{}, fmt.Errorf("commit update vault item tx: %w", err)
	}
	return updated, nil
}

func (r *VaultRepository) DeleteVaultItemForOwner(ctx context.Context, itemID string, ownerUserID string) (bool, error) {
	result, err := r.db.ExecContext(ctx, `
		UPDATE vault_items
		SET deleted_at = NOW(), updated_at = NOW()
		WHERE id = $1 AND owner_user_id = $2 AND deleted_at IS NULL
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

func (r *VaultRepository) RestoreVaultItemForOwner(ctx context.Context, itemID string, ownerUserID string) (domain.VaultItem, error) {
	item, err := scanVaultItem(r.db.QueryRowContext(ctx, `
		UPDATE vault_items
		SET deleted_at = NULL, updated_at = NOW()
		WHERE id = $1 AND owner_user_id = $2 AND deleted_at IS NOT NULL
		RETURNING
			id, owner_user_id, folder_id, ciphertext, nonce, dek_wrapped, wrap_nonce, algo_version, metadata,
			(SELECT COUNT(*) > 0 FROM vault_shares vs WHERE vs.item_id = vault_items.id) as is_shared,
			version, created_at, updated_at, deleted_at
	`, itemID, ownerUserID))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return domain.VaultItem{}, domain.ErrNotFound
		}
		return domain.VaultItem{}, fmt.Errorf("restore vault item: %w", err)
	}
	return item, nil
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

type vaultItemScanner interface {
	Scan(dest ...any) error
}

func scanVaultItem(scanner vaultItemScanner) (domain.VaultItem, error) {
	var item domain.VaultItem
	var metadata []byte
	var deletedAt sql.NullTime
	if err := scanner.Scan(
		&item.ID,
		&item.OwnerUserID,
		&item.FolderID,
		&item.Ciphertext,
		&item.Nonce,
		&item.WrappedDEK,
		&item.WrapNonce,
		&item.AlgoVersion,
		&metadata,
		&item.IsShared,
		&item.Version,
		&item.CreatedAt,
		&item.UpdatedAt,
		&deletedAt,
	); err != nil {
		return domain.VaultItem{}, err
	}
	item.Metadata = metadata
	if deletedAt.Valid {
		t := deletedAt.Time.UTC()
		item.DeletedAt = &t
	}
	return item, nil
}

func scanVaultItemVersion(scanner vaultItemScanner) (domain.VaultItemVersion, error) {
	var version domain.VaultItemVersion
	var metadata []byte
	if err := scanner.Scan(
		&version.ID,
		&version.ItemID,
		&version.OwnerUserID,
		&version.FolderID,
		&version.Ciphertext,
		&version.Nonce,
		&version.WrappedDEK,
		&version.WrapNonce,
		&version.AlgoVersion,
		&metadata,
		&version.Version,
		&version.CreatedAt,
	); err != nil {
		return domain.VaultItemVersion{}, err
	}
	version.Metadata = metadata
	return version, nil
}

func (r *VaultRepository) insertVaultItemVersion(ctx context.Context, tx *sql.Tx, item domain.VaultItem) error {
	versionID, err := util.NewUUID()
	if err != nil {
		return err
	}
	createdAt := item.UpdatedAt
	if createdAt.IsZero() {
		createdAt = time.Now().UTC()
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO vault_item_versions (
			id, item_id, owner_user_id, folder_id, ciphertext, nonce, dek_wrapped, wrap_nonce, algo_version, metadata, version, created_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
	`, versionID, item.ID, item.OwnerUserID, item.FolderID, item.Ciphertext, item.Nonce, item.WrappedDEK, item.WrapNonce, item.AlgoVersion, nullableJSON(item.Metadata), item.Version, createdAt); err != nil {
		return fmt.Errorf("insert vault item version: %w", err)
	}
	return nil
}

func nullableJSON(raw []byte) any {
	if len(raw) == 0 {
		return nil
	}
	return raw
}
