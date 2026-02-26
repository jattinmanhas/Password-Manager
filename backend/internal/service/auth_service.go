package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"pmv2/backend/internal/domain"
	"pmv2/backend/internal/util"
)

type AuthService struct {
	repo          domain.AuthRepository
	pepper        string
	sessionTTL    time.Duration
	totpIssuer    string
	totpSecretKey []byte
	now           func() time.Time
}

func NewAuthService(repo domain.AuthRepository, pepper string, sessionTTL time.Duration, issuer string) *AuthService {
	return &AuthService{
		repo:          repo,
		pepper:        pepper,
		sessionTTL:    sessionTTL,
		totpIssuer:    issuer,
		totpSecretKey: util.DeriveTOTPEncryptionKey(pepper),
		now:           time.Now,
	}
}

const (
	totpMaxAttempts   = 5
	totpAttemptWindow = 30 * time.Second
	totpLockDuration  = 5 * time.Minute
	recoveryCodeCount = 10
)

func (s *AuthService) Register(ctx context.Context, email string, password string, name string, masterPasswordHint string) (string, error) {
	normalizedEmail := util.NormalizeEmail(email)
	if normalizedEmail == "" {
		return "", domain.ErrInvalidCredentials
	}

	if err := util.ValidatePasswordStrength(password); err != nil {
		return "", err
	}

	params := util.DefaultArgon2Params()
	paramsJSON, err := util.MarshalArgon2Params(params)
	if err != nil {
		return "", fmt.Errorf("marshal argon2 params: %w", err)
	}

	salt, passwordHash, err := util.HashPassword(password, params)
	if err != nil {
		return "", err
	}

	userID, err := util.NewUUID()
	if err != nil {
		return "", err
	}

	err = s.repo.CreateUserWithCredentials(ctx, domain.CreateUserInput{
		UserID:       userID,
		Email:        normalizedEmail,
		Name:         util.TrimOrEmpty(name),
		PasswordHint: util.TrimOrEmpty(masterPasswordHint),
		Algo:         "argon2id",
		ParamsJSON:   paramsJSON,
		Salt:         salt,
		PasswordHash: passwordHash,
	})
	if err != nil {
		if errors.Is(err, domain.ErrEmailTaken) {
			return "", domain.ErrEmailTaken
		}
		return "", fmt.Errorf("create user credentials: %w", err)
	}

	return userID, nil
}

