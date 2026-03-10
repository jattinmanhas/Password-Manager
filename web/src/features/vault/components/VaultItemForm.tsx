import { type FormEvent } from "react";
import { X } from "lucide-react";

import { Label } from "../../../components/ui/Label";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";
import type { VaultSecret } from "../vault.types";
import { PasswordGenerator } from "./PasswordGenerator";
import { useState } from "react";

interface VaultItemFormProps {
  vaultName: string;
  draft: VaultSecret;
  saving: boolean;
  isEditing: boolean;
  error: string;
  corruptedCount: number;
  onDraftChange: (draft: VaultSecret) => void;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
}

export function VaultItemForm({
  vaultName,
  draft,
  saving,
  isEditing,
  error,
  corruptedCount,
  onDraftChange,
  onSubmit,
  onClose,
}: VaultItemFormProps) {
  const [showGenerator, setShowGenerator] = useState(false);

  return (
    <div
      className="dialog-overlay"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog-container" style={{ maxWidth: "36rem" }}>
        {/* Panel header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
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
              {isEditing ? `Edit Item in ${vaultName || "Vault"}` : `Add Item to ${vaultName || "Vault"}`}
            </h2>
            <p style={{ fontSize: "0.875rem", color: "var(--color-text-subtle)" }}>
              Save and edit encrypted credentials in this vault.
            </p>
          </div>
          <button
            type="button"
            className="dialog-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

      {error && <div className="alert-error">{error}</div>}
      {corruptedCount > 0 && (
        <div className="alert-error">
          {corruptedCount} item(s) could not be decrypted with the current passphrase.
        </div>
      )}

      <form className="form-stack" onSubmit={onSubmit}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div className="form-group">
            <Label htmlFor="item-title">Title</Label>
            <Input
              id="item-title"
              type="text"
              placeholder="e.g. GitHub"
              value={draft.title}
              onChange={(e) => onDraftChange({ ...draft, title: e.target.value })}
              disabled={saving}
              required
            />
          </div>
          <div className="form-group">
            <Label htmlFor="item-username">Username / Email</Label>
            <Input
              id="item-username"
              type="text"
              placeholder="e.g. user@email.com"
              value={draft.username}
              onChange={(e) => onDraftChange({ ...draft, username: e.target.value })}
              disabled={saving}
            />
          </div>
        </div>

        <div className="form-group">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Label htmlFor="item-password">Password</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowGenerator(!showGenerator)}
              style={{ padding: "0.25rem 0.5rem", height: "auto", fontSize: "0.875rem" }}
            >
              {showGenerator ? "Hide Generator" : "Generate"}
            </Button>
          </div>
          <Input
            id="item-password"
            type="text"
            placeholder="Enter password"
            value={draft.password}
            onChange={(e) => onDraftChange({ ...draft, password: e.target.value })}
            disabled={saving}
            required
          />
          {showGenerator && (
            <PasswordGenerator
              onUsePassword={(password) => {
                onDraftChange({ ...draft, password });
                setShowGenerator(false);
              }}
              onCancel={() => setShowGenerator(false)}
            />
          )}
        </div>

        <div className="form-group">
          <Label htmlFor="item-notes">Notes</Label>
          <textarea
            id="item-notes"
            className="input"
            style={{
              minHeight: "5rem",
              resize: "vertical",
              paddingTop: "0.625rem",
              paddingBottom: "0.625rem",
              height: "auto",
            }}
            placeholder="Optional notes…"
            value={draft.notes}
            onChange={(e) => onDraftChange({ ...draft, notes: e.target.value })}
            disabled={saving}
          />
        </div>

        <div style={{ display: "flex", gap: "0.75rem" }}>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            style={{ width: "auto", paddingLeft: "1.25rem", paddingRight: "1.25rem" }}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            isLoading={saving}
            style={{ width: "auto", paddingLeft: "1.5rem", paddingRight: "1.5rem" }}
          >
            {isEditing ? "Update Item" : "Save Item"}
          </Button>
        </div>
      </form>
      </div>
    </div>
  );
}
