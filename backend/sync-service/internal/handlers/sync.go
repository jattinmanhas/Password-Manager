package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/google/uuid"
	"github.com/password-manager/sync-service/internal/config"
	"github.com/password-manager/sync-service/internal/middleware"
	"github.com/password-manager/sync-service/internal/service"
	"github.com/password-manager/sync-service/internal/types"
	"github.com/password-manager/sync-service/internal/utils"
)

type SyncHandler struct {
	syncService *service.SyncService
	config      *config.Config
	upgrader    websocket.Upgrader
}

func NewSyncHandler(syncService *service.SyncService, cfg *config.Config) *SyncHandler {
	return &SyncHandler{
		syncService: syncService,
		config:      cfg,
		upgrader: websocket.Upgrader{
			ReadBufferSize:  cfg.WebSocketReadBufferSize,
			WriteBufferSize: cfg.WebSocketWriteBufferSize,
			CheckOrigin: func(r *http.Request) bool {
				// In production, validate origin
				return true
			},
		},
	}
}

// Sync handles HTTP sync requests
func (h *SyncHandler) Sync(c *gin.Context) {
	userIDInterface, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User ID not found"})
		return
	}

	userID, ok := userIDInterface.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var req types.SyncRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	response, err := h.syncService.Sync(userID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, response)
}

// WebSocketSync handles WebSocket connections for real-time sync
func (h *SyncHandler) WebSocketSync(c *gin.Context) {
	// Extract token from query parameter
	token := c.Query("token")
	if token == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Token required"})
		return
	}

	// Validate token
	claims, err := utils.ValidateJWT(token, h.config.JWTSecret)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
		return
	}

	// Upgrade to WebSocket
	conn, err := h.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}
	defer conn.Close()

	// Set read/write deadlines
	conn.SetReadDeadline(time.Now().Add(time.Duration(h.config.WebSocketPongWait) * time.Second))
	conn.SetPongHandler(func(string) error {
		conn.SetReadDeadline(time.Now().Add(time.Duration(h.config.WebSocketPongWait) * time.Second))
		return nil
	})

	// Start ping ticker
	ticker := time.NewTicker(time.Duration(h.config.WebSocketPingPeriod) * time.Second)
	defer ticker.Stop()

	// Message channel
	messageChan := make(chan types.WebSocketMessage, 256)

	// Read messages
	go func() {
		defer close(messageChan)
		for {
			var msg types.WebSocketMessage
			err := conn.ReadJSON(&msg)
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					log.Printf("WebSocket error: %v", err)
				}
				return
			}
			messageChan <- msg
		}
	}()

	// Handle messages
	for {
		select {
		case msg, ok := <-messageChan:
			if !ok {
				return
			}

			switch msg.Type {
			case "sync":
				h.handleSyncMessage(conn, claims.UserID, msg)
			case "pong":
				// Pong received
			default:
				h.sendError(conn, "Unknown message type")
			}

		case <-ticker.C:
			// Send ping
			if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (h *SyncHandler) handleSyncMessage(conn *websocket.Conn, userID uuid.UUID, msg types.WebSocketMessage) {
	// Parse sync request
	payloadBytes, err := json.Marshal(msg.Payload)
	if err != nil {
		h.sendError(conn, "Invalid payload")
		return
	}

	var req types.SyncRequest
	if err := json.Unmarshal(payloadBytes, &req); err != nil {
		h.sendError(conn, "Invalid sync request")
		return
	}

	// Perform sync
	response, err := h.syncService.Sync(userID, &req)
	if err != nil {
		h.sendError(conn, err.Error())
		return
	}

	// Send response
	h.sendMessage(conn, "sync", response)
}

func (h *SyncHandler) sendMessage(conn *websocket.Conn, msgType string, payload interface{}) {
	msg := types.WebSocketMessage{
		Type:    msgType,
		Payload: payload,
	}
	if err := conn.WriteJSON(msg); err != nil {
		log.Printf("WebSocket write error: %v", err)
	}
}

func (h *SyncHandler) sendError(conn *websocket.Conn, message string) {
	h.sendMessage(conn, "error", gin.H{"message": message})
}

// RegisterDevice registers a new device
func (h *SyncHandler) RegisterDevice(c *gin.Context) {
	userIDInterface, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User ID not found"})
		return
	}

	userID, ok := userIDInterface.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var req struct {
		Name string `json:"name" binding:"required"`
		Type string `json:"type" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	device, err := h.syncService.RegisterDevice(userID, req.Name, req.Type)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, device)
}

// GetDevices returns all devices for the user
func (h *SyncHandler) GetDevices(c *gin.Context) {
	userIDInterface, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User ID not found"})
		return
	}

	userID, ok := userIDInterface.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	devices, err := h.syncService.GetDevices(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, devices)
}

