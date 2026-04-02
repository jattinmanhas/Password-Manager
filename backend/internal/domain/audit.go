package domain

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type EventType string

const (
	EventTypeAuthLoginSuccess     EventType = "auth_login_success"
	EventTypeAuthLoginFailed      EventType = "auth_login_failed"
	EventTypeAuthLogout           EventType = "auth_logout"
	EventTypeMFASetup             EventType = "mfa_setup"
	EventTypeMFADisabled          EventType = "mfa_disabled"
	EventTypeRecoverySetup        EventType = "recovery_setup"
	
	EventTypeVaultItemCreated     EventType = "vault_item_created"
	EventTypeVaultItemUpdated     EventType = "vault_item_updated"
	EventTypeVaultItemDeleted     EventType = "vault_item_deleted"
	EventTypeVaultFolderCreated   EventType = "vault_folder_created"
	EventTypeVaultFolderDeleted   EventType = "vault_folder_deleted"
	
	EventTypeSharingItemShared    EventType = "sharing_item_shared"
	EventTypeSharingRevoked       EventType = "sharing_revoked"
	
	EventTypeFamilyInviteSent     EventType = "family_invite_sent"
	EventTypeFamilyInviteAccepted EventType = "family_invite_accepted"
	EventTypeFamilyMemberRemoved  EventType = "family_member_removed"
)

type AuditEvent struct {
	ID        uuid.UUID       `json:"id"`
	UserID    *uuid.UUID      `json:"user_id,omitempty"` // Can be null if it's an anonymous action (e.g. failed login with invalid user)
	EventType EventType       `json:"event_type"`
	EventData json.RawMessage `json:"event_data"` // Stores specific event details like ip_address, item_name, friend_id, etc.
	CreatedAt time.Time       `json:"created_at"`
}

type AuditPaginatedResponse struct {
	Events  []AuditEvent `json:"events"`
	Total   int          `json:"total"`
	HasNext bool         `json:"has_next"`
}

type AuditFilter struct {
	Category  string     `json:"category"`
	Search    string     `json:"search"`
	StartDate *time.Time `json:"start_date"`
	EndDate   *time.Time `json:"end_date"`
}
