package types

import (
	"time"

	"github.com/google/uuid"
)

// Share represents a password share
type Share struct {
	ID           uuid.UUID  `json:"id" db:"id"`
	VaultItemID  uuid.UUID  `json:"vault_item_id" db:"vault_item_id"`
	OwnerID      uuid.UUID  `json:"owner_id" db:"owner_id"`
	SharedWithID uuid.UUID  `json:"shared_with_id" db:"shared_with_id"`
	Permission   string     `json:"permission" db:"permission"` // read, write
	EncryptedKey string     `json:"encrypted_key" db:"encrypted_key"`
	CreatedAt    time.Time  `json:"created_at" db:"created_at"`
	ExpiresAt    *time.Time `json:"expires_at" db:"expires_at"`
}

// CreateShareRequest represents a request to create a share
type CreateShareRequest struct {
	VaultItemID  uuid.UUID  `json:"vault_item_id" binding:"required"`
	SharedWithID uuid.UUID  `json:"shared_with_id" binding:"required"`
	Permission   string     `json:"permission" binding:"required,oneof=read write"`
	EncryptedKey string     `json:"encrypted_key" binding:"required"`
	ExpiresAt    *time.Time `json:"expires_at"`
}

// UpdateShareRequest represents a request to update a share
type UpdateShareRequest struct {
	Permission string     `json:"permission" binding:"required,oneof=read write"`
	ExpiresAt  *time.Time `json:"expires_at"`
}

// ShareResponse represents a share response
type ShareResponse struct {
	Share
	VaultItemType string `json:"vault_item_type"`
	OwnerEmail    string `json:"owner_email"`
	SharedWithEmail string `json:"shared_with_email"`
}

// GetSharedItemsResponse represents shared items for a user
type GetSharedItemsResponse struct {
	Items []SharedItem `json:"items"`
	Total int          `json:"total"`
}

// SharedItem represents a shared vault item
type SharedItem struct {
	ShareID       uuid.UUID  `json:"share_id"`
	VaultItemID   uuid.UUID  `json:"vault_item_id"`
	VaultItemType string     `json:"vault_item_type"`
	EncryptedData string     `json:"encrypted_data"`
	Permission    string     `json:"permission"`
	EncryptedKey  string     `json:"encrypted_key"`
	OwnerEmail    string     `json:"owner_email"`
	CreatedAt     time.Time  `json:"created_at"`
	ExpiresAt     *time.Time `json:"expires_at"`
}

