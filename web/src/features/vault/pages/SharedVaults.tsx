import { useCallback, useEffect, useState } from "react";
import { Users, RefreshCw, ShieldOff, Lock, Eye, EyeOff, Copy, AlertCircle, Share2 } from "lucide-react";
import toast from "react-hot-toast";

import { useVaultSession } from "../../../app/providers/VaultProvider";
import { sharingService } from "../services/sharing.service";
import { VaultUnlockScreen } from "../components/VaultUnlockScreen";
import { Button } from "../../../components/ui/Button";
import type { SharedItemResponse } from "../sharing.types";
import type { VaultSecret, VaultSecretKind } from "../vault.types";
import { fromBase64 } from "../../../crypto";
import { normalizeSecret } from "../vault.utils";
import { useAuth } from "../../../app/providers/AuthProvider";
import { vaultService } from "../services/vault.service";
import { deriveMasterKey } from "../../../crypto";
import { decryptVaultItem } from "../../../crypto";
import { createDefaultArgon2idKdf } from "../../../crypto/adapters";
import { getVerifierSalt, isVerifierItem, KEK_VERIFIER_TOKEN_BYTES, constantTimeEquals } from "../vault.utils";
import { VaultItemViewModal } from "../components/VaultItemViewModal";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DecryptedSharedItem {
  raw: SharedItemResponse;
  secret: VaultSecret | null;
  isCorrupted: boolean;
}

// ── KindBadge ─────────────────────────────────────────────────────────────────

const KIND_COLORS: Record<VaultSecretKind, { bg: string; color: string; label: string }> = {
  login: { bg: "rgba(37,99,235,0.1)", color: "var(--color-security-blue)", label: "Login" },
  card: { bg: "rgba(124,58,237,0.1)", color: "#7c3aed", label: "Card" },
  bank: { bg: "rgba(5,150,105,0.1)", color: "#059669", label: "Bank" },
  note: { bg: "rgba(245,158,11,0.1)", color: "#d97706", label: "Note" },
};

function KindBadge({ kind }: { kind?: VaultSecretKind }) {
  const k = kind && KIND_COLORS[kind] ? KIND_COLORS[kind] : { bg: "var(--color-soft-gray)", color: "var(--color-text-subtle)", label: kind ?? "Unknown" };
  return (
    <span style={{
      fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase",
      padding: "0.2rem 0.5rem", borderRadius: "999px", background: k.bg, color: k.color,
    }}>
      {k.label}
    </span>
  );
}

// ── SharedItemCard ────────────────────────────────────────────────────────────

