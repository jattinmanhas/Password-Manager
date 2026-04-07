import { useState, useEffect, useRef } from "react";
import QRCode from "react-qr-code";
import toast from "react-hot-toast";
import { 
    ShieldCheck, ShieldAlert, Key, Copy, Download, 
    AlertTriangle, Eye, EyeOff, RefreshCw, Smartphone
} from "lucide-react";
import { useAuth } from "../../../app/providers/AuthProvider";
import { useDialog } from "../../../app/providers/DialogProvider";
import { authService, ApiError } from "../../auth/services/auth.service";
import { vaultService } from "../../vault/services/vault.service";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Label } from "../../../components/ui/Label";
import { 
    randomBytes, toBase64, utf8ToBytes, fromBase64,
} from "../../../crypto";
import { 
    createDefaultXChaCha20Poly1305 
} from "../../../crypto/adapters";
import { deriveMasterKeyWithWorker } from "../../../crypto/worker-client";

// --- Helpers from RecoverySetup ---
function generateRecoveryKey(): string {
    const raw = randomBytes(32);
    const b64 = toBase64(raw);
    const clean = b64.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    const chunks: string[] = [];
    for (let i = 0; i < clean.length && chunks.length < 8; i += 5) {
        const chunk = clean.slice(i, i + 5);
        if (chunk.length === 5) {
            chunks.push(chunk);
        }
    }
    return chunks.join("-");
}

const KEK_VERIFIER_KIND = "kek-verifier";
const KEK_WRAP_AAD = "pmv2:recovery-kek-wrap:v1";

