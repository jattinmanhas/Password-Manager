package config

import (
	"os"
	"strconv"
)

type Config struct {
	// Server
	Port        string
	Environment string
	JWTSecret   string
	JWTExpiry   int // hours

	// Database
	DBHost     string
	DBPort     string
	DBUser     string
	DBPassword string
	DBName     string
	DBSSLMode  string

	// Encryption
	PBKDF2Iterations int
	BcryptCost       int // bcrypt cost factor (4-31, recommended: 12-14)

	// Redis
	RedisHost     string
	RedisPort     string
	RedisPassword string
	RedisDB       int

	// Rate Limiting
	RateLimitRequests int // requests per window
	RateLimitWindow   int // window in seconds

	// Password Reset
	ResetTokenExpiry int // minutes

	// Email (for password reset - optional)
	SMTPHost     string
	SMTPPort     string
	SMTPUser     string
	SMTPPassword string
	SMTPFrom     string
}

func Load() *Config {
	return &Config{
		// Server
		Port:        getEnv("PORT", "3001"),
		Environment: getEnv("ENVIRONMENT", "development"),
		JWTSecret:   getEnv("JWT_SECRET", "change-me-in-production"),
		JWTExpiry:   getEnvAsInt("JWT_EXPIRY_HOURS", 24),

		// Database
		DBHost:     getEnv("DB_HOST", "localhost"),
		DBPort:     getEnv("DB_PORT", "5432"),
		DBUser:     getEnv("DB_USER", "pm_user"),
		DBPassword: getEnv("DB_PASSWORD", "pm_password"),
		DBName:     getEnv("DB_NAME", "password_manager"),
		DBSSLMode:  getEnv("DB_SSLMODE", "disable"),

		// Encryption
		PBKDF2Iterations: getEnvAsInt("PBKDF2_ITERATIONS", 100000),
		BcryptCost:       getEnvAsInt("BCRYPT_COST", 12),

		// Redis
		RedisHost:     getEnv("REDIS_HOST", "localhost"),
		RedisPort:     getEnv("REDIS_PORT", "6379"),
		RedisPassword: getEnv("REDIS_PASSWORD", ""),
		RedisDB:       getEnvAsInt("REDIS_DB", 0),

		// Rate Limiting
		RateLimitRequests: getEnvAsInt("RATE_LIMIT_REQUESTS", 5),
		RateLimitWindow:   getEnvAsInt("RATE_LIMIT_WINDOW", 60),

		// Password Reset
		ResetTokenExpiry: getEnvAsInt("RESET_TOKEN_EXPIRY_MINUTES", 30),

		// Email
		SMTPHost:     getEnv("SMTP_HOST", ""),
		SMTPPort:     getEnv("SMTP_PORT", "587"),
		SMTPUser:     getEnv("SMTP_USER", ""),
		SMTPPassword: getEnv("SMTP_PASSWORD", ""),
		SMTPFrom:     getEnv("SMTP_FROM", ""),
	}
}

func (c *Config) GetRedisAddr() string {
	return c.RedisHost + ":" + c.RedisPort
}

func (c *Config) GetDBConnectionString() string {
	return "host=" + c.DBHost +
		" port=" + c.DBPort +
		" user=" + c.DBUser +
		" password=" + c.DBPassword +
		" dbname=" + c.DBName +
		" sslmode=" + c.DBSSLMode
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