func (s *AuthService) Login(ctx context.Context, input domain.LoginInput) (domain.LoginOutput, error) {
	normalizedEmail := util.NormalizeEmail(input.Email)
	if normalizedEmail == "" || input.Password == "" {
		return domain.LoginOutput{}, domain.ErrInvalidCredentials
	}
	trimmedTOTPCode := util.TrimOrEmpty(input.TOTPCode)
	trimmedRecoveryCode := util.TrimOrEmpty(input.RecoveryCode)
	if trimmedTOTPCode != "" && trimmedRecoveryCode != "" {
		return domain.LoginOutput{}, domain.ErrInvalidMFAInput
	}

	record, err := s.repo.GetUserAuthByEmail(ctx, normalizedEmail)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return domain.LoginOutput{}, domain.ErrInvalidCredentials
		}
		return domain.LoginOutput{}, fmt.Errorf("read auth record: %w", err)
	}

	params, err := util.ParseArgon2Params(record.RawParams)
	if err != nil {
		return domain.LoginOutput{}, fmt.Errorf("parse hash params: %w", err)
	}

	if !util.VerifyPassword(input.Password, record.Salt, record.PasswordHash, params) {
		return domain.LoginOutput{}, domain.ErrInvalidCredentials
	}

	if record.TOTPEnabled {
		nowUTC := s.now().UTC()
		if s.isMFALocked(record.TOTPLockedUntil, nowUTC) {
			return domain.LoginOutput{}, domain.ErrMFARateLimited
		}

		if trimmedTOTPCode == "" && trimmedRecoveryCode == "" {
			return domain.LoginOutput{}, domain.ErrMFARequired
		}

		if trimmedRecoveryCode != "" {
			consumed, err := s.repo.ConsumeRecoveryCode(ctx, record.UserID, util.HashRecoveryCode(trimmedRecoveryCode, s.pepper))
			if err != nil {
				return domain.LoginOutput{}, fmt.Errorf("consume recovery code: %w", err)
			}
			if !consumed {
				return domain.LoginOutput{}, s.recordMFAFailure(ctx, record.UserID, nowUTC)
			}
			if err := s.repo.ResetTOTPFailures(ctx, record.UserID); err != nil {
				return domain.LoginOutput{}, fmt.Errorf("reset totp failures after recovery code login: %w", err)
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

	return domain.LoginOutput{SessionToken: sessionToken, ExpiresAt: expiresAt}, nil
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

	revoked, err := s.repo.RevokeSessionByTokenHash(ctx, util.HashToken(token, s.pepper))
	if err != nil {
		return fmt.Errorf("logout: %w", err)
	}
	if !revoked {
		return domain.ErrUnauthorizedSession
	}
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

func (s *AuthService) EnableTOTP(ctx context.Context, userID string, code string) ([]string, error) {
	state, err := s.repo.GetTOTPState(ctx, userID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return nil, domain.ErrUnauthorizedSession
		}
		return nil, fmt.Errorf("read totp state: %w", err)
	}

	nowUTC := s.now().UTC()
	if s.isMFALocked(state.LockedUntil, nowUTC) {
		return nil, domain.ErrMFARateLimited
	}

	secret, err := util.ParseStoredTOTPSecret(state.SecretEnc, s.totpSecretKey)
	if err != nil {
		return nil, fmt.Errorf("decode totp secret: %w", err)
	}
	if secret == "" {
		return nil, domain.ErrMissingTOTPSecret
	}

	if state.Enabled && util.VerifyTOTP(secret, code, nowUTC) {
		if err := s.repo.ResetTOTPFailures(ctx, userID); err != nil {
			return nil, fmt.Errorf("reset totp failures: %w", err)
		}
		return s.generateAndStoreRecoveryCodes(ctx, userID)
	}
	if !util.VerifyTOTP(secret, code, nowUTC) {
		return nil, s.recordMFAFailure(ctx, userID, nowUTC)
	}

	if err := s.repo.EnableTOTP(ctx, userID); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return nil, domain.ErrUnauthorizedSession
		}
		return nil, fmt.Errorf("enable totp: %w", err)
	}
	if err := s.repo.ResetTOTPFailures(ctx, userID); err != nil {
		return nil, fmt.Errorf("reset totp failures: %w", err)
	}
	return s.generateAndStoreRecoveryCodes(ctx, userID)
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

func (s *AuthService) recordMFAFailure(ctx context.Context, userID string, now time.Time) error {
	lockedUntil, err := s.repo.RecordTOTPFailure(ctx, userID, now, totpMaxAttempts, totpAttemptWindow, totpLockDuration)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return domain.ErrUnauthorizedSession
		}
		return fmt.Errorf("record totp failure: %w", err)
	}
	if s.isMFALocked(lockedUntil, now) {
		return domain.ErrMFARateLimited
	}
	return domain.ErrInvalidMFA
}

func (s *AuthService) generateAndStoreRecoveryCodes(ctx context.Context, userID string) ([]string, error) {
	codes, err := util.GenerateRecoveryCodes(recoveryCodeCount)
	if err != nil {
		return nil, fmt.Errorf("generate recovery codes: %w", err)
	}

	hashes := make([][]byte, 0, len(codes))
	for _, code := range codes {
		hash := util.HashRecoveryCode(code, s.pepper)
		copyHash := make([]byte, len(hash))
		copy(copyHash, hash)
		hashes = append(hashes, copyHash)
	}

	if err := s.repo.ReplaceRecoveryCodes(ctx, userID, hashes); err != nil {
		return nil, fmt.Errorf("store recovery codes: %w", err)
	}
	return codes, nil
}

func (s *AuthService) isMFALocked(lockedUntil *time.Time, now time.Time) bool {
	return lockedUntil != nil && lockedUntil.UTC().After(now.UTC())
}
