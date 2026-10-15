package gamification

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

func streakTestPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set; requires the canonical PostgreSQL schema")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatalf("connect test DB: %v", err)
	}
	t.Cleanup(pool.Close)
	return pool
}

func TestGetAndRecordStreaksUseCanonicalSchema(t *testing.T) {
	db := streakTestPool(t)
	ctx := context.Background()
	userID := uuid.NewString()
	if _, err := db.Exec(ctx,
		`INSERT INTO profile.user_profile (id, display_name, email, status, updated_at) VALUES ($1, 'Streak Test', $2, 'active', now())`,
		userID, userID+"@example.test"); err != nil {
		t.Fatalf("seed test learner: %v", err)
	}
	t.Cleanup(func() { _, _ = db.Exec(context.Background(), `DELETE FROM profile.user_profile WHERE id = $1`, userID) })

	configID := uuid.NewString()
	if _, err := db.Exec(ctx,
		`INSERT INTO gamification.streak_config (id, name, activity_type, freezes_allowed, updated_at) VALUES ($1, 'Test streak', 'lesson', 2, now())`,
		configID); err != nil {
		t.Fatalf("seed streak config: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM gamification.streak_config WHERE id = $1`, configID)
	})

	store := NewStore(db)
	data, err := store.GetStreaks(ctx, userID)
	if err != nil {
		t.Fatalf("get streaks: %v", err)
	}
	if len(data.Streaks) != 1 || data.Streaks[0].ConfigID != configID || data.Streaks[0].CurrentStreak != 0 {
		t.Fatalf("unexpected initial streaks: %+v", data.Streaks)
	}
	if err := store.RecordActivity(ctx, userID, "lesson"); err != nil {
		t.Fatalf("record activity: %v", err)
	}
	data, err = store.GetStreaks(ctx, userID)
	if err != nil {
		t.Fatalf("get streaks after activity: %v", err)
	}
	if got := data.Streaks[0]; got.CurrentStreak != 1 || got.LongestStreak != 1 || got.LastActiveDate == nil {
		t.Fatalf("activity did not persist in canonical streak fields: %+v", got)
	}
}

func TestStartFocusSessionUsesCanonicalStudySession(t *testing.T) {
	db := streakTestPool(t)
	ctx := context.Background()
	userID := uuid.NewString()
	store := NewStore(db)
	otherSessionID := uuid.NewString()
	if _, err := db.Exec(ctx, `INSERT INTO learning.study_session (id, user_id, duration_minutes, mode, started_at, ended_at, completed)
		VALUES ($1, $2, 60, 'quiz', NOW(), NOW(), true)`, otherSessionID, userID); err != nil {
		t.Fatalf("insert completed non-focus session: %v", err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO learning.study_session (id, user_id, duration_minutes, mode, started_at, completed)
		VALUES ($1, $2, 60, 'lesson', NOW(), false)`, uuid.NewString(), userID); err != nil {
		t.Fatalf("insert active non-focus session: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.study_session WHERE user_id = $1`, userID)
	})
	session, err := store.StartFocusSession(ctx, userID, 25, "focus")
	if err != nil {
		t.Fatalf("start focus session: %v", err)
	}
	if session.DurationMinutes != 25 || session.SessionID == "" {
		t.Fatalf("unexpected focus session: %+v", session)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.study_session WHERE id = $1`, session.SessionID)
	})

	state, err := store.GetFocusToday(ctx, userID)
	if err != nil || state.ActiveSession == nil || state.ActiveSession.SessionID != session.SessionID || state.TodaySessions != 0 || state.TodayMinutes != 0 {
		t.Fatalf("focus summary should ignore other study modes: state=%+v err=%v", state, err)
	}
	if err := store.EndFocusSession(ctx, userID, otherSessionID, true); !errors.Is(err, ErrNotFound) {
		t.Fatalf("focus endpoint must not close a quiz session, got %v", err)
	}
	if err := store.EndFocusSession(ctx, userID, session.SessionID, false); err != nil {
		t.Fatalf("stop focus session: %v", err)
	}
	state, err = store.GetFocusToday(ctx, userID)
	if err != nil || state.ActiveSession != nil || state.TodaySessions != 0 {
		t.Fatalf("stopped session should not remain active or count as complete: state=%+v err=%v", state, err)
	}

	completedSession, err := store.StartFocusSession(ctx, userID, 15, "focus")
	if err != nil {
		t.Fatalf("start second focus session: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.study_session WHERE id = $1`, completedSession.SessionID)
	})
	if err := store.EndFocusSession(ctx, userID, completedSession.SessionID, true); err != nil {
		t.Fatalf("complete focus session: %v", err)
	}
	state, err = store.GetFocusToday(ctx, userID)
	if err != nil || state.TodayMinutes != 15 || state.TodaySessions != 1 || state.ActiveSession != nil {
		t.Fatalf("completed session summary does not match persisted state: state=%+v err=%v", state, err)
	}
}
