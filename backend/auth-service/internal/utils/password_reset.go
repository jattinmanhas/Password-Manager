package utils

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/password-manager/auth-service/internal/redis"
)

const (
	resetTokenPrefix = "reset:token:"
	resetEmailPrefix = "reset:email:"
)

// GenerateResetToken generates a secure random token for password reset
func GenerateResetToken() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

// StoreResetToken stores a reset token in Redis with expiration
func StoreResetToken(redisClient *redis.Client, token, email string, expiration time.Duration) error {
	// Store token -> email mapping
	tokenKey := resetTokenPrefix + token
	if err := redisClient.Set(tokenKey, email, expiration); err != nil {
		return err
	}

	// Store email -> token mapping (to prevent multiple active tokens)
	emailKey := resetEmailPrefix + email
	if err := redisClient.Set(emailKey, token, expiration); err != nil {
		return err
	}

	return nil
}

// ValidateResetToken validates and retrieves email from reset token
func ValidateResetToken(redisClient *redis.Client, token string) (string, error) {
	tokenKey := resetTokenPrefix + token
	email, err := redisClient.Get(tokenKey)
	if err != nil {
		return "", fmt.Errorf("invalid or expired reset token")
	}
	return email, nil
}

// InvalidateResetToken removes reset token from Redis
func InvalidateResetToken(redisClient *redis.Client, token string) error {
	tokenKey := resetTokenPrefix + token
	email, err := redisClient.Get(tokenKey)
	if err != nil {
		return nil // Token already invalid
	}

	// Delete both mappings
	redisClient.Delete(tokenKey)
	redisClient.Delete(resetEmailPrefix + email)

	return nil
}

// CheckExistingResetToken checks if user already has an active reset token
func CheckExistingResetToken(redisClient *redis.Client, email string) (bool, error) {
	emailKey := resetEmailPrefix + email
	return redisClient.Exists(emailKey)
}

