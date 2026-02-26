import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { authService } from "../../features/auth/services/auth.service";
import { LoginRequest, RegisterRequest } from "../../features/auth/types";

interface SessionState {
    token: string;
    expiresAt: string;
    email: string;
    name: string;
}

interface AuthContextType {
    session: SessionState | null;
    isLoading: boolean;
    login: (req: LoginRequest) => Promise<void>;
    register: (req: RegisterRequest) => Promise<void>;
    logout: () => Promise<void>;
    setSessionRaw: (session: SessionState | null) => void;
}

const SESSION_STORAGE_KEY = "pmv2.session";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<SessionState | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const raw = localStorage.getItem(SESSION_STORAGE_KEY);
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                if (parsed.token && parsed.expiresAt) {
                    setSession(parsed);
                }
            } catch (e) {
                // invalid session
            }
        }
        setIsLoading(false);
    }, []);

    const setSessionRaw = (newSession: SessionState | null) => {
        setSession(newSession);
        if (newSession) {
            localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newSession));
        } else {
            localStorage.removeItem(SESSION_STORAGE_KEY);
        }
    };

    const login = async (req: LoginRequest) => {
        const res = await authService.login(req);
        // If it requires MFA, authService throws an ApiError with code "mfa_required"
        setSessionRaw({
            token: res.session_token,
            expiresAt: res.expires_at,
            email: res.email,
            name: res.name,
        });
    };

    const register = async (req: RegisterRequest) => {
        const res = await authService.register(req);
        // We could auto-login here, but the current flow doesn't seem to do it.
        // If the user wants to auto-login, we would use res.name and res.email.
    };

    const logout = async () => {
        if (session) {
            try {
                await authService.logout(session.token);
            } catch (e) {
                // ignore logout errors on client
            }
        }
        setSessionRaw(null);
    };

    return (
        <AuthContext.Provider value={{ session, isLoading, login, register, logout, setSessionRaw }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
    return ctx;
};
