package controller

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"pmv2/backend/internal/domain"
	"pmv2/backend/internal/dto"
	"pmv2/backend/internal/service"
)

type AuthController struct {
	auth *service.AuthService
}

func NewAuthController(authService *service.AuthService) *AuthController {
	return &AuthController{auth: authService}
}

func (c *AuthController) HandleRegister(w http.ResponseWriter, r *http.Request) {
	var req dto.RegisterRequest
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}

	userID, err := c.auth.Register(r.Context(), req.Email, req.Password, req.Name, req.MasterPasswordHint)
	if err != nil {
		switch {
		case errors.Is(err, domain.ErrEmailTaken):
			writeError(w, http.StatusConflict, "email_taken", "email already registered")
		case errors.Is(err, domain.ErrInvalidCredentials):
			writeError(w, http.StatusBadRequest, "invalid_credentials", "email or password does not meet policy")
		default:
			writeError(w, http.StatusInternalServerError, "internal_error", "registration failed")
		}
		return
	}

	writeJSON(w, http.StatusCreated, dto.RegisterResponse{UserID: userID, Status: "registered"})
}

func (c *AuthController) HandleLogin(w http.ResponseWriter, r *http.Request) {
	var req dto.LoginRequest
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}

	output, err := c.auth.Login(r.Context(), domain.LoginInput{
		Email:      req.Email,
		Password:   req.Password,
		TOTPCode:   req.TOTPCode,
		DeviceName: req.DeviceName,
		IPAddr:     clientIPFromRequest(r),
		UserAgent:  r.UserAgent(),
	})
	if err != nil {
		switch {
		case errors.Is(err, domain.ErrMFARequired):
			writeJSON(w, http.StatusUnauthorized, dto.MFARequiredResponse{
				Error:       "mfa_required",
				Message:     "totp code is required for this account",
				MFARequired: true,
			})
		case errors.Is(err, domain.ErrInvalidMFA):
			writeError(w, http.StatusUnauthorized, "invalid_mfa", "invalid totp code")
		case errors.Is(err, domain.ErrInvalidCredentials):
			writeError(w, http.StatusUnauthorized, "invalid_credentials", "invalid email or password")
		default:
			writeError(w, http.StatusInternalServerError, "internal_error", "login failed")
		}
		return
	}

	writeJSON(w, http.StatusOK, dto.LoginResponse{
		SessionToken: output.SessionToken,
		ExpiresAt:    output.ExpiresAt.UTC().Format(time.RFC3339),
	})
}

func (c *AuthController) HandleLogout(w http.ResponseWriter, r *http.Request, _ domain.Session) {
	token := bearerToken(r.Header.Get("Authorization"))
	if token == "" {
		writeError(w, http.StatusUnauthorized, "unauthorized", "missing bearer token")
		return
	}
	if err := c.auth.Logout(r.Context(), token); err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "session already expired or revoked")
		return
	}

	writeJSON(w, http.StatusOK, dto.LogoutResponse{Status: "logged_out"})
}

func (c *AuthController) HandleTOTPSetup(w http.ResponseWriter, r *http.Request, session domain.Session) {
	setup, err := c.auth.BeginTOTPSetup(r.Context(), session.UserID, session.Email)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "failed to initialize totp")
		return
	}
	writeJSON(w, http.StatusOK, dto.TOTPSetupResponse{Secret: setup.Secret, OTPAuthURL: setup.OTPAuthURL})
}

func (c *AuthController) HandleTOTPEnable(w http.ResponseWriter, r *http.Request, session domain.Session) {
	var req dto.TOTPCodeRequest
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}

	if err := c.auth.EnableTOTP(r.Context(), session.UserID, req.Code); err != nil {
		switch {
		case errors.Is(err, domain.ErrInvalidMFA):
			writeError(w, http.StatusUnauthorized, "invalid_mfa", "invalid totp code")
		case errors.Is(err, domain.ErrMissingTOTPSecret):
			writeError(w, http.StatusBadRequest, "totp_not_initialized", "totp setup required before enable")
		default:
			writeError(w, http.StatusInternalServerError, "internal_error", "failed to enable totp")
		}
		return
	}

	writeJSON(w, http.StatusOK, dto.StatusResponse{Status: "totp_enabled"})
}

func (c *AuthController) HandleTOTPVerify(w http.ResponseWriter, r *http.Request, session domain.Session) {
	var req dto.TOTPCodeRequest
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}

	if err := c.auth.VerifyTOTPForSession(r.Context(), session.UserID, req.Code); err != nil {
		switch {
		case errors.Is(err, domain.ErrInvalidMFA):
			writeError(w, http.StatusUnauthorized, "invalid_mfa", "invalid totp code")
		case errors.Is(err, domain.ErrMissingTOTPSecret):
			writeError(w, http.StatusBadRequest, "totp_not_enabled", "totp is not enabled")
		default:
			writeError(w, http.StatusInternalServerError, "internal_error", "failed to verify totp")
		}
		return
	}

	writeJSON(w, http.StatusOK, dto.StatusResponse{Status: "totp_verified"})
}

func (c *AuthController) WithSession(next func(http.ResponseWriter, *http.Request, domain.Session)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token := bearerToken(r.Header.Get("Authorization"))
		if token == "" {
			writeError(w, http.StatusUnauthorized, "unauthorized", "missing bearer token")
			return
		}

		session, err := c.auth.Authenticate(r.Context(), token)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "unauthorized", "invalid or expired session")
			return
		}

		next(w, r, session)
	}
}

func readJSON(r *http.Request, into any) error {
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	return decoder.Decode(into)
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, status int, code string, message string) {
	writeJSON(w, status, dto.ErrorResponse{Error: code, Message: message})
}

func bearerToken(header string) string {
	if header == "" {
		return ""
	}
	parts := strings.SplitN(strings.TrimSpace(header), " ", 2)
	if len(parts) != 2 {
		return ""
	}
	if !strings.EqualFold(parts[0], "Bearer") {
		return ""
	}
	return strings.TrimSpace(parts[1])
}

func clientIPFromRequest(r *http.Request) string {
	forwarded := strings.TrimSpace(r.Header.Get("X-Forwarded-For"))
	if forwarded != "" {
		parts := strings.Split(forwarded, ",")
		if len(parts) > 0 {
			return strings.TrimSpace(parts[0])
		}
	}
	return r.RemoteAddr
}
