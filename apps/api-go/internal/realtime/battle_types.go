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

// BattleBotRive holds Rive animation asset metadata for a bot avatar.
type BattleBotRive struct {
	Artboard     *string `json:"artboard"`
	Src          *string `json:"src"`
	StateMachine *string `json:"stateMachine"`
}

// PlayableBattleBot describes a playable bot profile for matchmaking and client display.
type PlayableBattleBot struct {
	AccuracyPct     int           `json:"accuracyPct"`
	AvatarFallback  string        `json:"avatarFallback"`
	BotKey          string        `json:"botKey"`
	Key             string        `json:"key"`
	Difficulty      string        `json:"difficulty"`
	Label           string        `json:"label"`
	MaxDelayMs      int           `json:"maxDelayMs"`
	MinDelayMs      int           `json:"minDelayMs"`
	Persona         *string       `json:"persona"`
	Rive            BattleBotRive `json:"rive"`
	StyleToken      string        `json:"styleToken"`
	VocabularyLevel string        `json:"vocabularyLevel"`
}

// BattleConfigParams holds resolved parameters from a published battle_config.
type BattleConfigParams struct {
	ID                 string
	QuestionCount      int
	TimePerQuestionSec int
	MaxParticipants    int
	GameType           string
}

// BattleQuestionOption represents one answer option in a battle question.
type BattleQuestionOption struct {
	OptionKey string `json:"optionKey"`
	Text      string `json:"text"`
	IsCorrect bool   `json:"-"`
}

// BattleQuestionPayload is a question loaded for a battle session.
type BattleQuestionPayload struct {
	QuestionID  string                 `json:"questionId"`
	Prompt      string                 `json:"prompt"`
	SkillTag    string                 `json:"skillTag"`
	AudioScript *string                `json:"audioScript"`
	AudioUrl    *string                `json:"audioUrl"`
	Options     []BattleQuestionOption `json:"options"`
}

// SafeOptions returns client-safe options (without correctness flags).
func (q BattleQuestionPayload) SafeOptions() []BattleQuestionOption {
	out := make([]BattleQuestionOption, len(q.Options))
	for i, o := range q.Options {
		out[i] = BattleQuestionOption{OptionKey: o.OptionKey, Text: o.Text}
	}
	return out
}

// CorrectOptionKey returns the optionKey marked as correct, or empty string.
func (q BattleQuestionPayload) CorrectOptionKey() string {
	for _, o := range q.Options {
		if o.IsCorrect {
			return o.OptionKey
		}
	}
	return ""
}

// HasOption reports whether optionKey is one of this question's options.
func (q BattleQuestionPayload) HasOption(optionKey string) bool {
	for _, o := range q.Options {
		if o.OptionKey == optionKey {
			return true
		}
	}
	return false
}

// RoomState tracks an active bot battle room.
type RoomState struct {
	RoomCode            string
	SessionID           string
	UserID              string
	ConnID              string
	BotKey              string
	BotProfile          PlayableBattleBot
	ConfigID            string
	ConfigTimeSec       int
	GameType            string
	Status              string // "countdown", "question", "resolving", "finished"
	CurrentRound        int
	TotalRounds         int
	Questions           []BattleQuestionPayload
	RoundIDs            []string
	Idempotency         map[string]bool
	RoundStart          time.Time
	RoundTimer          *time.Timer
	UserScore           int
	OpponentScore       int
	UserCorrectStreak   int
	BotCorrectStreak    int
	LastCommentRound    int
	MissedSkillTags     map[string]int
	InvalidAnswerStrike int
	CreatedAt           time.Time
	mu                  sync.Mutex
}

// PvpRoundAnswer stores one player's answer for the current PvP round.
type PvpRoundAnswer struct {
	OptionKey  string
	ResponseMs int
}

// PvpRoomState tracks an active PvP battle room.
// UserID is the challenge acceptor ("user" in battle_session);
// OpponentUserID is the challenger ("opponent_user_id" in battle_session).
type PvpRoomState struct {
	RoomCode             string
	SessionID            string
	GameType             string
	UserID               string
	UserDisplayName      string
	OpponentUserID       string
	OpponentDisplayName  string
	Status               string // "countdown", "question", "resolving", "finished", "abandoned"
	CurrentRound         int
	TotalRounds          int
	Questions            []BattleQuestionPayload
	RoundIDs             []string
	Idempotency          map[string]bool
	RoundAnswers         map[string]PvpRoundAnswer
	RoundStart           time.Time
	RoundTimer           *time.Timer
	AbandonTimer         *time.Timer
	OpponentAbsentTimer  *time.Timer
	OpponentAbsentUserID string
	UserScore            int
	OpponentScore        int
	CreatedAt            time.Time
	mu                   sync.Mutex
}

