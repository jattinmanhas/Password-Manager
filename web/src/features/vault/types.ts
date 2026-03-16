export interface VaultItemResponse {
  id: string;
  folder_id?: string;
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
  folder_id?: string;
  ciphertext: string;
  nonce: string;
  wrapped_dek: string;
  wrap_nonce: string;
  algo_version: string;
  metadata?: unknown;
}

export interface UpdateVaultItemRequest extends CreateVaultItemRequest {}

export interface VaultSaltResponse {
  salt: string;
}

export interface FolderResponse {
  id: string;
  name_ciphertext: string;
  nonce: string;
  created_at: string;
  updated_at: string;
}

export interface FoldersResponse {
  folders: FolderResponse[];
}

export interface CreateFolderRequest {
  name_ciphertext: string;
  nonce: string;
}
