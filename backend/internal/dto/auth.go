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
	Email        string `json:"email"`
	Password     string `json:"password"`
	TOTPCode     string `json:"totp_code"`
	RecoveryCode string `json:"recovery_code"`
	DeviceName   string `json:"device_name"`
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
	Status        string   `json:"status"`
	RecoveryCodes []string `json:"recovery_codes"`
}

type StatusResponse struct {
	Status string `json:"status"`
}
