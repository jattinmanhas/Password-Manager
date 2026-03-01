export interface VaultItemResponse {
  id: string;
  ciphertext: string;
  nonce: string;
  wrapped_dek: string;
  wrap_nonce: string;
  algo_version: string;
  metadata?: unknown;
  created_at: string;
  updated_at: string;
}

export interface VaultItemsResponse {
  items: VaultItemResponse[];
}

export interface CreateVaultItemRequest {
  ciphertext: string;
  nonce: string;
  wrapped_dek: string;
  wrap_nonce: string;
  algo_version: string;
  metadata?: unknown;
}

export interface UpdateVaultItemRequest extends CreateVaultItemRequest {}
