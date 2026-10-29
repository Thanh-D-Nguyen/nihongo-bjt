package loto

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// DBTX is satisfied by *pgxpool.Pool and pgx.Tx.
type DBTX interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

// Pool is a DBTX that can open (nested) transactions; *pgxpool.Pool and
// pgx.Tx both satisfy it, which lets tests run the service inside a rolled-back
// transaction.
type Pool interface {
	DBTX
	Begin(ctx context.Context) (pgx.Tx, error)
}

// Run statuses stored in daily.loto_generation_run.status.
const (
	RunGenerated = "generated"
	RunPublished = "published"
	RunBacktest  = "backtest"
	// RunRejected marks a published run whose magazine article an admin rejected.
	RunRejected = "rejected"
	// RunSuperseded marks a published run replaced by a later publication for the same draw.
	RunSuperseded = "superseded"
)

// StoredSet is a persisted generated set.
type StoredSet struct {
	ID    string
	Rank  int
	Main  []int
	Bonus []int
	Score float64
}

// Run is a persisted generation run.
type Run struct {
	ID            string
	Game          Game
	TargetDateKey string
	Status        string
	Seed          string
	Sentence      Sentence
	Sets          []StoredSet
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

// LoadDraws reads official draws newest first. limit <= 0 loads every draw.
func LoadDraws(ctx context.Context, db DBTX, game Game, limit int) ([]Draw, error) {
	query := `SELECT draw_number, draw_date, main_numbers, bonus_numbers, carryover_amount, sales_amount
		FROM daily.loto_draw WHERE game=$1 ORDER BY draw_date DESC, draw_number DESC`
	args := []any{string(game)}
	if limit > 0 {
		query += ` LIMIT $2`
		args = append(args, limit)
	}
	rows, err := db.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("load %s draws: %w", game, err)
	}
	defer rows.Close()
	draws := make([]Draw, 0, 256)
	for rows.Next() {
		draw := Draw{Game: game}
		var date time.Time
		if err := rows.Scan(&draw.Number, &date, &draw.Main, &draw.Bonus, &draw.Carryover, &draw.Sales); err != nil {
			return nil, fmt.Errorf("scan %s draw: %w", game, err)
		}
		draw.DateKey = date.Format(dateLayout)
		if draw.Main == nil {
			draw.Main = []int{}
		}
		if draw.Bonus == nil {
			draw.Bonus = []int{}
		}
		draws = append(draws, draw)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate %s draws: %w", game, err)
	}
	return draws, nil
}

