import { CreditCard, Eye, EyeOff, Landmark, Lock, StickyNote } from "lucide-react";
import { useState } from "react";
import type { VaultViewItem } from "../vault.types";

interface VaultItemRowProps {
  item: VaultViewItem;
  onEdit: () => void;
  onDelete: () => void;
}

export function VaultItemRow({ item, onEdit, onDelete }: VaultItemRowProps) {
  const [showPassword, setShowPassword] = useState(false);

  if (item.isCorrupted || !item.secret) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1rem",
          borderRadius: "var(--radius-xl)",
          border: "1px solid #FECACA",
          background: "#FEF2F2",
        }}
      >
        <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#DC2626" }}>
          ⚠ Unable to decrypt this item
        </span>
        <button
          type="button"
          onClick={onDelete}
          style={{
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "#94A3B8",
            cursor: "not-allowed",
            background: "none",
            border: "none",
          }}
          disabled
          title="Corrupted items cannot be deleted from this view"
        >
          Delete
        </button>
      </div>
    );
  }

  const { secret } = item;
  const kind = secret.kind || "login";
  const initials = (secret.title || "?").slice(0, 1).toUpperCase();
  const hue = [...(secret.title || "A")].reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 360;

  let Icon = Lock;
  let subtitle = "";
  let sensitiveValue = "";

  if (kind === "login") {
    Icon = Lock;
    subtitle = (secret as any).username;
    sensitiveValue = (secret as any).password;
  } else if (kind === "card") {
    Icon = CreditCard;
    const cardNum = (secret as any).cardNumber || "";
    subtitle = (secret as any).cardholderName || "Payment Card";
    sensitiveValue = cardNum ? `•••• ${cardNum.slice(-4)}` : "Card Details";
  } else if (kind === "bank") {
    Icon = Landmark;
    subtitle = (secret as any).bankName || "Bank Account";
    sensitiveValue = (secret as any).accountNumber ? `Acc: ••••${(secret as any).accountNumber.slice(-4)}` : "Account Details";
  } else if (kind === "note") {
    Icon = StickyNote;
    subtitle = "Secure Note";
    sensitiveValue = "Click to view notes";
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "1rem",
        padding: "0.875rem 1rem",
        borderRadius: "var(--radius-xl)",
        border: "1px solid var(--color-border)",
        background: "var(--color-soft-gray)",
        transition: "border-color 0.15s ease",
      }}
    >
      {/* Site icon */}
      <div
        style={{
          width: "2.25rem",
          height: "2.25rem",
          borderRadius: "var(--radius-xl)",
          background: `hsl(${hue}, 55%, 50%)`,
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={18} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontWeight: 600,
            fontSize: "0.9375rem",
            color: "var(--color-text-main)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            margin: 0,
          }}
        >
          {secret.title || "Untitled"}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.1rem" }}>
          {subtitle && (
            <p
              style={{
                fontSize: "0.8125rem",
                color: "var(--color-text-subtle)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                margin: 0,
              }}
            >
              {subtitle}
            </p>
          )}
          {subtitle && sensitiveValue && <span style={{ color: "var(--color-border)", fontSize: "0.75rem" }}>•</span>}
          <p
            style={{
              fontFamily: "monospace",
              fontSize: "0.8125rem",
              color: "var(--color-text-main)",
              letterSpacing: (kind === "login" && !showPassword) ? "0.08em" : "0",
              margin: 0,
            }}
          >
            {kind === "login" 
              ? (showPassword ? sensitiveValue : "•".repeat(Math.min(sensitiveValue.length, 12)))
              : (sensitiveValue)
            }
          </p>
        </div>
        
        {/* Tags */}
        {secret.tags && secret.tags.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem", marginTop: "0.375rem" }}>
            {secret.tags.map((tag) => (
              <span
                key={tag}
                style={{
                  fontSize: "0.625rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.02em",
                  padding: "0.125rem 0.5rem",
                  borderRadius: "0.25rem",
                  background: "var(--color-bg-light)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text-subtle)",
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => setShowPassword((p) => !p)}
          title={showPassword ? "Hide password" : "Show password"}
          style={{
            color: "var(--color-text-light)",
            background: "none",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
          }}
        >
          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
        <button
          type="button"
          onClick={onEdit}
          style={{
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "var(--color-security-blue)",
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          Edit
        </button>
        <button
          type="button"
          onClick={onDelete}
          style={{
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "#EF4444",
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

// ── VaultItemsList ─────────────────────────────────────────────────────────

interface VaultItemsListProps {
  items: VaultViewItem[];
  loading: boolean;
  onRefresh: () => void;
  onEdit: (item: VaultViewItem) => void;
  onDelete: (item: VaultViewItem) => void;
}

export function VaultItemsList({
  items,
  loading,
  onRefresh,
  onEdit,
  onDelete,
}: VaultItemsListProps) {
  return (
    <div
      style={{
        background: "var(--color-white)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-2xl)",
        padding: "1.75rem",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "1.25rem",
        }}
      >
        <div>
          <h2
            style={{
              fontSize: "1.125rem",
              fontWeight: 600,
              color: "var(--color-text-main)",
              marginBottom: "0.25rem",
            }}
          >
            Saved Items
          </h2>
          <p style={{ fontSize: "0.875rem", color: "var(--color-text-subtle)" }}>
            {items.length} item{items.length !== 1 ? "s" : ""} in this vault
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          style={{
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "var(--color-security-blue)",
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div
          style={{
            textAlign: "center",
            padding: "2rem",
            color: "var(--color-text-subtle)",
            fontSize: "0.875rem",
          }}
        >
          Loading items…
        </div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem 1rem" }}>
          <div
            style={{
              width: "3rem",
              height: "3rem",
              background: "var(--color-soft-gray)",
              borderRadius: "var(--radius-xl)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 0.75rem",
            }}
          >
            <Lock size={20} style={{ color: "var(--color-text-light)" }} />
          </div>
          <p style={{ fontSize: "0.875rem", color: "var(--color-text-subtle)" }}>
            No items yet. Add your first credential above.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
          {items.map((item) => (
            <VaultItemRow
              key={item.id}
              item={item}
              onEdit={() => onEdit(item)}
              onDelete={() => onDelete(item)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
