package util

import (
	"bytes"
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

func TestEncryptDecryptTOTPSecret(t *testing.T) {
	key := DeriveTOTPEncryptionKey("unit-test-pepper")
	secret := "JBSWY3DPEHPK3PXP"

	ciphertext, err := EncryptTOTPSecret(secret, key)
	if err != nil {
		t.Fatalf("encrypt totp secret: %v", err)
	}
	if bytes.Contains(ciphertext, []byte(secret)) {
		t.Fatal("ciphertext should not contain plaintext secret")
	}

	decrypted, err := DecryptTOTPSecret(ciphertext, key)
	if err != nil {
		t.Fatalf("decrypt totp secret: %v", err)
	}
	if decrypted != secret {
		t.Fatalf("expected decrypted secret to match, got %q", decrypted)
	}
}

func TestRecoveryCodeHelpers(t *testing.T) {
	codes, err := GenerateRecoveryCodes(10)
	if err != nil {
		t.Fatalf("generate recovery codes: %v", err)
	}
	if len(codes) != 10 {
		t.Fatalf("expected 10 recovery codes, got %d", len(codes))
	}

	normalized := NormalizeRecoveryCode(codes[0])
	if normalized == "" {
		t.Fatal("expected normalized recovery code to be non-empty")
	}

	hashA := HashRecoveryCode(codes[0], "pepper-a")
	hashB := HashRecoveryCode(codes[0], "pepper-a")
	if !bytes.Equal(hashA, hashB) {
		t.Fatal("expected deterministic recovery code hash")
	}
}

func TestArgon2Params(t *testing.T) {
	params := DefaultArgon2Params()
	if params.Memory == 0 || params.Iterations == 0 || params.Parallelism == 0 || params.KeyLength == 0 {
		t.Errorf("DefaultArgon2Params() returned invalid default: %+v", params)
	}

	raw, err := MarshalArgon2Params(params)
	if err != nil {
		t.Fatalf("MarshalArgon2Params() failed: %v", err)
	}

	parsed, err := ParseArgon2Params(raw)
	if err != nil {
		t.Fatalf("ParseArgon2Params() failed: %v", err)
	}

	if params != parsed {
		t.Errorf("ParseArgon2Params() mismatch. expected %+v, got %+v", params, parsed)
	}
}

func TestParseArgon2Params_Invalid(t *testing.T) {
	tests := []struct {
		name string
		raw  []byte
	}{
		{"Empty", []byte("")},
		{"InvalidJSON", []byte(`{invalid`)},
		{"ZeroValues", []byte(`{"memory":0,"iterations":0,"parallelism":0,"key_length":0}`)},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := ParseArgon2Params(tt.raw)
			if err == nil {
				t.Errorf("ParseArgon2Params() expected error for %s", tt.name)
			}
		})
	}
}

func TestOpaqueToken(t *testing.T) {
	token, err := NewOpaqueToken(32)
	if err != nil {
		t.Fatalf("NewOpaqueToken() failed: %v", err)
	}
	if len(token) != 64 { // hex encoding doubles size
		t.Errorf("expected token length 64, got %d", len(token))
	}

	token2, _ := NewOpaqueToken(32)
	if token == token2 {
		t.Error("NewOpaqueToken() generated duplicate tokens")
	}
}

func TestHashToken(t *testing.T) {
	token := "sample_token"
	pepper := "secret_pepper"

	hash1 := HashToken(token, pepper)
	hash2 := HashToken(token, pepper)
	hashDiffToken := HashToken("other_token", pepper)
	hashDiffPepper := HashToken(token, "other_pepper")

	if !bytes.Equal(hash1, hash2) {
		t.Error("HashToken() is not deterministic")
	}

	if bytes.Equal(hash1, hashDiffToken) {
		t.Error("HashToken() generated same hash for different tokens")
	}

	if bytes.Equal(hash1, hashDiffPepper) {
		t.Error("HashToken() generated same hash for different peppers")
	}
}

func TestBuildOTPAuthURL(t *testing.T) {
	url := BuildOTPAuthURL("My App", "user@example.com", "SECRET")
	expected := "otpauth://totp/My+App:user%40example.com?secret=SECRET&issuer=My+App&algorithm=SHA1&digits=6&period=30"
	if url != expected {
		t.Errorf("BuildOTPAuthURL() mismatch.\nExpected: %s\nGot: %s", expected, url)
	}
}
