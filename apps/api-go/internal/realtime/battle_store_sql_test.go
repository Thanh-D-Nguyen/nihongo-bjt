package realtime

// SQL conformance for PostgresBattleStore: every statement runs against the
// canonical schema (TEST_DATABASE_URL), so column names, casts, FK order and
// NOT NULL constraints are proven, not assumed. Each test seeds and removes
// its own rows; nothing depends on pre-existing battle data.

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type sqlBattleSeed struct {
	testID      string
	questionIDs []string
}

// seedPublishedBattleQuestions inserts a published mock test with n published
// questions (4 options each, option A correct) and removes it on cleanup.
func seedPublishedBattleQuestions(t *testing.T, db *pgxpool.Pool, n int) sqlBattleSeed {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	seed := sqlBattleSeed{}
	slug := "battle-sql-" + newTestUUID(t)
	if err := db.QueryRow(ctx,
		`INSERT INTO assessment.bjt_mock_test (slug, title_vi, status, updated_at)
		 VALUES ($1, 'Battle SQL', 'published', now()) RETURNING id::text`, slug).Scan(&seed.testID); err != nil {
		t.Fatalf("seed mock test: %v", err)
	}
	t.Cleanup(func() {
		cctx, ccancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer ccancel()
		// battle_round.question_id is ON DELETE RESTRICT: drop sessions first.
		_, _ = db.Exec(cctx, `DELETE FROM learning.battle_session WHERE id IN (
			SELECT r.session_id FROM learning.battle_round r WHERE r.question_id = ANY($1::uuid[]))`, seed.questionIDs)
		_, _ = db.Exec(cctx, `DELETE FROM assessment.bjt_mock_test WHERE id = $1::uuid`, seed.testID)
	})
	var sectionID string
	if err := db.QueryRow(ctx,
		`INSERT INTO assessment.bjt_test_section (test_id, code, title_vi, display_order)
		 VALUES ($1::uuid, 'S1', 'Section', 1) RETURNING id::text`, seed.testID).Scan(&sectionID); err != nil {
		t.Fatalf("seed section: %v", err)
	}
	for i := 0; i < n; i++ {
		var qid string
		if err := db.QueryRow(ctx,
			`INSERT INTO assessment.bjt_question (section_id, prompt, explanation_vi, skill_tag, status, updated_at)
			 VALUES ($1::uuid, $2, 'giải thích', '敬語', 'published', now()) RETURNING id::text`,
			sectionID, fmt.Sprintf("問題%d", i)).Scan(&qid); err != nil {
			t.Fatalf("seed question: %v", err)
		}
		seed.questionIDs = append(seed.questionIDs, qid)
		for _, key := range []string{"A", "B", "C", "D"} {
			if _, err := db.Exec(ctx,
				`INSERT INTO assessment.bjt_question_option (question_id, option_key, text, is_correct)
				 VALUES ($1::uuid, $2, $3, $4)`, qid, key, "選択肢"+key, key == "A"); err != nil {
				t.Fatalf("seed option: %v", err)
			}
		}
	}
	return seed
}

