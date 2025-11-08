package types

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID                    uuid.UUID  `json:"id" db:"id"`
	Email                 string     `json:"email" db:"email"`
	MasterPasswordHash    string     `json:"-" db:"master_password_hash"`
	EncryptionKeyEncrypted string    `json:"-" db:"encryption_key_encrypted"`
	Salt                  string     `json:"-" db:"salt"`
	TwoFactorEnabled      bool       `json:"two_factor_enabled" db:"two_factor_enabled"`
	TwoFactorSecretEncrypted string  `json:"-" db:"two_factor_secret_encrypted"`
	BackupCodesEncrypted  string     `json:"-" db:"backup_codes_encrypted"`
	CreatedAt             time.Time  `json:"created_at" db:"created_at"`
	LastLogin             *time.Time `json:"last_login" db:"last_login"`
	AccountStatus         string     `json:"account_status" db:"account_status"`
}

type RegisterRequest struct {
	Email             string `json:"email" binding:"required,email"`
	MasterPassword    string `json:"master_password" binding:"required,min=8"`
	EncryptionKeyProof string `json:"encryption_key_proof" binding:"required"`
}

type LoginRequest struct {
	Email            string `json:"email" binding:"required,email"`
	MasterPasswordProof string `json:"master_password_proof" binding:"required"`
}

type LoginResponse struct {
	UserID      uuid.UUID `json:"user_id"`
	AccessToken string    `json:"access_token"`
	RefreshToken string   `json:"refresh_token"`
	ExpiresIn   int       `json:"expires_in"`
	Requires2FA bool      `json:"requires_2fa,omitempty"`
}

type RefreshTokenRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

type RefreshTokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
}

type Enable2FARequest struct {
	Password string `json:"password" binding:"required"`
}

type Enable2FAResponse struct {
	Secret    string `json:"secret"`
	QRCodeURL string `json:"qr_code_url"`
	BackupCodes []string `json:"backup_codes"`
}

type Verify2FARequest struct {
	Code string `json:"code" binding:"required"`
}

type Disable2FARequest struct {
	Password string `json:"password" binding:"required"`
	Code     string `json:"code" binding:"required"`
}

type ForgotPasswordRequest struct {
	Email string `json:"email" binding:"required,email"`
}

type ResetPasswordRequest struct {
	Token       string `json:"token" binding:"required"`
	NewPassword string `json:"new_password" binding:"required,min=8"`
}

type ChangePasswordRequest struct {
	CurrentPassword string `json:"current_password" binding:"required"`
	NewPassword     string `json:"new_password" binding:"required,min=8"`
}

