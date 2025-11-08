package service

import (
	"errors"

	"github.com/google/uuid"
	"github.com/password-manager/vault-service/internal/types"
)

func (s *VaultService) CreateFolder(userID uuid.UUID, req *types.CreateFolderRequest) (*types.Folder, error) {
	// If parent_id is provided, verify it belongs to the user
	if req.ParentID != nil {
		parent, err := s.folderRepo.GetByID(*req.ParentID, userID)
		if err != nil {
			return nil, err
		}
		if parent == nil {
			return nil, errors.New("parent folder not found")
		}
	}

	folder := &types.Folder{
		ID:            uuid.New(),
		UserID:        userID,
		NameEncrypted: req.NameEncrypted,
		ParentID:      req.ParentID,
	}

	if err := s.folderRepo.Create(folder); err != nil {
		return nil, err
	}

	return folder, nil
}

func (s *VaultService) GetFolder(id, userID uuid.UUID) (*types.Folder, error) {
	folder, err := s.folderRepo.GetByID(id, userID)
	if err != nil {
		return nil, err
	}
	if folder == nil {
		return nil, errors.New("folder not found")
	}
	return folder, nil
}

func (s *VaultService) GetFolders(userID uuid.UUID, parentID *uuid.UUID) ([]*types.Folder, error) {
	return s.folderRepo.GetByUserID(userID, parentID)
}

func (s *VaultService) UpdateFolder(id, userID uuid.UUID, req *types.UpdateFolderRequest) (*types.Folder, error) {
	folder, err := s.folderRepo.GetByID(id, userID)
	if err != nil {
		return nil, err
	}
	if folder == nil {
		return nil, errors.New("folder not found")
	}

	folder.NameEncrypted = req.NameEncrypted

	if err := s.folderRepo.Update(folder); err != nil {
		return nil, err
	}

	return folder, nil
}

func (s *VaultService) DeleteFolder(id, userID uuid.UUID) error {
	return s.folderRepo.Delete(id, userID)
}

