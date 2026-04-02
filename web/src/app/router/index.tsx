import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import { AuthLayout } from "../../components/layout/AuthLayout";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { Login } from "../../features/auth/pages/Login";
import { Register } from "../../features/auth/pages/Register";
import { Settings } from "../../features/settings/pages/Settings";
import { AccountRecovery } from "../../features/auth/pages/AccountRecovery";
import { Dashboard } from "../../features/dashboard/pages/Dashboard";
import { Vault } from "../../features/vault/pages/Vault";
import { PasswordGeneratorPage } from "../../features/vault/pages/PasswordGeneratorPage";
import { SharedVaults } from "../../features/vault/pages/SharedVaults";
import { SharedByMe } from "../../features/vault/pages/SharedByMe";
import { Activity } from "../../features/dashboard/pages/Activity";
import { useAuth } from "../providers/AuthProvider";
import { NotFound } from "../../features/shared/pages/NotFound";
import { Family } from "../../features/family/pages/Family";
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
                        element: <Vault />
                    },
                    {
                        path: "/generator",
                        element: <PasswordGeneratorPage />
                    },
                    {
                        path: "/shared",
                        element: <SharedVaults />
                    },
                    {
                        path: "/shared/sent",
                        element: <SharedByMe />
                    },
                    {
                        path: "/health",
                        element: <div>Security Health Placeholder</div>
                    },
                    {
                        path: "/activity",
                        element: <Activity />
                    },
                    {
                        path: "/family",
                        element: <Family />
                    },
                    {
                        path: "/settings",
                        element: <Settings />
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
                element: <AuthLayout />,
                children: [
                    {
                        path: "/recover",
                        element: <AccountRecovery />,
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
