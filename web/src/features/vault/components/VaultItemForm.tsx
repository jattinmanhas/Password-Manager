import { type FormEvent, useState, useEffect } from "react";
import { X, RefreshCw, Eye, EyeOff } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { vaultItemSchema, type VaultItemFormData } from "../../../lib/validations/vault";

import { Label } from "../../../components/ui/Label";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";
import { Select } from "../../../components/ui/Select";
import { MultiSelect } from "../../../components/ui/MultiSelect";
import type { VaultFolder, VaultSecret } from "../vault.types";
import { PasswordGenerator } from "./PasswordGenerator";

interface VaultItemFormProps {
  vaultName: string;
  folders: VaultFolder[];
  selectedFolderId: string | undefined;
  initialData: VaultSecret;
  saving: boolean;
  isEditing: boolean;
  error: string;
  corruptedCount: number;
  onFolderChange: (folderId: string | undefined) => void;
  onSubmit: (data: VaultItemFormData) => void;
  onClose: () => void;
  allTags: string[];
}

export function VaultItemForm({
  vaultName,
  folders,
  selectedFolderId,
  initialData,
  saving,
  isEditing,
  error,
  corruptedCount,
  onFolderChange,
  onSubmit,
  onClose,
  allTags,
}: VaultItemFormProps) {
  const itemForm = useForm<VaultItemFormData>({
    resolver: zodResolver(vaultItemSchema),
    defaultValues: {
      kind: initialData.kind,
      title: initialData.title,
      notes: initialData.notes || "",
      tags: initialData.tags || [],
      ...((initialData as any).username && { username: (initialData as any).username }),
      ...((initialData as any).password && { password: (initialData as any).password }),
      ...((initialData as any).cardNumber && { cardNumber: (initialData as any).cardNumber }),
      ...((initialData as any).cardType && { cardType: (initialData as any).cardType }),
      ...((initialData as any).expiryDate && { expiryDate: (initialData as any).expiryDate }),
      ...((initialData as any).cardholderName && { cardholderName: (initialData as any).cardholderName }),
      ...((initialData as any).cvv && { cvv: (initialData as any).cvv }),
      ...((initialData as any).bankName && { bankName: (initialData as any).bankName }),
      ...((initialData as any).accountNumber && { accountNumber: (initialData as any).accountNumber }),
      ...((initialData as any).ifscCode && { ifscCode: (initialData as any).ifscCode }),
    } as any
  });

  const watchKind = itemForm.watch("kind");

  const [showGenerator, setShowGenerator] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleCardNumberChange = (rawText: string) => {
    let raw = rawText.replace(/\D/g, "");
    let type = "other";
    if (/^4/.test(raw)) type = "visa";
    else if (/^5[1-5]/.test(raw)) type = "mastercard";
    else if (/^3[47]/.test(raw)) type = "amex";

    let formatted = raw;
    if (type === "amex") {
      const parts = [];
      if (raw.length > 0) parts.push(raw.substring(0, 4));
      if (raw.length > 4) parts.push(raw.substring(4, 10));
      if (raw.length > 10) parts.push(raw.substring(10, 15));
      formatted = parts.join("-");
    } else {
      const parts = raw.match(/.{1,4}/g);
      formatted = parts?.join("-") || "";
    }

    itemForm.setValue("cardType" as "title", type, { shouldValidate: true });
    return formatted;
  };

  const handleExpiryChange = (rawText: string) => {
    let val = rawText.replace(/\D/g, "");
    if (val.length > 4) val = val.substring(0, 4);
    let formatted = val;
    if (val.length >= 3) {
      formatted = `${val.substring(0, 2)}/${val.substring(2, 4)}`;
    }
    return formatted;
  };

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

      <form className="form-stack" onSubmit={itemForm.handleSubmit(onSubmit)}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div className="form-group">
            <Label>Item Type</Label>
            <Controller
              name="kind"
              control={itemForm.control}
              render={({ field }) => (
                <Select
                  options={[
                    { value: "login", label: "Login" },
                    { value: "card", label: "Payment Card" },
                    { value: "bank", label: "Bank Account" },
                    { value: "note", label: "Secure Note" },
                  ]}
                  value={field.value}
                  onChange={(value) => {
                    const newKind = value as any;
                    field.onChange(newKind);
                    if (newKind === "login") {
                      itemForm.setValue("username" as any, "");
                      itemForm.setValue("password" as any, "");
                    } else if (newKind === "card") {
                      itemForm.setValue("cardholderName" as any, "");
                      itemForm.setValue("cardNumber" as any, "");
                      itemForm.setValue("expiryDate" as any, "");
                      itemForm.setValue("cvv" as any, "");
                      itemForm.setValue("cardType" as any, "other");
                    } else if (newKind === "bank") {
                      itemForm.setValue("bankName" as any, "");
                      itemForm.setValue("accountNumber" as any, "");
                      itemForm.setValue("ifscCode" as any, "");
                    }
                  }}
                  disabled={saving}
                />
              )}
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
          <Controller
            name="tags"
            control={itemForm.control}
            render={({ field }) => (
              <MultiSelect
                placeholder="Search or add tags..."
                options={allTags}
                value={field.value || []}
                onChange={field.onChange}
                disabled={saving}
              />
            )}
          />
        </div>

        <div className="form-group">
          <Label htmlFor="item-title">Title</Label>
          <Input
            id="item-title"
            type="text"
            placeholder="e.g. GitHub or HDFC Card"
            {...itemForm.register("title")}
            error={itemForm.formState.errors.title?.message}
            disabled={saving}
          />
        </div>

        {/* Conditional Fields based on Kind */}
        {watchKind === "login" && (
          <>
            <div className="form-group">
              <Label htmlFor="item-username">Username / Email</Label>
              <Input
                id="item-username"
                type="text"
                placeholder="e.g. user@email.com"
                {...itemForm.register("username" as "title")} // Using typecast since discriminated union in TS may not perfectly merge register keys
                error={(itemForm.formState.errors as any).username?.message as string}
                disabled={saving}
              />
            </div>
            <div className="form-group">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <Label htmlFor="item-password" style={{ marginBottom: 0 }}>Password</Label>
                <button
                  type="button"
                  onClick={() => setShowGenerator(!showGenerator)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.375rem",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: showGenerator ? "var(--color-text-subtle)" : "var(--color-security-blue)",
                    background: showGenerator ? "var(--color-soft-gray)" : "rgba(37, 99, 235, 0.1)",
                    border: "none",
                    padding: "0.375rem 0.75rem",
                    borderRadius: "1rem",
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                >
                  <RefreshCw size={12} className={showGenerator ? "" : "animate-spin-slow"} style={{ animationDuration: '3s' }} />
                  {showGenerator ? "Cancel Generation" : "Generate Strong Password"}
                </button>
              </div>
              <div style={{ position: "relative" }}>
                <Input
                  id="item-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter password"
                  {...itemForm.register("password" as "title")}
                  error={(itemForm.formState.errors as any).password?.message as string}
                  disabled={saving}
                  style={{ paddingRight: "2.5rem" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: "0.75rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: "var(--color-text-light)",
                    cursor: "pointer",
                    padding: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div>
                {showGenerator && (
                  <div style={{
                    marginTop: "1rem",
                    background: "var(--color-soft-gray)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-xl)",
                    padding: "1rem",
                  }}>
                    <PasswordGenerator
                      onUsePassword={(password) => {
                        itemForm.setValue("password" as "title", password, { shouldValidate: true });
                        setShowGenerator(false);
                      }}
                      onCancel={() => setShowGenerator(false)}
                    />
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {watchKind === "card" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div className="form-group">
                <Label htmlFor="card-number">Card Number</Label>
                <Controller
                  name="cardNumber"
                  control={itemForm.control}
                  render={({ field }) => (
                    <Input
                      id="card-number"
                      type="text"
                      placeholder="0000-0000-0000-0000"
                      {...field}
                      onChange={(e) => {
                        const formatted = handleCardNumberChange(e.target.value);
                        field.onChange(formatted);
                      }}
                      error={(itemForm.formState.errors as any).cardNumber?.message as string}
                      disabled={saving}
                    />
                  )}
                />
              </div>
              <div className="form-group">
                <Label>Card Type</Label>
                <Controller
                  name="cardType"
                  control={itemForm.control}
                  render={({ field }) => (
                    <Select
                      options={[
                        { value: "visa", label: "Visa" },
                        { value: "mastercard", label: "Mastercard" },
                        { value: "amex", label: "Amex" },
                        { value: "other", label: "Other" },
                      ]}
                      value={field.value}
                      onChange={field.onChange}
                      disabled={saving}
                    />
                  )}
                />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr 1fr", gap: "1rem" }}>
              <div className="form-group">
                <Label htmlFor="card-expiry">Expiry</Label>
                <Controller
                  name="expiryDate"
                  control={itemForm.control}
                  render={({ field }) => (
                    <Input
                      id="card-expiry"
                      type="text"
                      placeholder="MM/YY"
                      {...field}
                      onChange={(e) => {
                        const formatted = handleExpiryChange(e.target.value);
                        field.onChange(formatted);
                      }}
                      error={(itemForm.formState.errors as any).expiryDate?.message as string}
                      disabled={saving}
                    />
                  )}
                />
              </div>
              <div className="form-group">
                <Label htmlFor="card-holder">Cardholder Name</Label>
                <Input
                  id="card-holder"
                  type="text"
                  placeholder="John Doe"
                  {...itemForm.register("cardholderName" as "title")}
                  error={(itemForm.formState.errors as any).cardholderName?.message as string}
                  disabled={saving}
                />
              </div>
              <div className="form-group">
                <Label htmlFor="card-cvv">CVV</Label>
                <Input
                  id="card-cvv"
                  type="password"
                  placeholder="123"
                  {...itemForm.register("cvv" as "title")}
                  error={(itemForm.formState.errors as any).cvv?.message as string}
                  disabled={saving}
                />
              </div>
            </div>
          </>
        )}

        {watchKind === "bank" && (
          <>
            <div className="form-group">
              <Label htmlFor="bank-name">Bank Name</Label>
              <Input
                id="bank-name"
                type="text"
                placeholder="e.g. HDFC Bank"
                {...itemForm.register("bankName" as "title")}
                error={(itemForm.formState.errors as any).bankName?.message as string}
                disabled={saving}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div className="form-group">
                <Label htmlFor="bank-acc">Account Number</Label>
                <Input
                  id="bank-acc"
                  type="text"
                  {...itemForm.register("accountNumber" as "title")}
                  error={(itemForm.formState.errors as any).accountNumber?.message as string}
                  disabled={saving}
                />
              </div>
              <div className="form-group">
                <Label htmlFor="bank-ifsc">IFSC Code</Label>
                <Input
                  id="bank-ifsc"
                  type="text"
                  {...itemForm.register("ifscCode" as "title")}
                  error={(itemForm.formState.errors as any).ifscCode?.message as string}
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
            {...itemForm.register("notes")}
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
