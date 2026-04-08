import { Copy, Check, LogIn, User, Key } from "lucide-react";
import { useState } from "react";
import type { LoginSecret } from "../../shared/types/vault.types";

interface VaultItemRowProps {
  title: string;
  username: string;
  url?: string;
  onCopyUsername: () => void;
  onCopyPassword: () => void;
  onFill: () => void;
}

export function VaultItemRow({
  title,
  username,
  url,
  onCopyUsername,
  onCopyPassword,
  onFill,
}: VaultItemRowProps) {
  const [copiedField, setCopiedField] = useState<"user" | "pass" | null>(null);

  const handleCopy = (field: "user" | "pass", action: () => void) => {
    action();
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const favicon = url
    ? `https://www.google.com/s2/favicons?domain=${new URL(url.startsWith("http") ? url : `https://${url}`).hostname}&sz=32`
    : null;

  return (
    <div className="vault-item-row">
      <div className="vault-item-icon">
        {favicon ? (
          <img
            src={favicon}
            alt=""
            width={18}
            height={18}
            style={{ borderRadius: "2px" }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <Key size={16} />
        )}
      </div>

      <div className="vault-item-info">
        <div className="vault-item-title">{title || "Untitled"}</div>
        <div className="vault-item-username">{username || "—"}</div>
      </div>

      <div className="vault-item-actions">
        <button
          className="vault-action-btn"
          onClick={() => handleCopy("user", onCopyUsername)}
          title="Copy username"
        >
          {copiedField === "user" ? (
            <Check size={14} className="text-green" />
          ) : (
            <User size={14} />
          )}
        </button>
        <button
          className="vault-action-btn"
          onClick={() => handleCopy("pass", onCopyPassword)}
          title="Copy password"
        >
          {copiedField === "pass" ? (
            <Check size={14} className="text-green" />
          ) : (
            <Copy size={14} />
          )}
        </button>
        <button
          className="vault-action-btn fill-btn"
          onClick={onFill}
          title="Autofill"
        >
          <LogIn size={14} />
        </button>
      </div>
    </div>
  );
}
