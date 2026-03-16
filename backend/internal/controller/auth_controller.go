package controller

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"pmv2/backend/internal/domain"
	"pmv2/backend/internal/dto"
	"pmv2/backend/internal/service"
	"pmv2/backend/internal/util"
)

type AuthController struct {
	auth                *service.AuthService
	sessionCookieName   string
	sessionCookieSecure bool
}

type AuthCookieConfig struct {
	Name   string
	Secure bool
}

func NewAuthController(authService *service.AuthService, cookieConfig AuthCookieConfig) *AuthController {
	cookieName := strings.TrimSpace(cookieConfig.Name)
	if cookieName == "" {
		cookieName = "pmv2_session"
	}

	return &AuthController{
		auth:                authService,
		sessionCookieName:   cookieName,
		sessionCookieSecure: cookieConfig.Secure,
	}
}

func (c *AuthController) HandleRegister(w http.ResponseWriter, r *http.Request) {
	var req dto.RegisterRequest
	if err := util.ReadJSON(r, &req); err != nil {
		util.WriteError(w, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}

	resp, err := c.auth.Register(r.Context(), req.Email, req.Password, req.Name)
	if err != nil {
		switch {
		case errors.Is(err, domain.ErrEmailTaken):
			util.WriteError(w, http.StatusConflict, "email_taken", "email already registered")
		case errors.Is(err, domain.ErrInvalidCredentials):
			util.WriteError(w, http.StatusBadRequest, "invalid_credentials", "email or password does not meet policy")
		case errors.Is(err, domain.ErrWeakPassword):
			util.WriteError(w, http.StatusBadRequest, "weak_password", "password does not meet complexity requirements")
		default:
			util.WriteError(w, http.StatusInternalServerError, "internal_error", "registration failed")
		}
		return
	}

	util.WriteJSON(w, http.StatusCreated, dto.RegisterResponse{
		UserID: resp.UserID,
		Email:  resp.Email,
		Name:   resp.Name,
		Status: "registered",
	})
}

func (c *AuthController) HandleLogin(w http.ResponseWriter, r *http.Request) {
	var req dto.LoginRequest
	if err := util.ReadJSON(r, &req); err != nil {
		util.WriteError(w, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}

	output, err := c.auth.Login(r.Context(), domain.LoginInput{
		Email:        req.Email,
		Password:     req.Password,
		TOTPCode:     req.TOTPCode,
		RecoveryCode: req.RecoveryCode,
		DeviceName:   req.DeviceName,
		IPAddr:       util.ClientIPFromRequest(r),
		UserAgent:    r.UserAgent(),
	})
	if err != nil {
		switch {
		case errors.Is(err, domain.ErrMFARequired):
			util.WriteJSON(w, http.StatusUnauthorized, dto.MFARequiredResponse{
				Error:       "mfa_required",
				Message:     "totp code is required for this account",
				MFARequired: true,
			})
		case errors.Is(err, domain.ErrInvalidMFA):
			util.WriteError(w, http.StatusUnauthorized, "invalid_mfa", "invalid totp or recovery code")
		case errors.Is(err, domain.ErrInvalidMFAInput):
			util.WriteError(w, http.StatusBadRequest, "invalid_mfa_input", "provide either totp_code or recovery_code, not both")
		case errors.Is(err, domain.ErrMFARateLimited):
			util.WriteError(w, http.StatusTooManyRequests, "mfa_rate_limited", "too many invalid mfa attempts, try again later")
		case errors.Is(err, domain.ErrInvalidCredentials):
			util.WriteError(w, http.StatusUnauthorized, "invalid_credentials", "invalid email or password")
		case errors.Is(err, domain.ErrWeakPassword):
			util.WriteError(w, http.StatusUnauthorized, "weak_password", "password does not meet complexity requirements")
		default:
			util.WriteError(w, http.StatusInternalServerError, "internal_error", "login failed")
		}
		return
	}

	c.setSessionCookie(w, output.SessionToken, output.ExpiresAt)

	util.WriteJSON(w, http.StatusOK, dto.LoginResponse{
		ExpiresAt:   output.ExpiresAt.UTC().Format(time.RFC3339),
		UserID:      output.UserID,
		Email:       output.Email,
		Name:        output.Name,
		TOTPEnabled: output.TOTPEnabled,
	})
}

func (c *AuthController) HandleLogout(w http.ResponseWriter, r *http.Request, _ domain.Session) {
	token := c.sessionTokenFromRequest(r)
	if token == "" {
		util.WriteError(w, http.StatusUnauthorized, "unauthorized", "missing session token")
		return
	}
	if err := c.auth.Logout(r.Context(), token); err != nil {
		util.WriteError(w, http.StatusUnauthorized, "unauthorized", "session already expired or revoked")
		return
	}

	c.clearSessionCookie(w)
	util.WriteJSON(w, http.StatusOK, dto.LogoutResponse{Status: "logged_out"})
}

func (c *AuthController) HandleMe(w http.ResponseWriter, _ *http.Request, session domain.Session) {
	util.WriteJSON(w, http.StatusOK, dto.SessionResponse{
		ExpiresAt:   session.ExpiresAt.UTC().Format(time.RFC3339),
		UserID:      session.UserID,
		Email:       session.Email,
		Name:        session.Name,
		TOTPEnabled: session.TOTPEnabled,
	})
}

func (c *AuthController) HandleTOTPSetup(w http.ResponseWriter, r *http.Request, session domain.Session) {
	setup, err := c.auth.BeginTOTPSetup(r.Context(), session.UserID, session.Email)
	if err != nil {
		util.WriteError(w, http.StatusInternalServerError, "internal_error", "failed to initialize totp")
		return
	}
	util.WriteJSON(w, http.StatusOK, dto.TOTPSetupResponse{Secret: setup.Secret, OTPAuthURL: setup.OTPAuthURL})
}

func (c *AuthController) HandleTOTPEnable(w http.ResponseWriter, r *http.Request, session domain.Session) {
	var req dto.TOTPCodeRequest
	if err := util.ReadJSON(r, &req); err != nil {
		util.WriteError(w, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}

	recoveryCodes, err := c.auth.EnableTOTP(r.Context(), session.UserID, req.Code)
	if err != nil {
		switch {
		case errors.Is(err, domain.ErrInvalidMFA):
			util.WriteError(w, http.StatusUnauthorized, "invalid_mfa", "invalid totp code")
		case errors.Is(err, domain.ErrMFARateLimited):
			util.WriteError(w, http.StatusTooManyRequests, "mfa_rate_limited", "too many invalid mfa attempts, try again later")
		case errors.Is(err, domain.ErrMissingTOTPSecret):
			util.WriteError(w, http.StatusBadRequest, "totp_not_initialized", "totp setup required before enable")
		default:
			util.WriteError(w, http.StatusInternalServerError, "internal_error", "failed to enable totp")
		}
		return
	}

	util.WriteJSON(w, http.StatusOK, dto.TOTPEnableResponse{
		Status:        "totp_enabled",
		RecoveryCodes: recoveryCodes,
	})
}

func (c *AuthController) HandleTOTPVerify(w http.ResponseWriter, r *http.Request, session domain.Session) {
	var req dto.TOTPCodeRequest
	if err := util.ReadJSON(r, &req); err != nil {
		util.WriteError(w, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}

	if err := c.auth.VerifyTOTPForSession(r.Context(), session.UserID, req.Code); err != nil {
		switch {
		case errors.Is(err, domain.ErrInvalidMFA):
			util.WriteError(w, http.StatusUnauthorized, "invalid_mfa", "invalid totp code")
		case errors.Is(err, domain.ErrMFARateLimited):
			util.WriteError(w, http.StatusTooManyRequests, "mfa_rate_limited", "too many invalid mfa attempts, try again later")
		case errors.Is(err, domain.ErrMissingTOTPSecret):
			util.WriteError(w, http.StatusBadRequest, "totp_not_enabled", "totp is not enabled")
		default:
			util.WriteError(w, http.StatusInternalServerError, "internal_error", "failed to verify totp")
		}
		return
	}

	util.WriteJSON(w, http.StatusOK, dto.StatusResponse{Status: "totp_verified"})
}

func (c *AuthController) HandleTOTPDisable(w http.ResponseWriter, r *http.Request, session domain.Session) {
	if err := c.auth.DisableTOTP(r.Context(), session.UserID); err != nil {
		util.WriteError(w, http.StatusInternalServerError, "internal_error", "failed to disable totp")
		return
	}
	util.WriteJSON(w, http.StatusOK, dto.StatusResponse{Status: "totp_disabled"})
}

func (c *AuthController) HandleRecoverySetup(w http.ResponseWriter, r *http.Request, session domain.Session) {
	var req dto.RecoverySetupRequest
	if err := util.ReadJSON(r, &req); err != nil {
		util.WriteError(w, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}

	if strings.TrimSpace(req.RecoveryKey) == "" {
		util.WriteError(w, http.StatusBadRequest, "invalid_recovery_key", "recovery key is required")
		return
	}

	var wrappedKEK, wrapNonce, kekSalt []byte
	var err error
	if strings.TrimSpace(req.WrappedKEK) != "" {
		wrappedKEK, err = decodeBase64Required(req.WrappedKEK)
		if err != nil {
			util.WriteError(w, http.StatusBadRequest, "invalid_wrapped_kek", "wrapped_kek must be valid base64")
			return
		}
		wrapNonce, err = decodeBase64Required(req.WrapNonce)
		if err != nil {
			util.WriteError(w, http.StatusBadRequest, "invalid_wrap_nonce", "wrap_nonce must be valid base64")
			return
		}
		kekSalt, err = decodeBase64Required(req.KEKSalt)
		if err != nil {
			util.WriteError(w, http.StatusBadRequest, "invalid_kek_salt", "kek_salt must be valid base64")
			return
		}
	}

	if err := c.auth.SetupRecovery(r.Context(), session.UserID, req.RecoveryKey, wrappedKEK, wrapNonce, kekSalt); err != nil {
		switch {
		case errors.Is(err, domain.ErrInvalidRecoveryKey):
			util.WriteError(w, http.StatusBadRequest, "invalid_recovery_key", "invalid recovery key")
		default:
			util.WriteError(w, http.StatusInternalServerError, "internal_error", "failed to setup recovery")
		}
		return
	}

	util.WriteJSON(w, http.StatusOK, dto.RecoverySetupResponse{Status: "recovery_configured"})
}

func (c *AuthController) HandleGetRecoveryStatus(w http.ResponseWriter, r *http.Request, session domain.Session) {
	status, err := c.auth.GetRecoveryStatus(r.Context(), session.UserID)
	if err != nil {
		util.WriteError(w, http.StatusInternalServerError, "internal_error", "failed to check recovery status")
		return
	}
	util.WriteJSON(w, http.StatusOK, dto.RecoveryStatusResponse{IsEnabled: status})
}

func (c *AuthController) HandleRecoveryVerify(w http.ResponseWriter, r *http.Request) {
	var req dto.RecoveryVerifyRequest
	if err := util.ReadJSON(r, &req); err != nil {
		util.WriteError(w, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}

	token, expiresAt, recoveryRecord, err := c.auth.VerifyRecoveryKey(r.Context(), req.Email, req.RecoveryKey, req.TOTPCode)
	if err != nil {
		switch {
		case errors.Is(err, domain.ErrInvalidCredentials):
			util.WriteError(w, http.StatusUnauthorized, "invalid_credentials", "invalid email")
		case errors.Is(err, domain.ErrInvalidRecoveryKey):
			util.WriteError(w, http.StatusUnauthorized, "invalid_recovery_key", "invalid recovery key")
		case errors.Is(err, domain.ErrRecoveryNotSetup):
			util.WriteError(w, http.StatusBadRequest, "recovery_not_setup", "account recovery is not configured")
		case errors.Is(err, domain.ErrRecoveryCooldown):
			util.WriteError(w, http.StatusTooManyRequests, "recovery_cooldown", "recovery attempted too recently, try again later")
		case errors.Is(err, domain.ErrMFARequired):
			util.WriteJSON(w, http.StatusUnauthorized, dto.MFARequiredResponse{
				Error:       "mfa_required",
				Message:     "totp code is required for recovery",
				MFARequired: true,
			})
		case errors.Is(err, domain.ErrInvalidMFA):
			util.WriteError(w, http.StatusUnauthorized, "invalid_mfa", "invalid totp code")
		case errors.Is(err, domain.ErrMFARateLimited):
			util.WriteError(w, http.StatusTooManyRequests, "mfa_rate_limited", "too many invalid mfa attempts, try again later")
		default:
			util.WriteError(w, http.StatusInternalServerError, "internal_error", "failed to verify recovery key")
		}
		return
	}

	resp := dto.RecoveryVerifyResponse{
		RecoveryToken: token,
		ExpiresAt:     expiresAt.UTC().Format(time.RFC3339),
	}
	if recoveryRecord != nil && len(recoveryRecord.WrappedKEK) > 0 {
		resp.WrappedKEK = encodeBase64(recoveryRecord.WrappedKEK)
		resp.WrapNonce = encodeBase64(recoveryRecord.WrapNonce)
		resp.KEKSalt = encodeBase64(recoveryRecord.KEKSalt)
	}
	util.WriteJSON(w, http.StatusOK, resp)
}

func (c *AuthController) HandleRecoveryReset(w http.ResponseWriter, r *http.Request) {
	var req dto.RecoveryResetRequest
	if err := util.ReadJSON(r, &req); err != nil {
		util.WriteError(w, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}

	output, err := c.auth.ResetPassword(
		r.Context(),
		req.RecoveryToken,
		req.NewPassword,
		req.DeviceName,
		util.ClientIPFromRequest(r),
		r.UserAgent(),
	)
	if err != nil {
		switch {
		case errors.Is(err, domain.ErrInvalidRecoveryToken):
			util.WriteError(w, http.StatusUnauthorized, "invalid_recovery_token", "invalid or expired recovery token")
		case errors.Is(err, domain.ErrWeakPassword):
			util.WriteError(w, http.StatusBadRequest, "weak_password", "password does not meet complexity requirements")
		default:
			util.WriteError(w, http.StatusInternalServerError, "internal_error", "failed to reset password")
		}
		return
	}

	c.setSessionCookie(w, output.SessionToken, output.ExpiresAt)

	util.WriteJSON(w, http.StatusOK, dto.RecoveryResetResponse{
		Status:      "password_reset",
		UserID:      output.UserID,
		Email:       output.Email,
		Name:        output.Name,
		ExpiresAt:   output.ExpiresAt.UTC().Format(time.RFC3339),
		TOTPEnabled: output.TOTPEnabled,
	})
}

func decodeHex(value string) ([]byte, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil, errors.New("empty hex string")
	}
	raw := make([]byte, len(trimmed)/2)
	for i := 0; i < len(raw); i++ {
		high := hexVal(trimmed[2*i])
		low := hexVal(trimmed[2*i+1])
		if high < 0 || low < 0 {
			return nil, errors.New("invalid hex character")
		}
		raw[i] = byte(high<<4 | low)
	}
	return raw, nil
}

func hexVal(c byte) int {
	switch {
	case c >= '0' && c <= '9':
		return int(c - '0')
	case c >= 'a' && c <= 'f':
		return int(c - 'a' + 10)
	case c >= 'A' && c <= 'F':
		return int(c - 'A' + 10)
	default:
		return -1
	}
}

func (c *AuthController) sessionTokenFromRequest(r *http.Request) string {
	if cookie, err := r.Cookie(c.sessionCookieName); err == nil {
		token := strings.TrimSpace(cookie.Value)
		if token != "" {
			return token
		}
	}
	return util.BearerToken(r.Header.Get("Authorization"))
}

func (c *AuthController) setSessionCookie(w http.ResponseWriter, token string, expiresAt time.Time) {
	maxAge := int(time.Until(expiresAt).Seconds())
	if maxAge < 1 {
		maxAge = 1
	}

	http.SetCookie(w, &http.Cookie{
		Name:     c.sessionCookieName,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		Secure:   c.sessionCookieSecure,
		SameSite: http.SameSiteLaxMode,
		Expires:  expiresAt.UTC(),
		MaxAge:   maxAge,
	})
}

func (c *AuthController) clearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     c.sessionCookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   c.sessionCookieSecure,
		SameSite: http.SameSiteLaxMode,
		Expires:  time.Unix(0, 0).UTC(),
		MaxAge:   -1,
	})
}
