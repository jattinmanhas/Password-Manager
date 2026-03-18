import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { Copy, ShieldCheck, AlertTriangle, Download, Eye, EyeOff } from "lucide-react";

import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Label } from "../../../components/ui/Label";
import { authService, ApiError } from "../services/auth.service";
import {
    randomBytes,
    toBase64,
    utf8ToBytes,
    deriveMasterKey,
    type XChaCha20Poly1305Aead,
} from "../../../crypto";
import {
    createDefaultArgon2idKdf,
    createDefaultXChaCha20Poly1305,
} from "../../../crypto/adapters";
import { vaultService } from "../../vault/services/vault.service";

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


const MASTER_KEY_SALT_LENGTH = 16;
const KEK_VERIFIER_KIND = "kek-verifier";
const KEK_WRAP_AAD = "pmv2:recovery-kek-wrap:v1";

function parseVaultMetadata(metadata: unknown): Record<string, unknown> {
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
        return {};
    }
    return metadata as Record<string, unknown>;
}

async function wrapKekForRecovery(
    kek: Uint8Array,
    recoveryKey: string,
    aead: XChaCha20Poly1305Aead,
): Promise<{ wrappedKek: string; wrapNonce: string; kekSalt: string }> {
    const kdf = await createDefaultArgon2idKdf();

    const salt = randomBytes(MASTER_KEY_SALT_LENGTH);

    const derived = await deriveMasterKey({
        password: recoveryKey,
        kdf,
        salt,
    });

    const nonce = randomBytes(aead.nonceLength);
    const wrappedKek = aead.encrypt({
        key: derived.key,
        nonce,
        plaintext: kek,
        associatedData: utf8ToBytes(KEK_WRAP_AAD),
    });

    derived.key.fill(0);

    return {
        wrappedKek: toBase64(wrappedKek),
        wrapNonce: toBase64(nonce),
        kekSalt: toBase64(salt),
    };
}
const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 8rem)", padding: "1rem" }}>
        <div style={{ width: "100%", maxWidth: "32rem" }}>
            {children}
        </div>
    </div>
);

