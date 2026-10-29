package loto

import (
	"context"
	"encoding/json"
	"errors"
	"math/rand"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type fakeSource struct {
	draws map[Game][]Draw
	err   error
	calls int
}

func (f *fakeSource) Fetch(_ context.Context, game Game) ([]Draw, string, error) {
	f.calls++
	if f.err != nil {
		return nil, "", f.err
	}
	return append([]Draw(nil), f.draws[game]...), "https://loto6.thekyo.jp/data/loto6.csv", nil
}

// testTx runs the service inside a transaction that is always rolled back, so
// the shared integration database never sees (or keeps) the fixture rows.
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
		InvalidateCaches()
	})
	for _, stmt := range []string{
		`DELETE FROM daily.magazine_article WHERE widget_kind='magazine_loto6'`,
		`DELETE FROM daily.loto_generation_run WHERE game='loto6'`,
		`DELETE FROM daily.loto_draw WHERE game='loto6'`,
	} {
		if _, err := tx.Exec(ctx, stmt); err != nil {
			t.Fatalf("reset loto6 fixtures: %v", err)
		}
	}
	InvalidateCaches()
	return tx
}

// scheduledHistory builds count Loto6 draws ending on lastKey, walking back
// through the real Monday/Thursday calendar.
func scheduledHistory(t *testing.T, count int, lastKey string) []Draw {
	t.Helper()
	spec := SpecFor(Loto6)
	rng := rand.New(rand.NewSource(7))
	cursor, err := ParseDateKey(lastKey)
	if err != nil {
		t.Fatal(err)
	}
	draws := make([]Draw, count)
	for i := count - 1; i >= 0; i-- {
		for !IsScheduledDrawDate(Loto6, cursor.Format(dateLayout)) {
			cursor = cursor.AddDate(0, 0, -1)
		}
		perm := rng.Perm(spec.MaxNumber)
		draw := Draw{Game: Loto6, Number: i + 1, DateKey: cursor.Format(dateLayout), Main: perm[:6], Bonus: perm[6:7]}
		for j := range draw.Main {
			draw.Main[j]++
		}
		draw.Bonus[0]++
		if err := ValidateDraw(&draw); err != nil {
			t.Fatalf("history draw invalid: %v", err)
		}
		draws[i] = draw
		cursor = cursor.AddDate(0, 0, -1)
	}
	return draws
}

func countRows(t *testing.T, tx pgx.Tx, query string, args ...any) int {
	t.Helper()
	var n int
	if err := tx.QueryRow(context.Background(), query, args...).Scan(&n); err != nil {
		t.Fatalf("count rows (%s): %v", query, err)
	}
	return n
}

