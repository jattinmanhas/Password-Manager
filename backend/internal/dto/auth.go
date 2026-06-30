package dto

type ErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message"`
}

type HealthResponse struct {
	Status  string `json:"status"`
	Service string `json:"service"`
	Time    string `json:"time"`
	Env     string `json:"env"`
}

type RegisterRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Name     string `json:"name"`
}

type RegisterResponse struct {
	UserID string `json:"user_id"`
	Email  string `json:"email"`
	Name   string `json:"name"`
	Status string `json:"status"`
}

type LoginRequest struct {
	Email      string `json:"email"`
	Password   string `json:"password"`
	TOTPCode   string `json:"totp_code"`
	EmailCode  string `json:"email_code"`
	DeviceName string `json:"device_name"`
}

type LoginResponse struct {
	ExpiresAt   string `json:"expires_at"`
	UserID      string `json:"user_id"`
	Email       string `json:"email"`
	Name        string `json:"name"`
	TOTPEnabled bool   `json:"is_totp_enabled"`
}

type MFARequiredResponse struct {
	Error       string `json:"error"`
	Message     string `json:"message"`
	MFARequired bool   `json:"mfa_required"`
}

type LogoutResponse struct {
	Status string `json:"status"`
}

type SessionResponse struct {
	ExpiresAt   string `json:"expires_at"`
	UserID      string `json:"user_id"`
	Email       string `json:"email"`
	Name        string `json:"name"`
	TOTPEnabled bool   `json:"is_totp_enabled"`
}

type TOTPSetupResponse struct {
	Secret     string `json:"secret"`
	OTPAuthURL string `json:"otpauth_url"`
}

type TOTPCodeRequest struct {
	Code string `json:"code"`
}

type TOTPEnableResponse struct {
	Status string `json:"status"`
}

// ── Email-based password reset & MFA recovery ──────────────────────────────

type PasswordResetRequestRequest struct {
	Email string `json:"email"`
}

type PasswordResetVerifyRequest struct {
	Email string `json:"email"`
	Code  string `json:"code"`
}

type PasswordResetVerifyResponse struct {
	ResetToken string `json:"reset_token"`
	ExpiresAt  string `json:"expires_at"`
}

type PasswordResetConfirmRequest struct {
	ResetToken  string `json:"reset_token"`
	NewPassword string `json:"new_password"`
	DeviceName  string `json:"device_name"`
}

type PasswordResetConfirmResponse struct {
	Status      string `json:"status"`
	UserID      string `json:"user_id"`
	Email       string `json:"email"`
	Name        string `json:"name"`
	ExpiresAt   string `json:"expires_at"`
	TOTPEnabled bool   `json:"is_totp_enabled"`
}

type MFAEmailCodeRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type StatusResponse struct {
	Status string `json:"status"`
}

type UpdateProfileRequest struct {
	Name string `json:"name"`
}
