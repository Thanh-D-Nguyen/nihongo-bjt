package loto

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ResultSource provides official draw history (the CSV mirror in production).
type ResultSource interface {
	Fetch(ctx context.Context, game Game) ([]Draw, string, error)
}

// ErrSourceUnavailable marks failures to obtain results from the CSV mirror
// (as opposed to database or validation failures).
var ErrSourceUnavailable = errors.New("loto: result source unavailable")

// BacktestWindow is how many of the latest draws get a walk-forward backtest
// so a brand-new deployment still has an honest, labelled history.
const BacktestWindow = 24

// Service orchestrates import, generation, publication and statistics.
type Service struct {
	DB     Pool
	Logger *slog.Logger
	Source ResultSource
	Now    func() time.Time
}

// NewService wires the production dependencies.
func NewService(db *pgxpool.Pool, logger *slog.Logger) *Service {
	return &Service{DB: db, Logger: logger, Source: NewFetcher(), Now: time.Now}
}

func (s *Service) now() time.Time {
	if s.Now != nil {
		return s.Now()
	}
	return time.Now()
}

// SyncResult reports one CSV import.
type SyncResult struct {
	Game                    Game   `json:"game"`
	URL                     string `json:"url"`
	SourceProvider          string `json:"sourceProvider"`
	OfficialVerificationURL string `json:"officialVerificationUrl"`
	Created                 int    `json:"created"`
	Updated                 int    `json:"updated"`
	Processed               int    `json:"processed"`
	Total                   int    `json:"total"`
}

// SyncGame downloads the CSV and upserts only new draws plus the last three
// stored ones (to absorb corrections).
func (s *Service) SyncGame(ctx context.Context, game Game) (SyncResult, error) {
	if s.Source == nil {
		return SyncResult{}, errors.New("loto: no result source configured")
	}
	draws, sourceURL, err := s.Source.Fetch(ctx, game)
	if err != nil {
		return SyncResult{}, fmt.Errorf("%w: %w", ErrSourceUnavailable, err)
	}
	var maxExisting int
	if err := s.DB.QueryRow(ctx, `SELECT COALESCE(MAX(draw_number),0) FROM daily.loto_draw WHERE game=$1`, string(game)).Scan(&maxExisting); err != nil {
		return SyncResult{}, fmt.Errorf("read latest %s draw number: %w", game, err)
	}
	cutoff := maxExisting - 3
	toUpsert := make([]Draw, 0, 8)
	for _, draw := range draws {
		if draw.Number > cutoff {
			toUpsert = append(toUpsert, draw)
		}
	}
	created, updated, err := UpsertDraws(ctx, s.DB, toUpsert, ProviderThekyo, sourceURL)
	if err != nil {
		return SyncResult{}, err
	}
	return SyncResult{
		Game: game, URL: sourceURL, SourceProvider: ProviderThekyo, OfficialVerificationURL: OfficialVerificationURL,
		Created: created, Updated: updated, Processed: len(toUpsert), Total: len(draws),
	}, nil
}

// GenerateRequest is an admin or autopilot generation request.
type GenerateRequest struct {
	Game          Game
	TargetDateKey string
	SetCount      int
	Seed          string
	Weights       map[string]float64
	WeatherText   string
	DreamText     string
	LuckyText     string
	Pinned        []int
	Excluded      []int
	AutopilotKey  string
	AdminID       string
	SelectTop     bool
}

// GenerateRun creates and persists a run through db (pool or transaction).
func (s *Service) GenerateRun(ctx context.Context, db DBTX, req GenerateRequest) (Run, error) {
	draws, err := LoadDraws(ctx, db, req.Game, 0)
	if err != nil {
		return Run{}, err
	}
	return generateRunFromDraws(ctx, db, req, draws, RunGenerated)
}

