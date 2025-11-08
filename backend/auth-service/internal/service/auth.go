package service

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strings"

	"golang.org/x/crypto/bcrypt"

	"github.com/google/uuid"
	"github.com/password-manager/auth-service/internal/config"
	"github.com/password-manager/auth-service/internal/encryption"
	"github.com/password-manager/auth-service/internal/repository"
	"github.com/password-manager/auth-service/internal/types"
	"github.com/password-manager/auth-service/internal/utils"
)

type AuthService struct {
	userRepo *repository.UserRepository
	config   *config.Config
}

func NewAuthService(userRepo *repository.UserRepository, cfg *config.Config) *AuthService {
	return &AuthService{
		userRepo: userRepo,
		config:   cfg,
	}
}

func (s *AuthService) Register(req *types.RegisterRequest) (*types.User, error) {
	// Check if user already exists
	existing, err := s.userRepo.GetByEmail(req.Email)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, errors.New("user already exists")
	}

	// Generate salt
	salt, err := encryption.GenerateSalt()
	if err != nil {
		return nil, err
	}

	// Hash master password using bcrypt
	masterPasswordHash, err := hashPassword(req.MasterPassword, s.config.BcryptCost)
	if err != nil {
		return nil, err
	}

	// Derive encryption key (this is what the client sends as proof)
	// In a real implementation, the client would derive this and send a proof
	encryptionKey := encryption.DeriveKey(req.MasterPassword, salt, s.config.PBKDF2Iterations)

	// Encrypt the encryption key with itself (for storage)
	// In production, you might want a different approach
	encryptionKeyEncrypted, err := encryption.Encrypt(hex.EncodeToString(encryptionKey), encryptionKey)
	if err != nil {
		return nil, err
	}

	// Create user
	user := &types.User{
		ID:                     uuid.New(),
		Email:                  req.Email,
		MasterPasswordHash:     masterPasswordHash,
		EncryptionKeyEncrypted: encryptionKeyEncrypted,
		Salt:                   hex.EncodeToString(salt),
		AccountStatus:          "active",
	}

	if err := s.userRepo.Create(user); err != nil {
		return nil, err
	}

	return user, nil
}

func (s *AuthService) Login(req *types.LoginRequest) (*types.User, string, string, error) {
	// Get user by email
	user, err := s.userRepo.GetByEmail(req.Email)
	if err != nil {
		return nil, "", "", err
	}
	if user == nil {
		return nil, "", "", errors.New("invalid credentials")
	}

	// Verify master password proof
	// Supports both bcrypt (new) and SHA-256 (legacy) for backward compatibility
	valid, err := verifyPassword(req.MasterPasswordProof, user.MasterPasswordHash)
	if err != nil || !valid {
		return nil, "", "", errors.New("invalid credentials")
	}

	// If password was verified with legacy SHA-256, upgrade to bcrypt
	if isLegacyHash(user.MasterPasswordHash) {
		newHash, err := hashPassword(req.MasterPasswordProof, s.config.BcryptCost)
		if err == nil {
			// Update password hash to bcrypt (background operation, don't fail login)
			go s.userRepo.UpdatePassword(user.ID, newHash, user.Salt, user.EncryptionKeyEncrypted)
		}
	}

	// Update last login
	if err := s.userRepo.UpdateLastLogin(user.ID); err != nil {
		// Log error but don't fail login
	}

	// Generate JWT tokens
	accessToken, err := utils.GenerateJWT(user.ID, user.Email, s.config.JWTSecret, s.config.JWTExpiry)
	if err != nil {
		return nil, "", "", err
	}

	refreshToken, err := utils.GenerateJWT(user.ID, user.Email, s.config.JWTSecret, s.config.JWTExpiry*7) // 7 days
	if err != nil {
		return nil, "", "", err
	}

	return user, accessToken, refreshToken, nil
}

// hashPassword hashes a password using bcrypt
func hashPassword(password string, cost int) (string, error) {
	// Validate cost factor
	if cost < bcrypt.MinCost {
		cost = bcrypt.DefaultCost
	}
	if cost > bcrypt.MaxCost {
		cost = bcrypt.DefaultCost
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), cost)
	if err != nil {
		return "", err
	}
	return string(hash), nil
}

// verifyPassword verifies a password against a hash
// Supports both bcrypt (new) and SHA-256 (legacy) for backward compatibility
func verifyPassword(password, hash string) (bool, error) {
	// Check if it's a bcrypt hash (starts with $2a$, $2b$, or $2y$)
	if strings.HasPrefix(hash, "$2a$") || strings.HasPrefix(hash, "$2b$") || strings.HasPrefix(hash, "$2y$") {
		err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
		return err == nil, nil
	}

	// Legacy SHA-256 support for backward compatibility
	computedHash := sha256.Sum256([]byte(password))
	legacyHash := hex.EncodeToString(computedHash[:])
	return legacyHash == hash, nil
}

// isLegacyHash checks if a hash is the legacy SHA-256 format
func isLegacyHash(hash string) bool {
	// Bcrypt hashes start with $2a$, $2b$, or $2y$ and are 60 characters
	// SHA-256 hex hashes are 64 characters and don't start with $
	return !strings.HasPrefix(hash, "$2") && len(hash) == 64
}
