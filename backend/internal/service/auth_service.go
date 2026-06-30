package service

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	"pmv2/backend/internal/domain"
	"pmv2/backend/internal/mailer"
	"pmv2/backend/internal/util"
)

type AuthService struct {
	repo          domain.AuthRepository
	pepper        string
	sessionTTL    time.Duration
	totpIssuer    string
	totpSecretKey []byte
	now           func() time.Time
	audit         *AuditService
	loginThrottle *loginThrottle
	mailer        mailer.Mailer
	appBaseURL    string
}

func NewAuthService(repo domain.AuthRepository, audit *AuditService, mail mailer.Mailer, pepper string, sessionTTL time.Duration, issuer string, appBaseURL string) *AuthService {
	now := time.Now
	return &AuthService{
		repo:          repo,
		pepper:        pepper,
		sessionTTL:    sessionTTL,
		totpIssuer:    issuer,
		totpSecretKey: util.DeriveTOTPEncryptionKey(pepper),
		now:           now,
		audit:         audit,
		loginThrottle: newLoginThrottle(loginMaxAttempts, loginAttemptWindow, loginLockDuration, now),
		mailer:        mail,
		appBaseURL:    appBaseURL,
	}
}

const (
	totpMaxAttempts   = 5
	totpAttemptWindow = 30 * time.Second
	totpLockDuration  = 5 * time.Minute

	loginMaxAttempts   = 10
	loginAttemptWindow = 15 * time.Minute
	loginLockDuration  = 15 * time.Minute

	emailCodeTTL         = 10 * time.Minute
	emailCodeMaxAttempts = 5
)

func (s *AuthService) Register(ctx context.Context, email string, password string, name string) (domain.RegisterOutput, error) {
	normalizedEmail := util.NormalizeEmail(email)
	if normalizedEmail == "" {
		return domain.RegisterOutput{}, domain.ErrInvalidCredentials
	}

	// `password` carries the client-derived authentication verifier
	// (Argon2id over the master password). Password-strength rules are
	// enforced on the client; here we only validate the verifier shape.
	if err := util.ValidateAuthVerifier(password); err != nil {
		return domain.RegisterOutput{}, err
	}

	paramsJSON, err := util.MarshalArgon2Params(util.DefaultArgon2Params())
	if err != nil {
		return domain.RegisterOutput{}, fmt.Errorf("marshal argon2 params: %w", err)
	}

	// salt is the per-user vault KDF salt (consumed client-side on first
	// vault unlock); the auth hash itself is independent of it.
	salt, err := util.NewRandomSalt(32)
	if err != nil {
		return domain.RegisterOutput{}, err
	}
	passwordHash := util.HashAuthVerifier(password, s.pepper)

	userID, err := util.NewUUID()
	if err != nil {
		return domain.RegisterOutput{}, err
	}

	trimmedName := util.TrimOrEmpty(name)
	err = s.repo.CreateUserWithCredentials(ctx, domain.CreateUserInput{
		UserID:       userID,
		Email:        normalizedEmail,
		Name:         trimmedName,
		Algo:         "client-argon2id-sha256",
		ParamsJSON:   paramsJSON,
		Salt:         salt,
		PasswordHash: passwordHash,
	})
	if err != nil {
		if errors.Is(err, domain.ErrEmailTaken) {
			return domain.RegisterOutput{}, domain.ErrEmailTaken
		}
		return domain.RegisterOutput{}, fmt.Errorf("create user credentials: %w", err)
	}

	return domain.RegisterOutput{
		UserID: userID,
		Email:  normalizedEmail,
		Name:   trimmedName,
	}, nil
}