func generateRunFromDraws(ctx context.Context, db DBTX, req GenerateRequest, history []Draw, status string) (Run, error) {
	input := GenerateInput{
		Game: req.Game, TargetDateKey: req.TargetDateKey, SetCount: req.SetCount, Seed: req.Seed, Weights: req.Weights,
		WeatherText: req.WeatherText, DreamText: req.DreamText, LuckyText: req.LuckyText,
		PinnedNumbers: req.Pinned, ExcludedNumber: req.Excluded,
	}
	sets, err := Generate(input, history)
	if err != nil {
		return Run{}, err
	}
	weights, err := DefaultWeights.WithOverrides(req.Weights)
	if err != nil {
		return Run{}, err
	}
	run := Run{Game: req.Game, TargetDateKey: req.TargetDateKey, Status: status, Seed: req.Seed, Sentence: SentenceFor(req.Game, req.TargetDateKey)}
	return InsertRun(ctx, db, run, sets, weights,
		map[string]any{"pinnedNumbers": nonNilInts(req.Pinned), "excludedNumbers": nonNilInts(req.Excluded)},
		map[string]any{"weatherText": req.WeatherText, "dreamText": req.DreamText, "luckyText": req.LuckyText},
		req.AutopilotKey, req.AdminID, req.SelectTop)
}

func nonNilInts(values []int) []int {
	if values == nil {
		return []int{}
	}
	return values
}

// Errors raised while publishing a run.
var (
	ErrRunNotFound  = errors.New("loto: generation run not found")
	ErrDuplicateSet = errors.New("loto: duplicate setId")
	ErrSetNotInRun  = errors.New("loto: generated set not found for run")
	ErrNoSets       = errors.New("loto: at least one setId is required")
)

// PublishResult describes the magazine article created for a published run.
type PublishResult struct {
	ArticleID    string
	Slug         string
	PublishedAt  time.Time
	SelectedSets int
}

