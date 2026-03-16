package service

import (
	"context"

	"pmv2/backend/internal/domain"
)

type FolderService struct {
	repo domain.FolderRepository
}

func NewFolderService(repo domain.FolderRepository) *FolderService {
	return &FolderService{repo: repo}
}

func (s *FolderService) CreateFolder(ctx context.Context, input domain.CreateVaultFolderInput) (domain.VaultFolder, error) {
	return s.repo.CreateFolder(ctx, input)
}

func (s *FolderService) ListFolders(ctx context.Context, ownerUserID string) ([]domain.VaultFolder, error) {
	return s.repo.ListFoldersByOwner(ctx, ownerUserID)
}

func (s *FolderService) GetFolder(ctx context.Context, ownerUserID string, folderID string) (domain.VaultFolder, error) {
	return s.repo.GetFolderByIDForOwner(ctx, folderID, ownerUserID)
}

func (s *FolderService) UpdateFolder(ctx context.Context, ownerUserID string, folderID string, nameCiphertext []byte, nonce []byte) (domain.VaultFolder, error) {
	return s.repo.UpdateFolderForOwner(ctx, folderID, ownerUserID, nameCiphertext, nonce)
}

func (s *FolderService) DeleteFolder(ctx context.Context, ownerUserID string, folderID string) error {
	deleted, err := s.repo.DeleteFolderForOwner(ctx, folderID, ownerUserID)
	if err != nil {
		return err
	}
	if !deleted {
		return domain.ErrNotFound
	}
	return nil
}
