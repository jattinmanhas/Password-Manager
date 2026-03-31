package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"pmv2/backend/internal/config"
	"pmv2/backend/internal/database"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Println("Usage: migrate <command>")
		fmt.Println("Commands:")
		fmt.Println("  up    - Apply all migrations")
		fmt.Println("  down  - Rollback migrations")
		fmt.Println("  drop  - Drop all tables")
		os.Exit(1)
	}

	command := os.Args[1]

	cfg := config.Load()
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	postgres, err := database.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("database connection failed: %v", err)
	}
	defer func() {
		if err := postgres.Close(); err != nil {
			log.Printf("database close failed: %v", err)
		}
	}()

	switch command {
	case "up":
		if err := database.MigrateUp(ctx, postgres.SQL()); err != nil {
			log.Fatalf("migrate up failed: %v", err)
		}
		log.Println("migrate up completed successfully")
	case "down":
		if err := database.MigrateDown(ctx, postgres.SQL()); err != nil {
			log.Fatalf("migrate down failed: %v", err)
		}
		log.Println("migrate down completed successfully")
	case "drop":
		if err := database.DropAll(ctx, postgres.SQL()); err != nil {
			log.Fatalf("drop all failed: %v", err)
		}
		log.Println("drop all completed successfully")
	default:
		log.Fatalf("unknown command: %s", command)
	}
}
