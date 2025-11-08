package proxy

import (
	"bytes"
	"io"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type Proxy struct {
	client  *http.Client
	baseURL string
}

func NewProxy(baseURL string) *Proxy {
	return &Proxy{
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
		baseURL: baseURL,
	}
}

func (p *Proxy) Handle(c *gin.Context) {
	// Create request to backend service
	url := p.baseURL + c.Request.URL.Path
	if c.Request.URL.RawQuery != "" {
		url += "?" + c.Request.URL.RawQuery
	}

	// Read request body
	var body io.Reader
	if c.Request.Body != nil {
		bodyBytes, err := io.ReadAll(c.Request.Body)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to read request body"})
			return
		}
		c.Request.Body.Close()
		body = bytes.NewBuffer(bodyBytes)
	}

	// Create new request
	req, err := http.NewRequest(c.Request.Method, url, body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create request"})
		return
	}

	// Copy headers
	for key, values := range c.Request.Header {
		// Skip hop-by-hop headers
		if key == "Connection" || key == "Keep-Alive" || key == "Proxy-Authenticate" ||
			key == "Proxy-Authorization" || key == "Te" || key == "Trailers" ||
			key == "Transfer-Encoding" || key == "Upgrade" {
			continue
		}
		for _, value := range values {
			req.Header.Add(key, value)
		}
	}

	// Forward request
	resp, err := p.client.Do(req)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "Failed to connect to backend service"})
		return
	}
	defer resp.Body.Close()

	// Read response body
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "Failed to read response"})
		return
	}

	// Copy response headers
	for key, values := range resp.Header {
		for _, value := range values {
			c.Writer.Header().Add(key, value)
		}
	}

	// Set status code and write response
	c.Data(resp.StatusCode, resp.Header.Get("Content-Type"), respBody)
}
