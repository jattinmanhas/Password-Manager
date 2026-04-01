package service

import (
	"context"
	"fmt"
	"strings"

	"pmv2/backend/internal/domain"
)

type FamilyService struct {
	familyRepo domain.FamilyRepository
	authRepo   domain.AuthRepository
}

func NewFamilyService(
	familyRepo domain.FamilyRepository,
	authRepo domain.AuthRepository,
) *FamilyService {
	return &FamilyService{
		familyRepo: familyRepo,
		authRepo:   authRepo,
	}
}

// SendRequest sends a family request from the current user to a recipient identified by email.
func (s *FamilyService) SendRequest(ctx context.Context, senderUserID, recipientEmail string) error {
	if strings.TrimSpace(senderUserID) == "" {
		return domain.ErrUnauthorizedSession
	}
	normalizedEmail := strings.TrimSpace(strings.ToLower(recipientEmail))
	if normalizedEmail == "" {
		return domain.ErrNotFound
	}

	// Look up recipient by email
	recipient, err := s.authRepo.GetUserAuthByEmail(ctx, normalizedEmail)
	if err != nil {
		return domain.ErrNotFound
	}

	// Prevent self-add
	if recipient.UserID == senderUserID {
		return domain.ErrCannotAddSelf
	}

	// Check if already related (pending or accepted)
	existing, err := s.familyRepo.GetMembership(ctx, senderUserID, recipient.UserID)
	if err == nil {
		if existing.Status == "accepted" {
			return domain.ErrAlreadyFamilyMember
		}
		return domain.ErrFamilyRequestAlreadySent
	}

	return s.familyRepo.CreateRequest(ctx, senderUserID, recipient.UserID)
}

// AcceptRequest accepts a pending family request.
func (s *FamilyService) AcceptRequest(ctx context.Context, currentUserID, senderUserID string) error {
	if strings.TrimSpace(currentUserID) == "" {
		return domain.ErrUnauthorizedSession
	}
	if strings.TrimSpace(senderUserID) == "" {
		return domain.ErrFamilyRequestNotFound
	}
	return s.familyRepo.AcceptRequest(ctx, currentUserID, senderUserID)
}

// RejectRequest rejects / cancels a pending family request (or removes a member).
func (s *FamilyService) RejectRequest(ctx context.Context, currentUserID, otherUserID string) error {
	if strings.TrimSpace(currentUserID) == "" {
		return domain.ErrUnauthorizedSession
	}
	if strings.TrimSpace(otherUserID) == "" {
		return domain.ErrFamilyRequestNotFound
	}
	return s.familyRepo.DeleteMembership(ctx, currentUserID, otherUserID)
}

// RemoveMember removes an accepted family member.
func (s *FamilyService) RemoveMember(ctx context.Context, currentUserID, memberUserID string) error {
	if strings.TrimSpace(currentUserID) == "" {
		return domain.ErrUnauthorizedSession
	}
	if strings.TrimSpace(memberUserID) == "" {
		return domain.ErrNotFound
	}
	return s.familyRepo.DeleteMembership(ctx, currentUserID, memberUserID)
}

// ListMembers returns accepted family members.
func (s *FamilyService) ListMembers(ctx context.Context, userID string) ([]domain.FamilyMember, error) {
	if strings.TrimSpace(userID) == "" {
		return nil, domain.ErrUnauthorizedSession
	}
	members, err := s.familyRepo.ListMembers(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("list family members: %w", err)
	}
	return members, nil
}

// ListRequests returns pending received and sent requests.
func (s *FamilyService) ListRequests(ctx context.Context, userID string) ([]domain.FamilyRequest, []domain.FamilyRequest, error) {
	if strings.TrimSpace(userID) == "" {
		return nil, nil, domain.ErrUnauthorizedSession
	}
	received, err := s.familyRepo.ListPendingReceived(ctx, userID)
	if err != nil {
		return nil, nil, fmt.Errorf("list pending received: %w", err)
	}
	sent, err := s.familyRepo.ListPendingSent(ctx, userID)
	if err != nil {
		return nil, nil, fmt.Errorf("list pending sent: %w", err)
	}
	return received, sent, nil
}

// IsFamilyMember checks whether two users have an accepted relationship.
func (s *FamilyService) IsFamilyMember(ctx context.Context, userID, friendID string) (bool, error) {
	if strings.TrimSpace(userID) == "" || strings.TrimSpace(friendID) == "" {
		return false, nil
	}
	return s.familyRepo.IsFamilyMember(ctx, userID, friendID)
}
