import { FolderLock, X } from "lucide-react";
import { type FormEvent } from "react";

import { Label } from "../../../components/ui/Label";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";
import type { VaultType } from "../vault.types";

interface VaultFormData {
  name: string;
  type: VaultType;
  members: string;
}

interface VaultModalProps {
  mode: "create" | "edit";
  form: VaultFormData;
  onFormChange: (form: VaultFormData) => void;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
}

export function VaultModal({ mode, form, onFormChange, onSubmit, onClose }: VaultModalProps) {
  return (
    <div
      className="dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={mode === "create" ? "Create Vault" : "Edit Vault"}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog-container" style={{ maxWidth: "32rem" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: "0.5rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div
              style={{
                width: "2.5rem",
                height: "2.5rem",
                background: "rgba(37,99,235,0.08)",
                borderRadius: "var(--radius-xl)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--color-security-blue)",
                flexShrink: 0,
              }}
            >
              <FolderLock size={18} />
            </div>
            <div>
              <h3 className="dialog-title" style={{ marginBottom: 0 }}>
                {mode === "create" ? "Create Vault" : "Edit Vault"}
              </h3>
              <p
                style={{
                  fontSize: "0.8125rem",
                  color: "var(--color-text-subtle)",
                  marginTop: "0.125rem",
                }}
              >
                Organize your credentials in a secure space.
              </p>
            </div>
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

        {/* Form */}
        <form className="form-stack" style={{ marginTop: "1.5rem" }} onSubmit={onSubmit}>
          <div className="form-group">
            <Label htmlFor="vault-name">Vault Name</Label>
            <Input
              id="vault-name"
              type="text"
              placeholder="e.g. Work Passwords"
              value={form.name}
              onChange={(e) => onFormChange({ ...form, name: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <Label htmlFor="vault-type">Vault Type</Label>
            <select
              id="vault-type"
              value={form.type}
              onChange={(e) => onFormChange({ ...form, type: e.target.value as VaultType })}
              className="input"
            >
              <option value="personal">Personal — only you</option>
              <option value="shared">Shared — with others</option>
            </select>
          </div>

          {form.type === "shared" && (
            <div className="form-group">
              <Label htmlFor="vault-members">Members</Label>
              <Input
                id="vault-members"
                type="text"
                value={form.members}
                onChange={(e) => onFormChange({ ...form, members: e.target.value })}
                placeholder="Alex, Sam, Jordan (comma-separated)"
              />
            </div>
          )}

          <div className="dialog-footer" style={{ marginTop: "0.5rem" }}>
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
              style={{ width: "auto", paddingLeft: "1.5rem", paddingRight: "1.5rem" }}
            >
              {mode === "create" ? "Create Vault" : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
