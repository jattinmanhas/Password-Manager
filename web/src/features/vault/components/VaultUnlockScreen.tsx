import { Lock } from "lucide-react";
import { type FormEvent } from "react";

import { Card } from "../../../components/ui/Card";
import { Label } from "../../../components/ui/Label";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";

interface VaultUnlockScreenProps {
  masterPassword: string;
  unlocking: boolean;
  aead: unknown | null;
  error: string;
  onPasswordChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
}

export function VaultUnlockScreen({
  masterPassword,
  unlocking,
  aead,
  error,
  onPasswordChange,
  onSubmit,
}: VaultUnlockScreenProps) {
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
          <form className="form-stack" onSubmit={onSubmit}>
            <div className="form-group">
              <Label htmlFor="master-password">Vault Passphrase</Label>
              <Input
                id="master-password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your master passphrase"
                required
                value={masterPassword}
                onChange={(e) => onPasswordChange(e.target.value)}
                disabled={unlocking || !aead}
              />
            </div>
            <Button
              type="submit"
              isLoading={unlocking}
              disabled={!aead || masterPassword.length === 0}
            >
              Unlock Vault
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
