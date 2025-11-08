package service

import (
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/password-manager/sync-service/internal/config"
	"github.com/password-manager/sync-service/internal/repository"
	"github.com/password-manager/sync-service/internal/types"
)

type SyncService struct {
	changeLogRepo *repository.ChangeLogRepository
	deviceRepo    *repository.DeviceRepository
	config        *config.Config
}

func NewSyncService(changeLogRepo *repository.ChangeLogRepository, deviceRepo *repository.DeviceRepository, cfg *config.Config) *SyncService {
	return &SyncService{
		changeLogRepo: changeLogRepo,
		deviceRepo:    deviceRepo,
		config:        cfg,
	}
}

// Sync performs bidirectional sync between client and server
func (s *SyncService) Sync(userID uuid.UUID, req *types.SyncRequest) (*types.SyncResponse, error) {
	// Verify device exists
	device, err := s.deviceRepo.GetByID(req.DeviceID, userID)
	if err != nil {
		return nil, err
	}
	if device == nil {
		return nil, errors.New("device not found")
	}

	// Determine sync point
	var since time.Time
	if req.LastSyncAt != nil {
		since = *req.LastSyncAt
	} else {
		// First sync - get all changes
		since = time.Time{}
	}

	// Get server changes since last sync
	serverChanges, err := s.changeLogRepo.GetChangesSince(userID, since, 1000)
	if err != nil {
		return nil, err
	}

	// Process client changes and detect conflicts
	conflicts := []types.Conflict{}
	processedChanges := []types.SyncEvent{}

	for _, clientChange := range req.Changes {
		// Check for conflicts
		serverVersion, err := s.changeLogRepo.GetLatestVersion(clientChange.ItemType, clientChange.ItemID)
		if err != nil {
			return nil, err
		}

		if serverVersion > clientChange.Version {
			// Conflict detected
			conflicts = append(conflicts, types.Conflict{
				ItemID:        clientChange.ItemID,
				ItemType:      clientChange.ItemType,
				ClientVersion: clientChange.Version,
				ServerVersion: serverVersion,
				ClientData:    clientChange.Data,
				Message:       "Item was modified on another device",
			})
		} else {
			// No conflict - apply client change
			changeLog := &types.ChangeLog{
				ID:       uuid.New(),
				UserID:   userID,
				DeviceID: req.DeviceID,
				ItemType: clientChange.ItemType,
				ItemID:   clientChange.ItemID,
				Action:   clientChange.Type,
				Version:  clientChange.Version,
				Data:     clientChange.Data,
			}

			if err := s.changeLogRepo.Create(changeLog); err != nil {
				return nil, err
			}

			processedChanges = append(processedChanges, clientChange)
		}
	}

	// Convert server changes to sync events
	serverEvents := make([]types.SyncEvent, len(serverChanges))
	for i, change := range serverChanges {
		serverEvents[i] = types.SyncEvent{
			ID:        change.ID,
			UserID:    change.UserID,
			DeviceID:  change.DeviceID,
			Type:      change.Action,
			ItemType:  change.ItemType,
			ItemID:    change.ItemID,
			Version:   change.Version,
			Timestamp: change.CreatedAt,
			Data:      change.Data,
		}
	}

	// Update device last sync time
	if err := s.deviceRepo.UpdateLastSync(req.DeviceID); err != nil {
		// Log but don't fail
	}

	return &types.SyncResponse{
		Changes:    serverEvents,
		Conflicts:  conflicts,
		LastSyncAt: time.Now(),
		SyncToken:  uuid.New().String(), // Simple sync token
	}, nil
}

// RegisterDevice registers a new device for a user
func (s *SyncService) RegisterDevice(userID uuid.UUID, name, deviceType string) (*types.Device, error) {
	device := &types.Device{
		ID:     uuid.New(),
		UserID: userID,
		Name:   name,
		Type:   deviceType,
	}

	if err := s.deviceRepo.Create(device); err != nil {
		return nil, err
	}

	return device, nil
}

// GetDevices returns all devices for a user
func (s *SyncService) GetDevices(userID uuid.UUID) ([]*types.Device, error) {
	return s.deviceRepo.GetByUserID(userID)
}

// RecordChange records a change in the change log
func (s *SyncService) RecordChange(userID, deviceID uuid.UUID, itemType string, itemID uuid.UUID, action string, version int, data string) error {
	changeLog := &types.ChangeLog{
		ID:       uuid.New(),
		UserID:   userID,
		DeviceID: deviceID,
		ItemType: itemType,
		ItemID:   itemID,
		Action:   action,
		Version:  version,
		Data:     data,
	}

	return s.changeLogRepo.Create(changeLog)
}

