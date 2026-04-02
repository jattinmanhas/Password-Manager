import { useState, useEffect, useCallback } from "react";
import { X, Share2, UserPlus, Trash2, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "../../../components/ui/Button";
import { Select } from "../../../components/ui/Select";
import { sharingService } from "../services/sharing.service";
import { familyService } from "../../family/services/family.service";
import { toBase64, fromBase64 } from "../../../crypto";
import { wrapDekForRecipient } from "../../../crypto/sharing";
import type { XChaCha20Poly1305Aead } from "../../../crypto";
import type { VaultViewItem } from "../vault.types";
import type { ShareRecipientResponse } from "../sharing.types";
import type { FamilyMember } from "../../family/family.types";

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
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoadingShares(true);
    try {
      const [sharesResp, familyResp] = await Promise.all([
        sharingService.listSharesForItem(item.id).catch(() => ({ shares: [] })),
        familyService.listMembers().catch(() => ({ members: [] })),
      ]);
      setRecipients(sharesResp.shares);
      setFamilyMembers(familyResp.members);
    } finally {
      setLoadingShares(false);
    }
  }, [item.id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

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
      await loadData();
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
      await loadData();
    } catch {
      setError("Failed to revoke share");
    }
  };

  return (
    <div
      className="dialog-overlay"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="dialog-container"
        style={{
          width: "100%",
          maxWidth: "30rem",
          padding: 0,
          overflow: "hidden"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ position: "relative" }}>
          {/* Header */}
          <div
            style={{
              padding: "1.5rem 1.75rem",
              borderBottom: "1px solid var(--color-border)",
              background: "linear-gradient(135deg, rgba(37, 99, 235, 0.03), rgba(99, 102, 241, 0.03))",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <div
                style={{
                  width: "2.75rem",
                  height: "2.75rem",
                  borderRadius: "var(--radius-xl)",
                  background: "var(--color-security-blue)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  boxShadow: "0 4px 12px rgba(37, 99, 235, 0.2)",
                  flexShrink: 0
                }}
              >
                <Share2 size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0, color: "var(--color-text-main)", letterSpacing: "-0.01em" }}>
                  Share Item
                </h3>
                <p style={{ fontSize: "0.8125rem", margin: "0.125rem 0 0 0", color: "var(--color-text-subtle)" }}>
                  {item.secret?.title || "Untitled Item"}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="dialog-close"
              aria-label="Close modal"
              style={{ position: "static", top: "auto", right: "auto", padding: "0.375rem" }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: "1.75rem", display: "flex", flexDirection: "column", gap: "1.75rem" }}>
            {/* Share with email */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "var(--color-text-main)",
                  marginBottom: "0.75rem",
                }}
              >
                Share with a family member
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                <Select
                  value={email}
                  onChange={(val) => {
                    setEmail(val);
                    setError("");
                  }}
                  disabled={loadingShares || sharing}
                  searchable={true}
                  placeholder="Select a family member..."
                  options={familyMembers
                    .filter((m) => !recipients.some((r) => r.user_id === m.user_id))
                    .map((m) => ({
                      value: m.email,
                      label: m.name ? `${m.name} (${m.email})` : m.email
                    }))}
                />

                <Button
                  onClick={() => void handleShare()}
                  disabled={sharing || !email.trim()}
                  style={{ gap: "0.5rem", width: "100%", height: "3.25rem" }}
                >
                  {sharing ? (
                    <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
                  ) : (
                    <>
                      <UserPlus size={18} />
                      Share
                    </>
                  )}
                </Button>
              </div>
              {error && (
                <div
                  style={{
                    fontSize: "0.8125rem",
                    color: "var(--color-red, #ef4444)",
                    marginTop: "0.75rem",
                    background: "rgba(239, 68, 68, 0.05)",
                    padding: "0.625rem 0.875rem",
                    borderRadius: "var(--radius-xl)",
                    border: "1px solid rgba(239, 68, 68, 0.1)",
                  }}
                >
                  {error}
                </div>
              )}
            </div>

            {/* Current shares */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h4
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05rem",
                    color: "var(--color-text-subtle)",
                  }}
                >
                  Access control
                </h4>
                <span style={{ fontSize: "0.75rem", color: "var(--color-text-light)", background: "var(--color-soft-gray)", padding: "0.125rem 0.625rem", borderRadius: "1rem" }}>
                  {recipients.length} {recipients.length === 1 ? 'person' : 'people'}
                </span>
              </div>

              {loadingShares ? (
                <div style={{ textAlign: "center", padding: "2rem", color: "var(--color-text-light)" }}>
                  <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} />
                </div>
              ) : recipients.length === 0 ? (
                <div style={{ 
                  textAlign: "center", 
                  padding: "2rem 1rem", 
                  backgroundColor: "var(--color-soft-gray)", 
                  borderRadius: "var(--radius-xl)", 
                  border: "1px dashed var(--color-border)" 
                }}>
                  <p style={{ fontSize: "0.875rem", color: "var(--color-text-subtle)", margin: 0 }}>
                    This item hasn't been shared yet.
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {recipients.map((r) => {
                    const member = familyMembers.find(m => m.user_id === r.user_id);
                    const label = member?.name || member?.email || `User #${r.user_id.slice(0, 8)}`;
                    const subLabel = member?.name ? member.email : (member?.email ? "" : "External user");
                    const initials = (member?.name || member?.email || "??").slice(0, 2).toUpperCase();

                    return (
                      <div
                        key={r.user_id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "1rem",
                          borderRadius: "var(--radius-xl)",
                          backgroundColor: "var(--color-white)",
                          border: "1px solid var(--color-border)",
                          boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                          transition: "all 0.2s"
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                          <div style={{ 
                            width: "2.5rem", 
                            height: "2.5rem", 
                            borderRadius: "50%", 
                            backgroundColor: "var(--color-soft-gray)", 
                            display: "flex", 
                            alignItems: "center", 
                            justifyContent: "center",
                            fontSize: "0.8125rem",
                            fontWeight: 600,
                            color: "var(--color-security-blue)"
                           }}>
                            {initials}
                          </div>
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text-main)" }}>
                              {label}
                            </span>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              {subLabel && (
                                <span style={{ fontSize: "0.75rem", color: "var(--color-text-subtle)" }}>
                                  {subLabel}
                                </span>
                              )}
                              <span
                                style={{
                                  fontSize: "0.6875rem",
                                  color: "var(--color-text-light)",
                                  background: "rgba(37, 99, 235, 0.05)",
                                  padding: "0.125rem 0.375rem",
                                  borderRadius: "0.25rem",
                                  textTransform: "capitalize",
                                }}
                              >
                                {r.permissions}
                              </span>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => void handleRevoke(r.user_id)}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: "var(--color-text-light)",
                            padding: "0.5rem",
                            borderRadius: "var(--radius-xl)",
                            display: "flex",
                            alignItems: "center",
                            transition: "all 0.2s"
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.color = "var(--color-red)";
                            e.currentTarget.style.backgroundColor = "rgba(239, 68, 68, 0.05)";
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.color = "var(--color-text-light)";
                            e.currentTarget.style.backgroundColor = "transparent";
                          }}
                          title="Revoke access"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
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
