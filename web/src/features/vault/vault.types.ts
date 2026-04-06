/** All domain-level types for the vault feature (UI layer). */

export type VaultType = "personal" | "shared";
export type VaultFilter = "all" | VaultType;

export type VaultSecretKind = "login" | "card" | "bank" | "note";

export interface LoginFields {
  username: string;
  password: string;
}

export interface CardFields {
  cardholderName: string;
  cardNumber: string;
  expiryDate: string;
  cardType: "visa" | "mastercard" | "amex" | "other";
}

export interface BankFields {
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  accountType: "checking" | "savings" | "current" | "other";
}

export interface BaseSecret {
  kind: VaultSecretKind;
  title: string;
  notes: string;
  tags?: string[];
}

export type LoginSecret = BaseSecret & { kind: "login" } & LoginFields;
export type CardSecret = BaseSecret & { kind: "card" } & CardFields;
export type BankSecret = BaseSecret & { kind: "bank" } & BankFields;
export type NoteSecret = BaseSecret & { kind: "note" };

export type VaultSecret = LoginSecret | CardSecret | BankSecret | NoteSecret;

export interface VaultViewItem {
  id: string;
  folderId?: string;
  updatedAt: string;
  createdAt?: string;
  deletedAt?: string;
  version?: number;
  secret: VaultSecret | null;
  isCorrupted: boolean;
  vaultId: string;
  vaultName: string;
  vaultType: VaultType;
  isShared?: boolean;
}

export interface VaultFolder {
  id: string;
  name: string;
  updatedAt: string;
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
  kind?: VaultSecretKind | string;
  vault_id?: string;
  vault_name?: string;
  vault_type?: VaultType;
  salt?: string;
}

export const DEFAULT_SECRET: VaultSecret = {
  kind: "login",
  title: "",
  username: "",
  password: "",
  notes: "",
};

export const DEFAULT_PERSONAL_VAULT_ID = "personal-main";
export const DEFAULT_SHARED_VAULT_ID = "shared-family";
export const TRASH_VAULT_ID = "system-trash";
