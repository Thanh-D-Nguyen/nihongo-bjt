package magazine

import (
	"context"
	"fmt"
	"time"
)

// Duplicate is a published article whose content is identical to another
// published article of the same kind and locale.
type Duplicate struct {
	ID          string
	Slug        string
	WidgetKind  string
	ContentDate time.Time
}

// DedupeOptions selects which duplicates are archived.
type DedupeOptions struct {
	// Kind restricts the run to one widget kind; empty means every kind.
	Kind string
	// KeepEarliest keeps the oldest article of each group instead of the newest.
	KeepEarliest bool
	// Apply archives the duplicates; false only reports them.
	Apply bool
}

// Grouping ignores title_jp on purpose: vocab articles prefix it with the
// publish date, so it differs between otherwise identical articles.
const findDuplicates = `
	WITH ranked AS (
		SELECT id::text AS id, slug, widget_kind, content_date,
		       row_number() OVER (
		         PARTITION BY widget_kind, locale, title_vi, md5(content_json::text)
		         ORDER BY CASE WHEN $2 THEN content_date END ASC,
		                  CASE WHEN NOT $2 THEN content_date END DESC,
		                  id
		       ) AS rn
		FROM daily.magazine_article
		WHERE status='published' AND ($1='' OR widget_kind=$1)
	)
	SELECT id, slug, widget_kind, content_date FROM ranked WHERE rn>1
	ORDER BY widget_kind, content_date`

// ArchiveDuplicates finds published articles that repeat another article
// (same kind, locale, Vietnamese title and content_json) and, when opts.Apply
// is set, marks every one but a single survivor per group as archived.
//
// Nothing is deleted, so learners' read history survives, and the change is
// reversible: archived rows carry source_data_json.dedupedAt and can be put
// back with
//
//	UPDATE daily.magazine_article SET status='published', source_data_json = source_data_json - 'dedupedAt'
//	WHERE status='archived' AND source_data_json ? 'dedupedAt'
//
// The lookup and the update share one transaction (a dry run is a separate
// read, so rows changing in between can make the two differ).
func ArchiveDuplicates(ctx context.Context, db Beginner, opts DedupeOptions) ([]Duplicate, error) {
	tx, err := db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(context.WithoutCancel(ctx)) }()

	// rn = 1 is the survivor; every other row in its group is a duplicate.
	rows, err := tx.Query(ctx, findDuplicates, opts.Kind, opts.KeepEarliest)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var dupes []Duplicate
	for rows.Next() {
		var d Duplicate
		if err := rows.Scan(&d.ID, &d.Slug, &d.WidgetKind, &d.ContentDate); err != nil {
			return nil, err
		}
		dupes = append(dupes, d)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	rows.Close()

	if !opts.Apply || len(dupes) == 0 {
		return dupes, nil
	}
	ids := make([]string, len(dupes))
	for i, d := range dupes {
		ids[i] = d.ID
	}
	tag, err := tx.Exec(ctx, `UPDATE daily.magazine_article
		SET status='archived',
		    source_data_json = COALESCE(source_data_json,'{}'::jsonb)
		        || jsonb_build_object('dedupedAt', to_char(now(),'YYYY-MM-DD"T"HH24:MI:SSOF')),
		    updated_at=now()
		WHERE id = ANY($1::uuid[]) AND status='published'`, ids)
	if err != nil {
		return nil, err
	}
	if int(tag.RowsAffected()) != len(dupes) {
		return nil, fmt.Errorf("archived %d rows, expected %d (rows changed concurrently)", tag.RowsAffected(), len(dupes))
	}
	return dupes, tx.Commit(ctx)
}
