package controller

import (
	"encoding/base64"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"pmv2/backend/internal/domain"
	"pmv2/backend/internal/dto"
	"pmv2/backend/internal/service"
	"pmv2/backend/internal/util"
)

type SharingController struct {
	sharing *service.SharingService
	log     *slog.Logger
}

func NewSharingController(sharingService *service.SharingService, logger *slog.Logger) *SharingController {
	return &SharingController{sharing: sharingService, log: logger}
}

// HandleUpsertKeys stores or updates the user's X25519 key pair.
func (c *SharingController) HandleUpsertKeys(w http.ResponseWriter, r *http.Request, session domain.Session) {
	var req dto.UpsertUserKeysRequest
	if err := util.ReadJSON(r, &req); err != nil {
		util.WriteError(w, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}

	publicKey, err := base64.StdEncoding.DecodeString(strings.TrimSpace(req.PublicKeyX25519))
	if err != nil || len(publicKey) == 0 {
		util.WriteError(w, http.StatusBadRequest, "invalid_payload", "invalid public_key_x25519")
		return
	}
	encPriv, err := base64.StdEncoding.DecodeString(strings.TrimSpace(req.EncryptedPrivateKeys))
	if err != nil || len(encPriv) == 0 {
		util.WriteError(w, http.StatusBadRequest, "invalid_payload", "invalid encrypted_private_keys")
		return
	}
	nonce, err := base64.StdEncoding.DecodeString(strings.TrimSpace(req.Nonce))
	if err != nil || len(nonce) == 0 {
		util.WriteError(w, http.StatusBadRequest, "invalid_payload", "invalid nonce")
		return
	}

	err = c.sharing.UpsertUserKeys(r.Context(), session.UserID, domain.UpsertUserKeysInput{
		PublicKeyX25519:      publicKey,
		EncryptedPrivateKeys: encPriv,
		Nonce:                nonce,
	})
	if err != nil {
		c.writeSharingError(w, r, err, "failed to save user keys")
		return
	}

	util.WriteJSON(w, http.StatusOK, dto.StatusResponse{Status: "keys_saved"})
}

// HandleGetMyKeys returns the current user's full key material.
func (c *SharingController) HandleGetMyKeys(w http.ResponseWriter, r *http.Request, session domain.Session) {
	keys, err := c.sharing.GetUserKeys(r.Context(), session.UserID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			util.WriteJSON(w, http.StatusOK, dto.UserKeysResponse{HasKeys: false})
			return
		}
		c.writeSharingError(w, r, err, "failed to get user keys")
		return
	}

	util.WriteJSON(w, http.StatusOK, dto.UserKeysResponse{
		PublicKeyX25519:      base64.StdEncoding.EncodeToString(keys.PublicKeyX25519),
		EncryptedPrivateKeys: base64.StdEncoding.EncodeToString(keys.EncryptedPrivateKeys),
		Nonce:                base64.StdEncoding.EncodeToString(keys.Nonce),
		HasKeys:              true,
	})
}

// HandleGetPublicKey returns the public key for a user identified by email.
func (c *SharingController) HandleGetPublicKey(w http.ResponseWriter, r *http.Request, session domain.Session) {
	email := strings.TrimSpace(r.URL.Query().Get("email"))
	if email == "" {
		util.WriteError(w, http.StatusBadRequest, "missing_email", "email query parameter is required")
		return
	}

	keys, userID, err := c.sharing.GetPublicKeyByEmail(r.Context(), email)
	if err != nil {
		c.writeSharingError(w, r, err, "failed to look up recipient keys")
		return
	}

	util.WriteJSON(w, http.StatusOK, dto.UserPublicKeyResponse{
		UserID:          userID,
		Email:           email,
		PublicKeyX25519: base64.StdEncoding.EncodeToString(keys.PublicKeyX25519),
	})
}