func TestAutopilotImportsPublishesOncePerDrawAndRecovers(t *testing.T) {
	tx := testTx(t)
	ctx := context.Background()
	source := &fakeSource{draws: map[Game][]Draw{Loto6: scheduledHistory(t, 40, "2026-10-26")}}
	now := time.Date(2026, 10, 28, 3, 0, 0, 0, time.UTC) // Wed 12:00 JST, before the Thursday draw
	svc := &Service{DB: tx, Source: source, Now: func() time.Time { return now }}

	first, err := svc.RunAutopilot(ctx, Loto6)
	if err != nil {
		t.Fatalf("first autopilot tick: %v", err)
	}
	if first.Status != AutopilotPublish || first.TargetDrawDate != "2026-10-29" || first.RunID == "" || len(first.PublishedSet) != 6 {
		t.Fatalf("first tick = %+v, want a published set for 2026-10-29", first)
	}
	if first.Imported == nil || first.Imported.Created != 40 {
		t.Fatalf("import = %+v, want 40 created draws", first.Imported)
	}
	if first.Backtests != BacktestWindow {
		t.Fatalf("backtests = %d, want %d", first.Backtests, BacktestWindow)
	}
	if got := countRows(t, tx, `SELECT COUNT(*) FROM daily.loto_generation_run WHERE game='loto6' AND status='published' AND target_draw_date='2026-10-29'`); got != 1 {
		t.Fatalf("published runs for the target = %d, want 1", got)
	}
	var content []byte
	if err := tx.QueryRow(ctx, `SELECT content_json FROM daily.magazine_article WHERE widget_kind='magazine_loto6' AND content_date='2026-10-29' AND status='published'`).Scan(&content); err != nil {
		t.Fatalf("published article missing: %v", err)
	}
	var article struct {
		DrawNumber       int      `json:"drawNumber"`
		DrawTime         string   `json:"drawTime"`
		Sets             []any    `json:"sets"`
		JapaneseSentence Sentence `json:"japaneseSentence"`
	}
	if err := json.Unmarshal(content, &article); err != nil {
		t.Fatalf("decode article content: %v", err)
	}
	if article.DrawNumber != 41 || article.DrawTime != "18:45 JST" || len(article.Sets) != 1 || article.JapaneseSentence.TextJP == "" || len(article.JapaneseSentence.VocabItems) < 3 {
		t.Fatalf("article content = %+v", article)
	}

	// A repeat tick is a no-op: no new import rows, no second run, no new backtests.
	second, err := svc.RunAutopilot(ctx, Loto6)
	if err != nil || second.Status != AutopilotDone || second.RunID != first.RunID || second.Backtests != 0 {
		t.Fatalf("repeat tick = %+v, %v; want already_done for the same run", second, err)
	}
	if second.Imported == nil || second.Imported.Created != 0 {
		t.Fatalf("repeat import = %+v, want nothing created", second.Imported)
	}
	if got := countRows(t, tx, `SELECT COUNT(*) FROM daily.loto_generation_run WHERE game='loto6'`); got != 1+BacktestWindow {
		t.Fatalf("total runs = %d, want 1 published + %d backtests", got, BacktestWindow)
	}

	// A crash between generation and publication is resumed on the next tick.
	if _, err := tx.Exec(ctx, `UPDATE daily.loto_generation_run SET status='generated' WHERE id=$1`, first.RunID); err != nil {
		t.Fatal(err)
	}
	if _, err := tx.Exec(ctx, `DELETE FROM daily.magazine_article WHERE widget_kind='magazine_loto6'`); err != nil {
		t.Fatal(err)
	}
	third, err := svc.RunAutopilot(ctx, Loto6)
	if err != nil || third.Status != AutopilotPublish || third.RunID != first.RunID {
		t.Fatalf("recovery tick = %+v, %v; want the half-done run republished", third, err)
	}

	// A mirror outage must not stop work existing data already allows.
	source.err = errors.New("mirror down")
	fourth, err := svc.RunAutopilot(ctx, Loto6)
	if err != nil || fourth.Status != AutopilotDone || fourth.SyncError == "" || fourth.Imported != nil {
		t.Fatalf("outage tick = %+v, %v; want already_done with a recorded sync error", fourth, err)
	}

	// After the draw the result is still missing: wait instead of publishing.
	source.err = nil
	now = time.Date(2026, 10, 29, 10, 30, 0, 0, time.UTC) // Thu 19:30 JST
	waiting, err := svc.RunAutopilot(ctx, Loto6)
	if err != nil || waiting.Status != AutopilotWaiting || waiting.TargetDrawDate != "2026-10-29" {
		t.Fatalf("draw-day tick = %+v, %v; want waiting_result", waiting, err)
	}

	// Once the result arrives, the next draw gets its own run.
	history := scheduledHistory(t, 41, "2026-10-29")
	source.draws[Loto6] = history
	now = time.Date(2026, 10, 29, 14, 0, 0, 0, time.UTC) // Thu 23:00 JST
	next, err := svc.RunAutopilot(ctx, Loto6)
	if err != nil || next.Status != AutopilotPublish || next.TargetDrawDate != "2026-11-02" || next.RunID == first.RunID {
		t.Fatalf("post-result tick = %+v, %v; want a new run for 2026-11-02", next, err)
	}
}

func TestStatsMeasureBacktestHistoryAgainstChance(t *testing.T) {
	tx := testTx(t)
	ctx := context.Background()
	source := &fakeSource{draws: map[Game][]Draw{Loto6: scheduledHistory(t, 40, "2026-10-26")}}
	svc := &Service{DB: tx, Source: source, Now: func() time.Time { return time.Date(2026, 10, 28, 3, 0, 0, 0, time.UTC) }}
	if _, err := svc.RunAutopilot(ctx, Loto6); err != nil {
		t.Fatalf("autopilot: %v", err)
	}
	stats, err := svc.Stats(ctx, Loto6)
	if err != nil {
		t.Fatalf("stats: %v", err)
	}
	if stats.TotalDraws != 40 || len(stats.Frequency) != 43 || stats.LatestDraw != "2026-10-26" {
		t.Fatalf("stats header = %+v", stats)
	}
	if stats.Accuracy.Samples != BacktestWindow || stats.Accuracy.BacktestSamples != BacktestWindow || stats.Accuracy.PublishedSamples != 0 {
		t.Fatalf("accuracy accounting = %+v; the unplayed 2026-10-29 set must not be scored", stats.Accuracy)
	}
	if stats.Accuracy.BaselineHits != 0.8372 || len(stats.RecentDraws) != 10 || stats.RecentDraws[0].DrawNumber != 40 {
		t.Fatalf("baseline/recent = %v / %+v", stats.Accuracy.BaselineHits, stats.RecentDraws)
	}

	// The cache must refresh as soon as the data changes.
	if _, err := tx.Exec(ctx, `DELETE FROM daily.loto_draw WHERE game='loto6' AND draw_number=40`); err != nil {
		t.Fatal(err)
	}
	refreshed, err := svc.Stats(ctx, Loto6)
	if err != nil || refreshed.TotalDraws != 39 {
		t.Fatalf("stats after deleting a draw = %d draws, %v; want 39", refreshed.TotalDraws, err)
	}
}

