package main

import (
	"log"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/password-manager/vault-service/internal/config"
	"github.com/password-manager/vault-service/internal/database"
	"github.com/password-manager/vault-service/internal/handlers"
	"github.com/password-manager/vault-service/internal/middleware"
	"github.com/password-manager/vault-service/internal/repository"
	"github.com/password-manager/vault-service/internal/service"
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
	vaultRepo := repository.NewVaultRepository(db)
	folderRepo := repository.NewFolderRepository(db)

	// Initialize services
	vaultService := service.NewVaultService(vaultRepo, folderRepo, cfg)

	// Initialize handlers
	vaultHandler := handlers.NewVaultHandler(vaultService, cfg)

	// Setup router
	router := gin.Default()

	// CORS middleware (adjust for production)
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
		vault := api.Group("/vault")
		vault.Use(middleware.AuthMiddleware(cfg.JWTSecret))
		{
			// Vault items
			vault.GET("/items", vaultHandler.GetItems)
			vault.GET("/items/:id", vaultHandler.GetItem)
			vault.POST("/items", vaultHandler.CreateItem)
			vault.PUT("/items/:id", vaultHandler.UpdateItem)
			vault.DELETE("/items/:id", vaultHandler.DeleteItem)
			vault.POST("/items/search", vaultHandler.SearchItems)

			// Password generation
			vault.POST("/generate-password", vaultHandler.GeneratePassword)

			// Folders
			vault.GET("/folders", vaultHandler.GetFolders)
			vault.POST("/folders", vaultHandler.CreateFolder)
			vault.PUT("/folders/:id", vaultHandler.UpdateFolder)
			vault.DELETE("/folders/:id", vaultHandler.DeleteFolder)
		}
	}

	port := cfg.Port
	if port == "" {
		port = "3002"
	}

	log.Printf("Vault service starting on port %s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