// HandleShareItem shares a vault item with another user.
func (c *SharingController) HandleShareItem(w http.ResponseWriter, r *http.Request, session domain.Session) {
	itemID := strings.TrimSpace(r.PathValue("item_id"))
	if itemID == "" {
		util.WriteError(w, http.StatusBadRequest, "missing_item_id", "item_id is required")
		return
	}

	var req dto.ShareItemRequest
	if err := util.ReadJSON(r, &req); err != nil {
		util.WriteError(w, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}

	wrappedDEK, err := base64.StdEncoding.DecodeString(strings.TrimSpace(req.WrappedDEK))
	if err != nil || len(wrappedDEK) == 0 {
		util.WriteError(w, http.StatusBadRequest, "invalid_payload", "invalid wrapped_dek")
		return
	}
	wrapNonce, err := base64.StdEncoding.DecodeString(strings.TrimSpace(req.WrapNonce))
	if err != nil || len(wrapNonce) == 0 {
		util.WriteError(w, http.StatusBadRequest, "invalid_payload", "invalid wrap_nonce")
		return
	}

	recipientEmail := strings.TrimSpace(strings.ToLower(req.RecipientEmail))
	if recipientEmail == "" {
		util.WriteError(w, http.StatusBadRequest, "missing_recipient", "recipient_email is required")
		return
	}

	// Look up recipient user ID
	_, recipientID, err := c.sharing.GetPublicKeyByEmail(r.Context(), recipientEmail)
	if err != nil {
		c.writeSharingError(w, r, err, "recipient not found or has no keys")
		return
	}

	permissions := strings.TrimSpace(req.Permissions)
	if permissions == "" {
		permissions = "read"
	}

	err = c.sharing.ShareItem(r.Context(), session.UserID, itemID, domain.ShareItemInput{
		RecipientID: recipientID,
		DEKWrapped:  wrappedDEK,
		WrapNonce:   wrapNonce,
		Permissions: permissions,
	})
	if err != nil {
		c.writeSharingError(w, r, err, "failed to share item")
		return
	}

	util.WriteJSON(w, http.StatusCreated, dto.ShareItemResponse{
		ItemID:         itemID,
		RecipientID:    recipientID,
		SharedByUserID: session.UserID,
		Permissions:    permissions,
		Status:         "shared",
	})
}

// HandleRevokeShare removes a share.
func (c *SharingController) HandleRevokeShare(w http.ResponseWriter, r *http.Request, session domain.Session) {
	itemID := strings.TrimSpace(r.PathValue("item_id"))
	recipientUserID := strings.TrimSpace(r.PathValue("user_id"))
	if itemID == "" || recipientUserID == "" {
		util.WriteError(w, http.StatusBadRequest, "missing_params", "item_id and user_id are required")
		return
	}

	err := c.sharing.RevokeShare(r.Context(), session.UserID, itemID, recipientUserID)
	if err != nil {
		c.writeSharingError(w, r, err, "failed to revoke share")
		return
	}

	util.WriteJSON(w, http.StatusOK, dto.StatusResponse{Status: "revoked"})
}

// HandleListSharedWithMe returns all items shared with the current user.
func (c *SharingController) HandleListSharedWithMe(w http.ResponseWriter, r *http.Request, session domain.Session) {
	items, err := c.sharing.ListSharedWithMe(r.Context(), session.UserID)
	if err != nil {
		c.writeSharingError(w, r, err, "failed to list shared items")
		return
	}

	resp := dto.SharedItemsResponse{Items: make([]dto.SharedItemResponse, 0, len(items))}
	for _, si := range items {
		resp.Items = append(resp.Items, dto.SharedItemResponse{
			ID:              si.ID,
			OwnerUserID:     si.OwnerUserID,
			Ciphertext:      base64.StdEncoding.EncodeToString(si.Ciphertext),
			Nonce:           base64.StdEncoding.EncodeToString(si.Nonce),
			WrappedDEK:      base64.StdEncoding.EncodeToString(si.WrappedDEK),
			WrapNonce:       base64.StdEncoding.EncodeToString(si.WrapNonce),
			AlgoVersion:     si.AlgoVersion,
			Metadata:        si.Metadata,
			CreatedAt:       si.CreatedAt.UTC().Format(time.RFC3339),
			UpdatedAt:       si.UpdatedAt.UTC().Format(time.RFC3339),
			ShareWrappedDEK: base64.StdEncoding.EncodeToString(si.ShareDEK),
			ShareWrapNonce:  base64.StdEncoding.EncodeToString(si.ShareWrapNonce),
			SharedByEmail:   si.SharedByEmail,
			SharedByName:    si.SharedByName,
			Permissions:     si.Permissions,
		})
	}

	util.WriteJSON(w, http.StatusOK, resp)
}

// HandleListSharesForItem lists all recipients of a shared item.
func (c *SharingController) HandleListSharesForItem(w http.ResponseWriter, r *http.Request, session domain.Session) {
	itemID := strings.TrimSpace(r.PathValue("item_id"))
	if itemID == "" {
		util.WriteError(w, http.StatusBadRequest, "missing_item_id", "item_id is required")
		return
	}

	shares, err := c.sharing.ListSharesForItem(r.Context(), session.UserID, itemID)
	if err != nil {
		c.writeSharingError(w, r, err, "failed to list shares")
		return
	}

	resp := dto.ShareRecipientsResponse{Shares: make([]dto.ShareRecipientResponse, 0, len(shares))}
	for _, s := range shares {
		resp.Shares = append(resp.Shares, dto.ShareRecipientResponse{
			UserID:      s.UserID,
			Permissions: s.Permissions,
			CreatedAt:   s.CreatedAt.UTC().Format(time.RFC3339),
		})
	}

	util.WriteJSON(w, http.StatusOK, resp)
}

func (c *SharingController) writeSharingError(w http.ResponseWriter, r *http.Request, err error, defaultMessage string) {
	switch {
	case errors.Is(err, domain.ErrUnauthorizedSession):
		util.WriteError(w, http.StatusUnauthorized, "unauthorized", "invalid or expired session")
	case errors.Is(err, domain.ErrInvalidVaultPayload):
		util.WriteError(w, http.StatusBadRequest, "invalid_payload", "invalid vault payload")
	case errors.Is(err, domain.ErrNotFound):
		util.WriteError(w, http.StatusNotFound, "not_found", "resource not found")
	case errors.Is(err, domain.ErrNotItemOwner):
		util.WriteError(w, http.StatusForbidden, "not_owner", "only the item owner can perform this action")
	case errors.Is(err, domain.ErrCannotShareWithSelf):
		util.WriteError(w, http.StatusBadRequest, "cannot_share_self", "you cannot share an item with yourself")
	case errors.Is(err, domain.ErrAlreadyShared):
		util.WriteError(w, http.StatusConflict, "already_shared", "item is already shared with this user")
	case errors.Is(err, domain.ErrRecipientKeysNotFound):
		util.WriteError(w, http.StatusNotFound, "recipient_keys_not_found", "recipient has not set up encryption keys")
	case errors.Is(err, domain.ErrShareNotFound):
		util.WriteError(w, http.StatusNotFound, "share_not_found", "share not found")
	default:
		c.log.ErrorContext(r.Context(), defaultMessage, slog.Any("error", err))
		util.WriteError(w, http.StatusInternalServerError, "internal_error", defaultMessage)
	}
}