// PublishRun selects the given sets, marks the run published and upserts the
// magazine article carrying the full learning payload. It must run inside the
// caller's transaction so selection and publication stay atomic.
func PublishRun(ctx context.Context, tx DBTX, runID string, setIDs []string, adminID string, now time.Time) (PublishResult, error) {
	if len(setIDs) == 0 {
		return PublishResult{}, ErrNoSets
	}
	var gameRaw string
	var target time.Time
	var sentenceJSON, weightsJSON []byte
	err := tx.QueryRow(ctx, `SELECT game, target_draw_date, COALESCE(japanese_sentence_json,'null'::jsonb), algorithm_weights_json
		FROM daily.loto_generation_run WHERE id=$1 FOR UPDATE`, runID).Scan(&gameRaw, &target, &sentenceJSON, &weightsJSON)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.Is(err, pgx.ErrNoRows) || (errors.As(err, &pgErr) && pgErr.Code == "22P02") {
			return PublishResult{}, ErrRunNotFound
		}
		return PublishResult{}, fmt.Errorf("load run %s: %w", runID, err)
	}
	game, ok := ParseGame(gameRaw)
	if !ok {
		return PublishResult{}, fmt.Errorf("%w: run %s has unknown game %q", ErrInvalidInput, runID, gameRaw)
	}
	spec := SpecFor(game)
	dateKey := target.Format(dateLayout)

	if _, err := tx.Exec(ctx, `UPDATE daily.loto_generated_set SET selected_for_magazine=false WHERE run_id=$1 AND selected_for_magazine=true`, runID); err != nil {
		return PublishResult{}, fmt.Errorf("clear selections: %w", err)
	}
	seen := make(map[string]struct{}, len(setIDs))
	for _, setID := range setIDs {
		if _, dup := seen[setID]; dup {
			return PublishResult{}, ErrDuplicateSet
		}
		seen[setID] = struct{}{}
		tag, err := tx.Exec(ctx, `UPDATE daily.loto_generated_set SET selected_for_magazine=true WHERE id=$1 AND run_id=$2`, setID, runID)
		if err != nil {
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.Code == "22P02" {
				return PublishResult{}, ErrSetNotInRun
			}
			return PublishResult{}, fmt.Errorf("select set %s: %w", setID, err)
		}
		if tag.RowsAffected() != 1 {
			return PublishResult{}, ErrSetNotInRun
		}
	}

	rows, err := tx.Query(ctx, `SELECT id::text, rank, main_numbers, bonus_numbers, score, explanation_json
		FROM daily.loto_generated_set WHERE run_id=$1 AND selected_for_magazine=true ORDER BY rank`, runID)
	if err != nil {
		return PublishResult{}, fmt.Errorf("load selected sets: %w", err)
	}
	type contentSet struct {
		ID          string          `json:"id"`
		Rank        int             `json:"rank"`
		Main        []int           `json:"mainNumbers"`
		Bonus       []int           `json:"bonusNumbers"`
		Score       float64         `json:"score"`
		Explanation json.RawMessage `json:"explanation"`
	}
	sets := make([]contentSet, 0, len(setIDs))
	for rows.Next() {
		var set contentSet
		var explanation []byte
		if err := rows.Scan(&set.ID, &set.Rank, &set.Main, &set.Bonus, &set.Score, &explanation); err != nil {
			rows.Close()
			return PublishResult{}, fmt.Errorf("scan selected set: %w", err)
		}
		if set.Main == nil {
			set.Main = []int{}
		}
		if set.Bonus == nil {
			set.Bonus = []int{}
		}
		set.Explanation = explanation
		sets = append(sets, set)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return PublishResult{}, fmt.Errorf("iterate selected sets: %w", err)
	}
	if len(sets) == 0 {
		return PublishResult{}, ErrSetNotInRun
	}

	var drawNumber *int
	estimated := false
	var latestNumber int
	var latest time.Time
	switch err := tx.QueryRow(ctx, `SELECT draw_number, draw_date FROM daily.loto_draw WHERE game=$1 ORDER BY draw_date DESC, draw_number DESC LIMIT 1`, gameRaw).Scan(&latestNumber, &latest); {
	case err == nil:
		if number, est, estErr := EstimateDrawNumber(game, latestNumber, latest.Format(dateLayout), dateKey); estErr == nil {
			drawNumber, estimated = &number, est
		}
	case !errors.Is(err, pgx.ErrNoRows):
		return PublishResult{}, fmt.Errorf("load latest draw: %w", err)
	}

	content := map[string]any{
		"runId": runID, "game": gameRaw, "targetDrawDate": dateKey,
		"drawNumber": drawNumber, "drawNumberEstimated": estimated,
		"drawDayJp": DayJP(dateKey), "drawTime": spec.DrawTime,
		"scheduleJp": spec.LabelJP, "scheduleVi": spec.LabelVI, "scheduleEn": spec.LabelEN,
		"sets": sets, "japaneseSentence": json.RawMessage(sentenceJSON), "algorithmWeights": json.RawMessage(weightsJSON),
		"methodology": "historical_heuristic_equal_odds",
		"riskDisclaimer": map[string]string{
			"vi": "Mọi tổ hợp hợp lệ đều có xác suất trúng như nhau. Nội dung chỉ dùng để học xác suất và tiếng Nhật, không phải lời khuyên mua xổ số.",
			"ja": "有効な数字の組み合わせの当せん確率はすべて同じです。本内容は確率と日本語の学習用であり、宝くじの購入を勧めるものではありません。",
			"en": "Every valid number combination has the same chance. This content is for probability and Japanese study, not a recommendation to buy lottery tickets.",
		},
		"source": map[string]string{"provider": "historical_draw_database", "officialVerificationUrl": OfficialVerificationURL},
	}
	contentJSON, err := json.Marshal(content)
	if err != nil {
		return PublishResult{}, fmt.Errorf("encode article content: %w", err)
	}

	widgetKind := "magazine_" + gameRaw
	slug := fmt.Sprintf("%s-prediction-%s", gameRaw, dateKey)
	dayLabel := strings.TrimSuffix(DayJP(dateKey), "日")
	titleJP := fmt.Sprintf("%s 確率学習セット — %s（%s）%s", strings.ToUpper(gameRaw), dateKey, dayLabel, spec.DrawTime)
	titleVI := fmt.Sprintf("Tổ hợp học xác suất %s — %s • %s", strings.ToUpper(gameRaw), dateKey, spec.DrawTime)
	approval := "auto_approved"
	if adminID != "" {
		approval = "approved"
	}
	var articleID string
	err = tx.QueryRow(ctx, `INSERT INTO daily.magazine_article
		(slug, widget_kind, content_date, locale, title_jp, title_vi, summary_jp, summary_vi, content_json, status,
		 approval_status, approved_by, approved_at, published_at, created_at, updated_at)
		VALUES ($1,$2,$3::date,'vi',$4,$5,$6,$7,$8::jsonb,'published',$9,NULLIF($10,'')::uuid,$11,$11,$11,$11)
		ON CONFLICT (widget_kind, content_date, locale) DO UPDATE SET
		title_jp=EXCLUDED.title_jp, title_vi=EXCLUDED.title_vi, summary_jp=EXCLUDED.summary_jp, summary_vi=EXCLUDED.summary_vi,
		content_json=EXCLUDED.content_json, status='published', approval_status=EXCLUDED.approval_status,
		approved_by=EXCLUDED.approved_by, approved_at=EXCLUDED.approved_at, published_at=EXCLUDED.published_at, updated_at=EXCLUDED.updated_at
		RETURNING id::text`,
		slug, widgetKind, dateKey, titleJP, titleVI,
		spec.LabelJP+"｜過去データを使った確率学習用の組み合わせ",
		spec.LabelVI+" | Tổ hợp tham khảo để học xác suất từ dữ liệu quá khứ",
		string(contentJSON), approval, adminID, now).Scan(&articleID)
	if err != nil {
		return PublishResult{}, fmt.Errorf("upsert magazine article: %w", err)
	}
	if _, err := tx.Exec(ctx, `UPDATE daily.loto_generation_run SET status='published', selected_set_id=$2, updated_at=NOW() WHERE id=$1`, runID, sets[0].ID); err != nil {
		return PublishResult{}, fmt.Errorf("mark run published: %w", err)
	}
	return PublishResult{ArticleID: articleID, Slug: slug, PublishedAt: now, SelectedSets: len(setIDs)}, nil
}

