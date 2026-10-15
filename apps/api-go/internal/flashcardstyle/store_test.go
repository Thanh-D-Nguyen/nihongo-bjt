package flashcardstyle

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"reflect"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

func flashcardStyleFixture(t *testing.T) (*pgxpool.Pool, string) {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Fatal("TEST_DATABASE_URL required; run with scripts/quality/with-test-db.sh")
	}
	db, err := pgxpool.New(context.Background(), url)
	if err != nil {
		t.Fatalf("connect canonical test database: %v", err)
	}
	t.Cleanup(db.Close)
	var userID string
	if err := db.QueryRow(context.Background(), `INSERT INTO profile.user_profile
		(display_name, status, updated_at) VALUES ('Flashcard style test', 'active', NOW()) RETURNING id`).Scan(&userID); err != nil {
		t.Fatalf("seed canonical profile: %v", err)
	}
	t.Cleanup(func() {
		if _, err := db.Exec(context.Background(), `DELETE FROM profile.user_profile WHERE id = $1`, userID); err != nil {
			t.Errorf("clean up profile fixture: %v", err)
		}
	})
	return db, userID
}

func insertFlashcardStyleFixture(t *testing.T, db *pgxpool.Pool, status string, config string) string {
	t.Helper()
	slug := "audit-128-" + uuid.NewString()
	if _, err := db.Exec(context.Background(), `INSERT INTO learning.flashcard_style
		(slug, name_key, config, tier, status) VALUES ($1, $2, $3::jsonb, 'free', $4)`,
		slug, "flashcard.styles."+status, config, status); err != nil {
		t.Fatalf("insert canonical %s style fixture: %v", status, err)
	}
	t.Cleanup(func() {
		if _, err := db.Exec(context.Background(), `DELETE FROM learning.flashcard_style WHERE slug = $1`, slug); err != nil {
			t.Errorf("clean up %s style fixture: %v", status, err)
		}
	})
	return slug
}

func assertStyleConfig(t *testing.T, got json.RawMessage, want string) {
	t.Helper()
	var gotValue, wantValue any
	if err := json.Unmarshal(got, &gotValue); err != nil {
		t.Fatalf("decode returned style config %q: %v", got, err)
	}
	if err := json.Unmarshal([]byte(want), &wantValue); err != nil {
		t.Fatalf("decode expected style config: %v", err)
	}
	if !reflect.DeepEqual(gotValue, wantValue) {
		t.Fatalf("style config = %s; want exact config %s", got, want)
	}
}

func TestListForLearner_ActiveAdminStyleAndConfig(t *testing.T) {
	db, userID := flashcardStyleFixture(t)
	const activeConfig = `{"background":"#f8fafc","foreground":"#172554","accent":"#2563eb"}`
	activeSlug := insertFlashcardStyleFixture(t, db, "active", activeConfig)
	draftSlug := insertFlashcardStyleFixture(t, db, "draft", `{"background":"#fff"}`)
	archivedSlug := insertFlashcardStyleFixture(t, db, "archived", `{"background":"#000"}`)

	styles, err := NewStore(db).ListForLearner(context.Background(), userID)
	if err != nil {
		t.Fatalf("list active learner styles from canonical schema: %v", err)
	}
	foundActive := false
	for _, style := range styles {
		switch style.Slug {
		case activeSlug:
			foundActive = true
			if style.Status != "active" {
				t.Errorf("active style status = %q; want active", style.Status)
			}
			assertStyleConfig(t, style.Config, activeConfig)
		case draftSlug, archivedSlug:
			t.Errorf("learner list included non-active style %q with status %q", style.Slug, style.Status)
		}
	}
	if !foundActive {
		t.Errorf("learner list omitted active Admin-managed style %q", activeSlug)
	}
}

