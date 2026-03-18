import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "../../../app/providers/AuthProvider";
import { ApiError } from "../services/auth.service";
import { loginSchema, type LoginFormData, totpSetupSchema } from "../../../lib/validations/auth";
import { z } from "zod";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Label } from "../../../components/ui/Label";
import { Card } from "../../../components/ui/Card";
import { guessDeviceName } from "../../../utils/device";

export function Login() {
    const { login } = useAuth();
    const navigate = useNavigate();

    const loginForm = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
        defaultValues: { email: "", password: "" }
    });

    const [showPassword, setShowPassword] = useState(false);
    const [mfaStep, setMfaStep] = useState(false);
    const [mfaType, setMfaType] = useState<"totp" | "recovery">("totp");
    
    // Quick resolver for MFA depending on type
    const mfaSchema = z.object({
        code: mfaType === "totp" 
            ? z.string().length(6, "Code must be 6 digits").regex(/^\d+$/, "Code must be numeric")
            : z.string().min(1, "Recovery code is required")
    });

    const mfaForm = useForm<{ code: string }>({
        resolver: zodResolver(mfaSchema),
        defaultValues: { code: "" }
    });

    const [apiError, setApiError] = useState("");
    const [loading, setLoading] = useState(false);

    const onLoginSubmit = async (data: LoginFormData) => {
        setApiError("");
        setLoading(true);

        try {
            await login({
                email: data.email,
                password: data.password,
                device_name: guessDeviceName(),
            });
            navigate("/", { replace: true });
        } catch (err) {
            handleLoginError(err);
        } finally {
            setLoading(false);
        }
    };

    const onMfaSubmit = async (data: { code: string }) => {
        setApiError("");
        setLoading(true);

        try {
            const loginData = loginForm.getValues();
            await login({
                email: loginData.email,
                password: loginData.password,
                device_name: guessDeviceName(),
                [mfaType === "totp" ? "totp_code" : "recovery_code"]: data.code,
            });
            navigate("/", { replace: true });
        } catch (err) {
            handleLoginError(err);
        } finally {
            setLoading(false);
        }
    };

    const handleLoginError = (err: unknown) => {
        if (err instanceof ApiError && err.code === "mfa_required") {
            setMfaStep(true);
        } else if (err instanceof ApiError) {
            setApiError(err.message);
        } else if (err instanceof Error) {
            setApiError(err.message);
        } else {
            setApiError("An unexpected error occurred.");
        }
    };

    if (mfaStep) {
        return (
            <Card>
                <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
                    <h2 className="card-title">Two-Step Verification</h2>
                    <p className="card-desc" style={{ marginBottom: 0 }}>
                        Enter the {mfaType === "totp" ? "6-digit code from your authenticator app" : "recovery code"} to continue.
                    </p>
                </div>

                {apiError && <div className="alert-error">{apiError}</div>}

                <form onSubmit={mfaForm.handleSubmit(onMfaSubmit)} className="form-stack">
                    <div className="form-group">
                        <Label htmlFor="code">{mfaType === "totp" ? "Authentication Code" : "Recovery Code"}</Label>
                        <Input
                            id="code"
                            type="text"
                            autoComplete="one-time-code"
                            {...mfaForm.register("code")}
                            error={mfaForm.formState.errors.code?.message || (!!apiError ? apiError : false)}
                            placeholder={mfaType === "totp" ? "000000" : ""}
                        />
                    </div>

                    <Button type="submit" isLoading={loading}>
                        Verify
                    </Button>

                    <div style={{ textAlign: "center", marginTop: "1rem" }}>
                        <button
                            type="button"
                            style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--color-security-blue)" }}
                            onClick={() => {
                                setMfaType(mfaType === "totp" ? "recovery" : "totp");
                                mfaForm.reset();
                                setApiError("");
                            }}
                        >
                            Use a {mfaType === "totp" ? "recovery code" : "authenticator app"} instead
                        </button>
                    </div>
                    <div style={{ textAlign: "center", marginTop: "0.5rem" }}>
                        <button
                            type="button"
                            style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--color-text-subtle)" }}
                            onClick={() => {
                                setMfaStep(false);
                                mfaForm.reset();
                                setApiError("");
                            }}
                        >
                            Back to login
                        </button>
                    </div>
                </form>
            </Card>
        );
    }

    return (
        <Card>
            <div style={{ marginBottom: "1.5rem" }}>
                <h2 className="card-title">Welcome back</h2>
                <p className="card-desc" style={{ marginBottom: 0 }}>Enter your credentials to access your vault</p>
            </div>

            {apiError && <div className="alert-error">{apiError}</div>}

            <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="form-stack">
                <div className="form-group">
                    <Label htmlFor="email">Email</Label>
                    <Input
                        id="email"
                        type="email"
                        placeholder="name@example.com"
                        autoComplete="email"
                        {...loginForm.register("email")}
                        error={loginForm.formState.errors.email?.message}
                    />
                </div>

                <div className="form-group">
                    <div className="form-row">
                        <Label htmlFor="password">Password</Label>
                        <Link to="/recover" style={{ fontSize: "0.875rem", color: "var(--color-text-subtle)" }}>
                            Forgot password?
                        </Link>
                    </div>
                    <div className="input-wrapper">
                        <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            autoComplete="current-password"
                            {...loginForm.register("password")}
                            error={loginForm.formState.errors.password?.message}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="input-icon-btn"
                        >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>
                </div>

                <div className="checkbox-row">
                    <input
                        type="checkbox"
                        id="remember"
                        style={{ width: "1rem", height: "1rem", accentColor: "var(--color-security-blue)" }}
                    />
                    <Label htmlFor="remember" style={{ cursor: "pointer" }}>
                        Remember me
                    </Label>
                </div>

                <Button type="submit" isLoading={loading}>
                    Sign in
                </Button>
            </form>

            <div style={{ marginTop: "1.5rem", textAlign: "center", fontSize: "0.875rem" }}>
                <span style={{ color: "var(--color-text-subtle)" }}>Don't have an account? </span>
                <Link to="/register" style={{ fontWeight: 500 }}>
                    Create an account
                </Link>
            </div>
        </Card>
    );
}