// AutopilotResult reports one autopilot tick.
type AutopilotResult struct {
	Status                 string      `json:"status"`
	Game                   Game        `json:"game"`
	TodayDate              string      `json:"todayDate"`
	LatestOfficialDrawDate string      `json:"latestOfficialDrawDate,omitempty"`
	TargetDrawDate         string      `json:"targetDrawDate,omitempty"`
	Imported               *SyncResult `json:"imported,omitempty"`
	SyncError              string      `json:"syncError,omitempty"`
	RunID                  string      `json:"runId,omitempty"`
	PublishedSlug          string      `json:"publishedSlug,omitempty"`
	PublishedSet           []int       `json:"publishedSet,omitempty"`
	Backtests              int         `json:"backtests"`
}

// Autopilot statuses.
const (
	AutopilotWaiting = "waiting_result"
	AutopilotDone    = "already_done"
	AutopilotPublish = "published"
)

// RunAutopilot is one idempotent tick: sync results, publish exactly one
// reference set for the next draw, and keep the backtest history topped up.
func (s *Service) RunAutopilot(ctx context.Context, game Game) (AutopilotResult, error) {
	todayKey := JSTDateKey(s.now())
	result := AutopilotResult{Game: game, TodayDate: todayKey}

	imported, syncErr := s.SyncGame(ctx, game)
	if syncErr != nil {
		// A transient mirror outage must not block work that existing data already allows.
		result.SyncError = syncErr.Error()
		if s.Logger != nil {
			s.Logger.Warn("loto autopilot sync failed", "game", game, "error", syncErr)
		}
	} else {
		result.Imported = &imported
	}

	latest, err := LoadDraws(ctx, s.DB, game, 1)
	if err != nil {
		return result, err
	}
	if len(latest) == 0 {
		result.Status = AutopilotWaiting
		return result, nil
	}
	result.LatestOfficialDrawDate = latest[0].DateKey

	if created, err := s.EnsureBacktests(ctx, game, BacktestWindow); err != nil {
		if s.Logger != nil {
			s.Logger.Warn("loto backtest history failed", "game", game, "error", err)
		}
	} else {
		result.Backtests = created
	}

	target, err := ResolveAutopilotTarget(game, latest[0].DateKey, s.now())
	if err != nil {
		return result, err
	}
	result.TargetDrawDate = target.DateKey
	if target.Status == StatusWaitingResult {
		result.Status = AutopilotWaiting
		return result, nil
	}

	var curated int
	if err := s.DB.QueryRow(ctx, `SELECT COUNT(*) FROM daily.loto_generation_run
		WHERE game=$1 AND target_draw_date=$2::date AND status='published' AND autopilot_key IS DISTINCT FROM $3`,
		string(game), target.DateKey, fmt.Sprintf("%s:%s", game, target.DateKey)).Scan(&curated); err != nil {
		return result, fmt.Errorf("check existing published run: %w", err)
	}
	if curated > 0 {
		result.Status = AutopilotDone // an admin already published this draw; never overwrite it
		return result, nil
	}

	key := fmt.Sprintf("%s:%s", game, target.DateKey)
	for attempt := 0; attempt < 2; attempt++ {
		existing, err := FindRunByKey(ctx, s.DB, key)
		if err != nil {
			return result, err
		}
		if existing == nil {
			created, err := s.createAutopilotRun(ctx, game, target.DateKey, key)
			if isUniqueViolation(err) {
				continue // another replica won the idempotency key; reconcile its run
			}
			if err != nil {
				return result, err
			}
			existing = &created
		}
		result.RunID = existing.ID
		if existing.Status == RunPublished || existing.Status == RunRejected {
			result.Status = AutopilotDone
			return result, nil
		}
		if len(existing.Sets) == 0 {
			return result, fmt.Errorf("autopilot run %s has no generated sets", existing.ID)
		}
		top := existing.Sets[0]
		published, err := s.publishInOwnTx(ctx, existing.ID, top.ID)
		if err != nil {
			return result, err
		}
		InvalidateCaches()
		result.Status = AutopilotPublish
		result.PublishedSlug = published.Slug
		result.PublishedSet = top.Main
		if s.Logger != nil {
			s.Logger.Info("loto autopilot published", "game", game, "target", target.DateKey, "slug", published.Slug)
		}
		return result, nil
	}
	return result, fmt.Errorf("autopilot run %s kept conflicting", key)
}

