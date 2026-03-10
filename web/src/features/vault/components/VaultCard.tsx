import { useState } from "react";
import { FolderLock, Lock, Settings, Share2, Trash2 } from "lucide-react";
import type { VaultCardModel } from "../vault.types";

// ── ActionPill ────────────────────────────────────────────────────────────────

interface ActionPillProps {
  onClick: () => void;
  icon?: React.ReactNode;
  danger?: boolean;
  color?: "blue";
  children: React.ReactNode;
}

function ActionPill({ onClick, icon, danger = false, color, children }: ActionPillProps) {
  const [hovered, setHovered] = useState(false);

  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.25rem",
    padding: "0.25rem 0.625rem",
    borderRadius: "999px",
    fontSize: "0.75rem",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.15s ease",
    border: "1px solid",
  };

  const style: React.CSSProperties = danger
    ? {
        ...base,
        background: hovered ? "rgba(239,68,68,0.08)" : "transparent",
        borderColor: hovered ? "#FECACA" : "var(--color-border)",
        color: hovered ? "#DC2626" : "var(--color-text-subtle)",
      }
    : color === "blue"
    ? {
        ...base,
        background: hovered ? "rgba(37,99,235,0.08)" : "transparent",
        borderColor: hovered ? "rgba(37,99,235,0.35)" : "var(--color-border)",
        color: hovered ? "var(--color-security-blue)" : "var(--color-text-subtle)",
      }
    : {
        ...base,
        background: hovered ? "var(--color-soft-gray)" : "transparent",
        borderColor: "var(--color-border)",
        color: "var(--color-text-subtle)",
      };

  return (
    <button
      type="button"
      style={style}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {icon}
      {children}
    </button>
  );
}

// ── VaultCard ────────────────────────────────────────────────────────────────

export interface VaultCardProps {
  vault: VaultCardModel;
  isActive: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onManageMembers: () => void;
}

export function VaultCard({
  vault,
  isActive,
  onOpen,
  onEdit,
  onDelete,
  onManageMembers,
}: VaultCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <article
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "var(--color-white)",
        border: isActive
          ? "2px solid var(--color-security-blue)"
          : "1px solid var(--color-border)",
        borderRadius: "var(--radius-2xl)",
        padding: "1.25rem",
        boxShadow: isActive
          ? "0 8px 24px -4px rgba(37,99,235,0.2)"
          : hovered
          ? "0 8px 20px -6px rgba(15,23,42,0.12)"
          : "var(--shadow-sm)",
        transform: hovered && !isActive ? "translateY(-2px)" : "none",
        transition: "all 0.18s ease",
        display: "flex",
        flexDirection: "column",
        gap: "0.875rem",
        position: "relative",
      }}
    >
      {/* Icon + type badge */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div
          style={{
            width: "2.5rem",
            height: "2.5rem",
            background: isActive ? "rgba(37,99,235,0.12)" : "rgba(37,99,235,0.07)",
            borderRadius: "var(--radius-xl)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--color-security-blue)",
          }}
        >
          {vault.type === "shared" ? <FolderLock size={18} /> : <Lock size={18} />}
        </div>

        <span
          style={{
            fontSize: "0.6875rem",
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            padding: "0.25rem 0.625rem",
            borderRadius: "999px",
            background:
              vault.type === "shared" ? "rgba(37,99,235,0.1)" : "var(--color-soft-gray)",
            color:
              vault.type === "shared" ? "var(--color-security-blue)" : "var(--color-text-subtle)",
          }}
        >
          {vault.type === "shared" ? "Shared" : "Personal"}
        </span>
      </div>

      {/* Name + count */}
      <div>
        <h3
          style={{
            fontSize: "1rem",
            fontWeight: 600,
            color: "var(--color-text-main)",
            marginBottom: "0.2rem",
          }}
        >
          {vault.name}
        </h3>
        <p style={{ fontSize: "0.8125rem", color: "var(--color-text-subtle)" }}>
          {vault.itemCount} {vault.itemCount === 1 ? "item" : "items"}
        </p>
      </div>

      {/* Member avatars (shared only) */}
      {vault.type === "shared" && vault.members.length > 0 && (
        <div style={{ display: "flex", alignItems: "center" }}>
          {vault.members.slice(0, 5).map((member, idx) => (
            <span
              key={`${vault.id}-${member}`}
              title={member}
              style={{
                width: "1.75rem",
                height: "1.75rem",
                borderRadius: "50%",
                border: "2px solid var(--color-white)",
                background: `hsl(${(idx * 73 + 210) % 360}, 60%, 55%)`,
                color: "white",
                fontSize: "0.6rem",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginLeft: idx === 0 ? 0 : "-0.375rem",
                zIndex: 5 - idx,
                position: "relative",
              }}
            >
              {member.slice(0, 1).toUpperCase()}
            </span>
          ))}
          {vault.members.length > 5 && (
            <span
              style={{
                fontSize: "0.75rem",
                color: "var(--color-text-subtle)",
                marginLeft: "0.5rem",
              }}
            >
              +{vault.members.length - 5}
            </span>
          )}
        </div>
      )}

      {/* Timestamp */}
      <p style={{ fontSize: "0.75rem", color: "var(--color-text-light)" }}>
        Updated{" "}
        {new Date(vault.updatedAt).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}
      </p>

      {/* Action buttons — revealed on hover */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.375rem",
          opacity: hovered ? 1 : 0,
          transform: hovered ? "translateY(0)" : "translateY(4px)",
          transition: "opacity 0.15s ease, transform 0.15s ease",
        }}
      >
        <ActionPill onClick={onOpen} color="blue">
          Open vault
        </ActionPill>
        <ActionPill onClick={onEdit} icon={<Settings size={12} />}>
          Edit
        </ActionPill>
        {vault.type === "shared" && (
          <ActionPill onClick={onManageMembers} icon={<Share2 size={12} />}>
            Members
          </ActionPill>
        )}
        <ActionPill onClick={onDelete} danger icon={<Trash2 size={12} />}>
          Delete
        </ActionPill>
      </div>
    </article>
  );
}
