package types

import (
	"time"

	"github.com/google/uuid"
)

// SyncEvent represents a change event
type SyncEvent struct {
	ID        uuid.UUID `json:"id"`
	UserID    uuid.UUID `json:"user_id"`
	DeviceID  uuid.UUID `json:"device_id"`
	Type      string    `json:"type"` // create, update, delete
	ItemType  string    `json:"item_type"` // vault_item, folder
	ItemID    uuid.UUID `json:"item_id"`
	Version   int       `json:"version"`
	Timestamp time.Time `json:"timestamp"`
	Data      string    `json:"data"` // Encrypted change data
}

// Device represents a synced device
type Device struct {
	ID           uuid.UUID  `json:"id"`
	UserID       uuid.UUID  `json:"user_id"`
	Name         string     `json:"name"`
	Type         string     `json:"type"` // web, mobile, desktop
	LastSyncAt   *time.Time `json:"last_sync_at"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

// SyncRequest represents a sync request from client
type SyncRequest struct {
	DeviceID    uuid.UUID   `json:"device_id"`
	LastSyncAt  *time.Time  `json:"last_sync_at"`
	Changes     []SyncEvent `json:"changes"` // Client's pending changes
}

// SyncResponse represents a sync response
type SyncResponse struct {
	Changes     []SyncEvent `json:"changes"` // Server's changes to apply
	Conflicts   []Conflict  `json:"conflicts"` // Conflicts to resolve
	LastSyncAt  time.Time   `json:"last_sync_at"`
	SyncToken   string      `json:"sync_token"` // For next sync
}

// Conflict represents a conflict that needs resolution
type Conflict struct {
	ItemID      uuid.UUID `json:"item_id"`
	ItemType    string    `json:"item_type"`
	ClientVersion int     `json:"client_version"`
	ServerVersion int     `json:"server_version"`
	ClientData  string    `json:"client_data"` // Encrypted
	ServerData  string    `json:"server_data"` // Encrypted
	Message     string    `json:"message"`
}

// WebSocketMessage represents a WebSocket message
type WebSocketMessage struct {
	Type    string      `json:"type"` // sync, ping, pong, error
	Payload interface{} `json:"payload"`
}

// ChangeLog represents a change log entry
type ChangeLog struct {
	ID        uuid.UUID `json:"id"`
	UserID    uuid.UUID `json:"user_id"`
	DeviceID  uuid.UUID `json:"device_id"`
	ItemType  string    `json:"item_type"`
	ItemID    uuid.UUID `json:"item_id"`
	Action    string    `json:"action"` // create, update, delete
	Version   int       `json:"version"`
	Data      string    `json:"data"` // Encrypted
	CreatedAt time.Time `json:"created_at"`
}

