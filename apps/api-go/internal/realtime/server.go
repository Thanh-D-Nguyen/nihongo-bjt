package realtime

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"nhooyr.io/websocket"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

const (
	// maxMessageSize bounds WebSocket message size (64KB).
	maxMessageSize = 64 * 1024

	// writeWait is the deadline for writing a message to the client.
	writeWait = 10 * time.Second

	// sendBufferSize is the channel buffer for outgoing messages per connection.
	sendBufferSize = 256
)

// Server manages WebSocket connections for battle and presence namespaces.
type Server struct {
	hub       *Hub
	sessStore *session.Store
	battle    *BattleHandler
	presence  *PresenceHandler
	logger    *slog.Logger
}

// NewServer creates a new realtime WebSocket server.
func NewServer(sessStore *session.Store, logger *slog.Logger) *Server {
	hub := NewHub()
	return &Server{
		hub:       hub,
		sessStore: sessStore,
		battle:    NewBattleHandler(hub, logger),
		presence:  NewPresenceHandler(hub, logger),
		logger:    logger,
	}
}

// HandleBattleUpgrade handles WebSocket upgrade requests for /ws/battle.
func (s *Server) HandleBattleUpgrade(w http.ResponseWriter, r *http.Request) {
	user := AuthenticateBattleRequest(r.Context(), r, s.sessStore)
	if user == nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		InsecureSkipVerify: true, // Origin checked via session auth, not header
	})
	if err != nil {
		s.logger.Error("battle ws accept failed", "error", err)
		return
	}

	c := &Conn{
		ID:     fmt.Sprintf("battle-%d", time.Now().UnixNano()),
		UserID: user.UserID,
		Send:   make(chan []byte, sendBufferSize),
		done:   make(chan struct{}),
	}

	s.hub.Register(c)
	s.battle.OnConnect(c)

	go s.readLoop(c, conn, s.battle.HandleMessage)
	go s.writeLoop(c, conn)
}

// HandlePresenceUpgrade handles WebSocket upgrade requests for /ws/presence.
func (s *Server) HandlePresenceUpgrade(w http.ResponseWriter, r *http.Request) {
	user := AuthenticateRequest(r.Context(), r, s.sessStore)
	if user == nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		InsecureSkipVerify: true,
	})
	if err != nil {
		s.logger.Error("presence ws accept failed", "error", err)
		return
	}

	c := &Conn{
		ID:     fmt.Sprintf("presence-%d", time.Now().UnixNano()),
		UserID: user.UserID,
		Send:   make(chan []byte, sendBufferSize),
		done:   make(chan struct{}),
	}

	s.hub.Register(c)
	s.presence.OnConnect(c)

	go s.readLoop(c, conn, s.presence.HandleMessage)
	go s.writeLoop(c, conn)
}

// readLoop reads messages from the WebSocket connection and dispatches to handler.
func (s *Server) readLoop(c *Conn, ws *websocket.Conn, handler func(*Conn, *Message)) {
	defer s.closeConn(c, ws)

	ws.SetReadLimit(maxMessageSize)

	for {
		_, data, err := ws.Read(context.Background())
		if err != nil {
			if websocket.CloseStatus(err) == websocket.StatusNormalClosure {
				return
			}
			s.logger.Debug("ws read error", "conn_id", c.ID, "error", err)
			return
		}

		msg, parseErr := Decode(data)
		if parseErr != nil {
			s.logger.Debug("ws parse error", "conn_id", c.ID, "error", parseErr)
			continue
		}

		handler(c, msg)
	}
}

// writeLoop pumps messages from the Send channel to the WebSocket connection.
func (s *Server) writeLoop(c *Conn, ws *websocket.Conn) {
	defer s.closeConn(c, ws)

	for {
		select {
		case msg, ok := <-c.Send:
			if !ok {
				return
			}
			ctx, cancel := context.WithTimeout(context.Background(), writeWait)
			err := ws.Write(ctx, websocket.MessageText, msg)
			cancel()
			if err != nil {
				s.logger.Debug("ws write error", "conn_id", c.ID, "error", err)
				return
			}
		case <-c.done:
			return
		}
	}
}

// closeConn unregisters the connection and closes the WebSocket.
func (s *Server) closeConn(c *Conn, ws *websocket.Conn) {
	userID, lastForUser := s.hub.Unregister(c.ID)
	close(c.done)
	_ = ws.Close(websocket.StatusNormalClosure, "")

	// Notify presence handler if this was the last connection for the user.
	if lastForUser {
		s.presence.OnDisconnect(c, userID, true)
	}
}

// Start begins the hub's run loop in a background goroutine.
func (s *Server) Start() {
	// Hub is currently synchronous (mutex-protected maps). No background run
	// loop is needed. This method exists as a lifecycle hook for future async
	// hub implementations (e.g., channel-based fan-out).
}