func (s *AuthService) Login(ctx context.Context, input domain.LoginInput) (domain.LoginOutput, error) {
	normalizedEmail := util.NormalizeEmail(input.Email)
	if normalizedEmail == "" || input.Password == "" {
		return domain.LoginOutput{}, domain.ErrInvalidCredentials
	}
	trimmedTOTPCode := util.TrimOrEmpty(input.TOTPCode)
	trimmedEmailCode := util.TrimOrEmpty(input.EmailCode)
	if trimmedTOTPCode != "" && trimmedEmailCode != "" {
		return domain.LoginOutput{}, domain.ErrInvalidMFAInput
	}

	// Per-account lockout for failed password attempts, keyed by email so it
	// applies regardless of source IP.
	if s.loginThrottle.locked(normalizedEmail) {
		return domain.LoginOutput{}, domain.ErrLoginRateLimited
	}

	record, err := s.repo.GetUserAuthByEmail(ctx, normalizedEmail)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			// Flatten timing so an unknown email costs the same as a wrong
			// verifier, preventing account enumeration via response time.
			_ = subtle.ConstantTimeCompare(util.HashAuthVerifier(input.Password, s.pepper), make([]byte, sha256.Size))
			s.loginThrottle.recordFailure(normalizedEmail)
			return domain.LoginOutput{}, domain.ErrInvalidCredentials
		}
		return domain.LoginOutput{}, fmt.Errorf("read auth record: %w", err)
	}

	// `input.Password` carries the client-derived authentication verifier.
	if subtle.ConstantTimeCompare(util.HashAuthVerifier(input.Password, s.pepper), record.PasswordHash) != 1 {
		if s.loginThrottle.recordFailure(normalizedEmail) {
			return domain.LoginOutput{}, domain.ErrLoginRateLimited
		}
		return domain.LoginOutput{}, domain.ErrInvalidCredentials
	}

	s.loginThrottle.reset(normalizedEmail)

	if record.TOTPEnabled {
		nowUTC := s.now().UTC()
		if s.isMFALocked(record.TOTPLockedUntil, nowUTC) {
			return domain.LoginOutput{}, domain.ErrMFARateLimited
		}

		if trimmedTOTPCode == "" && trimmedEmailCode == "" {
			return domain.LoginOutput{}, domain.ErrMFARequired
		}

		if trimmedEmailCode != "" {
			ok, err := s.consumeEmailCode(ctx, record.UserID, domain.EmailCodePurposeMFARecovery, trimmedEmailCode, nowUTC)
			if err != nil {
				return domain.LoginOutput{}, fmt.Errorf("consume mfa email code: %w", err)
			}
			if !ok {
				return domain.LoginOutput{}, s.recordMFAFailure(ctx, record.UserID, nowUTC)
			}
			if err := s.repo.ResetTOTPFailures(ctx, record.UserID); err != nil {
				return domain.LoginOutput{}, fmt.Errorf("reset totp failures after email code login: %w", err)
			}
		} else {
			secret, err := util.ParseStoredTOTPSecret(record.TOTPSecretEnc, s.totpSecretKey)
			if err != nil {
				return domain.LoginOutput{}, fmt.Errorf("decode totp secret: %w", err)
			}
			if !util.VerifyTOTP(secret, trimmedTOTPCode, nowUTC) {
				return domain.LoginOutput{}, s.recordMFAFailure(ctx, record.UserID, nowUTC)
			}
			if err := s.repo.ResetTOTPFailures(ctx, record.UserID); err != nil {
				return domain.LoginOutput{}, fmt.Errorf("reset totp failures: %w", err)
			}
		}
	}

	sessionToken, err := util.NewOpaqueToken(32)
	if err != nil {
		return domain.LoginOutput{}, err
	}

	sessionID, err := util.NewUUID()
	if err != nil {
		return domain.LoginOutput{}, err
	}

	expiresAt := s.now().UTC().Add(s.sessionTTL)
	err = s.repo.CreateSession(ctx, domain.CreateSessionInput{
		SessionID:  sessionID,
		UserID:     record.UserID,
		TokenHash:  util.HashToken(sessionToken, s.pepper),
		DeviceName: util.TrimOrEmpty(input.DeviceName),
		IPAddr:     util.NormalizeIP(input.IPAddr),
		UserAgent:  util.TrimOrEmpty(input.UserAgent),
		ExpiresAt:  expiresAt,
	})
	if err != nil {
		return domain.LoginOutput{}, fmt.Errorf("create session: %w", err)
	}

	uid, _ := uuid.Parse(record.UserID)
	s.audit.LogEvent(ctx, &uid, domain.EventTypeAuthLoginSuccess, map[string]string{
		"ip_address":  input.IPAddr,
		"device_name": input.DeviceName,
	})

	return domain.LoginOutput{
		SessionToken: sessionToken,
		ExpiresAt:    expiresAt,
		UserID:       record.UserID,
		Email:        record.Email,
		Name:         record.Name,
		TOTPEnabled:  record.TOTPEnabled,
	}, nil
}

