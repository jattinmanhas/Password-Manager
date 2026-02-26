import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../../../app/providers/AuthProvider";
import { ApiError } from "../services/auth.service";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Label } from "../../../components/ui/Label";
import { Card } from "../../../components/ui/Card";
import { guessDeviceName } from "../../../utils/device";

export function Login() {
    const { login } = useAuth();
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const [mfaStep, setMfaStep] = useState(false);
    const [mfaType, setMfaType] = useState<"totp" | "recovery">("totp");
    const [mfaCode, setMfaCode] = useState("");

    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            await login({
                email,
                password,
                device_name: guessDeviceName(),
                ...(mfaStep && {
                    [mfaType === "totp" ? "totp_code" : "recovery_code"]: mfaCode,
                }),
            });
            navigate("/", { replace: true });
        } catch (err) {
            if (err instanceof ApiError && err.code === "mfa_required") {
                setMfaStep(true);
            } else if (err instanceof ApiError) {
                setError(err.message);
            } else if (err instanceof Error) {
                setError(err.message);
            } else {
                setError("An unexpected error occurred.");
            }
        } finally {
            setLoading(false);
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

                {error && <div className="alert-error">{error}</div>}

                <form onSubmit={handleSubmit} className="form-stack">
                    <div className="form-group">
                        <Label htmlFor="code">{mfaType === "totp" ? "Authentication Code" : "Recovery Code"}</Label>
                        <Input
                            id="code"
                            type="text"
                            autoComplete="one-time-code"
                            required
                            value={mfaCode}
                            onChange={(e) => setMfaCode(e.target.value)}
                            error={!!error}
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
                            onClick={() => setMfaType(mfaType === "totp" ? "recovery" : "totp")}
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
                                setMfaCode("");
                                setError("");
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

            {error && <div className="alert-error">{error}</div>}

            <form onSubmit={handleSubmit} className="form-stack">
                <div className="form-group">
                    <Label htmlFor="email">Email</Label>
                    <Input
                        id="email"
                        type="email"
                        placeholder="name@example.com"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        error={!!error}
                    />
                </div>

                <div className="form-group">
                    <div className="form-row">
                        <Label htmlFor="password">Password</Label>
                        <Link to="/forgot-password" style={{ fontSize: "0.875rem", fontWeight: 500 }}>
                            Forgot password?
                        </Link>
                    </div>
                    <div className="input-wrapper">
                        <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            autoComplete="current-password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            error={!!error}
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
