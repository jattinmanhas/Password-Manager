export interface ErrorResponse {
    error: string;
    message: string;
}

export interface RegisterRequest {
    email: string;
    password: string;
    name?: string;
}

export interface RegisterResponse {
    user_id: string;
    email: string;
    name: string;
    status: string;
}

export interface LoginRequest {
    email: string;
    password: string;
    device_name?: string;
    totp_code?: string;
    email_code?: string;
}

export interface LoginResponse {
    expires_at: string;
    user_id: string;
    email: string;
    name: string;
    is_totp_enabled: boolean;
}

export interface SessionResponse {
    expires_at: string;
    user_id: string;
    email: string;
    name: string;
    is_totp_enabled: boolean;
}

export interface TOTPSetupResponse {
    secret: string;
    otpauth_url: string;
}

export interface TOTPEnableResponse {
    status: string;
}

// ── Email-based password reset & MFA recovery ──────────────────────────────

export interface PasswordResetRequestRequest {
    email: string;
}

export interface PasswordResetVerifyRequest {
    email: string;
    code: string;
}

export interface PasswordResetVerifyResponse {
    reset_token: string;
    expires_at: string;
}

export interface PasswordResetConfirmRequest {
    reset_token: string;
    new_password: string;
    device_name?: string;
}

export interface PasswordResetConfirmResponse {
    status: string;
    user_id: string;
    email: string;
    name: string;
    expires_at: string;
    is_totp_enabled: boolean;
}

export interface MFAEmailCodeRequest {
    email: string;
    password: string;
}

export interface StatusResponse {
    status: string;
}
