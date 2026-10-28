package realtime

import (
	"context"
	crand "crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const defaultMaxRounds = 5

// ErrBattleNoQuestions is returned when no published BJT questions exist for battle.
var ErrBattleNoQuestions = errors.New("BATTLE_NO_QUESTIONS")

var autoRiveMetadataValues = map[string]bool{
	"":            true,
	"auto":        true,
	"__auto__":    true,
	"default":     true,
	"__default__": true,
	"none":        true,
	"__none__":    true,
}

func normalizeRiveMetadata(v *string) *string {
	if v == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*v)
	if autoRiveMetadataValues[strings.ToLower(trimmed)] {
		return nil
	}
	return &trimmed
}

func strPtr(s string) *string { return &s }

type registryBotDef struct {
	avatarFallback  string
	accuracyPct     int
	difficulty      string
	labelI18nKey    string
	personaI18nKey  string
	minDelayMs      int
	maxDelayMs      int
	riveSrc         string
	styleToken      string
	vocabularyLevel string
}

var registryBots = map[string]registryBotDef{
	"bot_j1": {
		avatarFallback:  "J1",
		accuracyPct:     76,
		difficulty:      "hard",
		labelI18nKey:    "battle.bots.j1",
		personaI18nKey:  "battle.botPersonas.j1",
		minDelayMs:      260,
		maxDelayMs:      1700,
		riveSrc:         "/assets/battle/bots/23764-44433-character-customization-ui.riv",
		styleToken:      "sharp",
		vocabularyLevel: "bjt_advanced",
	},
	"bot_j2": {
		avatarFallback:  "J2",
		accuracyPct:     40,
		difficulty:      "easy",
		labelI18nKey:    "battle.bots.j2",
		personaI18nKey:  "battle.botPersonas.j2",
		minDelayMs:      450,
		maxDelayMs:      2400,
		riveSrc:         "/assets/battle/bots/18912-35694-lil-guy.riv",
		styleToken:      "calm",
		vocabularyLevel: "bjt_basic",
	},
	"bot_j3": {
		avatarFallback:  "J3",
		accuracyPct:     55,
		difficulty:      "medium",
		labelI18nKey:    "battle.bots.j3",
		personaI18nKey:  "battle.botPersonas.j3",
		minDelayMs:      350,
		maxDelayMs:      2000,
		riveSrc:         "/assets/battle/bots/24876-46460-interactive-bunny-character.riv",
		styleToken:      "focused",
		vocabularyLevel: "bjt_intermediate",
	},
	"bot_j4": {
		avatarFallback:  "J4",
		accuracyPct:     68,
		difficulty:      "hard",
		labelI18nKey:    "battle.bots.j4",
		personaI18nKey:  "battle.botPersonas.j4",
		minDelayMs:      280,
		maxDelayMs:      1800,
		riveSrc:         "/assets/battle/bots/20538-38646-cheeky-chops.riv",
		styleToken:      "sharp",
		vocabularyLevel: "bjt_advanced",
	},
}

// RegistryPlayableBot returns a standard bot definition when present in the built-in registry.
func RegistryPlayableBot(botKey string) (*PlayableBattleBot, bool) {
	def, ok := registryBots[botKey]
	if !ok {
		return nil, false
	}
	return &PlayableBattleBot{
		AccuracyPct:    def.accuracyPct,
		AvatarFallback: def.avatarFallback,
		BotKey:         botKey,
		Key:            botKey,
		Difficulty:     def.difficulty,
		Label:          def.labelI18nKey,
		MaxDelayMs:     def.maxDelayMs,
		MinDelayMs:     def.minDelayMs,
		Persona:        strPtr(def.personaI18nKey),
		Rive: BattleBotRive{
			Artboard:     nil,
			Src:          strPtr(def.riveSrc),
			StateMachine: nil,
		},
		StyleToken:      def.styleToken,
		VocabularyLevel: def.vocabularyLevel,
	}, true
}

// hashSeedToUint32 matches packages/shared/src/battle.ts hashSeedToUint32 (FNV-1a 32-bit).
func hashSeedToUint32(input string) uint32 {
	var h uint32 = 2166136261
	for i := 0; i < len(input); i++ {
		h ^= uint32(input[i])
		h *= 16777619
	}
	return h
}

