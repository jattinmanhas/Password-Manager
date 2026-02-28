import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import { AuthLayout } from "../../components/layout/AuthLayout";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { Login } from "../../features/auth/pages/Login";
import { Register } from "../../features/auth/pages/Register";
import { TOTPSetup } from "../../features/auth/pages/TOTPSetup";
import { Dashboard } from "../../features/dashboard/pages/Dashboard";
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
    if (session) return <Navigate to="/dashboard" replace />;
    return <>{children}</>;
};

const router = createBrowserRouter([
    {
        errorElement: <ErrorBoundary />,
        children: [
            {
                path: "/",
                element: <Navigate to="/dashboard" replace />
            },
            {
                element: (
                    <GuardedRoute>
                        <DashboardLayout />
                    </GuardedRoute>
                ),
                children: [
                    {
                        path: "/dashboard",
                        element: <Dashboard />
                    },
                    {
                        path: "/vault",
                        element: <div>Vault Placeholder</div>
                    },
                    {
                        path: "/shared",
                        element: <div>Shared Vaults Placeholder</div>
                    },
                    {
                        path: "/health",
                        element: <div>Security Health Placeholder</div>
                    },
                    {
                        path: "/activity",
                        element: <div>Activity Placeholder</div>
                    },
                    {
                        path: "/family",
                        element: <div>Family Members Placeholder</div>
                    },
                    {
                        path: "/settings",
                        element: <div>Settings Placeholder</div>
                    },
                    {
                        path: "/setup-2fa",
                        element: <TOTPSetup />
                    }
                ]
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
