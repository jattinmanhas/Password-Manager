import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Card } from "../../../components/ui/Card";

export function NotFound() {
    return (
        <div className="auth-layout">
            <div className="auth-container">
                <Card style={{ textAlign: "center", padding: "3rem 2rem" }}>
                    <div style={{ display: "flex", justifyContent: "center", marginBottom: "1rem", color: "var(--color-amber)" }}>
                        <AlertTriangle size={48} />
                    </div>
                    <h1 className="card-title" style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>404</h1>
                    <h2 className="card-title" style={{ marginBottom: "1rem" }}>Page Not Found</h2>
                    <p className="card-desc" style={{ marginBottom: "2rem" }}>
                        The page you are looking for doesn't exist or has been moved.
                    </p>
                    <Link to="/" className="btn btn-primary" style={{ display: "inline-flex", width: "auto" }}>
                        Return to Dashboard
                    </Link>
                </Card>
            </div>
        </div>
    );
}
