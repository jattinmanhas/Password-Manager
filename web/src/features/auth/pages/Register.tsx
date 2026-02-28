import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../../../app/providers/AuthProvider";
import { ApiError } from "../services/auth.service";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Label } from "../../../components/ui/Label";
import { Card } from "../../../components/ui/Card";
import { PasswordStrengthMeter } from "../components/PasswordStrengthMeter";

export function Register() {
    const { register } = useAuth();
    const navigate = useNavigate();

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        setLoading(true);
        try {
            await register({ email, password, name });
            toast.success("Account created successfully!");
            navigate("/login", { replace: true });
        } catch (err) {
            if (err instanceof ApiError) {
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

    return (
        <Card>
            <div style={{ marginBottom: "1.5rem" }}>
                <h2 className="card-title">Create an account</h2>
                <p className="card-desc" style={{ marginBottom: 0 }}>Sign up to get started with Family Vault</p>
            </div>

            {error && <div className="alert-error">{error}</div>}

            <form onSubmit={handleSubmit} className="form-stack">
                <div className="form-group">
                    <Label htmlFor="name">Full Name (Optional)</Label>
                    <Input
                        id="name"
                        type="text"
                        placeholder="John Doe"
                        autoComplete="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={loading}
                    />
                </div>

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
                        error={!!error && !password}
                        disabled={loading}
                    />
                </div>

                <div className="form-group">
                    <Label htmlFor="password">Password</Label>
                    <div className="input-wrapper">
                        <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            autoComplete="new-password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            error={!!error && !!password}
                            disabled={loading}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="input-icon-btn"
                            tabIndex={-1}
                        >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>
                    <PasswordStrengthMeter password={password} />
                </div>

                <div className="form-group" style={{ paddingTop: "0.25rem" }}>
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <Input
                        id="confirmPassword"
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        error={!!error && confirmPassword !== password && confirmPassword.length > 0}
                        disabled={loading}
                    />
                </div>

                <div style={{ paddingTop: "0.5rem" }}>
                    <Button type="submit" isLoading={loading}>
                        Create Account
                    </Button>
                </div>
            </form>

            <div style={{ marginTop: "1.5rem", textAlign: "center", fontSize: "0.875rem" }}>
                <span style={{ color: "var(--color-text-subtle)" }}>Already have an account? </span>
                <Link to="/login" style={{ fontWeight: 500 }}>
                    Sign in
                </Link>
            </div>
        </Card>
    );
}
