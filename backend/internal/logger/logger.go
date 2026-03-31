// Package logger initialises the application-wide slog.Logger.
//
// Logs are written to two destinations simultaneously:
//   - os.Stdout  (text in dev, JSON in prod)
//   - A rotating file managed by lumberjack (always JSON)
//
// The file rotates when it exceeds LogMaxSizeMB. Old files are deleted after
// LogMaxAgeDays days; at most LogMaxBackups archived files are kept.
package logger

import (
	"context"
	"io"
	"log/slog"
	"os"
	"strings"

	"gopkg.in/natefinch/lumberjack.v2"

	"pmv2/backend/internal/config"
)

// New builds a *slog.Logger from cfg and registers it as the slog default.
func New(cfg config.Config) (*slog.Logger, io.Closer) {
	level := parseLevel(cfg.LogLevel)

	handlerOpts := &slog.HandlerOptions{
		Level:     level,
		AddSource: level == slog.LevelDebug,
	}

	// --- file writer (JSON, auto-rotated) ---
	fw := &lumberjack.Logger{
		Filename:   cfg.LogFilePath,
		MaxSize:    cfg.LogMaxSizeMB,
		MaxBackups: cfg.LogMaxBackups,
		MaxAge:     cfg.LogMaxAgeDays,
		Compress:   true,
		LocalTime:  false,
	}

	// --- console handler ---
	isJSON := strings.EqualFold(strings.TrimSpace(cfg.LogFormat), "json")
	var consoleHandler slog.Handler
	if isJSON {
		consoleHandler = slog.NewJSONHandler(os.Stdout, handlerOpts)
	} else {
		consoleHandler = slog.NewTextHandler(os.Stdout, handlerOpts)
	}

	// File handler is always JSON for machine-parseability.
	fileHandler := slog.NewJSONHandler(fw, handlerOpts)

	logger := slog.New(&multiHandler{
		handlers: []slog.Handler{consoleHandler, fileHandler},
	})
	slog.SetDefault(logger)
	return logger, fw
}

// parseLevel converts a string like "debug" / "WARN" to a slog.Level.
func parseLevel(s string) slog.Level {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "debug":
		return slog.LevelDebug
	case "warn", "warning":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}

// multiHandler fans out log records to multiple slog.Handler implementations.
type multiHandler struct {
	handlers []slog.Handler
}

func (m *multiHandler) Enabled(ctx context.Context, level slog.Level) bool {
	for _, h := range m.handlers {
		if h.Enabled(ctx, level) {
			return true
		}
	}
	return false
}

func (m *multiHandler) Handle(ctx context.Context, r slog.Record) error {
	var lastErr error
	for _, h := range m.handlers {
		if h.Enabled(ctx, r.Level) {
			if err := h.Handle(ctx, r.Clone()); err != nil {
				lastErr = err
			}
		}
	}
	return lastErr
}

func (m *multiHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	handlers := make([]slog.Handler, len(m.handlers))
	for i, h := range m.handlers {
		handlers[i] = h.WithAttrs(attrs)
	}
	return &multiHandler{handlers: handlers}
}

func (m *multiHandler) WithGroup(name string) slog.Handler {
	handlers := make([]slog.Handler, len(m.handlers))
	for i, h := range m.handlers {
		handlers[i] = h.WithGroup(name)
	}
	return &multiHandler{handlers: handlers}
}
