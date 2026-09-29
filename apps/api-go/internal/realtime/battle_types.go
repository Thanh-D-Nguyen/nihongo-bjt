package realtime

import (
	"sync"
	"time"
)

// BotProfile defines a bot's behavior parameters for battle matches.
type BotProfile struct {
	Key                string
	CorrectProbability float64
	DelayMinMs         int
	DelayMaxMs         int
}

// DefaultBots returns the standard bot profiles matching packages/shared/src/battle.ts.
func DefaultBots() map[string]BotProfile {
	return map[string]BotProfile{
		"bot_j1": {Key: "bot_j1", CorrectProbability: 0.76, DelayMinMs: 260, DelayMaxMs: 1700},
		"bot_j2": {Key: "bot_j2", CorrectProbability: 0.40, DelayMinMs: 450, DelayMaxMs: 2400},
		"bot_j3": {Key: "bot_j3", CorrectProbability: 0.55, DelayMinMs: 350, DelayMaxMs: 2000},
		"bot_j4": {Key: "bot_j4", CorrectProbability: 0.68, DelayMinMs: 280, DelayMaxMs: 1800},
	}
}

// RoomState tracks an active bot battle room.
type RoomState struct {
	RoomCode     string
	UserID       string
	BotKey       string
	ConfigID     string
	Status       string // "waiting", "countdown", "active", "finished"
	CurrentRound int
	TotalRounds  int
	Questions    []BattleQuestion
	Answers      map[string]*BattleAnswer // userID → latest answer
	Scores       map[string]int
	Streaks      map[string]int
	CreatedAt    time.Time
	mu           sync.Mutex
}

// PvpRoomState tracks an active PvP battle room.
type PvpRoomState struct {
	RoomCode      string
	Player1UserID string
	Player2UserID string
	Status        string // "waiting", "countdown", "active", "finished", "abandoned"
	CurrentRound  int
	TotalRounds   int
	Questions     []BattleQuestion
	Answers       map[string]map[int]*BattleAnswer // userID → roundIndex → answer
	Scores        map[string]int
	Streaks       map[string]int
	Winner        string
	CreatedAt     time.Time
	AbandonTimer  *time.Timer
	mu            sync.Mutex
}

// PendingChallenge tracks a user-to-user challenge awaiting acceptance.
type PendingChallenge struct {
	ChallengeID     string
	FromUserID      string
	ToUserID        string
	FromDisplayName string
	CreatedAt       time.Time
	ExpiresAt       time.Time
}

// LobbyUser represents a user present in the battle lobby.
type LobbyUser struct {
	UserID      string `json:"userId"`
	DisplayName string `json:"displayName,omitempty"`
	JoinedAt    time.Time
}

// BattleQuestion is a single question in a battle round.
type BattleQuestion struct {
	ID          string            `json:"id"`
	Text        string            `json:"text"`
	Options     []BattleOption    `json:"options"`
	CorrectKey  string            `json:"-"` // not sent to client
	TimeLimitMs int               `json:"timeLimitMs"`
	Metadata    map[string]string `json:"metadata,omitempty"`
}

// BattleOption is one selectable answer option.
type BattleOption struct {
	Key  string `json:"key"`
	Text string `json:"text"`
}

// BattleAnswer records a player's answer submission.
type BattleAnswer struct {
	UserID         string    `json:"userId"`
	QuestionID     string    `json:"questionId"`
	OptionKey      string    `json:"optionKey"`
	IdempotencyKey string    `json:"idempotencyKey"`
	RoundIndex     int       `json:"roundIndex"`
	Correct        bool      `json:"correct"`
	SubmittedAt    time.Time `json:"submittedAt"`
}

// ScoreUpdate is the payload for battle:score_update events.
type ScoreUpdate struct {
	UserID string `json:"userId"`
	Score  int    `json:"score"`
	Streak int    `json:"streak"`
}

// AnswerResult is the payload for battle:answer_result events.
type AnswerResult struct {
	Correct  bool `json:"correct"`
	Score    int  `json:"score"`
	Streak   int  `json:"streak"`
	RoundIdx int  `json:"roundIndex"`
}

// FinishedPayload is the payload for battle:finished events.
type FinishedPayload struct {
	Winner      string         `json:"winner"`
	FinalScores map[string]int `json:"finalScores"`
	TotalRounds int            `json:"totalRounds"`
	RoomCode    string         `json:"roomCode"`
}

// MatchFoundPayload is the payload for battle:pvp_match_found events.
type MatchFoundPayload struct {
	RoomCode string `json:"roomCode"`
	Opponent struct {
		UserID      string `json:"userId"`
		DisplayName string `json:"displayName,omitempty"`
	} `json:"opponent"`
}

// LobbyPresencePayload is the payload for battle:lobby_presence events.
type LobbyPresencePayload struct {
	Users []LobbyUser `json:"users"`
}

// ChatMessagePayload is the payload for battle:lobby_message broadcast events.
type ChatMessagePayload struct {
	ClientMessageID string `json:"clientMessageId"`
	UserID          string `json:"userId"`
	DisplayName     string `json:"displayName,omitempty"`
	Message         string `json:"message"`
	RoomKey         string `json:"roomKey"`
	Timestamp       string `json:"timestamp"`
}
