package magazine

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

// historyLimit bounds how many past article rows are read per kind to find
// what was already published. It is a row count (rows matching no pool entry
// count too), so it must stay well above the pool size plus legacy rows.
const historyLimit = 500

// defaultLocale is the locale the daily articles are authored in.
const defaultLocale = "vi"

// Beginner starts a transaction; both *pgxpool.Pool and pgx.Tx satisfy it,
// which lets tests run the generator inside a rolled-back transaction.
type Beginner interface {
	Begin(ctx context.Context) (pgx.Tx, error)
}

// Generator publishes one rotated article per scheduled kind.
type Generator struct {
	db     Beginner
	logger *slog.Logger
	pools  map[string][]Entry
}

// NewGenerator builds a Generator over the embedded content pools.
func NewGenerator(db Beginner, logger *slog.Logger) (*Generator, error) {
	pools, err := LoadPools()
	if err != nil {
		return nil, err
	}
	return &Generator{db: db, logger: logger, pools: pools}, nil
}

// GenerateForDate publishes the scheduled kinds for date and returns how many
// articles were created. It is idempotent: a kind that already has an article
// for (kind, date, locale) is left untouched.
func (g *Generator) GenerateForDate(ctx context.Context, date time.Time) (int, error) {
	date = time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, time.UTC)
	created := 0
	var errs []error
	for _, kind := range ScheduledKinds {
		if !ShouldGenerate(kind, date) {
			continue
		}
		// One failing kind must not cost the other kinds their day: the
		// scheduler does not retry.
		ok, err := g.generateKind(ctx, kind, date)
		if err != nil {
			errs = append(errs, fmt.Errorf("generate %s for %s: %w", kind, date.Format("2006-01-02"), err))
			continue
		}
		if ok {
			created++
		}
	}
	return created, errors.Join(errs...)
}

func (g *Generator) generateKind(ctx context.Context, kind string, date time.Time) (bool, error) {
	pool := g.pools[kind]
	if len(pool) == 0 {
		return false, fmt.Errorf("empty content pool for %s", kind)
	}
	tx, err := g.db.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer func() { _ = tx.Rollback(context.WithoutCancel(ctx)) }()

	var existing bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM daily.magazine_article
		WHERE widget_kind=$1 AND content_date=$2 AND locale=$3)`, kind, date, defaultLocale).Scan(&existing); err != nil {
		return false, err
	}
	if existing {
		return false, nil
	}

	recent, err := g.recentKeys(ctx, tx, kind, pool)
	if err != nil {
		return false, err
	}
	entry, repeat := Pick(pool, recent, int(date.Unix()/86400))
	if repeat {
		// Publishing a repeat would recreate the duplicates this job exists to
		// avoid; skip the day until new entries are added to the pool.
		g.logger.WarnContext(ctx, "magazine_generation: content pool exhausted, skipping publish (add entries to the pool)",
			"kind", kind, "poolSize", len(pool), "date", date.Format("2006-01-02"))
		return false, nil
	}

	id, err := insertArticle(ctx, tx, kind, date, entry, len(pool))
	if err != nil {
		return false, err
	}
	if id == "" {
		return false, nil // lost a race with another writer; nothing to do
	}
	return true, tx.Commit(ctx)
}

// recentKeys returns the pool keys published for kind, most recent
// first. Rows written before pool keys existed are matched back to their pool
// entry by Vietnamese title.
func (g *Generator) recentKeys(ctx context.Context, tx pgx.Tx, kind string, pool []Entry) ([]string, error) {
	byTitle := make(map[string]string, len(pool))
	for _, e := range pool {
		byTitle[e.TitleVi] = e.Key
	}
	rows, err := tx.Query(ctx, `SELECT COALESCE(source_data_json->>'poolKey',''), title_vi
		FROM daily.magazine_article
		WHERE widget_kind=$1 AND locale=$2
		ORDER BY content_date DESC, created_at DESC LIMIT $3`, kind, defaultLocale, historyLimit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var keys []string
	for rows.Next() {
		var key, title string
		if err := rows.Scan(&key, &title); err != nil {
			return nil, err
		}
		if key == "" {
			key = byTitle[title]
		}
		if key != "" {
			keys = append(keys, key)
		}
	}
	return keys, rows.Err()
}

func insertArticle(ctx context.Context, tx pgx.Tx, kind string, date time.Time, e Entry, poolSize int) (string, error) {
	titleJp := e.TitleJp
	if kind == KindVocab {
		titleJp = fmt.Sprintf("%d月%d日の%s", int(date.Month()), date.Day(), e.TitleJp)
	}
	content := e.ContentJSON
	if len(content) == 0 {
		content = json.RawMessage(`{}`)
	}
	source, err := json.Marshal(map[string]any{"source": "pool", "poolKey": e.Key, "poolSize": poolSize})
	if err != nil {
		return "", err
	}
	slug := fmt.Sprintf("%s-%s-%s", date.Format("2006-01-02"),
		strings.ReplaceAll(strings.TrimPrefix(kind, "magazine_"), "_", "-"), defaultLocale)

	var id string
	err = tx.QueryRow(ctx, `INSERT INTO daily.magazine_article
		(slug, widget_kind, content_date, locale, title_jp, title_vi, summary_jp, summary_vi, content_json,
		 jlpt_level, source_data_json, ai_model, status, approval_status, published_at, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NULLIF($10,''),$11,'content-pool','published','auto_approved',NOW(),NOW(),NOW())
		ON CONFLICT DO NOTHING RETURNING id::text`,
		slug, kind, date, defaultLocale, titleJp, e.TitleVi, e.SummaryJp, e.SummaryVi, []byte(content),
		e.JLPTLevel, source).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	for _, v := range e.VocabItems {
		if _, err := tx.Exec(ctx, `INSERT INTO daily.magazine_vocab_item
			(article_id, word_jp, reading, meaning_vi, pos, jlpt_level, sentence_jp, sentence_vi, display_order)
			VALUES ($1,$2,$3,$4,NULLIF($5,''),NULLIF($6,''),$7,$8,$9)`,
			id, v.WordJp, v.Reading, v.MeaningVi, v.Pos, v.JLPTLevel, v.SentenceJp, v.SentenceVi, v.DisplayOrder); err != nil {
			return "", err
		}
	}
	for _, q := range e.Quizzes {
		options, err := json.Marshal(q.Options)
		if err != nil {
			return "", err
		}
		quizType := q.QuizType
		if quizType == "" {
			quizType = "multiple_choice"
		}
		if _, err := tx.Exec(ctx, `INSERT INTO daily.magazine_quiz
			(article_id, question_jp, question_vi, quiz_type, options, correct_answer, explanation_jp, explanation_vi, display_order)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
			id, q.QuestionJp, q.QuestionVi, quizType, options, q.CorrectAnswer, q.ExplanationJp, q.ExplanationVi, q.DisplayOrder); err != nil {
			return "", err
		}
	}
	return id, nil
}
