package middleware

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

type RateLimiter struct {
	client  *redis.Client
	enabled bool
	requests int
	window   int
}

func NewRateLimiter(client *redis.Client, enabled bool, requests, window int) *RateLimiter {
	return &RateLimiter{
		client:   client,
		enabled:  enabled,
		requests: requests,
		window:   window,
	}
}

func (rl *RateLimiter) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !rl.enabled {
			c.Next()
			return
		}

		// Get client identifier (IP address or user ID)
		clientID := c.ClientIP()
		
		// Try to get user ID from token if available
		if userID, exists := c.Get("user_id"); exists {
			clientID = "user:" + userID.(string)
		}

		// Check rate limit
		key := "ratelimit:" + clientID
		current, err := rl.client.Incr(c.Request.Context(), key).Result()
		if err != nil {
			// If Redis is unavailable, allow request (fail open)
			c.Next()
			return
		}

		// Set expiration on first request
		if current == 1 {
			rl.client.Expire(c.Request.Context(), key, time.Duration(rl.window)*time.Second)
		}

		// Set rate limit headers
		c.Header("X-RateLimit-Limit", strconv.Itoa(rl.requests))
		c.Header("X-RateLimit-Remaining", strconv.Itoa(max(0, rl.requests-int(current))))
		c.Header("X-RateLimit-Reset", strconv.FormatInt(time.Now().Add(time.Duration(rl.window)*time.Second).Unix(), 10))

		// Check if limit exceeded
		if current > int64(rl.requests) {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error": "Rate limit exceeded",
				"retry_after": rl.window,
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

