package types

import (
	"time"

	"github.com/google/uuid"
)

// VaultItem represents a password or secure note
type VaultItem struct {
	ID            uuid.UUID  `json:"id" db:"id"`
	UserID        uuid.UUID  `json:"user_id" db:"user_id"`
	Type          string     `json:"type" db:"type"` // password, secureNote, creditCard, identity
	EncryptedData string     `json:"encrypted_data" db:"encrypted_data"`
	// Searchable metadata (encrypted deterministically for search)
	TitleEncrypted    string     `json:"title_encrypted" db:"title_encrypted"`
	TagsEncrypted     string     `json:"tags_encrypted" db:"tags_encrypted"` // Comma-separated encrypted tags
	URLEncrypted      string     `json:"url_encrypted" db:"url_encrypted"`
	UsernameEncrypted string     `json:"username_encrypted" db:"username_encrypted"`
	FolderID          *uuid.UUID `json:"folder_id" db:"folder_id"`
	Favorite          bool       `json:"favorite" db:"favorite"`
	CreatedAt         time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at" db:"updated_at"`
	Version           int        `json:"version" db:"version"`
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

// Request/Response DTOs
type CreateVaultItemRequest struct {
	Type             string     `json:"type" binding:"required"`
	EncryptedData    string     `json:"encrypted_data" binding:"required"`
	TitleEncrypted   string     `json:"title_encrypted"`    // For searchable encryption
	TagsEncrypted    string     `json:"tags_encrypted"`     // For searchable encryption
	URLEncrypted     string     `json:"url_encrypted"`      // For searchable encryption
	UsernameEncrypted string    `json:"username_encrypted"` // For searchable encryption
	FolderID         *uuid.UUID `json:"folder_id"`
	Favorite         bool       `json:"favorite"`
}

type UpdateVaultItemRequest struct {
	EncryptedData     string `json:"encrypted_data" binding:"required"`
	TitleEncrypted    string `json:"title_encrypted"`
	TagsEncrypted     string `json:"tags_encrypted"`
	URLEncrypted      string `json:"url_encrypted"`
	UsernameEncrypted string `json:"username_encrypted"`
	Version           int    `json:"version" binding:"required"`
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

type SearchRequest struct {
	Query            string     `json:"query"`             // Search in title, tags, URL, username
	Type             string     `json:"type"`              // Filter by item type
	FolderID         *uuid.UUID `json:"folder_id"`         // Filter by folder
	Favorite         *bool      `json:"favorite"`          // Filter by favorite
	CreatedAfter     *time.Time `json:"created_after"`     // Filter by creation date
	CreatedBefore    *time.Time `json:"created_before"`    // Filter by creation date
	UpdatedAfter     *time.Time `json:"updated_after"`     // Filter by update date
	UpdatedBefore    *time.Time `json:"updated_before"`    // Filter by update date
	SearchInTitle    bool       `json:"search_in_title"`   // Search in title (default: true)
	SearchInTags     bool       `json:"search_in_tags"`   // Search in tags (default: true)
	SearchInURL      bool       `json:"search_in_url"`     // Search in URL (default: true)
	SearchInUsername bool       `json:"search_in_username"` // Search in username (default: true)
	Limit            int        `json:"limit"`             // Limit results (default: 100)
	Offset           int        `json:"offset"`            // Pagination offset
}

type CreateFolderRequest struct {
	NameEncrypted string     `json:"name_encrypted" binding:"required"`
	ParentID      *uuid.UUID `json:"parent_id"`
}

type UpdateFolderRequest struct {
	NameEncrypted string `json:"name_encrypted" binding:"required"`
}

