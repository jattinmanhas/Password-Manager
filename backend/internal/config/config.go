package config

import (
	"os"
	"time"
)

type Config struct {
	Env          string
	Port         string
	ReadTimeout  time.Duration
	WriteTimeout time.Duration
	IdleTimeout  time.Duration
	DatabaseURL  string
	SessionTTL   time.Duration
	AuthPepper   string
	TOTPIssuer   string
}

func Load() Config {
	return Config{
		Env:          getenv("APP_ENV", "dev"),
		Port:         getenv("APP_PORT", "8080"),
		ReadTimeout:  mustDuration(getenv("APP_READ_TIMEOUT", "10s")),
		WriteTimeout: mustDuration(getenv("APP_WRITE_TIMEOUT", "15s")),
		IdleTimeout:  mustDuration(getenv("APP_IDLE_TIMEOUT", "60s")),
		DatabaseURL:  getenv("DATABASE_URL", "postgres://pmv2:pmv2_dev_password@localhost:5432/pmv2?sslmode=disable"),
		SessionTTL:   mustDuration(getenv("SESSION_TTL", "720h")),
		AuthPepper:   getenv("AUTH_TOKEN_PEPPER", "pmv2-dev-pepper-change-me"),
		TOTPIssuer:   getenv("TOTP_ISSUER", "PMV2"),
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
