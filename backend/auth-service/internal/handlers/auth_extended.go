package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/password-manager/auth-service/internal/redis"
	"github.com/password-manager/auth-service/internal/types"
)

func (h *AuthHandler) RefreshToken(c *gin.Context) {
	var req types.RefreshTokenRequest
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

	// Get Redis client from context (set in main.go)
	redisClient, exists := c.Get("redis_client")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "SERVER_ERROR",
				"message": "Redis client not available",
			},
		})
		return
	}

	result, err := h.authService.RefreshToken(req.RefreshToken, redisClient.(*redis.Client))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "AUTH_INVALID",
				"message": err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    result,
		"message": "Token refreshed successfully",
	})
}

func (h *AuthHandler) Logout(c *gin.Context) {
	// Get token from Authorization header
	authHeader := c.GetHeader("Authorization")
	if authHeader == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "VALIDATION_ERROR",
				"message": "Authorization header required",
			},
		})
		return
	}

	// Extract token (assuming "Bearer <token>" format)
	tokenString := authHeader
	if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
		tokenString = authHeader[7:]
	}

	// Get Redis client from context
	redisClient, exists := c.Get("redis_client")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "SERVER_ERROR",
				"message": "Redis client not available",
			},
		})
		return
	}

	err := h.authService.Logout(tokenString, redisClient.(*redis.Client))
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
		"message": "Logged out successfully",
	})
}

func (h *AuthHandler) Enable2FA(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "AUTH_REQUIRED",
				"message": "User ID not found",
			},
		})
		return
	}

	var req types.Enable2FARequest
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

	result, err := h.authService.Enable2FA(userID.(uuid.UUID), req.Password)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "ENABLE_2FA_FAILED",
				"message": err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    result,
		"message": "2FA enabled successfully",
	})
}

func (h *AuthHandler) Verify2FA(c *gin.Context) {
	var req types.Verify2FARequest
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

	// Get user ID from session/token (this would be set during login)
	userIDStr := c.Query("user_id")
	if userIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "VALIDATION_ERROR",
				"message": "user_id required",
			},
		})
		return
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "VALIDATION_ERROR",
				"message": "invalid user_id",
			},
		})
		return
	}

	// Get password from request (needed to decrypt 2FA secret)
	password := c.Query("password")
	if password == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "VALIDATION_ERROR",
				"message": "password required",
			},
		})
		return
	}

	valid, err := h.authService.Verify2FA(userID, req.Code, password)
	if err != nil || !valid {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "AUTH_INVALID",
				"message": "Invalid 2FA code",
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "2FA verified successfully",
	})
}

func (h *AuthHandler) Disable2FA(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "AUTH_REQUIRED",
				"message": "User ID not found",
			},
		})
		return
	}

	var req types.Disable2FARequest
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

	err := h.authService.Disable2FA(userID.(uuid.UUID), req.Password, req.Code)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "DISABLE_2FA_FAILED",
				"message": err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "2FA disabled successfully",
	})
}

func (h *AuthHandler) ForgotPassword(c *gin.Context) {
	var req types.ForgotPasswordRequest
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

	// Get Redis client from context
	redisClient, exists := c.Get("redis_client")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "SERVER_ERROR",
				"message": "Redis client not available",
			},
		})
		return
	}

	err := h.authService.ForgotPassword(req.Email, redisClient.(*redis.Client))
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

	// Always return success (don't reveal if email exists)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "If the email exists, a password reset link has been sent",
	})
}

func (h *AuthHandler) ResetPassword(c *gin.Context) {
	var req types.ResetPasswordRequest
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

	// Get Redis client from context
	redisClient, exists := c.Get("redis_client")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "SERVER_ERROR",
				"message": "Redis client not available",
			},
		})
		return
	}

	err := h.authService.ResetPassword(req.Token, req.NewPassword, redisClient.(*redis.Client))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "RESET_FAILED",
				"message": err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Password reset successfully",
	})
}

func (h *AuthHandler) ChangePassword(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "AUTH_REQUIRED",
				"message": "User ID not found",
			},
		})
		return
	}

	var req types.ChangePasswordRequest
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

	err := h.authService.ChangePassword(userID.(uuid.UUID), req.CurrentPassword, req.NewPassword)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "CHANGE_PASSWORD_FAILED",
				"message": err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Password changed successfully",
	})
}

