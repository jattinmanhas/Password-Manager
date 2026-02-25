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
	repo       domain.AuthRepository
	pepper     string
	sessionTTL time.Duration
	totpIssuer string
	now        func() time.Time
}

func NewAuthService(repo domain.AuthRepository, pepper string, sessionTTL time.Duration, issuer string) *AuthService {
	return &AuthService{
		repo:       repo,
		pepper:     pepper,
		sessionTTL: sessionTTL,
		totpIssuer: issuer,
		now:        time.Now,
	}
}

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
		if input.TOTPCode == "" {
			return domain.LoginOutput{}, domain.ErrMFARequired
		}
		if !util.VerifyTOTP(record.TOTPSecret, input.TOTPCode, s.now().UTC()) {
			return domain.LoginOutput{}, domain.ErrInvalidMFA
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

	updated, err := s.repo.SetTOTPSecret(ctx, userID, secret)
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

	if state.Secret == "" {
		return domain.ErrMissingTOTPSecret
	}
	if state.Enabled && util.VerifyTOTP(state.Secret, code, s.now().UTC()) {
		return nil
	}
	if !util.VerifyTOTP(state.Secret, code, s.now().UTC()) {
		return domain.ErrInvalidMFA
	}

	if err := s.repo.EnableTOTP(ctx, userID); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return domain.ErrUnauthorizedSession
		}
		return fmt.Errorf("enable totp: %w", err)
	}
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

	if !state.Enabled || state.Secret == "" {
		return domain.ErrMissingTOTPSecret
	}
	if !util.VerifyTOTP(state.Secret, code, s.now().UTC()) {
		return domain.ErrInvalidMFA
	}
	return nil
}
