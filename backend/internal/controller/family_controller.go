package controller

import (
	"errors"
	"log/slog"
	"net/http"
	"time"

	"pmv2/backend/internal/domain"
	"pmv2/backend/internal/dto"
	"pmv2/backend/internal/service"
	"pmv2/backend/internal/util"
)

type FamilyController struct {
	family *service.FamilyService
	log    *slog.Logger
}

func NewFamilyController(familyService *service.FamilyService, logger *slog.Logger) *FamilyController {
	return &FamilyController{family: familyService, log: logger}
}

// HandleSendRequest sends a family request to another user by email.
func (c *FamilyController) HandleSendRequest(w http.ResponseWriter, r *http.Request, session domain.Session) {
	var req dto.SendFamilyRequestInput
	if err := util.ReadJSON(r, &req); err != nil {
		util.WriteError(w, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}
	if req.Email == "" {
		util.WriteError(w, http.StatusBadRequest, "missing_email", "email is required")
		return
	}

	err := c.family.SendRequest(r.Context(), session.UserID, req.Email)
	if err != nil {
		c.writeFamilyError(w, r, err, "failed to send family request")
		return
	}

	util.WriteJSON(w, http.StatusCreated, dto.StatusResponse{Status: "request_sent"})
}

// HandleAcceptRequest accepts a pending family request.
func (c *FamilyController) HandleAcceptRequest(w http.ResponseWriter, r *http.Request, session domain.Session) {
	var req dto.RespondFamilyRequestInput
	if err := util.ReadJSON(r, &req); err != nil {
		util.WriteError(w, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}
	if req.UserID == "" {
		util.WriteError(w, http.StatusBadRequest, "missing_user_id", "user_id is required")
		return
	}

	err := c.family.AcceptRequest(r.Context(), session.UserID, req.UserID)
	if err != nil {
		c.writeFamilyError(w, r, err, "failed to accept family request")
		return
	}

	util.WriteJSON(w, http.StatusOK, dto.StatusResponse{Status: "accepted"})
}

// HandleRejectRequest rejects a pending family request.
func (c *FamilyController) HandleRejectRequest(w http.ResponseWriter, r *http.Request, session domain.Session) {
	var req dto.RespondFamilyRequestInput
	if err := util.ReadJSON(r, &req); err != nil {
		util.WriteError(w, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}
	if req.UserID == "" {
		util.WriteError(w, http.StatusBadRequest, "missing_user_id", "user_id is required")
		return
	}

	err := c.family.RejectRequest(r.Context(), session.UserID, req.UserID)
	if err != nil {
		c.writeFamilyError(w, r, err, "failed to reject family request")
		return
	}

	util.WriteJSON(w, http.StatusOK, dto.StatusResponse{Status: "rejected"})
}

// HandleRemoveMember removes an accepted family member.
func (c *FamilyController) HandleRemoveMember(w http.ResponseWriter, r *http.Request, session domain.Session) {
	memberID := r.PathValue("user_id")
	if memberID == "" {
		util.WriteError(w, http.StatusBadRequest, "missing_user_id", "user_id is required")
		return
	}

	err := c.family.RemoveMember(r.Context(), session.UserID, memberID)
	if err != nil {
		c.writeFamilyError(w, r, err, "failed to remove family member")
		return
	}

	util.WriteJSON(w, http.StatusOK, dto.StatusResponse{Status: "removed"})
}

// HandleListMembers returns accepted family members.
func (c *FamilyController) HandleListMembers(w http.ResponseWriter, r *http.Request, session domain.Session) {
	members, err := c.family.ListMembers(r.Context(), session.UserID)
	if err != nil {
		c.writeFamilyError(w, r, err, "failed to list family members")
		return
	}

	resp := dto.FamilyMembersResponse{Members: make([]dto.FamilyMemberResponse, 0, len(members))}
	for _, m := range members {
		resp.Members = append(resp.Members, dto.FamilyMemberResponse{
			UserID:    m.UserID,
			Email:     m.Email,
			Name:      m.Name,
			Status:    m.Status,
			CreatedAt: m.CreatedAt.UTC().Format(time.RFC3339),
		})
	}

	util.WriteJSON(w, http.StatusOK, resp)
}

// HandleListRequests returns pending family requests (received + sent).
func (c *FamilyController) HandleListRequests(w http.ResponseWriter, r *http.Request, session domain.Session) {
	received, sent, err := c.family.ListRequests(r.Context(), session.UserID)
	if err != nil {
		c.writeFamilyError(w, r, err, "failed to list family requests")
		return
	}

	resp := dto.FamilyRequestsResponse{
		Received: make([]dto.FamilyRequestResponse, 0, len(received)),
		Sent:     make([]dto.FamilyRequestResponse, 0, len(sent)),
	}
	for _, req := range received {
		resp.Received = append(resp.Received, dto.FamilyRequestResponse{
			UserID:      req.UserID,
			Email:       req.Email,
			Name:        req.Name,
			InitiatedBy: req.InitiatedBy,
			CreatedAt:   req.CreatedAt.UTC().Format(time.RFC3339),
		})
	}
	for _, req := range sent {
		resp.Sent = append(resp.Sent, dto.FamilyRequestResponse{
			UserID:      req.UserID,
			Email:       req.Email,
			Name:        req.Name,
			InitiatedBy: req.InitiatedBy,
			CreatedAt:   req.CreatedAt.UTC().Format(time.RFC3339),
		})
	}

	util.WriteJSON(w, http.StatusOK, resp)
}

func (c *FamilyController) writeFamilyError(w http.ResponseWriter, r *http.Request, err error, defaultMessage string) {
	switch {
	case errors.Is(err, domain.ErrUnauthorizedSession):
		util.WriteError(w, http.StatusUnauthorized, "unauthorized", "invalid or expired session")
	case errors.Is(err, domain.ErrCannotAddSelf):
		util.WriteError(w, http.StatusBadRequest, "cannot_add_self", "you cannot add yourself as a family member")
	case errors.Is(err, domain.ErrAlreadyFamilyMember):
		util.WriteError(w, http.StatusConflict, "already_family", "this user is already a family member")
	case errors.Is(err, domain.ErrFamilyRequestAlreadySent):
		util.WriteError(w, http.StatusConflict, "request_exists", "a family request already exists with this user")
	case errors.Is(err, domain.ErrFamilyRequestNotFound):
		util.WriteError(w, http.StatusNotFound, "request_not_found", "family request not found")
	case errors.Is(err, domain.ErrNotFound):
		util.WriteError(w, http.StatusNotFound, "user_not_found", "user not found")
	case errors.Is(err, domain.ErrNotFamilyMember):
		util.WriteError(w, http.StatusForbidden, "not_family_member", "you can only share with family members")
	default:
		c.log.ErrorContext(r.Context(), defaultMessage, slog.Any("error", err))
		util.WriteError(w, http.StatusInternalServerError, "internal_error", defaultMessage)
	}
}
