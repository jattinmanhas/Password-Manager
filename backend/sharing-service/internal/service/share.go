package service

import (
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/password-manager/sharing-service/internal/repository"
	"github.com/password-manager/sharing-service/internal/types"
)

type ShareService struct {
	shareRepo *repository.ShareRepository
}

func NewShareService(shareRepo *repository.ShareRepository) *ShareService {
	return &ShareService{
		shareRepo: shareRepo,
	}
}

func (s *ShareService) CreateShare(ownerID uuid.UUID, req *types.CreateShareRequest) (*types.Share, error) {
	// Validate permission
	if req.Permission != "read" && req.Permission != "write" {
		return nil, errors.New("invalid permission: must be 'read' or 'write'")
	}

	// Prevent self-sharing
	if ownerID == req.SharedWithID {
		return nil, errors.New("cannot share with yourself")
	}

	// Note: User existence validation should be done by the client
	// or by calling auth-service. For now, we trust the shared_with_id

	// Check if share already exists
	exists, err := s.shareRepo.CheckShareExists(req.VaultItemID, ownerID, req.SharedWithID)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, errors.New("share already exists for this user and item")
	}

	// Validate expiration date
	if req.ExpiresAt != nil && req.ExpiresAt.Before(time.Now()) {
		return nil, errors.New("expiration date must be in the future")
	}

	share := &types.Share{
		ID:           uuid.New(),
		VaultItemID:  req.VaultItemID,
		OwnerID:      ownerID,
		SharedWithID: req.SharedWithID,
		Permission:   req.Permission,
		EncryptedKey: req.EncryptedKey,
		ExpiresAt:    req.ExpiresAt,
	}

	if err := s.shareRepo.Create(share); err != nil {
		return nil, err
	}

	return share, nil
}

func (s *ShareService) GetShare(id, userID uuid.UUID) (*types.Share, error) {
	share, err := s.shareRepo.GetByID(id, userID)
	if err != nil {
		return nil, err
	}
	if share == nil {
		return nil, errors.New("share not found")
	}

	// Check if expired
	if share.ExpiresAt != nil && share.ExpiresAt.Before(time.Now()) {
		return nil, errors.New("share has expired")
	}

	return share, nil
}

func (s *ShareService) GetSharesByOwner(ownerID uuid.UUID) ([]*types.Share, error) {
	return s.shareRepo.GetByOwnerID(ownerID)
}

func (s *ShareService) GetSharesBySharedWith(sharedWithID uuid.UUID) ([]*types.Share, error) {
	return s.shareRepo.GetBySharedWithID(sharedWithID)
}

func (s *ShareService) GetSharesByVaultItem(vaultItemID, ownerID uuid.UUID) ([]*types.Share, error) {
	return s.shareRepo.GetByVaultItemID(vaultItemID, ownerID)
}

func (s *ShareService) GetSharedItemsForUser(userID uuid.UUID) (*types.GetSharedItemsResponse, error) {
	itemsPtr, err := s.shareRepo.GetSharedItemsForUser(userID)
	if err != nil {
		return nil, err
	}

	// Convert []*SharedItem to []SharedItem
	items := make([]types.SharedItem, len(itemsPtr))
	for i, item := range itemsPtr {
		items[i] = *item
	}

	return &types.GetSharedItemsResponse{
		Items: items,
		Total: len(items),
	}, nil
}

func (s *ShareService) UpdateShare(id, ownerID uuid.UUID, req *types.UpdateShareRequest) (*types.Share, error) {
	// Get existing share
	share, err := s.shareRepo.GetByID(id, ownerID)
	if err != nil {
		return nil, err
	}
	if share == nil {
		return nil, errors.New("share not found")
	}

	// Verify ownership
	if share.OwnerID != ownerID {
		return nil, errors.New("not authorized to update this share")
	}

	// Validate permission
	if req.Permission != "read" && req.Permission != "write" {
		return nil, errors.New("invalid permission: must be 'read' or 'write'")
	}

	// Validate expiration date
	if req.ExpiresAt != nil && req.ExpiresAt.Before(time.Now()) {
		return nil, errors.New("expiration date must be in the future")
	}

	// Update share
	share.Permission = req.Permission
	share.ExpiresAt = req.ExpiresAt

	if err := s.shareRepo.Update(share); err != nil {
		return nil, err
	}

	return share, nil
}

func (s *ShareService) DeleteShare(id, ownerID uuid.UUID) error {
	// Verify ownership
	share, err := s.shareRepo.GetByID(id, ownerID)
	if err != nil {
		return err
	}
	if share == nil {
		return errors.New("share not found")
	}

	if share.OwnerID != ownerID {
		return errors.New("not authorized to delete this share")
	}

	return s.shareRepo.Delete(id, ownerID)
}

func (s *ShareService) RevokeShare(id, ownerID uuid.UUID) error {
	// Same as delete, but semantically different
	return s.DeleteShare(id, ownerID)
}