export function SecuritySection() {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
            <div style={{ padding: "0 0.5rem" }}>
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
    const [secret, setSecret] = useState("");
    const [code, setCode] = useState("");
    const [loading, setLoading] = useState(false);
    const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
    const [apiError, setApiError] = useState("");

    const startSetup = async () => {
        setApiError("");
        setLoading(true);
        try {
            const res = await authService.setupTOTP();
            setSecretUrl(res.otpauth_url);
            setSecret(res.secret);
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
            const res = await authService.enableTOTP(code);
            setRecoveryCodes(res.recovery_codes);
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

    if (recoveryCodes.length > 0) {
        return (
            <div style={cardStyle}>
                <div style={cardHeaderStyle}>
                    <ShieldCheck size={20} color="var(--color-soft-green)" />
                    <h4 style={{ margin: 0 }}>Setup Complete!</h4>
                </div>
                <p style={cardDescStyle}>Save these recovery codes. They are your only way back if you lose your device.</p>
                <div style={{ 
                    display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", 
                    padding: "1rem", background: "var(--color-soft-gray)", borderRadius: "var(--radius-lg)",
                    fontFamily: "monospace", fontSize: "0.875rem", textAlign: "center", marginBottom: "1rem"
                }}>
                    {recoveryCodes.map((c, i) => <div key={i} style={{ fontWeight: 600 }}>{c}</div>)}
                </div>
                <Button onClick={() => setRecoveryCodes([])} className="w-full">Finish</Button>
            </div>
        );
    }

    return (
        <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
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
                                Use an authenticator app (like Google Authenticator) to scan the code.
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
    const [status, setStatus] = useState<{ is_enabled: boolean } | null>(null);
    const [isSettingUp, setIsSettingUp] = useState(false);
    const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);
    const [loading, setLoading] = useState(false);
    const [vaultPassphrase, setVaultPassphrase] = useState("");
    const [showPassphrase, setShowPassphrase] = useState(false);

    useEffect(() => {
        authService.getRecoveryStatus().then(setStatus).catch(() => {});
    }, []);

    const startSetup = () => {
        const key = generateRecoveryKey();
        setRecoveryKey(key);
        setIsSettingUp(true);
    };

    const handleConfirm = async () => {
        if (!recoveryKey || !vaultPassphrase) return;
        setLoading(true);
        try {
            const aead = await createDefaultXChaCha20Poly1305();
            const listed = await vaultService.listItems();
            const verifier = listed.items.find(i => {
                const meta = i.metadata as any;
                return meta?.kind === KEK_VERIFIER_KIND;
            });

            if (!verifier) throw new Error("Please unlock your vault first.");
            
            const salt = fromBase64((verifier.metadata as any).salt);
            const derived = await deriveMasterKeyWithWorker({ password: vaultPassphrase, salt });

            // Wrap KEK
            const nonce = randomBytes(aead.nonceLength);
            const wrapped = await (async () => {
                const recoverySalt = randomBytes(16);
                const recoveryDerived = await deriveMasterKeyWithWorker({ password: recoveryKey, salt: recoverySalt });
                const wrappedKek = aead.encrypt({ key: recoveryDerived.key, nonce, plaintext: derived.key, associatedData: utf8ToBytes(KEK_WRAP_AAD) });
                return { wrappedKek: toBase64(wrappedKek), wrapNonce: toBase64(nonce), kekSalt: toBase64(recoverySalt) };
            })();

            await authService.setupRecovery({
                recovery_key: recoveryKey,
                wrapped_kek: wrapped.wrappedKek,
                wrap_nonce: wrapped.wrapNonce,
                kek_salt: wrapped.kekSalt
            });

            setStatus({ is_enabled: true });
            setIsSettingUp(false);
            toast.success("Recovery key configured!");
        } catch (err: any) {
            toast.error(err.message || "Failed to setup recovery");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                    <div style={{
                        width: "2.5rem", height: "2.5rem", borderRadius: "50%",
                        background: status?.is_enabled ? "rgba(16, 185, 129, 0.1)" : "rgba(245, 158, 11, 0.1)",
                        color: status?.is_enabled ? "var(--color-soft-green)" : "var(--color-amber)",
                        display: "flex", alignItems: "center", justifyContent: "center"
                    }}>
                        <Key size={20} />
                    </div>
                    <div>
                        <h4 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--color-text-main)", margin: 0 }}>Account Recovery</h4>
                        <p style={{ fontSize: "0.875rem", color: "var(--color-text-subtle)", marginTop: "0.25rem" }}>
                            {status?.is_enabled ? "Recovery key is active." : "Set up emergency access to your account."}
                        </p>
                    </div>
                </div>
                {!status?.is_enabled && !isSettingUp && (
                    <Button variant="outline" size="sm" onClick={startSetup} style={{ width: "fit-content" }}>Setup</Button>
                )}
            </div>

            {isSettingUp && (
                <div style={{ marginTop: "1rem", borderTop: "1px solid var(--color-border)", paddingTop: "1rem" }}>
                    <div style={{ 
                        background: "var(--color-bg-elevated, rgba(245, 158, 11, 0.1))", 
                        padding: "1rem", 
                        borderRadius: "var(--radius-lg)", 
                        border: "1px solid var(--color-border)", 
                        marginBottom: "1rem" 
                    }}>
                        <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
                            <AlertTriangle size={16} color="var(--color-amber)" style={{ marginTop: 2 }} />
                            <p style={{ fontSize: "0.8125rem", color: "var(--color-text-main)", margin: 0 }}>
                                <strong>Save this key now.</strong> You will only see it once.
                            </p>
                        </div>
                        <div style={{ 
                            background: "var(--color-bg-surface)", 
                            padding: "0.75rem", 
                            borderRadius: "var(--radius-md)", 
                            fontFamily: "monospace", 
                            textAlign: "center", 
                            fontWeight: 700, 
                            margin: "0.75rem 0",
                            fontSize: "1.125rem", 
                            letterSpacing: "0.05em", 
                            color: "var(--color-security-blue)",
                            border: "1px solid var(--color-border)"
                        }}>
                            {recoveryKey}
                        </div>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                            <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(recoveryKey!); toast.success("Copied"); }} style={{ flex: 1, fontSize: "0.75rem" }}>
                                <Copy size={12} style={{ marginRight: "0.375rem" }} /> Copy
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => {
                                const content = `PMV2 Account Recovery Key\n========================\n\n${recoveryKey}\n\nStore this key in a safe place.\nYou will need it to recover your account if you forget your master password.\n\nGenerated: ${new Date().toISOString()}\n`;
                                const blob = new Blob([content], { type: "text/plain" });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = url;
                                a.download = "pmv2-recovery-key.txt";
                                a.click();
                                URL.revokeObjectURL(url);
                                setSaved(true);
                                toast.success("Recovery key downloaded");
                            }} style={{ flex: 1, fontSize: "0.75rem" }}>
                                <Download size={12} style={{ marginRight: "0.375rem" }} /> Download
                            </Button>
                        </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                        <div className="form-group">
                            <Label>Confirm Vault Passphrase</Label>
                            <div className="input-wrapper">
                                <Input 
                                    type={showPassphrase ? "text" : "password"} 
                                    style={{ height: "2.25rem" }} 
                                    value={vaultPassphrase}
                                    onChange={(e) => setVaultPassphrase(e.target.value)}
                                />
                                <button type="button" onClick={() => setShowPassphrase(!showPassphrase)} className="input-icon-btn">
                                    {showPassphrase ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                            </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} id="c-saved" />
                            <label htmlFor="c-saved" style={{ fontSize: "0.8125rem", color: "var(--color-text-subtle)", cursor: "pointer" }}>I've saved my key safely</label>
                        </div>
                        <Button size="sm" onClick={handleConfirm} disabled={!saved || !vaultPassphrase} isLoading={loading} className="w-full">Activate Recovery Key</Button>
                    </div>
                </div>
            )}
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

const cardHeaderStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    marginBottom: "0.75rem"
};

const cardDescStyle: React.CSSProperties = {
    fontSize: "0.875rem",
    color: "var(--color-text-subtle)",
    margin: "0 0 1rem 0"
};
