package controller

import (
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"pmv2/backend/internal/domain"
	"pmv2/backend/internal/dto"
	"pmv2/backend/internal/service"
	"pmv2/backend/internal/util"
)

type AuditController struct {
	audit *service.AuditService
	log   *slog.Logger
}

func NewAuditController(auditService *service.AuditService, logger *slog.Logger) *AuditController {
	return &AuditController{audit: auditService, log: logger}
}

func (c *AuditController) HandleGetLogs(w http.ResponseWriter, r *http.Request, session domain.Session) {
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")
	query := r.URL.Query().Get("query")
	category := r.URL.Query().Get("category")
	startDateStr := r.URL.Query().Get("start_date")
	endDateStr := r.URL.Query().Get("end_date")

	limit, _ := strconv.Atoi(limitStr)
	offset, _ := strconv.Atoi(offsetStr)

	filter := domain.AuditFilter{
		Search:   query,
		Category: category,
	}

	if startDateStr != "" {
		t, err := time.Parse(time.RFC3339, startDateStr)
		if err == nil {
			filter.StartDate = &t
		}
	}
	if endDateStr != "" {
		t, err := time.Parse(time.RFC3339, endDateStr)
		if err == nil {
			filter.EndDate = &t
		}
	}

	res, err := c.audit.GetActivityLog(r.Context(), session.UserID, limit, offset, filter)
	if err != nil {
		c.log.ErrorContext(r.Context(), "failed to get audit logs", slog.Any("error", err))
		util.WriteError(w, http.StatusInternalServerError, "internal_error", "failed to retrieve activity logs")
		return
	}

	dtoEvents := make([]dto.AuditEventResponse, 0, len(res.Events))
	for _, e := range res.Events {
		dtoEvents = append(dtoEvents, dto.AuditEventResponse{
			ID:        e.ID,
			EventType: string(e.EventType),
			EventData: e.EventData,
			CreatedAt: e.CreatedAt,
		})
	}

	util.WriteJSON(w, http.StatusOK, dto.AuditPaginatedResponse{
		Events:  dtoEvents,
		Total:   res.Total,
		HasNext: res.HasNext,
	})
}

func (c *AuditController) HandleClearLogs(w http.ResponseWriter, r *http.Request, session domain.Session) {
	if err := c.audit.ClearActivityLog(r.Context(), session.UserID); err != nil {
		c.log.ErrorContext(r.Context(), "failed to clear audit logs", slog.Any("error", err))
		util.WriteError(w, http.StatusInternalServerError, "internal_error", "failed to clear activity logs")
		return
	}

	util.WriteJSON(w, http.StatusOK, dto.StatusResponse{Status: "logs_cleared"})
}
func (c *AuditController) HandleGetSummary(w http.ResponseWriter, r *http.Request, session domain.Session) {
	status, err := c.audit.GetSecuritySummary(r.Context(), session.UserID)
	if err != nil {
		c.log.ErrorContext(r.Context(), "failed to get security summary", slog.Any("error", err))
		util.WriteError(w, http.StatusInternalServerError, "internal_error", "failed to retrieve security summary")
		return
	}

	util.WriteJSON(w, http.StatusOK, map[string]string{"status": status})
}
