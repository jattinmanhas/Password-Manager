package util

import (
	"net"
	"strings"
)

func NormalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func NormalizeIP(addr string) string {
	trimmed := strings.TrimSpace(addr)
	if trimmed == "" {
		return ""
	}
	parsed := net.ParseIP(trimmed)
	if parsed != nil {
		return parsed.String()
	}

	host, _, err := net.SplitHostPort(trimmed)
	if err != nil {
		return ""
	}
	parsed = net.ParseIP(host)
	if parsed == nil {
		return ""
	}
	return parsed.String()
}

func TrimOrEmpty(value string) string {
	return strings.TrimSpace(value)
}
