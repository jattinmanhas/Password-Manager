import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { authService } from "../../features/auth/services/auth.service";
import { ApiError } from "../../lib/api";
import { LoginRequest, RegisterRequest } from "../../features/auth/types";

interface SessionState {
    userId: string;
    expiresAt: string;
    email: string;
    name: string;
    isTotpEnabled: boolean;
}

interface AuthContextType {
    session: SessionState | null;
    isLoading: boolean;
    login: (req: LoginRequest) => Promise<void>;
    register: (req: RegisterRequest) => Promise<void>;
    logout: () => Promise<void>;
    refreshSession: () => Promise<void>;
    setSessionRaw: (session: SessionState | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<SessionState | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        const bootstrap = async () => {
            try {
                const res = await authService.me();
                if (!cancelled) {
                    setSession({
                        userId: res.user_id,
                        expiresAt: res.expires_at,
                        email: res.email,
                        name: res.name,
                        isTotpEnabled: res.is_totp_enabled,
                    });
                }
            } catch (e) {
                if (e instanceof ApiError && e.code === "unauthorized") {
                    if (!cancelled) setSession(null);
                    return;
                }
                if (!cancelled) setSession(null);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };

        void bootstrap();
        return () => {
            cancelled = true;
        };
    }, []);

    const setSessionRaw = (newSession: SessionState | null) => {
        setSession(newSession);
    };

    const login = async (req: LoginRequest) => {
        const res = await authService.login(req);
        // If it requires MFA, authService throws an ApiError with code "mfa_required"
        setSessionRaw({
            userId: res.user_id,
            expiresAt: res.expires_at,
            email: res.email,
            name: res.name,
            isTotpEnabled: res.is_totp_enabled,
        });
    };

    const register = async (req: RegisterRequest) => {
        await authService.register(req);
    };

    const logout = async () => {
        try {
            await authService.logout();
        } catch (e) {
            // ignore logout errors on client
        }
        setSessionRaw(null);
    };

    const refreshSession = async () => {
        try {
            const res = await authService.me();
            setSession({
                userId: res.user_id,
                expiresAt: res.expires_at,
                email: res.email,
                name: res.name,
                isTotpEnabled: res.is_totp_enabled,
            });
        } catch (e) {
            setSession(null);
        }
    };

    return (
        <AuthContext.Provider value={{ session, isLoading, login, register, logout, refreshSession, setSessionRaw }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
    return ctx;
};
