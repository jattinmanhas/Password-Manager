package dto

type UpsertUserKeysRequest struct {
	PublicKeyX25519      string `json:"public_key_x25519"`
	EncryptedPrivateKeys string `json:"encrypted_private_keys"`
	Nonce                string `json:"nonce"`
}

type UserKeysResponse struct {
	PublicKeyX25519      string `json:"public_key_x25519"`
	EncryptedPrivateKeys string `json:"encrypted_private_keys,omitempty"`
	Nonce                string `json:"nonce,omitempty"`
	HasKeys              bool   `json:"has_keys"`
}

type UserPublicKeyResponse struct {
	UserID          string `json:"user_id"`
	Email           string `json:"email"`
	PublicKeyX25519 string `json:"public_key_x25519"`
}

type ShareItemRequest struct {
	RecipientEmail string `json:"recipient_email"`
	WrappedDEK     string `json:"wrapped_dek"`
	WrapNonce      string `json:"wrap_nonce"`
	Permissions    string `json:"permissions"`
}

type ShareItemResponse struct {
	ItemID         string `json:"item_id"`
	RecipientID    string `json:"recipient_id"`
	SharedByUserID string `json:"shared_by_user_id"`
	Permissions    string `json:"permissions"`
	Status         string `json:"status"`
}

type ShareRecipientResponse struct {
	UserID      string `json:"user_id"`
	Permissions string `json:"permissions"`
	CreatedAt   string `json:"created_at"`
}

type ShareRecipientsResponse struct {
	Shares []ShareRecipientResponse `json:"shares"`
}

type SharedItemResponse struct {
	ID          string `json:"id"`
	OwnerUserID string `json:"owner_user_id"`
	Ciphertext  string `json:"ciphertext"`
	Nonce       string `json:"nonce"`
	WrappedDEK  string `json:"wrapped_dek"`
	WrapNonce   string `json:"wrap_nonce"`
	AlgoVersion string `json:"algo_version"`
	Metadata    any    `json:"metadata,omitempty"`
	CreatedAt   string `json:"created_at"`
	UpdatedAt   string `json:"updated_at"`

	// Share-specific fields
	ShareWrappedDEK string `json:"share_wrapped_dek"`
	ShareWrapNonce  string `json:"share_wrap_nonce"`
	SharedByEmail   string `json:"shared_by_email"`
	SharedByName    string `json:"shared_by_name"`
	Permissions     string `json:"permissions"`
}

type SharedItemsResponse struct {
	Items []SharedItemResponse `json:"items"`
}
