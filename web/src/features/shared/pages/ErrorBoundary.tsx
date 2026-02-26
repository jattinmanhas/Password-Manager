import { useRouteError, Link } from "react-router-dom";
import { AlertOctagon } from "lucide-react";
import { Card } from "../../../components/ui/Card";

export function ErrorBoundary() {
    const error = useRouteError() as any;
    console.error(error);

    return (
        <div className="auth-layout">
            <div className="auth-container">
                <Card style={{ textAlign: "center", padding: "3rem 2rem" }}>
                    <div style={{ display: "flex", justifyContent: "center", marginBottom: "1rem", color: "var(--color-red)" }}>
                        <AlertOctagon size={48} />
                    </div>
                    <h1 className="card-title" style={{ marginBottom: "1rem" }}>Something went wrong</h1>
                    <p className="card-desc" style={{ marginBottom: "2rem" }}>
                        An unexpected error occurred. Our team has been notified.
                        <br />
                        <span style={{ fontSize: "0.75rem", color: "var(--color-text-light)", marginTop: "0.75rem", display: "inline-block", background: "var(--color-soft-gray)", padding: "0.5rem", borderRadius: "var(--radius-xl)" }}>
                            {error?.statusText || error?.message || "Unknown error"}
                        </span>
                    </p>
                    <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
                        <button
                            onClick={() => window.location.reload()}
                            className="btn btn-ghost"
                            style={{ width: "auto" }}
                        >
                            Try Again
                        </button>
                        <Link to="/" className="btn btn-primary" style={{ display: "inline-flex", width: "auto" }}>
                            Go Home
                        </Link>
                    </div>
                </Card>
            </div>
        </div>
    );
}
