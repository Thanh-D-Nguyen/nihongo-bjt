package realtime

import (
	"context"
	crand "crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"log/slog"
	mrand "math/rand/v2"
	"sort"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
)

const (
	defaultRoundTimeSec      = 45
	suspiciousAnswerMs       = 250
	invalidAnswerStrikeLimit = 3
	maxIdempotencyKeyLen     = 64
	maxClientMessageIDLen    = 80
	maxRoomKeyLen            = 64
	lobbyChatWindow          = 10 * time.Second
	lobbyChatWindowLimit     = 5
	defaultChallengeExpiry   = 60 * time.Second
	defaultPvpReconnectGrace = 120 * time.Second
	defaultPvpOpponentAbsent = 45 * time.Second
	defaultInitialCountdown  = 700 * time.Millisecond
	defaultInterCountdown    = 400 * time.Millisecond
)

// BattleTimings configures timers and delays for the battle engine (overridable in tests).
type BattleTimings struct {
	InitialCountdownStep time.Duration
	InterCountdownStep   time.Duration
	RoundTimeout         time.Duration // 0 uses room/config TimeLimitSec
	ChallengeExpiry      time.Duration
	PvpReconnectGrace    time.Duration
	PvpOpponentAbsentWin time.Duration
	BotDelayScale        float64 // 0 defaults to 1.0; negative disables bot delay
}

func defaultBattleTimings() BattleTimings {
	return BattleTimings{
		InitialCountdownStep: defaultInitialCountdown,
		InterCountdownStep:   defaultInterCountdown,
		ChallengeExpiry:      defaultChallengeExpiry,
		PvpReconnectGrace:    defaultPvpReconnectGrace,
		PvpOpponentAbsentWin: defaultPvpOpponentAbsent,
		BotDelayScale:        1.0,
	}
}

// BattleHandler manages battle namespace WebSocket messages and active match rooms.
type BattleHandler struct {
	hub                 *Hub
	store               BattleStore
	logger              *slog.Logger
	timings             BattleTimings
	rng                 func() float64
	mu                  sync.RWMutex
	lobby               map[string]LobbyUser         // connID -> LobbyUser
	rooms               map[string]*RoomState        // roomCode -> RoomState
	userActiveRoom      map[string]string            // userID -> roomCode
	connToRoom          map[string]string            // connID -> roomCode
	pvpRooms            map[string]*PvpRoomState     // roomCode -> PvpRoomState
	userToPvpRoom       map[string]string            // userID -> roomCode
	connToPvpRoom       map[string]string            // connID -> roomCode
	pendingChallenges   map[string]*PendingChallenge // challengeID -> PendingChallenge
	lobbyMessageWindows map[string][]time.Time       // userID -> recent chat timestamps
}

// NewBattleHandler creates a battle handler attached to the given hub.
func NewBattleHandler(hub *Hub, logger *slog.Logger) *BattleHandler {
	if logger == nil {
		logger = slog.Default()
	}
	return &BattleHandler{
		hub:                 hub,
		logger:              logger,
		timings:             defaultBattleTimings(),
		rng:                 unitRandom,
		lobby:               make(map[string]LobbyUser),
		rooms:               make(map[string]*RoomState),
		userActiveRoom:      make(map[string]string),
		connToRoom:          make(map[string]string),
		pvpRooms:            make(map[string]*PvpRoomState),
		userToPvpRoom:       make(map[string]string),
		connToPvpRoom:       make(map[string]string),
		pendingChallenges:   make(map[string]*PendingChallenge),
		lobbyMessageWindows: make(map[string][]time.Time),
	}
}

// SetStore attaches the BattleStore used for match persistence.
func (h *BattleHandler) SetStore(store BattleStore) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.store = store
}

// recordAnalytics writes a best-effort analytics event; failures are logged, never fatal.
func (h *BattleHandler) recordAnalytics(ctx context.Context, store BattleStore, userID, event string, payload map[string]any) {
	if err := store.CreateAnalyticsEvent(ctx, userID, event, payload); err != nil {
		h.logger.Warn("battle analytics write failed", "event", event, "user_id", userID, "error", err)
	}
}

func (h *BattleHandler) getStore() BattleStore {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.store
}

func (h *BattleHandler) getTimings() BattleTimings {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.timings
}

