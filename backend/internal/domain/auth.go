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
	ErrInvalidMFAInput     = errors.New("invalid mfa input")
	ErrMFARateLimited      = errors.New("mfa attempts rate limited")
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
	Name      string
	ExpiresAt time.Time
}

type LoginInput struct {
	Email        string
	Password     string
	TOTPCode     string
	RecoveryCode string
	DeviceName   string
	IPAddr       string
	UserAgent    string
}

type LoginOutput struct {
	SessionToken string
	ExpiresAt    time.Time
	UserID       string
	Email        string
	Name         string
}

type RegisterOutput struct {
	UserID string
	Email  string
	Name   string
}

type TOTPSetup struct {
	Secret     string
	OTPAuthURL string
}

type CreateUserInput struct {
	UserID       string
	Email        string
	Name         string
	Algo         string
	ParamsJSON   []byte
	Salt         []byte
	PasswordHash []byte
}

type UserAuthRecord struct {
	UserID             string
	Email              string
	Name               string
	Salt               []byte
	PasswordHash       []byte
	RawParams          []byte
	TOTPEnabled        bool
	TOTPSecretEnc      []byte
	TOTPFailedAttempts int
	TOTPWindowStart    *time.Time
	TOTPLockedUntil    *time.Time
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
	SecretEnc      []byte
	Enabled        bool
	FailedAttempts int
	WindowStart    *time.Time
	LockedUntil    *time.Time
}

type AuthRepository interface {
	CreateUserWithCredentials(ctx context.Context, input CreateUserInput) error
	GetUserAuthByEmail(ctx context.Context, email string) (UserAuthRecord, error)
	CreateSession(ctx context.Context, input CreateSessionInput) error
	GetActiveSessionByTokenHash(ctx context.Context, tokenHash []byte) (Session, error)
	RevokeSessionByTokenHash(ctx context.Context, tokenHash []byte) (bool, error)
	SetTOTPSecret(ctx context.Context, userID string, secretEnc []byte) (bool, error)
	EnableTOTP(ctx context.Context, userID string) error
	GetTOTPState(ctx context.Context, userID string) (TOTPState, error)
	RecordTOTPFailure(ctx context.Context, userID string, now time.Time, maxAttempts int, window time.Duration, lockDuration time.Duration) (*time.Time, error)
	ResetTOTPFailures(ctx context.Context, userID string) error
	ReplaceRecoveryCodes(ctx context.Context, userID string, codeHashes [][]byte) error
	ConsumeRecoveryCode(ctx context.Context, userID string, codeHash []byte) (bool, error)
	DeleteExpiredSessions(ctx context.Context) (int64, error)
}