// mulberry32 matches packages/shared/src/battle.ts mulberry32 PRNG.
func mulberry32(seed uint32) func() float64 {
	return func() float64 {
		seed += 0x6d2b79f5
		t := seed
		t = (t ^ (t >> 15)) * (t | 1)
		t ^= t + (t^(t>>7))*(t|61)
		return float64(t^(t>>14)) / 4294967296.0
	}
}

// ShuffleDeterministic shuffles a slice deterministically using the same seed
// algorithm as packages/shared/src/battle.ts.
func ShuffleDeterministic[T any](items []T, seedString string) []T {
	rng := mulberry32(hashSeedToUint32(seedString))
	out := make([]T, len(items))
	copy(out, items)
	for i := len(out) - 1; i > 0; i-- {
		j := int(math.Floor(rng() * float64(i+1)))
		if j > i {
			j = i
		}
		out[i], out[j] = out[j], out[i]
	}
	return out
}

// DecideBotOption picks the bot's answer option according to its accuracy.
func DecideBotOption(correctOptionKey string, optionKeys []string, correctProbability float64, rng func() float64) string {
	if len(optionKeys) == 0 {
		return correctOptionKey
	}
	if rng() < correctProbability {
		return correctOptionKey
	}
	wrong := make([]string, 0, len(optionKeys))
	for _, k := range optionKeys {
		if k != correctOptionKey {
			wrong = append(wrong, k)
		}
	}
	if len(wrong) == 0 {
		return correctOptionKey
	}
	idx := int(math.Floor(rng() * float64(len(wrong))))
	if idx >= len(wrong) {
		idx = len(wrong) - 1
	}
	return wrong[idx]
}

// RandomBetween returns an integer in [minVal, maxVal] inclusive.
func RandomBetween(rng func() float64, minVal, maxVal int) int {
	if maxVal <= minVal {
		return minVal
	}
	v := int(math.Floor(rng()*float64(maxVal-minVal+1))) + minVal
	if v > maxVal {
		return maxVal
	}
	return v
}

// CreatedBattle holds the database entities created when starting a bot or PvP match.
type CreatedBattle struct {
	SessionID string
	RoomCode  string
	Questions []BattleQuestionPayload
	RoundIDs  []string
}

// BotRoundUpdate carries round and score updates for a single bot battle round.
type BotRoundUpdate struct {
	SessionID          string
	RoundID            string
	UserID             string
	NewCurrentRoundIdx int
	NextUserScore      int
	NextOpponentScore  int
	UserOptionKey      *string
	UserCorrect        bool
	UserResponseMs     int
	BotOptionKey       string
	BotCorrect         bool
	BotResponseMs      int
	DecidedAt          time.Time
}

// PvpRoundUpdate carries round and score updates for a single PvP battle round.
type PvpRoundUpdate struct {
	SessionID          string
	RoundID            string
	NewCurrentRoundIdx int
	NextUserScore      int
	NextOpponentScore  int
	UserOptionKey      *string
	UserCorrect        bool
	UserResponseMs     int
	OpponentOptionKey  *string
	OpponentCorrect    bool
	OpponentResponseMs int
	DecidedAt          time.Time
}

// BattleStore abstracts persistence for the battle realtime orchestrator.
type BattleStore interface {
	GetPlayableBot(ctx context.Context, botKey string) (*PlayableBattleBot, error)
	GetPublishedConfig(ctx context.Context, configID string) (*BattleConfigParams, error)
	AbandonInProgressForUser(ctx context.Context, userID, reason string) error
	CreateBotBattle(ctx context.Context, userID, botKey, fairnessSeed string, maxRounds int) (*CreatedBattle, error)
	CreatePvpBattle(ctx context.Context, userID, opponentUserID, fairnessSeed string, maxRounds int) (*CreatedBattle, error)
	UpdateBotRoundWithScores(ctx context.Context, u BotRoundUpdate) error
	UpdatePvpRoundWithScores(ctx context.Context, u PvpRoundUpdate) error
	MarkCompleted(ctx context.Context, sessionID string, userScore, opponentScore int) error
	MarkAbandoned(ctx context.Context, sessionID, reason string) error
	CreateChatMessage(ctx context.Context, roomKey, userID string, displayName *string, message, kind string, metadata map[string]any) (*LobbyMessage, error)
	CreateAnalyticsEvent(ctx context.Context, userID, eventName string, payload map[string]any) error
}

