package encryption

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"

	"crypto/sha256"
	"golang.org/x/crypto/pbkdf2"
)

const (
	KeyLength   = 32 // 256 bits for AES-256
	SaltLength  = 32
	IVLength    = 12 // 96 bits for GCM
	TagLength   = 16 // 128 bits for GCM tag
	DefaultIter = 100000
)

func DeriveKey(password string, salt []byte, iterations int) []byte {
	if iterations <= 0 {
		iterations = DefaultIter
	}
	return pbkdf2.Key([]byte(password), salt, iterations, KeyLength, sha256.New)
}

func GenerateSalt() ([]byte, error) {
	salt := make([]byte, SaltLength)
	if _, err := rand.Read(salt); err != nil {
		return nil, fmt.Errorf("failed to generate salt: %w", err)
	}
	return salt, nil
}

func Encrypt(plaintext string, key []byte) (string, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("failed to create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("failed to create GCM: %w", err)
	}

	iv := make([]byte, IVLength)
	if _, err := io.ReadFull(rand.Reader, iv); err != nil {
		return "", fmt.Errorf("failed to generate IV: %w", err)
	}

	ciphertext := gcm.Seal(nil, iv, []byte(plaintext), nil)
	result := append(iv, ciphertext...)
	return hex.EncodeToString(result), nil
}

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

	iv := encrypted[:IVLength]
	ciphertext := encrypted[IVLength:]

	plaintext, err := gcm.Open(nil, iv, ciphertext, nil)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt: %w", err)
	}

	return string(plaintext), nil
}

