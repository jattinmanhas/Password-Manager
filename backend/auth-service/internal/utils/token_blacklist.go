package utils

import (
	"fmt"
	"time"

	"github.com/password-manager/auth-service/internal/redis"
)

const (
	blacklistPrefix = "blacklist:token:"
)

// BlacklistToken adds a token to the blacklist until expiration
func BlacklistToken(redisClient *redis.Client, tokenID string, expiration time.Duration) error {
	key := blacklistPrefix + tokenID
	return redisClient.Set(key, "1", expiration)
}

// IsTokenBlacklisted checks if a token is blacklisted
func IsTokenBlacklisted(redisClient *redis.Client, tokenID string) (bool, error) {
	key := blacklistPrefix + tokenID
	return redisClient.Exists(key)
}

// ExtractTokenID extracts a unique identifier from JWT token
// In production, you might want to use jti (JWT ID) claim
func ExtractTokenID(tokenString string) string {
	// For simplicity, we'll use a hash of the token
	// In production, include jti claim in JWT
	return fmt.Sprintf("%x", tokenString)
}