// JobCount runs one autopilot tick for a cron job. It returns 1 when a new
// reference set was published and an error when the tick could not obtain
// results while it was still waiting for them, so the scheduler logs the failure.
func (s *Service) JobCount(ctx context.Context, game Game) (int, error) {
	result, err := s.RunAutopilot(ctx, game)
	if err != nil {
		return 0, err
	}
	if result.Status == AutopilotPublish {
		return 1, nil
	}
	if result.SyncError != "" && result.Status == AutopilotWaiting {
		return 0, fmt.Errorf("loto autopilot %s: result sync failed: %s", game, result.SyncError)
	}
	return 0, nil
}

// Reconcile runs one autopilot tick for every game, as done after each deploy.
// All steps are idempotent in PostgreSQL; failures are collected per game.
func (s *Service) Reconcile(ctx context.Context) map[Game]AutopilotResult {
	results := make(map[Game]AutopilotResult, 2)
	for _, game := range Games() {
		result, err := s.RunAutopilot(ctx, game)
		if err != nil {
			result.Status = "error"
			result.SyncError = err.Error()
			if s.Logger != nil {
				s.Logger.Warn("loto reconcile failed", "game", game, "error", err)
			}
		}
		results[game] = result
	}
	return results
}

func (s *Service) createAutopilotRun(ctx context.Context, game Game, targetKey, key string) (Run, error) {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return Run{}, fmt.Errorf("begin autopilot generation: %w", err)
	}
	defer func() { _ = tx.Rollback(context.WithoutCancel(ctx)) }()
	run, err := s.GenerateRun(ctx, tx, GenerateRequest{
		Game: game, TargetDateKey: targetKey, SetCount: 3, Seed: fmt.Sprintf("autopilot-%s-%s", game, targetKey),
		AutopilotKey: key, SelectTop: true,
	})
	if err != nil {
		return Run{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Run{}, err
	}
	return run, nil
}