func (s *AuthService) Authenticate(ctx context.Context, token string) (domain.Session, error) {
	if util.TrimOrEmpty(token) == "" {
		return domain.Session{}, domain.ErrUnauthorizedSession
	}

	session, err := s.repo.GetActiveSessionByTokenHash(ctx, util.HashToken(token, s.pepper))
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return domain.Session{}, domain.ErrUnauthorizedSession
		}
		return domain.Session{}, fmt.Errorf("authenticate session: %w", err)
	}

	return session, nil
}

func (s *AuthService) Logout(ctx context.Context, token string) error {
	if util.TrimOrEmpty(token) == "" {
		return domain.ErrUnauthorizedSession
	}

	tokenHash := util.HashToken(token, s.pepper)
	session, err := s.repo.GetActiveSessionByTokenHash(ctx, tokenHash)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return domain.ErrUnauthorizedSession
		}
		return fmt.Errorf("lookup session for logout: %w", err)
	}

	revoked, err := s.repo.RevokeSessionByTokenHash(ctx, tokenHash)
	if err != nil {
		return fmt.Errorf("logout: %w", err)
	}
	if !revoked {
		return domain.ErrUnauthorizedSession
	}

	uid, _ := uuid.Parse(session.UserID)
	s.audit.LogEvent(ctx, &uid, domain.EventTypeAuthLogout, nil)

	return nil
}

func (s *AuthService) BeginTOTPSetup(ctx context.Context, userID string, email string) (domain.TOTPSetup, error) {
	secret, err := util.NewTOTPSecret()
	if err != nil {
		return domain.TOTPSetup{}, err
	}

	secretEnc, err := util.EncryptTOTPSecret(secret, s.totpSecretKey)
	if err != nil {
		return domain.TOTPSetup{}, fmt.Errorf("encrypt totp secret: %w", err)
	}

	updated, err := s.repo.SetTOTPSecret(ctx, userID, secretEnc)
	if err != nil {
		return domain.TOTPSetup{}, fmt.Errorf("set totp secret: %w", err)
	}
	if !updated {
		return domain.TOTPSetup{}, domain.ErrUnauthorizedSession
	}

	return domain.TOTPSetup{
		Secret:     secret,
		OTPAuthURL: util.BuildOTPAuthURL(s.totpIssuer, email, secret),
	}, nil
}

func (s *AuthService) EnableTOTP(ctx context.Context, userID string, code string) error {
	state, err := s.repo.GetTOTPState(ctx, userID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return domain.ErrUnauthorizedSession
		}
		return fmt.Errorf("read totp state: %w", err)
	}

	nowUTC := s.now().UTC()
	if s.isMFALocked(state.LockedUntil, nowUTC) {
		return domain.ErrMFARateLimited
	}

	// Enabling is a one-time operation.
	if state.Enabled {
		return domain.ErrTOTPAlreadyEnabled
	}

	secret, err := util.ParseStoredTOTPSecret(state.SecretEnc, s.totpSecretKey)
	if err != nil {
		return fmt.Errorf("decode totp secret: %w", err)
	}
	if secret == "" {
		return domain.ErrMissingTOTPSecret
	}

	// Verify the submitted code exactly once.
	if !util.VerifyTOTP(secret, code, nowUTC) {
		return s.recordMFAFailure(ctx, userID, nowUTC)
	}

	if err := s.repo.EnableTOTP(ctx, userID); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return domain.ErrUnauthorizedSession
		}
		return fmt.Errorf("enable totp: %w", err)
	}
	if err := s.repo.ResetTOTPFailures(ctx, userID); err != nil {
		return fmt.Errorf("reset totp failures: %w", err)
	}
	// MFA recovery is handled via emailed codes, so no backup codes are issued.
	return nil
}

