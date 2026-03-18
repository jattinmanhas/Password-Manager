package router

import (
	"net/http"
	"strings"
	"time"

	"pmv2/backend/internal/config"
	"pmv2/backend/internal/controller"
	"pmv2/backend/internal/dto"
	"pmv2/backend/internal/middlewares"
	"pmv2/backend/internal/service"
	"pmv2/backend/internal/util"

	"golang.org/x/time/rate"
)

type handlerMiddleware func(http.HandlerFunc) http.HandlerFunc

type routeGroup struct {
	mux         *http.ServeMux
	prefix      string
	middlewares []handlerMiddleware
}

func newRouteGroup(mux *http.ServeMux, prefix string, middlewares ...handlerMiddleware) routeGroup {
	return routeGroup{
		mux:         mux,
		prefix:      joinPath("", prefix),
		middlewares: append([]handlerMiddleware(nil), middlewares...),
	}
}

func (g routeGroup) Group(prefix string, middlewares ...handlerMiddleware) routeGroup {
	combined := make([]handlerMiddleware, 0, len(g.middlewares)+len(middlewares))
	combined = append(combined, g.middlewares...)
	combined = append(combined, middlewares...)
	return routeGroup{
		mux:         g.mux,
		prefix:      joinPath(g.prefix, prefix),
		middlewares: combined,
	}
}

func (g routeGroup) Handle(method string, path string, handler http.HandlerFunc, middlewares ...handlerMiddleware) {
	pattern := joinPath(g.prefix, path)
	method = strings.ToUpper(strings.TrimSpace(method))
	if method != "" {
		pattern = method + " " + pattern
	}

	allMiddlewares := make([]handlerMiddleware, 0, len(g.middlewares)+len(middlewares))
	allMiddlewares = append(allMiddlewares, g.middlewares...)
	allMiddlewares = append(allMiddlewares, middlewares...)

	for i := len(allMiddlewares) - 1; i >= 0; i-- {
		handler = allMiddlewares[i](handler)
	}

	g.mux.HandleFunc(pattern, handler)
}

