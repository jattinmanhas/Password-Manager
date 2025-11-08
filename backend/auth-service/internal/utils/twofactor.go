package utils

import (
	"crypto/rand"
	"encoding/base32"
	"encoding/base64"
	"fmt"
	"math/big"

	"github.com/pquerna/otp"
	"github.com/pquerna/otp/totp"
)

// GenerateTOTPSecret generates a new TOTP secret
func GenerateTOTPSecret() (string, error) {
	secret, err := totp.Generate(totp.GenerateOpts{
		Issuer:      "Password Manager",
		AccountName: "user@example.com", // This should be passed as parameter
	})
	if err != nil {
		return "", err
	}
	return secret.Secret(), nil
}

// GenerateTOTPSecretWithAccount generates a TOTP secret for a specific account
func GenerateTOTPSecretWithAccount(issuer, accountName string) (*otp.Key, error) {
	return totp.Generate(totp.GenerateOpts{
		Issuer:      issuer,
		AccountName: accountName,
	})
}

// ValidateTOTP validates a TOTP code
func ValidateTOTP(secret, code string) bool {
	return totp.Validate(code, secret)
}

// GenerateBackupCodes generates backup codes for 2FA
func GenerateBackupCodes(count int) ([]string, error) {
	codes := make([]string, count)
	for i := 0; i < count; i++ {
		// Generate 8-digit code
		num, err := rand.Int(rand.Reader, big.NewInt(100000000))
		if err != nil {
			return nil, err
		}
		codes[i] = fmt.Sprintf("%08d", num.Int64())
	}
	return codes, nil
}

// EncryptBackupCodes encrypts backup codes for storage
func EncryptBackupCodes(codes []string, key []byte) (string, error) {
	// Simple base64 encoding for now
	// In production, use proper encryption
	combined := ""
	for i, code := range codes {
		if i > 0 {
			combined += ","
		}
		combined += code
	}
	return base64.StdEncoding.EncodeToString([]byte(combined)), nil
}

// DecryptBackupCodes decrypts backup codes from storage
func DecryptBackupCodes(encrypted string, key []byte) ([]string, error) {
	decoded, err := base64.StdEncoding.DecodeString(encrypted)
	if err != nil {
		return nil, err
	}
	
	codes := []string{}
	current := ""
	for _, b := range decoded {
		if b == ',' {
			if current != "" {
				codes = append(codes, current)
				current = ""
			}
		} else {
			current += string(b)
		}
	}
	if current != "" {
		codes = append(codes, current)
	}
	
	return codes, nil
}

// GenerateRandomSecret generates a random secret (for encryption)
func GenerateRandomSecret(length int) ([]byte, error) {
	secret := make([]byte, length)
	_, err := rand.Read(secret)
	return secret, err
}

// Base32Encode encodes bytes to base32 string
func Base32Encode(data []byte) string {
	return base32.StdEncoding.EncodeToString(data)
}

// Base32Decode decodes base32 string to bytes
func Base32Decode(data string) ([]byte, error) {
	return base32.StdEncoding.DecodeString(data)
}

