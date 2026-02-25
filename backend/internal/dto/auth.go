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
	Email              string `json:"email"`
	Password           string `json:"password"`
	Name               string `json:"name"`
	MasterPasswordHint string `json:"master_password_hint"`
}

type RegisterResponse struct {
	UserID string `json:"user_id"`
	Status string `json:"status"`
}

type LoginRequest struct {
	Email      string `json:"email"`
	Password   string `json:"password"`
	TOTPCode   string `json:"totp_code"`
	DeviceName string `json:"device_name"`
}

type LoginResponse struct {
	SessionToken string `json:"session_token"`
	ExpiresAt    string `json:"expires_at"`
}

type MFARequiredResponse struct {
	Error       string `json:"error"`
	Message     string `json:"message"`
	MFARequired bool   `json:"mfa_required"`
}

type LogoutResponse struct {
	Status string `json:"status"`
}

type TOTPSetupResponse struct {
	Secret     string `json:"secret"`
	OTPAuthURL string `json:"otpauth_url"`
}

type TOTPCodeRequest struct {
	Code string `json:"code"`
}

type StatusResponse struct {
	Status string `json:"status"`
}
