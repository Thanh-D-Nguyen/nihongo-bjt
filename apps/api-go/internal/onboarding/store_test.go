package onboarding

import (
	"context"
	"errors"
	"os"
	"reflect"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func onboardingFixture(t *testing.T) (*pgxpool.Pool, string) {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Fatal("TEST_DATABASE_URL required; run with scripts/quality/with-test-db.sh")
	}
	ctx := context.Background()
	db, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatalf("connect canonical test database: %v", err)
	}
	t.Cleanup(db.Close)
	var userID string
	if err := db.QueryRow(ctx, `INSERT INTO profile.user_profile
		(display_name, theme_mode, updated_at) VALUES ('Onboarding test', 'dark', NOW()) RETURNING id`).Scan(&userID); err != nil {
		t.Fatalf("seed canonical profile: %v", err)
	}
	t.Cleanup(func() {
		for _, q := range []string{
			`DELETE FROM profile.learner_onboarding WHERE user_id = $1`,
			`DELETE FROM profile.user_profile WHERE id = $1`,
		} {
			if _, err := db.Exec(ctx, q, userID); err != nil {
				t.Errorf("cleanup onboarding fixture: %v", err)
			}
		}
	})
	return db, userID
}

func TestMarkSkipped_CanonicalCompletion(t *testing.T) {
	db, userID := onboardingFixture(t)
	ctx := context.Background()
	store := NewStore(db)
	if completed, err := store.HasCompleted(ctx, userID); err != nil || completed {
		t.Fatalf("new learner must not be completed: %v, %v", completed, err)
	}
	if err := store.MarkSkipped(ctx, userID); err != nil {
		t.Fatalf("skip must persist canonical onboarded_at: %v", err)
	}
	var first time.Time
	if err := db.QueryRow(ctx, `SELECT onboarded_at FROM profile.learner_onboarding WHERE user_id = $1`, userID).Scan(&first); err != nil || first.IsZero() {
		t.Fatalf("skip must write completion timestamp: %v, %v", first, err)
	}
	if err := store.MarkSkipped(ctx, userID); err != nil {
		t.Fatalf("repeat skip must succeed: %v", err)
	}
	var repeated time.Time
	if err := db.QueryRow(ctx, `SELECT onboarded_at FROM profile.learner_onboarding WHERE user_id = $1`, userID).Scan(&repeated); err != nil || !first.Equal(repeated) {
		t.Fatalf("repeat skip must preserve original completion timestamp: %v, %v", repeated, err)
	}
	// A fresh store must read durable completion, not process-local state.
	if completed, err := NewStore(db).HasCompleted(ctx, userID); err != nil || !completed {
		t.Fatalf("skip completion must survive reload: %v, %v", completed, err)
	}
	if prefs, err := store.GetPreferences(ctx, userID); !errors.Is(err, ErrNotFound) || prefs != nil {
		t.Fatalf("skip must not fabricate questionnaire answers: %+v, %v", prefs, err)
	}
}

func TestSavePreferences_CanonicalRoundTrip(t *testing.T) {
	db, userID := onboardingFixture(t)
	ctx := context.Background()
	store := NewStore(db)
	input := SaveInput{CurrentLevel: 3, Goal: "pass_bjt", Topics: []string{"business_japanese", "tech"}, DailyMinutes: 30, Style: "practice"}
	saved, err := store.SavePreferences(ctx, userID, input)
	if err != nil {
		t.Fatalf("save must persist canonical profile preferences: %v", err)
	}
	if saved.UserID != userID || saved.CurrentLevel != input.CurrentLevel || saved.Goal != input.Goal || !reflect.DeepEqual(saved.Topics, input.Topics) || saved.DailyMinutes != input.DailyMinutes || saved.Style != input.Style || !saved.Completed || saved.CreatedAt.IsZero() || saved.UpdatedAt.IsZero() {
		t.Fatalf("saved answers mismatch: %+v", saved)
	}
	loaded, err := NewStore(db).GetPreferences(ctx, userID)
	if err != nil || !reflect.DeepEqual(saved, loaded) {
		t.Fatalf("preferences must survive reload: saved=%+v loaded=%+v err=%v", saved, loaded, err)
	}
	var level, minutes int
	var goal, style, theme string
	var topics []string
	if err := db.QueryRow(ctx, `SELECT onboarding_current_level, learning_purpose, onboarding_topics,
		daily_study_minutes, learning_personality, theme_mode FROM profile.user_profile WHERE id = $1`, userID).
		Scan(&level, &goal, &topics, &minutes, &style, &theme); err != nil {
		t.Fatalf("read persisted canonical preference fields: %v", err)
	}
	if level != input.CurrentLevel || goal != input.Goal || !reflect.DeepEqual(topics, input.Topics) || minutes != input.DailyMinutes || style != input.Style || theme != "dark" {
		t.Fatalf("profile mapping or unrelated preferences changed: %d %s %v %d %s %s", level, goal, topics, minutes, style, theme)
	}
	if completed, err := store.HasCompleted(ctx, userID); err != nil || !completed {
		t.Fatalf("saved preferences must complete onboarding: %v, %v", completed, err)
	}
	if err := store.MarkSkipped(ctx, userID); err != nil {
		t.Fatalf("skip after save: %v", err)
	}
	afterSkip, err := store.GetPreferences(ctx, userID)
	if err != nil || !reflect.DeepEqual(saved, afterSkip) {
		t.Fatalf("skip must preserve existing preferences: %+v, %v", afterSkip, err)
	}
	updated := SaveInput{CurrentLevel: 0, Goal: "daily_conversation", DailyMinutes: 5, Style: "mixed"}
	result, err := store.SavePreferences(ctx, userID, updated)
	if err != nil {
		t.Fatalf("update preferences: %v", err)
	}
	if result.CurrentLevel != 0 || result.Goal != updated.Goal || result.Topics == nil || len(result.Topics) != 0 || result.DailyMinutes != updated.DailyMinutes || result.Style != updated.Style || !result.Completed || !result.CreatedAt.Equal(saved.CreatedAt) {
		t.Fatalf("updated answers mismatch or nil topics not normalized: %+v", result)
	}
	loaded, err = NewStore(db).GetPreferences(ctx, userID)
	if err != nil || !reflect.DeepEqual(result, loaded) {
		t.Fatalf("updated preferences must survive reload: %+v, %v", loaded, err)
	}
}

func TestGetPreferences_CanonicalMissing(t *testing.T) {
	db, userID := onboardingFixture(t)
	if prefs, err := NewStore(db).GetPreferences(context.Background(), userID); !errors.Is(err, ErrNotFound) || prefs != nil {
		t.Fatalf("canonical missing preferences must return ErrNotFound: %+v, %v", prefs, err)
	}
}
