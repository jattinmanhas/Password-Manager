package dto

import "encoding/json"

type CreateVaultItemRequest struct {
	Ciphertext  string          `json:"ciphertext"`
	Nonce       string          `json:"nonce"`
	WrappedDEK  string          `json:"wrapped_dek"`
	WrapNonce   string          `json:"wrap_nonce"`
	AlgoVersion string          `json:"algo_version"`
	Metadata    json.RawMessage `json:"metadata"`
}

type UpdateVaultItemRequest struct {
	Ciphertext  string          `json:"ciphertext"`
	Nonce       string          `json:"nonce"`
	WrappedDEK  string          `json:"wrapped_dek"`
	WrapNonce   string          `json:"wrap_nonce"`
	AlgoVersion string          `json:"algo_version"`
	Metadata    json.RawMessage `json:"metadata"`
}

type VaultItemResponse struct {
	ID          string          `json:"id"`
	Ciphertext  string          `json:"ciphertext"`
	Nonce       string          `json:"nonce"`
	WrappedDEK  string          `json:"wrapped_dek"`
	WrapNonce   string          `json:"wrap_nonce"`
	AlgoVersion string          `json:"algo_version"`
	Metadata    json.RawMessage `json:"metadata,omitempty"`
	CreatedAt   string          `json:"created_at"`
	UpdatedAt   string          `json:"updated_at"`
}

type VaultItemsResponse struct {
	Items []VaultItemResponse `json:"items"`
}
