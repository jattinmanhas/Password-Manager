package main

import (
	"context"
	"log"
	"os"
	"time"

	"pmv2/backend/internal/config"
	"pmv2/backend/internal/database"
	"pmv2/backend/internal/repository"
)

func main() {
	cfg := config.Load()
	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Minute)
	defer cancel()

	// Connect to database
	db, err := database.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Initialize repositories
	authRepo := repository.NewAuthRepository(db.SQL())
	vaultRepo := repository.NewVaultRepository(db.SQL())
	folderRepo := repository.NewPostgresFolderRepository(db.SQL())
	auditRepo := repository.NewAuditRepository(db.SQL())
	familyRepo := repository.NewFamilyRepository(db.SQL())

	// Initialize seeder
	seeder := database.NewSeeder(db, authRepo, vaultRepo, folderRepo, auditRepo, familyRepo, cfg.AuthPepper)

	// Run seeding
	if err := seeder.SeedAll(ctx); err != nil {
		log.Fatalf("Seeding failed: %v", err)
	}

	log.Println("Database seeded successfully!")
	os.Exit(0)
}
