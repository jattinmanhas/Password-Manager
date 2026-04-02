package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"pmv2/backend/internal/domain"
	"pmv2/backend/internal/repository"

	"github.com/google/uuid"
)

type AuditService struct {
	repo *repository.AuditRepository
}

func NewAuditService(repo *repository.AuditRepository) *AuditService {
	return &AuditService{repo: repo}
}

// LogEvent is a helper to quickly record an event.
// It fails silently (logs to slog) so it doesn't break the main business flow if logging fails.
func (s *AuditService) LogEvent(ctx context.Context, userID *uuid.UUID, eventType domain.EventType, eventData interface{}) {
	if s == nil || s.repo == nil {
		return
	}
	var rawData json.RawMessage
	if eventData != nil {
		b, err := json.Marshal(eventData)
		if err != nil {
			slog.Error("failed to marshal audit event data", "error", err, "event_type", eventType)
			rawData = []byte("{}")
		} else {
			rawData = b
		}
	} else {
		rawData = []byte("{}")
	}

	event := domain.AuditEvent{
		ID:        uuid.New(),
		UserID:    userID,
		EventType: eventType,
		EventData: rawData,
		CreatedAt: time.Now().UTC(),
	}

	if err := s.repo.CreateEvent(ctx, event); err != nil {
		slog.Error("failed to persist audit event", "error", err, "event_type", eventType)
	}
}

func (s *AuditService) GetActivityLog(ctx context.Context, userID string, limit, offset int, filter domain.AuditFilter) (*domain.AuditPaginatedResponse, error) {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("invalid user id: %w", err)
	}

	if limit <= 0 || limit > 100 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	events, total, err := s.repo.ListEvents(ctx, uid, limit, offset, filter)
	if err != nil {
		return nil, fmt.Errorf("list audit events: %w", err)
	}

	// Make sure we never return a nil slice if it's empty, to render nicely as JSON `[]` instead of `null`
	if events == nil {
		events = make([]domain.AuditEvent, 0)
	}

	hasNext := (offset + limit) < total

	return &domain.AuditPaginatedResponse{
		Events:  events,
		Total:   total,
		HasNext: hasNext,
	}, nil
}

func (s *AuditService) ClearActivityLog(ctx context.Context, userID string) error {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return fmt.Errorf("invalid user id: %w", err)
	}

	if err := s.repo.DeleteUserLogs(ctx, uid); err != nil {
		return fmt.Errorf("clear audit events: %w", err)
	}
	return nil
}
func (s *AuditService) GetSecuritySummary(ctx context.Context, userID string) (string, error) {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return "", fmt.Errorf("invalid user id: %w", err)
	}

	// Check for failed logins or revoked shares in the last 24 hours
	yesterday := time.Now().Add(-24 * time.Hour).UTC()
	filter := domain.AuditFilter{
		StartDate: &yesterday,
	}

	// We only need to check if any such events exist
	events, _, err := s.repo.ListEvents(ctx, uid, 50, 0, filter)
	if err != nil {
		return "unknown", err
	}

	for _, e := range events {
		if e.EventType == domain.EventTypeAuthLoginFailed || e.EventType == domain.EventTypeSharingRevoked {
			return "warning", nil
		}
	}

	return "secure", nil
}
