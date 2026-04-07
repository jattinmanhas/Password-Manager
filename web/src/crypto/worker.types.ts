import type { Argon2idParams, EncryptedVaultItem } from "./index";
import type { VaultItemResponse } from "../features/vault/types";
import type { VaultViewItem } from "../features/vault/vault.types";

export interface CryptoWorkerDeriveKeyRequest {
  type: "derive-key";
  password: string;
  salt?: Uint8Array;
  params?: Partial<Argon2idParams>;
}

export interface CryptoWorkerVerifyVaultKeyRequest {
  type: "verify-vault-key";
  password: string;
  salt: Uint8Array;
  payload: EncryptedVaultItem;
}

export interface CryptoWorkerDecryptVaultItemsRequest {
  type: "decrypt-vault-items";
  items: VaultItemResponse[];
  kek: Uint8Array;
}

export type CryptoWorkerRequestPayload =
  | CryptoWorkerDeriveKeyRequest
  | CryptoWorkerVerifyVaultKeyRequest
  | CryptoWorkerDecryptVaultItemsRequest;

export interface CryptoWorkerDeriveKeyResponse {
  key: Uint8Array;
  salt: Uint8Array;
  params: Argon2idParams;
}

export interface CryptoWorkerVerifyVaultKeyResponse {
  verified: boolean;
  key: Uint8Array | null;
  salt: Uint8Array;
  params: Argon2idParams;
}

export interface CryptoWorkerDecryptVaultItemsResponse {
  items: VaultViewItem[];
}

export type CryptoWorkerResponsePayload =
  | CryptoWorkerDeriveKeyResponse
  | CryptoWorkerVerifyVaultKeyResponse
  | CryptoWorkerDecryptVaultItemsResponse;
