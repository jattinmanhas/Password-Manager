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
    recovery_code?: string;
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
    recovery_codes: string[];
}

export interface StatusResponse {
    status: string;
}

export interface RecoverySetupRequest {
    recovery_key: string;
    wrapped_kek?: string;
    wrap_nonce?: string;
    kek_salt?: string;
}

export interface RecoverySetupResponse {
    status: string;
}

export interface RecoveryStatusResponse {
    is_enabled: boolean;
}

export interface RecoveryVerifyRequest {
    email: string;
    recovery_key: string;
    totp_code?: string;
}

export interface RecoveryVerifyResponse {
    recovery_token: string;
    expires_at: string;
    wrapped_kek?: string;
    wrap_nonce?: string;
    kek_salt?: string;
}

export interface RecoveryResetRequest {
    recovery_token: string;
    new_password: string;
}

export interface RecoveryResetResponse {
    status: string;
    user_id: string;
}
