package magazine

import (
	"context"
	"testing"
	"time"
)

const dedupeKind = "magazine_dedupe_test"

// TestArchiveDuplicatesDryRunApplyAndRestore uses a private widget kind with:
//   - ten days alternating between titles A (even days) and B (odd days), all
//     with identical content_json  -> 4 + 4 duplicates
//   - one more "A" with different content_json          -> must stay published
//   - the same A/B pair as English articles             -> separate groups
//   - one draft "A" with the same content               -> must be ignored
func TestArchiveDuplicatesDryRunApplyAndRestore(t *testing.T) {
	tx := testTx(t)
	ctx := context.Background()
	start := time.Date(2099, 10, 1, 0, 0, 0, 0, time.UTC)

	insert := func(slug string, date time.Time, locale, title, content, status string) {
		t.Helper()
		if _, err := tx.Exec(ctx, `INSERT INTO daily.magazine_article
			(slug, widget_kind, content_date, locale, title_jp, title_vi, content_json, status)
			VALUES ($1,$2,$3,$4,$8,$5,$6::jsonb,$7)`, slug, dedupeKind, date, locale, title, content, status, "title "+slug); err != nil {
			t.Fatal(err)
		}
	}
	for d := 0; d < 10; d++ {
		date := start.AddDate(0, 0, d)
		title := "A"
		if date.Day()%2 == 1 {
			title = "B"
		}
		insert("vi-"+date.Format("2006-01-02"), date, "vi", title, `{"k":1}`, "published")
	}
	insert("vi-different-content", start.AddDate(0, 0, 20), "vi", "A", `{"k":2}`, "published")
	insert("en-a", start, "en", "A", `{"k":1}`, "published")
	insert("en-b", start.AddDate(0, 0, 1), "en", "B", `{"k":1}`, "published")
	insertOther := func(slug string, date time.Time) {
		t.Helper()
		if _, err := tx.Exec(ctx, `INSERT INTO daily.magazine_article
			(slug, widget_kind, content_date, locale, title_jp, title_vi, content_json, status)
			VALUES ($1,'magazine_dedupe_test_other',$2,'vi','x','A','{"k":1}'::jsonb,'published')`, slug, date); err != nil {
			t.Fatal(err)
		}
	}
	insertOther("other-1", start)
	insertOther("other-2", start.AddDate(0, 0, 1))
	insert("vi-draft", start.AddDate(0, 0, 30), "vi", "A", `{"k":1}`, "draft")

	statusOf := func(slug string) string {
		t.Helper()
		var s string
		if err := tx.QueryRow(ctx, `SELECT status FROM daily.magazine_article WHERE slug=$1`, slug).Scan(&s); err != nil {
			t.Fatalf("load %s: %v", slug, err)
		}
		return s
	}

	dupes, err := ArchiveDuplicates(ctx, tx, DedupeOptions{Kind: dedupeKind})
	if err != nil || len(dupes) != 8 {
		t.Fatalf("dry run found %d duplicates (err %v), want 8", len(dupes), err)
	}
	if got := statusOf("vi-2099-10-01"); got != "published" {
		t.Fatalf("dry run changed status to %q", got)
	}

	dupes, err = ArchiveDuplicates(ctx, tx, DedupeOptions{Kind: dedupeKind, Apply: true})
	if err != nil || len(dupes) != 8 {
		t.Fatalf("apply archived %d (err %v), want 8", len(dupes), err)
	}
	wantStatus := map[string]string{
		"vi-2099-10-10":        "published", // latest A
		"vi-2099-10-09":        "published", // latest B
		"vi-2099-10-08":        "archived",
		"vi-2099-10-01":        "archived",
		"vi-different-content": "published", // same title, different content: not a duplicate
		"en-a":                 "published", // other locale: separate group
		"en-b":                 "published",
		"vi-draft":             "draft",     // only published rows are considered
		"other-1":              "published", // other kind, outside -kind scope
	}
	for slug, want := range wantStatus {
		if got := statusOf(slug); got != want {
			t.Errorf("%s status = %q, want %q", slug, got, want)
		}
	}
	var total int
	if err := tx.QueryRow(ctx, `SELECT COUNT(*) FROM daily.magazine_article WHERE widget_kind=$1`, dedupeKind).Scan(&total); err != nil || total != 14 {
		t.Fatalf("rows after apply = %d (err %v), want 14: nothing may be deleted", total, err)
	}

	if again, err := ArchiveDuplicates(ctx, tx, DedupeOptions{Kind: dedupeKind, Apply: true}); err != nil || len(again) != 0 {
		t.Fatalf("second apply found %d duplicates (err %v), want 0", len(again), err)
	}

	// The documented restore statement undoes the archive.
	if _, err := tx.Exec(ctx, `UPDATE daily.magazine_article SET status='draft' WHERE slug='vi-2099-10-02'`); err != nil {
		t.Fatal(err)
	}
	if _, err := tx.Exec(ctx, `UPDATE daily.magazine_article SET status='published', source_data_json = source_data_json - 'dedupedAt'
		WHERE widget_kind=$1 AND status='archived' AND source_data_json ? 'dedupedAt'`, dedupeKind); err != nil {
		t.Fatal(err)
	}
	if got := statusOf("vi-2099-10-02"); got != "draft" {
		t.Fatalf("restore republished a row an admin moved to draft: %q", got)
	}
	if got := statusOf("vi-2099-10-01"); got != "published" {
		t.Fatalf("restore left status %q", got)
	}

	if _, err := tx.Exec(ctx, `UPDATE daily.magazine_article SET status='published' WHERE slug='vi-2099-10-02'`); err != nil {
		t.Fatal(err)
	}

	// KeepEarliest flips which article survives.
	if got, err := ArchiveDuplicates(ctx, tx, DedupeOptions{Kind: dedupeKind, KeepEarliest: true, Apply: true}); err != nil || len(got) != 8 {
		t.Fatalf("KeepEarliest archived %d (err %v), want 8", len(got), err)
	}
	if statusOf("vi-different-content") != "published" || statusOf("vi-draft") != "draft" {
		t.Fatal("KeepEarliest must not archive same-title/different-content or draft rows")
	}
	if statusOf("vi-2099-10-02") != "published" || statusOf("vi-2099-10-10") != "archived" {
		t.Fatal("KeepEarliest should keep the oldest A and archive the newest")
	}

	// Without -kind the whole table is considered.
	if _, err := tx.Exec(ctx, `UPDATE daily.magazine_article SET status='published', source_data_json = source_data_json - 'dedupedAt'
		WHERE widget_kind=$1 AND status='archived' AND source_data_json ? 'dedupedAt'`, dedupeKind); err != nil {
		t.Fatal(err)
	}
	all, err := ArchiveDuplicates(ctx, tx, DedupeOptions{})
	if err != nil {
		t.Fatal(err)
	}
	found, other := 0, 0
	for _, d := range all {
		if d.WidgetKind == dedupeKind {
			found++
		}
		if d.WidgetKind == "magazine_dedupe_test_other" {
			other++
		}
	}
	if found != 8 || other != 1 {
		t.Fatalf("unscoped run found %d/%d fixture duplicates, want 8/1", found, other)
	}
}