func (s *Service) publishInOwnTx(ctx context.Context, runID, setID string) (PublishResult, error) {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return PublishResult{}, fmt.Errorf("begin publish: %w", err)
	}
	defer func() { _ = tx.Rollback(context.WithoutCancel(ctx)) }()
	result, err := PublishRun(ctx, tx, runID, []string{setID}, "", s.now())
	if err != nil {
		return PublishResult{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return PublishResult{}, err
	}
	return result, nil
}

// EnsureBacktests walks forward over the latest official draws and stores, for
// each one that never had a published reference set, the combination the
// heuristic would have produced using only the draws before it. The rows are
// labelled backtest and let learners compare the heuristic with pure chance.
func (s *Service) EnsureBacktests(ctx context.Context, game Game, window int) (int, error) {
	draws, err := LoadDraws(ctx, s.DB, game, 0)
	if err != nil {
		return 0, err
	}
	if window > len(draws) {
		window = len(draws)
	}
	published := map[string]struct{}{}
	rows, err := s.DB.Query(ctx, `SELECT target_draw_date FROM daily.loto_generation_run WHERE game=$1 AND status='published'`, string(game))
	if err != nil {
		return 0, fmt.Errorf("load published targets: %w", err)
	}
	for rows.Next() {
		var date time.Time
		if err := rows.Scan(&date); err != nil {
			rows.Close()
			return 0, err
		}
		published[date.Format(dateLayout)] = struct{}{}
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return 0, err
	}
	created := 0
	for i := 0; i < window; i++ {
		target := draws[i]
		history := draws[i+1:]
		if len(history) < MinHistoryForHeuristics {
			break
		}
		if _, ok := published[target.DateKey]; ok {
			continue
		}
		key := fmt.Sprintf("bt:%s:%s", game, target.DateKey)
		if existing, err := FindRunByKey(ctx, s.DB, key); err != nil {
			return created, err
		} else if existing != nil {
			continue
		}
		tx, err := s.DB.Begin(ctx)
		if err != nil {
			return created, err
		}
		_, err = generateRunFromDraws(ctx, tx, GenerateRequest{
			Game: game, TargetDateKey: target.DateKey, SetCount: 1, Seed: fmt.Sprintf("bt-%s-%s", game, target.DateKey),
			AutopilotKey: key, SelectTop: true,
		}, history, RunBacktest)
		if err != nil {
			_ = tx.Rollback(ctx)
			if isUniqueViolation(err) {
				continue
			}
			return created, err
		}
		if err := tx.Commit(ctx); err != nil {
			return created, err
		}
		created++
	}
	if created > 0 {
		InvalidateCaches()
	}
	return created, nil
}
