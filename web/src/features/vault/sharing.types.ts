/** Types for the sharing API and UI. */

export interface UpsertUserKeysRequest {
  public_key_x25519: string;
  encrypted_private_keys: string;
  nonce: string;
}

export interface UserKeysResponse {
  public_key_x25519: string;
  encrypted_private_keys: string;
  nonce: string;
  has_keys: boolean;
}

export interface UserPublicKeyResponse {
  user_id: string;
  email: string;
  public_key_x25519: string;
}

export interface ShareItemRequest {
  recipient_email: string;
  wrapped_dek: string;
  wrap_nonce: string;
  permissions: string;
}

export interface ShareItemResponse {
  item_id: string;
  recipient_id: string;
  shared_by_user_id: string;
  permissions: string;
  status: string;
}

export interface ShareRecipientResponse {
  user_id: string;
  permissions: string;
  created_at: string;
}

export interface ShareRecipientsResponse {
  shares: ShareRecipientResponse[];
}

export interface SharedItemResponse {
  id: string;
  owner_user_id: string;
  ciphertext: string;
  nonce: string;
  wrapped_dek: string;
  wrap_nonce: string;
  algo_version: string;
  metadata?: unknown;
  created_at: string;
  updated_at: string;
  share_wrapped_dek: string;
  share_wrap_nonce: string;
  shared_by_email: string;
  shared_by_name: string;
  permissions: string;
}

export interface SharedItemsResponse {
  items: SharedItemResponse[];
}
