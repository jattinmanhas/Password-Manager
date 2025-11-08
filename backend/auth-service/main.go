package main

import (
	"log"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/password-manager/auth-service/internal/config"
	"github.com/password-manager/auth-service/internal/database"
	"github.com/password-manager/auth-service/internal/handlers"
	"github.com/password-manager/auth-service/internal/middleware"
	"github.com/password-manager/auth-service/internal/redis"
	"github.com/password-manager/auth-service/internal/repository"
	"github.com/password-manager/auth-service/internal/service"
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

	// Initialize database
	db, err := database.New(cfg.GetDBConnectionString())
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Initialize Redis (optional - service will work without it but with limited features)
	redisClient, err := redis.New(cfg.GetRedisAddr(), cfg.RedisPassword, cfg.RedisDB)
	if err != nil {
		log.Printf("Warning: Failed to connect to Redis: %v. Some features will be limited.", err)
		redisClient = nil
	} else {
		defer redisClient.Close()
		log.Println("Successfully connected to Redis")
	}

	// Initialize repositories
	userRepo := repository.NewUserRepository(db)

	// Initialize services
	authService := service.NewAuthService(userRepo, cfg)

	// Initialize handlers
	authHandler := handlers.NewAuthHandler(authService, cfg)

	// Setup router
	router := gin.Default()

	// Add Redis client to context middleware
	router.Use(func(c *gin.Context) {
		if redisClient != nil {
			c.Set("redis_client", redisClient)
		}
		c.Next()
	})

	// Apply rate limiting to auth endpoints
	if redisClient != nil {
		router.Use(middleware.RateLimitMiddleware(redisClient, cfg))
	}

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	// API routes
	api := router.Group("/api/v1")
	{
		auth := api.Group("/auth")
		{
			// Public endpoints
			auth.POST("/register", authHandler.Register)
			auth.POST("/login", authHandler.Login)
			auth.POST("/refresh", authHandler.RefreshToken)
			auth.POST("/forgot-password", authHandler.ForgotPassword)
			auth.POST("/reset-password", authHandler.ResetPassword)

			// Protected endpoints (require authentication)
			protected := auth.Group("")
			protected.Use(middleware.AuthMiddleware(cfg.JWTSecret, redisClient))
			{
				protected.POST("/logout", authHandler.Logout)
				protected.POST("/enable-2fa", authHandler.Enable2FA)
				protected.POST("/verify-2fa", authHandler.Verify2FA)
				protected.POST("/disable-2fa", authHandler.Disable2FA)
				protected.POST("/change-password", authHandler.ChangePassword)
			}
		}
	}

	port := cfg.Port
	if port == "" {
		port = "3001"
	}

	log.Printf("Auth service starting on port %s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
