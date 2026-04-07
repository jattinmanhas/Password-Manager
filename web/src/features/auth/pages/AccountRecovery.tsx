import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import toast from "react-hot-toast";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { accountRecoverySchema, totpSetupSchema, type TotpSetupFormData } from "../../../lib/validations/auth";
import { useAuth } from "../../../app/providers/AuthProvider";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Label } from "../../../components/ui/Label";
import { PasswordStrengthMeter } from "../components/PasswordStrengthMeter";
import { authService, ApiError } from "../services/auth.service";
import type { RecoveryVerifyResponse } from "../types";
import {
    randomBytes,
    toBase64,
    fromBase64,
    utf8ToBytes,
    encryptVaultItem,
} from "../../../crypto";
import {
    createDefaultXChaCha20Poly1305,
} from "../../../crypto/adapters";
import { vaultService } from "../../vault/services/vault.service";
import { deriveMasterKeyWithWorker } from "../../../crypto/worker-client";

type Step = "verify" | "totp" | "reset" | "done";

const MASTER_KEY_SALT_LENGTH = 16;
const KEK_WRAP_AAD = "pmv2:recovery-kek-wrap:v1";
const KEK_VERIFIER_KIND = "kek-verifier";
const KEK_VERIFIER_TOKEN = "pmv2-kek-verifier-v1";

function parseVaultMetadata(metadata: unknown): Record<string, unknown> {
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
        return {};
    }
    return metadata as Record<string, unknown>;
}

const verifySchema = accountRecoverySchema.extend({
    email: z.string().min(1, "Email is required").email("Invalid email format"),
});
type VerifyFormData = z.infer<typeof verifySchema>;

