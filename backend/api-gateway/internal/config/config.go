package config

import (
	"os"
	"strconv"
	"strings"
)

type Config struct {
	// Server
	Port        string
	Environment string

	// Backend Services
	AuthServiceURL    string
	VaultServiceURL   string
	SyncServiceURL    string
	SharingServiceURL string

	// Redis (for rate limiting)
	RedisHost     string
	RedisPort     string
	RedisPassword string
	RedisDB       int

	// Rate Limiting
	RateLimitEnabled bool
	RateLimitRequests int // requests per window
	RateLimitWindow   int // window in seconds

	// CORS
	CORSAllowedOrigins []string
	CORSAllowedMethods []string
	CORSAllowedHeaders []string

	// Logging
	LogRequests bool
	LogLevel    string // debug, info, warn, error
}

func Load() *Config {
	return &Config{
		// Server
		Port:        getEnv("PORT", "3000"),
		Environment: getEnv("ENVIRONMENT", "development"),

		// Backend Services
		AuthServiceURL:    getEnv("AUTH_SERVICE_URL", "http://localhost:3001"),
		VaultServiceURL:   getEnv("VAULT_SERVICE_URL", "http://localhost:3002"),
		SyncServiceURL:    getEnv("SYNC_SERVICE_URL", "http://localhost:3003"),
		SharingServiceURL: getEnv("SHARING_SERVICE_URL", "http://localhost:3004"),

		// Redis
		RedisHost:     getEnv("REDIS_HOST", "localhost"),
		RedisPort:     getEnv("REDIS_PORT", "6379"),
		RedisPassword: getEnv("REDIS_PASSWORD", ""),
		RedisDB:       getEnvAsInt("REDIS_DB", 0),

		// Rate Limiting
		RateLimitEnabled:  getEnvAsBool("RATE_LIMIT_ENABLED", true),
		RateLimitRequests: getEnvAsInt("RATE_LIMIT_REQUESTS", 100),
		RateLimitWindow:   getEnvAsInt("RATE_LIMIT_WINDOW", 60),

		// CORS
		CORSAllowedOrigins: getEnvAsSlice("CORS_ALLOWED_ORIGINS", []string{"*"}),
		CORSAllowedMethods: getEnvAsSlice("CORS_ALLOWED_METHODS", []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"}),
		CORSAllowedHeaders: getEnvAsSlice("CORS_ALLOWED_HEADERS", []string{"Content-Type", "Authorization", "X-Requested-With"}),

		// Logging
		LogRequests: getEnvAsBool("LOG_REQUESTS", true),
		LogLevel:    getEnv("LOG_LEVEL", "info"),
	}
}

func (c *Config) GetRedisAddr() string {
	return c.RedisHost + ":" + c.RedisPort
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvAsInt(key string, defaultValue int) int {
	valueStr := os.Getenv(key)
	if valueStr == "" {
		return defaultValue
	}
	value, err := strconv.Atoi(valueStr)
	if err != nil {
		return defaultValue
	}
	return value
}

func getEnvAsBool(key string, defaultValue bool) bool {
	valueStr := os.Getenv(key)
	if valueStr == "" {
		return defaultValue
	}
	value, err := strconv.ParseBool(valueStr)
	if err != nil {
		return defaultValue
	}
	return value
}

func getEnvAsSlice(key string, defaultValue []string) []string {
	valueStr := os.Getenv(key)
	if valueStr == "" {
		return defaultValue
	}
	return strings.Split(valueStr, ",")
}

