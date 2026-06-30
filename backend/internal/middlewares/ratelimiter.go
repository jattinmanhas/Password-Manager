package middlewares

import (
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"golang.org/x/time/rate"

	"pmv2/backend/internal/util"
)

type clientContext struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

type RateLimiter struct {
	clients map[string]*clientContext
	mu      sync.Mutex
	rate    rate.Limit
	burst   int
}

func NewRateLimiter(r rate.Limit, b int) *RateLimiter {
	rl := &RateLimiter{
		clients: make(map[string]*clientContext),
		rate:    r,
		burst:   b,
	}

	go rl.cleanup()
	return rl
}

func (rl *RateLimiter) cleanup() {
	for {
		time.Sleep(time.Minute)
		rl.mu.Lock()
		for ip, client := range rl.clients {
			if time.Since(client.lastSeen) > 3*time.Minute {
				delete(rl.clients, ip)
			}
		}
		rl.mu.Unlock()
	}
}

func (rl *RateLimiter) Middleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ip := util.ClientIPFromRequest(r)

		rl.mu.Lock()
		if _, found := rl.clients[ip]; !found {
			rl.clients[ip] = &clientContext{limiter: rate.NewLimiter(rl.rate, rl.burst)}
		}
		rl.clients[ip].lastSeen = time.Now()
		limiter := rl.clients[ip].limiter
		rl.mu.Unlock()

		if !limiter.Allow() {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusTooManyRequests)
			json.NewEncoder(w).Encode(map[string]string{
				"error":   "rate_limit_exceeded",
				"message": "too many requests, please try again later",
			})
			return
		}

		next.ServeHTTP(w, r)
	}
}
