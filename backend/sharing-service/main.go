package main

import (
	"log"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/password-manager/sharing-service/internal/config"
	"github.com/password-manager/sharing-service/internal/database"
	"github.com/password-manager/sharing-service/internal/handlers"
	"github.com/password-manager/sharing-service/internal/middleware"
	"github.com/password-manager/sharing-service/internal/repository"
	"github.com/password-manager/sharing-service/internal/service"
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

	// Initialize repositories
	shareRepo := repository.NewShareRepository(db)

	// Initialize services
	shareService := service.NewShareService(shareRepo)

	// Initialize handlers
	shareHandler := handlers.NewShareHandler(shareService)

	// Setup router
	router := gin.Default()

	// CORS middleware
	router.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	// API routes
	api := router.Group("/api/v1")
	{
		// Protected routes (require authentication)
		shares := api.Group("/shares")
		shares.Use(middleware.AuthMiddleware(cfg.JWTSecret))
		{
			// Create share
			shares.POST("", shareHandler.CreateShare)

			// Get shares
			shares.GET("", shareHandler.GetMyShares)                    // Shares I created
			shares.GET("/shared-with-me", shareHandler.GetSharedWithMe) // Items shared with me
			shares.GET("/:id", shareHandler.GetShare)                   // Get specific share
			shares.GET("/vault-item/:vaultItemId", shareHandler.GetSharesByVaultItem)

			// Update share
			shares.PUT("/:id", shareHandler.UpdateShare)

			// Delete/revoke share
			shares.DELETE("/:id", shareHandler.DeleteShare)
			shares.POST("/:id/revoke", shareHandler.RevokeShare)
		}
	}

	port := cfg.Port
	if port == "" {
		port = "3004"
	}

	log.Printf("Sharing service starting on port %s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

