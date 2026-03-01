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

func NewRouter(cfg config.Config, authService *service.AuthService, vaultService *service.VaultService) http.Handler {
	authController := controller.NewAuthController(authService, controller.AuthCookieConfig{
		Name:   cfg.SessionCookieName,
		Secure: isProductionEnv(cfg.Env),
	})
	vaultController := controller.NewVaultController(vaultService)
	authMiddleware := middlewares.NewAuthMiddleware(authService, cfg.SessionCookieName)
	mux := http.NewServeMux()

	authLimiter := middlewares.NewRateLimiter(rate.Limit(5), 15)
	root := newRouteGroup(mux, "/")
	v1 := root.Group("/api/v1")
	auth := v1.Group("/auth")
	vault := v1.Group("/vault")

	root.Handle(http.MethodGet, "/healthz", func(w http.ResponseWriter, r *http.Request) {
		util.WriteJSON(w, http.StatusOK, dto.HealthResponse{
			Status:  "ok",
			Service: "pmv2-api",
			Time:    time.Now().UTC().Format(time.RFC3339),
			Env:     cfg.Env,
		})
	})

	auth.Handle(http.MethodPost, "/register", authController.HandleRegister, authLimiter.Middleware)
	auth.Handle(http.MethodPost, "/login", authController.HandleLogin, authLimiter.Middleware)
	auth.Handle(http.MethodGet, "/me", authMiddleware.WithSession(authController.HandleMe))
	auth.Handle(http.MethodPost, "/logout", authMiddleware.WithSession(authController.HandleLogout))
	auth.Handle(http.MethodPost, "/totp/setup", authMiddleware.WithSession(authController.HandleTOTPSetup))
	auth.Handle(http.MethodPost, "/totp/enable", authMiddleware.WithSession(authController.HandleTOTPEnable))
	auth.Handle(http.MethodPost, "/totp/verify", authMiddleware.WithSession(authController.HandleTOTPVerify))
	auth.Handle(http.MethodPost, "/totp/disable", authMiddleware.WithSession(authController.HandleTOTPDisable))
	vault.Handle(http.MethodPost, "/items", authMiddleware.WithSession(vaultController.HandleCreateItem))
	vault.Handle(http.MethodGet, "/items", authMiddleware.WithSession(vaultController.HandleListItems))
	vault.Handle(http.MethodGet, "/items/{item_id}", authMiddleware.WithSession(vaultController.HandleGetItem))
	vault.Handle(http.MethodPut, "/items/{item_id}", authMiddleware.WithSession(vaultController.HandleUpdateItem))
	vault.Handle(http.MethodDelete, "/items/{item_id}", authMiddleware.WithSession(vaultController.HandleDeleteItem))

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
