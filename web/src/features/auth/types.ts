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
    session_token: string;
    expires_at: string;
    user_id: string;
    email: string;
    name: string;
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
