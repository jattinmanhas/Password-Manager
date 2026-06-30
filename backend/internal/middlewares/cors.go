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

		explicitlyAllowed := false
		wildcard := false
		if requestOrigin != "" {
			for _, o := range origins {
				switch o {
				case requestOrigin:
					explicitlyAllowed = true
				case "*":
					wildcard = true
				}
			}
		}

		switch {
		case explicitlyAllowed:
			// Reflect the specific allow-listed origin and permit credentials
			// (cookies). Reflecting only an explicit match prevents arbitrary
			// origins from making credentialed cross-site requests.
			w.Header().Set("Access-Control-Allow-Origin", requestOrigin)
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Add("Vary", "Origin")
		case wildcard:
			// Public wildcard access: allowed, but never with credentials, since
			// "reflect any origin + allow credentials" is a CSRF/credential-theft
			// foothold.
			w.Header().Set("Access-Control-Allow-Origin", "*")
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
