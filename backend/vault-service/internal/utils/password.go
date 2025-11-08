package utils

import (
	"crypto/rand"
	"math/big"
	"strings"
)

const (
	Uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
	Lowercase = "abcdefghijklmnopqrstuvwxyz"
	Numbers   = "0123456789"
	Symbols   = "!@#$%^&*()_+-=[]{}|;:,.<>?"
)

// GeneratePassword generates a secure random password
func GeneratePassword(length int, includeUppercase, includeLowercase, includeNumbers, includeSymbols bool) (string, error) {
	if length < 8 {
		length = 20
	}

	var charset strings.Builder
	if includeUppercase {
		charset.WriteString(Uppercase)
	}
	if includeLowercase {
		charset.WriteString(Lowercase)
	}
	if includeNumbers {
		charset.WriteString(Numbers)
	}
	if includeSymbols {
		charset.WriteString(Symbols)
	}

	if charset.Len() == 0 {
		// Default to all character sets if none specified
		charset.WriteString(Uppercase + Lowercase + Numbers + Symbols)
	}

	charsetStr := charset.String()
	password := make([]byte, length)

	for i := range password {
		num, err := rand.Int(rand.Reader, big.NewInt(int64(len(charsetStr))))
		if err != nil {
			return "", err
		}
		password[i] = charsetStr[num.Int64()]
	}

	return string(password), nil
}

// CalculatePasswordStrength calculates password strength (0-100)
func CalculatePasswordStrength(password string) int {
	score := 0

	// Length bonus
	if len(password) >= 8 {
		score += 10
	}
	if len(password) >= 12 {
		score += 10
	}
	if len(password) >= 16 {
		score += 10
	}
	if len(password) >= 20 {
		score += 10
	}

	// Character variety
	hasLower := false
	hasUpper := false
	hasNumber := false
	hasSymbol := false

	for _, char := range password {
		switch {
		case char >= 'a' && char <= 'z':
			hasLower = true
		case char >= 'A' && char <= 'Z':
			hasUpper = true
		case char >= '0' && char <= '9':
			hasNumber = true
		default:
			hasSymbol = true
		}
	}

	if hasLower {
		score += 10
	}
	if hasUpper {
		score += 10
	}
	if hasNumber {
		score += 10
	}
	if hasSymbol {
		score += 10
	}

	// Complexity (unique characters)
	uniqueChars := make(map[rune]bool)
	for _, char := range password {
		uniqueChars[char] = true
	}
	complexityScore := (len(uniqueChars) * 20) / len(password)
	if complexityScore > 20 {
		complexityScore = 20
	}
	score += complexityScore

	if score > 100 {
		score = 100
	}

	return score
}

