package controller

import (
	"errors"
	"log/slog"
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
	log                 *slog.Logger
}

type AuthCookieConfig struct {
	Name   string
	Secure bool
}

func NewAuthController(authService *service.AuthService, cookieConfig AuthCookieConfig, logger *slog.Logger) *AuthController {
	cookieName := strings.TrimSpace(cookieConfig.Name)
	if cookieName == "" {
		cookieName = "pmv2_session"
	}

	return &AuthController{
		auth:                authService,
		sessionCookieName:   cookieName,
		sessionCookieSecure: cookieConfig.Secure,
		log:                 logger,
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
			c.log.ErrorContext(r.Context(), "register failed", slog.Any("error", err))
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
		Email:      req.Email,
		Password:   req.Password,
		TOTPCode:   req.TOTPCode,
		EmailCode:  req.EmailCode,
		DeviceName: req.DeviceName,
		IPAddr:     util.ClientIPFromRequest(r),
		UserAgent:  r.UserAgent(),
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
		case errors.Is(err, domain.ErrLoginRateLimited):
			util.WriteError(w, http.StatusTooManyRequests, "login_rate_limited", "too many failed login attempts, try again later")
		case errors.Is(err, domain.ErrInvalidCredentials):
			util.WriteError(w, http.StatusUnauthorized, "invalid_credentials", "invalid email or password")
		case errors.Is(err, domain.ErrWeakPassword):
			util.WriteError(w, http.StatusUnauthorized, "weak_password", "password does not meet complexity requirements")
		default:
			c.log.ErrorContext(r.Context(), "login failed", slog.Any("error", err))
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

	if err := c.auth.EnableTOTP(r.Context(), session.UserID, req.Code); err != nil {
		switch {
		case errors.Is(err, domain.ErrInvalidMFA):
			util.WriteError(w, http.StatusUnauthorized, "invalid_mfa", "invalid totp code")
		case errors.Is(err, domain.ErrMFARateLimited):
			util.WriteError(w, http.StatusTooManyRequests, "mfa_rate_limited", "too many invalid mfa attempts, try again later")
		case errors.Is(err, domain.ErrMissingTOTPSecret):
			util.WriteError(w, http.StatusBadRequest, "totp_not_initialized", "totp setup required before enable")
		case errors.Is(err, domain.ErrTOTPAlreadyEnabled):
			util.WriteError(w, http.StatusConflict, "totp_already_enabled", "totp is already enabled")
		default:
			c.log.ErrorContext(r.Context(), "enable totp failed", slog.String("user_id", session.UserID), slog.Any("error", err))
			util.WriteError(w, http.StatusInternalServerError, "internal_error", "failed to enable totp")
		}
		return
	}

	util.WriteJSON(w, http.StatusOK, dto.TOTPEnableResponse{Status: "totp_enabled"})
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
			c.log.ErrorContext(r.Context(), "verify totp failed", slog.String("user_id", session.UserID), slog.Any("error", err))
			util.WriteError(w, http.StatusInternalServerError, "internal_error", "failed to verify totp")
		}
		return
	}

	util.WriteJSON(w, http.StatusOK, dto.StatusResponse{Status: "totp_verified"})
}

func (c *AuthController) HandleTOTPDisable(w http.ResponseWriter, r *http.Request, session domain.Session) {
	if err := c.auth.DisableTOTP(r.Context(), session.UserID); err != nil {
		c.log.ErrorContext(r.Context(), "disable totp failed", slog.String("user_id", session.UserID), slog.Any("error", err))
		util.WriteError(w, http.StatusInternalServerError, "internal_error", "failed to disable totp")
		return
	}
	util.WriteJSON(w, http.StatusOK, dto.StatusResponse{Status: "totp_disabled"})
}

