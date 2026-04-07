import { useEffect, useState, useCallback } from "react";
import { Share2, RefreshCw, Trash2, Mail, User, Calendar, ExternalLink, Shield } from "lucide-react";
import toast from "react-hot-toast";
import { sharingService } from "../services/sharing.service";
import { vaultService } from "../services/vault.service";
import { Button } from "../../../components/ui/Button";
import { Dialog } from "../../../components/ui/Dialog";
import type { SentShareResponse } from "../sharing.types";
import { useVaultSession } from "../../../app/providers/VaultProvider";
import { useAuth } from "../../../app/providers/AuthProvider";
import { VaultUnlockScreen } from "../components/VaultUnlockScreen";
import { encryptVaultItem, fromBase64, toBase64 } from "../../../crypto";
import { deriveMasterKeyWithWorker, verifyVaultKeyWithWorker } from "../../../crypto/worker-client";
import { getVerifierSalt, isVerifierItem, KEK_VERIFIER_KIND, KEK_VERIFIER_TOKEN } from "../vault.utils";

export function SharedByMe() {
  const { session } = useAuth();
  const { aead, kek, isKekVerified, setVaultSession, setUserKeyPair } = useVaultSession();
  const [shares, setShares] = useState<SentShareResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [unlockMode, setUnlockMode] = useState<"checking" | "setup" | "unlock">("checking");
  const [revokingId, setRevokingId] = useState<{ itemId: string; userId: string } | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  const loadShares = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const resp = await sharingService.listSentShares();
      setShares(resp.shares);
    } catch (err: any) {
      setError(err?.message || "Failed to load shared items");
    } finally {
      setLoading(true); // Artificial delay for smooth transition if needed, actually should be false
      setTimeout(() => setLoading(false), 300);
    }
  }, []);

  useEffect(() => {
    if (kek && isKekVerified) {
      void loadShares();
    }
  }, [isKekVerified, kek, loadShares]);

  useEffect(() => {
    if (!session || !aead) {
      setUnlockMode("checking");
      return;
    }
    if (kek && isKekVerified) {
      return;
    }

    let cancelled = false;
    setUnlockMode("checking");

    const detectVaultPassphrase = async () => {
      try {
        const listed = await vaultService.listItems();
        const hasVerifier = listed.items.some(isVerifierItem);
        if (!cancelled) {
          setUnlockMode(hasVerifier ? "unlock" : "setup");
        }
      } catch {
        if (!cancelled) {
          setUnlockMode("unlock");
        }
      }
    };

    void detectVaultPassphrase();
    return () => {
      cancelled = true;
    };
  }, [aead, isKekVerified, kek, session]);

  const handleUnlock = async (data: { masterPassword: string }) => {
    if (!session || !aead || unlocking) return;
    const passwordInput = data.masterPassword;
    if (!passwordInput.trim()) {
      setError("Vault passphrase is required");
      return;
    }

    setError("");
    setUnlocking(true);
    try {
      const listed = await vaultService.listItems();
      const verifierItems = listed.items.filter(isVerifierItem);
      if (verifierItems.length > 1) throw new Error("Multiple vault verifiers detected.");
      const existingVerifier = verifierItems[0] ?? null;
      let activeKey: Uint8Array;

      if (existingVerifier) {
        const salt = getVerifierSalt(existingVerifier);
        if (!salt) throw new Error("Vault verifier is invalid.");

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
        activeKey = verification.derived.key;
        setVaultSession(activeKey, existingVerifier, true);
      } else {
        const saltResp = await vaultService.getVaultSalt();
        const salt = fromBase64(saltResp.salt);
        const derived = await deriveMasterKeyWithWorker({ password: passwordInput, salt });
        activeKey = derived.key;

        const payload = encryptVaultItem({
          plaintext: KEK_VERIFIER_TOKEN,
          kek: derived.key,
          aead,
        });
        const createdVerifier = await vaultService.createItem({
          ciphertext: payload.ciphertext,
          nonce: payload.nonce,
          wrapped_dek: payload.wrappedDek,
          wrap_nonce: payload.wrapNonce,
          algo_version: payload.version,
          metadata: { kind: KEK_VERIFIER_KIND, salt: toBase64(salt) },
        });
        setVaultSession(activeKey, createdVerifier, true);
      }

      try {
        const { generateX25519KeyPair, encryptPrivateKey, decryptPrivateKey } = await import("../../../crypto/sharing");
        const existing = await sharingService.getMyKeys();
        if (existing.has_keys) {
          const encPriv = fromBase64(existing.encrypted_private_keys);
          const nonce = fromBase64(existing.nonce);
          const privKey = decryptPrivateKey(encPriv, nonce, activeKey, aead);
          setUserKeyPair(fromBase64(existing.public_key_x25519), privKey);
        } else {
          const kp = await generateX25519KeyPair();
          const { encryptedPrivateKey, nonce } = encryptPrivateKey(kp.privateKey, activeKey, aead);
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
    } catch (err: any) {
      setError(err?.message || "Failed to unlock vault");
    } finally {
      setUnlocking(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokingId) return;
    setIsRevoking(true);
    try {
      await sharingService.revokeShare(revokingId.itemId, revokingId.userId);
      toast.success("Access revoked successfully");
      setRevokingId(null);
      await loadShares();
    } catch (err: any) {
      toast.error(err?.message || "Failed to revoke access");
    } finally {
      setIsRevoking(false);
    }
  };

  const parseTitle = (titleRaw: string) => {
    try {
      const parsed = JSON.parse(titleRaw);
      return parsed.title || "Untitled Secret";
    } catch {
      return titleRaw || "Untitled Secret";
    }
  };

  if (!kek || !isKekVerified) {
    return (
      <VaultUnlockScreen
        unlocking={unlocking}
        aead={aead}
        error={error}
        mode={unlockMode}
        onSubmit={handleUnlock}
      />
    );
  }

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", paddingBottom: "2rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.25rem" }}>
            <div style={{ 
              width: "2.5rem", 
              height: "2.5rem", 
              background: "rgba(37, 99, 235, 0.1)", 
              borderRadius: "0.75rem", 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center",
              color: "var(--color-security-blue)"
            }}>
              <Share2 size={20} />
            </div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--color-text-main)", margin: 0 }}>
              Secrets I've Shared
            </h1>
          </div>
          <p style={{ color: "var(--color-text-subtle)", margin: 0, fontSize: "0.9375rem" }}>
            Manage access to secrets you have shared with family members.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={() => void loadShares()} disabled={loading} style={{ width: "fit-content" }}>
          <RefreshCw size={16} style={{ marginRight: "0.5rem", animation: loading ? "spin 1s linear infinite" : "none" }} />
          Refresh
        </Button>
      </div>

      {/* Content */}
      {loading && shares.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ 
              height: "80px", 
              background: "var(--color-white)", 
              borderRadius: "1rem", 
              border: "1px solid var(--color-border)",
              animation: "pulse 1.5s infinite" 
            }} />
          ))}
        </div>
      ) : shares.length === 0 ? (
        <div style={{ 
          textAlign: "center", 
          padding: "4rem 2rem", 
          background: "var(--color-white)", 
          border: "1px dashed var(--color-border)",
          borderRadius: "1.5rem" 
        }}>
          <div style={{ 
            width: "4rem", 
            height: "4rem", 
            background: "var(--color-soft-gray)", 
            borderRadius: "1rem", 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center",
            margin: "0 auto 1.5rem",
            color: "var(--color-text-subtle)"
          }}>
            <Shield size={32} />
          </div>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--color-text-main)", marginBottom: "0.5rem" }}>
            No active shares
          </h2>
          <p style={{ color: "var(--color-text-subtle)", maxWidth: "300px", margin: "0 auto" }}>
            You haven't shared any secrets with others yet. Use the share option in your vault to get started.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {shares.map(share => (
            <div 
              key={`${share.item_id}-${share.recipient_id}`}
              style={{
                background: "var(--color-white)",
                border: "1px solid var(--color-border)",
                borderRadius: "1rem",
                padding: "1rem 1.25rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                transition: "all 0.2s",
                boxShadow: "var(--shadow-sm)"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "1rem", flex: 1 }}>
                <div style={{
                  width: "3rem",
                  height: "3rem",
                  background: "var(--color-soft-gray)",
                  borderRadius: "0.75rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--color-security-blue)",
                  fontWeight: 600
                }}>
                  {share.recipient_name?.slice(0, 2).toUpperCase() || share.recipient_email?.slice(0, 2).toUpperCase() || "??"}
                </div>
                
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--color-text-main)", margin: "0 0 0.25rem 0", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    {parseTitle(share.item_title)}
                    <span style={{ 
                      fontSize: "0.6875rem", 
                      padding: "0.125rem 0.5rem", 
                      background: "rgba(37, 99, 235, 0.05)", 
                      color: "var(--color-security-blue)",
                      borderRadius: "0.5rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.02em"
                    }}>
                      {share.permissions}
                    </span>
                  </h3>
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", color: "var(--color-text-subtle)", fontSize: "0.8125rem" }}>
                      <User size={14} />
                      {share.recipient_name || "Shared with"} · {share.recipient_email}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", color: "var(--color-text-light)", fontSize: "0.8125rem" }}>
                      <Calendar size={14} />
                      Shared on {new Date(share.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                 <button
                  onClick={() => setRevokingId({ itemId: share.item_id, userId: share.recipient_id })}
                  style={{
                    background: "rgba(239, 68, 68, 0.05)",
                    border: "1px solid rgba(239, 68, 68, 0.1)",
                    color: "#ef4444",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "0.5rem",
                    fontSize: "0.8125rem",
                    fontWeight: 500,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.375rem",
                    transition: "all 0.2s"
                  }}
                  onMouseOver={e => e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)"}
                  onMouseOut={e => e.currentTarget.style.background = "rgba(239, 68, 68, 0.05)"}
                >
                  <Trash2 size={14} />
                  Revoke
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Revoke Confirmation */}
      <Dialog
        isOpen={!!revokingId}
        onClose={() => setRevokingId(null)}
        title="Revoke Access"
        description="Are you sure you want to revoke access to this secret? The recipient will immediately lose the ability to view or use it."
        confirmLabel="Revoke Access"
        cancelLabel="Cancel"
        onConfirm={() => void handleRevoke()}
        type="confirm"
        isLoading={isRevoking}
      />

      <style>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
