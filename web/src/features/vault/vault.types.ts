/** All domain-level types for the vault feature (UI layer). */

export type VaultType = "personal" | "shared";
export type VaultFilter = "all" | VaultType;

export interface VaultSecret {
  title: string;
  username: string;
  password: string;
  notes: string;
}

export interface VaultViewItem {
  id: string;
  updatedAt: string;
  secret: VaultSecret | null;
  isCorrupted: boolean;
  vaultId: string;
  vaultName: string;
  vaultType: VaultType;
}

export interface VaultDirectoryEntry {
  id: string;
  name: string;
  type: VaultType;
  members: string[];
  updatedAt: string;
  isSystem: boolean;
}

export interface VaultCardModel extends VaultDirectoryEntry {
  itemCount: number;
}

export interface VaultMetadata {
  kind?: string;
  vault_id?: string;
  vault_name?: string;
  vault_type?: VaultType;
  salt?: string;
}

export const DEFAULT_SECRET: VaultSecret = {
  title: "",
  username: "",
  password: "",
  notes: "",
};

export const DEFAULT_PERSONAL_VAULT_ID = "personal-main";
export const DEFAULT_SHARED_VAULT_ID = "shared-family";