// HandleRequestPasswordReset emails a reset code. Always responds 200 with a
// generic message so it cannot be used to enumerate registered emails.
func (c *AuthController) HandleRequestPasswordReset(w http.ResponseWriter, r *http.Request) {
	var req dto.PasswordResetRequestRequest
	if err := util.ReadJSON(r, &req); err != nil {
		util.WriteError(w, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}

	if err := c.auth.RequestPasswordResetEmail(r.Context(), req.Email); err != nil {
		// Log but don't surface — keep the response identical regardless.
		c.log.ErrorContext(r.Context(), "request password reset failed", slog.Any("error", err))
	}

	util.WriteJSON(w, http.StatusOK, dto.StatusResponse{Status: "reset_email_sent"})
}

// HandleVerifyPasswordReset validates the emailed code and returns a reset token.
func (c *AuthController) HandleVerifyPasswordReset(w http.ResponseWriter, r *http.Request) {
	var req dto.PasswordResetVerifyRequest
	if err := util.ReadJSON(r, &req); err != nil {
		util.WriteError(w, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}

	token, expiresAt, err := c.auth.VerifyPasswordResetCode(r.Context(), req.Email, req.Code)
	if err != nil {
		switch {
		case errors.Is(err, domain.ErrInvalidVerificationCode):
			util.WriteError(w, http.StatusUnauthorized, "invalid_code", "invalid or expired verification code")
		default:
			c.log.ErrorContext(r.Context(), "verify password reset failed", slog.Any("error", err))
			util.WriteError(w, http.StatusInternalServerError, "internal_error", "failed to verify code")
		}
		return
	}

	util.WriteJSON(w, http.StatusOK, dto.PasswordResetVerifyResponse{
		ResetToken: token,
		ExpiresAt:  expiresAt.UTC().Format(time.RFC3339),
	})
}

// HandleConfirmPasswordReset sets a new master password and wipes the vault.
func (c *AuthController) HandleConfirmPasswordReset(w http.ResponseWriter, r *http.Request) {
	var req dto.PasswordResetConfirmRequest
	if err := util.ReadJSON(r, &req); err != nil {
		util.WriteError(w, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}

	output, err := c.auth.ResetPasswordViaEmail(
		r.Context(),
		req.ResetToken,
		req.NewPassword,
		req.DeviceName,
		util.ClientIPFromRequest(r),
		r.UserAgent(),
	)
	if err != nil {
		switch {
		case errors.Is(err, domain.ErrInvalidRecoveryToken):
			util.WriteError(w, http.StatusUnauthorized, "invalid_reset_token", "invalid or expired reset token")
		case errors.Is(err, domain.ErrInvalidAuthVerifier):
			util.WriteError(w, http.StatusBadRequest, "invalid_password", "invalid password payload")
		default:
			c.log.ErrorContext(r.Context(), "confirm password reset failed", slog.Any("error", err))
			util.WriteError(w, http.StatusInternalServerError, "internal_error", "failed to reset password")
		}
		return
	}

	c.setSessionCookie(w, output.SessionToken, output.ExpiresAt)
	util.WriteJSON(w, http.StatusOK, dto.PasswordResetConfirmResponse{
		Status:      "password_reset",
		UserID:      output.UserID,
		Email:       output.Email,
		Name:        output.Name,
		ExpiresAt:   output.ExpiresAt.UTC().Format(time.RFC3339),
		TOTPEnabled: output.TOTPEnabled,
	})
}

// HandleRequestMFAEmailCode emails an MFA-recovery code for users who can't use
// their authenticator. Always responds 200 to avoid leaking account state.
func (c *AuthController) HandleRequestMFAEmailCode(w http.ResponseWriter, r *http.Request) {
	var req dto.MFAEmailCodeRequest
	if err := util.ReadJSON(r, &req); err != nil {
		util.WriteError(w, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}

	if err := c.auth.RequestMFAEmailCode(r.Context(), req.Email, req.Password); err != nil {
		c.log.ErrorContext(r.Context(), "request mfa email code failed", slog.Any("error", err))
	}

	util.WriteJSON(w, http.StatusOK, dto.StatusResponse{Status: "mfa_email_sent"})
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

	cookie := &http.Cookie{
		Name:     c.sessionCookieName,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		Secure:   c.sessionCookieSecure,
		Expires:  expiresAt.UTC(),
		MaxAge:   maxAge,
	}

	// Frontend and backend are served from the same registrable domain
	// (subdomains of jattin.in), so SameSite=Lax keeps the session cookie on
	// our own same-site requests while the browser withholds it from cross-site
	// requests — neutralizing CSRF without a separate token.
	cookie.SameSite = http.SameSiteLaxMode

	http.SetCookie(w, cookie)
}

func (c *AuthController) clearSessionCookie(w http.ResponseWriter) {
	cookie := &http.Cookie{
		Name:     c.sessionCookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   c.sessionCookieSecure,
		Expires:  time.Unix(0, 0).UTC(),
		MaxAge:   -1,
	}

	cookie.SameSite = http.SameSiteLaxMode

	http.SetCookie(w, cookie)
}

func (c *AuthController) HandleUpdateProfile(w http.ResponseWriter, r *http.Request, session domain.Session) {
	var req dto.UpdateProfileRequest
	if err := util.ReadJSON(r, &req); err != nil {
		util.WriteError(w, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}

	if err := c.auth.UpdateProfile(r.Context(), session.UserID, req.Name); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			util.WriteError(w, http.StatusNotFound, "not_found", "user not found")
			return
		}
		c.log.ErrorContext(r.Context(), "update profile failed", slog.String("user_id", session.UserID), slog.Any("error", err))
		util.WriteError(w, http.StatusInternalServerError, "internal_error", "failed to update profile")
		return
	}

	util.WriteJSON(w, http.StatusOK, dto.StatusResponse{Status: "profile_updated"})
}
