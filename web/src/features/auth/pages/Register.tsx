import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { Eye, EyeOff } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "../../../app/providers/AuthProvider";
import { ApiError } from "../services/auth.service";
import { registerSchema, type RegisterFormData } from "../../../lib/validations/auth";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Label } from "../../../components/ui/Label";
import { Card } from "../../../components/ui/Card";
import { PasswordStrengthMeter } from "../components/PasswordStrengthMeter";

export function Register() {
    const { register } = useAuth();
    const navigate = useNavigate();

    const registerForm = useForm<RegisterFormData>({
        resolver: zodResolver(registerSchema),
        defaultValues: { name: "", email: "", password: "", confirmPassword: "" }
    });

    const [showPassword, setShowPassword] = useState(false);
    const [apiError, setApiError] = useState("");
    const [loading, setLoading] = useState(false);

    const onSubmitForm = async (data: RegisterFormData) => {
        setApiError("");
        setLoading(true);
        try {
            await register({ email: data.email, password: data.password, name: data.name });
            toast.success("Account created successfully!");
            navigate("/login", { replace: true });
        } catch (err) {
            if (err instanceof ApiError) {
                setApiError(err.message);
            } else if (err instanceof Error) {
                setApiError(err.message);
            } else {
                setApiError("An unexpected error occurred.");
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

            {apiError && <div className="alert-error">{apiError}</div>}

            <form onSubmit={registerForm.handleSubmit(onSubmitForm)} className="form-stack">
                <div className="form-group">
                    <Label htmlFor="name">Full Name (Optional)</Label>
                    <Input
                        id="name"
                        type="text"
                        placeholder="John Doe"
                        autoComplete="name"
                        {...registerForm.register("name")}
                        error={registerForm.formState.errors.name?.message}
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
                        {...registerForm.register("email")}
                        error={registerForm.formState.errors.email?.message}
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
                            {...registerForm.register("password")}
                            error={registerForm.formState.errors.password?.message}
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
                    <PasswordStrengthMeter password={registerForm.watch("password") || ""} />
                </div>

                <div className="form-group" style={{ paddingTop: "0.25rem" }}>
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <Input
                        id="confirmPassword"
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        {...registerForm.register("confirmPassword")}
                        error={registerForm.formState.errors.confirmPassword?.message}
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
