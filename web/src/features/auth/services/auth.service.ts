import {
    RegisterRequest,
    RegisterResponse,
    LoginRequest,
    LoginResponse,
    SessionResponse,
    TOTPSetupResponse,
    TOTPEnableResponse,
    PasswordResetRequestRequest,
    PasswordResetVerifyRequest,
    PasswordResetVerifyResponse,
    PasswordResetConfirmRequest,
    PasswordResetConfirmResponse,
    MFAEmailCodeRequest,
    StatusResponse,
} from "../types";

import { request, ApiError } from "../../../lib/api";

export { ApiError };

export const authService = {
    register(req: RegisterRequest) {
        return request<RegisterResponse>("POST", "/auth/register", req);
    },
    login(req: LoginRequest) {
        return request<LoginResponse>("POST", "/auth/login", req);
    },
    me() {
        return request<SessionResponse>("GET", "/auth/me");
    },
    logout() {
        return request<void>("POST", "/auth/logout");
    },
    setupTOTP() {
        return request<TOTPSetupResponse>("POST", "/auth/totp/setup");
    },
    enableTOTP(code: string) {
        return request<TOTPEnableResponse>("POST", "/auth/totp/enable", { code });
    },
    verifyTOTP(code: string) {
        return request<void>("POST", "/auth/totp/verify", { code });
    },
    disableTOTP() {
        return request<void>("POST", "/auth/totp/disable");
    },
    updateProfile(name: string) {
        return request<void>("PUT", "/auth/profile", { name });
    },

    // Email-based master-password reset.
    requestPasswordReset(req: PasswordResetRequestRequest) {
        return request<StatusResponse>("POST", "/auth/password-reset/request", req);
    },
    verifyPasswordReset(req: PasswordResetVerifyRequest) {
        return request<PasswordResetVerifyResponse>("POST", "/auth/password-reset/verify", req);
    },
    confirmPasswordReset(req: PasswordResetConfirmRequest) {
        return request<PasswordResetConfirmResponse>("POST", "/auth/password-reset/confirm", req);
    },

    // Email-based MFA recovery (lost authenticator).
    requestMfaEmailCode(req: MFAEmailCodeRequest) {
        return request<StatusResponse>("POST", "/auth/mfa/email/request", req);
    },
};
