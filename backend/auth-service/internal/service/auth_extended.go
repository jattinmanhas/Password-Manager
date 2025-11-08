package service

import (
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/password-manager/auth-service/internal/encryption"
	"github.com/password-manager/auth-service/internal/redis"
	"github.com/password-manager/auth-service/internal/types"
	"github.com/password-manager/auth-service/internal/utils"
)

// RefreshToken validates refresh token and generates new access token
func (s *AuthService) RefreshToken(refreshToken string, redisClient *redis.Client) (*types.RefreshTokenResponse, error) {
	// Validate refresh token
	claims, err := utils.ValidateJWT(refreshToken, s.config.JWTSecret)
	if err != nil {
		return nil, errors.New("invalid refresh token")
	}

	// Check if token is blacklisted
	tokenID := utils.ExtractTokenID(refreshToken)
	blacklisted, err := utils.IsTokenBlacklisted(redisClient, tokenID)
	if err == nil && blacklisted {
		return nil, errors.New("token has been revoked")
	}

	// Get user to verify account is still active
	user, err := s.userRepo.GetByID(claims.UserID)
	if err != nil {
		return nil, err
	}
	if user == nil || user.AccountStatus != "active" {
		return nil, errors.New("account not found or inactive")
	}

	// Generate new tokens
	accessToken, err := utils.GenerateJWT(user.ID, user.Email, s.config.JWTSecret, s.config.JWTExpiry)
	if err != nil {
		return nil, err
	}

	newRefreshToken, err := utils.GenerateJWT(user.ID, user.Email, s.config.JWTSecret, s.config.JWTExpiry*7)
	if err != nil {
		return nil, err
	}

	// Blacklist old refresh token
	oldTokenID := utils.ExtractTokenID(refreshToken)
	expiration := time.Duration(s.config.JWTExpiry*7) * time.Hour
	utils.BlacklistToken(redisClient, oldTokenID, expiration)

	return &types.RefreshTokenResponse{
		AccessToken:  accessToken,
		RefreshToken: newRefreshToken,
		ExpiresIn:    s.config.JWTExpiry * 3600,
	}, nil
}

// Logout blacklists the access token
func (s *AuthService) Logout(accessToken string, redisClient *redis.Client) error {
	tokenID := utils.ExtractTokenID(accessToken)
	expiration := time.Duration(s.config.JWTExpiry) * time.Hour
	return utils.BlacklistToken(redisClient, tokenID, expiration)
}

// Enable2FA generates TOTP secret and backup codes
func (s *AuthService) Enable2FA(userID uuid.UUID, password string) (*types.Enable2FAResponse, error) {
	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, errors.New("user not found")
	}

	// Verify password
	valid, err := verifyPassword(password, user.MasterPasswordHash)
	if err != nil || !valid {
		return nil, errors.New("invalid password")
	}

	// Generate TOTP secret
	key, err := utils.GenerateTOTPSecretWithAccount("Password Manager", user.Email)
	if err != nil {
		return nil, err
	}

	// Generate backup codes
	backupCodes, err := utils.GenerateBackupCodes(10)
	if err != nil {
		return nil, err
	}

	// Encrypt secret and backup codes (using encryption key derived from password)
	saltBytes, _ := hex.DecodeString(user.Salt)
	encryptionKey := encryption.DeriveKey(password, saltBytes, s.config.PBKDF2Iterations)

	secretEncrypted, err := encryption.Encrypt(key.Secret(), encryptionKey)
	if err != nil {
		return nil, err
	}

	backupCodesEncrypted, err := utils.EncryptBackupCodes(backupCodes, encryptionKey)
	if err != nil {
		return nil, err
	}

	// Update user in database
	err = s.userRepo.Update2FA(userID, true, secretEncrypted, backupCodesEncrypted)
	if err != nil {
		return nil, err
	}

	return &types.Enable2FAResponse{
		Secret:      key.Secret(),
		QRCodeURL:   key.URL(),
		BackupCodes: backupCodes,
	}, nil
}

// Verify2FA verifies TOTP code during login
func (s *AuthService) Verify2FA(userID uuid.UUID, code string, password string) (bool, error) {
	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		return false, err
	}
	if user == nil {
		return false, errors.New("user not found")
	}

	if !user.TwoFactorEnabled {
		return false, errors.New("2FA not enabled")
	}

	// Decrypt secret
	saltBytes, _ := hex.DecodeString(user.Salt)
	encryptionKey := encryption.DeriveKey(password, saltBytes, s.config.PBKDF2Iterations)

	secret, err := encryption.Decrypt(user.TwoFactorSecretEncrypted, encryptionKey)
	if err != nil {
		return false, err
	}

	// Verify TOTP code
	valid := utils.ValidateTOTP(secret, code)
	if !valid {
		// Check backup codes
		backupCodes, err := utils.DecryptBackupCodes(user.BackupCodesEncrypted, encryptionKey)
		if err != nil {
			return false, err
		}

		for _, backupCode := range backupCodes {
			if backupCode == code {
				// Remove used backup code
				// In production, update database
				return true, nil
			}
		}
	}

	return valid, nil
}

