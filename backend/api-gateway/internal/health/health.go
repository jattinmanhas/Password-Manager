package health

import (
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type HealthStatus struct {
	Status    string            `json:"status"`
	Timestamp time.Time         `json:"timestamp"`
	Services  map[string]string `json:"services"`
}

type HealthChecker struct {
	services map[string]string
	mu       sync.RWMutex
}

func NewHealthChecker(services map[string]string) *HealthChecker {
	return &HealthChecker{
		services: services,
	}
}

func (hc *HealthChecker) CheckHealth(c *gin.Context) {
	hc.mu.RLock()
	defer hc.mu.RUnlock()

	status := HealthStatus{
		Status:    "healthy",
		Timestamp: time.Now(),
		Services:  make(map[string]string),
	}

	// Check each service
	var wg sync.WaitGroup
	var mu sync.Mutex

	for name, url := range hc.services {
		wg.Add(1)
		go func(serviceName, serviceURL string) {
			defer wg.Done()
			healthy := hc.checkService(serviceURL)
			mu.Lock()
			if healthy {
				status.Services[serviceName] = "healthy"
			} else {
				status.Services[serviceName] = "unhealthy"
				status.Status = "degraded"
			}
			mu.Unlock()
		}(name, url)
	}

	wg.Wait()

	// Determine overall status
	allHealthy := true
	for _, serviceStatus := range status.Services {
		if serviceStatus != "healthy" {
			allHealthy = false
			break
		}
	}

	if !allHealthy && status.Status == "healthy" {
		status.Status = "degraded"
	}

	statusCode := http.StatusOK
	if status.Status == "degraded" {
		statusCode = http.StatusServiceUnavailable
	}

	c.JSON(statusCode, status)
}

func (hc *HealthChecker) checkService(url string) bool {
	client := &http.Client{
		Timeout: 2 * time.Second,
	}

	resp, err := client.Get(url + "/health")
	if err != nil {
		return false
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return false
	}

	return resp.StatusCode == http.StatusOK
}

