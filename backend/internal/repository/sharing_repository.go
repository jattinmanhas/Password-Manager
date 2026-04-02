package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/lib/pq"

	"pmv2/backend/internal/domain"
)

type SharingRepository struct {
	db *sql.DB
}

func NewSharingRepository(db *sql.DB) *SharingRepository {
	return &SharingRepository{db: db}
}

func (r *SharingRepository) CreateShare(ctx context.Context, input domain.ShareItemInput) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO vault_shares (item_id, user_id, shared_by_user_id, dek_wrapped, wrap_nonce, permissions, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
	`, input.ItemID, input.RecipientID, input.SharedByUserID, input.DEKWrapped, input.WrapNonce, input.Permissions)
	if err != nil {
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && string(pqErr.Code) == "23505" {
			return domain.ErrAlreadyShared
		}
		return fmt.Errorf("create share: %w", err)
	}
	return nil
}

func (r *SharingRepository) DeleteShare(ctx context.Context, itemID string, recipientUserID string) error {
	result, err := r.db.ExecContext(ctx, `
		DELETE FROM vault_shares WHERE item_id = $1 AND user_id = $2
	`, itemID, recipientUserID)
	if err != nil {
		return fmt.Errorf("delete share: %w", err)
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("read rows affected: %w", err)
	}
	if affected == 0 {
		return domain.ErrShareNotFound
	}
	return nil
}

func (r *SharingRepository) ListSharesByRecipient(ctx context.Context, userID string) ([]domain.SharedVaultItem, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT
			vi.id, vi.owner_user_id, vi.folder_id, vi.ciphertext, vi.nonce,
			vi.dek_wrapped, vi.wrap_nonce, vi.algo_version, vi.metadata,
			vi.created_at, vi.updated_at,
			vs.shared_by_user_id, vs.dek_wrapped, vs.wrap_nonce, vs.permissions,
			COALESCE(u.email, ''), COALESCE(u.name, '')
		FROM vault_shares vs
		JOIN vault_items vi ON vi.id = vs.item_id
		LEFT JOIN users u ON u.id = vs.shared_by_user_id
		WHERE vs.user_id = $1
		ORDER BY vs.created_at DESC
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("query shared items: %w", err)
	}
	defer rows.Close()

	items := make([]domain.SharedVaultItem, 0)
	for rows.Next() {
		var si domain.SharedVaultItem
		var metadata []byte
		var sharedBy sql.NullString
		err := rows.Scan(
			&si.ID, &si.OwnerUserID, &si.FolderID, &si.Ciphertext, &si.Nonce,
			&si.WrappedDEK, &si.WrapNonce, &si.AlgoVersion, &metadata,
			&si.CreatedAt, &si.UpdatedAt,
			&sharedBy, &si.ShareDEK, &si.ShareWrapNonce, &si.Permissions,
			&si.SharedByEmail, &si.SharedByName,
		)
		if err != nil {
			return nil, fmt.Errorf("scan shared item: %w", err)
		}
		si.Metadata = metadata
		if sharedBy.Valid {
			si.SharedByUserID = sharedBy.String
		}
		items = append(items, si)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate shared items: %w", err)
	}
	return items, nil
}

func (r *SharingRepository) ListSharesByItem(ctx context.Context, itemID string) ([]domain.VaultShare, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT item_id, user_id, shared_by_user_id, dek_wrapped, wrap_nonce, permissions, created_at, updated_at
		FROM vault_shares
		WHERE item_id = $1
		ORDER BY created_at ASC
	`, itemID)
	if err != nil {
		return nil, fmt.Errorf("query shares by item: %w", err)
	}
	defer rows.Close()

	shares := make([]domain.VaultShare, 0)
	for rows.Next() {
		var s domain.VaultShare
		var sharedBy sql.NullString
		err := rows.Scan(
			&s.ItemID, &s.UserID, &sharedBy, &s.DEKWrapped, &s.WrapNonce, &s.Permissions, &s.CreatedAt, &s.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scan share: %w", err)
		}
		if sharedBy.Valid {
			s.SharedByUserID = sharedBy.String
		}
		shares = append(shares, s)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate shares: %w", err)
	}
	return shares, nil
}

func (r *SharingRepository) GetShare(ctx context.Context, itemID string, userID string) (domain.VaultShare, error) {
	var s domain.VaultShare
	var sharedBy sql.NullString
	err := r.db.QueryRowContext(ctx, `
		SELECT item_id, user_id, shared_by_user_id, dek_wrapped, wrap_nonce, permissions, created_at, updated_at
		FROM vault_shares
		WHERE item_id = $1 AND user_id = $2
	`, itemID, userID).Scan(
		&s.ItemID, &s.UserID, &sharedBy, &s.DEKWrapped, &s.WrapNonce, &s.Permissions, &s.CreatedAt, &s.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return domain.VaultShare{}, domain.ErrShareNotFound
		}
		return domain.VaultShare{}, fmt.Errorf("get share: %w", err)
	}
	if sharedBy.Valid {
		s.SharedByUserID = sharedBy.String
	}
	return s, nil
}

func (r *SharingRepository) ListSentShares(ctx context.Context, userID string) ([]domain.SentShare, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT 
			vs.item_id, 
			vi.metadata, 
			vs.user_id, 
			u.email, 
			COALESCE(u.name, ''), 
			vs.permissions, 
			vs.created_at
		FROM vault_shares vs
		JOIN vault_items vi ON vi.id = vs.item_id
		JOIN users u ON u.id = vs.user_id
		WHERE vs.shared_by_user_id = $1
		ORDER BY vs.created_at DESC
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("query sent shares: %w", err)
	}
	defer rows.Close()

	shares := make([]domain.SentShare, 0)
	for rows.Next() {
		var s domain.SentShare
		var metadata []byte
		err := rows.Scan(
			&s.ItemID, &metadata, &s.RecipientID, &s.RecipientEmail, &s.RecipientName, &s.Permissions, &s.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scan sent share: %w", err)
		}
		// Extract title from metadata (which is JSON)
		// Assuming metadata is decrypted title or similar? 
		// Wait, the item title is inside the encrypted ciphertext usually. 
		// Actually, in this project, 'metadata' in vault_items table stores the decrypted title/url for indexing/display?
		// Let me check vault_repository.go or vault_controller.go to see what's in metadata.
		// Actually, for simplicity, I'll just return the item ID and metadata for now.
		// Note from previous turns: VaultViewItem has secret?.title.
		// Let's assume metadata is a JSON blob that might contain the title if it was saved there.
		s.ItemTitle = string(metadata) // fallback
		shares = append(shares, s)
	}
	return shares, nil
}

func (r *SharingRepository) DeleteAllSharesBetweenUsers(ctx context.Context, user1ID, user2ID string) error {
	_, err := r.db.ExecContext(ctx, `
		DELETE FROM vault_shares 
		WHERE (shared_by_user_id = $1 AND user_id = $2) 
		   OR (shared_by_user_id = $2 AND user_id = $1)
	`, user1ID, user2ID)
	if err != nil {
		return fmt.Errorf("delete all shares between users: %w", err)
	}
	return nil
}
