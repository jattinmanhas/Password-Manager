package middleware

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/password-manager/auth-service/internal/config"
	"github.com/password-manager/auth-service/internal/redis"
)

func RateLimitMiddleware(redisClient *redis.Client, cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get client identifier (IP address or user ID)
		identifier := c.ClientIP()
		
		// If user is authenticated, use user ID instead
		if userID, exists := c.Get("user_id"); exists {
			identifier = fmt.Sprintf("user:%v", userID)
		}

		key := fmt.Sprintf("ratelimit:%s:%s", c.Request.URL.Path, identifier)

		// Check current count
		count, err := redisClient.Increment(key)
		if err != nil {
			// If Redis fails, allow request (fail open)
			c.Next()
			return
		}

		// Set expiration on first request
		if count == 1 {
			redisClient.Expire(key, time.Duration(cfg.RateLimitWindow)*time.Second)
		}

		// Check if limit exceeded
		if count > int64(cfg.RateLimitRequests) {
			c.Header("X-RateLimit-Limit", strconv.Itoa(cfg.RateLimitRequests))
			c.Header("X-RateLimit-Remaining", "0")
			c.Header("X-RateLimit-Reset", strconv.FormatInt(time.Now().Add(time.Duration(cfg.RateLimitWindow)*time.Second).Unix(), 10))
			
			c.JSON(http.StatusTooManyRequests, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "RATE_LIMIT",
					"message": fmt.Sprintf("Rate limit exceeded. Maximum %d requests per %d seconds", cfg.RateLimitRequests, cfg.RateLimitWindow),
				},
			})
			c.Abort()
			return
		}

		// Set rate limit headers
		remaining := cfg.RateLimitRequests - int(count)
		if remaining < 0 {
			remaining = 0
		}
		c.Header("X-RateLimit-Limit", strconv.Itoa(cfg.RateLimitRequests))
		c.Header("X-RateLimit-Remaining", strconv.Itoa(remaining))
		c.Header("X-RateLimit-Reset", strconv.FormatInt(time.Now().Add(time.Duration(cfg.RateLimitWindow)*time.Second).Unix(), 10))

		c.Next()
	}
}

