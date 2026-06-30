import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { Eye, EyeOff, KeyRound, AlertTriangle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "../../../app/providers/AuthProvider";
import { authService, ApiError } from "../services/auth.service";
import { masterPasswordSchema } from "../../../lib/validations/auth";
import { deriveAuthVerifier } from "../../../crypto/auth";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Label } from "../../../components/ui/Label";
import { guessDeviceName } from "../../../utils/device";

type Step = "request" | "verify" | "reset" | "done";

const emailSchema = z.object({
    email: z.string().min(1, "Email is required").email("Invalid email format"),
});
type EmailFormData = z.infer<typeof emailSchema>;

const codeSchema = z.object({
    code: z.string().length(6, "Code must be 6 digits").regex(/^\d+$/, "Code must be numeric"),
});
type CodeFormData = z.infer<typeof codeSchema>;

const resetSchema = z
    .object({
        newPassword: masterPasswordSchema,
        confirmPassword: z.string().min(1, "Please confirm your password"),
    })
    .refine((d) => d.newPassword === d.confirmPassword, {
        message: "Passwords do not match",
        path: ["confirmPassword"],
    });
type ResetFormData = z.infer<typeof resetSchema>;

export function ForgotPassword() {
    const navigate = useNavigate();
    const { setSessionRaw } = useAuth();

    const [step, setStep] = useState<Step>("request");
    const [email, setEmail] = useState("");
    const [resetToken, setResetToken] = useState("");
    const [apiError, setApiError] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const emailForm = useForm<EmailFormData>({ resolver: zodResolver(emailSchema), defaultValues: { email: "" } });
    const codeForm = useForm<CodeFormData>({ resolver: zodResolver(codeSchema), defaultValues: { code: "" } });
    const resetForm = useForm<ResetFormData>({
        resolver: zodResolver(resetSchema),
        defaultValues: { newPassword: "", confirmPassword: "" },
    });

    const onRequest = async (data: EmailFormData) => {
        setApiError("");
        setLoading(true);
        try {
            await authService.requestPasswordReset({ email: data.email });
            setEmail(data.email);
            setStep("verify");
        } catch (err) {
            setApiError(err instanceof Error ? err.message : "Failed to send reset email");
        } finally {
            setLoading(false);
        }
    };

    const onVerify = async (data: CodeFormData) => {
        setApiError("");
        setLoading(true);
        try {
            const res = await authService.verifyPasswordReset({ email, code: data.code });
            setResetToken(res.reset_token);
            setStep("reset");
        } catch (err) {
            if (err instanceof ApiError) setApiError(err.message);
            else setApiError(err instanceof Error ? err.message : "Invalid or expired code");
        } finally {
            setLoading(false);
        }
    };

    const onReset = async (data: ResetFormData) => {
        setApiError("");
        setLoading(true);
        try {
            // Server is zero-knowledge: it stores the derived verifier, never the password.
            const verifier = await deriveAuthVerifier(email, data.newPassword);
            const res = await authService.confirmPasswordReset({
                reset_token: resetToken,
                new_password: verifier,
                device_name: guessDeviceName(),
            });
            // A fresh session is issued; the old (now-wiped) vault is gone.
            setSessionRaw({
                userId: res.user_id,
                expiresAt: res.expires_at,
                email: res.email,
                name: res.name,
                isTotpEnabled: res.is_totp_enabled,
            });
            setStep("done");
            toast.success("Password reset successfully");
        } catch (err) {
            if (err instanceof ApiError) setApiError(err.message);
            else setApiError(err instanceof Error ? err.message : "Failed to reset password");
        } finally {
            setLoading(false);
        }
    };

    if (step === "done") {
        return (
            <Card>
                <div style={{ textAlign: "center", padding: "1rem 0" }}>
                    <KeyRound size={48} style={{ color: "var(--color-success, #22c55e)", marginBottom: "1rem" }} />
                    <h2 className="card-title">Password Reset Complete</h2>
                    <p className="card-desc" style={{ maxWidth: "28rem", margin: "0.5rem auto 1.5rem" }}>
                        Your master password has been changed. Because your vault was encrypted with your old
                        password, it could not be recovered and has been cleared — you can start adding items again.
                    </p>
                    <Button onClick={() => navigate("/", { replace: true })}>Go to Vault</Button>
                </div>
            </Card>
        );
    }

    return (
        <Card>
            <div style={{ marginBottom: "1.5rem" }}>
                <h2 className="card-title">Reset your password</h2>
                <p className="card-desc" style={{ marginBottom: 0 }}>
                    {step === "request" && "Enter your email and we'll send you a verification code."}
                    {step === "verify" && `Enter the 6-digit code we sent to ${email}.`}
                    {step === "reset" && "Choose a new master password."}
                </p>
            </div>

            {apiError && <div className="alert-error">{apiError}</div>}

            {step === "request" && (
                <form onSubmit={emailForm.handleSubmit(onRequest)} className="form-stack">
                    <div className="form-group">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="name@example.com"
                            autoComplete="email"
                            {...emailForm.register("email")}
                            error={emailForm.formState.errors.email?.message}
                        />
                    </div>
                    <Button type="submit" isLoading={loading}>Send code</Button>
                </form>
            )}

            {step === "verify" && (
                <form onSubmit={codeForm.handleSubmit(onVerify)} className="form-stack">
                    <div className="form-group">
                        <Label htmlFor="code">Verification code</Label>
                        <Input
                            id="code"
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            placeholder="000000"
                            {...codeForm.register("code")}
                            error={codeForm.formState.errors.code?.message}
                        />
                    </div>
                    <Button type="submit" isLoading={loading}>Verify code</Button>
                </form>
            )}

            {step === "reset" && (
                <>
                    <div
                        style={{
                            display: "flex",
                            gap: "0.5rem",
                            padding: "0.75rem 1rem",
                            borderRadius: "var(--radius-lg, 12px)",
                            background: "rgba(245, 158, 11, 0.08)",
                            border: "1px solid rgba(245, 158, 11, 0.25)",
                            marginBottom: "1rem",
                            fontSize: "0.85rem",
                            color: "var(--color-text-subtle)",
                        }}
                    >
                        <AlertTriangle size={18} style={{ flexShrink: 0, color: "#f59e0b" }} />
                        <span>
                            Resetting your password clears your existing vault — it's encrypted with your old password
                            and can't be recovered. You'll start fresh.
                        </span>
                    </div>
                    <form onSubmit={resetForm.handleSubmit(onReset)} className="form-stack">
                        <div className="form-group">
                            <Label htmlFor="newPassword">New master password</Label>
                            <div className="input-wrapper">
                                <Input
                                    id="newPassword"
                                    type={showPassword ? "text" : "password"}
                                    autoComplete="new-password"
                                    {...resetForm.register("newPassword")}
                                    error={resetForm.formState.errors.newPassword?.message}
                                />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="input-icon-btn" tabIndex={-1}>
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>
                        <div className="form-group">
                            <Label htmlFor="confirmPassword">Confirm new password</Label>
                            <Input
                                id="confirmPassword"
                                type={showPassword ? "text" : "password"}
                                autoComplete="new-password"
                                {...resetForm.register("confirmPassword")}
                                error={resetForm.formState.errors.confirmPassword?.message}
                            />
                        </div>
                        <Button type="submit" isLoading={loading}>Reset password</Button>
                    </form>
                </>
            )}

            <div style={{ marginTop: "1.5rem", textAlign: "center", fontSize: "0.875rem" }}>
                <Link to="/login" style={{ fontWeight: 500 }}>Back to sign in</Link>
            </div>
        </Card>
    );
}
