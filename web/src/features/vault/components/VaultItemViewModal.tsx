import { useState } from "react";
import { Copy, Eye, EyeOff, X, Share2 } from "lucide-react";
import toast from "react-hot-toast";
import type { VaultViewItem } from "../vault.types";
import { Label } from "../../../components/ui/Label";
import { Button } from "../../../components/ui/Button";

interface VaultItemViewModalProps {
  item: VaultViewItem;
  vaultName: string;
  onClose: () => void;
  onShare?: () => void;
}

function FieldView({ label, value, sensitive = false }: { label: string; value?: string | null; sensitive?: boolean }) {
  const [show, setShow] = useState(!sensitive);
  
  if (!value) return null;
  
  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    toast.success(`${label} copied!`, { duration: 2000, position: "bottom-center" });
  };
  
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", flex: 1, minWidth: 0 }}>
      <Label style={{ margin: 0, fontSize: "0.75rem", color: "var(--color-text-subtle)" }}>{label}</Label>
      <div style={{ 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "space-between",
        background: "var(--color-soft-gray)",
        padding: "0.625rem 0.875rem",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--color-border)",
        gap: "0.75rem"
      }}>
        <div style={{ 
          fontFamily: sensitive && !show ? "monospace" : "inherit",
          fontSize: "0.9375rem", 
          color: "var(--color-text-main)",
          wordBreak: "break-all",
          letterSpacing: sensitive && !show ? "0.1em" : "normal",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}>
          {sensitive && !show ? "••••••••••" : value}
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
          {sensitive && (
            <button
              type="button"
              onClick={() => setShow(!show)}
              style={{ color: "var(--color-text-light)", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", padding: "0.125rem" }}
              title={show ? "Hide" : "Show"}
            >
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          )}
          <button
            type="button"
            onClick={handleCopy}
            style={{ color: "var(--color-text-light)", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", padding: "0.125rem" }}
            title="Copy"
          >
            <Copy size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function NotesView({ text }: { text?: string | null }) {
  if (!text) return null;
  
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    toast.success(`Notes copied!`, { duration: 2000, position: "bottom-center" });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Label style={{ margin: 0, fontSize: "0.75rem", color: "var(--color-text-subtle)" }}>Notes</Label>
        <button
          type="button"
          onClick={handleCopy}
          style={{ color: "var(--color-text-light)", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem" }}
          title="Copy Notes"
        >
          <Copy size={12} />
          Copy
        </button>
      </div>
      <div style={{ 
        background: "var(--color-soft-gray)",
        padding: "0.875rem",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--color-border)",
        fontSize: "0.9375rem",
        color: "var(--color-text-main)",
        whiteSpace: "pre-wrap",
        maxHeight: "12rem",
        overflowY: "auto",
        lineHeight: "1.5"
      }}>
        {text}
      </div>
    </div>
  );
}

export function VaultItemViewModal({ item, vaultName, onClose, onShare }: VaultItemViewModalProps) {
  const secret = item.secret;
  
  if (!secret) return null;
  
  const kind = secret.kind || "login";
  
  return (
    <div
      className="dialog-overlay"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog-container" style={{ maxWidth: "32rem", width: "100%" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: "1.5rem",
          }}
        >
          <div>
            <h2
              style={{
                fontSize: "1.25rem",
                fontWeight: 600,
                color: "var(--color-text-main)",
                marginBottom: "0.25rem",
              }}
            >
              {secret.title || "Untitled"}
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
               <span style={{ 
                 fontSize: "0.75rem", 
                 fontWeight: 600, 
                 textTransform: "uppercase", 
                 background: "var(--color-soft-gray)", 
                 padding: "0.125rem 0.5rem", 
                 borderRadius: "1rem", 
                 color: "var(--color-text-subtle)" 
               }}>
                 {kind}
               </span>
               <span style={{ fontSize: "0.875rem", color: "var(--color-text-subtle)" }}>
                 in {vaultName || "Vault"}
               </span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {onShare && (
              <Button
                onClick={onShare}
                style={{
                  gap: "0.375rem",
                  fontSize: "0.8125rem",
                  padding: "0.375rem 0.75rem",
                }}
              >
                <Share2 size={14} />
                Share
              </Button>
            )}
            <button
              type="button"
              className="dialog-close"
              onClick={onClose}
              aria-label="Close modal"
              style={{ position: "static", top: "auto", right: "auto" }}
            >
              <X size={18} />
            </button>
          </div>
        </div>
        
        {/* Tags */}
        {secret.tags && secret.tags.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem", marginBottom: "1.25rem" }}>
            {secret.tags.map(tag => (
              <span key={tag} style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                padding: "0.25rem 0.625rem",
                borderRadius: "1rem",
                background: "rgba(37,99,235,0.08)",
                color: "var(--color-security-blue)",
              }}>
                {tag}
              </span>
            ))}
          </div>
        )}
        
        {/* Content Fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {kind === "login" && (
            <>
              <FieldView label="Username / Email" value={(secret as any).username} />
              <FieldView label="Password" value={(secret as any).password} sensitive />
            </>
          )}
          
          {kind === "card" && (
            <>
              <FieldView label="Cardholder Name" value={(secret as any).cardholderName} />
              <FieldView label="Card Number" value={(secret as any).cardNumber} sensitive />
              <FieldView label="Expiry Date" value={(secret as any).expiryDate} />
              <FieldView label="Card Type" value={(secret as any).cardType !== "other" ? (secret as any).cardType : undefined} />
            </>
          )}
          
          {kind === "bank" && (
            <>
              <FieldView label="Bank Name" value={(secret as any).bankName} />
              <FieldView label="Account Number" value={(secret as any).accountNumber} sensitive />
              <FieldView label="IFSC Code" value={(secret as any).ifscCode} />
            </>
          )}

          <NotesView text={secret.notes} />
        </div>
      </div>
    </div>
  );
}
