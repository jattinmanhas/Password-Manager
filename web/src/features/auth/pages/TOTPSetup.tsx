import { useState, useEffect, useRef } from "react";
import QRCode from "react-qr-code";
import { authService, ApiError } from "../services/auth.service";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Label } from "../../../components/ui/Label";
import { Card } from "../../../components/ui/Card";
import toast from "react-hot-toast";
import { useAuth } from "../../../app/providers/AuthProvider";
import { ShieldCheck, ShieldAlert, Key } from "lucide-react";
import { useDialog } from "../../../app/providers/DialogProvider";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { totpSetupSchema, type TotpSetupFormData } from "../../../lib/validations/auth";
const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 8rem)", padding: "1rem" }}>
        <div style={{ width: "100%", maxWidth: "32rem" }}>
            {children}
        </div>
    </div>
);

export function TOTPSetup() {
    const { session, isLoading, refreshSession } = useAuth();
    const dialog = useDialog();
    const [secretUrl, setSecretUrl] = useState("");
    const [secret, setSecret] = useState("");
    const totpForm = useForm<TotpSetupFormData>({
        resolver: zodResolver(totpSetupSchema),
        defaultValues: { code: "" }
    });
    const [apiError, setApiError] = useState("");
    const [loading, setLoading] = useState(false);
    const [setupError, setSetupError] = useState("");
    const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
    // Guard: only initialize QR once per mount after the session is confirmed loaded
    const hasInitialized = useRef(false);

    useEffect(() => {
        // Wait until session is fully loaded; only proceed if 2FA is confirmed off
        if (isLoading || hasInitialized.current) return;
        if (session && !session.isTotpEnabled) {
            hasInitialized.current = true;
            const initTOTP = async () => {
                try {
                    const res = await authService.setupTOTP();
                    setSecretUrl(res.otpauth_url);
                    setSecret(res.secret);
                } catch (err: any) {
                    setSetupError(err.message || "Failed to initialize 2FA setup");
                }
            };
            initTOTP();
        } else if (session && session.isTotpEnabled) {
            // Already enabled – mark as initialized so we never accidentally call setupTOTP
            hasInitialized.current = true;
        }
    }, [isLoading, session]);

    const onEnableSubmit = async (data: TotpSetupFormData) => {
        setApiError("");
        setLoading(true);
        try {
            const res = await authService.enableTOTP(data.code);
            setRecoveryCodes(res.recovery_codes);
            await refreshSession();
            toast.success("Two-Factor Authentication Enabled!");
        } catch (err) {
            if (err instanceof ApiError) {
                setApiError(err.message);
            } else {
                setApiError("Failed to verify code");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleDisable = async () => {
        const confirmed = await dialog.confirm({
            title: "Disable 2FA",
            message: "Are you sure you want to disable Two-Factor Authentication? This will make your account less secure.",
            confirmLabel: "Disable",
            cancelLabel: "Cancel",
        });

        if (!confirmed) return;

        setLoading(true);
        try {
            await authService.disableTOTP();
            await refreshSession();
            toast.success("Two-Factor Authentication Disabled");
            setSecretUrl("");
            setSecret("");
            totpForm.reset();
        } catch (err: any) {
            toast.error(err.message || "Failed to disable 2FA");
        } finally {
            setLoading(false);
        }
    };

    if (setupError) {
        return (
            <Wrapper>
                <Card>
                    <div className="alert-error">{setupError}</div>
                </Card>
            </Wrapper>
        );
    }

    if (session?.isTotpEnabled && recoveryCodes.length === 0) {
        return (
            <Wrapper>
                <Card>
                    <div style={{ textAlign: "center", marginBottom: "2rem" }}>
                        <div style={{ 
                            width: "4rem", height: "4rem", backgroundColor: "rgba(16, 185, 129, 0.1)", 
                            borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                            margin: "0 auto 1rem", color: "var(--color-soft-green)"
                        }}>
                            <ShieldCheck size={32} />
                        </div>
                        <h2 className="card-title">2FA is Enabled</h2>
                        <p className="card-desc">Your account is secured with Two-Factor Authentication.</p>
                    </div>

                    <div style={{ 
                        backgroundColor: "var(--color-soft-gray)", padding: "1.25rem", 
                        borderRadius: "var(--radius-xl)", marginBottom: "2rem",
                        border: "1px solid var(--color-border)"
                    }}>
                        <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                            <ShieldAlert size={20} style={{ color: "var(--color-amber)", flexShrink: 0 }} />
                            <div>
                                <p style={{ fontWeight: 600, fontSize: "0.875rem", margin: "0 0 0.25rem 0" }}>Important</p>
                                <p style={{ fontSize: "0.8125rem", color: "var(--color-text-subtle)", margin: 0 }}>
                                    If you lose access to your authenticator, you must use your recovery codes to sign in.
                                </p>
                            </div>
                        </div>
                    </div>

                    <Button 
                        onClick={handleDisable} 
                        variant="ghost" 
                        isLoading={loading}
                        style={{ color: "var(--color-red)", width: "100%" }}
                    >
                        Disable 2FA
                    </Button>
                </Card>
            </Wrapper>
        );
    }

    if (recoveryCodes.length > 0) {
        return (
            <Wrapper>
                <Card>
                    <h2 className="card-title">Setup Complete!</h2>
                    <p className="card-desc">Save these recovery codes in a secure place. They can be used to access your account if you lose your authenticator device.</p>
                    
                    <div style={{ 
                        backgroundColor: "var(--color-soft-gray)", padding: "1.5rem", 
                        borderRadius: "var(--radius-xl)", marginBottom: "1.5rem", 
                        fontFamily: "monospace", textAlign: "center", 
                        display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem",
                        border: "1px solid var(--color-border)"
                    }}>
                        {recoveryCodes.map((rc, i) => (
                            <div key={i} style={{ color: "var(--color-text-main)", fontWeight: 600 }}>{rc}</div>
                        ))}
                    </div>

                    <Button onClick={() => setRecoveryCodes([])} className="w-100">
                        Finish Setup
                    </Button>
                </Card>
            </Wrapper>
        );
    }

    return (
        <Wrapper>
            <Card>
                <div style={{ marginBottom: "1.5rem", textAlign: "center" }}>
                    <div style={{ 
                        width: "3rem", height: "3rem", backgroundColor: "rgba(37, 99, 235, 0.1)", 
                        borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                        margin: "0 auto 1rem", color: "var(--color-security-blue)"
                    }}>
                        <Key size={24} />
                    </div>
                    <h2 className="card-title">Enable Two-Factor Auth</h2>
                    <p className="card-desc">Scan the QR code with your authenticator app (like Google Authenticator or Authy)</p>
                </div>

                {secretUrl ? (
                    <div style={{ 
                        display: "flex", justifyContent: "center", padding: "1.5rem", 
                        backgroundColor: "white", borderRadius: "var(--radius-xl)", 
                        marginBottom: "1.5rem", border: "1px solid var(--color-border)",
                        boxShadow: "inset 0 2px 4px rgba(0,0,0,0.02)"
                    }}>
                        <QRCode value={secretUrl} size={180} />
                    </div>
                ) : (
                    <div style={{ textAlign: "center", padding: "2rem", color: "var(--color-text-subtle)" }}>
                        Loading QR Code...
                    </div>
                )}

                {apiError && <div className="alert-error">{apiError}</div>}

                <form onSubmit={totpForm.handleSubmit(onEnableSubmit)} className="form-stack">
                    <div className="form-group">
                        <Label htmlFor="code">Verification Code</Label>
                        <Controller
                            name="code"
                            control={totpForm.control}
                            render={({ field }) => (
                                <Input
                                    id="code"
                                    type="text"
                                    placeholder="123456"
                                    autoComplete="one-time-code"
                                    maxLength={6}
                                    {...field}
                                    onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ''))}
                                    disabled={loading || !secretUrl}
                                    error={totpForm.formState.errors.code?.message}
                                />
                            )}
                        />
                    </div>
                    <Button type="submit" isLoading={loading} disabled={!secretUrl}>
                        Verify & Enable
                    </Button>
                </form>
            </Card>
        </Wrapper>
    );
}
