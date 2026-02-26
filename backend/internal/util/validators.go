package util

import (
	"unicode"

	"pmv2/backend/internal/domain"
)

func ValidatePasswordStrength(password string) error {
	if len(password) < 8 {
		return domain.ErrWeakPassword
	}
	var hasUpper, hasLower, hasNumber, hasSpecial bool
	for _, c := range password {
		switch {
		case unicode.IsUpper(c):
			hasUpper = true
		case unicode.IsLower(c):
			hasLower = true
		case unicode.IsNumber(c):
			hasNumber = true
		case unicode.IsPunct(c) || unicode.IsSymbol(c):
			hasSpecial = true
		}
	}
	if !hasUpper || !hasLower || !hasNumber || !hasSpecial {
		return domain.ErrWeakPassword
	}
	return nil
}
