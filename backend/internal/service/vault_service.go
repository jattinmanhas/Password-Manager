package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"pmv2/backend/internal/domain"
)

type VaultService struct {
	repo domain.VaultRepository
}

func NewVaultService(repo domain.VaultRepository) *VaultService {
	return &VaultService{repo: repo}
}

func (s *VaultService) CreateItem(ctx context.Context, userID string, input domain.CreateVaultItemInput) (domain.VaultItem, error) {
	ownerUserID := strings.TrimSpace(userID)
	if ownerUserID == "" {
		return domain.VaultItem{}, domain.ErrUnauthorizedSession
	}

	if err := validateVaultPayload(input.Ciphertext, input.Nonce, input.WrappedDEK, input.WrapNonce, input.AlgoVersion, input.Metadata); err != nil {
		return domain.VaultItem{}, err
	}

	input.OwnerUserID = ownerUserID
	item, err := s.repo.CreateVaultItem(ctx, input)
	if err != nil {
		return domain.VaultItem{}, fmt.Errorf("create vault item: %w", err)
	}
	return item, nil
}

func (s *VaultService) ListItems(ctx context.Context, userID string) ([]domain.VaultItem, error) {
	ownerUserID := strings.TrimSpace(userID)
	if ownerUserID == "" {
		return nil, domain.ErrUnauthorizedSession
	}

	items, err := s.repo.ListVaultItemsByOwner(ctx, ownerUserID)
	if err != nil {
		return nil, fmt.Errorf("list vault items: %w", err)
	}
	return items, nil
}

func (s *VaultService) GetItem(ctx context.Context, userID string, itemID string) (domain.VaultItem, error) {
	ownerUserID := strings.TrimSpace(userID)
	trimmedItemID := strings.TrimSpace(itemID)
	if ownerUserID == "" {
		return domain.VaultItem{}, domain.ErrUnauthorizedSession
	}
	if trimmedItemID == "" {
		return domain.VaultItem{}, domain.ErrNotFound
	}

	item, err := s.repo.GetVaultItemByIDForOwner(ctx, trimmedItemID, ownerUserID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return domain.VaultItem{}, domain.ErrNotFound
		}
		return domain.VaultItem{}, fmt.Errorf("get vault item: %w", err)
	}
	return item, nil
}

func (s *VaultService) UpdateItem(ctx context.Context, userID string, itemID string, input domain.UpdateVaultItemInput) (domain.VaultItem, error) {
	ownerUserID := strings.TrimSpace(userID)
	trimmedItemID := strings.TrimSpace(itemID)
	if ownerUserID == "" {
		return domain.VaultItem{}, domain.ErrUnauthorizedSession
	}
	if trimmedItemID == "" {
		return domain.VaultItem{}, domain.ErrNotFound
	}

	if err := validateVaultPayload(input.Ciphertext, input.Nonce, input.WrappedDEK, input.WrapNonce, input.AlgoVersion, input.Metadata); err != nil {
		return domain.VaultItem{}, err
	}

	item, err := s.repo.UpdateVaultItemForOwner(ctx, trimmedItemID, ownerUserID, input)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return domain.VaultItem{}, domain.ErrNotFound
		}
		return domain.VaultItem{}, fmt.Errorf("update vault item: %w", err)
	}
	return item, nil
}

func (s *VaultService) DeleteItem(ctx context.Context, userID string, itemID string) error {
	ownerUserID := strings.TrimSpace(userID)
	trimmedItemID := strings.TrimSpace(itemID)
	if ownerUserID == "" {
		return domain.ErrUnauthorizedSession
	}
	if trimmedItemID == "" {
		return domain.ErrNotFound
	}

	deleted, err := s.repo.DeleteVaultItemForOwner(ctx, trimmedItemID, ownerUserID)
	if err != nil {
		return fmt.Errorf("delete vault item: %w", err)
	}
	if !deleted {
		return domain.ErrNotFound
	}
	return nil
}

func validateVaultPayload(ciphertext []byte, nonce []byte, wrappedDEK []byte, wrapNonce []byte, algoVersion string, metadata []byte) error {
	if len(ciphertext) == 0 || len(nonce) == 0 || len(wrappedDEK) == 0 || len(wrapNonce) == 0 {
		return domain.ErrInvalidVaultPayload
	}
	if strings.TrimSpace(algoVersion) == "" {
		return domain.ErrInvalidVaultPayload
	}
	if len(metadata) > 0 && !json.Valid(metadata) {
		return domain.ErrInvalidVaultPayload
	}
	return nil
}
