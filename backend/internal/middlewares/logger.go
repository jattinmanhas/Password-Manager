package middlewares

import (
	"log/slog"
	"net/http"
	"time"

	"pmv2/backend/internal/util"
)

// responseRecorder wraps http.ResponseWriter to capture the status code written
// by downstream handlers so we can include it in the access log.
type responseRecorder struct {
	http.ResponseWriter
	status int
}

func (rr *responseRecorder) WriteHeader(code int) {
	rr.status = code
	rr.ResponseWriter.WriteHeader(code)
}

// RequestLogger returns a middleware that emits one structured log line per
// incoming HTTP request, including: method, path, client IP, status code, and
// elapsed duration.
func RequestLogger(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()

			rec := &responseRecorder{ResponseWriter: w, status: http.StatusOK}
			next.ServeHTTP(rec, r)

			duration := time.Since(start)

			logger.InfoContext(
				r.Context(),
				"request",
				slog.String("method", r.Method),
				slog.String("path", r.URL.Path),
				slog.String("ip", util.ClientIPFromRequest(r)),
				slog.Int("status", rec.status),
				slog.String("duration", duration.String()),
				slog.String("user_agent", r.UserAgent()),
			)
		})
	}
}
