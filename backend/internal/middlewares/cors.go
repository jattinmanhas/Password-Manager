package middlewares

import (
	"net/http"
	"strings"
)

func CORS(allowedOrigins string, next http.Handler) http.Handler {
	origins := strings.Split(allowedOrigins, ",")
	for i := range origins {
		origins[i] = strings.TrimSpace(origins[i])
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestOrigin := strings.TrimSpace(r.Header.Get("Origin"))

		allowed := false
		if requestOrigin != "" {
			for _, o := range origins {
				if o == "*" || o == requestOrigin {
					allowed = true
					break
				}
			}
		}

		if allowed {
			w.Header().Set("Access-Control-Allow-Origin", requestOrigin)
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Add("Vary", "Origin")
		}

		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
		w.Header().Set("Access-Control-Max-Age", "86400")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}
