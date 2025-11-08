package handlers

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/password-manager/vault-service/internal/config"
	"github.com/password-manager/vault-service/internal/middleware"
	"github.com/password-manager/vault-service/internal/service"
	"github.com/password-manager/vault-service/internal/types"
)

type VaultHandler struct {
	vaultService *service.VaultService
	config       *config.Config
}

func NewVaultHandler(vaultService *service.VaultService, cfg *config.Config) *VaultHandler {
	return &VaultHandler{
		vaultService: vaultService,
		config:       cfg,
	}
}

func (h *VaultHandler) GetItems(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "AUTH_REQUIRED",
				"message": "User ID not found",
			},
		})
		return
	}

	// Get query parameters
	folderIDStr := c.Query("folderId")
	itemType := c.Query("type")

	var folderID *uuid.UUID
	if folderIDStr != "" {
		id, err := uuid.Parse(folderIDStr)
		if err == nil {
			folderID = &id
		}
	}

	items, err := h.vaultService.GetItems(userID, folderID, itemType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "SERVER_ERROR",
				"message": err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"items": items,
			"total": len(items),
		},
	})
}

func (h *VaultHandler) GetItem(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "AUTH_REQUIRED",
				"message": "User ID not found",
			},
		})
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "VALIDATION_ERROR",
				"message": "Invalid item ID",
			},
		})
		return
	}

	item, err := h.vaultService.GetItem(id, userID)
	if err != nil {
		if err.Error() == "item not found" {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "NOT_FOUND",
					"message": "Item not found",
				},
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "SERVER_ERROR",
				"message": err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    item,
	})
}

func (h *VaultHandler) CreateItem(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "AUTH_REQUIRED",
				"message": "User ID not found",
			},
		})
		return
	}

	var req types.CreateVaultItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "VALIDATION_ERROR",
				"message": err.Error(),
			},
		})
		return
	}

	item, err := h.vaultService.CreateItem(userID, &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "CREATION_FAILED",
				"message": err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"data":    item,
		"message": "Item created successfully",
	})
}

func (h *VaultHandler) UpdateItem(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "AUTH_REQUIRED",
				"message": "User ID not found",
			},
		})
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "VALIDATION_ERROR",
				"message": "Invalid item ID",
			},
		})
		return
	}

	var req types.UpdateVaultItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "VALIDATION_ERROR",
				"message": err.Error(),
			},
		})
		return
	}

	item, err := h.vaultService.UpdateItem(id, userID, &req)
	if err != nil {
		if err.Error() == "item not found" {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "NOT_FOUND",
					"message": "Item not found",
				},
			})
			return
		}
		if err.Error() == "version conflict: item was modified by another request" {
			c.JSON(http.StatusConflict, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "CONFLICT",
					"message": "Version conflict: item was modified by another request",
				},
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "SERVER_ERROR",
				"message": err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    item,
		"message": "Item updated successfully",
	})
}

func (h *VaultHandler) DeleteItem(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "AUTH_REQUIRED",
				"message": "User ID not found",
			},
		})
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "VALIDATION_ERROR",
				"message": "Invalid item ID",
			},
		})
		return
	}

	err = h.vaultService.DeleteItem(id, userID)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "NOT_FOUND",
					"message": "Item not found",
				},
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "SERVER_ERROR",
				"message": err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Item deleted successfully",
	})
}

func (h *VaultHandler) SearchItems(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "AUTH_REQUIRED",
				"message": "User ID not found",
			},
		})
		return
	}

	var req types.SearchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "VALIDATION_ERROR",
				"message": err.Error(),
			},
		})
		return
	}

	// Note: In production, searchKey should come from user's encryption key
	// For now, we'll pass nil and let the service handle it
	items, err := h.vaultService.SearchItems(userID, &req, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "SERVER_ERROR",
				"message": err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"items": items,
			"total": len(items),
		},
	})
}

func (h *VaultHandler) GeneratePassword(c *gin.Context) {
	var req types.GeneratePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		// Use defaults if no body provided
		req = types.GeneratePasswordRequest{
			Length:          20,
			IncludeUppercase: true,
			IncludeLowercase: true,
			IncludeNumbers:   true,
			IncludeSymbols:   true,
		}
	}

	result, err := h.vaultService.GeneratePassword(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "SERVER_ERROR",
				"message": err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    result,
	})
}

func (h *VaultHandler) GetFolders(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "AUTH_REQUIRED",
				"message": "User ID not found",
			},
		})
		return
	}

	parentIDStr := c.Query("parentId")
	var parentID *uuid.UUID
	if parentIDStr != "" {
		id, err := uuid.Parse(parentIDStr)
		if err == nil {
			parentID = &id
		}
	}

	folders, err := h.vaultService.GetFolders(userID, parentID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "SERVER_ERROR",
				"message": err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"folders": folders,
			"total":   len(folders),
		},
	})
}

func (h *VaultHandler) CreateFolder(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "AUTH_REQUIRED",
				"message": "User ID not found",
			},
		})
		return
	}

	var req types.CreateFolderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "VALIDATION_ERROR",
				"message": err.Error(),
			},
		})
		return
	}

	folder, err := h.vaultService.CreateFolder(userID, &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "CREATION_FAILED",
				"message": err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"data":    folder,
		"message": "Folder created successfully",
	})
}

func (h *VaultHandler) UpdateFolder(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "AUTH_REQUIRED",
				"message": "User ID not found",
			},
		})
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "VALIDATION_ERROR",
				"message": "Invalid folder ID",
			},
		})
		return
	}

	var req types.UpdateFolderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "VALIDATION_ERROR",
				"message": err.Error(),
			},
		})
		return
	}

	folder, err := h.vaultService.UpdateFolder(id, userID, &req)
	if err != nil {
		if err.Error() == "folder not found" {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "NOT_FOUND",
					"message": "Folder not found",
				},
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "SERVER_ERROR",
				"message": err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    folder,
		"message": "Folder updated successfully",
	})
}

func (h *VaultHandler) DeleteFolder(c *gin.Context) {
	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "AUTH_REQUIRED",
				"message": "User ID not found",
			},
		})
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "VALIDATION_ERROR",
				"message": "Invalid folder ID",
			},
		})
		return
	}

	err = h.vaultService.DeleteFolder(id, userID)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "DELETE_FAILED",
					"message": "Cannot delete folder: it contains items or subfolders",
				},
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "SERVER_ERROR",
				"message": err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Folder deleted successfully",
	})
}

