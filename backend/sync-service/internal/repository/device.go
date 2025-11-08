package repository

import (
	"database/sql"
	"time"

	"github.com/google/uuid"
	"github.com/password-manager/sync-service/internal/database"
	"github.com/password-manager/sync-service/internal/types"
)

type DeviceRepository struct {
	db *database.DB
}

func NewDeviceRepository(db *database.DB) *DeviceRepository {
	return &DeviceRepository{db: db}
}

func (r *DeviceRepository) Create(device *types.Device) error {
	query := `
		INSERT INTO devices (id, user_id, name, type, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING created_at, updated_at
	`

	now := time.Now()
	err := r.db.QueryRow(
		query,
		device.ID,
		device.UserID,
		device.Name,
		device.Type,
		now,
		now,
	).Scan(&device.CreatedAt, &device.UpdatedAt)

	return err
}

func (r *DeviceRepository) GetByID(id, userID uuid.UUID) (*types.Device, error) {
	device := &types.Device{}
	query := `
		SELECT id, user_id, name, type, last_sync_at, created_at, updated_at
		FROM devices
		WHERE id = $1 AND user_id = $2
	`

	err := r.db.QueryRow(query, id, userID).Scan(
		&device.ID,
		&device.UserID,
		&device.Name,
		&device.Type,
		&device.LastSyncAt,
		&device.CreatedAt,
		&device.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}

	return device, err
}

func (r *DeviceRepository) UpdateLastSync(deviceID uuid.UUID) error {
	query := `
		UPDATE devices
		SET last_sync_at = $1, updated_at = $2
		WHERE id = $3
	`

	_, err := r.db.Exec(query, time.Now(), time.Now(), deviceID)
	return err
}

func (r *DeviceRepository) GetByUserID(userID uuid.UUID) ([]*types.Device, error) {
	query := `
		SELECT id, user_id, name, type, last_sync_at, created_at, updated_at
		FROM devices
		WHERE user_id = $1
		ORDER BY updated_at DESC
	`

	rows, err := r.db.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var devices []*types.Device
	for rows.Next() {
		device := &types.Device{}
		err := rows.Scan(
			&device.ID,
			&device.UserID,
			&device.Name,
			&device.Type,
			&device.LastSyncAt,
			&device.CreatedAt,
			&device.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		devices = append(devices, device)
	}

	return devices, rows.Err()
}

