import { CreditCard, Landmark, Lock, StickyNote, Share2, Eye, Pencil, Trash2, RotateCcw, History } from "lucide-react";
import type { VaultViewItem } from "../vault.types";

// ── VaultItemRow ──────────────────────────────────────────────────────────────

interface VaultItemRowProps {
  item: VaultViewItem;
  isTrashView?: boolean;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRestore?: () => void;
  onHistory?: () => void;
  onShare?: () => void;
}

export function VaultItemRow({
  item,
  isTrashView,
  onView,
  onEdit,
  onDelete,
  onRestore,
  onHistory,
  onShare,
}: VaultItemRowProps) {
  if (item.isCorrupted || !item.secret) {
    return (
      <div className="vault-corrupted-row">
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
  const hue = [...(secret.title || "A")].reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 360;

  let Icon = Lock;
  let subtitle = "";

  if (kind === "login") {
    Icon = Lock;
    subtitle = (secret as any).username || (secret as any).url;
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
    <div className="vault-item-row">
      {/* Icon */}
      <div
        className="vault-item-row-icon"
        style={{ background: `hsl(${hue}, 55%, 50%)` }}
      >
        <Icon size={16} />
      </div>

      {/* Content */}
      <div className="vault-item-row-content">
        <p className="vault-item-row-title">
          {secret.title || "Untitled"}
          {item.isShared && (
            <span
              title="This item is shared"
              style={{
                marginLeft: "0.375rem",
                display: "inline-flex",
                alignItems: "center",
                verticalAlign: "middle",
              }}
            >
              <Share2 size={11} style={{ color: "var(--color-security-blue)" }} />
            </span>
          )}
        </p>
        {subtitle && (
          <p className="vault-item-row-subtitle">{subtitle}</p>
        )}
        {secret.tags && secret.tags.length > 0 && (
          <div className="vault-item-row-tags">
            {secret.tags.map((tag) => (
              <span key={tag} className="vault-item-row-tag">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="vault-item-row-actions">
        <button type="button" className="vault-action-btn view" onClick={onView} title="View">
          <Eye size={16} />
        </button>

        {!isTrashView && (
          <button type="button" className="vault-action-btn" onClick={onEdit} title="Edit">
            <Pencil size={16} />
          </button>
        )}

        {onShare && !isTrashView && item.vaultType !== "shared" && (
          <button type="button" className="vault-action-btn share" onClick={onShare} title="Share">
            <Share2 size={16} />
          </button>
        )}

        {onHistory && (
          <button type="button" className="vault-action-btn" onClick={onHistory} title="History">
            <History size={16} />
          </button>
        )}

        {isTrashView ? (
          <button type="button" className="vault-action-btn restore" onClick={onRestore} title="Restore">
            <RotateCcw size={16} />
          </button>
        ) : (
          <button type="button" className="vault-action-btn danger" onClick={onDelete} title="Delete">
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

// ── VaultItemsList ─────────────────────────────────────────────────────────

interface VaultItemsListProps {
  items: VaultViewItem[];
  loading: boolean;
  isTrashView?: boolean;
  onRefresh: () => void;
  onView: (item: VaultViewItem) => void;
  onEdit: (item: VaultViewItem) => void;
  onDelete: (item: VaultViewItem) => void;
  onRestore?: (item: VaultViewItem) => void;
  onHistory?: (item: VaultViewItem) => void;
  onShare?: (item: VaultViewItem) => void;
}

export function VaultItemsList({
  items,
  loading,
  isTrashView,
  onRefresh,
  onView,
  onEdit,
  onDelete,
  onRestore,
  onHistory,
  onShare,
}: VaultItemsListProps) {
  return (
    <div className="vault-items-panel">
      <div className="vault-items-header">
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem" }}>
          <h2 className="vault-items-title" style={{ fontSize: "1.25rem", fontWeight: 700 }}>
            {isTrashView ? "Trash" : "Saved Credentials"}
          </h2>
          <span className="vault-items-subtitle" style={{ fontWeight: 600, color: "var(--color-text-light)" }}>
            {items.length} total
          </span>
        </div>
        <button type="button" className="vault-items-refresh" onClick={onRefresh}>
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="vault-items-loading">Loading items…</div>
      ) : items.length === 0 ? (
        <div className="vault-empty">
          <div className="vault-empty-icon">
            <Lock size={20} />
          </div>
          <p className="vault-empty-copy">
            {isTrashView
              ? "Trash is empty."
              : "No items yet. Add your first credential above."}
          </p>
        </div>
      ) : (
        <div className="vault-items-list">
          {items.map((item) => (
            <VaultItemRow
              key={item.id}
              item={item}
              isTrashView={isTrashView}
              onView={() => onView(item)}
              onEdit={() => onEdit(item)}
              onDelete={() => onDelete(item)}
              onRestore={onRestore ? () => onRestore(item) : undefined}
              onHistory={onHistory ? () => onHistory(item) : undefined}
              onShare={onShare ? () => onShare(item) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