func (s *AuthService) VerifyTOTPForSession(ctx context.Context, userID string, code string) error {
	state, err := s.repo.GetTOTPState(ctx, userID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return domain.ErrUnauthorizedSession
		}
		return fmt.Errorf("read totp state: %w", err)
	}

	nowUTC := s.now().UTC()
	if s.isMFALocked(state.LockedUntil, nowUTC) {
		return domain.ErrMFARateLimited
	}

	secret, err := util.ParseStoredTOTPSecret(state.SecretEnc, s.totpSecretKey)
	if err != nil {
		return fmt.Errorf("decode totp secret: %w", err)
	}

	if !state.Enabled || secret == "" {
		return domain.ErrMissingTOTPSecret
	}
	if !util.VerifyTOTP(secret, code, nowUTC) {
		return s.recordMFAFailure(ctx, userID, nowUTC)
	}
	if err := s.repo.ResetTOTPFailures(ctx, userID); err != nil {
		return fmt.Errorf("reset totp failures: %w", err)
	}
	return nil
}

func (s *AuthService) DisableTOTP(ctx context.Context, userID string) error {
	if err := s.repo.DisableTOTP(ctx, userID); err != nil {
		return fmt.Errorf("disable totp service: %w", err)
	}
	return nil
}

func (s *AuthService) recordMFAFailure(ctx context.Context, userID string, now time.Time) error {
	lockedUntil, err := s.repo.RecordTOTPFailure(ctx, userID, now, totpMaxAttempts, totpAttemptWindow, totpLockDuration)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return domain.ErrUnauthorizedSession
		}
		return fmt.Errorf("record totp failure: %w", err)
	}

	uid, _ := uuid.Parse(userID)
	s.audit.LogEvent(ctx, &uid, domain.EventTypeAuthLoginFailed, map[string]string{
		"reason": "mfa_verification_failed",
	})

	if s.isMFALocked(lockedUntil, now) {
		return domain.ErrMFARateLimited
	}
	return domain.ErrInvalidMFA
}

func (s *AuthService) isMFALocked(lockedUntil *time.Time, now time.Time) bool {
	return lockedUntil != nil && lockedUntil.UTC().After(now.UTC())
}

// recoveryTokenTTL bounds the short-lived token issued after an email reset
// code is verified (used by the password-reset flow).
const recoveryTokenTTL = 15 * time.Minute

func (s *AuthService) UpdateProfile(ctx context.Context, userID string, name string) error {
	trimmedName := util.TrimOrEmpty(name)

	if err := s.repo.UpdateDisplayName(ctx, userID, trimmedName); err != nil {
		return fmt.Errorf("update profile: %w", err)
	}

	uid, _ := uuid.Parse(userID)
	s.audit.LogEvent(ctx, &uid, domain.EventTypeAuthProfileUpdated, map[string]string{
		"updated_fields": "name",
	})

	return nil
}

// ── Email verification codes (password reset + MFA recovery) ────────────────

// issueEmailCode generates a fresh code for the given purpose, persists its
// hash (invalidating any prior code), and emails it to the user.
func (s *AuthService) issueEmailCode(ctx context.Context, userID, email, purpose, subject, intro string) error {
	code, err := util.NewNumericCode(6)
	if err != nil {
		return err
	}
	codeID, err := util.NewUUID()
	if err != nil {
		return err
	}
	if err := s.repo.InvalidateEmailVerificationCodes(ctx, userID, purpose); err != nil {
		return fmt.Errorf("invalidate prior codes: %w", err)
	}
	if err := s.repo.CreateEmailVerificationCode(ctx, domain.EmailVerificationCodeInput{
		ID:        codeID,
		UserID:    userID,
		Purpose:   purpose,
		CodeHash:  util.HashEmailCode(code, s.pepper),
		ExpiresAt: s.now().UTC().Add(emailCodeTTL),
	}); err != nil {
		return fmt.Errorf("store email code: %w", err)
	}

	text := fmt.Sprintf("%s\n\nYour verification code is: %s\n\nIt expires in %d minutes. If you didn't request this, you can ignore this email.",
		intro, code, int(emailCodeTTL.Minutes()))
	html := fmt.Sprintf("<p>%s</p><p style=\"font-size:24px;font-weight:bold;letter-spacing:3px\">%s</p><p>It expires in %d minutes. If you didn't request this, you can ignore this email.</p>",
		intro, code, int(emailCodeTTL.Minutes()))
	if err := s.mailer.Send(ctx, email, subject, html, text); err != nil {
		return fmt.Errorf("send email code: %w", err)
	}
	return nil
}

