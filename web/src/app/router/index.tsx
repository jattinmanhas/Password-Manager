import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import { AuthLayout } from "../../components/layout/AuthLayout";
import { Login } from "../../features/auth/pages/Login";
import { Register } from "../../features/auth/pages/Register";
import { useAuth } from "../providers/AuthProvider";
import { NotFound } from "../../features/shared/pages/NotFound";
import { ErrorBoundary } from "../../features/shared/pages/ErrorBoundary";

const GuardedRoute = ({ children }: { children: React.ReactNode }) => {
    const { session, isLoading } = useAuth();
    if (isLoading) return <div>Loading...</div>;
    if (!session) return <Navigate to="/login" replace />;
    return <>{children}</>;
};

const PublicOnlyRoute = ({ children }: { children: React.ReactNode }) => {
    const { session, isLoading } = useAuth();
    if (isLoading) return <div>Loading...</div>;
    if (session) return <Navigate to="/" replace />;
    return <>{children}</>;
};

const DashboardPlaceholder = () => {
    const { session, logout } = useAuth();
    return (
        <div style={{ minHeight: "100vh", backgroundColor: "var(--color-soft-gray)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem", textAlign: "center" }}>
            <h1 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "1rem" }}>Authenticated Vault</h1>
            <p style={{ marginBottom: "1rem", color: "var(--color-text-subtle)", fontFamily: "monospace", fontSize: "0.875rem", maxWidth: "28rem", wordBreak: "break-all" }}>
                Token: {session?.token}
            </p>
            <button
                onClick={logout}
                className="btn"
                style={{ backgroundColor: "var(--color-border)", color: "var(--color-text-main)", maxWidth: "10rem" }}
            >
                Sign Out
            </button>
        </div>
    );
};

const router = createBrowserRouter([
    {
        errorElement: <ErrorBoundary />,
        children: [
            {
                path: "/",
                element: (
                    <GuardedRoute>
                        <DashboardPlaceholder />
                    </GuardedRoute>
                ),
            },
            {
                element: (
                    <PublicOnlyRoute>
                        <AuthLayout />
                    </PublicOnlyRoute>
                ),
                children: [
                    {
                        path: "/login",
                        element: <Login />,
                    },
                    {
                        path: "/register",
                        element: <Register />,
                    },
                ],
            },
            {
                path: "*",
                element: <NotFound />
            },
        ],
    },
]);

export function AppRouter() {
    return <RouterProvider router={router} />;
}
