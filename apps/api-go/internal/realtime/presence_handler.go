package realtime

import (
	"context"
	"encoding/json"
	"log/slog"
	"time"
)

// PresenceHandler processes presence namespace WebSocket messages.
type PresenceHandler struct {
	hub     *Hub
	service *PresenceService
	logger  *slog.Logger
}

// NewPresenceHandler creates a presence handler. If service is nil, presence
// tracking is disabled but connections still work (no-op).
func NewPresenceHandler(hub *Hub, logger *slog.Logger) *PresenceHandler {
	return &PresenceHandler{
		hub:    hub,
		logger: logger,
	}
}

// SetService attaches the Redis-backed presence service after construction.
func (h *PresenceHandler) SetService(svc *PresenceService) {
	h.service = svc
}

// OnConnect marks the user online when a presence WebSocket connects.
func (h *PresenceHandler) OnConnect(c *Conn) {
	if h.service == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := h.service.SetOnline(ctx, c.UserID); err != nil {
		h.logger.Error("presence set online failed", "user", c.UserID, "error", err)
		return
	}
	// Broadcast user_online to all presence connections.
	data, err := Encode("presence:user_online", map[string]string{
		"userId":      c.UserID,
		"displayName": c.DisplayName,
	})
	if err == nil {
		h.hub.Broadcast(data)
	}
}

// OnDisconnect marks the user offline when their last presence connection closes.
func (h *PresenceHandler) OnDisconnect(c *Conn, userID string, lastForUser bool) {
	if !lastForUser || h.service == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := h.service.SetOffline(ctx, userID); err != nil {
		h.logger.Error("presence set offline failed", "user", userID, "error", err)
		return
	}
	data, err := Encode("presence:user_offline", map[string]string{
		"userId": userID,
	})
	if err == nil {
		h.hub.Broadcast(data)
	}
}

// HandleMessage dispatches incoming presence messages.
func (h *PresenceHandler) HandleMessage(c *Conn, msg *Message) {
	switch msg.Event {
	case "presence:heartbeat":
		h.handleHeartbeat(c)
	case "presence:query":
		h.handleQuery(c, msg.Data)
	default:
		data, _ := Encode("presence:error", ErrorPayload{Message: "unknown event: " + msg.Event})
		select {
		case c.Send <- data:
		default:
		}
	}
}

func (h *PresenceHandler) handleHeartbeat(c *Conn) {
	if h.service == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := h.service.Heartbeat(ctx, c.UserID); err != nil {
		h.logger.Error("presence heartbeat failed", "user", c.UserID, "error", err)
	}
}

type presenceQueryRequest struct {
	UserIDs []string `json:"userIds"`
}

func (h *PresenceHandler) handleQuery(c *Conn, raw json.RawMessage) {
	var req presenceQueryRequest
	if err := json.Unmarshal(raw, &req); err != nil || len(req.UserIDs) == 0 {
		data, _ := Encode("presence:error", ErrorPayload{Message: "invalid query: userIds required"})
		select {
		case c.Send <- data:
		default:
		}
		return
	}
	if len(req.UserIDs) > 50 {
		data, _ := Encode("presence:error", ErrorPayload{Message: "userIds limited to 50"})
		select {
		case c.Send <- data:
		default:
		}
		return
	}

	if h.service == nil {
		// No Redis: return all offline.
		result := make(map[string]PresenceInfo, len(req.UserIDs))
		for _, uid := range req.UserIDs {
			result[uid] = PresenceInfo{Online: false}
		}
		data, _ := Encode("presence:query_result", result)
		select {
		case c.Send <- data:
		default:
		}
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	info, err := h.service.GetPresenceBatch(ctx, req.UserIDs)
	if err != nil {
		h.logger.Error("presence query failed", "error", err)
		data, _ := Encode("presence:error", ErrorPayload{Message: "query failed"})
		select {
		case c.Send <- data:
		default:
		}
		return
	}
	data, _ := Encode("presence:query_result", info)
	select {
	case c.Send <- data:
	default:
	}
}
