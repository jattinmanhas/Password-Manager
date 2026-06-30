// Package mailer sends transactional email (password-reset and MFA-recovery
// codes). It uses Resend's REST API when configured, and otherwise falls back
// to logging the message — so local development works without an API key.
package mailer

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"time"
)

// Mailer sends a single transactional email.
type Mailer interface {
	Send(ctx context.Context, to, subject, html, text string) error
}

// New returns a Resend-backed mailer when apiKey is set, otherwise a mailer
// that logs the email (useful for local dev / tests).
func New(apiKey, from string, logger *slog.Logger) Mailer {
	if apiKey == "" {
		logger.Warn("RESEND_API_KEY not set — emails will be logged, not sent")
		return &logMailer{logger: logger, from: from}
	}
	return &resendMailer{
		apiKey: apiKey,
		from:   from,
		http:   &http.Client{Timeout: 10 * time.Second},
	}
}

type logMailer struct {
	logger *slog.Logger
	from   string
}

func (m *logMailer) Send(_ context.Context, to, subject, _, text string) error {
	m.logger.Info("email (not sent — no provider configured)",
		slog.String("from", m.from),
		slog.String("to", to),
		slog.String("subject", subject),
		slog.String("body", text),
	)
	return nil
}

type resendMailer struct {
	apiKey string
	from   string
	http   *http.Client
}

func (m *resendMailer) Send(ctx context.Context, to, subject, html, text string) error {
	payload := map[string]any{
		"from":    m.from,
		"to":      []string{to},
		"subject": subject,
		"html":    html,
		"text":    text,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal email payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.resend.com/emails", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("build email request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+m.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := m.http.Do(req)
	if err != nil {
		return fmt.Errorf("send email: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		buf := new(bytes.Buffer)
		_, _ = buf.ReadFrom(resp.Body)
		return fmt.Errorf("resend returned %d: %s", resp.StatusCode, buf.String())
	}
	return nil
}
