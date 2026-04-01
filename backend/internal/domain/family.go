package domain

import (
	"context"
	"errors"
	"time"
)

var (
	ErrFamilyRequestAlreadySent = errors.New("family request already sent")
	ErrFamilyRequestNotFound    = errors.New("family request not found")
	ErrAlreadyFamilyMember      = errors.New("already a family member")
	ErrNotFamilyMember          = errors.New("not a family member")
	ErrCannotAddSelf            = errors.New("cannot add yourself as a family member")
)

// FamilyMembership represents a row in the family_memberships table.
type FamilyMembership struct {
	UserID      string
	FriendID    string
	Status      string // "pending" or "accepted"
	InitiatedBy string
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

// FamilyMember is a resolved member with user metadata.
type FamilyMember struct {
	UserID    string
	Email     string
	Name      string
	Status    string
	CreatedAt time.Time
}

// FamilyRequest is a pending request with sender info.
type FamilyRequest struct {
	UserID      string // the other party
	Email       string
	Name        string
	InitiatedBy string
	CreatedAt   time.Time
}

type FamilyRepository interface {
	// CreateRequest inserts a pending family request (both rows: user_id/friend_id and friend_id/user_id).
	CreateRequest(ctx context.Context, userID, friendID string) error
	// AcceptRequest updates the status from 'pending' to 'accepted'.
	AcceptRequest(ctx context.Context, userID, friendID string) error
	// DeleteMembership deletes the relationship (both directions).
	DeleteMembership(ctx context.Context, userID, friendID string) error
	// ListMembers returns accepted family members for a user.
	ListMembers(ctx context.Context, userID string) ([]FamilyMember, error)
	// ListPendingReceived returns pending requests sent TO this user.
	ListPendingReceived(ctx context.Context, userID string) ([]FamilyRequest, error)
	// ListPendingSent returns pending requests sent BY this user.
	ListPendingSent(ctx context.Context, userID string) ([]FamilyRequest, error)
	// IsFamilyMember checks if two users have an accepted family membership.
	IsFamilyMember(ctx context.Context, userID, friendID string) (bool, error)
	// GetMembership returns the membership record between two users.
	GetMembership(ctx context.Context, userID, friendID string) (FamilyMembership, error)
}
