package util

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha1"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base32"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/url"
	"strings"
	"time"

	"golang.org/x/crypto/argon2"

	"pmv2/backend/internal/domain"
)

func DefaultArgon2Params() domain.Argon2Params {
	return domain.Argon2Params{
		Memory:      64 * 1024,
		Iterations:  3,
		Parallelism: 2,
		KeyLength:   32,
	}
}

func HashPassword(password string, params domain.Argon2Params) (salt []byte, hash []byte, err error) {
	salt = make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return nil, nil, fmt.Errorf("generate salt: %w", err)
	}
	hash = argon2.IDKey([]byte(password), salt, params.Iterations, params.Memory, params.Parallelism, params.KeyLength)
	return salt, hash, nil
}

func VerifyPassword(password string, salt []byte, expected []byte, params domain.Argon2Params) bool {
	actual := argon2.IDKey([]byte(password), salt, params.Iterations, params.Memory, params.Parallelism, params.KeyLength)
	return subtle.ConstantTimeCompare(actual, expected) == 1
}

func MarshalArgon2Params(params domain.Argon2Params) ([]byte, error) {
	return json.Marshal(params)
}

func ParseArgon2Params(raw []byte) (domain.Argon2Params, error) {
	var params domain.Argon2Params
	if len(raw) == 0 {
		return params, fmt.Errorf("empty argon2 params")
	}
	if err := json.Unmarshal(raw, &params); err != nil {
		return params, fmt.Errorf("parse argon2 params: %w", err)
	}
	if params.KeyLength == 0 || params.Iterations == 0 || params.Memory == 0 || params.Parallelism == 0 {
		return params, fmt.Errorf("invalid argon2 params")
	}
	return params, nil
}

func NewOpaqueToken(size int) (string, error) {
	buf := make([]byte, size)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("generate token: %w", err)
	}
	return hex.EncodeToString(buf), nil
}

func HashToken(token string, pepper string) []byte {
	sum := sha256.Sum256([]byte(pepper + ":" + token))
	return sum[:]
}

func NewUUID() (string, error) {
	raw := make([]byte, 16)
	if _, err := rand.Read(raw); err != nil {
		return "", fmt.Errorf("generate uuid bytes: %w", err)
	}
	raw[6] = (raw[6] & 0x0f) | 0x40
	raw[8] = (raw[8] & 0x3f) | 0x80

	hexStr := hex.EncodeToString(raw)
	return fmt.Sprintf("%s-%s-%s-%s-%s", hexStr[0:8], hexStr[8:12], hexStr[12:16], hexStr[16:20], hexStr[20:32]), nil
}

func NewTOTPSecret() (string, error) {
	secret := make([]byte, 20)
	if _, err := rand.Read(secret); err != nil {
		return "", fmt.Errorf("generate totp secret: %w", err)
	}
	return base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(secret), nil
}

func VerifyTOTP(secret string, code string, now time.Time) bool {
	trimmedCode := strings.TrimSpace(code)
	if len(trimmedCode) != 6 {
		return false
	}

	key, err := base32.StdEncoding.WithPadding(base32.NoPadding).DecodeString(strings.ToUpper(secret))
	if err != nil {
		return false
	}

	for offset := -1; offset <= 1; offset++ {
		candidate := totpCodeForCounter(key, counterFromTime(now, offset))
		if subtle.ConstantTimeCompare([]byte(candidate), []byte(trimmedCode)) == 1 {
			return true
		}
	}

	return false
}

func BuildOTPAuthURL(issuer string, account string, secret string) string {
	escapedIssuer := url.QueryEscape(issuer)
	escapedAccount := url.QueryEscape(account)
	return fmt.Sprintf(
		"otpauth://totp/%s:%s?secret=%s&issuer=%s&algorithm=SHA1&digits=6&period=30",
		escapedIssuer,
		escapedAccount,
		url.QueryEscape(secret),
		escapedIssuer,
	)
}

func counterFromTime(now time.Time, offset int) uint64 {
	seconds := now.Unix() + int64(offset*30)
	if seconds < 0 {
		return 0
	}
	return uint64(seconds / 30)
}

func totpCodeForCounter(secret []byte, counter uint64) string {
	counterBytes := make([]byte, 8)
	binary.BigEndian.PutUint64(counterBytes, counter)

	mac := hmac.New(sha1.New, secret)
	mac.Write(counterBytes)
	hash := mac.Sum(nil)

	offset := hash[len(hash)-1] & 0x0f
	truncated := (uint32(hash[offset])&0x7f)<<24 |
		(uint32(hash[offset+1])&0xff)<<16 |
		(uint32(hash[offset+2])&0xff)<<8 |
		(uint32(hash[offset+3]) & 0xff)
	code := truncated % 1000000

	return fmt.Sprintf("%06d", code)
}