// PostgresBattleStore implements BattleStore backed by a pgxpool.Pool.
type PostgresBattleStore struct {
	db *pgxpool.Pool
}

// NewPostgresBattleStore creates a PostgresBattleStore for the given pool.
// Returns nil if db is nil.
func NewPostgresBattleStore(db *pgxpool.Pool) *PostgresBattleStore {
	if db == nil {
		return nil
	}
	return &PostgresBattleStore{db: db}
}

// GetPlayableBot loads an active bot from learning.battle_bot or falls back to the built-in registry.
func (s *PostgresBattleStore) GetPlayableBot(ctx context.Context, botKey string) (*PlayableBattleBot, error) {
	const q = `SELECT bot_key, name, avatar_fallback, difficulty, persona,
		accuracy_pct, min_delay_ms, max_delay_ms, vocabulary_level,
		style_token, rive_src, rive_artboard, rive_state_machine
		FROM learning.battle_bot
		WHERE bot_key = $1 AND status = 'active'
		LIMIT 1`
	var (
		b                PlayableBattleBot
		riveArtboard     string
		riveStateMachine string
	)
	err := s.db.QueryRow(ctx, q, botKey).Scan(
		&b.BotKey, &b.Label, &b.AvatarFallback, &b.Difficulty, &b.Persona,
		&b.AccuracyPct, &b.MinDelayMs, &b.MaxDelayMs, &b.VocabularyLevel,
		&b.StyleToken, &b.Rive.Src, &riveArtboard, &riveStateMachine,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			if reg, ok := RegistryPlayableBot(botKey); ok {
				return reg, nil
			}
			return nil, nil
		}
		return nil, err
	}
	b.Key = b.BotKey
	reg, hasReg := RegistryPlayableBot(botKey)
	if b.StyleToken != "calm" && b.StyleToken != "sharp" && b.StyleToken != "focused" {
		if hasReg {
			b.StyleToken = reg.StyleToken
		} else {
			b.StyleToken = "focused"
		}
	}
	b.Rive.Artboard = normalizeRiveMetadata(&riveArtboard)
	if b.Rive.Artboard == nil && hasReg {
		b.Rive.Artboard = reg.Rive.Artboard
	}
	b.Rive.StateMachine = normalizeRiveMetadata(&riveStateMachine)
	if b.Rive.StateMachine == nil && hasReg {
		b.Rive.StateMachine = reg.Rive.StateMachine
	}
	if (b.Rive.Src == nil || strings.TrimSpace(*b.Rive.Src) == "") && hasReg {
		b.Rive.Src = reg.Rive.Src
	}
	return &b, nil
}