func TestPostgresBattleStore_SQLConformance_BotLifecycle(t *testing.T) {
	db := realtimeTestPool(t)
	store := NewPostgresBattleStore(db)
	seedPublishedBattleQuestions(t, db, 3)
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	userID := newTestUUID(t)

	created, err := store.CreateBotBattle(ctx, userID, "bot_j1", "seed-sql-1", 2)
	if err != nil {
		t.Fatalf("CreateBotBattle: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.battle_session WHERE id = $1::uuid`, created.SessionID)
	})
	if len(created.Questions) == 0 || len(created.Questions) > 2 || len(created.RoundIDs) != len(created.Questions) {
		t.Fatalf("unexpected created battle: %d questions, %d rounds", len(created.Questions), len(created.RoundIDs))
	}
	for _, q := range created.Questions {
		if len(q.Options) != 4 || q.CorrectOptionKey() == "" {
			t.Fatalf("question %s options/correct key not loaded: %+v", q.QuestionID, q.Options)
		}
	}

	var mode, status string
	var botKey *string
	var maxRounds int
	if err := db.QueryRow(ctx,
		`SELECT mode, status, bot_key, max_rounds FROM learning.battle_session WHERE id = $1::uuid`,
		created.SessionID).Scan(&mode, &status, &botKey, &maxRounds); err != nil {
		t.Fatalf("read session: %v", err)
	}
	if mode != "bot" || status != "in_progress" || botKey == nil || *botKey != "bot_j1" || maxRounds != len(created.Questions) {
		t.Fatalf("session row = %s/%s/%v/%d", mode, status, botKey, maxRounds)
	}

	optKey := "A"
	if err := store.UpdateBotRoundWithScores(ctx, BotRoundUpdate{
		SessionID: created.SessionID, RoundID: created.RoundIDs[0], UserID: userID,
		NewCurrentRoundIdx: 1, NextUserScore: 1, NextOpponentScore: 0,
		UserOptionKey: &optKey, UserCorrect: true, UserResponseMs: 1200,
		BotOptionKey: "B", BotCorrect: false, BotResponseMs: 800, DecidedAt: time.Now(),
	}); err != nil {
		t.Fatalf("UpdateBotRoundWithScores: %v", err)
	}
	var uCorrect, bCorrect *bool
	var uMs, bMs *int
	var decided *time.Time
	if err := db.QueryRow(ctx,
		`SELECT user_correct, bot_correct, user_response_ms, bot_response_ms, decided_at
		 FROM learning.battle_round WHERE id = $1::uuid`, created.RoundIDs[0]).Scan(&uCorrect, &bCorrect, &uMs, &bMs, &decided); err != nil {
		t.Fatalf("read round: %v", err)
	}
	if uCorrect == nil || !*uCorrect || bCorrect == nil || *bCorrect || uMs == nil || *uMs != 1200 || bMs == nil || *bMs != 800 || decided == nil {
		t.Fatalf("round row not persisted correctly: %v %v %v %v %v", uCorrect, bCorrect, uMs, bMs, decided)
	}

	if err := store.MarkCompleted(ctx, created.SessionID, 1, 0); err != nil {
		t.Fatalf("MarkCompleted: %v", err)
	}
	var us, os int
	var completedAt *time.Time
	if err := db.QueryRow(ctx,
		`SELECT status, user_score, opponent_score, completed_at FROM learning.battle_session WHERE id = $1::uuid`,
		created.SessionID).Scan(&status, &us, &os, &completedAt); err != nil {
		t.Fatalf("read completed session: %v", err)
	}
	if status != "completed" || us != 1 || os != 0 || completedAt == nil {
		t.Fatalf("completed session = %s %d-%d %v", status, us, os, completedAt)
	}
}