// Disable2FA disables 2FA for a user
func (s *AuthService) Disable2FA(userID uuid.UUID, password, code string) error {
	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		return err
	}
	if user == nil {
		return errors.New("user not found")
	}

	// Verify password
	valid, err := verifyPassword(password, user.MasterPasswordHash)
	if err != nil || !valid {
		return errors.New("invalid password")
	}

	// Verify 2FA code
	codeValid, err := s.Verify2FA(userID, code, password)
	if err != nil || !codeValid {
		return errors.New("invalid 2FA code")
	}

	// Update user (disable 2FA)
	err = s.userRepo.Update2FA(userID, false, "", "")
	if err != nil {
		return err
	}

	return nil
}

// ForgotPassword generates and stores reset token
func (s *AuthService) ForgotPassword(email string, redisClient *redis.Client) error {
	user, err := s.userRepo.GetByEmail(email)
	if err != nil {
		return err
	}
	if user == nil {
		// Don't reveal if user exists
		return nil
	}

	// Check if there's already an active reset token
	exists, _ := utils.CheckExistingResetToken(redisClient, email)
	if exists {
		// Token already exists, don't create another
		return nil
	}

	// Generate reset token
	token, err := utils.GenerateResetToken()
	if err != nil {
		return err
	}

	// Store token in Redis
	expiration := time.Duration(s.config.ResetTokenExpiry) * time.Minute
	err = utils.StoreResetToken(redisClient, token, email, expiration)
	if err != nil {
		return err
	}

	// In production, send email here
	// For now, we'll just return (token would be in email)
	fmt.Printf("Reset token for %s: %s\n", email, token) // Remove in production

	return nil
}

// ResetPassword resets password using reset token
func (s *AuthService) ResetPassword(token, newPassword string, redisClient *redis.Client) error {
	// Validate and get email from token
	email, err := utils.ValidateResetToken(redisClient, token)
	if err != nil {
		return errors.New("invalid or expired reset token")
	}

	// Get user
	user, err := s.userRepo.GetByEmail(email)
	if err != nil {
		return err
	}
	if user == nil {
		return errors.New("user not found")
	}

	// Generate new salt
	salt, err := encryption.GenerateSalt()
	if err != nil {
		return err
	}

	// Hash new password using bcrypt
	newPasswordHash, err := hashPassword(newPassword, s.config.BcryptCost)
	if err != nil {
		return err
	}

	// Derive new encryption key
	encryptionKey := encryption.DeriveKey(newPassword, salt, s.config.PBKDF2Iterations)

	// Encrypt encryption key
	encryptionKeyEncrypted, err := encryption.Encrypt(hex.EncodeToString(encryptionKey), encryptionKey)
	if err != nil {
		return err
	}

	// Update user
	err = s.userRepo.UpdatePassword(user.ID, newPasswordHash, hex.EncodeToString(salt), encryptionKeyEncrypted)
	if err != nil {
		return err
	}

	// Invalidate the token
	utils.InvalidateResetToken(redisClient, token)

	return nil
}

// ChangePassword changes password for authenticated user
func (s *AuthService) ChangePassword(userID uuid.UUID, currentPassword, newPassword string) error {
	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		return err
	}
	if user == nil {
		return errors.New("user not found")
	}

	// Verify current password
	valid, err := verifyPassword(currentPassword, user.MasterPasswordHash)
	if err != nil || !valid {
		return errors.New("invalid current password")
	}

	// Generate new salt
	salt, err := encryption.GenerateSalt()
	if err != nil {
		return err
	}

	// Hash new password using bcrypt
	newPasswordHash, err := hashPassword(newPassword, s.config.BcryptCost)
	if err != nil {
		return err
	}

	// Derive new encryption key
	encryptionKey := encryption.DeriveKey(newPassword, salt, s.config.PBKDF2Iterations)

	// Encrypt encryption key
	encryptionKeyEncrypted, err := encryption.Encrypt(hex.EncodeToString(encryptionKey), encryptionKey)
	if err != nil {
		return err
	}

	// Update user
	err = s.userRepo.UpdatePassword(userID, newPasswordHash, hex.EncodeToString(salt), encryptionKeyEncrypted)
	if err != nil {
		return err
	}

	return nil
}

