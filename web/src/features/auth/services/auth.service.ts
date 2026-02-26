import {
    RegisterRequest,
    RegisterResponse,
    LoginRequest,
    LoginResponse,
    TOTPSetupResponse,
    TOTPEnableResponse,
    ErrorResponse,
} from "../types";

const API_BASE = "/api/v1";

export class ApiError extends Error {
    constructor(public code: string, message: string) {
        super(message);
        this.name = "ApiError";
    }
}

async function request<T>(
    method: string,
    endpoint: string,
    body?: unknown,
    token?: string
): Promise<T> {
    const headers: HeadersInit = {
        "Content-Type": "application/json",
    };
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
        let errRes: ErrorResponse;
        try {
            errRes = await res.json();
        } catch {
            throw new Error(`HTTP ${res.status}`);
        }
        throw new ApiError(errRes.error, errRes.message);
    }

    return res.json() as Promise<T>;
}

export const authService = {
    register(req: RegisterRequest) {
        return request<RegisterResponse>("POST", "/auth/register", req);
    },
    login(req: LoginRequest) {
        return request<LoginResponse>("POST", "/auth/login", req);
    },
    logout(token: string) {
        return request<void>("POST", "/auth/logout", undefined, token);
    },
    setupTOTP(token: string) {
        return request<TOTPSetupResponse>("POST", "/auth/totp/setup", undefined, token);
    },
    enableTOTP(token: string, code: string) {
        return request<TOTPEnableResponse>("POST", "/auth/totp/enable", { code }, token);
    },
    verifyTOTP(token: string, code: string) {
        return request<void>("POST", "/auth/totp/verify", { code }, token);
    },
};
