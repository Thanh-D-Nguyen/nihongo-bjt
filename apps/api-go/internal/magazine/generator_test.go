package magazine

import (
	"bytes"
	"context"
	"errors"
	"io"
	"log/slog"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// testTx returns a transaction that is always rolled back, so the shared
// integration database never keeps the fixture rows.
func testTx(t *testing.T) pgx.Tx {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set; skipping integration test")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatalf("connect test database: %v", err)
	}
	tx, err := pool.Begin(ctx)
	if err != nil {
		pool.Close()
		t.Fatalf("begin test transaction: %v", err)
	}
	t.Cleanup(func() {
		_ = tx.Rollback(context.Background())
		pool.Close()
	})
	return tx
}

// TestGenerateForDateContinuesLegacyHistoryThenReportsRepeat pins the rotation
// itself: rows written before pool keys existed (title match only) must count
// as used, the single unused entry must be picked, and once the pool is
// exhausted nothing is published and a WARN is logged.
func TestGenerateForDateContinuesLegacyHistoryThenReportsRepeat(t *testing.T) {
	tx := testTx(t)
	ctx := context.Background()
	var logs bytes.Buffer
	gen, err := NewGenerator(tx, slog.New(slog.NewTextHandler(&logs, nil)))
	if err != nil {
		t.Fatal(err)
	}
	pool := gen.pools[KindVocab]
	if len(pool) < 2 {
		t.Fatalf("vocab pool too small for this test: %d", len(pool))
	}
	legacyStart := time.Date(2098, 1, 1, 0, 0, 0, 0, time.UTC)
	// Every entry except the last was published earlier by the old seed (no poolKey).
	for i, e := range pool[:len(pool)-1] {
		if _, err := tx.Exec(ctx, `INSERT INTO daily.magazine_article
			(slug, widget_kind, content_date, locale, title_jp, title_vi, content_json, status)
			VALUES ($1,$2,$3,'vi',$4,$5,'{}','published')`,
			"legacy-test-"+e.Key, KindVocab, legacyStart.AddDate(0, 0, i), e.TitleJp, e.TitleVi); err != nil {
			t.Fatal(err)
		}
	}

	loadKey := func(date time.Time) (string, bool) {
		t.Helper()
		var key string
		err := tx.QueryRow(ctx, `SELECT source_data_json->>'poolKey' FROM daily.magazine_article
			WHERE widget_kind=$1 AND content_date=$2 AND locale='vi'`, KindVocab, date).Scan(&key)
		if errors.Is(err, pgx.ErrNoRows) {
			return "", false
		}
		if err != nil {
			t.Fatalf("load %s: %v", date.Format("2006-01-02"), err)
		}
		return key, true
	}

	next := legacyStart.AddDate(0, 0, len(pool))
	if _, err := gen.GenerateForDate(ctx, next); err != nil {
		t.Fatal(err)
	}
	if key, ok := loadKey(next); !ok || key != pool[len(pool)-1].Key {
		t.Fatalf("first generated = %q (found %v), want the one unused entry %q", key, ok, pool[len(pool)-1].Key)
	}

	// Pool is now exhausted: nothing is published and a WARN says why.
	following := next.AddDate(0, 0, 1)
	if _, err := gen.GenerateForDate(ctx, following); err != nil {
		t.Fatal(err)
	}
	if key, ok := loadKey(following); ok {
		t.Fatalf("published %q after the pool was exhausted; want no repeat", key)
	}
	if !strings.Contains(logs.String(), "content pool exhausted") {
		t.Fatalf("expected an exhaustion WARN, logs: %q", logs.String())
	}
}

func TestGenerateForDateRotatesAndIsIdempotent(t *testing.T) {
	tx := testTx(t)
	ctx := context.Background()
	gen, err := NewGenerator(tx, slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil {
		t.Fatal(err)
	}
	// Far-future dates cannot collide with real content.
	start := time.Date(2099, 3, 2, 0, 0, 0, 0, time.UTC) // a Monday

	titles := map[string]bool{}
	for day := 0; day < 3; day++ {
		date := start.AddDate(0, 0, day)
		if _, err := gen.GenerateForDate(ctx, date); err != nil {
			t.Fatalf("day %d: %v", day, err)
		}
		again, err := gen.GenerateForDate(ctx, date)
		if err != nil || again != 0 {
			t.Fatalf("day %d rerun created %d (err %v), want 0", day, again, err)
		}
		var title string
		if err := tx.QueryRow(ctx, `SELECT title_vi FROM daily.magazine_article
			WHERE widget_kind=$1 AND content_date=$2 AND locale='vi'`, KindVocab, date).Scan(&title); err != nil {
			t.Fatalf("day %d: load vocab article: %v", day, err)
		}
		if titles[title] {
			t.Fatalf("day %d repeated vocab article %q", day, title)
		}
		titles[title] = true
	}

	// BJT phrases are a weekday feature: present on the Monday, absent on the Saturday.
	countKind := func(kind string, date time.Time) int {
		t.Helper()
		var n int
		if err := tx.QueryRow(ctx, `SELECT COUNT(*) FROM daily.magazine_article
			WHERE widget_kind=$1 AND content_date=$2`, kind, date).Scan(&n); err != nil {
			t.Fatal(err)
		}
		return n
	}
	if got := countKind(KindBJTPhrase, start); got != 1 {
		t.Fatalf("BJT articles on the Monday = %d, want 1", got)
	}
	saturday := start.AddDate(0, 0, 5)
	if _, err := gen.GenerateForDate(ctx, saturday); err != nil {
		t.Fatal(err)
	}
	if got := countKind(KindVocab, saturday); got != 1 {
		t.Fatalf("vocab articles on the Saturday = %d, want 1", got)
	}
	if got := countKind(KindBJTPhrase, saturday); got != 0 {
		t.Fatalf("BJT articles on the Saturday = %d, want 0", got)
	}
	if got := countKind(KindWeather, start); got != 0 {
		t.Fatalf("weather articles = %d, want 0 while weather is unscheduled", got)
	}

	var items, quizzes int
	if err := tx.QueryRow(ctx, `SELECT
		(SELECT COUNT(*) FROM daily.magazine_vocab_item v JOIN daily.magazine_article a ON a.id=v.article_id WHERE a.content_date=$1),
		(SELECT COUNT(*) FROM daily.magazine_quiz q JOIN daily.magazine_article a ON a.id=q.article_id WHERE a.content_date=$1)`,
		start).Scan(&items, &quizzes); err != nil {
		t.Fatal(err)
	}
	if items == 0 || quizzes == 0 {
		t.Fatalf("expected vocab items and quizzes, got %d / %d", items, quizzes)
	}
}