function SharedItemCard({ item }: { item: DecryptedSharedItem }) {
  const [hovered, setHovered] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success(`${label} copied`));
  };

  const secretValue = (): string | undefined => {
    const s = item.secret;
    if (!s) return undefined;
    if (s.kind === "login") return (s as any).password;
    if (s.kind === "card") return (s as any).cardNumber;
    if (s.kind === "bank") return (s as any).accountNumber;
    return undefined;
  };

  const secretLabel = (): string => {
    const s = item.secret;
    if (!s) return "Secret";
    if (s.kind === "login") return "Password";
    if (s.kind === "card") return "Card Number";
    if (s.kind === "bank") return "Account Number";
    return "Secret";
  };

  const subLabel = (): string | undefined => {
    const s = item.secret;
    if (!s) return undefined;
    if (s.kind === "login") return (s as any).username;
    if (s.kind === "card") return (s as any).cardholderName;
    if (s.kind === "bank") return (s as any).bankName;
    return undefined;
  };

  const secret = secretValue();

  return (
    <article
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => item.secret && !item.isCorrupted && (item as any).onClick?.()}
      style={{
        background: "var(--color-white)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-2xl)",
        padding: "1.25rem",
        boxShadow: hovered ? "0 8px 20px -6px rgba(15,23,42,0.12)" : "var(--shadow-sm)",
        transform: hovered ? "translateY(-2px)" : "none",
        transition: "all 0.18s ease",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        opacity: item.isCorrupted ? 0.65 : 1,
        cursor: !item.isCorrupted && item.secret ? "pointer" : "default",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", flex: 1, minWidth: 0 }}>
          <div style={{
            width: "2.25rem", height: "2.25rem", flexShrink: 0,
            background: item.isCorrupted ? "rgba(239,68,68,0.08)" : "rgba(37,99,235,0.07)",
            borderRadius: "var(--radius-xl)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: item.isCorrupted ? "#ef4444" : "var(--color-security-blue)",
          }}>
            {item.isCorrupted ? <AlertCircle size={16} /> : <Lock size={16} />}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{
              fontWeight: 600, fontSize: "0.9375rem", color: "var(--color-text-main)",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", margin: 0,
            }}>
              {item.isCorrupted ? "Corrupted Item" : item.secret?.title || "Untitled"}
            </p>
            {subLabel() && (
              <p style={{ fontSize: "0.8125rem", color: "var(--color-text-subtle)", margin: 0, marginTop: "0.1rem" }}>
                {subLabel()}
              </p>
            )}
          </div>
        </div>
        <KindBadge kind={item.secret?.kind} />
      </div>

      {/* Shared by */}
      <div style={{
        display: "flex", alignItems: "center", gap: "0.375rem",
        padding: "0.4rem 0.625rem",
        background: "rgba(37,99,235,0.04)",
        borderRadius: "0.5rem",
        fontSize: "0.8rem",
      }}>
        <Share2 size={13} style={{ color: "var(--color-security-blue)", flexShrink: 0 }} />
        <span style={{ color: "var(--color-text-subtle)" }}>
          Shared by{" "}
          <span style={{ fontWeight: 600, color: "var(--color-text-main)" }}>
            {item.raw.shared_by_name || item.raw.shared_by_email}
          </span>
        </span>
        <span style={{
          marginLeft: "auto", fontSize: "0.6875rem", fontWeight: 600, textTransform: "uppercase",
          letterSpacing: "0.04em", color: "var(--color-text-subtle)",
          background: "var(--color-soft-gray)", padding: "0.15rem 0.4rem", borderRadius: "999px",
        }}>
          {item.raw.permissions}
        </span>
      </div>

      {/* Secret reveal (only if not corrupted and has a secret value) */}
      {!item.isCorrupted && secret && (
        <div style={{
          background: "var(--color-soft-gray)", borderRadius: "0.625rem",
          padding: "0.5rem 0.75rem",
          display: "flex", alignItems: "center", gap: "0.5rem",
        }}>
          <span style={{ fontSize: "0.8125rem", color: "var(--color-text-subtle)", flexShrink: 0 }}>
            {secretLabel()}:
          </span>
          <span style={{
            flex: 1, fontFamily: "monospace", fontSize: "0.875rem",
            color: "var(--color-text-main)", filter: showSecret ? "none" : "blur(5px)",
            userSelect: showSecret ? "text" : "none",
            transition: "filter 0.2s ease",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {secret}
          </span>
          <button
            onClick={() => setShowSecret((s) => !s)}
            title={showSecret ? "Hide" : "Reveal"}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-subtle)", padding: "0.25rem", display: "flex" }}
          >
            {showSecret ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
          <button
            onClick={() => copyToClipboard(secret, secretLabel())}
            title="Copy"
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-subtle)", padding: "0.25rem", display: "flex" }}
          >
            <Copy size={15} />
          </button>
        </div>
      )}

      {/* Notes */}
      {!item.isCorrupted && item.secret?.notes && (
        <p style={{ fontSize: "0.8125rem", color: "var(--color-text-subtle)", margin: 0 }}>
          {item.secret.notes}
        </p>
      )}

      {/* Timestamps */}
      <p style={{ fontSize: "0.75rem", color: "var(--color-text-light)", margin: 0 }}>
        Updated {new Date(item.raw.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
      </p>
    </article>
  );
}

// ── SharedVaults page ─────────────────────────────────────────────────────────

export function SharedVaults() {
  const { session } = useAuth();
  const { aead, kek, isKekVerified, userPrivateKey, setVaultSession, setUserKeyPair } = useVaultSession();

  const [items, setItems] = useState<DecryptedSharedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [selectedItem, setSelectedItem] = useState<DecryptedSharedItem | null>(null);

  // ── Decrypt and load shared items ──────────────────────────────────────────
  const loadSharedItems = useCallback(async () => {
    if (!userPrivateKey || !aead) return;
    setLoading(true);
    setError("");
    try {
      const resp = await sharingService.listSharedWithMe();
      const result: DecryptedSharedItem[] = [];

      for (const si of resp.items) {
        try {
          const { unwrapDekFromShare } = await import("../../../crypto/sharing");

          let senderPublicKey: Uint8Array;
          try {
            const senderKeys = await sharingService.getPublicKey(si.shared_by_email);
            senderPublicKey = fromBase64(senderKeys.public_key_x25519);
          } catch {
            result.push({ raw: si, secret: null, isCorrupted: true });
            continue;
          }

          const shareDek = await unwrapDekFromShare({
            wrappedDek: fromBase64(si.share_wrapped_dek),
            wrapNonce: fromBase64(si.share_wrap_nonce),
            senderPublicKey,
            recipientPrivateKey: userPrivateKey,
            aead,
          });

          const plaintext = aead.decrypt({
            key: shareDek,
            nonce: fromBase64(si.nonce),
            ciphertext: fromBase64(si.ciphertext),
          });

          const parsed = JSON.parse(new TextDecoder().decode(plaintext));
          result.push({ raw: si, secret: normalizeSecret(parsed), isCorrupted: false });
        } catch {
          result.push({ raw: si, secret: null, isCorrupted: true });
        }
      }

      setItems(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load shared items");
    } finally {
      setLoading(false);
    }
  }, [userPrivateKey, aead]);

  useEffect(() => {
    if (aead && userPrivateKey && isKekVerified) {
      void loadSharedItems();
    }
  }, [aead, userPrivateKey, isKekVerified, loadSharedItems]);

  // ── Unlock handler (mirrors Vault.tsx logic) ───────────────────────────────
  const handleUnlock = async (data: { masterPassword: string }) => {
    if (!session || !aead || unlocking) return;
    const passwordInput = data.masterPassword;
    if (!passwordInput.trim()) { setError("Vault passphrase is required"); return; }

    setError("");
    setUnlocking(true);
    try {
      const listed = await vaultService.listItems();
      const verifierItems = listed.items.filter(isVerifierItem);
      if (verifierItems.length > 1) throw new Error("Multiple vault verifiers detected.");
      const existingVerifier = verifierItems[0] ?? null;
      if (!existingVerifier) throw new Error("No vault verifier found. Please unlock from the Vault page first.");

      const salt = getVerifierSalt(existingVerifier);
      if (!salt) throw new Error("Vault verifier is invalid.");

      const kdf = await createDefaultArgon2idKdf();
      const derived = await deriveMasterKey({ password: passwordInput, kdf, salt });

      const verified = (() => {
        try {
          const token = decryptVaultItem({
            payload: {
              version: "xchacha20poly1305-v1",
              nonce: existingVerifier.nonce,
              ciphertext: existingVerifier.ciphertext,
              wrappedDek: existingVerifier.wrapped_dek,
              wrapNonce: existingVerifier.wrap_nonce,
            },
            kek: derived.key,
            aead,
          });
          return constantTimeEquals(new TextEncoder().encode(token), KEK_VERIFIER_TOKEN_BYTES);
        } catch {
          return false;
        }
      })();

      if (!verified) throw new Error("Incorrect vault passphrase");

      setVaultSession(derived.key, existingVerifier, true);

      // Bootstrap user keys for decryption
      try {
        const { generateX25519KeyPair, encryptPrivateKey, decryptPrivateKey } = await import("../../../crypto/sharing");
        const existing = await sharingService.getMyKeys();
        if (existing.has_keys) {
          const encPriv = fromBase64(existing.encrypted_private_keys);
          const nonce = fromBase64(existing.nonce);
          const privKey = decryptPrivateKey(encPriv, nonce, derived.key, aead);
          setUserKeyPair(fromBase64(existing.public_key_x25519), privKey);
        } else {
          const kp = await generateX25519KeyPair();
          const { encryptedPrivateKey, nonce } = encryptPrivateKey(kp.privateKey, derived.key, aead);
          const { toBase64 } = await import("../../../crypto");
          await sharingService.upsertUserKeys({
            public_key_x25519: toBase64(kp.publicKey),
            encrypted_private_keys: toBase64(encryptedPrivateKey),
            nonce: toBase64(nonce),
          });
          setUserKeyPair(kp.publicKey, kp.privateKey);
        }
      } catch (e) {
        console.warn("Key bootstrap failed:", e);
      }

      toast.success("Vault unlocked");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unlock vault");
    } finally {
      setUnlocking(false);
    }
  };

  // ── Gate: require unlock ───────────────────────────────────────────────────
  if (!kek || !isKekVerified) {
    return (
      <VaultUnlockScreen
        unlocking={unlocking}
        aead={aead}
        error={error}
        onSubmit={handleUnlock}
      />
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────
  const corruptedCount = items.filter((i) => i.isCorrupted).length;
  const okCount = items.filter((i) => !i.isCorrupted).length;

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.25rem" }}>
            <div style={{
              width: "2.5rem", height: "2.5rem",
              background: "rgba(37,99,235,0.1)", borderRadius: "var(--radius-xl)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--color-security-blue)",
            }}>
              <Users size={20} />
            </div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--color-text-main)", margin: 0 }}>
              Shared With Me
            </h1>
          </div>
          <p style={{ color: "var(--color-text-subtle)", margin: 0, fontSize: "0.9375rem" }}>
            {loading ? "Loading…" : `${okCount} item${okCount !== 1 ? "s" : ""} shared with you`}
            {corruptedCount > 0 && (
              <span style={{ color: "#ef4444", marginLeft: "0.5rem" }}>
                · {corruptedCount} corrupted
              </span>
            )}
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadSharedItems()}
          disabled={loading}
          style={{ width: "fit-content" }}
        >
          <RefreshCw size={15} style={{ marginRight: "0.375rem", animation: loading ? "spin 1s linear infinite" : "none" }} />
          Refresh
        </Button>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{
          display: "flex", alignItems: "center", gap: "0.75rem",
          padding: "0.875rem 1rem",
          background: "rgba(239,68,68,0.06)",
          border: "1px solid rgba(239,68,68,0.2)",
          borderRadius: "0.75rem",
          marginBottom: "1.5rem",
          color: "#dc2626", fontSize: "0.9rem",
        }}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && items.length === 0 && !error && (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: "4rem 2rem", textAlign: "center",
          background: "var(--color-white)",
          border: "1px dashed var(--color-border)",
          borderRadius: "var(--radius-2xl)",
        }}>
          <div style={{
            width: "4rem", height: "4rem",
            background: "rgba(37,99,235,0.07)",
            borderRadius: "var(--radius-2xl)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--color-security-blue)",
            marginBottom: "1.25rem",
          }}>
            <ShieldOff size={28} />
          </div>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--color-text-main)", marginBottom: "0.5rem" }}>
            No shared items yet
          </h2>
          <p style={{ color: "var(--color-text-subtle)", fontSize: "0.9375rem", maxWidth: "28rem", margin: 0 }}>
            When someone shares a vault item with you, it will appear here. You can also share your own items from the{" "}
            <a href="/vault" style={{ color: "var(--color-security-blue)", fontWeight: 500 }}>Vault</a> page.
          </p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1rem" }}>
          {[1, 2, 3].map((n) => (
            <div key={n} style={{
              background: "var(--color-white)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-2xl)",
              padding: "1.25rem",
              height: "12rem",
              animation: "pulse 1.5s ease-in-out infinite",
            }} />
          ))}
        </div>
      )}

      {/* Items grid */}
      {!loading && items.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(304px, 1fr))", gap: "1.25rem" }}>
          {items.map((item) => (
            <SharedItemCard 
              key={item.raw.id} 
              item={{ ...item, onClick: () => setSelectedItem(item) } as any} 
            />
          ))}
        </div>
      )}

      {/* Item View Modal */}
      {selectedItem && selectedItem.secret && (
        <VaultItemViewModal
          item={{
            id: selectedItem.raw.id,
            secret: selectedItem.secret,
            updatedAt: selectedItem.raw.updated_at,
            isCorrupted: selectedItem.isCorrupted,
            vaultId: "shared",
            vaultName: "Shared Items",
            vaultType: "shared",
          }}
          vaultName={`Shared by ${selectedItem.raw.shared_by_name || selectedItem.raw.shared_by_email.split('@')[0]}`}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}
