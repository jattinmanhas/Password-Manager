import { useState } from "react";
import { Lock, Loader } from "lucide-react";
import { toBase64 } from "../../shared/crypto";
import { createDefaultXChaCha20Poly1305 } from "../../shared/crypto/adapters";
import { vaultService } from "../../shared/services";
import {
  deriveMasterKeyWithWorker,
  verifyVaultKeyWithWorker,
} from "../../shared/crypto/worker-client";
import {
  isVerifierItem,
  getVerifierSalt,
  KEK_VERIFIER_TOKEN_BYTES,
  constantTimeEquals,
} from "../../shared/vault.utils";
import { decryptVaultItem, encryptVaultItem } from "../../shared/crypto";
import type { XChaCha20Poly1305Aead } from "../../shared/crypto";
import type { VaultItemResponse } from "../../shared/types/vault-api.types";
import type { VaultViewItem } from "../../shared/types/vault.types";
import { decryptVaultItemsWithWorker } from "../../shared/crypto/worker-client";

interface UnlockViewProps {
  onUnlocked: (kek: Uint8Array, items: VaultViewItem[]) => void;
}

export function UnlockView({ onUnlocked }: UnlockViewProps) {
  const [passphrase, setPassphrase] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState("");

  const handleUnlock = async () => {
    if (!passphrase.trim()) {
      setError("Vault passphrase is required");
      return;
    }

    setError("");
    setUnlocking(true);

    try {
      // Fetch KDF params
      let kdfParams: { memoryKiB: number; iterations: number; parallelism: number } | undefined;
      try {
        const serverParams = await vaultService.getKDFParams();
        kdfParams = {
          memoryKiB: serverParams.memory_kib,
          iterations: serverParams.iterations,
          parallelism: serverParams.parallelism,
        };
      } catch {
        // Fall back to defaults
      }

      const listed = await vaultService.listItems();
      const allItems = listed.items;
      const verifierItems = allItems.filter(isVerifierItem);

      if (verifierItems.length > 1) {
        throw new Error("Multiple vault verifiers detected.");
      }

      const existingVerifier = verifierItems[0] ?? null;

      if (existingVerifier) {
        const salt = getVerifierSalt(existingVerifier);
        if (!salt) throw new Error("Vault verifier is invalid.");

        const verification = await verifyVaultKeyWithWorker({
          password: passphrase,
          salt,
          payload: {
            version: "xchacha20poly1305-v1",
            nonce: existingVerifier.nonce,
            ciphertext: existingVerifier.ciphertext,
            wrappedDek: existingVerifier.wrapped_dek,
            wrapNonce: existingVerifier.wrap_nonce,
          },
        });

        if (!verification.verified || !verification.derived) {
          throw new Error("Incorrect vault passphrase");
        }

        const kek = verification.derived.key;

        // Store KEK in session storage via background
        await chrome.runtime.sendMessage({
          type: "vault-unlocked",
          kekBase64: toBase64(kek),
        });

        // Decrypt items
        const dataItems = allItems.filter((i) => !isVerifierItem(i));
        const decrypted = await decryptVaultItemsWithWorker({ items: dataItems, kek });

        onUnlocked(kek, decrypted);
      } else {
        // First-time setup
        const saltResp = await vaultService.getVaultSalt();
        const { fromBase64 } = await import("../../shared/crypto");
        const salt = fromBase64(saltResp.salt);

        const derived = await deriveMasterKeyWithWorker({
          password: passphrase,
          salt,
          params: kdfParams ? { ...kdfParams, outputLength: 32 } : undefined,
        });

        // Store KEK
        await chrome.runtime.sendMessage({
          type: "vault-unlocked",
          kekBase64: toBase64(derived.key),
        });

        onUnlocked(derived.key, []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unlock vault");
    } finally {
      setUnlocking(false);
    }
  };

  return (
    <div className="popup-centered">
      <div className="popup-centered-icon">
        <Lock size={24} />
      </div>
      <h2>Unlock Vault</h2>
      <p>Enter your vault passphrase to access your credentials.</p>

      <div style={{ width: "100%", maxWidth: "280px" }}>
        {error && <div className="alert-error">{error}</div>}

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <input
            className="input"
            type="password"
            placeholder="Vault passphrase"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
            autoFocus
            disabled={unlocking}
          />

          <button
            className="btn btn-primary"
            onClick={handleUnlock}
            disabled={unlocking}
            style={{ gap: "0.5rem" }}
          >
            {unlocking ? (
              <>
                <Loader size={16} className="loading-spinner" />
                Unlocking...
              </>
            ) : (
              <>
                <Lock size={16} />
                Unlock
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
