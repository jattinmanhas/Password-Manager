package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/lib/pq"

	"pmv2/backend/internal/domain"
)

type FamilyRepository struct {
	db *sql.DB
}

func NewFamilyRepository(db *sql.DB) *FamilyRepository {
	return &FamilyRepository{db: db}
}

// CreateRequest inserts a pending family relationship.
// We store a single row with user_id = initiator, friend_id = recipient.
func (r *FamilyRepository) CreateRequest(ctx context.Context, userID, friendID string) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO family_memberships (user_id, friend_id, status, initiated_by, created_at, updated_at)
		VALUES ($1, $2, 'pending', $1, NOW(), NOW())
	`, userID, friendID)
	if err != nil {
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && string(pqErr.Code) == "23505" {
			return domain.ErrFamilyRequestAlreadySent
		}
		return fmt.Errorf("create family request: %w", err)
	}
	return nil
}

// AcceptRequest changes status from 'pending' to 'accepted'.
// The accepting user is always the friend_id (recipient).
func (r *FamilyRepository) AcceptRequest(ctx context.Context, userID, friendID string) error {
	result, err := r.db.ExecContext(ctx, `
		UPDATE family_memberships
		SET status = 'accepted', updated_at = NOW()
		WHERE user_id = $2 AND friend_id = $1 AND status = 'pending'
	`, userID, friendID)
	if err != nil {
		return fmt.Errorf("accept family request: %w", err)
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("read rows affected: %w", err)
	}
	if affected == 0 {
		return domain.ErrFamilyRequestNotFound
	}
	return nil
}

// DeleteMembership removes the family relationship in either direction.
func (r *FamilyRepository) DeleteMembership(ctx context.Context, userID, friendID string) error {
	result, err := r.db.ExecContext(ctx, `
		DELETE FROM family_memberships
		WHERE (user_id = $1 AND friend_id = $2)
		   OR (user_id = $2 AND friend_id = $1)
	`, userID, friendID)
	if err != nil {
		return fmt.Errorf("delete family membership: %w", err)
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("read rows affected: %w", err)
	}
	if affected == 0 {
		return domain.ErrFamilyRequestNotFound
	}
	return nil
}

// ListMembers returns accepted family members for a user (from both directions).
func (r *FamilyRepository) ListMembers(ctx context.Context, userID string) ([]domain.FamilyMember, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT u.id, u.email, COALESCE(u.name, ''), fm.status, fm.created_at
		FROM family_memberships fm
		JOIN users u ON u.id = CASE 
			WHEN fm.user_id = $1 THEN fm.friend_id
			ELSE fm.user_id
		END
		WHERE (fm.user_id = $1 OR fm.friend_id = $1)
		  AND fm.status = 'accepted'
		ORDER BY fm.created_at DESC
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("list family members: %w", err)
	}
	defer rows.Close()

	members := make([]domain.FamilyMember, 0)
	for rows.Next() {
		var m domain.FamilyMember
		err := rows.Scan(&m.UserID, &m.Email, &m.Name, &m.Status, &m.CreatedAt)
		if err != nil {
			return nil, fmt.Errorf("scan family member: %w", err)
		}
		members = append(members, m)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate family members: %w", err)
	}
	return members, nil
}

// ListPendingReceived lists pending requests where this user is the recipient (friend_id).
func (r *FamilyRepository) ListPendingReceived(ctx context.Context, userID string) ([]domain.FamilyRequest, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT u.id, u.email, COALESCE(u.name, ''), fm.initiated_by, fm.created_at
		FROM family_memberships fm
		JOIN users u ON u.id = fm.user_id
		WHERE fm.friend_id = $1 AND fm.status = 'pending'
		ORDER BY fm.created_at DESC
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("list pending received: %w", err)
	}
	defer rows.Close()

	reqs := make([]domain.FamilyRequest, 0)
	for rows.Next() {
		var req domain.FamilyRequest
		err := rows.Scan(&req.UserID, &req.Email, &req.Name, &req.InitiatedBy, &req.CreatedAt)
		if err != nil {
			return nil, fmt.Errorf("scan family request: %w", err)
		}
		reqs = append(reqs, req)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate pending received: %w", err)
	}
	return reqs, nil
}

// ListPendingSent lists pending requests sent BY this user.
func (r *FamilyRepository) ListPendingSent(ctx context.Context, userID string) ([]domain.FamilyRequest, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT u.id, u.email, COALESCE(u.name, ''), fm.initiated_by, fm.created_at
		FROM family_memberships fm
		JOIN users u ON u.id = fm.friend_id
		WHERE fm.user_id = $1 AND fm.status = 'pending'
		ORDER BY fm.created_at DESC
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("list pending sent: %w", err)
	}
	defer rows.Close()

	reqs := make([]domain.FamilyRequest, 0)
	for rows.Next() {
		var req domain.FamilyRequest
		err := rows.Scan(&req.UserID, &req.Email, &req.Name, &req.InitiatedBy, &req.CreatedAt)
		if err != nil {
			return nil, fmt.Errorf("scan sent request: %w", err)
		}
		reqs = append(reqs, req)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate pending sent: %w", err)
	}
	return reqs, nil
}

// IsFamilyMember checks if two users have an accepted family relationship.
func (r *FamilyRepository) IsFamilyMember(ctx context.Context, userID, friendID string) (bool, error) {
	var count int
	err := r.db.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM family_memberships
		WHERE ((user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1))
		  AND status = 'accepted'
	`, userID, friendID).Scan(&count)
	if err != nil {
		return false, fmt.Errorf("check family membership: %w", err)
	}
	return count > 0, nil
}

// GetMembership returns the record between two users (any direction).
func (r *FamilyRepository) GetMembership(ctx context.Context, userID, friendID string) (domain.FamilyMembership, error) {
	var m domain.FamilyMembership
	err := r.db.QueryRowContext(ctx, `
		SELECT user_id, friend_id, status, initiated_by, created_at, updated_at
		FROM family_memberships
		WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)
	`, userID, friendID).Scan(
		&m.UserID, &m.FriendID, &m.Status, &m.InitiatedBy, &m.CreatedAt, &m.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return domain.FamilyMembership{}, domain.ErrFamilyRequestNotFound
		}
		return domain.FamilyMembership{}, fmt.Errorf("get family membership: %w", err)
	}
	return m, nil
}
