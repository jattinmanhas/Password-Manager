/**
 * Pure helper utilities for the vault feature.
 * All functions are stateless and side-effect free.
 */

import { fromBase64, randomBytes, toBase64, utf8ToBytes } from "../../crypto";
import type { VaultItemResponse } from "./types";
import {
  DEFAULT_PERSONAL_VAULT_ID,
  DEFAULT_SECRET,
  type BankSecret,
  type CardSecret,
  type VaultMetadata,
  type VaultSecret,
  type VaultSecretKind,
  type VaultType,
} from "./vault.types";

// ── Constants ────────────────────────────────────────────────────────────────

export const KEK_VERIFIER_KIND = "kek-verifier";
export const KEK_VERIFIER_TOKEN = "pmv2-kek-verifier-v1";
export const KEK_VERIFIER_TOKEN_BYTES = utf8ToBytes(KEK_VERIFIER_TOKEN);
export const MASTER_KEY_SALT_LENGTH = 16;
export const LEGACY_SALT_STORAGE_PREFIX = "pmv2:vault-salt:";

// ── Type guards / normalizers ────────────────────────────────────────────────

export function asObject(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return null;
  }
  return input as Record<string, unknown>;
}

export function normalizeSecret(input: unknown): VaultSecret {
  const value = asObject(input);
  if (!value) return DEFAULT_SECRET;

  const kind = typeof value.kind === "string" ? (value.kind as VaultSecretKind) : "login";
  const title = typeof value.title === "string" ? value.title : "";
  const notes = typeof value.notes === "string" ? value.notes : "";
  const tags = Array.isArray(value.tags) ? (value.tags as string[]) : [];

  const base = { title, notes, tags };

  switch (kind) {
    case "card":
      return {
        ...base,
        kind: "card",
        cardholderName: typeof value.cardholderName === "string" ? value.cardholderName : "",
        cardNumber: typeof value.cardNumber === "string" ? value.cardNumber : "",
        expiryDate: typeof value.expiryDate === "string" ? value.expiryDate : "",
        cardType: (typeof value.cardType === "string" ? value.cardType : "other") as CardSecret["cardType"],
      };
    case "bank":
      return {
        ...base,
        kind: "bank",
        bankName: typeof value.bankName === "string" ? value.bankName : "",
        accountNumber: typeof value.accountNumber === "string" ? value.accountNumber : "",
        ifscCode: typeof value.ifscCode === "string" ? value.ifscCode : "",
        accountType: (typeof value.accountType === "string" ? value.accountType : "other") as BankSecret["accountType"],
      };
    case "note":
      return {
        ...base,
        kind: "note",
      };
    case "login":
    default:
      return {
        ...base,
        kind: "login",
        username: typeof value.username === "string" ? value.username : "",
        password: typeof value.password === "string" ? value.password : "",
      };
  }
}

export function normalizeVaultType(input: unknown): VaultType {
  return input === "shared" ? "shared" : "personal";
}

export function parseVaultMetadata(metadata: unknown): VaultMetadata {
  const value = asObject(metadata);
  if (!value) return {};
  return {
    kind: typeof value.kind === "string" ? value.kind : undefined,
    vault_id: typeof value.vault_id === "string" ? value.vault_id : undefined,
    vault_name: typeof value.vault_name === "string" ? value.vault_name : undefined,
    vault_type: normalizeVaultType(value.vault_type),
    salt: typeof value.salt === "string" ? value.salt : undefined,
  };
}

export function getVaultReference(
  metadata: unknown,
): { vaultId: string; vaultName: string; vaultType: VaultType } {
  const parsed = parseVaultMetadata(metadata);
  return {
    vaultId: parsed.vault_id ?? DEFAULT_PERSONAL_VAULT_ID,
    vaultName: parsed.vault_name ?? "Personal Vault",
    vaultType: parsed.vault_type ?? "personal",
  };
}

export function getVerifierSalt(item: VaultItemResponse): Uint8Array | null {
  const metadata = parseVaultMetadata(item.metadata);
  if (metadata.kind !== KEK_VERIFIER_KIND || !metadata.salt) return null;
  try {
    const decoded = fromBase64(metadata.salt);
    return decoded.length >= 16 ? decoded : null;
  } catch {
    return null;
  }
}

export function isVerifierItem(item: VaultItemResponse): boolean {
  return parseVaultMetadata(item.metadata).kind === KEK_VERIFIER_KIND;
}

// ── ID / member helpers ──────────────────────────────────────────────────────

export function buildVaultId(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  const entropy = toBase64(randomBytes(6))
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 8)
    .toLowerCase();
  return `vault-${slug || "new"}-${entropy}`;
}

export function normalizeMemberList(raw: string): string[] {
  return raw
    .split(",")
    .map((e) => e.trim())
    .filter((e) => e.length > 0)
    .slice(0, 8);
}

// ── Crypto helpers ───────────────────────────────────────────────────────────

export function constantTimeEquals(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) {
    diff |= left[i] ^ right[i];
  }
  return diff === 0;
}

export function wipeKeyMaterial(key: Uint8Array | null | undefined): void {
  if (key) key.fill(0);
}
