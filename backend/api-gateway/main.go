package main

import (
	"log"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/password-manager/api-gateway/internal/config"
	"github.com/password-manager/api-gateway/internal/health"
	"github.com/password-manager/api-gateway/internal/middleware"
	"github.com/password-manager/api-gateway/internal/proxy"
	"github.com/password-manager/api-gateway/internal/redis"
)

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	cfg := config.Load()

	// Set Gin mode
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	// Initialize Redis (optional, for rate limiting)
	var redisClient *redis.Client
	if cfg.RateLimitEnabled {
		var err error
		redisClient, err = redis.New(cfg.GetRedisAddr(), cfg.RedisPassword, cfg.RedisDB)
		if err != nil {
			log.Printf("Warning: Failed to connect to Redis: %v. Rate limiting disabled.", err)
			cfg.RateLimitEnabled = false
		} else {
			defer redisClient.Close()
			log.Println("Connected to Redis")
		}
	}

	// Initialize proxies
	authProxy := proxy.NewProxy(cfg.AuthServiceURL)
	vaultProxy := proxy.NewProxy(cfg.VaultServiceURL)
	syncProxy := proxy.NewProxy(cfg.SyncServiceURL)
	sharingProxy := proxy.NewProxy(cfg.SharingServiceURL)

	// Initialize health checker
	healthChecker := health.NewHealthChecker(map[string]string{
		"auth-service":    cfg.AuthServiceURL,
		"vault-service":   cfg.VaultServiceURL,
		"sync-service":    cfg.SyncServiceURL,
		"sharing-service": cfg.SharingServiceURL,
	})

	// Setup router
	router := gin.Default()

	// CORS middleware
	corsConfig := cors.DefaultConfig()
	corsConfig.AllowOrigins = cfg.CORSAllowedOrigins
	corsConfig.AllowMethods = cfg.CORSAllowedMethods
	corsConfig.AllowHeaders = cfg.CORSAllowedHeaders
	corsConfig.AllowCredentials = true
	router.Use(cors.New(corsConfig))

	// Logging middleware
	if cfg.LogRequests {
		router.Use(middleware.RequestLoggingMiddleware())
	}

	// Rate limiting middleware
	if cfg.RateLimitEnabled && redisClient != nil {
		rateLimiter := middleware.NewRateLimiter(
			redisClient.Client,
			cfg.RateLimitEnabled,
			cfg.RateLimitRequests,
			cfg.RateLimitWindow,
		)
		router.Use(rateLimiter.Middleware())
	}

	// Health check (aggregated)
	router.GET("/health", healthChecker.CheckHealth)

	// API routes
	api := router.Group("/api/v1")
	{
		// Auth service routes
		auth := api.Group("/auth")
		{
			auth.Any("/*path", authProxy.Handle)
		}

		// Vault service routes
		vault := api.Group("/vault")
		{
			vault.Any("/*path", vaultProxy.Handle)
		}

		// Sync service routes
		sync := api.Group("/sync")
		{
			sync.Any("/*path", syncProxy.Handle)
		}

		// Sharing service routes
		shares := api.Group("/shares")
		{
			shares.Any("/*path", sharingProxy.Handle)
		}
	}

	port := cfg.Port
	if port == "" {
		port = "3000"
	}

	log.Printf("API Gateway starting on port %s", port)
	log.Printf("Routing to services:")
	log.Printf("  - Auth Service:    %s", cfg.AuthServiceURL)
	log.Printf("  - Vault Service:   %s", cfg.VaultServiceURL)
	log.Printf("  - Sync Service:    %s", cfg.SyncServiceURL)
	log.Printf("  - Sharing Service: %s", cfg.SharingServiceURL)

	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

