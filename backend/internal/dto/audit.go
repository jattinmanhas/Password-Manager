package dto

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type AuditEventResponse struct {
	ID        uuid.UUID       `json:"id"`
	EventType string          `json:"event_type"`
	EventData json.RawMessage `json:"event_data"`
	CreatedAt time.Time       `json:"created_at"`
}

type AuditPaginatedResponse struct {
	Events  []AuditEventResponse `json:"events"`
	Total   int                  `json:"total"`
	HasNext bool                 `json:"has_next"`
}
