import { useState } from "react";
import QRCode from "react-qr-code";
import toast from "react-hot-toast";
import { Key, Smartphone, Mail } from "lucide-react";
import { useAuth } from "../../../app/providers/AuthProvider";
import { useDialog } from "../../../app/providers/DialogProvider";
import { authService } from "../../auth/services/auth.service";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";

export function SecuritySection() {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
            <div className="settings-section-header" style={{ padding: "0 0.5rem" }}>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--color-text-main)", marginBottom: "0.5rem" }}>
                    Security
                </h3>
                <p style={{ fontSize: "0.875rem", color: "var(--color-text-subtle)", margin: 0 }}>
                    Enhance your account security with multi-factor authentication and recovery options.
                </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                <TwoFactorCard />
                <RecoveryCard />
            </div>
        </div>
    );
}

function TwoFactorCard() {
    const { session, refreshSession } = useAuth();
    const dialog = useDialog();
    const [isSettingUp, setIsSettingUp] = useState(false);
    const [secretUrl, setSecretUrl] = useState("");
    const [code, setCode] = useState("");
    const [loading, setLoading] = useState(false);
    const [apiError, setApiError] = useState("");

    const startSetup = async () => {
        setApiError("");
        setLoading(true);
        try {
            const res = await authService.setupTOTP();
            setSecretUrl(res.otpauth_url);
            setIsSettingUp(true);
        } catch (err: any) {
            toast.error(err.message || "Failed to initialize 2FA");
        } finally {
            setLoading(false);
        }
    };

    const onVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        if (code.length !== 6) return;
        setApiError("");
        setLoading(true);
        try {
            await authService.enableTOTP(code);
            await refreshSession();
            toast.success("2FA Enabled!");
        } catch (err: any) {
            setApiError(err.message || "Invalid code");
        } finally {
            setLoading(false);
        }
    };

    const handleDisable = async () => {
        const confirmed = await dialog.confirm({
            title: "Disable 2FA",
            message: "This will make your account significantly less secure. Continue?",
            confirmLabel: "Disable",
            cancelLabel: "Cancel",
        });
        if (!confirmed) return;
        setLoading(true);
        try {
            await authService.disableTOTP();
            await refreshSession();
            toast.success("2FA Disabled");
            setIsSettingUp(false);
            setSecretUrl("");
        } catch (err: any) {
            toast.error(err.message || "Failed to disable 2FA");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={cardStyle}>
            <div className="settings-split-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem", gap: "1rem" }}>
                <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                    <div style={{
                        width: "2.5rem", height: "2.5rem", borderRadius: "50%",
                        background: session?.isTotpEnabled ? "rgba(16, 185, 129, 0.1)" : "rgba(37, 99, 235, 0.1)",
                        color: session?.isTotpEnabled ? "var(--color-soft-green)" : "var(--color-security-blue)",
                        display: "flex", alignItems: "center", justifyContent: "center"
                    }}>
                        <Smartphone size={20} />
                    </div>
                    <div>
                        <h4 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--color-text-main)", margin: 0 }}>Two-Factor Authentication</h4>
                        <p style={{ fontSize: "0.875rem", color: "var(--color-text-subtle)", marginTop: "0.25rem" }}>
                            {session?.isTotpEnabled ? "Enabled and protecting your account." : "Add an extra layer of security to your login."}
                        </p>
                    </div>
                </div>
                {session?.isTotpEnabled ? (
                    <Button variant="ghost" size="sm" onClick={handleDisable} style={{ color: "var(--color-red)" }}>Disable</Button>
                ) : !isSettingUp && (
                    <Button variant="outline" size="sm" onClick={startSetup} style={{ width: "fit-content" }}>Enable</Button>
                )}
            </div>

            {isSettingUp && !session?.isTotpEnabled && (
                <div style={{ marginTop: "1.5rem", borderTop: "1px solid var(--color-border)", paddingTop: "1.5rem" }}>
                    <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
                        <div style={{
                            background: "var(--color-white)",
                            padding: "0.5rem",
                            borderRadius: "var(--radius-lg)",
                            border: "1px solid var(--color-border)"
                        }}>
                            <QRCode
                                value={secretUrl}
                                size={150}
                                bgColor="transparent"
                                fgColor="currentColor"
                                style={{ display: "block" }}
                            />
                        </div>
                        <div style={{ flex: 1, minWidth: "200px" }}>
                            <p style={{ fontSize: "0.875rem", color: "var(--color-text-main)", fontWeight: 600, marginBottom: "0.5rem" }}>Scan QR Code</p>
                            <p style={{ fontSize: "0.8125rem", color: "var(--color-text-subtle)", marginBottom: "1rem" }}>
                                Use an authenticator app (like Google Authenticator) to scan the code. If you ever lose your
                                device, you can sign in with a code emailed to you.
                            </p>
                            <form onSubmit={onVerify} style={{ display: "flex", gap: "0.5rem" }}>
                                <Input
                                    placeholder="6-digit code"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                    style={{ height: "2.25rem" }}
                                />
                                <Button type="submit" size="sm" isLoading={loading} style={{ height: "2.25rem" }}>Verify</Button>
                            </form>
                            {apiError && <p style={{ color: "var(--color-red)", fontSize: "0.75rem", marginTop: "0.5rem" }}>{apiError}</p>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function RecoveryCard() {
    return (
        <div style={cardStyle}>
            <div className="settings-split-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
                <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                    <div style={{
                        width: "2.5rem", height: "2.5rem", borderRadius: "50%",
                        background: "rgba(16, 185, 129, 0.1)", color: "var(--color-soft-green)",
                        display: "flex", alignItems: "center", justifyContent: "center"
                    }}>
                        <Key size={20} />
                    </div>
                    <div>
                        <h4 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--color-text-main)", margin: 0 }}>Account Recovery</h4>
                        <p style={{ fontSize: "0.875rem", color: "var(--color-text-subtle)", marginTop: "0.25rem" }}>
                            Recovery is handled by email — no setup needed.
                        </p>
                    </div>
                </div>
            </div>

            <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem", alignItems: "flex-start", padding: "0.75rem 1rem", borderRadius: "var(--radius-lg)", background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.25)" }}>
                <Mail size={16} color="var(--color-amber)" style={{ marginTop: 2, flexShrink: 0 }} />
                <p style={{ fontSize: "0.8125rem", color: "var(--color-text-main)", margin: 0 }}>
                    If you forget your master password, you can reset it with a code sent to your email. Because your vault
                    is encrypted with your password (zero-knowledge), <strong>a reset clears your stored items</strong> — the
                    data can't be recovered without the old password.
                </p>
            </div>
        </div>
    );
}

const cardStyle: React.CSSProperties = {
    padding: "1.5rem",
    borderRadius: "var(--radius-xl)",
    background: "var(--color-bg-surface, var(--color-white))",
    border: "1px solid var(--color-border)",
    boxShadow: "var(--shadow-sm)"
};
