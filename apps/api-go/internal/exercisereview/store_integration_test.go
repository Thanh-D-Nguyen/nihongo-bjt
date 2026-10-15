package exercisereview

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestStoreUsesCanonicalExerciseSchema(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set; run with scripts/quality/with-test-db.sh")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	db, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatalf("connect test database: %v", err)
	}
	defer db.Close()

	var userID, exerciseID string
	err = db.QueryRow(ctx, `INSERT INTO exercise.exercise
		(exercise_type, source_type, source_id, prompt, choices, correct_answer, explanation, level)
		VALUES ('meaning_match', 'lexeme', gen_random_uuid(), '{"text":"仕事"}', '[{"key":"A","text":"công việc"}]', '{"key":"A"}', 'công việc', 'N3')
		RETURNING id::text`).Scan(&exerciseID)
	if err != nil {
		t.Fatalf("create exercise fixture: %v", err)
	}
	if err := db.QueryRow(ctx, `INSERT INTO exercise.exercise_review_state (user_id, exercise_id, updated_at)
		VALUES (gen_random_uuid(), $1, NOW()) RETURNING user_id::text`, exerciseID).Scan(&userID); err != nil {
		t.Fatalf("create review fixture: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM exercise.exercise_review_state WHERE user_id = $1`, userID)
		_, _ = db.Exec(context.Background(), `DELETE FROM exercise.exercise WHERE id = $1`, exerciseID)
	})

	store := NewStore(db)
	due, err := store.GetDueExercises(ctx, userID, 20)
	if err != nil {
		t.Fatalf("get due exercises: %v", err)
	}
	if len(due) != 1 || due[0].ExerciseID != exerciseID || due[0].State != "new" {
		t.Fatalf("unexpected due exercises: %+v", due)
	}
	if due[0].Exercise.ID != exerciseID || due[0].Exercise.Prompt == nil || due[0].Exercise.Explanation == nil || *due[0].Exercise.Explanation != "công việc" || due[0].Exercise.Level == nil || *due[0].Exercise.Level != "N3" {
		t.Fatalf("due exercise is missing question content: %+v", due[0].Exercise)
	}

	state, err := store.GetReviewState(ctx, userID, exerciseID)
	if err != nil || state == nil || state.State != "new" {
		t.Fatalf("get review state = %+v, %v; want new state", state, err)
	}

	// Use a fixed past timestamp so host/container clock skew cannot make a
	// due fixture appear in the future during the subsequent NOW() query.
	want := ReviewState{UserID: userID, ExerciseID: exerciseID, State: "learning", EaseFactor: 2.3, IntervalDays: 1, Repetitions: 1, Lapses: 1, DueAt: time.Date(2000, time.January, 1, 0, 0, 0, 0, time.UTC)}
	if err := store.UpsertReviewState(ctx, want); err != nil {
		t.Fatalf("upsert review state: %v", err)
	}
	state, err = store.GetReviewState(ctx, userID, exerciseID)
	if err != nil || state == nil || state.State != want.State || state.Lapses != want.Lapses {
		t.Fatalf("updated review state = %+v, %v; want %+v", state, err, want)
	}
	due, err = store.GetDueExercises(ctx, userID, 20)
	if err != nil || len(due) != 1 || due[0].State != want.State {
		t.Fatalf("updated due exercises = %+v, %v; want one learning state", due, err)
	}
}
