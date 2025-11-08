package repository

import (
	"time"

	"github.com/google/uuid"
	"github.com/password-manager/sync-service/internal/database"
	"github.com/password-manager/sync-service/internal/types"
)

type ChangeLogRepository struct {
	db *database.DB
}

func NewChangeLogRepository(db *database.DB) *ChangeLogRepository {
	return &ChangeLogRepository{db: db}
}

func (r *ChangeLogRepository) Create(changeLog *types.ChangeLog) error {
	query := `
		INSERT INTO change_logs (id, user_id, device_id, item_type, item_id, action, version, data, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING created_at
	`

	err := r.db.QueryRow(
		query,
		changeLog.ID,
		changeLog.UserID,
		changeLog.DeviceID,
		changeLog.ItemType,
		changeLog.ItemID,
		changeLog.Action,
		changeLog.Version,
		changeLog.Data,
		time.Now(),
	).Scan(&changeLog.CreatedAt)

	return err
}

func (r *ChangeLogRepository) GetChangesSince(userID uuid.UUID, since time.Time, limit int) ([]*types.ChangeLog, error) {
	query := `
		SELECT id, user_id, device_id, item_type, item_id, action, version, data, created_at
		FROM change_logs
		WHERE user_id = $1 AND created_at > $2
		ORDER BY created_at ASC
		LIMIT $3
	`

	rows, err := r.db.Query(query, userID, since, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var changes []*types.ChangeLog
	for rows.Next() {
		change := &types.ChangeLog{}
		err := rows.Scan(
			&change.ID,
			&change.UserID,
			&change.DeviceID,
			&change.ItemType,
			&change.ItemID,
			&change.Action,
			&change.Version,
			&change.Data,
			&change.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		changes = append(changes, change)
	}

	return changes, rows.Err()
}

func (r *ChangeLogRepository) GetLatestVersion(itemType string, itemID uuid.UUID) (int, error) {
	query := `
		SELECT COALESCE(MAX(version), 0)
		FROM change_logs
		WHERE item_type = $1 AND item_id = $2
	`

	var version int
	err := r.db.QueryRow(query, itemType, itemID).Scan(&version)
	return version, err
}

