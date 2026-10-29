package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/loto"
)

// lotoGameParam reads and validates the ?game= query parameter (default loto6).
func lotoGameParam(w http.ResponseWriter, r *http.Request) (loto.Game, bool) {
	raw := r.URL.Query().Get("game")
	if raw == "" {
		raw = string(loto.Loto6)
	}
	game, ok := loto.ParseGame(raw)
	if !ok {
		writeJSONError(w, "game must be loto6 or loto7", http.StatusBadRequest)
		return "", false
	}
	return game, true
}

// decodeLotoSentence returns the stored learning sentence verbatim (so newer
// fields such as level and grammar reach the client) plus its vocabulary.
func decodeLotoSentence(raw []byte) (any, []loto.VocabItem) {
	vocab := []loto.VocabItem{}
	if len(raw) == 0 || !json.Valid(raw) || string(raw) == "null" {
		return nil, vocab
	}
	var sentence any
	if err := json.Unmarshal(raw, &sentence); err != nil {
		return nil, vocab
	}
	var typed struct {
		VocabItems []loto.VocabItem `json:"vocabItems"`
	}
	if err := json.Unmarshal(raw, &typed); err == nil && typed.VocabItems != nil {
		vocab = typed.VocabItems
	}
	return sentence, vocab
}

type lotoFeedSet struct {
	MainNumbers  []int   `json:"mainNumbers"`
	BonusNumbers []int   `json:"bonusNumbers"`
	Score        float64 `json:"score"`
}

type lotoFeedDraw struct {
	ID         string         `json:"id"`
	Game       string         `json:"game"`
	DrawNumber int            `json:"drawNumber"`
	DrawDate   string         `json:"drawDate"`
	DrawDayJP  string         `json:"drawDayJp"`
	DrawTime   string         `json:"drawTime"`
	Kind       string         `json:"kind"`
	Sets       []lotoFeedSet  `json:"sets"`
	Result     map[string]any `json:"result"`
	HitCount   int            `json:"hitCount"`
	BonusHit   bool           `json:"bonusHit"`
	Matched    []int          `json:"matched"`
	JPSentence any            `json:"jpSentence"`
}