// GetPublishedConfig returns a published battle_config by ID, or nil if not found.
func (s *PostgresBattleStore) GetPublishedConfig(ctx context.Context, configID string) (*BattleConfigParams, error) {
	const q = `SELECT id::text, question_count, time_per_question_sec, max_participants,
		COALESCE(NULLIF(scoring_rules->>'gameType', ''), 'speed_duel')
		FROM learning.battle_config
		WHERE id = $1::uuid AND status = 'published'`
	var cfg BattleConfigParams
	err := s.db.QueryRow(ctx, q, configID).Scan(
		&cfg.ID, &cfg.QuestionCount, &cfg.TimePerQuestionSec, &cfg.MaxParticipants, &cfg.GameType,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &cfg, nil
}

// AbandonInProgressForUser marks lingering in_progress bot sessions owned by userID as abandoned.
// PvP sessions are excluded: their lifecycle belongs to the PvP room, and a live match the user
// accepted must not lose its result because they started a bot match elsewhere.
func (s *PostgresBattleStore) AbandonInProgressForUser(ctx context.Context, userID, reason string) error {
	const q = `UPDATE learning.battle_session
		SET status = 'abandoned', abandoned_reason = $2, completed_at = NOW()
		WHERE user_id = $1::uuid AND mode = 'bot' AND status = 'in_progress'`
	_, err := s.db.Exec(ctx, q, userID, reason)
	return err
}

func (s *PostgresBattleStore) loadQuestionPool(ctx context.Context) ([]BattleQuestionPayload, error) {
	const q = `SELECT q.id::text, q.prompt, q.skill_tag, q.audio_script, q.audio_url
		FROM assessment.bjt_question q
		JOIN assessment.bjt_test_section s ON s.id = q.section_id
		JOIN assessment.bjt_mock_test t ON t.id = s.test_id
		WHERE q.status = 'published' AND t.status = 'published'
		ORDER BY q.id
		LIMIT 200`
	rows, err := s.db.Query(ctx, q)
	if err != nil {
		return nil, err
	}
	var questions []BattleQuestionPayload
	var ids []string
	idxByID := make(map[string]int)
	for rows.Next() {
		var item BattleQuestionPayload
		if err := rows.Scan(&item.QuestionID, &item.Prompt, &item.SkillTag, &item.AudioScript, &item.AudioUrl); err != nil {
			rows.Close()
			return nil, err
		}
		idxByID[item.QuestionID] = len(questions)
		ids = append(ids, item.QuestionID)
		questions = append(questions, item)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return nil, err
	}
	rows.Close()
	if len(questions) == 0 {
		return nil, ErrBattleNoQuestions
	}

	const optQ = `SELECT question_id::text, option_key, text, is_correct
		FROM assessment.bjt_question_option
		WHERE question_id = ANY($1::uuid[])
		ORDER BY question_id, option_key ASC`
	optRows, err := s.db.Query(ctx, optQ, ids)
	if err != nil {
		return nil, err
	}
	defer optRows.Close()
	for optRows.Next() {
		var qid string
		var opt BattleQuestionOption
		if err := optRows.Scan(&qid, &opt.OptionKey, &opt.Text, &opt.IsCorrect); err != nil {
			return nil, err
		}
		if idx, ok := idxByID[qid]; ok {
			questions[idx].Options = append(questions[idx].Options, opt)
		}
	}
	if err := optRows.Err(); err != nil {
		return nil, err
	}

	valid := make([]BattleQuestionPayload, 0, len(questions))
	for _, item := range questions {
		if len(item.Options) > 0 && item.CorrectOptionKey() != "" {
			valid = append(valid, item)
		}
	}
	if len(valid) == 0 {
		return nil, ErrBattleNoQuestions
	}
	return valid, nil
}

func makeRandomRoomCode() string {
	var b [4]byte
	if _, err := crand.Read(b[:]); err != nil {
		return fmt.Sprintf("%08x", time.Now().UnixNano()&0xffffffff)
	}
	return hex.EncodeToString(b[:])
}

func (s *PostgresBattleStore) makeUniqueRoomCode(ctx context.Context) (string, error) {
	const checkQ = `SELECT EXISTS(SELECT 1 FROM learning.battle_session WHERE room_code = $1)`
	for attempt := 0; attempt < 8; attempt++ {
		code := makeRandomRoomCode()
		var exists bool
		if err := s.db.QueryRow(ctx, checkQ, code).Scan(&exists); err != nil {
			return "", err
		}
		if !exists {
			return code, nil
		}
	}
	var b [8]byte
	_, _ = crand.Read(b[:])
	return hex.EncodeToString(b[:])[:16], nil
}

// CreateBotBattle selects questions, creates a battle_session (mode='bot') and its battle_round rows.
func (s *PostgresBattleStore) CreateBotBattle(ctx context.Context, userID, botKey, fairnessSeed string, maxRounds int) (*CreatedBattle, error) {
	if maxRounds <= 0 {
		maxRounds = defaultMaxRounds
	}
	pool, err := s.loadQuestionPool(ctx)
	if err != nil {
		return nil, err
	}
	n := maxRounds
	if len(pool) < n {
		n = len(pool)
	}
	picked := ShuffleDeterministic(pool, fairnessSeed)[:n]
	roomCode, err := s.makeUniqueRoomCode(ctx)
	if err != nil {
		return nil, err
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	const insertSessQ = `INSERT INTO learning.battle_session
		(user_id, room_code, mode, bot_key, status, user_score, opponent_score, max_rounds, current_round_index, fairness_seed)
		VALUES ($1::uuid, $2, 'bot', $3, 'in_progress', 0, 0, $4, 0, $5)
		RETURNING id::text`
	var sessionID string
	if err := tx.QueryRow(ctx, insertSessQ, userID, roomCode, botKey, n, fairnessSeed).Scan(&sessionID); err != nil {
		return nil, err
	}

	const insertRoundQ = `INSERT INTO learning.battle_round (session_id, round_index, question_id)
		VALUES ($1::uuid, $2, $3::uuid)
		RETURNING id::text`
	roundIDs := make([]string, n)
	for i, q := range picked {
		if err := tx.QueryRow(ctx, insertRoundQ, sessionID, i, q.QuestionID).Scan(&roundIDs[i]); err != nil {
			return nil, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &CreatedBattle{
		SessionID: sessionID,
		RoomCode:  roomCode,
		Questions: picked,
		RoundIDs:  roundIDs,
	}, nil
}

// CreatePvpBattle selects questions, creates a battle_session (mode='pvp') and its battle_round rows.
func (s *PostgresBattleStore) CreatePvpBattle(ctx context.Context, userID, opponentUserID, fairnessSeed string, maxRounds int) (*CreatedBattle, error) {
	if maxRounds <= 0 {
		maxRounds = defaultMaxRounds
	}
	pool, err := s.loadQuestionPool(ctx)
	if err != nil {
		return nil, err
	}
	n := maxRounds
	if len(pool) < n {
		n = len(pool)
	}
	picked := ShuffleDeterministic(pool, fairnessSeed)[:n]
	roomCode, err := s.makeUniqueRoomCode(ctx)
	if err != nil {
		return nil, err
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	const insertSessQ = `INSERT INTO learning.battle_session
		(user_id, opponent_user_id, room_code, mode, status, user_score, opponent_score, max_rounds, current_round_index, fairness_seed)
		VALUES ($1::uuid, $2::uuid, $3, 'pvp', 'in_progress', 0, 0, $4, 0, $5)
		RETURNING id::text`
	var sessionID string
	if err := tx.QueryRow(ctx, insertSessQ, userID, opponentUserID, roomCode, n, fairnessSeed).Scan(&sessionID); err != nil {
		return nil, err
	}

	const insertRoundQ = `INSERT INTO learning.battle_round (session_id, round_index, question_id)
		VALUES ($1::uuid, $2, $3::uuid)
		RETURNING id::text`
	roundIDs := make([]string, n)
	for i, q := range picked {
		if err := tx.QueryRow(ctx, insertRoundQ, sessionID, i, q.QuestionID).Scan(&roundIDs[i]); err != nil {
			return nil, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &CreatedBattle{
		SessionID: sessionID,
		RoomCode:  roomCode,
		Questions: picked,
		RoundIDs:  roundIDs,
	}, nil
}

// UpdateBotRoundWithScores persists a settled bot battle round and updates session scores.
func (s *PostgresBattleStore) UpdateBotRoundWithScores(ctx context.Context, u BotRoundUpdate) error {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	const roundQ = `UPDATE learning.battle_round
		SET user_option_key = $3, user_correct = $4, user_response_ms = $5,
			bot_option_key = $6, bot_correct = $7, bot_response_ms = $8,
			decided_at = $9
		WHERE id = $1::uuid AND session_id = $2::uuid`
	if _, err := tx.Exec(ctx, roundQ,
		u.RoundID, u.SessionID,
		u.UserOptionKey, u.UserCorrect, u.UserResponseMs,
		u.BotOptionKey, u.BotCorrect, u.BotResponseMs,
		u.DecidedAt,
	); err != nil {
		return err
	}

	const sessQ = `UPDATE learning.battle_session
		SET current_round_index = $2, user_score = $3, opponent_score = $4
		WHERE id = $1::uuid`
	if _, err := tx.Exec(ctx, sessQ, u.SessionID, u.NewCurrentRoundIdx, u.NextUserScore, u.NextOpponentScore); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// UpdatePvpRoundWithScores persists a settled PvP battle round and updates session scores.
func (s *PostgresBattleStore) UpdatePvpRoundWithScores(ctx context.Context, u PvpRoundUpdate) error {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	const roundQ = `UPDATE learning.battle_round
		SET user_option_key = $3, user_correct = $4, user_response_ms = $5,
			opponent_option_key = $6, opponent_correct = $7, opponent_response_ms = $8,
			decided_at = $9
		WHERE id = $1::uuid AND session_id = $2::uuid`
	if _, err := tx.Exec(ctx, roundQ,
		u.RoundID, u.SessionID,
		u.UserOptionKey, u.UserCorrect, u.UserResponseMs,
		u.OpponentOptionKey, u.OpponentCorrect, u.OpponentResponseMs,
		u.DecidedAt,
	); err != nil {
		return err
	}

	const sessQ = `UPDATE learning.battle_session
		SET current_round_index = $2, user_score = $3, opponent_score = $4
		WHERE id = $1::uuid`
	if _, err := tx.Exec(ctx, sessQ, u.SessionID, u.NewCurrentRoundIdx, u.NextUserScore, u.NextOpponentScore); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// MarkCompleted marks a battle_session as completed with final scores.
func (s *PostgresBattleStore) MarkCompleted(ctx context.Context, sessionID string, userScore, opponentScore int) error {
	const q = `UPDATE learning.battle_session
		SET status = 'completed', user_score = $2, opponent_score = $3, completed_at = NOW()
		WHERE id = $1::uuid AND status = 'in_progress'`
	_, err := s.db.Exec(ctx, q, sessionID, userScore, opponentScore)
	return err
}

// MarkAbandoned marks a battle_session as abandoned with a reason.
func (s *PostgresBattleStore) MarkAbandoned(ctx context.Context, sessionID, reason string) error {
	const q = `UPDATE learning.battle_session
		SET status = 'abandoned', abandoned_reason = $2, completed_at = NOW()
		WHERE id = $1::uuid AND status = 'in_progress'`
	_, err := s.db.Exec(ctx, q, sessionID, reason)
	return err
}

// CreateChatMessage persists a chat message in learning.battle_chat_message.
func (s *PostgresBattleStore) CreateChatMessage(ctx context.Context, roomKey, userID string, displayName *string, message, kind string, metadata map[string]any) (*LobbyMessage, error) {
	if roomKey == "" {
		roomKey = "global"
	}
	if kind == "" {
		kind = "chat"
	}
	var dn *string
	if displayName != nil {
		trimmed := strings.TrimSpace(*displayName)
		if r := []rune(trimmed); len(r) > 120 {
			trimmed = string(r[:120])
		}
		if trimmed != "" {
			dn = &trimmed
		}
	}
	msgRunes := []rune(message)
	if len(msgRunes) > 500 {
		message = string(msgRunes[:500])
	}
	metaBytes, err := json.Marshal(metadata)
	if err != nil || metadata == nil {
		metaBytes = []byte("{}")
	}
	const q = `INSERT INTO learning.battle_chat_message
		(room_key, user_id, display_name, message, kind, moderation_state, metadata)
		VALUES ($1, $2, $3, $4, $5, 'visible', $6::jsonb)
		RETURNING id::text, room_key, user_id, display_name, message, kind, created_at`
	var out LobbyMessage
	var createdAt time.Time
	if err := s.db.QueryRow(ctx, q, roomKey, userID, dn, message, kind, string(metaBytes)).Scan(
		&out.ID, &out.RoomKey, &out.UserID, &out.DisplayName, &out.Message, &out.Kind, &createdAt,
	); err != nil {
		return nil, err
	}
	out.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	return &out, nil
}

// CreateAnalyticsEvent records a battle analytics event in analytics.analytics_event.
func (s *PostgresBattleStore) CreateAnalyticsEvent(ctx context.Context, userID, eventName string, payload map[string]any) error {
	raw, err := json.Marshal(payload)
	if err != nil || payload == nil {
		raw = []byte("{}")
	}
	const q = `INSERT INTO analytics.analytics_event (user_id, event_name, source, payload, created_at)
		VALUES ($1::uuid, $2, 'api', $3::jsonb, NOW())`
	_, err = s.db.Exec(ctx, q, userID, eventName, string(raw))
	return err
}
