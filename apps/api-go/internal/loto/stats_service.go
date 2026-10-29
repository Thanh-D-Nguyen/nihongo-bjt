package loto

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// StatsWindow is the number of latest draws behind the "recent" heat column.
const StatsWindow = 50

// SpecView is the public rule sheet of a game.
type SpecView struct {
	MainCount         int    `json:"mainCount"`
	BonusCount        int    `json:"bonusCount"`
	MaxNumber         int    `json:"maxNumber"`
	TotalCombinations int64  `json:"totalCombinations"`
	DrawTime          string `json:"drawTime"`
	ScheduleJP        string `json:"scheduleJp"`
	ScheduleVI        string `json:"scheduleVi"`
	ScheduleEN        string `json:"scheduleEn"`
}

// RecentDraw is one official result shown in the results strip.
type RecentDraw struct {
	DrawNumber      int    `json:"drawNumber"`
	DrawDate        string `json:"drawDate"`
	DrawDayJP       string `json:"drawDayJp"`
	MainNumbers     []int  `json:"mainNumbers"`
	BonusNumbers    []int  `json:"bonusNumbers"`
	CarryoverAmount *int64 `json:"carryoverAmount"`
}

// StatsPayload is the learner statistics lab response.
type StatsPayload struct {
	Game            Game         `json:"game"`
	TotalDraws      int          `json:"totalDraws"`
	LatestDraw      string       `json:"latestDraw,omitempty"`
	EarliestDraw    string       `json:"earliestDraw,omitempty"`
	Spec            SpecView     `json:"spec"`
	Frequency       []NumberStat `json:"frequency"`
	RecentWindow    int          `json:"recentWindow"`
	HotNumbers      []int        `json:"hotNumbers"`
	ColdNumbers     []int        `json:"coldNumbers"`
	OverdueNumbers  []int        `json:"overdueNumbers"`
	OddDistribution []int        `json:"oddDistribution"`
	Sum             SumStat      `json:"sum"`
	RecentDraws     []RecentDraw `json:"recentDraws"`
	Accuracy        Accuracy     `json:"accuracy"`
	Verification    string       `json:"officialVerificationUrl"`
	GeneratedAt     string       `json:"generatedAt"`
}

type cachedStats struct {
	fingerprint string
	payload     StatsPayload
}

var (
	statsMu    sync.Mutex
	statsCache = map[Game]cachedStats{}
)

// InvalidateCaches drops cached statistics after a sync or publication.
func InvalidateCaches() {
	statsMu.Lock()
	defer statsMu.Unlock()
	statsCache = map[Game]cachedStats{}
}

func (s *Service) statsFingerprint(ctx context.Context, game Game) (string, error) {
	var draws, maxNumber int
	var drawStamp, runStamp time.Time
	var runs int
	if err := s.DB.QueryRow(ctx, `SELECT COUNT(*), COALESCE(MAX(draw_number),0), COALESCE(MAX(updated_at), 'epoch'::timestamptz)
		FROM daily.loto_draw WHERE game=$1`, string(game)).Scan(&draws, &maxNumber, &drawStamp); err != nil {
		return "", fmt.Errorf("fingerprint %s draws: %w", game, err)
	}
	if err := s.DB.QueryRow(ctx, `SELECT COUNT(*), COALESCE(MAX(updated_at), 'epoch'::timestamptz)
		FROM daily.loto_generation_run WHERE game=$1 AND status IN ('published','backtest')`, string(game)).Scan(&runs, &runStamp); err != nil {
		return "", fmt.Errorf("fingerprint %s runs: %w", game, err)
	}
	return fmt.Sprintf("%d/%d/%d/%d/%d", draws, maxNumber, drawStamp.UnixNano(), runs, runStamp.UnixNano()), nil
}