func TestPostgresBattleStore_SQLConformance_PvpAbandonAndConfig(t *testing.T) {
	db := realtimeTestPool(t)
	store := NewPostgresBattleStore(db)
	seedPublishedBattleQuestions(t, db, 2)
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	userID, opponentID := newTestUUID(t), newTestUUID(t)

	created, err := store.CreatePvpBattle(ctx, userID, opponentID, "seed-sql-pvp", 2)
	if err != nil {
		t.Fatalf("CreatePvpBattle: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.battle_session WHERE id = $1::uuid`, created.SessionID)
	})
	var mode string
	var opp *string
	if err := db.QueryRow(ctx,
		`SELECT mode, opponent_user_id::text FROM learning.battle_session WHERE id = $1::uuid`,
		created.SessionID).Scan(&mode, &opp); err != nil {
		t.Fatalf("read pvp session: %v", err)
	}
	if mode != "pvp" || opp == nil || *opp != opponentID {
		t.Fatalf("pvp session mode/opponent = %s/%v", mode, opp)
	}

	userKey, oppKey := "A", "C"
	if err := store.UpdatePvpRoundWithScores(ctx, PvpRoundUpdate{
		SessionID: created.SessionID, RoundID: created.RoundIDs[0],
		NewCurrentRoundIdx: 1, NextUserScore: 1, NextOpponentScore: 0,
		UserOptionKey: &userKey, UserCorrect: true, UserResponseMs: 900,
		OpponentOptionKey: &oppKey, OpponentCorrect: false, OpponentResponseMs: 1500, DecidedAt: time.Now(),
	}); err != nil {
		t.Fatalf("UpdatePvpRoundWithScores: %v", err)
	}
	var oc *bool
	var ok *string
	if err := db.QueryRow(ctx,
		`SELECT opponent_correct, opponent_option_key FROM learning.battle_round WHERE id = $1::uuid`,
		created.RoundIDs[0]).Scan(&oc, &ok); err != nil {
		t.Fatalf("read pvp round: %v", err)
	}
	if oc == nil || *oc || ok == nil || *ok != "C" {
		t.Fatalf("pvp opponent columns = %v %v", oc, ok)
	}

	// AbandonInProgressForUser only abandons bot sessions; a live PvP session keeps its result.
	staleBot, err := store.CreateBotBattle(ctx, userID, "bot_j1", "seed-sql-stale", 1)
	if err != nil {
		t.Fatalf("CreateBotBattle(stale): %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.battle_session WHERE id = $1::uuid`, staleBot.SessionID)
	})
	if err := store.AbandonInProgressForUser(ctx, userID, "superseded"); err != nil {
		t.Fatalf("AbandonInProgressForUser: %v", err)
	}
	var status string
	var reason *string
	if err := db.QueryRow(ctx,
		`SELECT status, abandoned_reason FROM learning.battle_session WHERE id = $1::uuid`,
		staleBot.SessionID).Scan(&status, &reason); err != nil {
		t.Fatalf("read abandoned bot session: %v", err)
	}
	if status != "abandoned" || reason == nil || *reason != "superseded" {
		t.Fatalf("stale bot session = %s %v, want abandoned/superseded", status, reason)
	}
	if err := db.QueryRow(ctx,
		`SELECT status FROM learning.battle_session WHERE id = $1::uuid`, created.SessionID).Scan(&status); err != nil || status != "in_progress" {
		t.Fatalf("pvp session must stay in_progress, got %q err=%v", status, err)
	}

	// MarkCompleted/MarkAbandoned never overwrite a session that already left in_progress.
	if err := store.MarkCompleted(ctx, staleBot.SessionID, 3, 1); err != nil {
		t.Fatalf("MarkCompleted(already abandoned): %v", err)
	}
	if err := db.QueryRow(ctx,
		`SELECT status FROM learning.battle_session WHERE id = $1::uuid`, staleBot.SessionID).Scan(&status); err != nil || status != "abandoned" {
		t.Fatalf("abandoned session reverted to %q (err=%v)", status, err)
	}

	// MarkAbandoned on an explicit session id.
	again, err := store.CreateBotBattle(ctx, userID, "bot_j1", "seed-sql-2", 1)
	if err != nil {
		t.Fatalf("CreateBotBattle: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.battle_session WHERE id = $1::uuid`, again.SessionID)
	})
	if err := store.MarkAbandoned(ctx, again.SessionID, "invalid_attempts"); err != nil {
		t.Fatalf("MarkAbandoned: %v", err)
	}
	if err := db.QueryRow(ctx,
		`SELECT status, abandoned_reason FROM learning.battle_session WHERE id = $1::uuid`,
		again.SessionID).Scan(&status, &reason); err != nil || status != "abandoned" || reason == nil || *reason != "invalid_attempts" {
		t.Fatalf("MarkAbandoned row = %s %v err=%v", status, reason, err)
	}

	// Unknown / draft config resolves to nil, not an error.
	cfg, err := store.GetPublishedConfig(ctx, newTestUUID(t))
	if err != nil || cfg != nil {
		t.Fatalf("GetPublishedConfig(unknown) = %v, %v; want nil, nil", cfg, err)
	}
}

