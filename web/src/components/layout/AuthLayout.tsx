import { Outlet } from "react-router-dom";
import { Shield } from "lucide-react";
import { ThemeToggle } from "../ui/ThemeToggle";

export function AuthLayout() {
    return (
        <div className="auth-layout" style={{ position: "relative" }}>
            <div style={{ position: "absolute", top: "1rem", right: "1rem" }}>
                <ThemeToggle />
            </div>
            <div className="auth-container">
                <div className="auth-header">
                    <div className="auth-logo">
                        <Shield size={28} />
                    </div>
                    <h1 className="auth-title">Family Vault</h1>
                    <p className="auth-subtitle">Secure your family's digital life</p>
                </div>
                <Outlet />
            </div>
        </div>
    );
}
