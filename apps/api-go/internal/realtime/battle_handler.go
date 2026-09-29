package realtime

import (
	"encoding/json"
	"log/slog"
	"time"
)

// BattleHandler manages battle namespace WebSocket messages.
type BattleHandler struct {
	hub    *Hub
	logger *slog.Logger
}

// NewBattleHandler creates a battle handler attached to the given hub.
func NewBattleHandler(hub *Hub, logger *slog.Logger) *BattleHandler {
	return &BattleHandler{hub: hub, logger: logger}
}

// OnConnect is called when a new battle connection is established.
func (h *BattleHandler) OnConnect(c *Conn) {
	h.logger.Info("battle connected", "conn_id", c.ID, "user_id", c.UserID)
}

// HandleMessage dispatches incoming battle messages by event type.
func (h *BattleHandler) HandleMessage(c *Conn, msg *Message) {
	switch msg.Event {
	case "battle:join":
		h.handleJoin(c, msg)
	case "battle:leave":
		h.handleLeave(c, msg)
	case "battle:action":
		h.handleAction(c, msg)
	default:
		h.logger.Debug("battle unknown event", "event", msg.Event, "conn_id", c.ID)
	}
}

func (h *BattleHandler) handleJoin(c *Conn, msg *Message) {
	h.logger.Info("battle join", "conn_id", c.ID, "user_id", c.UserID)
	data, err := Encode("battle:player_joined", map[string]string{
		"userId": c.UserID,
	})
	if err == nil {
		h.hub.Broadcast(data)
	}
}

func (h *BattleHandler) handleLeave(c *Conn, msg *Message) {
	h.logger.Info("battle leave", "conn_id", c.ID, "user_id", c.UserID)
	data, err := Encode("battle:player_left", map[string]string{
		"userId": c.UserID,
	})
	if err == nil {
		h.hub.Broadcast(data)
	}
}

func (h *BattleHandler) handleAction(c *Conn, msg *Message) {
	// Echo action back with server timestamp for MVP.
	var payload map[string]any
	if msg.Data != nil {
		_ = json.Unmarshal(msg.Data, &payload)
	}
	resp := map[string]any{
		"userId":   c.UserID,
		"payload":  payload,
		"serverTs": time.Now().UnixMilli(),
	}
	data, err := Encode("battle:action_ack", resp)
	if err == nil {
		select {
		case c.Send <- data:
		default:
		}
	}
}