// PendingChallenge tracks a user-to-user challenge awaiting acceptance.
type PendingChallenge struct {
	ChallengeID     string      `json:"challengeId"`
	FromUserID      string      `json:"fromUserId"`
	TargetUserID    string      `json:"targetUserId"`
	FromDisplayName *string     `json:"fromDisplayName"`
	CreatedAt       string      `json:"createdAt"`
	ExpiresAt       time.Time   `json:"-"`
	ExpireTimer     *time.Timer `json:"-"`
}

// LobbyUser represents a user present in the battle lobby.
type LobbyUser struct {
	UserID      string `json:"userId"`
	DisplayName string `json:"displayName,omitempty"`
	JoinedAt    string `json:"joinedAt"`
}

// LobbyPresencePayload is the payload for battle:lobby_presence events.
type LobbyPresencePayload struct {
	Users []LobbyUser `json:"users"`
}

// LobbyMessage is the wire shape for battle:lobby_message and POST /api/battle/chat.
type LobbyMessage struct {
	ID          string  `json:"id"`
	RoomKey     string  `json:"roomKey"`
	UserID      string  `json:"userId"`
	DisplayName *string `json:"displayName"`
	Message     string  `json:"message"`
	Kind        string  `json:"kind"`
	CreatedAt   string  `json:"createdAt"`
}

// ClientQuestionBody is the nested question object sent inside battle:question.
type ClientQuestionBody struct {
	QuestionID  string                 `json:"questionId,omitempty"`
	Prompt      string                 `json:"prompt"`
	SkillTag    string                 `json:"skillTag"`
	AudioScript *string                `json:"audioScript"`
	AudioUrl    *string                `json:"audioUrl"`
	Options     []BattleQuestionOption `json:"options"`
}

// QuestionEventPayload is the wire payload for battle:question.
type QuestionEventPayload struct {
	GameType        string             `json:"gameType,omitempty"`
	InteractionType string             `json:"interactionType,omitempty"`
	Question        ClientQuestionBody `json:"question"`
	RoomCode        string             `json:"roomCode"`
	RoundIndex      int                `json:"roundIndex"`
	TimeLimitSec    int                `json:"timeLimitSec"`
	TotalRounds     int                `json:"totalRounds"`
}

// AnswerResultPayload is the wire payload for battle:answer_result.
type AnswerResultPayload struct {
	BotCorrect       *bool  `json:"botCorrect,omitempty"`
	OpponentCorrect  *bool  `json:"opponentCorrect,omitempty"`
	CorrectOptionKey string `json:"correctOptionKey"`
	RoundIndex       int    `json:"roundIndex"`
	UserCorrect      bool   `json:"userCorrect"`
}

// ScoreUpdatePayload is the wire payload for battle:score_update.
type ScoreUpdatePayload struct {
	UserScore     int `json:"userScore"`
	OpponentScore int `json:"opponentScore"`
}

// RemediationPayload is the optional loss remediation hint in battle:finished.
type RemediationPayload struct {
	CtaPath        string   `json:"ctaPath"`
	FocusSkillTags []string `json:"focusSkillTags,omitempty"`
	Kind           string   `json:"kind"`
	SummaryI18nKey string   `json:"summaryI18nKey,omitempty"`
}

// FinishedEventPayload is the wire payload for battle:finished.
type FinishedEventPayload struct {
	Outcome      string              `json:"outcome"`
	Remediation  *RemediationPayload `json:"remediation"`
	SessionID    string              `json:"sessionId,omitempty"`
	PvpEndReason string              `json:"pvpEndReason,omitempty"`
}

// PvpMatchFoundPayload is the wire payload for battle:pvp_match_found.
type PvpMatchFoundPayload struct {
	MaxRounds           int     `json:"maxRounds"`
	Mode                string  `json:"mode"`
	OpponentDisplayName *string `json:"opponentDisplayName"`
	RoomCode            string  `json:"roomCode"`
	SessionID           string  `json:"sessionId"`
	UserDisplayName     *string `json:"userDisplayName"`
}

// PvpResyncPayload is the wire payload for battle:pvp_resync on reconnect.
type PvpResyncPayload struct {
	MaxRounds            int                   `json:"maxRounds"`
	OpponentDisplayName  string                `json:"opponentDisplayName"`
	OpponentScore        int                   `json:"opponentScore"`
	Question             *QuestionEventPayload `json:"question"`
	RoomCode             string                `json:"roomCode"`
	RoomState            string                `json:"roomState"`
	SessionID            string                `json:"sessionId"`
	SettlingRound        bool                  `json:"settlingRound"`
	ShowCountdownOverlay bool                  `json:"showCountdownOverlay"`
	TimeLeftSec          *int                  `json:"timeLeftSec"`
	UserScore            int                   `json:"userScore"`
}

// BotStatePayload is the wire payload for battle:bot_state.
type BotStatePayload struct {
	BotKey     string        `json:"botKey"`
	Persona    *string       `json:"persona"`
	Rive       BattleBotRive `json:"rive"`
	State      string        `json:"state"`
	StyleToken string        `json:"styleToken"`
}
