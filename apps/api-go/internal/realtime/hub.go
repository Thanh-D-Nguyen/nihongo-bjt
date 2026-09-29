package realtime

import (
	"sync"
)

// Conn represents an authenticated WebSocket connection.
type Conn struct {
	ID          string
	UserID      string
	DisplayName string
	Send        chan []byte
	closeOnce   sync.Once
	done        chan struct{}
}

// Hub manages all active WebSocket connections and provides broadcast/unicast helpers.
type Hub struct {
	mu    sync.RWMutex
	conns map[string]*Conn           // connID → Conn
	users map[string]map[string]bool // userID → set of connIDs
}

// NewHub creates a new connection hub.
func NewHub() *Hub {
	return &Hub{
		conns: make(map[string]*Conn),
		users: make(map[string]map[string]bool),
	}
}

// Register adds a connection to the hub.
func (h *Hub) Register(c *Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.conns[c.ID] = c
	if h.users[c.UserID] == nil {
		h.users[c.UserID] = make(map[string]bool)
	}
	h.users[c.UserID][c.ID] = true
}

// Unregister removes a connection from the hub. Returns the userID if this was
// the last connection for that user.
func (h *Hub) Unregister(connID string) (userID string, lastForUser bool) {
	h.mu.Lock()
	defer h.mu.Unlock()
	c, ok := h.conns[connID]
	if !ok {
		return "", false
	}
	delete(h.conns, connID)
	userID = c.UserID
	if userConns, exists := h.users[userID]; exists {
		delete(userConns, connID)
		if len(userConns) == 0 {
			delete(h.users, userID)
			return userID, true
		}
	}
	return userID, false
}

// SendToUser sends a message to all connections belonging to a specific user.
func (h *Hub) SendToUser(userID string, data []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for connID := range h.users[userID] {
		if c, ok := h.conns[connID]; ok {
			select {
			case c.Send <- data:
			default:
				// Drop if send buffer full; client is too slow.
			}
		}
	}
}

// Broadcast sends a message to all connected clients.
func (h *Hub) Broadcast(data []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for _, c := range h.conns {
		select {
		case c.Send <- data:
		default:
		}
	}
}

// BroadcastExcept sends a message to all connected clients except the specified connID.
func (h *Hub) BroadcastExcept(exceptConnID string, data []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for id, c := range h.conns {
		if id == exceptConnID {
			continue
		}
		select {
		case c.Send <- data:
		default:
		}
	}
}

// GetConn returns the connection for a given connID, or nil if not found.
func (h *Hub) GetConn(connID string) *Conn {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.conns[connID]
}

// UserConnCount returns the number of active connections for a user.
func (h *Hub) UserConnCount(userID string) int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.users[userID])
}

// OnlineUsers returns all userIDs with at least one active connection.
func (h *Hub) OnlineUsers() []string {
	h.mu.RLock()
	defer h.mu.RUnlock()
	result := make([]string, 0, len(h.users))
	for uid := range h.users {
		result = append(result, uid)
	}
	return result
}
