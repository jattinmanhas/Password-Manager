package main

import (
	"log"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/password-manager/sync-service/internal/config"
	"github.com/password-manager/sync-service/internal/database"
	"github.com/password-manager/sync-service/internal/handlers"
	"github.com/password-manager/sync-service/internal/middleware"
	"github.com/password-manager/sync-service/internal/repository"
	"github.com/password-manager/sync-service/internal/service"
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
	changeLogRepo := repository.NewChangeLogRepository(db)
	deviceRepo := repository.NewDeviceRepository(db)

	// Initialize services
	syncService := service.NewSyncService(changeLogRepo, deviceRepo, cfg)

	// Initialize handlers
	syncHandler := handlers.NewSyncHandler(syncService, cfg)

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
		// Protected routes
		sync := api.Group("/sync")
		sync.Use(middleware.AuthMiddleware(cfg.JWTSecret))
		{
			// HTTP sync endpoint
			sync.POST("", syncHandler.Sync)

			// Device management
			sync.POST("/devices", syncHandler.RegisterDevice)
			sync.GET("/devices", syncHandler.GetDevices)
		}

		// WebSocket endpoint (token in query param)
		api.GET("/sync/ws", syncHandler.WebSocketSync)
	}

	port := cfg.Port
	if port == "" {
		port = "3003"
	}

	log.Printf("Sync service starting on port %s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

