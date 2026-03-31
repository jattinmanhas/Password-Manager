package config

import (
	"os"
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

	return Config{
		Env:               getenv("APP_ENV", "dev"),
		Port:              getenv("APP_PORT", "8080"),
		ReadTimeout:       mustDuration(getenv("APP_READ_TIMEOUT", "10s")),
		WriteTimeout:      mustDuration(getenv("APP_WRITE_TIMEOUT", "15s")),
		IdleTimeout:       mustDuration(getenv("APP_IDLE_TIMEOUT", "60s")),
		DatabaseURL:       getenv("DATABASE_URL", "postgres://pmv2:pmv2_dev_password@localhost:5432/pmv2?sslmode=disable"),
		SessionTTL:        mustDuration(getenv("SESSION_TTL", "720h")),
		AuthPepper:        getenv("AUTH_TOKEN_PEPPER", "pmv2-dev-pepper-change-me"),
		TOTPIssuer:        getenv("TOTP_ISSUER", "PMV2"),
		FrontendOrigin:    getenv("FRONTEND_ORIGIN", "http://localhost:5173"),
		SessionCookieName: getenv("SESSION_COOKIE_NAME", "pmv2_session"),

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