// Stats builds (and caches until the data changes) the statistics lab payload.
func (s *Service) Stats(ctx context.Context, game Game) (StatsPayload, error) {
	fingerprint, err := s.statsFingerprint(ctx, game)
	if err != nil {
		return StatsPayload{}, err
	}
	statsMu.Lock()
	cached, ok := statsCache[game]
	statsMu.Unlock()
	if ok && cached.fingerprint == fingerprint {
		return cached.payload, nil
	}

	spec := SpecFor(game)
	draws, err := LoadDraws(ctx, s.DB, game, 0)
	if err != nil {
		return StatsPayload{}, err
	}
	summary := Summarize(spec, draws)
	table := FrequencyTable(summary)
	for i := range table {
		table[i].Recent = 0
	}
	for i, draw := range draws {
		if i >= StatsWindow {
			break
		}
		for _, n := range draw.Main {
			if n >= 1 && n <= spec.MaxNumber {
				table[n-1].Recent++
			}
		}
	}

	samples, err := s.predictionSamples(ctx, game)
	if err != nil {
		return StatsPayload{}, err
	}

	payload := StatsPayload{
		Game: game, TotalDraws: len(draws),
		Spec: SpecView{
			MainCount: spec.MainCount, BonusCount: spec.BonusCount, MaxNumber: spec.MaxNumber, TotalCombinations: spec.TotalCombinations,
			DrawTime: spec.DrawTime, ScheduleJP: spec.LabelJP, ScheduleVI: spec.LabelVI, ScheduleEN: spec.LabelEN,
		},
		Frequency: table, RecentWindow: StatsWindow,
		HotNumbers: summary.Hot, ColdNumbers: summary.Cold, OverdueNumbers: summary.Overdue,
		OddDistribution: OddDistribution(spec, draws), Sum: SumDistribution(draws),
		RecentDraws: make([]RecentDraw, 0, 10), Accuracy: MeasureAccuracy(spec, samples),
		Verification: OfficialVerificationURL, GeneratedAt: s.now().UTC().Format(time.RFC3339),
	}
	if len(draws) > 0 {
		payload.LatestDraw = draws[0].DateKey
		payload.EarliestDraw = draws[len(draws)-1].DateKey
	}
	for i, draw := range draws {
		if i >= 10 {
			break
		}
		payload.RecentDraws = append(payload.RecentDraws, RecentDraw{
			DrawNumber: draw.Number, DrawDate: draw.DateKey, DrawDayJP: DayJP(draw.DateKey),
			MainNumbers: draw.Main, BonusNumbers: draw.Bonus, CarryoverAmount: draw.Carryover,
		})
	}

	statsMu.Lock()
	statsCache[game] = cachedStats{fingerprint: fingerprint, payload: payload}
	statsMu.Unlock()
	return payload, nil
}

// predictionSamples pairs each published/backtest top set with its official draw.
func (s *Service) predictionSamples(ctx context.Context, game Game) ([]PredictionSample, error) {
	rows, err := s.DB.Query(ctx, `SELECT DISTINCT ON (gr.target_draw_date) gr.status, gs.main_numbers, d.draw_number, d.draw_date, d.main_numbers, d.bonus_numbers
		FROM daily.loto_generation_run gr
		JOIN LATERAL (SELECT main_numbers FROM daily.loto_generated_set s
			WHERE s.run_id=gr.id AND s.selected_for_magazine ORDER BY rank LIMIT 1) gs ON true
		JOIN daily.loto_draw d ON d.game=gr.game AND d.draw_date=gr.target_draw_date
		WHERE gr.game=$1 AND gr.status IN ('published','backtest')
		ORDER BY gr.target_draw_date DESC, (gr.status = 'published') DESC, gr.created_at DESC LIMIT 200`, string(game))
	if err != nil {
		return nil, fmt.Errorf("load %s prediction samples: %w", game, err)
	}
	defer rows.Close()
	samples := []PredictionSample{}
	for rows.Next() {
		var sample PredictionSample
		var date time.Time
		sample.Result = Draw{Game: game}
		if err := rows.Scan(&sample.Kind, &sample.Main, &sample.Result.Number, &date, &sample.Result.Main, &sample.Result.Bonus); err != nil {
			return nil, fmt.Errorf("scan prediction sample: %w", err)
		}
		sample.DrawNumber = sample.Result.Number
		sample.Result.DateKey = date.Format(dateLayout)
		samples = append(samples, sample)
	}
	return samples, rows.Err()
}
