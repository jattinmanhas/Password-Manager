import { FolderLock, X } from "lucide-react";
import { type FormEvent, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { vaultModalSchema, type VaultModalFormData } from "../../../lib/validations/vault";

import { Label } from "../../../components/ui/Label";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";
import type { VaultType } from "../vault.types";

interface VaultModalProps {
  mode: "create" | "edit";
  initialData?: VaultModalFormData;
  onSubmit: (data: VaultModalFormData) => void;
  onClose: () => void;
}

export function VaultModal({ mode, initialData, onSubmit, onClose }: VaultModalProps) {
  const modalForm = useForm<VaultModalFormData>({
    resolver: zodResolver(vaultModalSchema),
    defaultValues: initialData || { name: "", type: "personal", members: "" }
  });

  useEffect(() => {
    if (initialData) {
      modalForm.reset(initialData);
    }
  }, [initialData, modalForm]);

  const watchType = modalForm.watch("type");
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
        <form className="form-stack" style={{ marginTop: "1.5rem" }} onSubmit={modalForm.handleSubmit(onSubmit)}>
          <div className="form-group">
            <Label htmlFor="vault-name">Vault Name</Label>
            <Input
              id="vault-name"
              type="text"
              placeholder="e.g. Work Passwords"
              {...modalForm.register("name")}
              error={modalForm.formState.errors.name?.message}
            />
          </div>

          <div className="form-group">
            <Label htmlFor="vault-type">Vault Type</Label>
            <select
              id="vault-type"
              className="input"
              {...modalForm.register("type")}
            >
              <option value="personal">Personal — only you</option>
              <option value="shared">Shared — with others</option>
            </select>
          </div>

          {watchType === "shared" && (
            <div className="form-group">
              <Label htmlFor="vault-members">Members</Label>
              <Input
                id="vault-members"
                type="text"
                placeholder="Alex, Sam, Jordan (comma-separated)"
                {...modalForm.register("members")}
                error={modalForm.formState.errors.members?.message}
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
