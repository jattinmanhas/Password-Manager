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

	// Database
	DBHost     string
	DBPort     string
	DBUser     string
	DBPassword string
	DBName     string
	DBSSLMode  string
}

func Load() *Config {
	return &Config{
		// Server
		Port:        getEnv("PORT", "3002"),
		Environment: getEnv("ENVIRONMENT", "development"),
		JWTSecret:   getEnv("JWT_SECRET", "change-me-in-production"),

		// Database
		DBHost:     getEnv("DB_HOST", "localhost"),
		DBPort:     getEnv("DB_PORT", "5432"),
		DBUser:     getEnv("DB_USER", "pm_user"),
		DBPassword: getEnv("DB_PASSWORD", "pm_password"),
		DBName:     getEnv("DB_NAME", "password_manager"),
		DBSSLMode:  getEnv("DB_SSLMODE", "disable"),
	}
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

