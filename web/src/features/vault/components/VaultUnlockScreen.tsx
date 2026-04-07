import { Lock } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { vaultUnlockSchema, type VaultUnlockFormData } from "../../../lib/validations/vault";

import { Card } from "../../../components/ui/Card";
import { Label } from "../../../components/ui/Label";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";

interface VaultUnlockScreenProps {
  unlocking: boolean;
  aead: unknown | null;
  error: string;
  mode?: "checking" | "setup" | "unlock";
  onSubmit: (data: VaultUnlockFormData) => void;
}

export function VaultUnlockScreen({
  unlocking,
  aead,
  error,
  mode = "unlock",
  onSubmit,
}: VaultUnlockScreenProps) {
  const unlockForm = useForm<VaultUnlockFormData>({
    resolver: zodResolver(vaultUnlockSchema),
    defaultValues: { masterPassword: "" }
  });

  const copy = mode === "setup"
    ? {
        title: "Set Up Your Vault",
        subtitle: "Set a vault passphrase to encrypt and protect your credentials.",
        label: "Set Vault Passphrase",
        placeholder: "Choose a vault passphrase",
        button: "Set Vault Passphrase",
      }
    : {
        title: "Unlock Your Vault",
        subtitle: "Enter your vault passphrase to decrypt your credentials.",
        label: "Vault Passphrase",
        placeholder: "Enter your vault passphrase",
        button: "Unlock Vault",
      };

  return (
    <div
      className="auth-layout"
      style={{
        minHeight: "calc(100dvh - 8rem)",
        height: "calc(100dvh - 8rem)",
        overflow: "hidden",
      }}
    >
      <div className="auth-container">
        <div className="auth-header">
          <div className="auth-logo">
            <Lock size={22} />
          </div>
          <h1 className="auth-title">{mode === "checking" ? "Preparing Your Vault" : copy.title}</h1>
          <p className="auth-subtitle">
            {mode === "checking"
              ? "Checking whether your vault passphrase is already set."
              : copy.subtitle}
          </p>
        </div>

        <Card>
          {error && <div className="alert-error">{error}</div>}
          {mode === "checking" ? (
            <div style={{ textAlign: "center", padding: "1.5rem 0", color: "var(--color-text-subtle)" }}>
              Loading vault status...
            </div>
          ) : (
          <form className="form-stack" onSubmit={unlockForm.handleSubmit(onSubmit)}>
            <div className="form-group">
              <Label htmlFor="master-password">{copy.label}</Label>
              <Input
                id="master-password"
                type="password"
                autoComplete="current-password"
                placeholder={copy.placeholder}
                {...unlockForm.register("masterPassword")}
                error={unlockForm.formState.errors.masterPassword?.message}
                disabled={unlocking || !aead}
              />
            </div>
            <Button
              type="submit"
              isLoading={unlocking}
              disabled={!aead || !unlockForm.watch("masterPassword")}
            >
              {copy.button}
            </Button>
          </form>
          )}
        </Card>
      </div>
    </div>
  );
}
