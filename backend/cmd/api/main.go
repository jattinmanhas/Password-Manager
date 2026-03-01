package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"pmv2/backend/internal/config"
	"pmv2/backend/internal/database"
	"pmv2/backend/internal/repository"
	"pmv2/backend/internal/router"
	"pmv2/backend/internal/service"
)

func main() {
	cfg := config.Load()
	ctx := context.Background()

	postgres, err := database.OpenAndMigrate(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("database init failed: %v", err)
	}
	defer func() {
		if err := postgres.Close(); err != nil {
			log.Printf("database close failed: %v", err)
		}
	}()

	authRepository := repository.NewAuthRepository(postgres.SQL())
	vaultRepository := repository.NewVaultRepository(postgres.SQL())
	authService := service.NewAuthService(authRepository, cfg.AuthPepper, cfg.SessionTTL, cfg.TOTPIssuer)
	vaultService := service.NewVaultService(vaultRepository)

	go func() {
		ticker := time.NewTicker(1 * time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			deleted, err := authRepository.DeleteExpiredSessions(context.Background())
			if err != nil {
				log.Printf("failed to delete expired sessions: %v", err)
			} else if deleted > 0 {
				log.Printf("deleted %d expired/revoked sessions", deleted)
			}
		}
	}()

	httpServer := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      router.NewRouter(cfg, authService, vaultService),
		ReadTimeout:  cfg.ReadTimeout,
		WriteTimeout: cfg.WriteTimeout,
		IdleTimeout:  cfg.IdleTimeout,
	}

	go func() {
		log.Printf("api listening on :%s (%s)", cfg.Port, cfg.Env)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	shutdown(httpServer)
}

func shutdown(srv *http.Server) {
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, os.Interrupt, syscall.SIGTERM)
	<-sigCh

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("graceful shutdown failed: %v", err)
		return
	}

	log.Println("server shutdown complete")
}
