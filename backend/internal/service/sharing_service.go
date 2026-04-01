package service

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"pmv2/backend/internal/domain"
)

type SharingService struct {
	shareRepo  domain.SharingRepository
	keysRepo   domain.UserKeysRepository
	vaultRepo  domain.VaultRepository
	familyRepo domain.FamilyRepository
}

func NewSharingService(
	shareRepo domain.SharingRepository,
	keysRepo domain.UserKeysRepository,
	vaultRepo domain.VaultRepository,
	familyRepo domain.FamilyRepository,
) *SharingService {
	return &SharingService{
		shareRepo:  shareRepo,
		keysRepo:   keysRepo,
		vaultRepo:  vaultRepo,
		familyRepo: familyRepo,
	}
}

// UpsertUserKeys stores or updates the user's asymmetric key pair.
func (s *SharingService) UpsertUserKeys(ctx context.Context, userID string, input domain.UpsertUserKeysInput) error {
	if strings.TrimSpace(userID) == "" {
		return domain.ErrUnauthorizedSession
	}
	if len(input.PublicKeyX25519) == 0 || len(input.EncryptedPrivateKeys) == 0 || len(input.Nonce) == 0 {
		return domain.ErrInvalidVaultPayload
	}

	input.UserID = userID
	return s.keysRepo.UpsertKeys(ctx, input)
}

// GetUserKeys retrieves the current user's full key material.
func (s *SharingService) GetUserKeys(ctx context.Context, userID string) (domain.UserKeys, error) {
	if strings.TrimSpace(userID) == "" {
		return domain.UserKeys{}, domain.ErrUnauthorizedSession
	}
	keys, err := s.keysRepo.GetKeysByUserID(ctx, userID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return domain.UserKeys{}, domain.ErrNotFound
		}
		return domain.UserKeys{}, fmt.Errorf("get user keys: %w", err)
	}
	return keys, nil
}

// GetPublicKeyByEmail returns the public key for a user identified by email.
func (s *SharingService) GetPublicKeyByEmail(ctx context.Context, email string) (domain.UserKeys, string, error) {
	normalizedEmail := strings.TrimSpace(strings.ToLower(email))
	if normalizedEmail == "" {
		return domain.UserKeys{}, "", domain.ErrRecipientKeysNotFound
	}
	keys, userID, err := s.keysRepo.GetPublicKeyByEmail(ctx, normalizedEmail)
	if err != nil {
		return domain.UserKeys{}, "", err
	}
	return keys, userID, nil
}

// ShareItem creates a share record. Only the item owner can share.
func (s *SharingService) ShareItem(ctx context.Context, ownerUserID string, itemID string, input domain.ShareItemInput) error {
	if strings.TrimSpace(ownerUserID) == "" {
		return domain.ErrUnauthorizedSession
	}
	if strings.TrimSpace(itemID) == "" {
		return domain.ErrNotFound
	}

	// Verify ownership
	_, err := s.vaultRepo.GetVaultItemByIDForOwner(ctx, itemID, ownerUserID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return domain.ErrNotItemOwner
		}
		return fmt.Errorf("verify item ownership: %w", err)
	}

	// Prevent self-share
	if input.RecipientID == ownerUserID {
		return domain.ErrCannotShareWithSelf
	}

	// Verify family membership
	isMember, err := s.familyRepo.IsFamilyMember(ctx, ownerUserID, input.RecipientID)
	if err != nil {
		return fmt.Errorf("check family membership: %w", err)
	}
	if !isMember {
		return domain.ErrNotFamilyMember
	}

	if len(input.DEKWrapped) == 0 || len(input.WrapNonce) == 0 {
		return domain.ErrInvalidVaultPayload
	}

	input.ItemID = itemID
	input.SharedByUserID = ownerUserID
	if input.Permissions == "" {
		input.Permissions = "read"
	}

	err = s.shareRepo.CreateShare(ctx, input)
	if err != nil {
		if errors.Is(err, domain.ErrAlreadyShared) {
			return domain.ErrAlreadyShared
		}
		return fmt.Errorf("create share: %w", err)
	}
	return nil
}

// RevokeShare removes a share. Only the item owner can revoke.
func (s *SharingService) RevokeShare(ctx context.Context, ownerUserID string, itemID string, recipientUserID string) error {
	if strings.TrimSpace(ownerUserID) == "" {
		return domain.ErrUnauthorizedSession
	}

	// Verify ownership
	_, err := s.vaultRepo.GetVaultItemByIDForOwner(ctx, itemID, ownerUserID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return domain.ErrNotItemOwner
		}
		return fmt.Errorf("verify item ownership for revoke: %w", err)
	}

	err = s.shareRepo.DeleteShare(ctx, itemID, recipientUserID)
	if err != nil {
		return fmt.Errorf("delete share: %w", err)
	}
	return nil
}

// ListSharedWithMe returns all items shared with the given user.
func (s *SharingService) ListSharedWithMe(ctx context.Context, userID string) ([]domain.SharedVaultItem, error) {
	if strings.TrimSpace(userID) == "" {
		return nil, domain.ErrUnauthorizedSession
	}
	items, err := s.shareRepo.ListSharesByRecipient(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("list shared with me: %w", err)
	}
	return items, nil
}

// ListSharesForItem lists all recipients of a shared item. Only the owner can list.
func (s *SharingService) ListSharesForItem(ctx context.Context, ownerUserID string, itemID string) ([]domain.VaultShare, error) {
	if strings.TrimSpace(ownerUserID) == "" {
		return nil, domain.ErrUnauthorizedSession
	}

	// Verify ownership
	_, err := s.vaultRepo.GetVaultItemByIDForOwner(ctx, itemID, ownerUserID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return nil, domain.ErrNotItemOwner
		}
		return nil, fmt.Errorf("verify item ownership for list shares: %w", err)
	}

	shares, err := s.shareRepo.ListSharesByItem(ctx, itemID)
	if err != nil {
		return nil, fmt.Errorf("list shares for item: %w", err)
	}
	return shares, nil
}
