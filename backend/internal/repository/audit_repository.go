package repository

import (
	"context"
	"database/sql"
	"fmt"

	"pmv2/backend/internal/domain"

	"github.com/google/uuid"
)

type AuditRepository struct {
	db *sql.DB
}

func NewAuditRepository(db *sql.DB) *AuditRepository {
	return &AuditRepository{db: db}
}

func (r *AuditRepository) CreateEvent(ctx context.Context, event domain.AuditEvent) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO audit_events (id, user_id, event_type, event_data, created_at)
		VALUES ($1, $2, $3, $4, $5)
	`, event.ID, event.UserID, event.EventType, event.EventData, event.CreatedAt)
	if err != nil {
		return fmt.Errorf("insert audit event: %w", err)
	}
	return nil
}

func (r *AuditRepository) ListEvents(ctx context.Context, userID uuid.UUID, limit int, offset int, filter domain.AuditFilter) ([]domain.AuditEvent, int, error) {
	where := "WHERE user_id = $1"
	args := []interface{}{userID}
	argIdx := 2

	if filter.Category != "" {
		where += fmt.Sprintf(" AND event_type LIKE $%d", argIdx)
		args = append(args, filter.Category+"%")
		argIdx++
	}

	if filter.Search != "" {
		where += fmt.Sprintf(" AND (event_type ILIKE $%d OR event_data::text ILIKE $%d)", argIdx, argIdx)
		args = append(args, "%"+filter.Search+"%")
		argIdx++
	}

	if filter.StartDate != nil {
		where += fmt.Sprintf(" AND created_at >= $%d", argIdx)
		args = append(args, *filter.StartDate)
		argIdx++
	}

	if filter.EndDate != nil {
		where += fmt.Sprintf(" AND created_at <= $%d", argIdx)
		args = append(args, *filter.EndDate)
		argIdx++
	}

	// 1. Get total count with filters
	var total int
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM audit_events %s", where)
	err := r.db.QueryRowContext(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("count audit events: %w", err)
	}

	// 2. Get paginated events with filters
	limitIdx := argIdx
	offsetIdx := argIdx + 1
	query := fmt.Sprintf(`
		SELECT id, user_id, event_type, event_data, created_at
		FROM audit_events
		%s
		ORDER BY created_at DESC
		LIMIT $%d OFFSET $%d
	`, where, limitIdx, offsetIdx)

	args = append(args, limit, offset)
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("query audit events: %w", err)
	}
	defer rows.Close()

	var events []domain.AuditEvent
	for rows.Next() {
		var e domain.AuditEvent
		if err := rows.Scan(&e.ID, &e.UserID, &e.EventType, &e.EventData, &e.CreatedAt); err != nil {
			return nil, 0, fmt.Errorf("scan audit event: %w", err)
		}
		events = append(events, e)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterate audit events: %w", err)
	}

	return events, total, nil
}

func (r *AuditRepository) DeleteUserLogs(ctx context.Context, userID uuid.UUID) error {
	_, err := r.db.ExecContext(ctx, `
		DELETE FROM audit_events WHERE user_id = $1
	`, userID)
	if err != nil {
		return fmt.Errorf("delete audit events: %w", err)
	}
	return nil
}
