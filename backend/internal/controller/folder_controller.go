package controller

import (
	"encoding/base64"
	"net/http"
	"strings"
	"time"

	"pmv2/backend/internal/domain"
	"pmv2/backend/internal/dto"
	"pmv2/backend/internal/service"
	"pmv2/backend/internal/util"
)

type FolderController struct {
	folders *service.FolderService
}

func NewFolderController(folderService *service.FolderService) *FolderController {
	return &FolderController{folders: folderService}
}

func (c *FolderController) HandleCreateFolder(w http.ResponseWriter, r *http.Request, session domain.Session) {
	var req dto.CreateFolderRequest
	if err := util.ReadJSON(r, &req); err != nil {
		util.WriteError(w, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}

	nameCiphertext, err := base64.StdEncoding.DecodeString(req.NameCiphertext)
	if err != nil {
		util.WriteError(w, http.StatusBadRequest, "invalid_payload", "name_ciphertext is invalid base64")
		return
	}

	nonce, err := base64.StdEncoding.DecodeString(req.Nonce)
	if err != nil {
		util.WriteError(w, http.StatusBadRequest, "invalid_payload", "nonce is invalid base64")
		return
	}

	folder, err := c.folders.CreateFolder(r.Context(), domain.CreateVaultFolderInput{
		OwnerUserID:    session.UserID,
		NameCiphertext: nameCiphertext,
		Nonce:          nonce,
	})
	if err != nil {
		util.WriteError(w, http.StatusInternalServerError, "internal_error", "failed to create folder")
		return
	}

	util.WriteJSON(w, http.StatusCreated, folderToResponse(folder))
}

func (c *FolderController) HandleListFolders(w http.ResponseWriter, r *http.Request, session domain.Session) {
	folders, err := c.folders.ListFolders(r.Context(), session.UserID)
	if err != nil {
		util.WriteError(w, http.StatusInternalServerError, "internal_error", "failed to list folders")
		return
	}

	resp := dto.FoldersResponse{Folders: make([]dto.FolderResponse, 0, len(folders))}
	for _, f := range folders {
		resp.Folders = append(resp.Folders, folderToResponse(f))
	}
	util.WriteJSON(w, http.StatusOK, resp)
}

func (c *FolderController) HandleUpdateFolder(w http.ResponseWriter, r *http.Request, session domain.Session) {
	folderID := strings.TrimSpace(r.PathValue("folder_id"))

	var req dto.CreateFolderRequest
	if err := util.ReadJSON(r, &req); err != nil {
		util.WriteError(w, http.StatusBadRequest, "invalid_json", "invalid request body")
		return
	}

	nameCiphertext, err := base64.StdEncoding.DecodeString(req.NameCiphertext)
	if err != nil {
		util.WriteError(w, http.StatusBadRequest, "invalid_payload", "name_ciphertext is invalid base64")
		return
	}

	nonce, err := base64.StdEncoding.DecodeString(req.Nonce)
	if err != nil {
		util.WriteError(w, http.StatusBadRequest, "invalid_payload", "nonce is invalid base64")
		return
	}

	folder, err := c.folders.UpdateFolder(r.Context(), session.UserID, folderID, nameCiphertext, nonce)
	if err != nil {
		util.WriteError(w, http.StatusInternalServerError, "internal_error", "failed to update folder")
		return
	}

	util.WriteJSON(w, http.StatusOK, folderToResponse(folder))
}

func (c *FolderController) HandleDeleteFolder(w http.ResponseWriter, r *http.Request, session domain.Session) {
	folderID := strings.TrimSpace(r.PathValue("folder_id"))
	if err := c.folders.DeleteFolder(r.Context(), session.UserID, folderID); err != nil {
		util.WriteError(w, http.StatusInternalServerError, "internal_error", "failed to delete folder")
		return
	}

	util.WriteJSON(w, http.StatusOK, dto.StatusResponse{Status: "deleted"})
}

func folderToResponse(f domain.VaultFolder) dto.FolderResponse {
	return dto.FolderResponse{
		ID:             f.ID,
		NameCiphertext: base64.StdEncoding.EncodeToString(f.NameCiphertext),
		Nonce:          base64.StdEncoding.EncodeToString(f.Nonce),
		CreatedAt:      f.CreatedAt.UTC().Format(time.RFC3339),
		UpdatedAt:      f.UpdatedAt.UTC().Format(time.RFC3339),
	}
}
