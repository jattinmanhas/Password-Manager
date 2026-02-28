package middlewares

import (
	"net/http"
	"strings"

	"pmv2/backend/internal/domain"
	"pmv2/backend/internal/service"
	"pmv2/backend/internal/util"
)

type AuthMiddleware struct {
	auth              *service.AuthService
	sessionCookieName string
}

func NewAuthMiddleware(authService *service.AuthService, sessionCookieName string) *AuthMiddleware {
	return &AuthMiddleware{
		auth:              authService,
		sessionCookieName: sessionCookieName,
	}
}

func (m *AuthMiddleware) WithSession(next func(http.ResponseWriter, *http.Request, domain.Session)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token := m.sessionTokenFromRequest(r)
		if token == "" {
			util.WriteError(w, http.StatusUnauthorized, "unauthorized", "missing session token")
			return
		}

		session, err := m.auth.Authenticate(r.Context(), token)
		if err != nil {
			util.WriteError(w, http.StatusUnauthorized, "unauthorized", "invalid or expired session")
			return
		}

		next(w, r, session)
	}
}

func (m *AuthMiddleware) sessionTokenFromRequest(r *http.Request) string {
	if cookie, err := r.Cookie(m.sessionCookieName); err == nil {
		token := strings.TrimSpace(cookie.Value)
		if token != "" {
			return token
		}
	}
	return util.BearerToken(r.Header.Get("Authorization"))
}