// lotoFeedHandler implements GET /api/magazine/loto/feed: official draws newest
// first, each carrying the reference set that was published (or backtested)
// for it and the resulting hit summary.
func lotoFeedHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		game, ok := lotoGameParam(w, r)
		if !ok {
			return
		}
		spec := loto.SpecFor(game)
		page := queryInt(r, "page", 1)
		limit := queryInt(r, "limit", 10)
		if page < 1 {
			page = 1
		}
		if limit < 1 {
			limit = 10
		}
		if limit > 50 {
			limit = 50
		}
		ctx := r.Context()
		var total int
		if err := db.QueryRow(ctx, `SELECT COUNT(*) FROM daily.loto_draw WHERE game = $1`, string(game)).Scan(&total); err != nil {
			logger.Error("loto feed count", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if total > 0 {
			if lastPage := (total + limit - 1) / limit; page > lastPage {
				page = lastPage
			}
		}
		rows, err := db.Query(ctx, `SELECT id::text, draw_number, draw_date, main_numbers, bonus_numbers
			FROM daily.loto_draw WHERE game = $1 ORDER BY draw_date DESC, draw_number DESC LIMIT $2 OFFSET $3`,
			string(game), limit, (page-1)*limit)
		if err != nil {
			logger.Error("loto feed", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		draws := make([]*lotoFeedDraw, 0, limit)
		dates := make([]time.Time, 0, limit)
		byDate := make(map[string]*lotoFeedDraw, limit)
		for rows.Next() {
			d := &lotoFeedDraw{Game: string(game), Kind: "result", Sets: []lotoFeedSet{}, Matched: []int{}}
			var drawDate time.Time
			var main, bonus []int
			if err := rows.Scan(&d.ID, &d.DrawNumber, &drawDate, &main, &bonus); err != nil {
				rows.Close()
				logger.Error("loto feed scan", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			if main == nil {
				main = []int{}
			}
			if bonus == nil {
				bonus = []int{}
			}
			d.DrawDate = drawDate.Format("2006-01-02")
			d.DrawDayJP = loto.DayJP(d.DrawDate)
			d.DrawTime = spec.DrawTime
			d.Result = map[string]any{"mainNumbers": main, "bonusNumbers": bonus}
			draws = append(draws, d)
			dates = append(dates, drawDate)
			byDate[d.DrawDate] = d
		}
		rows.Close()
		if err := rows.Err(); err != nil {
			logger.Error("loto feed rows", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		if len(dates) > 0 {
			// One batched query for the whole page. Published runs outrank backtests for the same date.
			predictionRows, err := db.Query(ctx, `SELECT gr.target_draw_date, gr.id::text, gr.status, gs.main_numbers, gs.bonus_numbers, gs.score, gr.japanese_sentence_json
				FROM daily.loto_generation_run gr
				JOIN daily.loto_generated_set gs ON gs.run_id = gr.id
				WHERE gr.game = $1 AND gr.target_draw_date = ANY($2::date[])
				  AND gr.status IN ('published','backtest') AND gs.selected_for_magazine = true
				ORDER BY gr.target_draw_date, (gr.status = 'published') DESC, gr.created_at DESC, gr.id, gs.rank`,
				string(game), dates)
			if err != nil {
				logger.Error("loto feed predictions", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			chosenRun := map[string]string{}
			for predictionRows.Next() {
				var target time.Time
				var runID, status string
				var main, bonus []int
				var score float64
				var sentenceJSON []byte
				if err := predictionRows.Scan(&target, &runID, &status, &main, &bonus, &score, &sentenceJSON); err != nil {
					predictionRows.Close()
					logger.Error("loto feed prediction scan", "error", err)
					writeJSONError(w, "internal error", http.StatusInternalServerError)
					return
				}
				key := target.Format("2006-01-02")
				d := byDate[key]
				if d == nil {
					continue
				}
				if chosen, seen := chosenRun[key]; seen && chosen != runID {
					continue
				}
				chosenRun[key] = runID
				if main == nil {
					main = []int{}
				}
				if bonus == nil {
					bonus = []int{}
				}
				d.Sets = append(d.Sets, lotoFeedSet{MainNumbers: main, BonusNumbers: bonus, Score: score})
				if len(d.Sets) == 1 {
					d.Kind = status
					actualMain := d.Result["mainNumbers"].([]int)
					actualBonus := d.Result["bonusNumbers"].([]int)
					for _, n := range main {
						for _, actual := range actualMain {
							if n == actual {
								d.HitCount++
								d.Matched = append(d.Matched, n)
							}
						}
					}
					d.BonusHit = loto.BonusHit(main, actualBonus)
					d.JPSentence, _ = decodeLotoSentence(sentenceJSON)
				}
			}
			predictionRows.Close()
			if err := predictionRows.Err(); err != nil {
				logger.Error("loto feed prediction rows", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
		}
		if len(draws) == 0 {
			writeJSON(w, http.StatusOK, map[string]any{"data": []lotoFeedDraw{}, "total": total, "page": page, "limit": limit})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"data": draws, "total": total, "page": page, "limit": limit})
	}
}

// lotoNextDrawHandler implements GET /api/magazine/loto/next-draw: the
// published reference set for the earliest draw that has not happened yet
// (today's draw counts until its official result has been imported).
func lotoNextDrawHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		game, ok := lotoGameParam(w, r)
		if !ok {
			return
		}
		spec := loto.SpecFor(game)
		ctx := r.Context()
		todayKey := loto.JSTDateKey(time.Now())
		var id string
		var drawDate time.Time
		var sentenceJSON []byte
		err := db.QueryRow(ctx, `SELECT id::text, target_draw_date, japanese_sentence_json FROM daily.loto_generation_run
			WHERE game = $1 AND status = 'published' AND target_draw_date >= $2::date
			AND target_draw_date > COALESCE((SELECT MAX(draw_date) FROM daily.loto_draw WHERE game = $1), DATE '1900-01-01')
			AND EXISTS (SELECT 1 FROM daily.loto_generated_set gs WHERE gs.run_id = daily.loto_generation_run.id AND gs.selected_for_magazine = true)
			ORDER BY target_draw_date ASC, created_at DESC LIMIT 1`, string(game), todayKey).Scan(&id, &drawDate, &sentenceJSON)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				writeJSON(w, http.StatusOK, map[string]any{"nextDraw": nil})
				return
			}
			logger.Error("loto next draw", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		setRows, err := db.Query(ctx, `SELECT main_numbers, bonus_numbers, score FROM daily.loto_generated_set
			WHERE run_id = $1 AND selected_for_magazine = true ORDER BY rank LIMIT 3`, id)
		if err != nil {
			logger.Error("loto next draw sets", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		sets := make([]lotoFeedSet, 0, 3)
		for setRows.Next() {
			var set lotoFeedSet
			if err := setRows.Scan(&set.MainNumbers, &set.BonusNumbers, &set.Score); err != nil {
				setRows.Close()
				logger.Error("loto next draw set scan", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			if set.MainNumbers == nil {
				set.MainNumbers = []int{}
			}
			if set.BonusNumbers == nil {
				set.BonusNumbers = []int{}
			}
			sets = append(sets, set)
		}
		setRows.Close()
		if err := setRows.Err(); err != nil {
			logger.Error("loto next draw sets", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		dateKey := drawDate.Format("2006-01-02")
		sentence, vocab := decodeLotoSentence(sentenceJSON)
		var drawNumber any
		estimated := false
		var latestNumber int
		var latestDate time.Time
		switch err := db.QueryRow(ctx, `SELECT draw_number, draw_date FROM daily.loto_draw WHERE game = $1
			ORDER BY draw_date DESC, draw_number DESC LIMIT 1`, string(game)).Scan(&latestNumber, &latestDate); {
		case err == nil:
			if number, est, estErr := loto.EstimateDrawNumber(game, latestNumber, latestDate.Format("2006-01-02"), dateKey); estErr == nil {
				drawNumber, estimated = number, est
			}
		case !errors.Is(err, pgx.ErrNoRows):
			logger.Error("loto next draw latest", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		var confidence any
		if len(sets) > 0 {
			confidence = sets[0].Score
		}
		daysUntil := 0
		if todayDate, err := loto.ParseDateKey(todayKey); err == nil {
			daysUntil = int(drawDate.UTC().Sub(todayDate).Hours() / 24)
		}
		writeJSON(w, http.StatusOK, map[string]any{"nextDraw": map[string]any{
			"id": id, "game": string(game), "drawNumber": drawNumber, "drawNumberEstimated": estimated,
			"drawDate": dateKey, "drawDayJp": loto.DayJP(dateKey), "drawTime": spec.DrawTime,
			"scheduleJp": spec.LabelJP, "scheduleVi": spec.LabelVI, "scheduleEn": spec.LabelEN,
			"sets": sets, "jpSentence": sentence, "vocabItems": vocab, "confidence": confidence, "daysUntil": daysUntil,
			"totalCombinations": spec.TotalCombinations,
		}})
	}
}

// lotoStatsHandler implements GET /api/magazine/loto/stats: the statistics lab.
func lotoStatsHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		game, ok := lotoGameParam(w, r)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		payload, err := (&loto.Service{DB: db, Logger: logger}).Stats(ctx, game)
		if err != nil {
			logger.Error("loto stats", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, payload)
	}
}
