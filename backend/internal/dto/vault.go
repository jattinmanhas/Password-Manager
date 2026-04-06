package dto

import "encoding/json"

type CreateVaultItemRequest struct {
	FolderID    *string         `json:"folder_id"`
	Ciphertext  string          `json:"ciphertext"`
	Nonce       string          `json:"nonce"`
	WrappedDEK  string          `json:"wrapped_dek"`
	WrapNonce   string          `json:"wrap_nonce"`
	AlgoVersion string          `json:"algo_version"`
	Metadata    json.RawMessage `json:"metadata"`
}

type UpdateVaultItemRequest struct {
	FolderID    *string         `json:"folder_id"`
	Ciphertext  string          `json:"ciphertext"`
	Nonce       string          `json:"nonce"`
	WrappedDEK  string          `json:"wrapped_dek"`
	WrapNonce   string          `json:"wrap_nonce"`
	AlgoVersion string          `json:"algo_version"`
	Metadata    json.RawMessage `json:"metadata"`
}

type VaultItemResponse struct {
	ID          string          `json:"id"`
	FolderID    *string         `json:"folder_id,omitempty"`
	Ciphertext  string          `json:"ciphertext"`
	Nonce       string          `json:"nonce"`
	WrappedDEK  string          `json:"wrapped_dek"`
	WrapNonce   string          `json:"wrap_nonce"`
	AlgoVersion string          `json:"algo_version"`
	Metadata    json.RawMessage `json:"metadata,omitempty"`
	IsShared    bool            `json:"is_shared"`
	Version     int             `json:"version"`
	CreatedAt   string          `json:"created_at"`
	UpdatedAt   string          `json:"updated_at"`
	DeletedAt   *string         `json:"deleted_at,omitempty"`
}

type VaultItemsResponse struct {
	Items []VaultItemResponse `json:"items"`
}

type VaultItemVersionResponse struct {
	ID          string          `json:"id"`
	ItemID      string          `json:"item_id"`
	FolderID    *string         `json:"folder_id,omitempty"`
	Ciphertext  string          `json:"ciphertext"`
	Nonce       string          `json:"nonce"`
	WrappedDEK  string          `json:"wrapped_dek"`
	WrapNonce   string          `json:"wrap_nonce"`
	AlgoVersion string          `json:"algo_version"`
	Metadata    json.RawMessage `json:"metadata,omitempty"`
	Version     int             `json:"version"`
	CreatedAt   string          `json:"created_at"`
}

type VaultItemVersionsResponse struct {
	Versions []VaultItemVersionResponse `json:"versions"`
}

type CreateFolderRequest struct {
	NameCiphertext string `json:"name_ciphertext"`
	Nonce          string `json:"nonce"`
}

type FolderResponse struct {
	ID             string `json:"id"`
	NameCiphertext string `json:"name_ciphertext"`
	Nonce          string `json:"nonce"`
	CreatedAt      string `json:"created_at"`
	UpdatedAt      string `json:"updated_at"`
}

type FoldersResponse struct {
	Folders []FolderResponse `json:"folders"`
}

type VaultSaltResponse struct {
	Salt string `json:"salt"`
}
