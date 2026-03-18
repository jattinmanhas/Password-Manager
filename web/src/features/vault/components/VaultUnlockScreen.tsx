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
  onSubmit: (data: VaultUnlockFormData) => void;
}

export function VaultUnlockScreen({
  unlocking,
  aead,
  error,
  onSubmit,
}: VaultUnlockScreenProps) {
  const unlockForm = useForm<VaultUnlockFormData>({
    resolver: zodResolver(vaultUnlockSchema),
    defaultValues: { masterPassword: "" }
  });
  return (
    <div className="auth-layout">
      <div className="auth-container">
        <div className="auth-header">
          <div className="auth-logo">
            <Lock size={22} />
          </div>
          <h1 className="auth-title">Unlock Your Vault</h1>
          <p className="auth-subtitle">Enter your vault passphrase to decrypt your credentials.</p>
        </div>

        <Card>
          {error && <div className="alert-error">{error}</div>}
          <form className="form-stack" onSubmit={unlockForm.handleSubmit(onSubmit)}>
            <div className="form-group">
              <Label htmlFor="master-password">Vault Passphrase</Label>
              <Input
                id="master-password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your master passphrase"
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
              Unlock Vault
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
