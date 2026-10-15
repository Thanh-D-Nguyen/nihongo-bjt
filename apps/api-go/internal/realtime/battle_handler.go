package realtime

import (
	"encoding/json"
	"log/slog"
	"sync"
	"time"
)

// BattleHandler manages battle namespace WebSocket messages.
type BattleHandler struct {
	hub    *Hub
	logger *slog.Logger
	mu     sync.RWMutex
	lobby  map[string]LobbyUser
}

// NewBattleHandler creates a battle handler attached to the given hub.
func NewBattleHandler(hub *Hub, logger *slog.Logger) *BattleHandler {
	return &BattleHandler{hub: hub, logger: logger, lobby: make(map[string]LobbyUser)}
}

// OnConnect is called when a new battle connection is established.
func (h *BattleHandler) OnConnect(c *Conn) {
	h.logger.Info("battle connected", "conn_id", c.ID, "user_id", c.UserID)
}

// HandleMessage dispatches incoming battle messages by event type.
func (h *BattleHandler) HandleMessage(c *Conn, msg *Message) {
	switch msg.Event {
	case "battle:lobby_join":
		h.handleLobbyJoin(c)
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

func (h *BattleHandler) handleLobbyJoin(c *Conn) {
	data, err := Encode("battle:lobby_joined", map[string]string{
		"userId":      c.UserID,
		"displayName": c.DisplayName,
	})
	if err != nil {
		h.logger.Error("encode battle lobby join", "error", err)
		return
	}
	select {
	case c.Send <- data:
	default:
		h.logger.Warn("drop battle lobby join acknowledgement", "conn_id", c.ID)
	}
	h.mu.Lock()
	h.lobby[c.ID] = LobbyUser{UserID: c.UserID, DisplayName: c.DisplayName, JoinedAt: time.Now()}
	h.mu.Unlock()
	h.broadcastLobbyPresence()
}

func (h *BattleHandler) OnDisconnect(c *Conn) {
	h.mu.Lock()
	_, joined := h.lobby[c.ID]
	delete(h.lobby, c.ID)
	h.mu.Unlock()
	if joined {
		h.broadcastLobbyPresence()
	}
}

func (h *BattleHandler) broadcastLobbyPresence() {
	h.mu.RLock()
	connections := make([]*Conn, 0, len(h.lobby))
	users := make(map[string]LobbyUser, len(h.lobby))
	for connID, user := range h.lobby {
		if conn := h.hub.GetConn(connID); conn != nil {
			connections = append(connections, conn)
			if _, exists := users[user.UserID]; !exists {
				users[user.UserID] = user
			}
		}
	}
	h.mu.RUnlock()

	userList := make([]LobbyUser, 0, len(users))
	for _, user := range users {
		userList = append(userList, user)
	}
	data, err := Encode("battle:lobby_presence", LobbyPresencePayload{Users: userList})
	if err != nil {
		h.logger.Error("encode battle lobby presence", "error", err)
		return
	}
	for _, conn := range connections {
		select {
		case conn.Send <- data:
		default:
			h.logger.Warn("drop battle lobby presence", "conn_id", conn.ID)
		}
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