// UpsertDraws inserts or corrects draws keyed by (game, draw_number) inside one
// transaction and reports how many rows were created versus updated.
func UpsertDraws(ctx context.Context, db Pool, draws []Draw, provider, sourceURL string) (created, updated int, err error) {
	if len(draws) == 0 {
		return 0, 0, nil
	}
	tx, err := db.Begin(ctx)
	if err != nil {
		return 0, 0, fmt.Errorf("begin draw upsert: %w", err)
	}
	defer func() { _ = tx.Rollback(context.WithoutCancel(ctx)) }()
	batch := &pgx.Batch{}
	for i := range draws {
		draw := draws[i]
		if err := ValidateDraw(&draw); err != nil {
			return 0, 0, fmt.Errorf("%w: draw %d: %v", ErrInvalidInput, draws[i].Number, err)
		}
		batch.Queue(`INSERT INTO daily.loto_draw
			(game, draw_number, draw_date, main_numbers, bonus_numbers, carryover_amount, sales_amount, source_url, source_provider)
			VALUES ($1,$2,$3::date,$4,$5,$6,$7,NULLIF($8,''),$9)
			ON CONFLICT (game, draw_number) DO UPDATE SET
			draw_date=EXCLUDED.draw_date, main_numbers=EXCLUDED.main_numbers, bonus_numbers=EXCLUDED.bonus_numbers,
			carryover_amount=EXCLUDED.carryover_amount, sales_amount=EXCLUDED.sales_amount,
			source_url=EXCLUDED.source_url, source_provider=EXCLUDED.source_provider,
			imported_at=NOW(), updated_at=NOW()
			RETURNING (xmax = 0)`,
			string(draw.Game), draw.Number, draw.DateKey, draw.Main, draw.Bonus, draw.Carryover, draw.Sales, sourceURL, provider)
	}
	results := tx.SendBatch(ctx, batch)
	for range draws {
		var inserted bool
		if err := results.QueryRow().Scan(&inserted); err != nil {
			_ = results.Close()
			return 0, 0, fmt.Errorf("upsert loto draw: %w", err)
		}
		if inserted {
			created++
		} else {
			updated++
		}
	}
	if err := results.Close(); err != nil {
		return 0, 0, fmt.Errorf("close draw upsert batch: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return 0, 0, fmt.Errorf("commit draw upsert: %w", err)
	}
	return created, updated, nil
}

// InsertRun persists a run and its generated sets. selectTop marks rank 1 as
// selected for the magazine. autopilotKey may be empty for admin runs.
func InsertRun(ctx context.Context, db DBTX, run Run, sets []GeneratedSet, weights Weights, inputConfig, contextJSON map[string]any, autopilotKey, adminID string, selectTop bool) (Run, error) {
	sentenceJSON, err := json.Marshal(run.Sentence)
	if err != nil {
		return Run{}, fmt.Errorf("encode sentence: %w", err)
	}
	weightsJSON, err := json.Marshal(weights)
	if err != nil {
		return Run{}, fmt.Errorf("encode weights: %w", err)
	}
	configJSON, err := json.Marshal(inputConfig)
	if err != nil {
		return Run{}, fmt.Errorf("encode input config: %w", err)
	}
	contextEncoded, err := json.Marshal(contextJSON)
	if err != nil {
		return Run{}, fmt.Errorf("encode context: %w", err)
	}
	status := run.Status
	if status == "" {
		status = RunGenerated
	}
	err = db.QueryRow(ctx, `INSERT INTO daily.loto_generation_run
		(game, target_draw_date, status, seed, requested_set_count, input_config_json, algorithm_weights_json,
		 context_json, japanese_sentence_json, autopilot_key, created_by_admin_id, created_at, updated_at)
		VALUES ($1,$2::date,$3,NULLIF($4,''),$5,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,NULLIF($10,''),NULLIF($11,'')::uuid,NOW(),NOW())
		RETURNING id::text`,
		string(run.Game), run.TargetDateKey, status, run.Seed, len(sets), string(configJSON), string(weightsJSON),
		string(contextEncoded), string(sentenceJSON), autopilotKey, adminID).Scan(&run.ID)
	if err != nil {
		return Run{}, err
	}
	run.Status = status
	run.Sets = make([]StoredSet, 0, len(sets))
	for i, set := range sets {
		explanation, err := json.Marshal(set.Explanation)
		if err != nil {
			return Run{}, fmt.Errorf("encode explanation: %w", err)
		}
		stored := StoredSet{Rank: i + 1, Main: set.Main, Bonus: set.Bonus, Score: set.Score}
		if err := db.QueryRow(ctx, `INSERT INTO daily.loto_generated_set
			(run_id, rank, main_numbers, bonus_numbers, score, explanation_json, selected_for_magazine, created_at)
			VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,NOW()) RETURNING id::text`,
			run.ID, stored.Rank, stored.Main, stored.Bonus, stored.Score, string(explanation), selectTop && i == 0).Scan(&stored.ID); err != nil {
			return Run{}, fmt.Errorf("insert generated set: %w", err)
		}
		run.Sets = append(run.Sets, stored)
	}
	return run, nil
}

// FindRunByKey loads a run by its autopilot idempotency key, or nil.
func FindRunByKey(ctx context.Context, db DBTX, key string) (*Run, error) {
	var run Run
	var game string
	var target time.Time
	var seed *string
	err := db.QueryRow(ctx, `SELECT id::text, game, target_draw_date, status, seed
		FROM daily.loto_generation_run WHERE autopilot_key=$1`, key).Scan(&run.ID, &game, &target, &run.Status, &seed)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("find run %s: %w", key, err)
	}
	run.Game = Game(game)
	run.TargetDateKey = target.Format(dateLayout)
	if seed != nil {
		run.Seed = *seed
	}
	rows, err := db.Query(ctx, `SELECT id::text, rank, main_numbers, bonus_numbers, score
		FROM daily.loto_generated_set WHERE run_id=$1 ORDER BY rank`, run.ID)
	if err != nil {
		return nil, fmt.Errorf("load run sets: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var set StoredSet
		if err := rows.Scan(&set.ID, &set.Rank, &set.Main, &set.Bonus, &set.Score); err != nil {
			return nil, fmt.Errorf("scan run set: %w", err)
		}
		run.Sets = append(run.Sets, set)
	}
	return &run, rows.Err()
}