// consumeEmailCode verifies a submitted code for a purpose. Returns true only
// when a non-expired, non-exhausted code matches; otherwise it records an
// attempt and returns false. Errors are reserved for unexpected failures.
func (s *AuthService) consumeEmailCode(ctx context.Context, userID, purpose, code string, now time.Time) (bool, error) {
	record, err := s.repo.GetLatestEmailVerificationCode(ctx, userID, purpose)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return false, nil
		}
		return false, fmt.Errorf("read email code: %w", err)
	}

	if now.After(record.ExpiresAt) || record.Attempts >= emailCodeMaxAttempts {
		_ = s.repo.InvalidateEmailVerificationCodes(ctx, userID, purpose)
		return false, nil
	}

	if subtle.ConstantTimeCompare(util.HashEmailCode(code, s.pepper), record.CodeHash) != 1 {
		if err := s.repo.IncrementEmailVerificationAttempts(ctx, record.ID); err != nil {
			return false, fmt.Errorf("increment email code attempts: %w", err)
		}
		return false, nil
	}

	if err := s.repo.MarkEmailVerificationCodeConsumed(ctx, record.ID); err != nil {
		return false, fmt.Errorf("consume email code: %w", err)
	}
	return true, nil
}

// RequestPasswordResetEmail emails a reset code if the account exists. The
// caller must always respond identically regardless of the result to avoid
// leaking which emails are registered.
func (s *AuthService) RequestPasswordResetEmail(ctx context.Context, email string) error {
	normalizedEmail := util.NormalizeEmail(email)
	if normalizedEmail == "" {
		return nil
	}
	record, err := s.repo.GetUserAuthByEmail(ctx, normalizedEmail)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return nil
		}
		return fmt.Errorf("read auth record for password reset: %w", err)
	}
	return s.issueEmailCode(ctx, record.UserID, record.Email,
		domain.EmailCodePurposePasswordReset,
		"Reset your PMV2 master password",
		"We received a request to reset your master password.")
}

// VerifyPasswordResetCode validates an emailed reset code and, on success,
// issues a short-lived reset token used to set the new password.
func (s *AuthService) VerifyPasswordResetCode(ctx context.Context, email, code string) (string, time.Time, error) {
	normalizedEmail := util.NormalizeEmail(email)
	if normalizedEmail == "" {
		return "", time.Time{}, domain.ErrInvalidVerificationCode
	}
	record, err := s.repo.GetUserAuthByEmail(ctx, normalizedEmail)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return "", time.Time{}, domain.ErrInvalidVerificationCode
		}
		return "", time.Time{}, fmt.Errorf("read auth record for reset verify: %w", err)
	}

	nowUTC := s.now().UTC()
	ok, err := s.consumeEmailCode(ctx, record.UserID, domain.EmailCodePurposePasswordReset, code, nowUTC)
	if err != nil {
		return "", time.Time{}, err
	}
	if !ok {
		return "", time.Time{}, domain.ErrInvalidVerificationCode
	}

	resetToken, err := util.NewOpaqueToken(32)
	if err != nil {
		return "", time.Time{}, err
	}
	sessionID, err := util.NewUUID()
	if err != nil {
		return "", time.Time{}, err
	}
	expiresAt := nowUTC.Add(recoveryTokenTTL)
	if err := s.repo.CreateSession(ctx, domain.CreateSessionInput{
		SessionID:  sessionID,
		UserID:     record.UserID,
		TokenHash:  util.HashToken(resetToken, s.pepper),
		DeviceName: "password-reset",
		ExpiresAt:  expiresAt,
	}); err != nil {
		return "", time.Time{}, fmt.Errorf("create reset token session: %w", err)
	}
	return resetToken, expiresAt, nil
}

