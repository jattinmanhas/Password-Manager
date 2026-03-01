package domain

import (
	"context"
	"time"
)

type VaultItem struct {
	ID          string
	OwnerUserID string
	Ciphertext  []byte
	Nonce       []byte
	WrappedDEK  []byte
	WrapNonce   []byte
	AlgoVersion string
	Metadata    []byte
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

type CreateVaultItemInput struct {
	OwnerUserID string
	Ciphertext  []byte
	Nonce       []byte
	WrappedDEK  []byte
	WrapNonce   []byte
	AlgoVersion string
	Metadata    []byte
}

type UpdateVaultItemInput struct {
	Ciphertext  []byte
	Nonce       []byte
	WrappedDEK  []byte
	WrapNonce   []byte
	AlgoVersion string
	Metadata    []byte
}

type VaultRepository interface {
	CreateVaultItem(ctx context.Context, input CreateVaultItemInput) (VaultItem, error)
	ListVaultItemsByOwner(ctx context.Context, ownerUserID string) ([]VaultItem, error)
	GetVaultItemByIDForOwner(ctx context.Context, itemID string, ownerUserID string) (VaultItem, error)
	UpdateVaultItemForOwner(ctx context.Context, itemID string, ownerUserID string, input UpdateVaultItemInput) (VaultItem, error)
	DeleteVaultItemForOwner(ctx context.Context, itemID string, ownerUserID string) (bool, error)
}
