package config

import (
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	Env               string
	Port              string
	ReadTimeout       time.Duration
	WriteTimeout      time.Duration
	IdleTimeout       time.Duration
	DatabaseURL       string
	SessionTTL        time.Duration
	AuthPepper        string
	TOTPIssuer        string
	FrontendOrigin    string
	SessionCookieName string

	// KDF (Argon2id) parameters for vault key derivation.
	// These are served to the frontend via a public API endpoint.
	KDFMemoryKiB   int
	KDFIterations  int
	KDFParallelism int

	// Logging
	LogLevel       string
	LogFormat      string // "text" or "json"
	LogFilePath    string
	LogMaxSizeMB   int
	LogMaxBackups  int
	LogMaxAgeDays  int
}

func Load() Config {
	_ = godotenv.Load() // Ignore error, as .env might not exist in production

	// Render/Heroku/Railway provide port via PORT env var.
	port := getenv("APP_PORT", getenv("PORT", "8080"))

	return Config{
		Env:               getenv("APP_ENV", "dev"),
		Port:              port,
		ReadTimeout:       mustDuration(getenv("APP_READ_TIMEOUT", "10s")),
		WriteTimeout:      mustDuration(getenv("APP_WRITE_TIMEOUT", "15s")),
		IdleTimeout:       mustDuration(getenv("APP_IDLE_TIMEOUT", "60s")),
		DatabaseURL:       getenv("DATABASE_URL", "postgres://pmv2:pmv2_dev_password@localhost:5432/pmv2?sslmode=disable"),
		SessionTTL:        mustDuration(getenv("SESSION_TTL", "720h")),
		AuthPepper:        getenv("AUTH_TOKEN_PEPPER", "pmv2-dev-pepper-change-me"),
		TOTPIssuer:        getenv("TOTP_ISSUER", "PMV2"),
		FrontendOrigin:    getenv("CORS_ALLOWED_ORIGINS", getenv("FRONTEND_ORIGIN", "http://localhost:5173")),
		SessionCookieName: getenv("SESSION_COOKIE_NAME", "pmv2_session"),

		// KDF defaults match the crypto spec: 64MB, 3 iterations, parallelism 2.
		KDFMemoryKiB:   mustInt(getenv("KDF_MEMORY_KIB", "65536")),
		KDFIterations:  mustInt(getenv("KDF_ITERATIONS", "3")),
		KDFParallelism: mustInt(getenv("KDF_PARALLELISM", "2")),

		// Logging
		LogLevel:      getenv("LOG_LEVEL", "info"),
		LogFormat:     getenv("LOG_FORMAT", "text"),
		LogFilePath:   getenv("LOG_FILE_PATH", "logs/api.log"),
		LogMaxSizeMB:  mustInt(getenv("LOG_MAX_SIZE_MB", "100")),
		LogMaxBackups: mustInt(getenv("LOG_MAX_BACKUPS", "10")),
		LogMaxAgeDays: mustInt(getenv("LOG_MAX_AGE_DAYS", "28")),
	}
}

func getenv(key, fallback string) string {
	val := os.Getenv(key)
	if val == "" {
		return fallback
	}
	return val
}

// ValidateForProduction checks security-critical config values.
// It returns an error if the pepper is the default dev value or too short
// when running in a production environment.
func (c Config) ValidateForProduction() error {
	env := strings.ToLower(strings.TrimSpace(c.Env))
	isProduction := env == "prod" || env == "production" || env == "staging"

	if isProduction {
		if c.AuthPepper == "pmv2-dev-pepper-change-me" {
			return fmt.Errorf("FATAL: AUTH_TOKEN_PEPPER is set to the default dev value in a %q environment. Set a unique, strong pepper via the AUTH_TOKEN_PEPPER env var", c.Env)
		}
		if len(c.AuthPepper) < 32 {
			return fmt.Errorf("FATAL: AUTH_TOKEN_PEPPER is too short (%d chars). Use at least 32 characters for production", len(c.AuthPepper))
		}
	}

	return nil
}

func mustDuration(value string) time.Duration {
	d, err := time.ParseDuration(value)
	if err != nil {
		return 10 * time.Second
	}
	return d
}

func mustInt(value string) int {
	n := 0
	for _, c := range value {
		if c < '0' || c > '9' {
			return 0
		}
		n = n*10 + int(c-'0')
	}
	return n
}
