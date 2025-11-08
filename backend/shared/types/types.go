package types

import (
	"time"

	"github.com/google/uuid"
)

// User represents a user in the system
type User struct {
	ID                    uuid.UUID `json:"id" db:"id"`
	Email                 string    `json:"email" db:"email"`
	MasterPasswordHash    string    `json:"-" db:"master_password_hash"`
	EncryptionKeyEncrypted string   `json:"-" db:"encryption_key_encrypted"`
	Salt                  string    `json:"-" db:"salt"`
	TwoFactorEnabled      bool      `json:"two_factor_enabled" db:"two_factor_enabled"`
	TwoFactorSecretEncrypted string `json:"-" db:"two_factor_secret_encrypted"`
	BackupCodesEncrypted  string    `json:"-" db:"backup_codes_encrypted"`
	CreatedAt             time.Time `json:"created_at" db:"created_at"`
	LastLogin             *time.Time `json:"last_login" db:"last_login"`
	AccountStatus         string    `json:"account_status" db:"account_status"`
}

// VaultItem represents a password or secure note
type VaultItem struct {
	ID            uuid.UUID  `json:"id" db:"id"`
	UserID        uuid.UUID  `json:"user_id" db:"user_id"`
	Type          string     `json:"type" db:"type"` // password, secureNote, creditCard, identity
	EncryptedData string     `json:"encrypted_data" db:"encrypted_data"`
	FolderID      *uuid.UUID `json:"folder_id" db:"folder_id"`
	Favorite      bool       `json:"favorite" db:"favorite"`
	CreatedAt     time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at" db:"updated_at"`
	Version       int        `json:"version" db:"version"`
}

// Folder represents a folder for organizing vault items
type Folder struct {
	ID            uuid.UUID  `json:"id" db:"id"`
	UserID        uuid.UUID  `json:"user_id" db:"user_id"`
	NameEncrypted string     `json:"name_encrypted" db:"name_encrypted"`
	ParentID      *uuid.UUID `json:"parent_id" db:"parent_id"`
	CreatedAt     time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at" db:"updated_at"`
}

// Device represents a user device
type Device struct {
	ID         uuid.UUID  `json:"id" db:"id"`
	UserID     uuid.UUID  `json:"user_id" db:"user_id"`
	DeviceName string     `json:"device_name" db:"device_name"`
	DeviceType string     `json:"device_type" db:"device_type"` // web, mobile, desktop
	LastSyncAt *time.Time `json:"last_sync_at" db:"last_sync_at"`
	IPAddress  string     `json:"ip_address" db:"ip_address"`
	UserAgent  string     `json:"user_agent" db:"user_agent"`
	CreatedAt  time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at" db:"updated_at"`
}

// Share represents a shared vault item
type Share struct {
	ID            uuid.UUID  `json:"id" db:"id"`
	VaultItemID   uuid.UUID  `json:"vault_item_id" db:"vault_item_id"`
	OwnerID       uuid.UUID  `json:"owner_id" db:"owner_id"`
	SharedWithID  uuid.UUID  `json:"shared_with_id" db:"shared_with_id"`
	Permission    string     `json:"permission" db:"permission"` // read, write
	EncryptedKey  string     `json:"encrypted_key" db:"encrypted_key"`
	CreatedAt     time.Time  `json:"created_at" db:"created_at"`
	ExpiresAt     *time.Time `json:"expires_at" db:"expires_at"`
}

// API Response types
type APIResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   *APIError   `json:"error,omitempty"`
	Message string     `json:"message,omitempty"`
}

type APIError struct {
	Code    string      `json:"code"`
	Message string      `json:"message"`
	Details interface{} `json:"details,omitempty"`
}

// Request/Response DTOs
type RegisterRequest struct {
	Email             string `json:"email" binding:"required,email"`
	MasterPassword    string `json:"master_password" binding:"required,min=8"`
	EncryptionKeyProof string `json:"encryption_key_proof" binding:"required"`
}

type LoginRequest struct {
	Email            string `json:"email" binding:"required,email"`
	MasterPasswordProof string `json:"master_password_proof" binding:"required"`
}

type LoginResponse struct {
	UserID      uuid.UUID `json:"user_id"`
	AccessToken string    `json:"access_token"`
	RefreshToken string   `json:"refresh_token"`
	ExpiresIn   int       `json:"expires_in"`
}

type CreateVaultItemRequest struct {
	Type          string     `json:"type" binding:"required"`
	EncryptedData string     `json:"encrypted_data" binding:"required"`
	FolderID      *uuid.UUID `json:"folder_id"`
	Favorite      bool       `json:"favorite"`
}

type UpdateVaultItemRequest struct {
	EncryptedData string `json:"encrypted_data" binding:"required"`
	Version       int    `json:"version" binding:"required"`
}

type GeneratePasswordRequest struct {
	Length          int  `json:"length"`
	IncludeUppercase bool `json:"include_uppercase"`
	IncludeLowercase bool `json:"include_lowercase"`
	IncludeNumbers   bool `json:"include_numbers"`
	IncludeSymbols   bool `json:"include_symbols"`
}

type GeneratePasswordResponse struct {
	Password string `json:"password"`
	Strength int    `json:"strength"`
}

