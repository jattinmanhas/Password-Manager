package config

import (
	"os"
	"strconv"
)

type Config struct {
	// Server
	Port        string
	Environment string

	// JWT
	JWTSecret string

	// Database
	DBHost     string
	DBPort     string
	DBUser     string
	DBPassword string
	DBName     string
	DBSSLMode  string

	// Redis
	RedisHost     string
	RedisPort     string
	RedisPassword string
	RedisDB       int

	// WebSocket
	WebSocketReadBufferSize  int
	WebSocketWriteBufferSize int
	WebSocketPongWait        int // seconds
	WebSocketPingPeriod      int // seconds
}

func Load() *Config {
	return &Config{
		// Server
		Port:        getEnv("PORT", "3003"),
		Environment: getEnv("ENVIRONMENT", "development"),

		// JWT
		JWTSecret: getEnv("JWT_SECRET", "change-me-in-production"),

		// Database
		DBHost:     getEnv("DB_HOST", "localhost"),
		DBPort:     getEnv("DB_PORT", "5432"),
		DBUser:     getEnv("DB_USER", "pm_user"),
		DBPassword: getEnv("DB_PASSWORD", "pm_password"),
		DBName:     getEnv("DB_NAME", "password_manager"),
		DBSSLMode:  getEnv("DB_SSLMODE", "disable"),

		// Redis
		RedisHost:     getEnv("REDIS_HOST", "localhost"),
		RedisPort:     getEnv("REDIS_PORT", "6379"),
		RedisPassword: getEnv("REDIS_PASSWORD", ""),
		RedisDB:       getEnvAsInt("REDIS_DB", 0),

		// WebSocket
		WebSocketReadBufferSize:  getEnvAsInt("WS_READ_BUFFER_SIZE", 1024),
		WebSocketWriteBufferSize: getEnvAsInt("WS_WRITE_BUFFER_SIZE", 1024),
		WebSocketPongWait:        getEnvAsInt("WS_PONG_WAIT", 60),
		WebSocketPingPeriod:      getEnvAsInt("WS_PING_PERIOD", 54),
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

