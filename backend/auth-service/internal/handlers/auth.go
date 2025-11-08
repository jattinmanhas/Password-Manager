package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/password-manager/auth-service/internal/config"
	"github.com/password-manager/auth-service/internal/service"
	"github.com/password-manager/auth-service/internal/types"
	"github.com/password-manager/auth-service/internal/utils"
)

type AuthHandler struct {
	authService *service.AuthService
	config      *config.Config
}

func NewAuthHandler(authService *service.AuthService, cfg *config.Config) *AuthHandler {
	return &AuthHandler{
		authService: authService,
		config:      cfg,
	}
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req types.RegisterRequest
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

	user, err := h.authService.Register(&req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "REGISTRATION_FAILED",
				"message": err.Error(),
			},
		})
		return
	}

	// Generate tokens
	accessToken, err := utils.GenerateJWT(user.ID, user.Email, h.config.JWTSecret, h.config.JWTExpiry)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "SERVER_ERROR",
				"message": "Failed to generate token",
			},
		})
		return
	}

	refreshToken, _ := utils.GenerateJWT(user.ID, user.Email, h.config.JWTSecret, h.config.JWTExpiry*7)

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"data": gin.H{
			"user_id":       user.ID,
			"access_token":  accessToken,
			"refresh_token": refreshToken,
			"expires_in":    h.config.JWTExpiry * 3600,
		},
		"message": "User registered successfully",
	})
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req types.LoginRequest
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

	user, accessToken, refreshToken, err := h.authService.Login(&req)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "AUTH_INVALID",
				"message": "Invalid credentials",
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": types.LoginResponse{
			UserID:       user.ID,
			AccessToken:  accessToken,
			RefreshToken: refreshToken,
			ExpiresIn:    h.config.JWTExpiry * 3600,
		},
		"message": "Login successful",
	})
}


