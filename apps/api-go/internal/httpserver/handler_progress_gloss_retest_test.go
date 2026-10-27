package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

func TestRetestBJTAccuracyUsesQuestionTotals(t *testing.T) {
	db := testPool(t)
	ctx := context.Background()
	userID, otherID, testID := newUUID(t), newUUID(t), newUUID(t)
	seedActiveUser(t, db, userID, "Progress", fmt.Sprintf("%s@example.test", userID), "")
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, `DELETE FROM assessment.quiz_session WHERE test_id = $1`, testID)
		_, _ = db.Exec(ctx, `DELETE FROM assessment.bjt_mock_test WHERE id = $1`, testID)
		_, _ = db.Exec(ctx, `DELETE FROM auth.session WHERE user_id = $1`, userID)
		_, _ = db.Exec(ctx, `DELETE FROM profile.user_profile WHERE id = $1`, userID)
	})
	if _, err := db.Exec(ctx, `INSERT INTO assessment.bjt_mock_test (id, slug, title_vi, updated_at) VALUES ($1, $2, 'test', NOW())`, testID, testID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO assessment.quiz_session (user_id, test_id, status, correct_count, total_questions) VALUES ($1,$3,'completed',1,1),($1,$3,'completed',0,9),($1,$3,'active',1,1),($2,$3,'completed',1,1)`, userID, otherID, testID); err != nil {
		t.Fatal(err)
	}
	sessions := session.NewStore(db)
	token := createLearnerSession(t, sessions, userID)
	router := NewRouter(Dependencies{Config: &config.Config{CORSOrigins: []string{"http://localhost:3000"}}, Logger: testLogger(), DBPool: db, SessionStore: sessions})
	req := httptest.NewRequest(http.MethodGet, "/api/analytics/learner", nil)
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: token})
	response := httptest.NewRecorder()
	router.ServeHTTP(response, req)
	if response.Code != http.StatusOK {
		t.Fatalf("analytics status: %d %s", response.Code, response.Body.String())
	}
	var result struct {
		Totals struct {
			BjtAccuracyPct       float64
			CompletedBjtSessions int
		}
	}
	if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	if result.Totals.BjtAccuracyPct != 10 || result.Totals.CompletedBjtSessions != 2 {
		t.Fatalf("BJT accuracy must use question totals: %+v", result.Totals)
	}
}

func TestRetestExerciseRejectsInvalidGloss(t *testing.T) {
	db := testPool(t)
	ctx := context.Background()
	id := newUUID(t)
	if _, err := db.Exec(ctx, `INSERT INTO content.lexeme (id, headword, short_meaning_vi, jlpt_level, created_at, updated_at) VALUES ($1, '検査', 'tôi không thể dịch', 'N5', NOW(), NOW())`, id); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = db.Exec(ctx, `DELETE FROM content.lexeme WHERE id = $1`, id) })
	lexemes, err := selectExerciseLexemes(ctx, db, "N5", 10000)
	if err != nil {
		t.Fatal(err)
	}
	for _, lexeme := range lexemes {
		if lexeme.ID == id {
			t.Fatalf("exercise must reject invalid gloss: %q", lexeme.Meaning)
		}
	}
}

func TestRetestExercisePreservesAssignedCachedQuestion(t *testing.T) {
	db := testPool(t)
	ctx := context.Background()
	sourceID, oldID, sessionID := newUUID(t), newUUID(t), newUUID(t)
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, `DELETE FROM exercise.exercise_session WHERE id = $1`, sessionID)
		_, _ = db.Exec(ctx, `DELETE FROM exercise.exercise WHERE source_id = $1`, sourceID)
	})
	key := "meaning_match:lexeme:" + sourceID + ":primary-senses-v2"
	if _, err := db.Exec(ctx, `INSERT INTO exercise.exercise (id, generation_key, exercise_type, source_type, source_id, prompt, choices, correct_answer) VALUES ($1, $2, 'meaning_match', 'lexeme', $3, '{}', '[{"key":"A","text":"old"}]', '{"key":"A"}')`, oldID, key, sourceID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO exercise.exercise_session (id, user_id, session_type, exercise_type, status, exercise_ids) VALUES ($1, $2, 'practice_tab', 'meaning_match', 'in_progress', ARRAY[$3::uuid])`, sessionID, sourceID, oldID); err != nil {
		t.Fatal(err)
	}
	draft := exerciseDraft{sourceType: "lexeme", sourceID: sourceID, prompt: map[string]any{"text": "仕事"}, choices: []exerciseChoice{{Key: "A", Text: "công việc"}}, correctAnswer: map[string]string{"key": "A"}}
	generated, err := persistExerciseDrafts(ctx, db, "meaning_match", []exerciseDraft{draft})
	if err != nil {
		t.Fatal(err)
	}
	var unchanged bool
	if err := db.QueryRow(ctx, `SELECT exercise_ids = ARRAY[$2::uuid] AND (SELECT choices->0->>'text' FROM exercise.exercise WHERE id = $2) = 'old' FROM exercise.exercise_session WHERE id = $1`, sessionID, oldID).Scan(&unchanged); err != nil {
		t.Fatal(err)
	}
	if !unchanged || len(generated) != 1 || generated[0].ID == oldID {
		t.Fatalf("assigned exercise changed or reused: unchanged=%v generated=%+v", unchanged, generated)
	}
}

