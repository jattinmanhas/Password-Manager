import {
    RegisterRequest,
    RegisterResponse,
    LoginRequest,
    LoginResponse,
    SessionResponse,
    TOTPSetupResponse,
    TOTPEnableResponse,
    RecoverySetupRequest,
    RecoverySetupResponse,
    RecoveryVerifyRequest,
    RecoveryVerifyResponse,
    RecoveryResetRequest,
    RecoveryResetResponse,
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
    setupRecovery(req: RecoverySetupRequest) {
        return request<RecoverySetupResponse>("POST", "/auth/recovery/setup", req);
    },
    verifyRecovery(req: RecoveryVerifyRequest) {
        return request<RecoveryVerifyResponse>("POST", "/auth/recovery/verify", req);
    },
    resetPassword(req: RecoveryResetRequest) {
        return request<RecoveryResetResponse>("POST", "/auth/recovery/reset", req);
    },
};
