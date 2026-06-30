package util

import (
	"encoding/json"
	"net/http"
	"strings"

	"pmv2/backend/internal/dto"
)

func ReadJSON(r *http.Request, into any) error {
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	return decoder.Decode(into)
}

func WriteJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func WriteError(w http.ResponseWriter, status int, code string, message string) {
	WriteJSON(w, status, dto.ErrorResponse{Error: code, Message: message})
}

func BearerToken(header string) string {
	if header == "" {
		return ""
	}
	parts := strings.SplitN(strings.TrimSpace(header), " ", 2)
	if len(parts) != 2 {
		return ""
	}
	if !strings.EqualFold(parts[0], "Bearer") {
		return ""
	}
	return strings.TrimSpace(parts[1])
}

// trustedProxyCount is the number of trusted reverse proxies in front of the
// app, configured once at startup via ConfigureTrustedProxies. It governs how
// X-Forwarded-For is interpreted in ClientIPFromRequest.
var trustedProxyCount int

// ConfigureTrustedProxies sets the trusted proxy count used when deriving the
// client IP from X-Forwarded-For. Call once during startup.
func ConfigureTrustedProxies(n int) {
	if n < 0 {
		n = 0
	}
	trustedProxyCount = n
}

// ClientIPFromRequest extracts the client's IP address from the request.
//
// X-Forwarded-For is only trusted when at least one trusted proxy is
// configured (see ConfigureTrustedProxies). In that case the client IP is the
// Nth entry counted from the right, where N is the trusted proxy count: the
// trusted proxies append their immediate peers on the right, so any values a
// client tries to inject sit to the left and are ignored. When no proxy is
// trusted, RemoteAddr is used. The port suffix is always stripped so the
// result is safe to store in a Postgres INET column.
func ClientIPFromRequest(r *http.Request) string {
	if trustedProxyCount > 0 {
		forwarded := strings.TrimSpace(r.Header.Get("X-Forwarded-For"))
		if forwarded != "" {
			parts := make([]string, 0)
			for _, p := range strings.Split(forwarded, ",") {
				if trimmed := strings.TrimSpace(p); trimmed != "" {
					parts = append(parts, trimmed)
				}
			}
			if len(parts) > 0 {
				idx := len(parts) - trustedProxyCount
				if idx < 0 {
					idx = 0
				}
				return NormalizeIP(parts[idx])
			}
		}
	}
	return NormalizeIP(r.RemoteAddr)
}
