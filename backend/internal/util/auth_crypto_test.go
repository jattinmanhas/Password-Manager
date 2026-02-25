package util

import (
	"testing"
	"time"
)

func TestHashAndVerifyPassword(t *testing.T) {
	params := DefaultArgon2Params()
	salt, hash, err := HashPassword("correct horse battery staple", params)
	if err != nil {
		t.Fatalf("hash password: %v", err)
	}

	if !VerifyPassword("correct horse battery staple", salt, hash, params) {
		t.Fatal("expected password to validate")
	}
	if VerifyPassword("wrong password", salt, hash, params) {
		t.Fatal("expected wrong password to fail")
	}
}

func TestVerifyTOTP(t *testing.T) {
	secret := "JBSWY3DPEHPK3PXP"
	now := time.Unix(0, 0).UTC()

	if !VerifyTOTP(secret, "282760", now) {
		t.Fatal("expected known RFC-compatible code to validate")
	}
	if VerifyTOTP(secret, "000000", now) {
		t.Fatal("expected incorrect code to fail")
	}
}