func TestGetActiveStyle_ReturnsSelectedSlugAndConfig(t *testing.T) {
	db, userID := flashcardStyleFixture(t)
	const config = `{"background":"#fff7ed","foreground":"#431407","accent":"#ea580c"}`
	slug := insertFlashcardStyleFixture(t, db, "active", config)
	if _, err := db.Exec(context.Background(), `UPDATE profile.user_profile SET flashcard_style_slug = $1 WHERE id = $2`, slug, userID); err != nil {
		t.Fatalf("select canonical style preference: %v", err)
	}

	active, err := NewStore(db).GetActiveStyle(context.Background(), userID)
	if err != nil {
		t.Fatalf("get selected style from canonical schema: %v", err)
	}
	if active.Slug == nil || *active.Slug != slug {
		t.Fatalf("active slug = %v; want %q", active.Slug, slug)
	}
	assertStyleConfig(t, active.Config, config)
}

func TestSetActiveStyle_PersistsResetsAndRejectsUnavailableStyles(t *testing.T) {
	db, userID := flashcardStyleFixture(t)
	const config = `{"background":"#f0fdf4","foreground":"#14532d","accent":"#16a34a"}`
	activeSlug := insertFlashcardStyleFixture(t, db, "active", config)
	draftSlug := insertFlashcardStyleFixture(t, db, "draft", `{"background":"#fff"}`)
	archivedSlug := insertFlashcardStyleFixture(t, db, "archived", `{"background":"#000"}`)
	store := NewStore(db)
	ctx := context.Background()

	selected, err := store.SetActiveStyle(ctx, userID, &activeSlug)
	if err != nil {
		t.Fatalf("set active style: %v", err)
	}
	if selected.Slug == nil || *selected.Slug != activeSlug {
		t.Fatalf("set response slug = %v; want %q", selected.Slug, activeSlug)
	}
	assertStyleConfig(t, selected.Config, config)
	var persistedSlug *string
	if err := db.QueryRow(ctx, `SELECT flashcard_style_slug FROM profile.user_profile WHERE id = $1`, userID).Scan(&persistedSlug); err != nil {
		t.Fatalf("read persisted style preference: %v", err)
	}
	if persistedSlug == nil || *persistedSlug != activeSlug {
		t.Fatalf("persisted slug = %v; want %q", persistedSlug, activeSlug)
	}

	reset, err := store.SetActiveStyle(ctx, userID, nil)
	if err != nil {
		t.Fatalf("reset active style: %v", err)
	}
	if reset.Slug != nil {
		t.Fatalf("reset response slug = %v; want nil", reset.Slug)
	}
	assertStyleConfig(t, reset.Config, `{}`)
	if err := db.QueryRow(ctx, `SELECT flashcard_style_slug FROM profile.user_profile WHERE id = $1`, userID).Scan(&persistedSlug); err != nil {
		t.Fatalf("read reset style preference: %v", err)
	}
	if persistedSlug != nil {
		t.Fatalf("persisted reset slug = %v; want nil", persistedSlug)
	}

	if _, err := store.SetActiveStyle(ctx, userID, &activeSlug); err != nil {
		t.Fatalf("restore prior style before rejection checks: %v", err)
	}
	for _, unavailable := range []struct {
		name string
		slug string
	}{
		{name: "missing", slug: "audit-128-missing-" + uuid.NewString()},
		{name: "draft", slug: draftSlug},
		{name: "archived", slug: archivedSlug},
	} {
		t.Run(unavailable.name, func(t *testing.T) {
			if result, err := store.SetActiveStyle(ctx, userID, &unavailable.slug); !errors.Is(err, ErrNotFound) || result != nil {
				t.Fatalf("set unavailable style returned (%+v, %v); want (nil, ErrNotFound)", result, err)
			}
			var after *string
			if err := db.QueryRow(ctx, `SELECT flashcard_style_slug FROM profile.user_profile WHERE id = $1`, userID).Scan(&after); err != nil {
				t.Fatalf("read preference after rejected style: %v", err)
			}
			if after == nil || *after != activeSlug {
				t.Fatalf("rejected style changed preference to %v; want prior slug %q", after, activeSlug)
			}
		})
	}
}
