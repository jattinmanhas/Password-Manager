package domain

import (
	"context"
	"errors"
	"time"
)

var (
	ErrAlreadyShared          = errors.New("item already shared with this user")
	ErrCannotShareWithSelf    = errors.New("cannot share an item with yourself")
	ErrRecipientKeysNotFound  = errors.New("recipient has not set up encryption keys")
	ErrShareNotFound          = errors.New("share not found")
	ErrNotItemOwner           = errors.New("only the item owner can perform this action")
)

// UserKeys holds asymmetric key material for a user.
type UserKeys struct {
	UserID               string
	PublicKeyX25519      []byte
	PublicKeyEd25519     []byte
	EncryptedPrivateKeys []byte
	Nonce                []byte
	CreatedAt            time.Time
	UpdatedAt            time.Time
}

type UpsertUserKeysInput struct {
	UserID               string
	PublicKeyX25519      []byte
	EncryptedPrivateKeys []byte
	Nonce                []byte
}

// VaultShare represents a single item share record.
type VaultShare struct {
	ItemID         string
	UserID         string
	SharedByUserID string
	DEKWrapped     []byte
	WrapNonce      []byte
	Permissions    string
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

type ShareItemInput struct {
	ItemID         string
	RecipientID    string
	SharedByUserID string
	DEKWrapped     []byte
	WrapNonce      []byte
	Permissions    string
}

// SharedVaultItem is a vault item plus its share metadata.
type SharedVaultItem struct {
	VaultItem
	SharedByUserID string
	SharedByEmail  string
	SharedByName   string
	Permissions    string
	ShareDEK       []byte
	ShareWrapNonce []byte
}

type UserKeysRepository interface {
	UpsertKeys(ctx context.Context, input UpsertUserKeysInput) error
	GetKeysByUserID(ctx context.Context, userID string) (UserKeys, error)
	GetPublicKeyByEmail(ctx context.Context, email string) (UserKeys, string, error) // returns keys + userID
}

type SharingRepository interface {
	CreateShare(ctx context.Context, input ShareItemInput) error
	DeleteShare(ctx context.Context, itemID string, recipientUserID string) error
	ListSharesByRecipient(ctx context.Context, userID string) ([]SharedVaultItem, error)
	ListSharesByItem(ctx context.Context, itemID string) ([]VaultShare, error)
	GetShare(ctx context.Context, itemID string, userID string) (VaultShare, error)
}
