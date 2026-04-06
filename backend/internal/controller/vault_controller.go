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

type VaultController struct {
	vault *service.VaultService
	log   *slog.Logger
}

func NewVaultController(vaultService *service.VaultService, logger *slog.Logger) *VaultController {
	return &VaultController{vault: vaultService, log: logger}
}

func (c *VaultController) HandleCreateItem(w http.ResponseWriter, r *http.Request, session domain.Session) {
	var req dto.CreateVaultItemRequest
	if err := util.ReadJSON(r, &req); err != nil {
		util.WriteError(w, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}

	input, err := parseUpsertVaultItemInput(req.Ciphertext, req.Nonce, req.WrappedDEK, req.WrapNonce, req.AlgoVersion, req.Metadata)
	if err != nil {
		util.WriteError(w, http.StatusBadRequest, "invalid_vault_payload", "vault item payload is invalid")
		return
	}

	item, err := c.vault.CreateItem(r.Context(), session.UserID, domain.CreateVaultItemInput{
		FolderID:    req.FolderID,
		Ciphertext:  input.Ciphertext,
		Nonce:       input.Nonce,
		WrappedDEK:  input.WrappedDEK,
		WrapNonce:   input.WrapNonce,
		AlgoVersion: input.AlgoVersion,
		Metadata:    input.Metadata,
	})
	if err != nil {
		c.writeVaultError(w, r, err, "failed to create vault item")
		return
	}

	util.WriteJSON(w, http.StatusCreated, vaultItemToResponse(item))
}

func (c *VaultController) HandleListItems(w http.ResponseWriter, r *http.Request, session domain.Session) {
	items, err := c.vault.ListItems(r.Context(), session.UserID)
	if err != nil {
		c.writeVaultError(w, r, err, "failed to list vault items")
		return
	}

	resp := dto.VaultItemsResponse{Items: make([]dto.VaultItemResponse, 0, len(items))}
	for _, item := range items {
		resp.Items = append(resp.Items, vaultItemToResponse(item))
	}
	util.WriteJSON(w, http.StatusOK, resp)
}

func (c *VaultController) HandleListDeletedItems(w http.ResponseWriter, r *http.Request, session domain.Session) {
	items, err := c.vault.ListDeletedItems(r.Context(), session.UserID)
	if err != nil {
		c.writeVaultError(w, r, err, "failed to list deleted vault items")
		return
	}

	resp := dto.VaultItemsResponse{Items: make([]dto.VaultItemResponse, 0, len(items))}
	for _, item := range items {
		resp.Items = append(resp.Items, vaultItemToResponse(item))
	}
	util.WriteJSON(w, http.StatusOK, resp)
}

func (c *VaultController) HandleGetItem(w http.ResponseWriter, r *http.Request, session domain.Session) {
	itemID := strings.TrimSpace(r.PathValue("item_id"))
	item, err := c.vault.GetItem(r.Context(), session.UserID, itemID)
	if err != nil {
		c.writeVaultError(w, r, err, "failed to load vault item")
		return
	}

	util.WriteJSON(w, http.StatusOK, vaultItemToResponse(item))
}

func (c *VaultController) HandleUpdateItem(w http.ResponseWriter, r *http.Request, session domain.Session) {
	itemID := strings.TrimSpace(r.PathValue("item_id"))

	var req dto.UpdateVaultItemRequest
	if err := util.ReadJSON(r, &req); err != nil {
		util.WriteError(w, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}

	input, err := parseUpsertVaultItemInput(req.Ciphertext, req.Nonce, req.WrappedDEK, req.WrapNonce, req.AlgoVersion, req.Metadata)
	if err != nil {
		util.WriteError(w, http.StatusBadRequest, "invalid_vault_payload", "vault item payload is invalid")
		return
	}

	item, err := c.vault.UpdateItem(r.Context(), session.UserID, itemID, domain.UpdateVaultItemInput{
		FolderID:    req.FolderID,
		Ciphertext:  input.Ciphertext,
		Nonce:       input.Nonce,
		WrappedDEK:  input.WrappedDEK,
		WrapNonce:   input.WrapNonce,
		AlgoVersion: input.AlgoVersion,
		Metadata:    input.Metadata,
	})
	if err != nil {
		c.writeVaultError(w, r, err, "failed to update vault item")
		return
	}

	util.WriteJSON(w, http.StatusOK, vaultItemToResponse(item))
}

func (c *VaultController) HandleDeleteItem(w http.ResponseWriter, r *http.Request, session domain.Session) {
	itemID := strings.TrimSpace(r.PathValue("item_id"))
	if err := c.vault.DeleteItem(r.Context(), session.UserID, itemID); err != nil {
		c.writeVaultError(w, r, err, "failed to delete vault item")
		return
	}

	util.WriteJSON(w, http.StatusOK, dto.StatusResponse{Status: "deleted"})
}

func (c *VaultController) HandleRestoreItem(w http.ResponseWriter, r *http.Request, session domain.Session) {
	itemID := strings.TrimSpace(r.PathValue("item_id"))
	item, err := c.vault.RestoreItem(r.Context(), session.UserID, itemID)
	if err != nil {
		c.writeVaultError(w, r, err, "failed to restore vault item")
		return
	}

	util.WriteJSON(w, http.StatusOK, vaultItemToResponse(item))
}

func (c *VaultController) HandleListItemVersions(w http.ResponseWriter, r *http.Request, session domain.Session) {
	itemID := strings.TrimSpace(r.PathValue("item_id"))
	versions, err := c.vault.ListItemVersions(r.Context(), session.UserID, itemID)
	if err != nil {
		c.writeVaultError(w, r, err, "failed to list vault item versions")
		return
	}

	resp := dto.VaultItemVersionsResponse{Versions: make([]dto.VaultItemVersionResponse, 0, len(versions))}
	for _, version := range versions {
		resp.Versions = append(resp.Versions, vaultItemVersionToResponse(version))
	}
	util.WriteJSON(w, http.StatusOK, resp)
}

func (c *VaultController) HandleGetVaultSalt(w http.ResponseWriter, r *http.Request, session domain.Session) {
	salt, err := c.vault.GetVaultSalt(r.Context(), session.UserID)
	if err != nil {
		c.writeVaultError(w, r, err, "failed to get vault salt")
		return
	}

	util.WriteJSON(w, http.StatusOK, dto.VaultSaltResponse{
		Salt: encodeBase64(salt),
	})
}

type upsertVaultItemInput struct {
	Ciphertext  []byte
	Nonce       []byte
	WrappedDEK  []byte
	WrapNonce   []byte
	AlgoVersion string
	Metadata    []byte
}

func parseUpsertVaultItemInput(ciphertextB64 string, nonceB64 string, wrappedDEKB64 string, wrapNonceB64 string, algoVersion string, metadata []byte) (upsertVaultItemInput, error) {
	ciphertext, err := decodeBase64Required(ciphertextB64)
	if err != nil {
		return upsertVaultItemInput{}, err
	}
	nonce, err := decodeBase64Required(nonceB64)
	if err != nil {
		return upsertVaultItemInput{}, err
	}
	wrappedDEK, err := decodeBase64Required(wrappedDEKB64)
	if err != nil {
		return upsertVaultItemInput{}, err
	}
	wrapNonce, err := decodeBase64Required(wrapNonceB64)
	if err != nil {
		return upsertVaultItemInput{}, err
	}

	return upsertVaultItemInput{
		Ciphertext:  ciphertext,
		Nonce:       nonce,
		WrappedDEK:  wrappedDEK,
		WrapNonce:   wrapNonce,
		AlgoVersion: strings.TrimSpace(algoVersion),
		Metadata:    metadata,
	}, nil
}

func decodeBase64Required(value string) ([]byte, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil, errors.New("empty base64 field")
	}
	raw, err := base64.StdEncoding.DecodeString(trimmed)
	if err != nil {
		return nil, err
	}
	if len(raw) == 0 {
		return nil, errors.New("decoded base64 field is empty")
	}
	return raw, nil
}

func encodeBase64(raw []byte) string {
	if len(raw) == 0 {
		return ""
	}
	return base64.StdEncoding.EncodeToString(raw)
}

func vaultItemToResponse(item domain.VaultItem) dto.VaultItemResponse {
	var deletedAt *string
	if item.DeletedAt != nil {
		value := item.DeletedAt.UTC().Format(time.RFC3339)
		deletedAt = &value
	}
	return dto.VaultItemResponse{
		ID:          item.ID,
		FolderID:    item.FolderID,
		Ciphertext:  encodeBase64(item.Ciphertext),
		Nonce:       encodeBase64(item.Nonce),
		WrappedDEK:  encodeBase64(item.WrappedDEK),
		WrapNonce:   encodeBase64(item.WrapNonce),
		AlgoVersion: item.AlgoVersion,
		Metadata:    item.Metadata,
		IsShared:    item.IsShared,
		Version:     item.Version,
		CreatedAt:   item.CreatedAt.UTC().Format(time.RFC3339),
		UpdatedAt:   item.UpdatedAt.UTC().Format(time.RFC3339),
		DeletedAt:   deletedAt,
	}
}

func vaultItemVersionToResponse(version domain.VaultItemVersion) dto.VaultItemVersionResponse {
	return dto.VaultItemVersionResponse{
		ID:          version.ID,
		ItemID:      version.ItemID,
		FolderID:    version.FolderID,
		Ciphertext:  encodeBase64(version.Ciphertext),
		Nonce:       encodeBase64(version.Nonce),
		WrappedDEK:  encodeBase64(version.WrappedDEK),
		WrapNonce:   encodeBase64(version.WrapNonce),
		AlgoVersion: version.AlgoVersion,
		Metadata:    version.Metadata,
		Version:     version.Version,
		CreatedAt:   version.CreatedAt.UTC().Format(time.RFC3339),
	}
}

func (c *VaultController) writeVaultError(w http.ResponseWriter, r *http.Request, err error, defaultMessage string) {
	switch {
	case errors.Is(err, domain.ErrUnauthorizedSession):
		util.WriteError(w, http.StatusUnauthorized, "unauthorized", "invalid or expired session")
	case errors.Is(err, domain.ErrInvalidVaultPayload):
		util.WriteError(w, http.StatusBadRequest, "invalid_vault_payload", "vault item payload is invalid")
	case errors.Is(err, domain.ErrNotFound):
		util.WriteError(w, http.StatusNotFound, "not_found", "vault item not found")
	default:
		c.log.ErrorContext(r.Context(), defaultMessage, slog.Any("error", err))
		util.WriteError(w, http.StatusInternalServerError, "internal_error", defaultMessage)
	}
}