const resetPasswordSchema = z.object({
    newPassword: z.string().min(8, "Password must be at least 8 characters long"),
    confirmPassword: z.string().min(1, "Please confirm your password")
}).refine(data => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"]
});
type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export function AccountRecovery() {
    const navigate = useNavigate();
    const { setSessionRaw } = useAuth();

    const [step, setStep] = useState<Step>("verify");
    const [recoveryToken, setRecoveryToken] = useState("");
    const [verifyResponse, setVerifyResponse] = useState<RecoveryVerifyResponse | null>(null);

    const verifyForm = useForm<VerifyFormData>({
        resolver: zodResolver(verifySchema),
        defaultValues: { email: "", recoveryKey: "" }
    });

    const totpForm = useForm<TotpSetupFormData>({
        resolver: zodResolver(totpSetupSchema),
        defaultValues: { code: "" }
    });

    const resetForm = useForm<ResetPasswordFormData>({
        resolver: zodResolver(resetPasswordSchema),
        defaultValues: { newPassword: "", confirmPassword: "" }
    });

    const [showPassword, setShowPassword] = useState(false);
    const [apiError, setApiError] = useState("");
    const [loading, setLoading] = useState(false);

    const onVerifySubmit = async (data: VerifyFormData) => {
        setApiError("");
        setLoading(true);

        try {
            const resp = await authService.verifyRecovery({
                email: data.email,
                recovery_key: data.recoveryKey,
                totp_code: undefined,
            });
            setRecoveryToken(resp.recovery_token);
            setVerifyResponse(resp);
            setStep("reset");
            toast.success("Identity verified! Set your new password.");
        } catch (err) {
            handleVerifyError(err);
        } finally {
            setLoading(false);
        }
    };

    const onTotpSubmit = async (data: TotpSetupFormData) => {
        setApiError("");
        setLoading(true);

        try {
            const verifyData = verifyForm.getValues();
            const resp = await authService.verifyRecovery({
                email: verifyData.email,
                recovery_key: verifyData.recoveryKey,
                totp_code: data.code,
            });
            setRecoveryToken(resp.recovery_token);
            setVerifyResponse(resp);
            setStep("reset");
            toast.success("Identity verified! Set your new password.");
        } catch (err) {
            handleVerifyError(err);
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyError = (err: unknown) => {
        if (err instanceof ApiError) {
            if (err.code === "mfa_required") {
                setStep("totp");
                setApiError("");
            } else {
                setApiError(err.message);
            }
        } else if (err instanceof Error) {
            setApiError(err.message);
        } else {
            setApiError("Recovery verification failed");
        }
    };

    const onResetSubmit = async (data: ResetPasswordFormData) => {
        setApiError("");
        setLoading(true);

        try {
            const res = await authService.resetPassword({
                recovery_token: recoveryToken,
                new_password: data.newPassword,
            });

            // Update local session so vault re-encryption is authenticated
            setSessionRaw({
                userId: res.user_id,
                expiresAt: res.expires_at,
                email: res.email,
                name: res.name,
                isTotpEnabled: res.is_totp_enabled,
            });

            // If we have a wrapped KEK from the server, unwrap it with the recovery key
            // and re-encrypt the verifier with the new password-derived KEK
            if (verifyResponse?.wrapped_kek && verifyResponse.wrap_nonce && verifyResponse.kek_salt) {
                try {
                    await reEncryptVaultForNewPassword(
                        verifyForm.getValues("recoveryKey"),
                        data.newPassword,
                        verifyResponse.wrapped_kek,
                        verifyResponse.wrap_nonce,
                        verifyResponse.kek_salt,
                    );
                    toast.success("Vault data has been preserved!");
                } catch (reEncryptErr) {
                    console.error("Failed to re-encrypt vault:", reEncryptErr);
                    toast.error(
                        "Password was reset but vault data could not be re-encrypted. You may need to re-unlock your vault.",
                    );
                }
            }

            setStep("done");
            toast.success("Password reset successful!");
        } catch (err) {
            if (err instanceof ApiError) {
                setApiError(err.message);
            } else if (err instanceof Error) {
                setApiError(err.message);
            } else {
                setApiError("Failed to reset password");
            }
        } finally {
            setLoading(false);
        }
    };

    if (step === "done") {
        return (
            <Card>
                <div style={{ textAlign: "center", padding: "1rem 0" }}>
                    <KeyRound
                        size={48}
                        style={{ color: "var(--color-success, #22c55e)", marginBottom: "1rem" }}
                    />
                    <h2 className="card-title">Password Reset Complete</h2>
                    <p className="card-desc" style={{ maxWidth: "28rem", margin: "0.5rem auto 1.5rem" }}>
                        Your password has been changed and all existing sessions have been revoked.
                        {verifyResponse?.wrapped_kek
                            ? " Your vault data has been preserved and will be accessible with your new password."
                            : " You can now log in with your new password."}
                    </p>
                    <Button onClick={() => navigate("/login", { replace: true })}>
                        Go to Login
                    </Button>
                </div>
            </Card>
        );
    }

    if (step === "reset") {
        return (
            <Card>
                <div style={{ marginBottom: "1.5rem" }}>
                    <h2 className="card-title">Set New Password</h2>
                    <p className="card-desc" style={{ marginBottom: 0 }}>
                        Choose a strong new master password for your account.
                    </p>
                </div>

                {verifyResponse?.wrapped_kek && (
                    <div
                        style={{
                            padding: "0.75rem 1rem",
                            borderRadius: "var(--radius-lg, 12px)",
                            background: "rgba(34, 197, 94, 0.08)",
                            border: "1px solid rgba(34, 197, 94, 0.2)",
                            marginBottom: "1rem",
                            fontSize: "0.875rem",
                            color: "var(--color-text-subtle)",
                        }}
                    >
                        ✓ Your vault encryption key was found. Your data will be preserved after the password reset.
                    </div>
                )}

                {apiError && <div className="alert-error">{apiError}</div>}

                <form onSubmit={resetForm.handleSubmit(onResetSubmit)} className="form-stack">
                    <div className="form-group">
                        <Label htmlFor="new-password">New Password</Label>
                        <div className="input-wrapper">
                            <Input
                                id="new-password"
                                type={showPassword ? "text" : "password"}
                                autoComplete="new-password"
                                {...resetForm.register("newPassword")}
                                error={resetForm.formState.errors.newPassword?.message}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="input-icon-btn"
                            >
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                        <PasswordStrengthMeter password={resetForm.watch("newPassword") || ""} />
                    </div>

                    <div className="form-group">
                        <Label htmlFor="confirm-password">Confirm Password</Label>
                        <Input
                            id="confirm-password"
                            type={showPassword ? "text" : "password"}
                            autoComplete="new-password"
                            {...resetForm.register("confirmPassword")}
                            error={resetForm.formState.errors.confirmPassword?.message}
                        />
                    </div>

                    <Button type="submit" isLoading={loading}>
                        Reset Password
                    </Button>
                </form>
            </Card>
        );
    }

    return (
        <Card>
            <div style={{ marginBottom: "1.5rem" }}>
                <h2 className="card-title">Account Recovery</h2>
                <p className="card-desc" style={{ marginBottom: 0 }}>
                    {step === "totp"
                        ? "Enter your authenticator code to continue the recovery."
                        : "Enter your email and recovery key to regain access to your account."}
                </p>
            </div>

            {apiError && <div className="alert-error">{apiError}</div>}

            {step === "verify" && (
                <form onSubmit={verifyForm.handleSubmit(onVerifySubmit)} className="form-stack">
                    <div className="form-group">
                        <Label htmlFor="recovery-email">Email</Label>
                        <Input
                            id="recovery-email"
                            type="email"
                            placeholder="name@example.com"
                            autoComplete="email"
                            {...verifyForm.register("email")}
                            error={verifyForm.formState.errors.email?.message}
                        />
                    </div>

                    <div className="form-group">
                        <Label htmlFor="recovery-key">Recovery Key</Label>
                        <Input
                            id="recovery-key"
                            type="text"
                            placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"
                            autoComplete="off"
                            {...verifyForm.register("recoveryKey")}
                            error={verifyForm.formState.errors.recoveryKey?.message}
                            style={{ fontFamily: "monospace", letterSpacing: "0.05em" }}
                        />
                    </div>

                    <Button type="submit" isLoading={loading}>
                        Verify Recovery Key
                    </Button>
                </form>
            )}

            {step === "totp" && (
                <form onSubmit={totpForm.handleSubmit(onTotpSubmit)} className="form-stack">
                    <div className="form-group">
                        <Label htmlFor="totp-code">Authentication Code</Label>
                        <Controller
                            name="code"
                            control={totpForm.control}
                            render={({ field }) => (
                                <Input
                                    id="totp-code"
                                    type="text"
                                    autoComplete="one-time-code"
                                    maxLength={6}
                                    {...field}
                                    onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ''))}
                                    placeholder="000000"
                                    disabled={loading}
                                    error={totpForm.formState.errors.code?.message}
                                />
                            )}
                        />
                    </div>
                    
                    <Button type="submit" isLoading={loading}>
                        Verify & Continue
                    </Button>

                    <div style={{ textAlign: "center", marginTop: "0.5rem" }}>
                        <button
                            type="button"
                            style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--color-text-subtle)" }}
                            onClick={() => {
                                setStep("verify");
                                totpForm.reset();
                                setApiError("");
                            }}
                        >
                            Back
                        </button>
                    </div>
                </form>
            )}

            <div style={{ marginTop: "1.5rem", textAlign: "center", fontSize: "0.875rem" }}>
                <span style={{ color: "var(--color-text-subtle)" }}>Remember your password? </span>
                <Link to="/login" style={{ fontWeight: 500 }}>
                    Sign in
                </Link>
            </div>
        </Card>
    );
}

