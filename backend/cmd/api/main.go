package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"pmv2/backend/internal/config"
	"pmv2/backend/internal/database"
	"pmv2/backend/internal/logger"
	"pmv2/backend/internal/repository"
	"pmv2/backend/internal/router"
	"pmv2/backend/internal/service"
)

func main() {
	cfg := config.Load()

	// Initialise structured logger (writes to stdout + rotating file).
	log, logFile := logger.New(cfg)
	defer logFile.Close()

	ctx := context.Background()

	postgres, err := database.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Error("database init failed", slog.Any("error", err))
		os.Exit(1)
	}
	defer func() {
		if err := postgres.Close(); err != nil {
			log.Error("database close failed", slog.Any("error", err))
		}
	}()

	authRepository := repository.NewAuthRepository(postgres.SQL())
	vaultRepository := repository.NewVaultRepository(postgres.SQL())
	folderRepository := repository.NewPostgresFolderRepository(postgres.SQL())
	userKeysRepository := repository.NewUserKeysRepository(postgres.SQL())
	sharingRepository := repository.NewSharingRepository(postgres.SQL())
	familyRepository := repository.NewFamilyRepository(postgres.SQL())

	authService := service.NewAuthService(authRepository, cfg.AuthPepper, cfg.SessionTTL, cfg.TOTPIssuer)
	vaultService := service.NewVaultService(vaultRepository)
	folderService := service.NewFolderService(folderRepository)
	sharingService := service.NewSharingService(sharingRepository, userKeysRepository, vaultRepository, familyRepository)
	familyService := service.NewFamilyService(familyRepository, authRepository)

	go func() {
		ticker := time.NewTicker(1 * time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			deleted, err := authRepository.DeleteExpiredSessions(context.Background())
			if err != nil {
				log.Error("failed to delete expired sessions", slog.Any("error", err))
			} else if deleted > 0 {
				log.Info("deleted expired/revoked sessions", slog.Int64("count", deleted))
			}
		}
	}()

	httpServer := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      router.NewRouter(cfg, log, authService, vaultService, folderService, sharingService, familyService),
		ReadTimeout:  cfg.ReadTimeout,
		WriteTimeout: cfg.WriteTimeout,
		IdleTimeout:  cfg.IdleTimeout,
	}

	go func() {
		log.Info("api listening", slog.String("port", cfg.Port), slog.String("env", cfg.Env))
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Error("server error", slog.Any("error", err))
			os.Exit(1)
		}
	}()

	shutdown(httpServer, log)
}

func shutdown(srv *http.Server, log *slog.Logger) {
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, os.Interrupt, syscall.SIGTERM)
	<-sigCh

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Error("graceful shutdown failed", slog.Any("error", err))
		return
	}

	log.Info("server shutdown complete")
}
