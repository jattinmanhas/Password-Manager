import { type FormEvent } from "react";
import { X } from "lucide-react";

import { Label } from "../../../components/ui/Label";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";
import { Select } from "../../../components/ui/Select";
import { MultiSelect } from "../../../components/ui/MultiSelect";
import type { VaultFolder, VaultSecret } from "../vault.types";
import { PasswordGenerator } from "./PasswordGenerator";
import { useState, useMemo } from "react";

interface VaultItemFormProps {
  vaultName: string;
  folders: VaultFolder[];
  selectedFolderId: string | undefined;
  draft: VaultSecret;
  saving: boolean;
  isEditing: boolean;
  error: string;
  corruptedCount: number;
  onDraftChange: (draft: VaultSecret) => void;
  onFolderChange: (folderId: string | undefined) => void;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
  allTags: string[];
}

export function VaultItemForm({
  vaultName,
  folders,
  selectedFolderId,
  draft,
  saving,
  isEditing,
  error,
  corruptedCount,
  onDraftChange,
  onFolderChange,
  onSubmit,
  onClose,
  allTags,
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
            <Label>Item Type</Label>
            <Select
              options={[
                { value: "login", label: "Login" },
                { value: "card", label: "Payment Card" },
                { value: "bank", label: "Bank Account" },
                { value: "note", label: "Secure Note" },
              ]}
              value={draft.kind}
              onChange={(value) => {
                const newKind = value as any;
                const base = { title: draft.title, notes: draft.notes, tags: draft.tags, kind: newKind };
                if (newKind === "login") {
                  onDraftChange({ ...base, username: "", password: "" });
                } else if (newKind === "card") {
                  onDraftChange({ ...base, cardholderName: "", cardNumber: "", expiryDate: "", cvv: "", cardType: "other" });
                } else if (newKind === "bank") {
                  onDraftChange({ ...base, bankName: "", accountNumber: "", routingNumber: "", accountType: "other" });
                } else {
                  onDraftChange({ ...base });
                }
              }}
              disabled={saving}
            />
          </div>

          <div className="form-group">
            <Label>Folder (Vault)</Label>
            <Select
              placeholder="No Folder"
              options={[
                { value: "", label: "No Folder" },
                ...folders.map((f) => ({ value: f.id, label: f.name })),
              ]}
              value={selectedFolderId || ""}
              onChange={(value) => onFolderChange(value || undefined)}
              disabled={saving}
            />
          </div>
        </div>

        <div className="form-group">
          <Label>Tags</Label>
          <MultiSelect
            placeholder="Search or add tags..."
            options={allTags}
            value={draft.tags || []}
            onChange={(tags) => onDraftChange({ ...draft, tags })}
            disabled={saving}
          />
        </div>

        <div className="form-group">
          <Label htmlFor="item-title">Title</Label>
          <Input
            id="item-title"
            type="text"
            placeholder="e.g. GitHub or Chase Card"
            value={draft.title}
            onChange={(e) => onDraftChange({ ...draft, title: e.target.value })}
            disabled={saving}
            required
          />
        </div>

        {/* Conditional Fields based on Kind */}
        {draft.kind === "login" && (
          <>
            <div className="form-group">
              <Label htmlFor="item-username">Username / Email</Label>
              <Input
                id="item-username"
                type="text"
                placeholder="e.g. user@email.com"
                value={(draft as any).username || ""}
                onChange={(e) => onDraftChange({ ...draft, username: e.target.value } as any)}
                disabled={saving}
              />
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
                value={(draft as any).password || ""}
                onChange={(e) => onDraftChange({ ...draft, password: e.target.value } as any)}
                disabled={saving}
                required
              />
              {showGenerator && (
                <PasswordGenerator
                  onUsePassword={(password) => {
                    onDraftChange({ ...draft, password } as any);
                    setShowGenerator(false);
                  }}
                  onCancel={() => setShowGenerator(false)}
                />
              )}
            </div>
          </>
        )}

        {draft.kind === "card" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div className="form-group">
                <Label htmlFor="card-number">Card Number</Label>
                <Input
                  id="card-number"
                  type="text"
                  placeholder="0000 0000 0000 0000"
                  value={(draft as any).cardNumber || ""}
                  onChange={(e) => onDraftChange({ ...draft, cardNumber: e.target.value } as any)}
                  disabled={saving}
                />
              </div>
              <div className="form-group">
                <Label htmlFor="card-type">Card Type</Label>
                <select
                  id="card-type"
                  className="input"
                  value={(draft as any).cardType || "other"}
                  onChange={(e) => onDraftChange({ ...draft, cardType: e.target.value } as any)}
                  disabled={saving}
                >
                  <option value="visa">Visa</option>
                  <option value="mastercard">Mastercard</option>
                  <option value="amex">Amex</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr 1fr", gap: "1rem" }}>
              <div className="form-group">
                <Label htmlFor="card-expiry">Expiry</Label>
                <Input
                  id="card-expiry"
                  type="text"
                  placeholder="MM/YY"
                  value={(draft as any).expiryDate || ""}
                  onChange={(e) => onDraftChange({ ...draft, expiryDate: e.target.value } as any)}
                  disabled={saving}
                />
              </div>
              <div className="form-group">
                <Label htmlFor="card-holder">Cardholder Name</Label>
                <Input
                  id="card-holder"
                  type="text"
                  placeholder="John Doe"
                  value={(draft as any).cardholderName || ""}
                  onChange={(e) => onDraftChange({ ...draft, cardholderName: e.target.value } as any)}
                  disabled={saving}
                />
              </div>
              <div className="form-group">
                <Label htmlFor="card-cvv">CVV</Label>
                <Input
                  id="card-cvv"
                  type="password"
                  placeholder="123"
                  value={(draft as any).cvv || ""}
                  onChange={(e) => onDraftChange({ ...draft, cvv: e.target.value } as any)}
                  disabled={saving}
                />
              </div>
            </div>
          </>
        )}

        {draft.kind === "bank" && (
          <>
            <div className="form-group">
              <Label htmlFor="bank-name">Bank Name</Label>
              <Input
                id="bank-name"
                type="text"
                placeholder="e.g. Chase"
                value={(draft as any).bankName || ""}
                onChange={(e) => onDraftChange({ ...draft, bankName: e.target.value } as any)}
                disabled={saving}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div className="form-group">
                <Label htmlFor="bank-acc">Account Number</Label>
                <Input
                  id="bank-acc"
                  type="text"
                  value={(draft as any).accountNumber || ""}
                  onChange={(e) => onDraftChange({ ...draft, accountNumber: e.target.value } as any)}
                  disabled={saving}
                />
              </div>
              <div className="form-group">
                <Label htmlFor="bank-routing">Routing Number</Label>
                <Input
                  id="bank-routing"
                  type="text"
                  value={(draft as any).routingNumber || ""}
                  onChange={(e) => onDraftChange({ ...draft, routingNumber: e.target.value } as any)}
                  disabled={saving}
                />
              </div>
            </div>
          </>
        )}

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