export function RecoverySetup() {
    const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [confirmed, setConfirmed] = useState(false);
    const [isLoadingStatus, setIsLoadingStatus] = useState(true);

    const [vaultPassphrase, setVaultPassphrase] = useState("");
    const [showPassphrase, setShowPassphrase] = useState(false);

    useEffect(() => {
        let isMounted = true;
        authService.getRecoveryStatus()
            .then((res) => {
                if (isMounted && res.is_enabled) {
                    setConfirmed(true);
                }
            })
            .catch(() => {})
            .finally(() => {
                if (isMounted) {
                    setIsLoadingStatus(false);
                }
            });
        
        return () => { isMounted = false; };
    }, []);

    const handleGenerate = async () => {
        setError("");
        const key = generateRecoveryKey();
        setRecoveryKey(key);
        setSaved(false);
        setConfirmed(false);
    };

    const copyToClipboard = async () => {
        if (!recoveryKey) return;
        try {
            await navigator.clipboard.writeText(recoveryKey);
            toast.success("Recovery key copied to clipboard");
        } catch {
            toast.error("Failed to copy");
        }
    };

    const downloadAsFile = () => {
        if (!recoveryKey) return;
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
    };

    const handleConfirmSave = async () => {
        if (!recoveryKey) return;
        setSaving(true);
        setError("");

        try {
            let wrappedKekPayload: { wrapped_kek: string; wrap_nonce: string; kek_salt: string } | undefined;

            if (vaultPassphrase.trim()) {
                const aead = await createDefaultXChaCha20Poly1305();
                const kdf = await createDefaultArgon2idKdf();

                const listedItems = await vaultService.listItems();
                const verifierItem = listedItems.items.find((item) => {
                    const meta = parseVaultMetadata(item.metadata);
                    return meta.kind === KEK_VERIFIER_KIND;
                });

                if (!verifierItem) {
                    throw new Error(
                        "No vault verifier found. Please unlock your vault at least once before setting up recovery.",
                    );
                }

                const meta = parseVaultMetadata(verifierItem.metadata);
                const saltB64 = typeof meta.salt === "string" ? meta.salt : "";
                if (!saltB64) {
                    throw new Error("Vault verifier is missing salt. Please re-unlock your vault.");
                }

                const { fromBase64 } = await import("../../../crypto");
                const salt = fromBase64(saltB64);
                if (salt.length < 16) {
                    throw new Error("Vault verifier salt has invalid length.");
                }

                const derived = await deriveMasterKey({
                    password: vaultPassphrase,
                    kdf,
                    salt,
                });

                const { decryptVaultItem } = await import("../../../crypto");
                try {
                    decryptVaultItem({
                        payload: {
                            version: "xchacha20poly1305-v1",
                            nonce: verifierItem.nonce,
                            ciphertext: verifierItem.ciphertext,
                            wrappedDek: verifierItem.wrapped_dek,
                            wrapNonce: verifierItem.wrap_nonce,
                        },
                        kek: derived.key,
                        aead,
                    });
                } catch {
                    derived.key.fill(0);
                    throw new Error("Incorrect vault passphrase. Please try again.");
                }

                const wrapped = await wrapKekForRecovery(derived.key, recoveryKey, aead);
                derived.key.fill(0);

                wrappedKekPayload = {
                    wrapped_kek: wrapped.wrappedKek,
                    wrap_nonce: wrapped.wrapNonce,
                    kek_salt: wrapped.kekSalt,
                };
            }

            await authService.setupRecovery({
                recovery_key: recoveryKey,
                ...wrappedKekPayload,
            });

            setConfirmed(true);
            setVaultPassphrase("");
            toast.success("Account recovery has been configured!");
        } catch (err) {
            if (err instanceof ApiError) {
                setError(err.message);
            } else if (err instanceof Error) {
                setError(err.message);
            } else {
                setError("Failed to configure recovery");
            }
        } finally {
            setSaving(false);
        }
    };

    if (isLoadingStatus) {
        return (
            <Wrapper>
                <Card>
                <div style={{ textAlign: "center", padding: "2rem" }}>
                    <div className="loading-spinner" style={{ margin: "0 auto 1rem auto", color: "var(--color-security-blue)" }}></div>
                    <p className="card-desc" style={{ marginBottom: 0 }}>Checking recovery status...</p>
                </div>
            </Card>
            </Wrapper>
        );
    }

    if (confirmed) {
        return (
            <Wrapper>
                <Card>
                <div style={{ textAlign: "center", padding: "1rem 0" }}>
                    <ShieldCheck
                        size={48}
                        style={{ color: "var(--color-success, #22c55e)", marginBottom: "1rem" }}
                    />
                    <h2 className="card-title">Recovery Configured</h2>
                    <p className="card-desc" style={{ maxWidth: "28rem", margin: "0.5rem auto 0" }}>
                        Your account recovery key has been saved. Store it securely — you'll need it if you forget
                        your master password.
                    </p>
                </div>
            </Card>
            </Wrapper>
        );
    }

    return (
        <Wrapper>
            <Card>
            <div style={{ marginBottom: "1.5rem" }}>
                <h2 className="card-title">Set Up Account Recovery</h2>
                <p className="card-desc" style={{ marginBottom: 0 }}>
                    Generate a recovery key that allows you to reset your master password while preserving your vault
                    data.
                </p>
            </div>

            {error && <div className="alert-error">{error}</div>}

            <div
                style={{
                    padding: "1rem",
                    borderRadius: "var(--radius-lg, 12px)",
                    background: "var(--color-warning-bg, rgba(234, 179, 8, 0.1))",
                    border: "1px solid var(--color-warning-border, rgba(234, 179, 8, 0.3))",
                    display: "flex",
                    gap: "0.75rem",
                    marginBottom: "1.5rem",
                    alignItems: "flex-start",
                }}
            >
                <AlertTriangle size={20} style={{ color: "var(--color-warning, #eab308)", flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontSize: "0.875rem", color: "var(--color-text-subtle)" }}>
                    <strong>Important:</strong> This key is shown only once. If you lose both your master password and
                    this recovery key, your vault data will be permanently unrecoverable.
                </div>
            </div>

            {!recoveryKey ? (
                <Button onClick={handleGenerate}>Generate Recovery Key</Button>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <div
                        style={{
                            fontFamily: "monospace",
                            fontSize: "1.1rem",
                            letterSpacing: "0.05em",
                            padding: "1.25rem",
                            borderRadius: "var(--radius-lg, 12px)",
                            background: "var(--color-surface-elevated, rgba(0, 0, 0, 0.03))",
                            border: "1px solid var(--color-border-subtle, rgba(0, 0, 0, 0.08))",
                            textAlign: "center",
                            wordBreak: "break-all",
                            lineHeight: 1.8,
                            userSelect: "all",
                            color: "var(--color-text-main, #0F172A)",
                        }}
                    >
                        {recoveryKey}
                    </div>

                    <div style={{ display: "flex", gap: "0.75rem" }}>
                        <Button
                            onClick={copyToClipboard}
                            variant="ghost"
                            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
                        >
                            <Copy size={16} /> Copy
                        </Button>
                        <Button
                            onClick={downloadAsFile}
                            variant="ghost"
                            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
                        >
                            <Download size={16} /> Download
                        </Button>
                    </div>

                    <div
                        style={{
                            padding: "1rem",
                            borderRadius: "var(--radius-lg, 12px)",
                            background: "var(--color-surface-elevated, rgba(0, 0, 0, 0.03))",
                            border: "1px solid var(--color-border-subtle, rgba(0, 0, 0, 0.08))",
                        }}
                    >
                        <Label htmlFor="vault-passphrase" style={{ marginBottom: "0.5rem", display: "block" }}>
                            Vault Passphrase (to protect your data during recovery)
                        </Label>
                        <p
                            style={{
                                fontSize: "0.8rem",
                                color: "var(--color-text-subtle)",
                                marginBottom: "0.5rem",
                                marginTop: 0,
                            }}
                        >
                            Your vault encryption key will be wrapped with this recovery key so your data can be
                            recovered if you forget your password.
                        </p>
                        <div className="input-wrapper">
                            <Input
                                id="vault-passphrase"
                                type={showPassphrase ? "text" : "password"}
                                autoComplete="off"
                                value={vaultPassphrase}
                                onChange={(e) => setVaultPassphrase(e.target.value)}
                                placeholder="Enter your vault passphrase"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassphrase(!showPassphrase)}
                                className="input-icon-btn"
                            >
                                {showPassphrase ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            padding: "0.75rem",
                            borderRadius: "var(--radius-lg, 12px)",
                            background: "var(--color-surface-elevated, rgba(0, 0, 0, 0.03))",
                        }}
                    >
                        <input
                            type="checkbox"
                            id="confirm-saved"
                            checked={saved}
                            onChange={(e) => setSaved(e.target.checked)}
                            style={{ width: "1rem", height: "1rem", accentColor: "var(--color-security-blue)" }}
                        />
                        <label htmlFor="confirm-saved" style={{ fontSize: "0.875rem", cursor: "pointer" }}>
                            I have saved my recovery key in a safe place
                        </label>
                    </div>

                    <Button onClick={handleConfirmSave} isLoading={saving} disabled={!saved || !vaultPassphrase.trim()}>
                        Activate Account Recovery
                    </Button>
                </div>
            )}
        </Card>
        </Wrapper>
    );
}