// ResetPasswordViaEmail sets a new master password using a reset token, then
// wipes the now-undecryptable vault (zero-knowledge: the server can't re-encrypt
// it) and starts the user with a clean session.
func (s *AuthService) ResetPasswordViaEmail(ctx context.Context, resetToken, newVerifier, deviceName, ipAddr, userAgent string) (domain.LoginOutput, error) {
	if util.TrimOrEmpty(resetToken) == "" {
		return domain.LoginOutput{}, domain.ErrInvalidRecoveryToken
	}
	session, err := s.repo.GetActiveSessionByTokenHash(ctx, util.HashToken(resetToken, s.pepper))
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return domain.LoginOutput{}, domain.ErrInvalidRecoveryToken
		}
		return domain.LoginOutput{}, fmt.Errorf("validate reset token: %w", err)
	}

	if err := util.ValidateAuthVerifier(newVerifier); err != nil {
		return domain.LoginOutput{}, err
	}

	paramsJSON, err := util.MarshalArgon2Params(util.DefaultArgon2Params())
	if err != nil {
		return domain.LoginOutput{}, fmt.Errorf("marshal argon2 params: %w", err)
	}
	salt, err := util.NewRandomSalt(32)
	if err != nil {
		return domain.LoginOutput{}, err
	}
	if err := s.repo.UpdatePassword(ctx, domain.ResetPasswordInput{
		UserID:       session.UserID,
		Algo:         "client-argon2id-sha256",
		ParamsJSON:   paramsJSON,
		Salt:         salt,
		PasswordHash: util.HashAuthVerifier(newVerifier, s.pepper),
	}); err != nil {
		return domain.LoginOutput{}, fmt.Errorf("update password: %w", err)
	}

	// The old vault was encrypted under the forgotten password and can no longer
	// be decrypted; wipe it so the user starts fresh.
	if err := s.repo.WipeUserVault(ctx, session.UserID); err != nil {
		return domain.LoginOutput{}, fmt.Errorf("wipe vault after reset: %w", err)
	}

	if _, err := s.repo.RevokeAllUserSessions(ctx, session.UserID); err != nil {
		return domain.LoginOutput{}, fmt.Errorf("revoke sessions after reset: %w", err)
	}

	record, err := s.repo.GetUserAuthByEmail(ctx, session.Email)
	if err != nil {
		return domain.LoginOutput{}, fmt.Errorf("read auth record after reset: %w", err)
	}

	sessionToken, err := util.NewOpaqueToken(32)
	if err != nil {
		return domain.LoginOutput{}, err
	}
	newSessionID, err := util.NewUUID()
	if err != nil {
		return domain.LoginOutput{}, err
	}
	expiresAt := s.now().UTC().Add(s.sessionTTL)
	if err := s.repo.CreateSession(ctx, domain.CreateSessionInput{
		SessionID:  newSessionID,
		UserID:     record.UserID,
		TokenHash:  util.HashToken(sessionToken, s.pepper),
		DeviceName: util.TrimOrEmpty(deviceName),
		IPAddr:     util.NormalizeIP(ipAddr),
		UserAgent:  util.TrimOrEmpty(userAgent),
		ExpiresAt:  expiresAt,
	}); err != nil {
		return domain.LoginOutput{}, fmt.Errorf("create session after reset: %w", err)
	}

	uid, _ := uuid.Parse(record.UserID)
	s.audit.LogEvent(ctx, &uid, domain.EventTypeAuthLoginSuccess, map[string]string{
		"reason": "password_reset_via_email",
	})

	return domain.LoginOutput{
		SessionToken: sessionToken,
		ExpiresAt:    expiresAt,
		UserID:       record.UserID,
		Email:        record.Email,
		Name:         record.Name,
		TOTPEnabled:  record.TOTPEnabled,
	}, nil
}

// RequestMFAEmailCode emails an MFA-recovery code when the supplied password is
// correct and the account has TOTP enabled. Always returns nil to avoid leaking
// account state.
func (s *AuthService) RequestMFAEmailCode(ctx context.Context, email, passwordVerifier string) error {
	normalizedEmail := util.NormalizeEmail(email)
	if normalizedEmail == "" {
		return nil
	}
	record, err := s.repo.GetUserAuthByEmail(ctx, normalizedEmail)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return nil
		}
		return fmt.Errorf("read auth record for mfa email: %w", err)
	}

	// Only send a code to someone who proved knowledge of the password and who
	// actually has TOTP enabled.
	if subtle.ConstantTimeCompare(util.HashAuthVerifier(passwordVerifier, s.pepper), record.PasswordHash) != 1 {
		return nil
	}
	if !record.TOTPEnabled {
		return nil
	}
	return s.issueEmailCode(ctx, record.UserID, record.Email,
		domain.EmailCodePurposeMFARecovery,
		"Your PMV2 sign-in code",
		"Use this code to sign in without your authenticator app.")
}