func TestRetestExerciseRejectsInvalidLaterSense(t *testing.T) {
	db := testPool(t)
	ctx := context.Background()
	id := newUUID(t)
	if _, err := db.Exec(ctx, `INSERT INTO content.lexeme (id, headword, short_meaning_vi, jlpt_level, created_at, updated_at) VALUES ($1, '仕事', 'công việc; 『猫』 là con mèo', 'BUG267', NOW(), NOW())`, id); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = db.Exec(ctx, `DELETE FROM content.lexeme WHERE id = $1`, id) })
	lexemes, err := selectExerciseLexemes(ctx, db, "BUG267", 10)
	if err != nil {
		t.Fatal(err)
	}
	for _, lexeme := range lexemes {
		if lexeme.ID == id {
			t.Fatalf("exercise must reject invalid later sense: %q", lexeme.Meaning)
		}
	}
}

func TestRetestExerciseFindsEnoughUsableGlosses(t *testing.T) {
	db := testPool(t)
	ctx := context.Background()
	poolConfig := db.Config().Copy()
	poolConfig.MaxConns = 1
	db, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(db.Close)
	prefix := newUUID(t)[:8]
	t.Cleanup(func() { _, _ = db.Exec(ctx, `DELETE FROM content.lexeme WHERE jlpt_level = $1`, prefix) })
	for i := 0; i < 100; i++ {
		meaning := "tôi không thể dịch"
		if i < 5 {
			meaning = fmt.Sprintf("nghĩa đúng %d", i)
		}
		if _, err := db.Exec(ctx, `INSERT INTO content.lexeme (headword, short_meaning_vi, jlpt_level, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())`, fmt.Sprintf("%s-%d", prefix, i), meaning, prefix); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := db.Exec(ctx, `SELECT setseed(0.5)`); err != nil {
		t.Fatal(err)
	}
	lexemes, err := selectExerciseLexemes(ctx, db, prefix, 5)
	if err != nil {
		t.Fatal(err)
	}
	if len(lexemes) != 5 {
		t.Fatalf("exercise must find usable glosses before limiting: got %d", len(lexemes))
	}
	for _, lexeme := range lexemes {
		if !dictionaryGlossUsable(lexeme.Headword, &lexeme.Meaning) {
			t.Fatalf("exercise must find usable glosses before limiting: invalid %q", lexeme.Meaning)
		}
	}
}