func TestPublishRunRejectsBadSelections(t *testing.T) {
	tx := testTx(t)
	ctx := context.Background()
	svc := &Service{DB: tx, Now: func() time.Time { return time.Date(2026, 10, 28, 3, 0, 0, 0, time.UTC) }}
	run, err := svc.GenerateRun(ctx, tx, GenerateRequest{Game: Loto6, TargetDateKey: "2026-10-29", SetCount: 2, Seed: "publish"})
	if err != nil || len(run.Sets) != 2 {
		t.Fatalf("generate: %v sets=%d", err, len(run.Sets))
	}
	// Each attempt runs in its own savepoint, as the HTTP handler's transaction would be rolled back.
	attempt := func(runID string, setIDs []string) error {
		savepoint, err := tx.Begin(ctx)
		if err != nil {
			t.Fatalf("savepoint: %v", err)
		}
		defer func() { _ = savepoint.Rollback(ctx) }()
		_, err = PublishRun(ctx, savepoint, runID, setIDs, "", svc.now())
		return err
	}
	if err := attempt(run.ID, nil); !errors.Is(err, ErrNoSets) {
		t.Errorf("empty selection: %v, want ErrNoSets", err)
	}
	if err := attempt("not-a-uuid", []string{run.Sets[0].ID}); !errors.Is(err, ErrRunNotFound) {
		t.Errorf("malformed run id: %v, want ErrRunNotFound", err)
	}
	if err := attempt(run.ID, []string{run.Sets[0].ID, run.Sets[0].ID}); !errors.Is(err, ErrDuplicateSet) {
		t.Errorf("duplicate set: %v, want ErrDuplicateSet", err)
	}
	if err := attempt(run.ID, []string{"00000000-0000-4000-8000-000000000000"}); !errors.Is(err, ErrSetNotInRun) {
		t.Errorf("foreign set: %v, want ErrSetNotInRun", err)
	}
	if err := attempt(run.ID, []string{run.Sets[1].ID}); err != nil {
		t.Errorf("valid selection: %v", err)
	}
}

func TestJobCountReconcileAndCuratedRunsAreRespected(t *testing.T) {
	tx := testTx(t)
	ctx := context.Background()
	source := &fakeSource{draws: map[Game][]Draw{Loto6: scheduledHistory(t, 40, "2026-10-26")}}
	now := time.Date(2026, 10, 28, 3, 0, 0, 0, time.UTC)
	svc := &Service{DB: tx, Source: source, Now: func() time.Time { return now }}

	// An admin already published this draw: the autopilot must not replace it.
	curated, err := svc.GenerateRun(ctx, tx, GenerateRequest{Game: Loto6, TargetDateKey: "2026-10-29", SetCount: 1, Seed: "curated"})
	if err != nil {
		t.Fatalf("generate curated run: %v", err)
	}
	if _, err := svc.GenerateRun(ctx, tx, GenerateRequest{Game: Loto6, TargetDateKey: "2026-10-29", SetCount: 1, Seed: "x"}); err != nil {
		t.Fatalf("second run: %v", err)
	}
	if _, err := PublishRun(ctx, tx, curated.ID, []string{curated.Sets[0].ID}, "", now); err != nil {
		t.Fatalf("publish curated: %v", err)
	}
	if n, err := svc.JobCount(ctx, Loto6); n != 0 || err != nil {
		t.Fatalf("job over a curated draw = %d, %v; want 0 (nothing replaced)", n, err)
	}
	if got := countRows(t, tx, `SELECT COUNT(*) FROM daily.loto_generation_run WHERE game='loto6' AND autopilot_key='loto6:2026-10-29'`); got != 0 {
		t.Fatalf("autopilot created %d runs next to the curated one", got)
	}

	// Without a curated run the job publishes and reports it.
	if _, err := tx.Exec(ctx, `DELETE FROM daily.loto_generation_run WHERE game='loto6' AND status<>'backtest'`); err != nil {
		t.Fatal(err)
	}
	if n, err := svc.JobCount(ctx, Loto6); n != 1 || err != nil {
		t.Fatalf("job = %d, %v; want one published set", n, err)
	}

	// While waiting for a result that the mirror cannot deliver, the job must fail loudly.
	now = time.Date(2026, 10, 29, 10, 30, 0, 0, time.UTC)
	source.err = errors.New("mirror down")
	if n, err := svc.JobCount(ctx, Loto6); n != 0 || err == nil {
		t.Fatalf("waiting job with a dead mirror = %d, %v; want an error", n, err)
	}

	source.err = nil
	source.draws[Loto7] = nil
	results := svc.Reconcile(ctx)
	if len(results) != 2 || results[Loto6].Status != AutopilotWaiting || results[Loto7].Status != AutopilotWaiting {
		t.Fatalf("reconcile = %+v, want both games reported", results)
	}
}

