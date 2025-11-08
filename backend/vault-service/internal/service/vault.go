package service

import (
	"database/sql"
	"errors"

	"github.com/google/uuid"
	"github.com/password-manager/vault-service/internal/config"
	"github.com/password-manager/vault-service/internal/repository"
	"github.com/password-manager/vault-service/internal/types"
	"github.com/password-manager/vault-service/internal/utils"
)

type VaultService struct {
	vaultRepo  *repository.VaultRepository
	folderRepo *repository.FolderRepository
	config     *config.Config
}

func NewVaultService(vaultRepo *repository.VaultRepository, folderRepo *repository.FolderRepository, cfg *config.Config) *VaultService {
	return &VaultService{
		vaultRepo:  vaultRepo,
		folderRepo: folderRepo,
		config:     cfg,
	}
}

func (s *VaultService) CreateItem(userID uuid.UUID, req *types.CreateVaultItemRequest) (*types.VaultItem, error) {
	// Validate item type
	if req.Type != "password" && req.Type != "secureNote" && req.Type != "creditCard" && req.Type != "identity" {
		return nil, errors.New("invalid item type")
	}

	// If folder_id is provided, verify it belongs to the user
	if req.FolderID != nil {
		folder, err := s.folderRepo.GetByID(*req.FolderID, userID)
		if err != nil {
			return nil, err
		}
		if folder == nil {
			return nil, errors.New("folder not found")
		}
	}

	item := &types.VaultItem{
		ID:               uuid.New(),
		UserID:           userID,
		Type:             req.Type,
		EncryptedData:    req.EncryptedData,
		TitleEncrypted:   req.TitleEncrypted,
		TagsEncrypted:    req.TagsEncrypted,
		URLEncrypted:     req.URLEncrypted,
		UsernameEncrypted: req.UsernameEncrypted,
		FolderID:         req.FolderID,
		Favorite:         req.Favorite,
	}

	if err := s.vaultRepo.Create(item); err != nil {
		return nil, err
	}

	return item, nil
}

func (s *VaultService) GetItem(id, userID uuid.UUID) (*types.VaultItem, error) {
	item, err := s.vaultRepo.GetByID(id, userID)
	if err != nil {
		return nil, err
	}
	if item == nil {
		return nil, errors.New("item not found")
	}
	return item, nil
}

func (s *VaultService) GetItems(userID uuid.UUID, folderID *uuid.UUID, itemType string) ([]*types.VaultItem, error) {
	return s.vaultRepo.GetByUserID(userID, folderID, itemType)
}

func (s *VaultService) UpdateItem(id, userID uuid.UUID, req *types.UpdateVaultItemRequest) (*types.VaultItem, error) {
	// Get existing item
	item, err := s.vaultRepo.GetByID(id, userID)
	if err != nil {
		return nil, err
	}
	if item == nil {
		return nil, errors.New("item not found")
	}

	// Check version for optimistic locking
	if item.Version != req.Version {
		return nil, errors.New("version conflict: item was modified by another request")
	}

	// Update item
	item.EncryptedData = req.EncryptedData
	item.TitleEncrypted = req.TitleEncrypted
	item.TagsEncrypted = req.TagsEncrypted
	item.URLEncrypted = req.URLEncrypted
	item.UsernameEncrypted = req.UsernameEncrypted
	item.Version = req.Version

	if err := s.vaultRepo.Update(item); err != nil {
		if err == sql.ErrNoRows {
			return nil, errors.New("version conflict: item was modified by another request")
		}
		return nil, err
	}

	return item, nil
}

func (s *VaultService) DeleteItem(id, userID uuid.UUID) error {
	return s.vaultRepo.Delete(id, userID)
}

func (s *VaultService) SearchItems(userID uuid.UUID, req *types.SearchRequest, searchKey []byte) ([]*types.VaultItem, error) {
	// Prepare search hashes for encrypted metadata search
	var searchHashes []string
	if req.Query != "" {
		// Generate search hashes for the query (client should send encrypted search terms)
		// For now, we'll use the query as-is if it's already encrypted, or generate hash
		// In production, client should encrypt search terms with deterministic encryption
		searchHashes = []string{req.Query}
	}

	// Set defaults for search flags
	if !req.SearchInTitle && !req.SearchInTags && !req.SearchInURL && !req.SearchInUsername {
		// Default: search in all fields
		req.SearchInTitle = true
		req.SearchInTags = true
		req.SearchInURL = true
		req.SearchInUsername = true
	}

	// Set default limit
	if req.Limit <= 0 {
		req.Limit = 100
	}

	return s.vaultRepo.Search(userID, req, searchHashes)
}

func (s *VaultService) GeneratePassword(req *types.GeneratePasswordRequest) (*types.GeneratePasswordResponse, error) {
	length := req.Length
	if length < 8 {
		length = 20
	}
	if length > 128 {
		length = 128
	}

	includeUppercase := req.IncludeUppercase
	includeLowercase := req.IncludeLowercase
	includeNumbers := req.IncludeNumbers
	includeSymbols := req.IncludeSymbols

	// If no character set is specified, use all
	if !includeUppercase && !includeLowercase && !includeNumbers && !includeSymbols {
		includeUppercase = true
		includeLowercase = true
		includeNumbers = true
		includeSymbols = true
	}

	password, err := utils.GeneratePassword(length, includeUppercase, includeLowercase, includeNumbers, includeSymbols)
	if err != nil {
		return nil, err
	}

	strength := utils.CalculatePasswordStrength(password)

	return &types.GeneratePasswordResponse{
		Password: password,
		Strength: strength,
	}, nil
}

