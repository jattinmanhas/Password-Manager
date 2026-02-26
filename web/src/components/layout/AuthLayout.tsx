import { Outlet } from "react-router-dom";
import { Shield } from "lucide-react";

export function AuthLayout() {
    return (
        <div className="auth-layout">
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