func TestStatsCountEachDrawOnceWhenSeveralRunsTargetIt(t *testing.T) {
	tx := testTx(t)
	ctx := context.Background()
	source := &fakeSource{draws: map[Game][]Draw{Loto6: scheduledHistory(t, 30, "2026-10-26")}}
	svc := &Service{DB: tx, Source: source, Now: func() time.Time { return time.Date(2026, 10, 28, 3, 0, 0, 0, time.UTC) }}
	if _, err := svc.SyncGame(ctx, Loto6); err != nil {
		t.Fatal(err)
	}
	for _, status := range []string{RunPublished, RunBacktest} {
		run, err := svc.GenerateRun(ctx, tx, GenerateRequest{Game: Loto6, TargetDateKey: "2026-10-26", SetCount: 1, Seed: status, SelectTop: true})
		if err != nil {
			t.Fatal(err)
		}
		if _, err := tx.Exec(ctx, `UPDATE daily.loto_generation_run SET status=$2 WHERE id=$1`, run.ID, status); err != nil {
			t.Fatal(err)
		}
	}
	stats, err := svc.Stats(ctx, Loto6)
	if err != nil {
		t.Fatal(err)
	}
	if stats.Accuracy.Samples != 1 || stats.Accuracy.PublishedSamples != 1 || stats.Accuracy.BacktestSamples != 0 {
		t.Fatalf("accuracy = %+v, want one sample from the published run", stats.Accuracy)
	}
}

func TestPublishingSupersedesOtherPublishedRunsForTheSameDraw(t *testing.T) {
	tx := testTx(t)
	ctx := context.Background()
	source := &fakeSource{draws: map[Game][]Draw{Loto6: scheduledHistory(t, 40, "2026-10-26")}}
	now := time.Date(2026, 10, 28, 3, 0, 0, 0, time.UTC)
	svc := &Service{DB: tx, Source: source, Now: func() time.Time { return now }}

	first, err := svc.RunAutopilot(ctx, Loto6)
	if err != nil || first.Status != AutopilotPublish {
		t.Fatalf("autopilot: %+v, %v", first, err)
	}
	admin, err := svc.GenerateRun(ctx, tx, GenerateRequest{Game: Loto6, TargetDateKey: "2026-10-29", SetCount: 1, Seed: "admin-override"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := PublishRun(ctx, tx, admin.ID, []string{admin.Sets[0].ID}, "", now); err != nil {
		t.Fatalf("admin publish: %v", err)
	}
	var autopilotStatus, adminStatus string
	if err := tx.QueryRow(ctx, `SELECT status FROM daily.loto_generation_run WHERE id=$1`, first.RunID).Scan(&autopilotStatus); err != nil {
		t.Fatal(err)
	}
	if err := tx.QueryRow(ctx, `SELECT status FROM daily.loto_generation_run WHERE id=$1`, admin.ID).Scan(&adminStatus); err != nil {
		t.Fatal(err)
	}
	if autopilotStatus != "superseded" || adminStatus != RunPublished {
		t.Fatalf("autopilot run=%s admin run=%s, want superseded and published", autopilotStatus, adminStatus)
	}
	again, err := svc.RunAutopilot(ctx, Loto6)
	if err != nil || again.Status != AutopilotDone {
		t.Fatalf("autopilot after supersede = %+v, %v; want already_done", again, err)
	}
	if got := countRows(t, tx, `SELECT COUNT(*) FROM daily.loto_generation_run WHERE game='loto6' AND target_draw_date='2026-10-29' AND status='published'`); got != 1 {
		t.Fatalf("published runs for the draw = %d, want exactly the admin run", got)
	}
}
