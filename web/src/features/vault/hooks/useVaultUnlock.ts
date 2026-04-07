/**
 * useVaultUnlock — manages unlock/setup flow, KEK verification,
 * key bootstrapping, and the verifier item lifecycle.
 */

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

import { useAuth } from "../../../app/providers/AuthProvider";
import { useVaultSession } from "../../../app/providers/VaultProvider";
import {
  decryptVaultItem,
  encryptVaultItem,
  fromBase64,
  toBase64,
} from "../../../crypto";
import type { XChaCha20Poly1305Aead } from "../../../crypto";
import {
  deriveMasterKeyWithWorker,
  verifyVaultKeyWithWorker,
} from "../../../crypto/worker-client";
import {
  generateX25519KeyPair,
  encryptPrivateKey,
  decryptPrivateKey,
} from "../../../crypto/sharing";
import { vaultService } from "../services/vault.service";
import { sharingService } from "../services/sharing.service";
import type { VaultItemResponse } from "../types";
import type { VaultViewItem, VaultFolder } from "../vault.types";
import {
  constantTimeEquals,
  getVerifierSalt,
  isVerifierItem,
  KEK_VERIFIER_KIND,
  KEK_VERIFIER_TOKEN,
  KEK_VERIFIER_TOKEN_BYTES,
  wipeKeyMaterial,
} from "../vault.utils";

import type { VaultUnlockFormData } from "../../../lib/validations/vault";

export type UnlockMode = "checking" | "setup" | "unlock";

interface UseVaultUnlockOptions {
  /**
   * Callback invoked after a successful unlock to load items.
   * Receives the derived kek, aead cipher, and optionally the pre-fetched items list.
   */
  onUnlocked: (
    kek: Uint8Array,
    aead: XChaCha20Poly1305Aead,
    prefetchedItems?: VaultItemResponse[],
  ) => Promise<void>;
}