func NewRouter(cfg config.Config, authService *service.AuthService, vaultService *service.VaultService, folderService *service.FolderService, sharingService *service.SharingService) http.Handler {
	authController := controller.NewAuthController(authService, controller.AuthCookieConfig{
		Name:   cfg.SessionCookieName,
		Secure: isProductionEnv(cfg.Env),
	})
	vaultController := controller.NewVaultController(vaultService)
	folderController := controller.NewFolderController(folderService)
	sharingController := controller.NewSharingController(sharingService)
	authMiddleware := middlewares.NewAuthMiddleware(authService, cfg.SessionCookieName)
	mux := http.NewServeMux()

	authLimiter := middlewares.NewRateLimiter(rate.Limit(5), 15)
	root := newRouteGroup(mux, "/")
	v1 := root.Group("/api/v1")
	auth := v1.Group("/auth")
	vault := v1.Group("/vault")
	folders := v1.Group("/folders")
	users := v1.Group("/users")

	// Health check
	root.Handle(http.MethodGet, "/healthz", func(w http.ResponseWriter, r *http.Request) {
		util.WriteJSON(w, http.StatusOK, dto.HealthResponse{
			Status:  "ok",
			Service: "pmv2-api",
			Time:    time.Now().UTC().Format(time.RFC3339),
			Env:     cfg.Env,
		})
	})

	// Auth routes - Unauthenticated
	auth.Handle(http.MethodPost, "/register", authController.HandleRegister, authLimiter.Middleware)
	auth.Handle(http.MethodPost, "/login", authController.HandleLogin, authLimiter.Middleware)
	auth.Handle(http.MethodPost, "/recovery/verify", authController.HandleRecoveryVerify, authLimiter.Middleware)
	auth.Handle(http.MethodPost, "/recovery/reset", authController.HandleRecoveryReset, authLimiter.Middleware)

	// Auth routes - Authenticated
	auth.Handle(http.MethodGet, "/me", authMiddleware.WithSession(authController.HandleMe))
	auth.Handle(http.MethodPost, "/logout", authMiddleware.WithSession(authController.HandleLogout))

	// TOTP routes
	auth.Handle(http.MethodPost, "/totp/setup", authMiddleware.WithSession(authController.HandleTOTPSetup))
	auth.Handle(http.MethodPost, "/totp/enable", authMiddleware.WithSession(authController.HandleTOTPEnable))
	auth.Handle(http.MethodPost, "/totp/verify", authMiddleware.WithSession(authController.HandleTOTPVerify))
	auth.Handle(http.MethodPost, "/totp/disable", authMiddleware.WithSession(authController.HandleTOTPDisable))

	// Recovery setup
	auth.Handle(http.MethodGet, "/recovery/status", authMiddleware.WithSession(authController.HandleGetRecoveryStatus))
	auth.Handle(http.MethodPost, "/recovery/setup", authMiddleware.WithSession(authController.HandleRecoverySetup))

	// Folder routes
	folders.Handle(http.MethodPost, "", authMiddleware.WithSession(folderController.HandleCreateFolder))
	folders.Handle(http.MethodGet, "", authMiddleware.WithSession(folderController.HandleListFolders))
	folders.Handle(http.MethodPut, "/{folder_id}", authMiddleware.WithSession(folderController.HandleUpdateFolder))
	folders.Handle(http.MethodDelete, "/{folder_id}", authMiddleware.WithSession(folderController.HandleDeleteFolder))

	// Vault routes
	vault.Handle(http.MethodGet, "/salt", authMiddleware.WithSession(vaultController.HandleGetVaultSalt))
	vault.Handle(http.MethodPost, "/items", authMiddleware.WithSession(vaultController.HandleCreateItem))
	vault.Handle(http.MethodGet, "/items", authMiddleware.WithSession(vaultController.HandleListItems))
	vault.Handle(http.MethodGet, "/items/{item_id}", authMiddleware.WithSession(vaultController.HandleGetItem))
	vault.Handle(http.MethodPut, "/items/{item_id}", authMiddleware.WithSession(vaultController.HandleUpdateItem))
	vault.Handle(http.MethodDelete, "/items/{item_id}", authMiddleware.WithSession(vaultController.HandleDeleteItem))

	// Sharing routes
	vault.Handle(http.MethodGet, "/shared", authMiddleware.WithSession(sharingController.HandleListSharedWithMe))
	vault.Handle(http.MethodPost, "/items/{item_id}/shares", authMiddleware.WithSession(sharingController.HandleShareItem))
	vault.Handle(http.MethodGet, "/items/{item_id}/shares", authMiddleware.WithSession(sharingController.HandleListSharesForItem))
	vault.Handle(http.MethodDelete, "/items/{item_id}/shares/{user_id}", authMiddleware.WithSession(sharingController.HandleRevokeShare))

	// User keys routes
	users.Handle(http.MethodPut, "/keys", authMiddleware.WithSession(sharingController.HandleUpsertKeys))
	users.Handle(http.MethodGet, "/keys", authMiddleware.WithSession(sharingController.HandleGetMyKeys))
	users.Handle(http.MethodGet, "/keys/lookup", authMiddleware.WithSession(sharingController.HandleGetPublicKey))

	root.Handle("", "/", func(w http.ResponseWriter, r *http.Request) {
		util.WriteJSON(w, http.StatusNotFound, dto.ErrorResponse{Error: "not_found", Message: "route not found"})
	})

	return middlewares.CORS(cfg.FrontendOrigin, middlewares.WithSecurityHeaders(mux))
}

func joinPath(prefix string, path string) string {
	cleanPrefix := strings.Trim(strings.TrimSpace(prefix), "/")
	cleanPath := strings.Trim(strings.TrimSpace(path), "/")

	switch {
	case cleanPrefix == "" && cleanPath == "":
		return "/"
	case cleanPrefix == "":
		return "/" + cleanPath
	case cleanPath == "":
		return "/" + cleanPrefix
	default:
		return "/" + cleanPrefix + "/" + cleanPath
	}
}

func isProductionEnv(env string) bool {
	normalized := strings.ToLower(strings.TrimSpace(env))
	return normalized == "prod" || normalized == "production"
}