func TestPostgresBattleStore_SQLConformance_BotChatAndAnalytics(t *testing.T) {
	db := realtimeTestPool(t)
	store := NewPostgresBattleStore(db)
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	// Registry fallback for a key with no DB row; unknown key is nil, not an error.
	bot, err := store.GetPlayableBot(ctx, "bot_j1")
	if err != nil || bot == nil || bot.BotKey != "bot_j1" {
		t.Fatalf("GetPlayableBot(bot_j1) = %+v, %v", bot, err)
	}
	if missing, err := store.GetPlayableBot(ctx, "bot_does_not_exist"); err != nil || missing != nil {
		t.Fatalf("GetPlayableBot(unknown) = %+v, %v; want nil, nil", missing, err)
	}

	// A DB-defined bot with NULL persona/rive_src and 'auto' rive metadata.
	dbKey := "bot_sql_" + newTestUUID(t)[:8]
	if _, err := db.Exec(ctx,
		`INSERT INTO learning.battle_bot (name, difficulty, accuracy_pct, min_delay_ms, max_delay_ms, vocabulary_level, status, bot_key, updated_at)
		 VALUES ('SQL Bot', 'easy', 55, 300, 900, 'bjt_core', 'active', $1, now())`, dbKey); err != nil {
		t.Fatalf("seed bot: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.battle_bot WHERE bot_key = $1`, dbKey)
	})
	got, err := store.GetPlayableBot(ctx, dbKey)
	if err != nil || got == nil {
		t.Fatalf("GetPlayableBot(db bot) = %+v, %v", got, err)
	}
	if got.Label != "SQL Bot" || got.AccuracyPct != 55 || got.MinDelayMs != 300 || got.MaxDelayMs != 900 {
		t.Fatalf("db bot fields = %+v", got)
	}
	if got.StyleToken != "focused" {
		t.Fatalf("db bot style token = %q, want focused", got.StyleToken)
	}
	if _, err := db.Exec(ctx, `UPDATE learning.battle_bot SET status = 'archived' WHERE bot_key = $1`, dbKey); err != nil {
		t.Fatalf("archive bot: %v", err)
	}
	if archived, err := store.GetPlayableBot(ctx, dbKey); err != nil || archived != nil {
		t.Fatalf("archived bot must not be playable: %+v, %v", archived, err)
	}

	// Chat: truncation to 500 runes, default room, display name trimming.
	userID := newTestUUID(t)
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.battle_chat_message WHERE user_id = $1`, userID)
		_, _ = db.Exec(context.Background(), `DELETE FROM analytics.analytics_event WHERE user_id = $1::uuid`, userID)
	})
	name := "  Taro  "
	long := make([]rune, 600)
	for i := range long {
		long[i] = '日'
	}
	msg, err := store.CreateChatMessage(ctx, "", userID, &name, string(long), "", nil)
	if err != nil {
		t.Fatalf("CreateChatMessage: %v", err)
	}
	if msg.RoomKey != "global" || msg.Kind != "chat" || msg.DisplayName == nil || *msg.DisplayName != "Taro" || len([]rune(msg.Message)) != 500 {
		t.Fatalf("chat message = %+v (len %d)", msg, len([]rune(msg.Message)))
	}
	if _, perr := time.Parse(time.RFC3339, msg.CreatedAt); perr != nil {
		t.Fatalf("CreatedAt not RFC3339: %q", msg.CreatedAt)
	}

	if err := store.CreateAnalyticsEvent(ctx, userID, "battle_started", map[string]any{"mode": "bot"}); err != nil {
		t.Fatalf("CreateAnalyticsEvent: %v", err)
	}
	var n int
	if err := db.QueryRow(ctx,
		`SELECT count(*) FROM analytics.analytics_event WHERE user_id = $1::uuid AND event_name = 'battle_started' AND payload->>'mode' = 'bot'`,
		userID).Scan(&n); err != nil || n != 1 {
		t.Fatalf("analytics event rows = %d err=%v", n, err)
	}
}