export function useVaultUnlock({ onUnlocked }: UseVaultUnlockOptions) {
  const { session } = useAuth();
  const {
    aead,
    kek,
    isKekVerified,
    verifierItem,
    setVaultSession,
    setUserKeyPair,
    lockVault: contextLockVault,
  } = useVaultSession();

  const [unlocking, setUnlocking] = useState(false);
  const [unlockMode, setUnlockMode] = useState<UnlockMode>("checking");
  const [error, setError] = useState("");

  // ── Helpers ──────────────────────────────────────────────────────────────

  const lockVault = useCallback(
    (clearError = true) => {
      contextLockVault();
      if (clearError) setError("");
    },
    [contextLockVault],
  );

  const verifyKek = useCallback(
    (item: VaultItemResponse, key: Uint8Array, cipher: XChaCha20Poly1305Aead): boolean => {
      try {
        const token = decryptVaultItem({
          payload: {
            version: "xchacha20poly1305-v1",
            nonce: item.nonce,
            ciphertext: item.ciphertext,
            wrappedDek: item.wrapped_dek,
            wrapNonce: item.wrap_nonce,
          },
          kek: key,
          aead: cipher,
        });
        return constantTimeEquals(new TextEncoder().encode(token), KEK_VERIFIER_TOKEN_BYTES);
      } catch {
        return false;
      }
    },
    [],
  );

  const upsertVerifierItem = useCallback(
    async (
      key: Uint8Array,
      salt: Uint8Array,
      cipher: XChaCha20Poly1305Aead,
      existing: VaultItemResponse | null,
    ) => {
      const payload = encryptVaultItem({ plaintext: KEK_VERIFIER_TOKEN, kek: key, aead: cipher });
      const request = {
        ciphertext: payload.ciphertext,
        nonce: payload.nonce,
        wrapped_dek: payload.wrappedDek,
        wrap_nonce: payload.wrapNonce,
        algo_version: payload.version,
        metadata: { kind: KEK_VERIFIER_KIND, salt: toBase64(salt) },
      };
      return existing ? vaultService.updateItem(existing.id, request) : vaultService.createItem(request);
    },
    [],
  );

  const ensureVerifiedWriteAccess = useCallback(async () => {
    if (!kek || !aead || !isKekVerified || !verifierItem) {
      setError("Unlock the vault with a valid passphrase before making changes.");
      return false;
    }
    if (!verifyKek(verifierItem, kek, aead)) {
      lockVault(false);
      setError("Vault key verification failed. Please unlock again.");
      return false;
    }
    return true;
  }, [aead, isKekVerified, kek, lockVault, verifierItem, verifyKek]);

  // ── Key pair bootstrap ──────────────────────────────────────────────────

  const bootstrapUserKeys = useCallback(
    async (currentKek: Uint8Array, cipher: XChaCha20Poly1305Aead) => {
      try {
        const existing = await sharingService.getMyKeys();
        if (existing.has_keys) {
          const encPriv = fromBase64(existing.encrypted_private_keys);
          const nonce = fromBase64(existing.nonce);
          const privKey = decryptPrivateKey(encPriv, nonce, currentKek, cipher);
          const pubKey = fromBase64(existing.public_key_x25519);
          setUserKeyPair(pubKey, privKey);
        } else {
          const kp = await generateX25519KeyPair();
          const { encryptedPrivateKey, nonce } = encryptPrivateKey(kp.privateKey, currentKek, cipher);
          await sharingService.upsertUserKeys({
            public_key_x25519: toBase64(kp.publicKey),
            encrypted_private_keys: toBase64(encryptedPrivateKey),
            nonce: toBase64(nonce),
          });
          setUserKeyPair(kp.publicKey, kp.privateKey);
        }
      } catch (err) {
        console.warn("Failed to bootstrap user keys for sharing:", err);
      }
    },
    [setUserKeyPair],
  );

  // ── Detect unlock mode ──────────────────────────────────────────────────

  useEffect(() => {
    if (!session || !aead) {
      setUnlockMode("checking");
      return;
    }
    if (kek && isKekVerified) return;

    let cancelled = false;
    setUnlockMode("checking");

    const detectVaultPassphrase = async () => {
      try {
        const listed = await vaultService.listItems();
        const hasVerifier = listed.items.some(isVerifierItem);
        if (!cancelled) setUnlockMode(hasVerifier ? "unlock" : "setup");
      } catch {
        if (!cancelled) setUnlockMode("unlock");
      }
    };

    void detectVaultPassphrase();
    return () => {
      cancelled = true;
    };
  }, [aead, isKekVerified, kek, session]);

  // ── Unlock handler ──────────────────────────────────────────────────────

  const handleUnlock = useCallback(
    async (data: VaultUnlockFormData) => {
      if (!session || !aead || unlocking) return;

      const passwordInput = data.masterPassword;
      if (!passwordInput.trim()) {
        setError("Vault passphrase is required");
        return;
      }

      setError("");
      setUnlocking(true);
      let candidateKey: Uint8Array | null = null;

      try {
        // Fetch server-configured KDF params (Item 2 fix).
        let kdfParams: { memoryKiB: number; iterations: number; parallelism: number } | undefined;
        try {
          const serverParams = await vaultService.getKDFParams();
          kdfParams = {
            memoryKiB: serverParams.memory_kib,
            iterations: serverParams.iterations,
            parallelism: serverParams.parallelism,
          };
        } catch {
          // Fall back to compiled-in defaults if endpoint is unreachable.
        }

        const listed = await vaultService.listItems();
        const allItems = listed.items;
        const verifierItems = allItems.filter(isVerifierItem);
        if (verifierItems.length > 1) throw new Error("Multiple vault verifiers detected. Vault recovery is required.");
        const existingVerifier = verifierItems[0] ?? null;

        if (existingVerifier) {
          const salt = getVerifierSalt(existingVerifier);
          if (!salt) throw new Error("Vault verifier is invalid. Please contact support.");
          const verification = await verifyVaultKeyWithWorker({
            password: passwordInput,
            salt,
            payload: {
              version: "xchacha20poly1305-v1",
              nonce: existingVerifier.nonce,
              ciphertext: existingVerifier.ciphertext,
              wrappedDek: existingVerifier.wrapped_dek,
              wrapNonce: existingVerifier.wrap_nonce,
            },
          });
          if (!verification.verified || !verification.derived) throw new Error("Incorrect vault passphrase");
          candidateKey = verification.derived.key;
          setVaultSession(candidateKey, existingVerifier, true);
          candidateKey = null;
          await onUnlocked(verification.derived.key, aead, allItems);
          await bootstrapUserKeys(verification.derived.key, aead);
          toast.success("Vault unlocked");
          return;
        }

        // First-time setup: use server KDF salt
        const saltResp = await vaultService.getVaultSalt();
        const salt = fromBase64(saltResp.salt);

        const derived = await deriveMasterKeyWithWorker({
          password: passwordInput,
          salt,
          params: kdfParams ? { ...kdfParams, outputLength: 32 } : undefined,
        });
        candidateKey = derived.key;

        const createdVerifier = await upsertVerifierItem(derived.key, salt, aead, null);
        setVaultSession(derived.key, createdVerifier, true);
        candidateKey = null;
        await onUnlocked(derived.key, aead);
        await bootstrapUserKeys(derived.key, aead);

        const encryptedDataItems = allItems.filter((i) => !isVerifierItem(i));
        toast.success(encryptedDataItems.length > 0 ? "Vault unlocked and verifier secured" : "Vault unlocked");
      } catch (err) {
        wipeKeyMaterial(candidateKey);
        lockVault(false);
        setError(err instanceof Error ? err.message : "Failed to unlock vault");
      } finally {
        setUnlocking(false);
      }
    },
    [aead, bootstrapUserKeys, lockVault, onUnlocked, session, setVaultSession, unlocking, upsertVerifierItem],
  );

  return {
    unlocking,
    unlockMode,
    error,
    setError,
    lockVault,
    ensureVerifiedWriteAccess,
    handleUnlock,
  };
}
