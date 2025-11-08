package encryption

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"

	"golang.org/x/crypto/pbkdf2"
)

const (
	KeyLength   = 32 // 256 bits for AES-256
	SaltLength  = 32
	IVLength    = 12 // 96 bits for GCM
	TagLength   = 16 // 128 bits for GCM tag
	DefaultIter = 100000
)

// DeriveKey derives an encryption key from a password using PBKDF2
func DeriveKey(password string, salt []byte, iterations int) []byte {
	if iterations <= 0 {
		iterations = DefaultIter
	}
	return pbkdf2.Key([]byte(password), salt, iterations, KeyLength, sha256.New)
}

// GenerateSalt generates a random salt
func GenerateSalt() ([]byte, error) {
	salt := make([]byte, SaltLength)
	if _, err := rand.Read(salt); err != nil {
		return nil, fmt.Errorf("failed to generate salt: %w", err)
	}
	return salt, nil
}

// Encrypt encrypts plaintext using AES-256-GCM
func Encrypt(plaintext string, key []byte) (string, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("failed to create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("failed to create GCM: %w", err)
	}

	// Generate random IV
	iv := make([]byte, IVLength)
	if _, err := io.ReadFull(rand.Reader, iv); err != nil {
		return "", fmt.Errorf("failed to generate IV: %w", err)
	}

	// Encrypt and authenticate
	ciphertext := gcm.Seal(nil, iv, []byte(plaintext), nil)

	// Combine IV + ciphertext (which includes tag)
	result := append(iv, ciphertext...)
	return hex.EncodeToString(result), nil
}

// Decrypt decrypts ciphertext using AES-256-GCM
func Decrypt(encryptedHex string, key []byte) (string, error) {
	encrypted, err := hex.DecodeString(encryptedHex)
	if err != nil {
		return "", fmt.Errorf("failed to decode hex: %w", err)
	}

	if len(encrypted) < IVLength+TagLength {
		return "", fmt.Errorf("encrypted data too short")
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("failed to create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("failed to create GCM: %w", err)
	}

	// Extract IV and ciphertext
	iv := encrypted[:IVLength]
	ciphertext := encrypted[IVLength:]

	// Decrypt and verify
	plaintext, err := gcm.Open(nil, iv, ciphertext, nil)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt: %w", err)
	}

	return string(plaintext), nil
}

// HashPassword hashes a password using SHA-256 (for master password storage)
// In production, use bcrypt for better security
func HashPassword(password string) string {
	hash := sha256.Sum256([]byte(password))
	return hex.EncodeToString(hash[:])
}

// VerifyPassword verifies a password against a hash
func VerifyPassword(password, hash string) bool {
	computedHash := HashPassword(password)
	return computedHash == hash
}

