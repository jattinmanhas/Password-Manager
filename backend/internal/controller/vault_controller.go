package controller

import (
	"encoding/base64"
	"errors"
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
}

func NewVaultController(vaultService *service.VaultService) *VaultController {
	return &VaultController{vault: vaultService}
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
		Ciphertext:  input.Ciphertext,
		Nonce:       input.Nonce,
		WrappedDEK:  input.WrappedDEK,
		WrapNonce:   input.WrapNonce,
		AlgoVersion: input.AlgoVersion,
		Metadata:    input.Metadata,
	})
	if err != nil {
		c.writeVaultError(w, err, "failed to create vault item")
		return
	}

	util.WriteJSON(w, http.StatusCreated, vaultItemToResponse(item))
}

func (c *VaultController) HandleListItems(w http.ResponseWriter, r *http.Request, session domain.Session) {
	items, err := c.vault.ListItems(r.Context(), session.UserID)
	if err != nil {
		c.writeVaultError(w, err, "failed to list vault items")
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
		c.writeVaultError(w, err, "failed to load vault item")
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
		Ciphertext:  input.Ciphertext,
		Nonce:       input.Nonce,
		WrappedDEK:  input.WrappedDEK,
		WrapNonce:   input.WrapNonce,
		AlgoVersion: input.AlgoVersion,
		Metadata:    input.Metadata,
	})
	if err != nil {
		c.writeVaultError(w, err, "failed to update vault item")
		return
	}

	util.WriteJSON(w, http.StatusOK, vaultItemToResponse(item))
}

func (c *VaultController) HandleDeleteItem(w http.ResponseWriter, r *http.Request, session domain.Session) {
	itemID := strings.TrimSpace(r.PathValue("item_id"))
	if err := c.vault.DeleteItem(r.Context(), session.UserID, itemID); err != nil {
		c.writeVaultError(w, err, "failed to delete vault item")
		return
	}

	util.WriteJSON(w, http.StatusOK, dto.StatusResponse{Status: "deleted"})
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
	return dto.VaultItemResponse{
		ID:          item.ID,
		Ciphertext:  encodeBase64(item.Ciphertext),
		Nonce:       encodeBase64(item.Nonce),
		WrappedDEK:  encodeBase64(item.WrappedDEK),
		WrapNonce:   encodeBase64(item.WrapNonce),
		AlgoVersion: item.AlgoVersion,
		Metadata:    item.Metadata,
		CreatedAt:   item.CreatedAt.UTC().Format(time.RFC3339),
		UpdatedAt:   item.UpdatedAt.UTC().Format(time.RFC3339),
	}
}

func (c *VaultController) writeVaultError(w http.ResponseWriter, err error, defaultMessage string) {
	switch {
	case errors.Is(err, domain.ErrUnauthorizedSession):
		util.WriteError(w, http.StatusUnauthorized, "unauthorized", "invalid or expired session")
	case errors.Is(err, domain.ErrInvalidVaultPayload):
		util.WriteError(w, http.StatusBadRequest, "invalid_vault_payload", "vault item payload is invalid")
	case errors.Is(err, domain.ErrNotFound):
		util.WriteError(w, http.StatusNotFound, "not_found", "vault item not found")
	default:
		util.WriteError(w, http.StatusInternalServerError, "internal_error", defaultMessage)
	}
}