func (h *BattleHandler) getRandom() func() float64 {
	h.mu.RLock()
	defer h.mu.RUnlock()
	if h.rng != nil {
		return h.rng
	}
	return unitRandom
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
	case "battle:lobby_message":
		h.handleLobbyMessage(c, msg)
	case "battle:challenge_bot":
		h.handleChallengeBot(c, msg)
	case "battle:answer":
		h.handleBotAnswer(c, msg)
	case "battle:challenge_user":
		h.handleChallengeUser(c, msg)
	case "battle:accept_challenge":
		h.handleAcceptChallenge(c, msg)
	case "battle:decline_challenge":
		h.handleDeclineChallenge(c, msg)
	case "battle:pvp_answer":
		h.handlePvpAnswer(c, msg)
	case "battle:pvp_forfeit":
		h.handlePvpForfeit(c, msg)
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

func sendConnEvent(c *Conn, event string, payload any) {
	if c == nil {
		return
	}
	data, err := Encode(event, payload)
	if err != nil {
		return
	}
	select {
	case c.Send <- data:
	default:
	}
}

func (h *BattleHandler) sendBattleUserEvent(userID, event string, payload any) bool {
	data, err := Encode(event, payload)
	if err != nil {
		return false
	}
	conns := h.battleConnsForUser(userID)
	for _, c := range conns {
		select {
		case c.Send <- data:
		default:
		}
	}
	return len(conns) > 0
}

func (h *BattleHandler) battleConnsForUser(userID string) []*Conn {
	h.hub.mu.RLock()
	defer h.hub.mu.RUnlock()
	var out []*Conn
	for connID := range h.hub.users[userID] {
		if c := h.hub.conns[connID]; c != nil && c.Namespace == "battle" {
			out = append(out, c)
		}
	}
	return out
}

func (h *BattleHandler) sendToUserAnyNamespace(userID, event string, payload any) bool {
	data, err := Encode(event, payload)
	if err != nil {
		return false
	}
	h.hub.mu.RLock()
	defer h.hub.mu.RUnlock()
	sent := false
	for connID := range h.hub.users[userID] {
		if c := h.hub.conns[connID]; c != nil {
			select {
			case c.Send <- data:
				sent = true
			default:
			}
		}
	}
	return sent
}

func (h *BattleHandler) ensureLobbyMember(c *Conn) {
	h.mu.Lock()
	_, exists := h.lobby[c.ID]
	if !exists {
		h.lobby[c.ID] = LobbyUser{
			UserID:      c.UserID,
			DisplayName: c.DisplayName,
			JoinedAt:    time.Now().UTC().Format(time.RFC3339),
		}
	}
	h.mu.Unlock()
	if !exists {
		h.broadcastLobbyPresence()
	}
}

func (h *BattleHandler) handleLobbyJoin(c *Conn) {
	sendConnEvent(c, "battle:lobby_joined", map[string]string{
		"userId":      c.UserID,
		"displayName": c.DisplayName,
		"roomKey":     "global",
	})
	h.mu.Lock()
	h.lobby[c.ID] = LobbyUser{
		UserID:      c.UserID,
		DisplayName: c.DisplayName,
		JoinedAt:    time.Now().UTC().Format(time.RFC3339),
	}
	pvpCode := h.userToPvpRoom[c.UserID]
	var candidate *PvpRoomState
	if pvpCode != "" {
		candidate = h.pvpRooms[pvpCode]
	}
	h.mu.Unlock()

	// Room status is guarded by the room lock, not the handler lock.
	var reopenRoom *PvpRoomState
	if pvpCode != "" {
		active := false
		if candidate != nil {
			candidate.mu.Lock()
			active = candidate.Status != "finished" && candidate.Status != "abandoned"
			candidate.mu.Unlock()
		}
		h.mu.Lock()
		if active {
			h.connToPvpRoom[c.ID] = pvpCode
			reopenRoom = candidate
		} else {
			delete(h.userToPvpRoom, c.UserID)
		}
		h.mu.Unlock()
	}

	h.broadcastLobbyPresence()

	if reopenRoom != nil {
		reopenRoom.mu.Lock()
		clearTimer(&reopenRoom.AbandonTimer)
		clearTimer(&reopenRoom.OpponentAbsentTimer)
		reopenRoom.OpponentAbsentUserID = ""
		resync := h.buildPvpResyncLocked(reopenRoom, c.UserID)
		reopenRoom.mu.Unlock()
		sendConnEvent(c, "battle:pvp_resync", resync)
	}
}

// CheckAndRecordChatRate checks whether userID is within the lobby chat rate limit
// (5 messages per 10s window) and records the timestamp when allowed.
func (h *BattleHandler) CheckAndRecordChatRate(userID string) bool {
	now := time.Now()
	h.mu.Lock()
	defer h.mu.Unlock()
	recent := h.lobbyMessageWindows[userID]
	filtered := recent[:0]
	for _, ts := range recent {
		if now.Sub(ts) < lobbyChatWindow {
			filtered = append(filtered, ts)
		}
	}
	if len(filtered) >= lobbyChatWindowLimit {
		h.lobbyMessageWindows[userID] = filtered
		return false
	}
	filtered = append(filtered, now)
	h.lobbyMessageWindows[userID] = filtered
	return true
}

// BroadcastLobbyMessage broadcasts a chat message to all connections in the battle lobby.
func (h *BattleHandler) BroadcastLobbyMessage(msg LobbyMessage) {
	data, err := Encode("battle:lobby_message", msg)
	if err != nil {
		h.logger.Error("encode battle lobby message", "error", err)
		return
	}
	h.mu.RLock()
	conns := make([]*Conn, 0, len(h.lobby))
	for connID := range h.lobby {
		if conn := h.hub.GetConn(connID); conn != nil {
			conns = append(conns, conn)
		}
	}
	h.mu.RUnlock()
	for _, conn := range conns {
		select {
		case conn.Send <- data:
		default:
		}
	}
}

func (h *BattleHandler) handleLobbyMessage(c *Conn, msg *Message) {
	var body struct {
		ClientMessageID string `json:"clientMessageId"`
		Message         string `json:"message"`
		RoomKey         string `json:"roomKey"`
	}
	if len(msg.Data) == 0 || json.Unmarshal(msg.Data, &body) != nil {
		sendConnEvent(c, "battle:lobby_error", map[string]string{"code": "invalid_payload"})
		return
	}
	trimmed := strings.TrimSpace(body.Message)
	if trimmed == "" || utf8.RuneCountInString(trimmed) > 500 {
		sendConnEvent(c, "battle:lobby_error", map[string]string{"code": "invalid_payload"})
		return
	}
	roomKey := strings.TrimSpace(body.RoomKey)
	if roomKey == "" {
		roomKey = "global"
	}
	if utf8.RuneCountInString(roomKey) > maxRoomKeyLen || utf8.RuneCountInString(body.ClientMessageID) > maxClientMessageIDLen {
		sendConnEvent(c, "battle:lobby_error", map[string]string{"code": "invalid_payload"})
		return
	}
	h.ensureLobbyMember(c)
	if !h.CheckAndRecordChatRate(c.UserID) {
		if store := h.getStore(); store != nil {
			ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
			h.recordAnalytics(ctx, store, c.UserID, "battle_chat_rate_limited", map[string]any{
				"limit":    lobbyChatWindowLimit,
				"roomKey":  roomKey,
				"windowMs": lobbyChatWindow.Milliseconds(),
			})
			cancel()
		}
		sendConnEvent(c, "battle:lobby_error", map[string]string{"code": "rate_limited"})
		return
	}
	var saved *LobbyMessage
	if store := h.getStore(); store != nil {
		var dn *string
		if c.DisplayName != "" {
			dn = strPtr(c.DisplayName)
		}
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		s, err := store.CreateChatMessage(ctx, roomKey, c.UserID, dn, trimmed, "chat", map[string]any{
			"clientMessageId": body.ClientMessageID,
		})
		cancel()
		if err != nil {
			h.logger.Warn("persist ws battle lobby message", "error", err)
			sendConnEvent(c, "battle:lobby_error", map[string]string{"code": "message_rejected"})
			return
		}
		saved = s
	} else {
		var dn *string
		if c.DisplayName != "" {
			dn = strPtr(c.DisplayName)
		}
		saved = &LobbyMessage{
			ID:          randomHex(8),
			RoomKey:     roomKey,
			UserID:      c.UserID,
			DisplayName: dn,
			Message:     trimmed,
			Kind:        "chat",
			CreatedAt:   time.Now().UTC().Format(time.RFC3339),
		}
	}
	h.BroadcastLobbyMessage(*saved)
}

// OnDisconnect cleans up lobby presence and active bot/PvP room state when a connection closes.
func (h *BattleHandler) OnDisconnect(c *Conn) {
	h.mu.Lock()
	_, joined := h.lobby[c.ID]
	delete(h.lobby, c.ID)

	botRoomCode := h.connToRoom[c.ID]
	delete(h.connToRoom, c.ID)
	var botRoom *RoomState
	if botRoomCode != "" {
		botRoom = h.rooms[botRoomCode]
		if botRoom != nil {
			delete(h.rooms, botRoomCode)
			if h.userActiveRoom[botRoom.UserID] == botRoomCode {
				delete(h.userActiveRoom, botRoom.UserID)
			}
		}
	}

	pvpCode := h.connToPvpRoom[c.ID]
	delete(h.connToPvpRoom, c.ID)
	var pvpRoom *PvpRoomState
	remainingPvp := 0
	if pvpCode != "" {
		pvpRoom = h.pvpRooms[pvpCode]
		for _, code := range h.connToPvpRoom {
			if code == pvpCode {
				remainingPvp++
			}
		}
	}
	h.mu.Unlock()

	if joined {
		h.broadcastLobbyPresence()
	}

	if botRoom != nil {
		botRoom.mu.Lock()
		wasFinished := botRoom.Status == "finished"
		botRoom.Status = "finished"
		clearTimer(&botRoom.RoundTimer)
		sessionID := botRoom.SessionID
		userID := botRoom.UserID
		userScore := botRoom.UserScore
		oppScore := botRoom.OpponentScore
		botRoom.mu.Unlock()
		if !wasFinished && sessionID != "" {
			if store := h.getStore(); store != nil {
				ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				if err := store.MarkAbandoned(ctx, sessionID, "user_disconnect"); err != nil {
					h.logger.Error("battle store write failed", "op", "MarkAbandoned", "error", err)
				}
				h.recordAnalytics(ctx, store, userID, "battle_match_abandoned", map[string]any{
					"opponentScore": oppScore,
					"roomCode":      botRoomCode,
					"sessionId":     sessionID,
					"userScore":     userScore,
				})
				cancel()
			}
		}
	}

	if pvpRoom != nil {
		timings := h.getTimings()
		pvpRoom.mu.Lock()
		if pvpRoom.Status != "finished" && pvpRoom.Status != "abandoned" {
			switch remainingPvp {
			case 0:
				clearTimer(&pvpRoom.OpponentAbsentTimer)
				pvpRoom.OpponentAbsentUserID = ""
				clearTimer(&pvpRoom.AbandonTimer)
				code := pvpCode
				pvpRoom.AbandonTimer = time.AfterFunc(timings.PvpReconnectGrace, func() {
					h.abandonPvpRoomIfOrphaned(code)
				})
			case 1:
				clearTimer(&pvpRoom.OpponentAbsentTimer)
				departed := c.UserID
				pvpRoom.OpponentAbsentUserID = departed
				code := pvpCode
				pvpRoom.OpponentAbsentTimer = time.AfterFunc(timings.PvpOpponentAbsentWin, func() {
					h.tryAwardPvpWinForAbsentOpponent(code, departed)
				})
			}
		}
		pvpRoom.mu.Unlock()
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

// ── Bot Battle Flow ─────────────────────────────────────────────────────────

func (h *BattleHandler) handleChallengeBot(c *Conn, msg *Message) {
	var input struct {
		BotKey   string `json:"botKey"`
		ConfigID string `json:"configId"`
	}
	if len(msg.Data) == 0 || json.Unmarshal(msg.Data, &input) != nil {
		sendConnEvent(c, "battle:error", map[string]string{"code": "invalid_payload"})
		return
	}
	input.BotKey = strings.TrimSpace(input.BotKey)
	if input.BotKey == "" {
		sendConnEvent(c, "battle:error", map[string]string{"code": "invalid_payload"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	store := h.getStore()
	var playableBot *PlayableBattleBot
	if store != nil {
		b, err := store.GetPlayableBot(ctx, input.BotKey)
		if err != nil {
			h.logger.Error("load playable bot", "bot_key", input.BotKey, "error", err)
			sendConnEvent(c, "battle:error", map[string]string{"code": "start_failed"})
			return
		}
		playableBot = b
	} else if reg, ok := RegistryPlayableBot(input.BotKey); ok {
		playableBot = reg
	}
	if playableBot == nil {
		sendConnEvent(c, "battle:error", map[string]string{"code": "invalid_bot"})
		return
	}

	maxRounds := defaultMaxRounds
	configTimeSec := defaultRoundTimeSec
	gameType := "speed_duel"
	if cid := strings.TrimSpace(input.ConfigID); cid != "" && store != nil {
		if cfg, err := store.GetPublishedConfig(ctx, cid); err == nil && cfg != nil {
			if cfg.QuestionCount > 0 {
				maxRounds = cfg.QuestionCount
			}
			if cfg.TimePerQuestionSec > 0 {
				configTimeSec = cfg.TimePerQuestionSec
			}
			if cfg.GameType != "" {
				gameType = cfg.GameType
			}
		}
	}

	h.abandonPreviousBotRoomForUser(ctx, c.UserID, "replaced")
	if store != nil {
		if err := store.AbandonInProgressForUser(ctx, c.UserID, "replaced"); err != nil {
			h.logger.Error("battle store write failed", "op", "AbandonInProgressForUser", "error", err)
		}
	}

	fairnessSeed := randomHex(16)
	var created *CreatedBattle
	if store != nil {
		cb, err := store.CreateBotBattle(ctx, c.UserID, input.BotKey, fairnessSeed, maxRounds)
		if err != nil {
			if errors.Is(err, ErrBattleNoQuestions) {
				sendConnEvent(c, "battle:error", map[string]string{"code": "no_questions"})
				return
			}
			h.logger.Error("create bot battle", "error", err)
			sendConnEvent(c, "battle:error", map[string]string{"code": "start_failed"})
			return
		}
		created = cb
	} else {
		created = defaultInMemoryBattle(fairnessSeed, maxRounds)
	}

	room := &RoomState{
		RoomCode:         created.RoomCode,
		SessionID:        created.SessionID,
		UserID:           c.UserID,
		ConnID:           c.ID,
		BotKey:           input.BotKey,
		BotProfile:       *playableBot,
		ConfigID:         input.ConfigID,
		ConfigTimeSec:    configTimeSec,
		GameType:         gameType,
		Status:           "countdown",
		CurrentRound:     0,
		TotalRounds:      len(created.Questions),
		Questions:        created.Questions,
		RoundIDs:         created.RoundIDs,
		Idempotency:      make(map[string]bool),
		LastCommentRound: -2,
		MissedSkillTags:  make(map[string]int),
		CreatedAt:        time.Now(),
	}

	h.mu.Lock()
	h.rooms[created.RoomCode] = room
	h.userActiveRoom[c.UserID] = created.RoomCode
	h.connToRoom[c.ID] = created.RoomCode
	h.mu.Unlock()

	if store != nil {
		h.recordAnalytics(ctx, store, c.UserID, "battle_match_started", map[string]any{
			"botKey":    input.BotKey,
			"mode":      "bot",
			"roomCode":  created.RoomCode,
			"sessionId": created.SessionID,
		})
	}

	sendConnEvent(c, "battle:match_found", map[string]any{
		"bot":       playableBot,
		"gameType":  room.GameType,
		"maxRounds": room.TotalRounds,
		"roomCode":  room.RoomCode,
		"sessionId": room.SessionID,
	})
	h.emitBotState(c, room, "matched")

	go h.runBotCountdownThenRound(c, room.RoomCode, true)
}

func (h *BattleHandler) abandonPreviousBotRoomForUser(ctx context.Context, userID, reason string) {
	h.mu.Lock()
	prevCode := h.userActiveRoom[userID]
	var prevRoom *RoomState
	if prevCode != "" {
		prevRoom = h.rooms[prevCode]
		delete(h.rooms, prevCode)
		delete(h.userActiveRoom, userID)
		for cid, rc := range h.connToRoom {
			if rc == prevCode {
				delete(h.connToRoom, cid)
			}
		}
	}
	h.mu.Unlock()

	if prevRoom != nil {
		prevRoom.mu.Lock()
		wasFinished := prevRoom.Status == "finished"
		prevRoom.Status = "finished"
		clearTimer(&prevRoom.RoundTimer)
		sessID := prevRoom.SessionID
		uScore := prevRoom.UserScore
		oScore := prevRoom.OpponentScore
		prevRoom.mu.Unlock()
		if !wasFinished && sessID != "" {
			if store := h.getStore(); store != nil {
				if err := store.MarkAbandoned(ctx, sessID, reason); err != nil {
					h.logger.Error("battle store write failed", "op", "MarkAbandoned", "error", err)
				}
				h.recordAnalytics(ctx, store, userID, "battle_match_abandoned", map[string]any{
					"opponentScore": oScore,
					"roomCode":      prevCode,
					"sessionId":     sessID,
					"userScore":     uScore,
				})
			}
		}
	}
}

func (h *BattleHandler) emitBotState(c *Conn, room *RoomState, state string) {
	sendConnEvent(c, "battle:bot_state", BotStatePayload{
		BotKey:     room.BotKey,
		Persona:    room.BotProfile.Persona,
		Rive:       room.BotProfile.Rive,
		State:      state,
		StyleToken: room.BotProfile.StyleToken,
	})
}

func (h *BattleHandler) getBotRoom(roomCode string) *RoomState {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.rooms[roomCode]
}

func (h *BattleHandler) runBotCountdownThenRound(c *Conn, roomCode string, initial bool) {
	timings := h.getTimings()
	step := timings.InterCountdownStep
	if initial {
		step = timings.InitialCountdownStep
	}
	for _, value := range []int{3, 2, 1} {
		room := h.getBotRoom(roomCode)
		if room == nil {
			return
		}
		room.mu.Lock()
		if room.Status == "finished" {
			room.mu.Unlock()
			return
		}
		room.mu.Unlock()
		h.emitBotState(c, room, "countdown")
		sendConnEvent(c, "battle:countdown", map[string]int{"value": value})
		if step > 0 {
			time.Sleep(step)
		}
	}
	h.beginBotRound(c, roomCode)
}

func (h *BattleHandler) beginBotRound(c *Conn, roomCode string) {
	room := h.getBotRoom(roomCode)
	if room == nil {
		return
	}
	timings := h.getTimings()

	room.mu.Lock()
	if room.Status == "finished" || room.CurrentRound >= room.TotalRounds {
		room.mu.Unlock()
		return
	}
	room.Status = "question"
	room.RoundStart = time.Now()
	roundIdx := room.CurrentRound
	q := room.Questions[roundIdx]
	clearTimer(&room.RoundTimer)
	timeoutDur := time.Duration(room.ConfigTimeSec) * time.Second
	if timings.RoundTimeout > 0 {
		timeoutDur = timings.RoundTimeout
	}
	room.RoundTimer = time.AfterFunc(timeoutDur, func() {
		h.settleBotRoundTimeout(c, roomCode, roundIdx)
	})
	payload := QuestionEventPayload{
		GameType:        room.GameType,
		InteractionType: interactionTypeForGame(room.GameType),
		RoundIndex:      roundIdx,
		RoomCode:        roomCode,
		TimeLimitSec:    room.ConfigTimeSec,
		TotalRounds:     room.TotalRounds,
		Question: ClientQuestionBody{
			QuestionID:  q.QuestionID,
			Prompt:      q.Prompt,
			SkillTag:    q.SkillTag,
			AudioScript: q.AudioScript,
			AudioUrl:    q.AudioUrl,
			Options:     q.SafeOptions(),
		},
	}
	room.mu.Unlock()

	h.emitBotState(c, room, "thinking")
	sendConnEvent(c, "battle:question", payload)
}

func interactionTypeForGame(gameType string) string {
	switch gameType {
	case "kanji_vocab_duel":
		return "matching"
	case "listening_challenge":
		return "audio_only"
	case "boss_rush":
		return "boss_hp"
	case "mock_exam_sprint":
		return "passage"
	default:
		return "multiple_choice"
	}
}

func (h *BattleHandler) handleBotAnswer(c *Conn, msg *Message) {
	var input struct {
		IdempotencyKey string `json:"idempotencyKey"`
		OptionKey      string `json:"optionKey"`
		RoomCode       string `json:"roomCode"`
		RoundIndex     *int   `json:"roundIndex"`
		UserID         string `json:"userId"`
	}
	if len(msg.Data) == 0 || json.Unmarshal(msg.Data, &input) != nil ||
		strings.TrimSpace(input.IdempotencyKey) == "" ||
		len(input.IdempotencyKey) > maxIdempotencyKeyLen ||
		strings.TrimSpace(input.OptionKey) == "" ||
		strings.TrimSpace(input.RoomCode) == "" ||
		input.RoundIndex == nil || *input.RoundIndex < 0 {
		sendConnEvent(c, "battle:error", map[string]string{"code": "invalid_payload"})
		return
	}
	h.settleBotRoundAnswer(c, input.RoomCode, *input.RoundIndex, input.OptionKey, input.IdempotencyKey, input.UserID)
}

func (h *BattleHandler) settleBotRoundTimeout(c *Conn, roomCode string, expectedRound int) {
	room := h.getBotRoom(roomCode)
	if room == nil {
		return
	}
	room.mu.Lock()
	if room.Status != "question" || room.CurrentRound != expectedRound {
		room.mu.Unlock()
		return
	}
	room.Status = "resolving"
	clearTimer(&room.RoundTimer)
	room.mu.Unlock()

	h.finishBotRound(c, room, nil, room.ConfigTimeSec*1000)
}

func (h *BattleHandler) settleBotRoundAnswer(c *Conn, roomCode string, roundIndex int, optionKey, idempotencyKey, payloadUserID string) {
	room := h.getBotRoom(roomCode)
	if room == nil {
		return
	}
	room.mu.Lock()
	if room.Status != "question" {
		room.mu.Unlock()
		return
	}
	// Never trust payloadUserID over c.UserID; also reject if the connection is not the room owner
	// or if a client explicitly sent a mismatched userId.
	// A non-owner must never add strikes to the owner's room: anyone holding the room code
	// could otherwise abandon the owner's match. Reject and attribute the attempt to the sender.
	if c.UserID != room.UserID {
		sessionID, roomCode := room.SessionID, room.RoomCode
		room.mu.Unlock()
		sendConnEvent(c, "battle:error", map[string]string{"code": "answer_rejected"})
		if store := h.getStore(); store != nil {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			h.recordAnalytics(ctx, store, c.UserID, "battle_answer_rejected", map[string]any{
				"reason":    "not_room_owner",
				"roomCode":  roomCode,
				"sessionId": sessionID,
			})
			cancel()
		}
		return
	}
	currentRound := room.CurrentRound
	if payloadUserID != "" && payloadUserID != room.UserID {
		strikes := h.recordInvalidBotAttemptLocked(room)
		room.mu.Unlock()
		h.handleInvalidBotStrike(c, room, "user_mismatch", currentRound, strikes)
		return
	}
	if roundIndex != room.CurrentRound {
		strikes := h.recordInvalidBotAttemptLocked(room)
		room.mu.Unlock()
		h.handleInvalidBotStrike(c, room, "round_mismatch", currentRound, strikes)
		return
	}
	q := room.Questions[room.CurrentRound]
	if !q.HasOption(optionKey) {
		strikes := h.recordInvalidBotAttemptLocked(room)
		room.mu.Unlock()
		h.handleInvalidBotStrike(c, room, "option_mismatch", currentRound, strikes)
		return
	}
	idk := string(rune(roundIndex)) + "-" + idempotencyKey
	if room.Idempotency[idk] {
		room.mu.Unlock()
		return
	}
	room.Idempotency[idk] = true
	room.Status = "resolving"
	clearTimer(&room.RoundTimer)
	elapsedMs := int(time.Since(room.RoundStart).Milliseconds())
	maxMs := room.ConfigTimeSec * 1000
	if elapsedMs < 0 {
		elapsedMs = 0
	} else if elapsedMs > maxMs {
		elapsedMs = maxMs
	}
	room.mu.Unlock()

	go h.finishBotRound(c, room, &optionKey, elapsedMs)
}

func (h *BattleHandler) recordInvalidBotAttemptLocked(room *RoomState) int {
	room.InvalidAnswerStrike++
	return room.InvalidAnswerStrike
}

func (h *BattleHandler) handleInvalidBotStrike(c *Conn, room *RoomState, reason string, currentRound, strikes int) {
	store := h.getStore()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if store != nil {
		h.recordAnalytics(ctx, store, room.UserID, "battle_answer_rejected", map[string]any{
			"reason":     reason,
			"roomCode":   room.RoomCode,
			"roundIndex": currentRound,
			"sessionId":  room.SessionID,
			"strikes":    strikes,
		})
	}
	if strikes >= invalidAnswerStrikeLimit {
		if store != nil {
			h.recordAnalytics(ctx, store, room.UserID, "battle_abuse_detected", map[string]any{
				"reason":      reason,
				"roomCode":    room.RoomCode,
				"sessionId":   room.SessionID,
				"strikeLimit": invalidAnswerStrikeLimit,
				"strikes":     strikes,
			})
		}
		h.abandonPreviousBotRoomForUser(ctx, room.UserID, "anti_abuse_threshold")
		sendConnEvent(c, "battle:error", map[string]string{"code": "abuse_detected"})
		return
	}
	sendConnEvent(c, "battle:error", map[string]string{"code": "answer_rejected"})
}

func (h *BattleHandler) finishBotRound(c *Conn, room *RoomState, userOptionKey *string, userResponseMs int) {
	room.mu.Lock()
	if room.Status != "resolving" {
		room.mu.Unlock()
		return
	}
	roundIdx := room.CurrentRound
	q := room.Questions[roundIdx]
	correct := q.CorrectOptionKey()
	if correct == "" {
		room.Status = "question"
		room.mu.Unlock()
		return
	}
	optionKeys := make([]string, len(q.Options))
	for i, o := range q.Options {
		optionKeys[i] = o.OptionKey
	}
	minDelay := room.BotProfile.MinDelayMs
	maxDelay := room.BotProfile.MaxDelayMs
	accProb := float64(room.BotProfile.AccuracyPct) / 100.0
	roomCode := room.RoomCode
	sessionID := room.SessionID
	userID := room.UserID
	roundID := ""
	if roundIdx < len(room.RoundIDs) {
		roundID = room.RoundIDs[roundIdx]
	}
	room.mu.Unlock()

	store := h.getStore()
	if userOptionKey != nil && userResponseMs <= suspiciousAnswerMs && store != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		h.recordAnalytics(ctx, store, userID, "battle_answer_suspicious_speed", map[string]any{
			"responseMs":  userResponseMs,
			"roomCode":    roomCode,
			"roundIndex":  roundIdx,
			"sessionId":   sessionID,
			"thresholdMs": suspiciousAnswerMs,
		})
		cancel()
	}

	rng := h.getRandom()
	timings := h.getTimings()
	botDelayMs := RandomBetween(rng, minDelay, maxDelay)
	if timings.BotDelayScale > 0 {
		sleepDur := time.Duration(float64(botDelayMs)*timings.BotDelayScale) * time.Millisecond
		if sleepDur > 0 {
			time.Sleep(sleepDur)
		}
	}

	if h.getBotRoom(roomCode) == nil {
		return
	}

	botOption := DecideBotOption(correct, optionKeys, accProb, rng)
	botCorrect := botOption == correct
	userCorrect := userOptionKey != nil && *userOptionKey == correct

	h.emitBotState(c, room, map[bool]string{true: "correct", false: "wrong"}[botCorrect])

	room.mu.Lock()
	if room.Status == "finished" {
		room.mu.Unlock()
		return
	}
	if userCorrect {
		room.UserScore++
		room.UserCorrectStreak++
	} else {
		room.UserCorrectStreak = 0
		if q.SkillTag != "" {
			room.MissedSkillTags[q.SkillTag]++
		}
	}
	if botCorrect {
		room.OpponentScore++
		room.BotCorrectStreak++
	} else {
		room.BotCorrectStreak = 0
	}
	nextUser := room.UserScore
	nextOp := room.OpponentScore
	userStreak := room.UserCorrectStreak
	botStreak := room.BotCorrectStreak
	lastComment := room.LastCommentRound
	totalRounds := room.TotalRounds
	botKey := room.BotKey
	lastRound := roundIdx == totalRounds-1
	room.CurrentRound = roundIdx + 1
	if lastRound {
		room.Status = "finished"
		clearTimer(&room.RoundTimer)
	} else {
		room.Status = "countdown"
	}
	room.mu.Unlock()

	if store != nil && sessionID != "" && roundID != "" {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		if err := store.UpdateBotRoundWithScores(ctx, BotRoundUpdate{
			SessionID:          sessionID,
			RoundID:            roundID,
			UserID:             userID,
			NewCurrentRoundIdx: roundIdx + 1,
			NextUserScore:      nextUser,
			NextOpponentScore:  nextOp,
			UserOptionKey:      userOptionKey,
			UserCorrect:        userCorrect,
			UserResponseMs:     userResponseMs,
			BotOptionKey:       botOption,
			BotCorrect:         botCorrect,
			BotResponseMs:      botDelayMs,
			DecidedAt:          time.Now().UTC(),
		}); err != nil {
			h.logger.Error("battle store write failed", "op", "UpdateBotRoundWithScores", "error", err)
		}
		cancel()
	}

	botCorrectCopy := botCorrect
	sendConnEvent(c, "battle:answer_result", AnswerResultPayload{
		BotCorrect:       &botCorrectCopy,
		CorrectOptionKey: correct,
		RoundIndex:       roundIdx,
		UserCorrect:      userCorrect,
	})
	sendConnEvent(c, "battle:score_update", ScoreUpdatePayload{
		UserScore:     nextUser,
		OpponentScore: nextOp,
	})

	baseTrigger := triggerBotCorrect
	switch {
	case userCorrect && botCorrect:
		baseTrigger = triggerBothCorrect
	case !userCorrect && !botCorrect:
		baseTrigger = triggerBothWrong
	case userCorrect:
		baseTrigger = triggerUserCorrect
	}
	comment := generateBattleCommentary(commentaryContext{
		botKey:            botKey,
		botScore:          nextOp,
		currentRound:      roundIdx,
		totalRounds:       totalRounds,
		trigger:           baseTrigger,
		userCorrectStreak: userStreak,
		botCorrectStreak:  botStreak,
		userScore:         nextUser,
	}, lastComment, rng)
	if comment != nil {
		room.mu.Lock()
		room.LastCommentRound = roundIdx
		room.mu.Unlock()
		sendConnEvent(c, "battle:bot_comment", comment)
	}

	if lastRound {
		outcome := "draw"
		botEndState := "draw"
		if nextUser > nextOp {
			outcome = "win"
			botEndState = "lose"
		} else if nextUser < nextOp {
			outcome = "lose"
			botEndState = "win"
		}
		h.emitBotState(c, room, botEndState)

		focusTags := topMissedSkillTags(room, 3)
		if store != nil && sessionID != "" {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			if err := store.MarkCompleted(ctx, sessionID, nextUser, nextOp); err != nil {
				h.logger.Error("battle store write failed", "op", "MarkCompleted", "error", err)
			}
			h.recordAnalytics(ctx, store, userID, "battle_match_completed", map[string]any{
				"focusSkillTags": focusTags,
				"opponentScore":  nextOp,
				"outcome":        outcome,
				"roomCode":       roomCode,
				"sessionId":      sessionID,
				"userScore":      nextUser,
			})
			cancel()
		}

		var remediation *RemediationPayload
		if outcome == "lose" {
			remediation = &RemediationPayload{
				CtaPath:        "flashcards",
				FocusSkillTags: focusTags,
				Kind:           "review_queue",
				SummaryI18nKey: "battle.remediation.loss_focus",
			}
		}
		sendConnEvent(c, "battle:finished", FinishedEventPayload{
			Outcome:     outcome,
			Remediation: remediation,
			SessionID:   sessionID,
		})

		h.mu.Lock()
		delete(h.rooms, roomCode)
		if h.userActiveRoom[userID] == roomCode {
			delete(h.userActiveRoom, userID)
		}
		delete(h.connToRoom, c.ID)
		h.mu.Unlock()
		return
	}

	h.runBotCountdownThenRound(c, roomCode, false)
}

func topMissedSkillTags(room *RoomState, limit int) []string {
	room.mu.Lock()
	defer room.mu.Unlock()
	type kv struct {
		tag   string
		count int
	}
	list := make([]kv, 0, len(room.MissedSkillTags))
	for tag, count := range room.MissedSkillTags {
		list = append(list, kv{tag: tag, count: count})
	}
	sort.Slice(list, func(i, j int) bool {
		if list[i].count != list[j].count {
			return list[i].count > list[j].count
		}
		return list[i].tag < list[j].tag
	})
	if len(list) > limit {
		list = list[:limit]
	}
	out := make([]string, len(list))
	for i, item := range list {
		out[i] = item.tag
	}
	return out
}

// ── PvP Challenge & Match Flow ──────────────────────────────────────────────

func (h *BattleHandler) handleChallengeUser(c *Conn, msg *Message) {
	var input struct {
		TargetUserID string `json:"targetUserId"`
	}
	if len(msg.Data) == 0 || json.Unmarshal(msg.Data, &input) != nil {
		sendConnEvent(c, "battle:lobby_error", map[string]string{"code": "invalid_payload"})
		return
	}
	targetUserID := strings.TrimSpace(input.TargetUserID)
	if _, err := uuid.Parse(targetUserID); err != nil {
		sendConnEvent(c, "battle:lobby_error", map[string]string{"code": "invalid_payload"})
		return
	}
	if targetUserID == c.UserID {
		sendConnEvent(c, "battle:lobby_error", map[string]string{"code": "cannot_challenge_self"})
		return
	}

	h.ensureLobbyMember(c)
	challengeID := randomHex(8)
	var fromDN *string
	if strings.TrimSpace(c.DisplayName) != "" {
		fromDN = strPtr(c.DisplayName)
	}
	timings := h.getTimings()
	ch := &PendingChallenge{
		ChallengeID:     challengeID,
		FromUserID:      c.UserID,
		TargetUserID:    targetUserID,
		FromDisplayName: fromDN,
		CreatedAt:       time.Now().UTC().Format(time.RFC3339),
		ExpiresAt:       time.Now().Add(timings.ChallengeExpiry),
	}
	fromUID := c.UserID
	ch.ExpireTimer = time.AfterFunc(timings.ChallengeExpiry, func() {
		h.mu.Lock()
		_, stillPending := h.pendingChallenges[challengeID]
		if stillPending {
			delete(h.pendingChallenges, challengeID)
		}
		h.mu.Unlock()
		if stillPending {
			h.sendBattleUserEvent(fromUID, "battle:challenge_expired", map[string]string{
				"challengeId": challengeID,
			})
		}
	})

	h.mu.Lock()
	h.pendingChallenges[challengeID] = ch
	h.mu.Unlock()

	deliveredBattle := h.sendBattleUserEvent(targetUserID, "battle:user_challenge_received", ch)
	deliveredPresence := false
	if !deliveredBattle {
		deliveredPresence = h.sendToUserAnyNamespace(targetUserID, "battle:user_challenge_received", ch)
	}

	if store := h.getStore(); store != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		h.recordAnalytics(ctx, store, c.UserID, "battle_user_challenge_created", map[string]any{
			"challengeId":          challengeID,
			"delivered":            deliveredBattle || deliveredPresence,
			"deliveredViaBattle":   deliveredBattle,
			"deliveredViaPresence": deliveredPresence,
			"targetUserId":         targetUserID,
		})
		cancel()
	}

	sendConnEvent(c, "battle:user_challenge_sent", ch)
}

func (h *BattleHandler) handleDeclineChallenge(c *Conn, msg *Message) {
	var input struct {
		ChallengeID string `json:"challengeId"`
		FromUserID  string `json:"fromUserId"`
	}
	if len(msg.Data) == 0 || json.Unmarshal(msg.Data, &input) != nil || strings.TrimSpace(input.ChallengeID) == "" {
		sendConnEvent(c, "battle:lobby_error", map[string]string{"code": "invalid_payload"})
		return
	}
	h.mu.Lock()
	ch := h.pendingChallenges[input.ChallengeID]
	if ch == nil || ch.TargetUserID != c.UserID {
		h.mu.Unlock()
		return
	}
	delete(h.pendingChallenges, input.ChallengeID)
	clearTimer(&ch.ExpireTimer)
	h.mu.Unlock()

	if store := h.getStore(); store != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		h.recordAnalytics(ctx, store, c.UserID, "battle_user_challenge_declined", map[string]any{
			"challengeId": ch.ChallengeID,
		})
		cancel()
	}
	payload := map[string]string{
		"challengeId":  ch.ChallengeID,
		"fromUserId":   ch.FromUserID,
		"targetUserId": c.UserID,
	}
	h.sendBattleUserEvent(ch.FromUserID, "battle:challenge_declined", payload)
	sendConnEvent(c, "battle:challenge_declined", payload)
}

func (h *BattleHandler) handleAcceptChallenge(c *Conn, msg *Message) {
	var input struct {
		ChallengeID string `json:"challengeId"`
		FromUserID  string `json:"fromUserId"`
	}
	if len(msg.Data) == 0 || json.Unmarshal(msg.Data, &input) != nil ||
		strings.TrimSpace(input.ChallengeID) == "" ||
		strings.TrimSpace(input.FromUserID) == "" {
		sendConnEvent(c, "battle:lobby_error", map[string]string{"code": "invalid_payload"})
		return
	}

	h.mu.Lock()
	ch := h.pendingChallenges[input.ChallengeID]
	if ch == nil {
		h.mu.Unlock()
		sendConnEvent(c, "battle:lobby_error", map[string]string{"code": "challenge_expired"})
		return
	}
	if ch.TargetUserID != c.UserID || ch.FromUserID != input.FromUserID {
		h.mu.Unlock()
		sendConnEvent(c, "battle:lobby_error", map[string]string{"code": "challenge_mismatch"})
		return
	}
	delete(h.pendingChallenges, input.ChallengeID)
	clearTimer(&ch.ExpireTimer)
	prevA := h.userToPvpRoom[c.UserID]
	prevB := h.userToPvpRoom[ch.FromUserID]
	h.mu.Unlock()

	h.ensureLobbyMember(c)
	if prevA != "" {
		h.abandonPvpRoom(prevA, "replaced", "")
	}
	if prevB != "" && prevB != prevA {
		h.abandonPvpRoom(prevB, "replaced", "")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	store := h.getStore()
	fairnessSeed := randomHex(16)
	var created *CreatedBattle
	if store != nil {
		cb, err := store.CreatePvpBattle(ctx, c.UserID, ch.FromUserID, fairnessSeed, defaultMaxRounds)
		if err != nil {
			if errors.Is(err, ErrBattleNoQuestions) {
				sendConnEvent(c, "battle:error", map[string]string{"code": "no_questions"})
				return
			}
			h.logger.Error("create pvp battle", "error", err)
			sendConnEvent(c, "battle:error", map[string]string{"code": "accept_failed"})
			return
		}
		created = cb
	} else {
		created = defaultInMemoryBattle(fairnessSeed, defaultMaxRounds)
	}

	acceptorName := c.DisplayName
	if acceptorName == "" {
		acceptorName = "Player"
	}
	challengerName := "Opponent"
	if ch.FromDisplayName != nil && *ch.FromDisplayName != "" {
		challengerName = *ch.FromDisplayName
	} else if dn := h.lobbyDisplayNameForUser(ch.FromUserID); dn != "" {
		challengerName = dn
	}

	pvpRoom := &PvpRoomState{
		RoomCode:            created.RoomCode,
		SessionID:           created.SessionID,
		GameType:            "speed_duel",
		UserID:              c.UserID,
		UserDisplayName:     acceptorName,
		OpponentUserID:      ch.FromUserID,
		OpponentDisplayName: challengerName,
		Status:              "countdown",
		CurrentRound:        0,
		TotalRounds:         len(created.Questions),
		Questions:           created.Questions,
		RoundIDs:            created.RoundIDs,
		Idempotency:         make(map[string]bool),
		RoundAnswers:        make(map[string]PvpRoundAnswer),
		CreatedAt:           time.Now(),
	}

	h.mu.Lock()
	h.pvpRooms[created.RoomCode] = pvpRoom
	h.userToPvpRoom[c.UserID] = created.RoomCode
	h.userToPvpRoom[ch.FromUserID] = created.RoomCode
	h.connToPvpRoom[c.ID] = created.RoomCode
	for _, fc := range h.battleConnsForUser(ch.FromUserID) {
		h.connToPvpRoom[fc.ID] = created.RoomCode
	}
	h.mu.Unlock()

	if store != nil {
		h.recordAnalytics(ctx, store, c.UserID, "battle_pvp_match_started", map[string]any{
			"roomCode":  created.RoomCode,
			"sessionId": created.SessionID,
		})
	}

	accCopy := acceptorName
	chalCopy := challengerName
	h.sendBattleUserEvent(c.UserID, "battle:pvp_match_found", PvpMatchFoundPayload{
		MaxRounds:           pvpRoom.TotalRounds,
		Mode:                "pvp",
		OpponentDisplayName: &chalCopy,
		RoomCode:            created.RoomCode,
		SessionID:           created.SessionID,
		UserDisplayName:     &accCopy,
	})
	h.sendBattleUserEvent(ch.FromUserID, "battle:pvp_match_found", PvpMatchFoundPayload{
		MaxRounds:           pvpRoom.TotalRounds,
		Mode:                "pvp",
		OpponentDisplayName: &accCopy,
		RoomCode:            created.RoomCode,
		SessionID:           created.SessionID,
		UserDisplayName:     &chalCopy,
	})

	go h.runPvpCountdownThenRound(created.RoomCode, true)
}

func (h *BattleHandler) lobbyDisplayNameForUser(userID string) string {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for _, u := range h.lobby {
		if u.UserID == userID && u.DisplayName != "" {
			return u.DisplayName
		}
	}
	return ""
}

func (h *BattleHandler) getPvpRoom(roomCode string) *PvpRoomState {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.pvpRooms[roomCode]
}

func (h *BattleHandler) emitToPvpRoom(room *PvpRoomState, event string, payload any) {
	h.sendBattleUserEvent(room.UserID, event, payload)
	h.sendBattleUserEvent(room.OpponentUserID, event, payload)
}

func (h *BattleHandler) runPvpCountdownThenRound(roomCode string, initial bool) {
	timings := h.getTimings()
	step := timings.InterCountdownStep
	if initial {
		step = timings.InitialCountdownStep
	}
	for _, value := range []int{3, 2, 1} {
		room := h.getPvpRoom(roomCode)
		if room == nil {
			return
		}
		room.mu.Lock()
		if room.Status == "finished" || room.Status == "abandoned" {
			room.mu.Unlock()
			return
		}
		room.mu.Unlock()
		h.emitToPvpRoom(room, "battle:countdown", map[string]int{"value": value})
		if step > 0 {
			time.Sleep(step)
		}
	}
	h.beginPvpRound(roomCode)
}

func (h *BattleHandler) beginPvpRound(roomCode string) {
	room := h.getPvpRoom(roomCode)
	if room == nil {
		return
	}
	timings := h.getTimings()

	room.mu.Lock()
	if room.Status == "finished" || room.Status == "abandoned" || room.CurrentRound >= room.TotalRounds {
		room.mu.Unlock()
		return
	}
	room.Status = "question"
	room.RoundStart = time.Now()
	room.RoundAnswers = make(map[string]PvpRoundAnswer)
	roundIdx := room.CurrentRound
	q := room.Questions[roundIdx]
	clearTimer(&room.RoundTimer)
	timeoutDur := time.Duration(defaultRoundTimeSec) * time.Second
	if timings.RoundTimeout > 0 {
		timeoutDur = timings.RoundTimeout
	}
	room.RoundTimer = time.AfterFunc(timeoutDur, func() {
		h.settlePvpRoundTimeout(roomCode, roundIdx)
	})
	payload := QuestionEventPayload{
		GameType:        room.GameType,
		InteractionType: interactionTypeForGame(room.GameType),
		RoundIndex:      roundIdx,
		RoomCode:        roomCode,
		TimeLimitSec:    defaultRoundTimeSec,
		TotalRounds:     room.TotalRounds,
		Question: ClientQuestionBody{
			QuestionID:  q.QuestionID,
			Prompt:      q.Prompt,
			SkillTag:    q.SkillTag,
			AudioScript: q.AudioScript,
			AudioUrl:    q.AudioUrl,
			Options:     q.SafeOptions(),
		},
	}
	room.mu.Unlock()

	h.emitToPvpRoom(room, "battle:question", payload)
}

func (h *BattleHandler) handlePvpAnswer(c *Conn, msg *Message) {
	var input struct {
		IdempotencyKey string `json:"idempotencyKey"`
		OptionKey      string `json:"optionKey"`
		RoomCode       string `json:"roomCode"`
		RoundIndex     *int   `json:"roundIndex"`
		UserID         string `json:"userId"`
	}
	if len(msg.Data) == 0 || json.Unmarshal(msg.Data, &input) != nil ||
		strings.TrimSpace(input.IdempotencyKey) == "" ||
		len(input.IdempotencyKey) > maxIdempotencyKeyLen ||
		strings.TrimSpace(input.OptionKey) == "" ||
		strings.TrimSpace(input.RoomCode) == "" ||
		input.RoundIndex == nil || *input.RoundIndex < 0 {
		sendConnEvent(c, "battle:error", map[string]string{"code": "invalid_payload"})
		return
	}

	room := h.getPvpRoom(input.RoomCode)
	if room == nil {
		sendConnEvent(c, "battle:error", map[string]string{"code": "room_not_found"})
		return
	}

	room.mu.Lock()
	if room.Status != "question" || *input.RoundIndex != room.CurrentRound {
		room.mu.Unlock()
		return
	}
	if (c.UserID != room.UserID && c.UserID != room.OpponentUserID) ||
		(input.UserID != "" && input.UserID != c.UserID) {
		room.mu.Unlock()
		sendConnEvent(c, "battle:error", map[string]string{"code": "user_mismatch"})
		return
	}
	idk := string(rune(*input.RoundIndex)) + "-" + c.UserID + "-" + input.IdempotencyKey
	if room.Idempotency[idk] {
		room.mu.Unlock()
		return
	}
	if _, already := room.RoundAnswers[c.UserID]; already {
		room.mu.Unlock()
		return
	}
	q := room.Questions[room.CurrentRound]
	if !q.HasOption(input.OptionKey) {
		room.mu.Unlock()
		sendConnEvent(c, "battle:error", map[string]string{"code": "option_mismatch"})
		return
	}
	// Recorded only for an accepted answer, so the map is bounded by 2 entries per round.
	room.Idempotency[idk] = true
	elapsedMs := int(time.Since(room.RoundStart).Milliseconds())
	maxMs := defaultRoundTimeSec * 1000
	if elapsedMs < 0 {
		elapsedMs = 0
	} else if elapsedMs > maxMs {
		elapsedMs = maxMs
	}
	room.RoundAnswers[c.UserID] = PvpRoundAnswer{
		OptionKey:  input.OptionKey,
		ResponseMs: elapsedMs,
	}
	_, hasUser := room.RoundAnswers[room.UserID]
	_, hasOpp := room.RoundAnswers[room.OpponentUserID]
	bothAnswered := hasUser && hasOpp
	if bothAnswered {
		room.Status = "resolving"
		clearTimer(&room.RoundTimer)
	}
	roundIdx := room.CurrentRound
	room.mu.Unlock()

	h.emitToPvpRoom(room, "battle:pvp_opponent_answered", map[string]any{
		"roundIndex": roundIdx,
		"userId":     c.UserID,
	})

	if bothAnswered {
		go h.finishPvpRound(room)
	}
}

func (h *BattleHandler) settlePvpRoundTimeout(roomCode string, expectedRound int) {
	room := h.getPvpRoom(roomCode)
	if room == nil {
		return
	}
	room.mu.Lock()
	if room.Status != "question" || room.CurrentRound != expectedRound {
		room.mu.Unlock()
		return
	}
	room.Status = "resolving"
	clearTimer(&room.RoundTimer)
	room.mu.Unlock()

	h.finishPvpRound(room)
}

func (h *BattleHandler) finishPvpRound(room *PvpRoomState) {
	room.mu.Lock()
	if room.Status != "resolving" {
		room.mu.Unlock()
		return
	}
	roundIdx := room.CurrentRound
	q := room.Questions[roundIdx]
	correct := q.CorrectOptionKey()
	if correct == "" {
		room.Status = "question"
		room.mu.Unlock()
		return
	}
	maxMs := defaultRoundTimeSec * 1000
	uAns, hasU := room.RoundAnswers[room.UserID]
	oAns, hasO := room.RoundAnswers[room.OpponentUserID]

	var uOpt *string
	uMs := maxMs
	uCorrect := false
	if hasU {
		uOpt = strPtr(uAns.OptionKey)
		uMs = uAns.ResponseMs
		uCorrect = uAns.OptionKey == correct
	}

	var oOpt *string
	oMs := maxMs
	oCorrect := false
	if hasO {
		oOpt = strPtr(oAns.OptionKey)
		oMs = oAns.ResponseMs
		oCorrect = oAns.OptionKey == correct
	}

	if uCorrect {
		room.UserScore++
	}
	if oCorrect {
		room.OpponentScore++
	}
	nextUserScore := room.UserScore
	nextOppScore := room.OpponentScore
	roundID := ""
	if roundIdx < len(room.RoundIDs) {
		roundID = room.RoundIDs[roundIdx]
	}
	lastRound := roundIdx == room.TotalRounds-1
	room.CurrentRound = roundIdx + 1
	if lastRound {
		room.Status = "finished"
		clearTimer(&room.RoundTimer)
	} else {
		room.RoundAnswers = make(map[string]PvpRoundAnswer)
		room.Status = "countdown"
	}
	sessionID := room.SessionID
	roomCode := room.RoomCode
	userID := room.UserID
	oppUserID := room.OpponentUserID
	room.mu.Unlock()

	store := h.getStore()
	if store != nil && sessionID != "" && roundID != "" {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		if err := store.UpdatePvpRoundWithScores(ctx, PvpRoundUpdate{
			SessionID:          sessionID,
			RoundID:            roundID,
			NewCurrentRoundIdx: roundIdx + 1,
			NextUserScore:      nextUserScore,
			NextOpponentScore:  nextOppScore,
			UserOptionKey:      uOpt,
			UserCorrect:        uCorrect,
			UserResponseMs:     uMs,
			OpponentOptionKey:  oOpt,
			OpponentCorrect:    oCorrect,
			OpponentResponseMs: oMs,
			DecidedAt:          time.Now().UTC(),
		}); err != nil {
			h.logger.Error("battle store write failed", "op", "UpdatePvpRoundWithScores", "error", err)
		}
		cancel()
	}

	oCorrectCopy := oCorrect
	uCorrectCopy := uCorrect
	h.sendBattleUserEvent(userID, "battle:answer_result", AnswerResultPayload{
		CorrectOptionKey: correct,
		OpponentCorrect:  &oCorrectCopy,
		RoundIndex:       roundIdx,
		UserCorrect:      uCorrect,
	})
	h.sendBattleUserEvent(userID, "battle:score_update", ScoreUpdatePayload{
		UserScore:     nextUserScore,
		OpponentScore: nextOppScore,
	})

	h.sendBattleUserEvent(oppUserID, "battle:answer_result", AnswerResultPayload{
		CorrectOptionKey: correct,
		OpponentCorrect:  &uCorrectCopy,
		RoundIndex:       roundIdx,
		UserCorrect:      oCorrect,
	})
	h.sendBattleUserEvent(oppUserID, "battle:score_update", ScoreUpdatePayload{
		UserScore:     nextOppScore,
		OpponentScore: nextUserScore,
	})

	if lastRound {
		userOutcome := "draw"
		oppOutcome := "draw"
		if nextUserScore > nextOppScore {
			userOutcome = "win"
			oppOutcome = "lose"
		} else if nextUserScore < nextOppScore {
			userOutcome = "lose"
			oppOutcome = "win"
		}
		if store != nil && sessionID != "" {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			if err := store.MarkCompleted(ctx, sessionID, nextUserScore, nextOppScore); err != nil {
				h.logger.Error("battle store write failed", "op", "MarkCompleted", "error", err)
			}
			h.recordAnalytics(ctx, store, userID, "battle_pvp_match_completed", map[string]any{
				"opponentScore": nextOppScore,
				"outcome":       userOutcome,
				"roomCode":      roomCode,
				"sessionId":     sessionID,
				"userScore":     nextUserScore,
			})
			cancel()
		}
		h.sendBattleUserEvent(userID, "battle:finished", FinishedEventPayload{
			Outcome:     userOutcome,
			Remediation: nil,
			SessionID:   sessionID,
		})
		h.sendBattleUserEvent(oppUserID, "battle:finished", FinishedEventPayload{
			Outcome:     oppOutcome,
			Remediation: nil,
			SessionID:   sessionID,
		})
		h.cleanupPvpRoom(roomCode)
		return
	}

	h.runPvpCountdownThenRound(roomCode, false)
}

func (h *BattleHandler) handlePvpForfeit(c *Conn, msg *Message) {
	var input struct {
		RoomCode string `json:"roomCode"`
	}
	if len(msg.Data) == 0 || json.Unmarshal(msg.Data, &input) != nil || strings.TrimSpace(input.RoomCode) == "" {
		sendConnEvent(c, "battle:error", map[string]string{"code": "invalid_payload"})
		return
	}
	room := h.getPvpRoom(input.RoomCode)
	if room == nil {
		return
	}
	room.mu.Lock()
	if room.Status == "finished" || room.Status == "abandoned" ||
		(c.UserID != room.UserID && c.UserID != room.OpponentUserID) {
		room.mu.Unlock()
		return
	}
	room.mu.Unlock()
	h.abandonPvpRoom(input.RoomCode, "user_forfeit", c.UserID)
}

func (h *BattleHandler) abandonPvpRoomIfOrphaned(roomCode string) {
	h.mu.RLock()
	count := 0
	for _, rc := range h.connToPvpRoom {
		if rc == roomCode {
			count++
		}
	}
	h.mu.RUnlock()
	if count > 0 {
		return
	}
	h.abandonPvpRoom(roomCode, "reconnect_timeout", "")
}

func (h *BattleHandler) tryAwardPvpWinForAbsentOpponent(roomCode, departedUserID string) {
	if len(h.battleConnsForUser(departedUserID)) > 0 {
		return
	}
	h.abandonPvpRoom(roomCode, "opponent_disconnect", departedUserID)
}

func (h *BattleHandler) abandonPvpRoom(roomCode, reason, forfeitingUserID string) {
	room := h.getPvpRoom(roomCode)
	if room == nil {
		return
	}
	room.mu.Lock()
	if room.Status == "finished" || room.Status == "abandoned" {
		room.mu.Unlock()
		return
	}
	room.Status = "abandoned"
	clearTimer(&room.RoundTimer)
	clearTimer(&room.AbandonTimer)
	clearTimer(&room.OpponentAbsentTimer)
	sessionID := room.SessionID
	userID := room.UserID
	oppUserID := room.OpponentUserID
	room.mu.Unlock()

	splitOutcome := forfeitingUserID != "" && (reason == "user_forfeit" || reason == "opponent_disconnect")
	store := h.getStore()
	if splitOutcome {
		winnerID := oppUserID
		if forfeitingUserID == oppUserID {
			winnerID = userID
		}
		if store != nil && sessionID != "" {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			if err := store.MarkAbandoned(ctx, sessionID, reason); err != nil {
				h.logger.Error("battle store write failed", "op", "MarkAbandoned", "error", err)
			}
			h.recordAnalytics(ctx, store, forfeitingUserID, "battle_pvp_match_abandoned", map[string]any{
				"forfeitingUserId": forfeitingUserID,
				"reason":           reason,
				"roomCode":         roomCode,
				"sessionId":        sessionID,
				"winnerUserId":     winnerID,
			})
			h.recordAnalytics(ctx, store, winnerID, "battle_pvp_forfeit_win", map[string]any{
				"roomCode":     roomCode,
				"sessionId":    sessionID,
				"winnerUserId": winnerID,
			})
			cancel()
		}
		h.sendBattleUserEvent(winnerID, "battle:finished", FinishedEventPayload{
			Outcome:      "win",
			Remediation:  nil,
			SessionID:    sessionID,
			PvpEndReason: "opponent_quit",
		})
		h.sendBattleUserEvent(forfeitingUserID, "battle:finished", FinishedEventPayload{
			Outcome:      "lose",
			Remediation:  nil,
			SessionID:    sessionID,
			PvpEndReason: "self_quit",
		})
		h.cleanupPvpRoom(roomCode)
		return
	}

	if store != nil && sessionID != "" {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		if err := store.MarkAbandoned(ctx, sessionID, reason); err != nil {
			h.logger.Error("battle store write failed", "op", "MarkAbandoned", "error", err)
		}
		h.recordAnalytics(ctx, store, userID, "battle_pvp_match_abandoned", map[string]any{
			"reason":    reason,
			"roomCode":  roomCode,
			"sessionId": sessionID,
		})
		cancel()
	}
	h.emitToPvpRoom(room, "battle:pvp_abandoned", map[string]string{
		"reason":   reason,
		"roomCode": roomCode,
	})
	h.cleanupPvpRoom(roomCode)
}

func (h *BattleHandler) cleanupPvpRoom(roomCode string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	room := h.pvpRooms[roomCode]
	if room == nil {
		return
	}
	delete(h.pvpRooms, roomCode)
	if h.userToPvpRoom[room.UserID] == roomCode {
		delete(h.userToPvpRoom, room.UserID)
	}
	if h.userToPvpRoom[room.OpponentUserID] == roomCode {
		delete(h.userToPvpRoom, room.OpponentUserID)
	}
	for cid, rc := range h.connToPvpRoom {
		if rc == roomCode {
			delete(h.connToPvpRoom, cid)
		}
	}
}

func (h *BattleHandler) buildPvpResyncLocked(room *PvpRoomState, viewerUserID string) PvpResyncPayload {
	isAcceptor := viewerUserID == room.UserID
	opponentDisplayName := room.OpponentDisplayName
	userScore := room.UserScore
	opponentScore := room.OpponentScore
	if !isAcceptor {
		opponentDisplayName = room.UserDisplayName
		userScore = room.OpponentScore
		opponentScore = room.UserScore
	}
	var (
		question             *QuestionEventPayload
		timeLeftSec          *int
		showCountdownOverlay bool
		settlingRound        bool
	)
	switch room.Status {
	case "question":
		if room.CurrentRound < len(room.Questions) {
			q := room.Questions[room.CurrentRound]
			question = &QuestionEventPayload{
				GameType:        room.GameType,
				InteractionType: interactionTypeForGame(room.GameType),
				RoundIndex:      room.CurrentRound,
				RoomCode:        room.RoomCode,
				TimeLimitSec:    defaultRoundTimeSec,
				TotalRounds:     room.TotalRounds,
				Question: ClientQuestionBody{
					QuestionID:  q.QuestionID,
					Prompt:      q.Prompt,
					SkillTag:    q.SkillTag,
					AudioScript: q.AudioScript,
					AudioUrl:    q.AudioUrl,
					Options:     q.SafeOptions(),
				},
			}
			rem := defaultRoundTimeSec - int(time.Since(room.RoundStart).Seconds())
			if rem < 0 {
				rem = 0
			}
			timeLeftSec = &rem
		}
	case "resolving":
		settlingRound = true
		if room.CurrentRound < len(room.Questions) {
			q := room.Questions[room.CurrentRound]
			question = &QuestionEventPayload{
				GameType:        room.GameType,
				InteractionType: interactionTypeForGame(room.GameType),
				RoundIndex:      room.CurrentRound,
				RoomCode:        room.RoomCode,
				TimeLimitSec:    defaultRoundTimeSec,
				TotalRounds:     room.TotalRounds,
				Question: ClientQuestionBody{
					QuestionID:  q.QuestionID,
					Prompt:      q.Prompt,
					SkillTag:    q.SkillTag,
					AudioScript: q.AudioScript,
					AudioUrl:    q.AudioUrl,
					Options:     q.SafeOptions(),
				},
			}
			zero := 0
			timeLeftSec = &zero
		}
	case "countdown":
		showCountdownOverlay = true
	}
	return PvpResyncPayload{
		MaxRounds:            room.TotalRounds,
		OpponentDisplayName:  opponentDisplayName,
		OpponentScore:        opponentScore,
		Question:             question,
		RoomCode:             room.RoomCode,
		RoomState:            room.Status,
		SessionID:            room.SessionID,
		SettlingRound:        settlingRound,
		ShowCountdownOverlay: showCountdownOverlay,
		TimeLeftSec:          timeLeftSec,
		UserScore:            userScore,
	}
}

// ── Legacy / MVP events preserved for existing protocol tests ───────────────

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
	var payload map[string]any
	if msg.Data != nil {
		_ = json.Unmarshal(msg.Data, &payload)
	}
	resp := map[string]any{
		"userId":   c.UserID,
		"payload":  payload,
		"serverTs": time.Now().UnixMilli(),
	}
	sendConnEvent(c, "battle:action_ack", resp)
}

// ── Helpers ─────────────────────────────────────────────────────────────────

func clearTimer(t **time.Timer) {
	if *t != nil {
		(*t).Stop()
		*t = nil
	}
}

func randomHex(numBytes int) string {
	b := make([]byte, numBytes)
	if _, err := crand.Read(b); err != nil {
		// Non-cryptographic fallback: still unique per call, never panics.
		for i := range b {
			b[i] = byte(mrand.UintN(256))
		}
	}
	return hex.EncodeToString(b)
}

func defaultInMemoryBattle(fairnessSeed string, maxRounds int) *CreatedBattle {
	if maxRounds <= 0 {
		maxRounds = defaultMaxRounds
	}
	pool := []BattleQuestionPayload{
		{
			QuestionID: "q-1",
			Prompt:     "会議の冒頭で適切な挨拶はどれですか。",
			SkillTag:   "keigo",
			Options: []BattleQuestionOption{
				{OptionKey: "A", Text: "お忙しいところお集まりいただきありがとうございます", IsCorrect: true},
				{OptionKey: "B", Text: "早く座ってください", IsCorrect: false},
				{OptionKey: "C", Text: "何で来たんですか", IsCorrect: false},
				{OptionKey: "D", Text: "知りません", IsCorrect: false},
			},
		},
		{
			QuestionID: "q-2",
			Prompt:     "取引先に資料の送付を依頼する表現はどれですか。",
			SkillTag:   "email",
			Options: []BattleQuestionOption{
				{OptionKey: "A", Text: "資料を送れ", IsCorrect: false},
				{OptionKey: "B", Text: "資料をご送付いただけますでしょうか", IsCorrect: true},
				{OptionKey: "C", Text: "資料はどこですか", IsCorrect: false},
				{OptionKey: "D", Text: "資料はいりません", IsCorrect: false},
			},
		},
		{
			QuestionID: "q-3",
			Prompt:     "「承知いたしました」と同じ意味の言葉はどれですか。",
			SkillTag:   "keigo",
			Options: []BattleQuestionOption{
				{OptionKey: "A", Text: "かしこまりました", IsCorrect: true},
				{OptionKey: "B", Text: "わかりません", IsCorrect: false},
				{OptionKey: "C", Text: "お断りします", IsCorrect: false},
				{OptionKey: "D", Text: "知りませんでした", IsCorrect: false},
			},
		},
	}
	if maxRounds > len(pool) {
		maxRounds = len(pool)
	}
	picked := ShuffleDeterministic(pool, fairnessSeed)[:maxRounds]
	roundIDs := make([]string, len(picked))
	for i := range picked {
		roundIDs[i] = randomHex(8)
	}
	return &CreatedBattle{
		SessionID: randomHex(8),
		RoomCode:  makeRandomRoomCode(),
		Questions: picked,
		RoundIDs:  roundIDs,
	}
}
