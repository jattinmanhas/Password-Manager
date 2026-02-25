package domain

import (
	"context"
	"errors"
	"time"
)

var (
	ErrEmailTaken          = errors.New("email already registered")
	ErrInvalidCredentials  = errors.New("invalid credentials")
	ErrWeakPassword        = errors.New("password does not meet complexity requirements")
	ErrMFARequired         = errors.New("mfa required")
	ErrInvalidMFA          = errors.New("invalid totp code")
	ErrUnauthorizedSession = errors.New("unauthorized")
	ErrMissingTOTPSecret   = errors.New("totp secret not configured")
	ErrNotFound            = errors.New("not found")
)

type Argon2Params struct {
	Memory      uint32 `json:"memory"`
	Iterations  uint32 `json:"iterations"`
	Parallelism uint8  `json:"parallelism"`
	KeyLength   uint32 `json:"key_length"`
}

type Session struct {
	ID        string
	UserID    string
	Email     string
	ExpiresAt time.Time
}

type LoginInput struct {
	Email      string
	Password   string
	TOTPCode   string
	DeviceName string
	IPAddr     string
	UserAgent  string
}

type LoginOutput struct {
	SessionToken string
	ExpiresAt    time.Time
}

type TOTPSetup struct {
	Secret     string
	OTPAuthURL string
}

type CreateUserInput struct {
	UserID       string
	Email        string
	Name         string
	PasswordHint string
	Algo         string
	ParamsJSON   []byte
	Salt         []byte
	PasswordHash []byte
}

type UserAuthRecord struct {
	UserID       string
	Email        string
	Salt         []byte
	PasswordHash []byte
	RawParams    []byte
	TOTPEnabled  bool
	TOTPSecret   string
}

type CreateSessionInput struct {
	SessionID  string
	UserID     string
	TokenHash  []byte
	DeviceName string
	IPAddr     string
	UserAgent  string
	ExpiresAt  time.Time
}

type TOTPState struct {
	Secret  string
	Enabled bool
}

type AuthRepository interface {
	CreateUserWithCredentials(ctx context.Context, input CreateUserInput) error
	GetUserAuthByEmail(ctx context.Context, email string) (UserAuthRecord, error)
	CreateSession(ctx context.Context, input CreateSessionInput) error
	GetActiveSessionByTokenHash(ctx context.Context, tokenHash []byte) (Session, error)
	RevokeSessionByTokenHash(ctx context.Context, tokenHash []byte) (bool, error)
	SetTOTPSecret(ctx context.Context, userID string, secret string) (bool, error)
	EnableTOTP(ctx context.Context, userID string) error
	GetTOTPState(ctx context.Context, userID string) (TOTPState, error)
	DeleteExpiredSessions(ctx context.Context) (int64, error)
}
