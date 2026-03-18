import { useState, useEffect, useCallback } from "react";
import { X, Share2, UserPlus, Trash2, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Card } from "../../../components/ui/Card";
import { sharingService } from "../services/sharing.service";
import { decryptVaultItem, toBase64, fromBase64 } from "../../../crypto";
import { wrapDekForRecipient } from "../../../crypto/sharing";
import type { XChaCha20Poly1305Aead } from "../../../crypto";
import type { VaultViewItem } from "../vault.types";
import type { ShareRecipientResponse } from "../sharing.types";

interface ShareItemModalProps {
  item: VaultViewItem;
  kek: Uint8Array;
  aead: XChaCha20Poly1305Aead;
  userPrivateKey: Uint8Array | null;
  onClose: () => void;
}

export function ShareItemModal({ item, kek, aead, userPrivateKey, onClose }: ShareItemModalProps) {
  const [email, setEmail] = useState("");
  const [sharing, setSharing] = useState(false);
  const [loadingShares, setLoadingShares] = useState(false);
  const [recipients, setRecipients] = useState<ShareRecipientResponse[]>([]);
  const [error, setError] = useState("");

  const loadShares = useCallback(async () => {
    setLoadingShares(true);
    try {
      const resp = await sharingService.listSharesForItem(item.id);
      setRecipients(resp.shares);
    } catch {
      // Item may not have any shares yet
      setRecipients([]);
    } finally {
      setLoadingShares(false);
    }
  }, [item.id]);

  useEffect(() => {
    void loadShares();
  }, [loadShares]);

  const handleShare = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError("Please enter a recipient email");
      return;
    }
    if (!userPrivateKey) {
      setError("Your encryption keys are not available. Please re-unlock the vault.");
      return;
    }

    setError("");
    setSharing(true);
    try {
      // 1. Look up recipient's public key
      const recipientKeys = await sharingService.getPublicKey(trimmedEmail);
      const recipientPublicKey = fromBase64(recipientKeys.public_key_x25519);

      // 2. Get the item's original response to extract the wrapped DEK
      const itemResp = await (await import("../services/vault.service")).vaultService.getItem(item.id);

      // 3. Unwrap the DEK using the owner's KEK
      const wrappedDekBytes = fromBase64(itemResp.wrapped_dek);
      const wrapNonceBytes = fromBase64(itemResp.wrap_nonce);
      const itemDek = aead.decrypt({
        key: kek,
        nonce: wrapNonceBytes,
        ciphertext: wrappedDekBytes,
        associatedData: new TextEncoder().encode("pmv2:dek-wrap:v1"),
      });

      // 4. Re-wrap the DEK for the recipient using X25519 ECDH
      const { wrappedDek, wrapNonce } = await wrapDekForRecipient({
        dek: itemDek,
        recipientPublicKey,
        senderPrivateKey: userPrivateKey,
        aead,
      });

      // 5. Send share request
      await sharingService.shareItem(item.id, {
        recipient_email: trimmedEmail,
        wrapped_dek: toBase64(wrappedDek),
        wrap_nonce: toBase64(wrapNonce),
        permissions: "read",
      });

      toast.success(`Shared with ${trimmedEmail}`);
      setEmail("");
      await loadShares();
    } catch (err: any) {
      const msg = err?.message || "Failed to share item";
      setError(msg);
    } finally {
      setSharing(false);
    }
  };

  const handleRevoke = async (userId: string) => {
    try {
      await sharingService.revokeShare(item.id, userId);
      toast.success("Share revoked");
      await loadShares();
    } catch {
      setError("Failed to revoke share");
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        backdropFilter: "blur(4px)",
        animation: "fadeIn 0.2s ease",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "28rem",
          margin: "1rem",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <Card style={{ padding: 0, overflow: "hidden" }}>
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "1.25rem 1.5rem",
              borderBottom: "1px solid var(--color-border)",
              background: "linear-gradient(135deg, rgba(37, 99, 235, 0.05), rgba(99, 102, 241, 0.05))",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div
                style={{
                  width: "2.25rem",
                  height: "2.25rem",
                  borderRadius: "0.625rem",
                  background: "linear-gradient(135deg, var(--color-primary), #6366f1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                }}
              >
                <Share2 size={16} />
              </div>
              <div>
                <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: 0, color: "var(--color-text-main)" }}>
                  Share Item
                </h3>
                <p style={{ fontSize: "0.75rem", margin: 0, color: "var(--color-text-light)" }}>
                  {item.secret?.title || "Untitled"}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--color-text-light)",
                padding: "0.25rem",
                borderRadius: "0.375rem",
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* Share with email */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  color: "var(--color-text-main)",
                  marginBottom: "0.5rem",
                }}
              >
                Share with
              </label>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <Input
                  type="email"
                  placeholder="Enter email address"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleShare();
                  }}
                  style={{ flex: 1 }}
                />
                <Button
                  onClick={() => void handleShare()}
                  disabled={sharing || !email.trim()}
                  style={{ gap: "0.375rem", minWidth: "5.5rem" }}
                >
                  {sharing ? (
                    <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                  ) : (
                    <>
                      <UserPlus size={16} />
                      Share
                    </>
                  )}
                </Button>
              </div>
              {error && (
                <p
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--color-error, #ef4444)",
                    marginTop: "0.5rem",
                    margin: "0.5rem 0 0 0",
                  }}
                >
                  {error}
                </p>
              )}
            </div>

            {/* Current shares */}
            <div>
              <h4
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "var(--color-text-light)",
                  marginBottom: "0.75rem",
                }}
              >
                Shared with ({recipients.length})
              </h4>

              {loadingShares ? (
                <div style={{ textAlign: "center", padding: "1rem", color: "var(--color-text-light)" }}>
                  <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
                </div>
              ) : recipients.length === 0 ? (
                <p style={{ fontSize: "0.8125rem", color: "var(--color-text-light)", fontStyle: "italic" }}>
                  Not shared with anyone yet.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {recipients.map((r) => (
                    <div
                      key={r.user_id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "0.625rem 0.75rem",
                        borderRadius: "0.625rem",
                        backgroundColor: "var(--color-bg-light, #f8fafc)",
                        border: "1px solid var(--color-border)",
                      }}
                    >
                      <div>
                        <span style={{ fontSize: "0.8125rem", fontWeight: 500 }}>{r.user_id.slice(0, 8)}...</span>
                        <span
                          style={{
                            fontSize: "0.6875rem",
                            color: "var(--color-text-light)",
                            marginLeft: "0.5rem",
                            textTransform: "capitalize",
                          }}
                        >
                          {r.permissions}
                        </span>
                      </div>
                      <button
                        onClick={() => void handleRevoke(r.user_id)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "#ef4444",
                          padding: "0.25rem",
                          borderRadius: "0.25rem",
                          display: "flex",
                          alignItems: "center",
                        }}
                        title="Revoke share"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