/**
 * Unwraps the KEK using the recovery key, then re-encrypts the verifier item
 * with a new KEK derived from the new password. This preserves vault data
 * across password resets.
 */
async function reEncryptVaultForNewPassword(
    recoveryKey: string,
    newPassword: string,
    wrappedKekB64: string,
    wrapNonceB64: string,
    kekSaltB64: string,
): Promise<void> {
    const aead = await createDefaultXChaCha20Poly1305();

    // 1. Derive the recovery wrapping key from the recovery key + stored salt
    const recoveryKekSalt = fromBase64(kekSaltB64);
    const recoveryDerived = await deriveMasterKeyWithWorker({
        password: recoveryKey,
        salt: recoveryKekSalt,
    });

    // 2. Unwrap (decrypt) the original KEK
    const wrappedKek = fromBase64(wrappedKekB64);
    const wrapNonce = fromBase64(wrapNonceB64);

    const originalKek = aead.decrypt({
        key: recoveryDerived.key,
        nonce: wrapNonce,
        ciphertext: wrappedKek,
        associatedData: utf8ToBytes(KEK_WRAP_AAD),
    });
    recoveryDerived.key.fill(0);

    // 3. Derive the new KEK from the new password
    const newSalt = randomBytes(MASTER_KEY_SALT_LENGTH);
    const newDerived = await deriveMasterKeyWithWorker({
        password: newPassword,
        salt: newSalt,
    });

    // 4. Find and update the verifier item with the new KEK
    try {
        const listedItems = await vaultService.listItems();
        const verifierItem = listedItems.items.find((item) => {
            const meta = parseVaultMetadata(item.metadata);
            return meta.kind === KEK_VERIFIER_KIND;
        });

        if (verifierItem) {
            // Re-encrypt the verifier token with the new KEK
            const payload = encryptVaultItem({
                plaintext: KEK_VERIFIER_TOKEN,
                kek: newDerived.key,
                aead,
            });

            await vaultService.updateItem(verifierItem.id, {
                ciphertext: payload.ciphertext,
                nonce: payload.nonce,
                wrapped_dek: payload.wrappedDek,
                wrap_nonce: payload.wrapNonce,
                algo_version: payload.version,
                metadata: {
                    kind: KEK_VERIFIER_KIND,
                    salt: toBase64(newSalt),
                },
            });
        }

        // 5. Re-encrypt all vault items with the new KEK
        const dataItems = listedItems.items.filter((item) => {
            const meta = parseVaultMetadata(item.metadata);
            return meta.kind !== KEK_VERIFIER_KIND;
        });

        for (const item of dataItems) {
            try {
                // Decrypt with the old KEK
                const { decryptVaultItem } = await import("../../../crypto");
                const plaintext = decryptVaultItem({
                    payload: {
                        version: "xchacha20poly1305-v1",
                        nonce: item.nonce,
                        ciphertext: item.ciphertext,
                        wrappedDek: item.wrapped_dek,
                        wrapNonce: item.wrap_nonce,
                    },
                    kek: originalKek,
                    aead,
                });

                // Re-encrypt with the new KEK
                const newPayload = encryptVaultItem({
                    plaintext,
                    kek: newDerived.key,
                    aead,
                });

                await vaultService.updateItem(item.id, {
                    ciphertext: newPayload.ciphertext,
                    nonce: newPayload.nonce,
                    wrapped_dek: newPayload.wrappedDek,
                    wrap_nonce: newPayload.wrapNonce,
                    algo_version: newPayload.version,
                    metadata: item.metadata,
                });
            } catch {
                // Skip items that can't be decrypted (already corrupted)
                console.warn(`Could not re-encrypt vault item ${item.id}, skipping`);
            }
        }
    } finally {
        originalKek.fill(0);
        newDerived.key.fill(0);
    }
}
