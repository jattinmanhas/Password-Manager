import { CreditCard, Landmark, Lock, StickyNote, Share2 } from "lucide-react";
import type { VaultViewItem } from "../vault.types";

interface VaultItemRowProps {
  item: VaultViewItem;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function VaultItemRow({ item, onView, onEdit, onDelete }: VaultItemRowProps) {
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

  if (kind === "login") {
    Icon = Lock;
    subtitle = (secret as any).username;
  } else if (kind === "card") {
    Icon = CreditCard;
    subtitle = (secret as any).cardholderName || "Payment Card";
  } else if (kind === "bank") {
    Icon = Landmark;
    subtitle = (secret as any).bankName || "Bank Account";
  } else if (kind === "note") {
    Icon = StickyNote;
    subtitle = "Secure Note";
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
          {item.isShared && (
            <span title="This item is shared" style={{ marginLeft: "0.5rem", display: "inline-flex", alignItems: "center" }}>
              <Share2 
                size={12} 
                style={{ 
                  color: "var(--color-security-blue)",
                }} 
              />
            </span>
          )}
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
          onClick={onView}
          style={{
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "var(--color-security-blue)",
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          View
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
  onView: (item: VaultViewItem) => void;
  onEdit: (item: VaultViewItem) => void;
  onDelete: (item: VaultViewItem) => void;
}

export function VaultItemsList({
  items,
  loading,
  onRefresh,
  onView,
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
              onView={() => onView(item)}
              onEdit={() => onEdit(item)}
              onDelete={() => onDelete(item)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
