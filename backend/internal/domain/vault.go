package domain

import (
	"context"
	"time"
)

type VaultItem struct {
	ID          string
	OwnerUserID string
	FolderID    *string
	Ciphertext  []byte
	Nonce       []byte
	WrappedDEK  []byte
	WrapNonce   []byte
	AlgoVersion string
	Metadata    []byte
	IsShared    bool
	Version     int
	CreatedAt   time.Time
	UpdatedAt   time.Time
	DeletedAt   *time.Time
}

type VaultItemVersion struct {
	ID          string
	ItemID      string
	OwnerUserID string
	FolderID    *string
	Ciphertext  []byte
	Nonce       []byte
	WrappedDEK  []byte
	WrapNonce   []byte
	AlgoVersion string
	Metadata    []byte
	Version     int
	CreatedAt   time.Time
}

type CreateVaultItemInput struct {
	OwnerUserID string
	FolderID    *string
	Ciphertext  []byte
	Nonce       []byte
	WrappedDEK  []byte
	WrapNonce   []byte
	AlgoVersion string
	Metadata    []byte
}

type UpdateVaultItemInput struct {
	FolderID    *string
	Ciphertext  []byte
	Nonce       []byte
	WrappedDEK  []byte
	WrapNonce   []byte
	AlgoVersion string
	Metadata    []byte
}

type VaultFolder struct {
	ID             string
	OwnerUserID    string
	NameCiphertext []byte
	Nonce          []byte
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

type CreateVaultFolderInput struct {
	OwnerUserID    string
	NameCiphertext []byte
	Nonce          []byte
}

type VaultRepository interface {
	CreateVaultItem(ctx context.Context, input CreateVaultItemInput) (VaultItem, error)
	CreateVaultItemsBulk(ctx context.Context, inputs []CreateVaultItemInput) ([]VaultItem, error)
	ListVaultItemsByOwner(ctx context.Context, ownerUserID string) ([]VaultItem, error)
	ListDeletedVaultItemsByOwner(ctx context.Context, ownerUserID string) ([]VaultItem, error)
	GetVaultItemByIDForOwner(ctx context.Context, itemID string, ownerUserID string) (VaultItem, error)
	ListVaultItemVersionsByOwner(ctx context.Context, itemID string, ownerUserID string) ([]VaultItemVersion, error)
	UpdateVaultItemForOwner(ctx context.Context, itemID string, ownerUserID string, input UpdateVaultItemInput) (VaultItem, error)
	DeleteVaultItemForOwner(ctx context.Context, itemID string, ownerUserID string) (bool, error)
	RestoreVaultItemForOwner(ctx context.Context, itemID string, ownerUserID string) (VaultItem, error)
	GetVaultSaltForUser(ctx context.Context, userID string) ([]byte, error)
}

type FolderRepository interface {
	CreateFolder(ctx context.Context, input CreateVaultFolderInput) (VaultFolder, error)
	ListFoldersByOwner(ctx context.Context, ownerUserID string) ([]VaultFolder, error)
	GetFolderByIDForOwner(ctx context.Context, folderID string, ownerUserID string) (VaultFolder, error)
	UpdateFolderForOwner(ctx context.Context, folderID string, ownerUserID string, nameCiphertext []byte, nonce []byte) (VaultFolder, error)
	DeleteFolderForOwner(ctx context.Context, folderID string, ownerUserID string) (bool, error)
}
