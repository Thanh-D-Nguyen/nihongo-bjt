package httpserver

import (
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
)

// ── P1-A6: Admin Analytics — Generic Domain Dispatch (40 routes) ────────────
// All 8 analytics sub-domains share identical endpoint structure:
//   GET  /admin/analytics/{domain}/summary
//   GET  /admin/analytics/{domain}/timeseries
//   GET  /admin/analytics/{domain}/breakdown
//   POST /admin/analytics/{domain}/export
//   POST /admin/analytics/{domain}/refresh
//
// Domains: bjt, learning, growth, content, flashcards, battle, search, system
// Contracts derived from NestJS analytics-*-admin.repository.ts files.
// Each domain maps to different source tables but shares the same response shape.

var analyticsDomains = []string{
	"bjt", "learning", "growth", "content",
	"flashcards", "battle", "search", "system",
}

// domainSourceConfig maps each analytics domain to its DB source tables and metrics.
type domainSourceConfig struct {
	SessionTable     string // primary session/attempts table
	TimeColumn       string // source event timestamp; defaults to created_at
	ScoreColumn      string // nullable score column (empty = no score metric)
	PassThreshold    int    // score threshold for pass_rate
	DurationAvail    bool   // whether duration_ms metric is available
	DurationColumn   string // optional persisted duration in milliseconds
	DurationIndex    int    // KPI index for duration; defaults to 4
	CountAllAsDone   bool   // event rows represent completed items
	SuccessPredicate string // optional success expression for event-based retention
	BreakdownDim     string // default breakdown dimension
	BreakdownSource  string // persisted source field for by_source
	ValueColumn      string // persisted numeric value used by sum-based metrics
	Metrics          []string
	KPIIDs           []string
	FreshnessTable   string
}

var domainConfigs = map[string]domainSourceConfig{
	"bjt": {
		SessionTable:   "assessment.quiz_session",
		ScoreColumn:    "estimated_score",
		PassThreshold:  70,
		DurationAvail:  true,
		BreakdownDim:   "by_section",
		Metrics:        []string{"attempts", "pass_rate"},
		KPIIDs:         []string{"mockExamsAttempted", "mockExamsCompleted", "averageScore", "passRate", "averageTimeOnTaskMs"},
		FreshnessTable: "assessment.quiz_session",
	},
	"learning": {
		SessionTable:   "learning.study_session",
		TimeColumn:     "started_at",
		ScoreColumn:    "",
		PassThreshold:  0,
		DurationAvail:  true,
		BreakdownDim:   "by_mode",
		Metrics:        []string{"sessions", "completion_rate"},
		KPIIDs:         []string{"studySessions", "completedSessions", "completionRate", "averageDurationMs", "uniqueLearners"},
		FreshnessTable: "learning.study_session",
	},
	"growth": {
		SessionTable:    "learning.study_session",
		TimeColumn:      "started_at",
		ScoreColumn:     "",
		PassThreshold:   0,
		DurationAvail:   false,
		BreakdownDim:    "by_source",
		BreakdownSource: "mode",
		ValueColumn:     "xp_earned",
		Metrics:         []string{"events", "xp_total"},
		KPIIDs:          []string{"xpEvents", "totalXpAwarded", "uniqueRecipients", "avgXpPerEvent", "streakUpdates"},
		FreshnessTable:  "learning.study_session",
	},
	"content": {
		SessionTable:   "daily.daily_radar_card",
		ScoreColumn:    "",
		PassThreshold:  0,
		DurationAvail:  false,
		BreakdownDim:   "by_category",
		Metrics:        []string{"publications", "views"},
		KPIIDs:         []string{"cardsPublished", "activeModules", "totalViews", "avgReadTime", "engagementRate"},
		FreshnessTable: "daily.daily_radar_card",
	},
	"flashcards": {
		SessionTable:     "learning.review_event",
		TimeColumn:       "reviewed_at",
		ScoreColumn:      "",
		PassThreshold:    0,
		DurationAvail:    true,
		DurationColumn:   "elapsed_ms",
		DurationIndex:    3,
		CountAllAsDone:   true,
		SuccessPredicate: "rating IN ('hard', 'good')",
		BreakdownDim:     "by_rating",
		Metrics:          []string{"reviews", "retention_rate"},
		KPIIDs:           []string{"reviewSessions", "cardsReviewed", "retentionRate", "averageDurationMs", "newCardsLearned"},
		FreshnessTable:   "learning.review_event",
	},
	"battle": {
		SessionTable:   "learning.battle_session",
		TimeColumn:     "started_at",
		ScoreColumn:    "user_score",
		PassThreshold:  0,
		DurationAvail:  false,
		BreakdownDim:   "by_mode",
		Metrics:        []string{"matches", "win_rate"},
		KPIIDs:         []string{"matchesPlayed", "completedMatches", "avgScore", "botVsPvpRatio", "abandonRate"},
		FreshnessTable: "learning.battle_session",
	},
	"search": {
		SessionTable:    "analytics.analytics_event",
		TimeColumn:      "created_at",
		ScoreColumn:     "",
		PassThreshold:   0,
		DurationAvail:   false,
		BreakdownDim:    "by_source",
		BreakdownSource: "source",
		Metrics:         []string{"queries", "click_through"},
		KPIIDs:          []string{"totalQueries", "uniqueQueries", "avgResultsCount", "clickThroughRate", "zeroResultRate"},
		FreshnessTable:  "analytics.analytics_event",
	},
	"system": {
		SessionTable:   "analytics.analytics_event",
		TimeColumn:     "created_at",
		ScoreColumn:    "",
		PassThreshold:  0,
		DurationAvail:  false,
		BreakdownDim:   "by_event_name",
		Metrics:        []string{"events", "unique_users"},
		KPIIDs:         []string{"totalEvents", "uniqueUsers", "eventTypes", "avgEventsPerUser", "errorRate"},
		FreshnessTable: "analytics.event",
	},
}

func analyticsTimeColumn(cfg domainSourceConfig) string {
	if cfg.TimeColumn != "" {
		return cfg.TimeColumn
	}
	return "created_at"
}

// parseAnalyticsRange extracts from/to/days from query params with defaults.
func parseAnalyticsRange(r *http.Request) (from, to time.Time, days int) {
	days = queryInt(r, "days", 30)
	if days < 1 || days > 365 {
		days = 30
	}
	to = time.Now().UTC()
	from = to.AddDate(0, 0, -days)
	if f := r.URL.Query().Get("from"); f != "" {
		if t, err := time.Parse(time.RFC3339, f); err == nil {
			from = t
		} else if t, err := time.Parse("2006-01-02", f); err == nil {
			from = t
		}
	}
	if t := r.URL.Query().Get("to"); t != "" {
		if parsed, err := time.Parse(time.RFC3339, t); err == nil {
			to = parsed
		} else if parsed, err := time.Parse("2006-01-02", t); err == nil {
			to = parsed.Add(24 * time.Hour)
		}
	}
	return
}

func adminGrowthAnalyticsSummary(w http.ResponseWriter, r *http.Request, db *pgxpool.Pool, logger *slog.Logger) {
	from, to, days := parseAnalyticsRange(r)
	previousFrom, previousTo := from.AddDate(0, 0, -days), from
	type metrics struct {
		events, xp, recipients int
		average                float64
	}
	read := func(start, end time.Time) (metrics, error) {
		var value metrics
		err := db.QueryRow(r.Context(), `SELECT COUNT(*) FILTER (WHERE xp_earned > 0)::int,
			COALESCE(SUM(xp_earned), 0)::int,
			COUNT(DISTINCT user_id) FILTER (WHERE xp_earned > 0)::int,
			COALESCE(AVG(xp_earned) FILTER (WHERE xp_earned > 0), 0)::float
			FROM learning.study_session WHERE started_at >= $1 AND started_at < $2`, start, end).
			Scan(&value.events, &value.xp, &value.recipients, &value.average)
		return value, err
	}
	current, err := read(from, to)
	if err != nil {
		logger.Error("read growth analytics summary", "error", err)
		writeJSONError(w, "could not read analytics summary", http.StatusInternalServerError)
		return
	}
	previous, err := read(previousFrom, previousTo)
	if err != nil {
		logger.Error("read previous growth analytics summary", "error", err)
		writeJSONError(w, "could not read analytics summary", http.StatusInternalServerError)
		return
	}
	values := []float64{float64(current.events), float64(current.xp), float64(current.recipients), current.average}
	previousValues := []float64{float64(previous.events), float64(previous.xp), float64(previous.recipients), previous.average}
	kpis := make([]map[string]any, 0, 5)
	ids := domainConfigs["growth"].KPIIDs
	for i := range values {
		kpi := map[string]any{"id": ids[i], "value": values[i], "previous": previousValues[i], "format": "int", "available": true}
		if previousValues[i] > 0 {
			kpi["deltaRatio"] = (values[i] - previousValues[i]) / previousValues[i]
		}
		if i == 3 {
			kpi["format"] = "number"
		}
		kpis = append(kpis, kpi)
	}
	kpis = append(kpis, map[string]any{"id": ids[4], "format": "int", "available": false, "unavailableCode": "metric_not_available"})
	writeJSON(w, http.StatusOK, map[string]any{
		"domain": "growth", "range": map[string]any{"from": from.Format(time.RFC3339), "to": to.Format(time.RFC3339), "days": days},
		"filtersApplied": map[string]bool{"level": false}, "kpis": kpis,
		"freshness": map[string]any{"lastRollupAt": nil, "status": "live", "sourceTable": "learning.study_session"},
	})
}

func adminLearningAnalyticsSummary(w http.ResponseWriter, r *http.Request, db *pgxpool.Pool, logger *slog.Logger) {
	from, to, days := parseAnalyticsRange(r)
	previousFrom, previousTo := from.AddDate(0, 0, -days), from
	type metrics struct {
		sessions, completed, learners int
		minutes                       float64
	}
	read := func(start, end time.Time) (metrics, error) {
		var value metrics
		err := db.QueryRow(r.Context(), `SELECT COUNT(*)::int,
			COUNT(*) FILTER (WHERE completed)::int,
			COALESCE(AVG(duration_minutes), 0)::float,
			COUNT(DISTINCT user_id)::int
			FROM learning.study_session WHERE started_at >= $1 AND started_at < $2`, start, end).
			Scan(&value.sessions, &value.completed, &value.minutes, &value.learners)
		return value, err
	}
	current, err := read(from, to)
	if err != nil {
		logger.Error("read learning analytics summary", "error", err)
		writeJSONError(w, "could not read analytics summary", http.StatusInternalServerError)
		return
	}
	previous, err := read(previousFrom, previousTo)
	if err != nil {
		logger.Error("read previous learning analytics summary", "error", err)
		writeJSONError(w, "could not read analytics summary", http.StatusInternalServerError)
		return
	}
	completion, previousCompletion := 0.0, 0.0
	if current.sessions > 0 {
		completion = float64(current.completed) / float64(current.sessions)
	}
	if previous.sessions > 0 {
		previousCompletion = float64(previous.completed) / float64(previous.sessions)
	}
	values := []float64{float64(current.sessions), float64(current.completed), completion, current.minutes * 60000, float64(current.learners)}
	previousValues := []float64{float64(previous.sessions), float64(previous.completed), previousCompletion, previous.minutes * 60000, float64(previous.learners)}
	ids := domainConfigs["learning"].KPIIDs
	kpis := make([]map[string]any, 0, len(ids))
	for i, id := range ids {
		available := true
		kpi := map[string]any{"id": id, "value": values[i], "previous": previousValues[i], "format": "int", "available": available}
		if i == 2 {
			kpi["format"] = "percent"
			if current.sessions == 0 {
				kpi["available"] = false
				kpi["value"] = nil
				kpi["unavailableCode"] = "no_completed_sessions"
			}
		}
		if i == 3 {
			kpi["format"] = "duration_ms"
			if current.sessions == 0 {
				kpi["available"] = false
				kpi["value"] = nil
				kpi["unavailableCode"] = "no_completed_sessions"
			}
		}
		if previousValues[i] > 0 {
			kpi["deltaRatio"] = (values[i] - previousValues[i]) / previousValues[i]
		}
		kpis = append(kpis, kpi)
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"domain": "learning", "range": map[string]any{"from": from.Format(time.RFC3339), "to": to.Format(time.RFC3339), "days": days},
		"filtersApplied": map[string]bool{"level": false}, "kpis": kpis,
		"freshness": map[string]any{"lastRollupAt": nil, "status": "live", "sourceTable": "learning.study_session"},
	})
}

func adminSearchAnalyticsSummary(w http.ResponseWriter, r *http.Request, db *pgxpool.Pool, logger *slog.Logger) {
	from, to, days := parseAnalyticsRange(r)
	previousFrom, previousTo := from.AddDate(0, 0, -days), from
	type metrics struct {
		queries, uniqueQueries, zeroResults int
		averageResults                      float64
	}
	read := func(start, end time.Time) (metrics, error) {
		var value metrics
		err := db.QueryRow(r.Context(), `SELECT COUNT(*)::int,
			COUNT(DISTINCT NULLIF(payload->>'query', ''))::int,
			COALESCE(AVG(CASE WHEN payload->>'resultCount' ~ '^[0-9]+$' THEN (payload->>'resultCount')::float END), 0)::float,
			COUNT(*) FILTER (WHERE payload->>'resultCount' = '0')::int
			FROM analytics.analytics_event
			WHERE event_name = 'content_search_submitted' AND created_at >= $1 AND created_at < $2`, start, end).
			Scan(&value.queries, &value.uniqueQueries, &value.averageResults, &value.zeroResults)
		return value, err
	}
	current, err := read(from, to)
	if err != nil {
		logger.Error("read search analytics summary", "error", err)
		writeJSONError(w, "could not read analytics summary", http.StatusInternalServerError)
		return
	}
	previous, err := read(previousFrom, previousTo)
	if err != nil {
		logger.Error("read previous search analytics summary", "error", err)
		writeJSONError(w, "could not read analytics summary", http.StatusInternalServerError)
		return
	}
	values := []float64{float64(current.queries), float64(current.uniqueQueries), current.averageResults, 0, 0}
	previousValues := []float64{float64(previous.queries), float64(previous.uniqueQueries), previous.averageResults, 0, 0}
	ids := domainConfigs["search"].KPIIDs
	kpis := make([]map[string]any, 0, len(ids))
	for i, id := range ids {
		format := "int"
		available := true
		var value, previousValue any = values[i], previousValues[i]
		unavailableCode := ""
		switch i {
		case 2:
			format = "number"
			if current.queries == 0 {
				available, value, unavailableCode = false, nil, "no_search_data"
			}
		case 3:
			format, available, value, previousValue, unavailableCode = "percent", false, nil, nil, "click_events_not_tracked"
		case 4:
			format = "percent"
			if current.queries == 0 {
				available, value, unavailableCode = false, nil, "no_search_data"
			} else {
				values[i] = float64(current.zeroResults) / float64(current.queries)
				value = values[i]
			}
			if previous.queries > 0 {
				previousValues[i] = float64(previous.zeroResults) / float64(previous.queries)
				previousValue = previousValues[i]
			} else {
				previousValue = nil
			}
		}
		kpi := map[string]any{"id": id, "format": format, "available": available}
		if value != nil {
			kpi["value"] = value
		}
		if previousValue != nil {
			kpi["previous"] = previousValue
			if available && values[i] != 0 && previousValues[i] > 0 {
				kpi["deltaRatio"] = (values[i] - previousValues[i]) / previousValues[i]
			}
		}
		if unavailableCode != "" {
			kpi["unavailableCode"] = unavailableCode
		}
		kpis = append(kpis, kpi)
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"domain": "search", "range": map[string]any{"from": from.Format(time.RFC3339), "to": to.Format(time.RFC3339), "days": days},
		"filtersApplied": map[string]bool{"level": false}, "kpis": kpis,
		"freshness": map[string]any{"lastRollupAt": nil, "status": "live", "sourceTable": "analytics.analytics_event"},
	})
}

func adminSystemAnalyticsSummary(w http.ResponseWriter, r *http.Request, db *pgxpool.Pool, logger *slog.Logger) {
	from, to, days := parseAnalyticsRange(r)
	previousFrom, previousTo := from.AddDate(0, 0, -days), from
	type metrics struct {
		events, users, eventTypes int
		average                   float64
	}
	read := func(start, end time.Time) (metrics, error) {
		var value metrics
		err := db.QueryRow(r.Context(), `SELECT COUNT(*)::int,
			COUNT(DISTINCT COALESCE(user_id::text, anonymous_id))::int,
			COUNT(DISTINCT event_name)::int
			FROM analytics.analytics_event WHERE created_at >= $1 AND created_at < $2`, start, end).
			Scan(&value.events, &value.users, &value.eventTypes)
		if err == nil && value.users > 0 {
			value.average = float64(value.events) / float64(value.users)
		}
		return value, err
	}
	current, err := read(from, to)
	if err != nil {
		logger.Error("read system analytics summary", "error", err)
		writeJSONError(w, "could not read analytics summary", http.StatusInternalServerError)
		return
	}
	previous, err := read(previousFrom, previousTo)
	if err != nil {
		logger.Error("read previous system analytics summary", "error", err)
		writeJSONError(w, "could not read analytics summary", http.StatusInternalServerError)
		return
	}
	values := []float64{float64(current.events), float64(current.users), float64(current.eventTypes), current.average}
	previousValues := []float64{float64(previous.events), float64(previous.users), float64(previous.eventTypes), previous.average}
	ids := domainConfigs["system"].KPIIDs
	kpis := make([]map[string]any, 0, len(ids))
	for i := range values {
		format, available := "int", true
		var value, previousValue any = values[i], previousValues[i]
		unavailableCode := ""
		if i == 3 {
			format = "number"
			if current.users == 0 {
				available, value, unavailableCode = false, nil, "no_event_users"
			}
			if previous.users == 0 {
				previousValue = nil
			}
		}
		kpi := map[string]any{"id": ids[i], "format": format, "available": available}
		if value != nil {
			kpi["value"] = value
		}
		if previousValue != nil {
			kpi["previous"] = previousValue
			if available && previousValues[i] > 0 {
				kpi["deltaRatio"] = (values[i] - previousValues[i]) / previousValues[i]
			}
		}
		if unavailableCode != "" {
			kpi["unavailableCode"] = unavailableCode
		}
		kpis = append(kpis, kpi)
	}
	kpis = append(kpis, map[string]any{"id": ids[4], "format": "percent", "available": false, "unavailableCode": "error_events_not_tracked"})
	writeJSON(w, http.StatusOK, map[string]any{
		"domain": "system", "range": map[string]any{"from": from.Format(time.RFC3339), "to": to.Format(time.RFC3339), "days": days},
		"filtersApplied": map[string]bool{"level": false}, "kpis": kpis,
		"freshness": map[string]any{"lastRollupAt": nil, "status": "live", "sourceTable": "analytics.analytics_event"},
	})
}

// adminAnalyticsSummaryHandler implements GET /api/admin/analytics/{domain}/summary.
func adminAnalyticsSummaryHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		domain := extractPathParam(r.URL.Path, "analytics", 1)
		cfg, ok := domainConfigs[domain]
		if !ok {
			writeJSONError(w, "unknown analytics domain", http.StatusBadRequest)
			return
		}
		if domain == "growth" {
			adminGrowthAnalyticsSummary(w, r, db, logger)
			return
		}
		if domain == "learning" {
			adminLearningAnalyticsSummary(w, r, db, logger)
			return
		}
		if domain == "search" {
			adminSearchAnalyticsSummary(w, r, db, logger)
			return
		}
		if domain == "system" {
			adminSystemAnalyticsSummary(w, r, db, logger)
			return
		}
		timeColumn := analyticsTimeColumn(cfg)
		ctx := r.Context()
		from, to, days := parseAnalyticsRange(r)
		prevFrom := from.AddDate(0, 0, -days)
		prevTo := from
		level := r.URL.Query().Get("level")

		type KPI struct {
			ID              string   `json:"id"`
			Value           *float64 `json:"value,omitempty"`
			Previous        *float64 `json:"previous,omitempty"`
			DeltaRatio      *float64 `json:"deltaRatio,omitempty"`
			Format          string   `json:"format"`
			Available       bool     `json:"available"`
			UnavailableCode *string  `json:"unavailableCode,omitempty"`
		}

		kpis := make([]KPI, len(cfg.KPIIDs))
		for i, id := range cfg.KPIIDs {
			kpis[i] = KPI{ID: id, Format: "int", Available: true}
		}
		if domain == "flashcards" {
			for _, index := range []int{2, 3, 4} {
				kpis[index].Available = false
				code := "no_review_data"
				if index == 4 {
					code = "metric_not_available"
				}
				kpis[index].UnavailableCode = &code
			}
		}

		// Current period counts
		whereLevel := ""
		args := []any{from, to}
		argIdx := 3
		if level != "" && cfg.ScoreColumn != "" {
			whereLevel = fmt.Sprintf(" AND estimated_bjt_band = $%d", argIdx)
			args = append(args, level)
			argIdx++
		}

		var currentCount, prevCount int
		db.QueryRow(ctx, fmt.Sprintf("SELECT COUNT(*) FROM %s WHERE %s >= $1 AND %s < $2%s", cfg.SessionTable, timeColumn, timeColumn, whereLevel), args...).Scan(&currentCount)
		prevArgs := []any{prevFrom, prevTo}
		if level != "" && cfg.ScoreColumn != "" {
			prevArgs = append(prevArgs, level)
		}
		db.QueryRow(ctx, fmt.Sprintf("SELECT COUNT(*) FROM %s WHERE %s >= $1 AND %s < $2%s", cfg.SessionTable, timeColumn, timeColumn, whereLevel), prevArgs...).Scan(&prevCount)

		if len(kpis) > 0 {
			v := float64(currentCount)
			pv := float64(prevCount)
			kpis[0].Value = &v
			kpis[0].Previous = &pv
			if pv > 0 {
				d := (v - pv) / pv
				kpis[0].DeltaRatio = &d
			}
		}

		// Completed count (if applicable)
		if len(kpis) > 1 {
			var completedCurrent, completedPrev int
			if cfg.CountAllAsDone {
				completedCurrent, completedPrev = currentCount, prevCount
			} else {
				db.QueryRow(ctx, fmt.Sprintf("SELECT COUNT(*) FROM %s WHERE %s >= $1 AND %s < $2 AND status = 'completed'%s", cfg.SessionTable, timeColumn, timeColumn, whereLevel), args...).Scan(&completedCurrent)
				db.QueryRow(ctx, fmt.Sprintf("SELECT COUNT(*) FROM %s WHERE %s >= $1 AND %s < $2 AND status = 'completed'%s", cfg.SessionTable, timeColumn, timeColumn, whereLevel), prevArgs...).Scan(&completedPrev)
			}
			v := float64(completedCurrent)
			pv := float64(completedPrev)
			kpis[1].Value = &v
			kpis[1].Previous = &pv
			if pv > 0 {
				d := (v - pv) / pv
				kpis[1].DeltaRatio = &d
			}
		}

		// Score-based KPIs (averageScore, passRate)
		if cfg.ScoreColumn != "" && len(kpis) > 3 {
			var avgScore, avgScorePrev float64
			var scoreCount, scoreCountPrev int
			var passRate, passRatePrev float64
			db.QueryRow(ctx, fmt.Sprintf(`
				SELECT COALESCE(AVG(%s), 0)::float, COUNT(*)::int,
				       COALESCE(SUM(CASE WHEN %s >= %d THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0), 0)
				FROM %s WHERE %s >= $1 AND %s < $2 AND %s IS NOT NULL%s`,
				cfg.ScoreColumn, cfg.ScoreColumn, cfg.PassThreshold, cfg.SessionTable, timeColumn, timeColumn, cfg.ScoreColumn, whereLevel), args...).Scan(&avgScore, &scoreCount, &passRate)
			db.QueryRow(ctx, fmt.Sprintf(`
				SELECT COALESCE(AVG(%s), 0)::float, COUNT(*)::int,
				       COALESCE(SUM(CASE WHEN %s >= %d THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0), 0)
				FROM %s WHERE %s >= $1 AND %s < $2 AND %s IS NOT NULL%s`,
				cfg.ScoreColumn, cfg.ScoreColumn, cfg.PassThreshold, cfg.SessionTable, timeColumn, timeColumn, cfg.ScoreColumn, whereLevel), prevArgs...).Scan(&avgScorePrev, &scoreCountPrev, &passRatePrev)

			if scoreCount > 0 {
				kpis[2].Value = &avgScore
				kpis[2].Format = "percent"
				if scoreCountPrev > 0 {
					kpis[2].Previous = &avgScorePrev
				} else {
					kpis[2].Available = false
					code := "no_completed_sessions"
					kpis[2].UnavailableCode = &code
				}
				kpis[3].Value = &passRate
				kpis[3].Format = "percent"
				if scoreCountPrev > 0 {
					kpis[3].Previous = &passRatePrev
				} else {
					kpis[3].Available = false
					code := "no_completed_sessions"
					kpis[3].UnavailableCode = &code
				}
			} else {
				kpis[2].Available = false
				code := "no_completed_sessions"
				kpis[2].UnavailableCode = &code
				kpis[3].Available = false
				kpis[3].UnavailableCode = &code
			}
		}

		if cfg.SuccessPredicate != "" && len(kpis) > 2 {
			var count, successful, previousCount, previousSuccessful int
			query := fmt.Sprintf("SELECT COUNT(*)::int, COUNT(*) FILTER (WHERE %s)::int FROM %s WHERE %s >= $1 AND %s < $2", cfg.SuccessPredicate, cfg.SessionTable, timeColumn, timeColumn)
			db.QueryRow(ctx, query, from, to).Scan(&count, &successful)
			db.QueryRow(ctx, query, prevFrom, prevTo).Scan(&previousCount, &previousSuccessful)
			if count > 0 {
				value := float64(successful) / float64(count)
				kpis[2].Value, kpis[2].Format, kpis[2].Available, kpis[2].UnavailableCode = &value, "percent", true, nil
				if previousCount > 0 {
					previous := float64(previousSuccessful) / float64(previousCount)
					kpis[2].Previous = &previous
				}
			} else {
				kpis[2].Available = false
				code := "no_review_data"
				kpis[2].UnavailableCode = &code
			}
		}

		// Duration KPI (if available)
		durationIndex := cfg.DurationIndex
		if durationIndex == 0 {
			durationIndex = 4
		}
		if cfg.DurationAvail && len(kpis) > durationIndex {
			var avgMs float64
			var durCount int
			durationExpr, durationFilter := "EXTRACT(EPOCH FROM (updated_at - created_at)) * 1000", "updated_at IS NOT NULL"
			if cfg.DurationColumn != "" {
				durationExpr, durationFilter = cfg.DurationColumn, cfg.DurationColumn+" IS NOT NULL"
			}
			db.QueryRow(ctx, fmt.Sprintf(`
				SELECT COALESCE(AVG(%s), 0)::float, COUNT(*)::int
				FROM %s WHERE %s >= $1 AND %s < $2 AND %s%s`,
				durationExpr, cfg.SessionTable, timeColumn, timeColumn, durationFilter, whereLevel), args...).Scan(&avgMs, &durCount)
			if durCount > 0 {
				kpis[durationIndex].Value = &avgMs
				kpis[durationIndex].Format = "duration_ms"
				kpis[durationIndex].Available = true
				kpis[durationIndex].UnavailableCode = nil
			} else {
				kpis[durationIndex].Available = false
				code := "no_completed_sessions"
				kpis[durationIndex].UnavailableCode = &code
			}
		}

		// Freshness
		var lastRollupAt *string
		var freshnessStatus *string
		if err := db.QueryRow(ctx, "SELECT completed_at, status FROM analytics.rollup_run ORDER BY started_at DESC LIMIT 1").Scan(&lastRollupAt, &freshnessStatus); err != nil && !errors.Is(err, pgx.ErrNoRows) {
			logger.Error("read analytics rollup freshness", "error", err, "domain", domain)
			writeJSONError(w, "could not read analytics freshness", http.StatusInternalServerError)
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"domain":         domain,
			"range":          map[string]any{"from": from.Format(time.RFC3339), "to": to.Format(time.RFC3339), "days": days},
			"filtersApplied": map[string]bool{"level": level != ""},
			"kpis":           kpis,
			"freshness":      map[string]any{"lastRollupAt": lastRollupAt, "status": freshnessStatus, "sourceTable": cfg.FreshnessTable},
		})
	}
}

// adminAnalyticsTimeseriesHandler implements GET /api/admin/analytics/{domain}/timeseries.
func adminAnalyticsTimeseriesHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		domain := extractPathParam(r.URL.Path, "analytics", 1)
		cfg, ok := domainConfigs[domain]
		if !ok {
			writeJSONError(w, "unknown analytics domain", http.StatusBadRequest)
			return
		}
		timeColumn := analyticsTimeColumn(cfg)
		ctx := r.Context()
		from, to, days := parseAnalyticsRange(r)
		metric := r.URL.Query().Get("metric")
		if metric == "" {
			metric = cfg.Metrics[0]
		}
		if domain == "search" && metric == "click_through" {
			writeJSON(w, http.StatusOK, map[string]any{"domain": domain, "granularity": "day", "metric": metric, "notice": "click_events_not_tracked", "series": []any{}})
			return
		}
		granularity := r.URL.Query().Get("granularity")
		if granularity == "" {
			granularity = "day"
		}

		if granularity != "day" {
			writeJSON(w, http.StatusOK, map[string]any{
				"domain":      domain,
				"granularity": granularity,
				"metric":      metric,
				"notice":      "granularity_not_supported",
				"series":      []any{},
			})
			return
		}

		// Generate day buckets
		type Point struct {
			T     string  `json:"t"`
			Value float64 `json:"value"`
		}
		var series []Point
		current := from.Truncate(24 * time.Hour)
		end := to.Truncate(24 * time.Hour)
		for !current.After(end) {
			dayStart := current
			dayEnd := current.Add(24 * time.Hour)
			var val float64

			switch metric {
			case "attempts", "sessions", "events", "matches", "queries", "publications", "reviews":
				filter := ""
				if domain == "growth" {
					filter = " AND xp_earned > 0"
				} else if domain == "search" {
					filter = " AND event_name = 'content_search_submitted'"
				}
				err := db.QueryRow(ctx, fmt.Sprintf("SELECT COUNT(*)::float FROM %s WHERE %s >= $1 AND %s < $2%s", cfg.SessionTable, timeColumn, timeColumn, filter), dayStart, dayEnd).Scan(&val)
				if err != nil && domain == "growth" {
					logger.Error("read growth analytics timeseries", "error", err)
					writeJSONError(w, "could not read analytics timeseries", http.StatusInternalServerError)
					return
				}
			case "pass_rate", "completion_rate", "retention_rate", "win_rate", "click_through":
				if domain == "learning" {
					var total, completed float64
					err := db.QueryRow(ctx, `SELECT COUNT(*)::float, COUNT(*) FILTER (WHERE completed)::float
						FROM learning.study_session WHERE started_at >= $1 AND started_at < $2`, dayStart, dayEnd).Scan(&total, &completed)
					if err != nil {
						logger.Error("read learning completion timeseries", "error", err)
						writeJSONError(w, "could not read analytics timeseries", http.StatusInternalServerError)
						return
					}
					if total > 0 {
						val = completed / total
					}
				} else if cfg.ScoreColumn != "" {
					var total, passed float64
					db.QueryRow(ctx, fmt.Sprintf(`
						SELECT COUNT(*)::float,
						       COALESCE(SUM(CASE WHEN %s >= %d THEN 1 ELSE 0 END)::float, 0)
						FROM %s WHERE %s >= $1 AND %s < $2 AND %s IS NOT NULL`,
						cfg.ScoreColumn, cfg.PassThreshold, cfg.SessionTable, timeColumn, timeColumn, cfg.ScoreColumn), dayStart, dayEnd).Scan(&total, &passed)
					if total > 0 {
						val = passed / total
					}
				} else if cfg.SuccessPredicate != "" {
					var total, successful float64
					db.QueryRow(ctx, fmt.Sprintf(`
						SELECT COUNT(*)::float,
						       COUNT(*) FILTER (WHERE %s)::float
						FROM %s WHERE %s >= $1 AND %s < $2`,
						cfg.SuccessPredicate, cfg.SessionTable, timeColumn, timeColumn), dayStart, dayEnd).Scan(&total, &successful)
					if total > 0 {
						val = successful / total
					}
				} else {
					// For non-score domains, use completion ratio
					var total, completed float64
					db.QueryRow(ctx, fmt.Sprintf(`
						SELECT COUNT(*)::float,
						       COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)::float, 0)
						FROM %s WHERE %s >= $1 AND %s < $2`, cfg.SessionTable, timeColumn, timeColumn), dayStart, dayEnd).Scan(&total, &completed)
					if total > 0 {
						val = completed / total
					}
				}
			case "xp_total":
				valueColumn := cfg.ValueColumn
				if valueColumn == "" {
					valueColumn = "amount"
				}
				err := db.QueryRow(ctx, fmt.Sprintf("SELECT COALESCE(SUM(%s), 0)::float FROM %s WHERE %s >= $1 AND %s < $2", valueColumn, cfg.SessionTable, timeColumn, timeColumn), dayStart, dayEnd).Scan(&val)
				if err != nil && domain == "growth" {
					logger.Error("read growth XP timeseries", "error", err)
					writeJSONError(w, "could not read analytics timeseries", http.StatusInternalServerError)
					return
				}
			default:
				db.QueryRow(ctx, fmt.Sprintf("SELECT COUNT(*)::float FROM %s WHERE %s >= $1 AND %s < $2", cfg.SessionTable, timeColumn, timeColumn), dayStart, dayEnd).Scan(&val)
			}

			series = append(series, Point{T: dayStart.Format("2006-01-02"), Value: val})
			current = dayEnd
		}
		if series == nil {
			series = []Point{}
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"domain":      domain,
			"granularity": granularity,
			"metric":      metric,
			"range":       map[string]any{"from": from.Format(time.RFC3339), "to": to.Format(time.RFC3339), "days": days},
			"series":      series,
		})
	}
}

// adminAnalyticsBreakdownHandler implements GET /api/admin/analytics/{domain}/breakdown.
func adminAnalyticsBreakdownHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		domain := extractPathParam(r.URL.Path, "analytics", 1)
		cfg, ok := domainConfigs[domain]
		if !ok {
			writeJSONError(w, "unknown analytics domain", http.StatusBadRequest)
			return
		}
		timeColumn := analyticsTimeColumn(cfg)
		ctx := r.Context()
		from, to, _ := parseAnalyticsRange(r)
		dimension := r.URL.Query().Get("dimension")
		if dimension == "" {
			dimension = cfg.BreakdownDim
		}
		page := queryInt(r, "page", 1)
		pageSize := queryInt(r, "pageSize", 20)
		if page < 1 {
			page = 1
		}
		if pageSize < 1 || pageSize > 100 {
			pageSize = 20
		}
		offset := (page - 1) * pageSize

		type Row struct {
			Label    string  `json:"label,omitempty"`
			Key      string  `json:"key,omitempty"`
			Attempts int     `json:"attempts"`
			AvgScore float64 `json:"averageScore,omitempty"`
			PassRate float64 `json:"passRate,omitempty"`
			Accuracy float64 `json:"accuracy,omitempty"`
		}

		var rows []Row
		var total int

		// Generic breakdown: group by a relevant column depending on domain/dimension
		groupCol := "status"
		switch dimension {
		case "by_section", "by_skill":
			groupCol = "COALESCE(skill_tag, '(unknown)')"
		case "by_test":
			groupCol = "test_id"
		case "by_subject":
			groupCol = "COALESCE(subject, '(unknown)')"
		case "by_source":
			groupCol = "COALESCE(source, '(unknown)')"
			if cfg.BreakdownSource != "" {
				groupCol = "COALESCE(" + cfg.BreakdownSource + ", '(unknown)')"
			}
		case "by_category":
			groupCol = "COALESCE(category, '(unknown)')"
		case "by_deck":
			groupCol = "deck_id"
		case "by_rating":
			groupCol = "rating"
		case "by_mode":
			groupCol = "COALESCE(mode, '(unknown)')"
		case "by_locale":
			groupCol = "COALESCE(locale, '(unknown)')"
		case "by_event_name":
			groupCol = "COALESCE(event_name, '(unknown)')"
		}

		attemptExpr := "COUNT(*)::int"
		if domain == "growth" {
			attemptExpr = "COALESCE(SUM(xp_earned), 0)::int"
		}
		eventFilter := ""
		if domain == "search" {
			eventFilter = " AND event_name = 'content_search_submitted'"
		}
		query := fmt.Sprintf(`
			SELECT %s as label, %s as attempts
			FROM %s
			WHERE %s >= $1 AND %s < $2%s
			GROUP BY %s
			ORDER BY attempts DESC
			LIMIT $3 OFFSET $4`, groupCol, attemptExpr, cfg.SessionTable, timeColumn, timeColumn, eventFilter, groupCol)

		countQuery := fmt.Sprintf(`
			SELECT COUNT(DISTINCT %s)::int FROM %s
			WHERE %s >= $1 AND %s < $2%s`, groupCol, cfg.SessionTable, timeColumn, timeColumn, eventFilter)

		if err := db.QueryRow(ctx, countQuery, from, to).Scan(&total); err != nil {
			logger.Error("count analytics breakdown", "error", err, "domain", domain)
			writeJSONError(w, "could not read analytics breakdown", http.StatusInternalServerError)
			return
		}

		dbRows, err := db.Query(ctx, query, from, to, pageSize, offset)
		if err == nil {
			defer dbRows.Close()
			for dbRows.Next() {
				var row Row
				var label string
				var attempts int
				if dbRows.Scan(&label, &attempts) == nil {
					row.Label = label
					row.Key = label
					row.Attempts = attempts
					rows = append(rows, row)
				}
			}
		} else {
			logger.Error("read analytics breakdown", "error", err, "domain", domain)
			writeJSONError(w, "could not read analytics breakdown", http.StatusInternalServerError)
			return
		}
		if rows == nil {
			rows = []Row{}
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"domain":    domain,
			"dimension": dimension,
			"page":      page,
			"pageSize":  pageSize,
			"total":     total,
			"rows":      rows,
		})
	}
}

// adminAnalyticsExportHandler implements POST /api/admin/analytics/{domain}/export.
func adminAnalyticsExportHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		domain := extractPathParam(r.URL.Path, "analytics", 1)
		_, ok := domainConfigs[domain]
		if !ok {
			writeJSONError(w, "unknown analytics domain", http.StatusBadRequest)
			return
		}

		var body struct {
			View string `json:"view"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil && !errors.Is(err, io.EOF) {
			writeJSONError(w, "invalid export request", http.StatusBadRequest)
			return
		}
		if body.View == "" {
			body.View = "summary"
		}

		var csvData [][]string
		child := r.Clone(r.Context())
		child.URL = new(url.URL)
		*child.URL = *r.URL
		switch body.View {
		case "summary":
			child.URL.Path = "/api/admin/analytics/" + domain + "/summary"
			recorder := httptest.NewRecorder()
			adminAnalyticsSummaryHandler(db, logger).ServeHTTP(recorder, child)
			if recorder.Code != http.StatusOK {
				writeJSON(w, recorder.Code, json.RawMessage(recorder.Body.Bytes()))
				return
			}
			var result struct {
				KPIs []struct {
					ID         string   `json:"id"`
					Value      *float64 `json:"value"`
					Previous   *float64 `json:"previous"`
					DeltaRatio *float64 `json:"deltaRatio"`
					Format     string   `json:"format"`
					Available  bool     `json:"available"`
				} `json:"kpis"`
			}
			if err := json.NewDecoder(recorder.Body).Decode(&result); err != nil {
				writeJSONError(w, "could not encode analytics summary", http.StatusInternalServerError)
				return
			}
			csvData = [][]string{{"id", "value", "previous", "deltaRatio", "format", "available"}}
			for _, kpi := range result.KPIs {
				csvData = append(csvData, []string{kpi.ID, csvFloat(kpi.Value), csvFloat(kpi.Previous), csvFloat(kpi.DeltaRatio), kpi.Format, strconv.FormatBool(kpi.Available)})
			}
		case "timeseries":
			child.URL.Path = "/api/admin/analytics/" + domain + "/timeseries"
			recorder := httptest.NewRecorder()
			adminAnalyticsTimeseriesHandler(db, logger).ServeHTTP(recorder, child)
			if recorder.Code != http.StatusOK {
				writeJSON(w, recorder.Code, json.RawMessage(recorder.Body.Bytes()))
				return
			}
			var result struct {
				Series []struct {
					T     string  `json:"t"`
					Value float64 `json:"value"`
				} `json:"series"`
			}
			if err := json.NewDecoder(recorder.Body).Decode(&result); err != nil {
				writeJSONError(w, "could not encode analytics timeseries", http.StatusInternalServerError)
				return
			}
			csvData = [][]string{{"t", "value"}}
			for _, point := range result.Series {
				csvData = append(csvData, []string{point.T, strconv.FormatFloat(point.Value, 'f', -1, 64)})
			}
		case "breakdown":
			child.URL.Path = "/api/admin/analytics/" + domain + "/breakdown"
			recorder := httptest.NewRecorder()
			adminAnalyticsBreakdownHandler(db, logger).ServeHTTP(recorder, child)
			if recorder.Code != http.StatusOK {
				writeJSON(w, recorder.Code, json.RawMessage(recorder.Body.Bytes()))
				return
			}
			var result struct {
				Rows []struct {
					Label    string  `json:"label"`
					Key      string  `json:"key"`
					Attempts int     `json:"attempts"`
					AvgScore float64 `json:"averageScore"`
					PassRate float64 `json:"passRate"`
					Accuracy float64 `json:"accuracy"`
				} `json:"rows"`
			}
			if err := json.NewDecoder(recorder.Body).Decode(&result); err != nil {
				writeJSONError(w, "could not encode analytics breakdown", http.StatusInternalServerError)
				return
			}
			csvData = [][]string{{"label", "key", "attempts", "averageScore", "passRate", "accuracy"}}
			for _, row := range result.Rows {
				csvData = append(csvData, []string{row.Label, row.Key, strconv.Itoa(row.Attempts), strconv.FormatFloat(row.AvgScore, 'f', -1, 64), strconv.FormatFloat(row.PassRate, 'f', -1, 64), strconv.FormatFloat(row.Accuracy, 'f', -1, 64)})
			}
		default:
			writeJSONError(w, "unsupported analytics export view", http.StatusBadRequest)
			return
		}

		filename := fmt.Sprintf("analytics-%s-%s-%s.csv", domain, body.View, time.Now().UTC().Format("2006-01-02"))
		w.Header().Set("Content-Type", "text/csv; charset=utf-8")
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
		cw := csv.NewWriter(w)
		for _, row := range csvData {
			cw.Write(row)
		}
		cw.Flush()
	}
}

func csvFloat(value *float64) string {
	if value == nil {
		return ""
	}
	return strconv.FormatFloat(*value, 'f', -1, 64)
}

// adminAnalyticsRefreshHandler implements POST /api/admin/analytics/{domain}/refresh.
func adminAnalyticsRefreshHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		domain := extractPathParam(r.URL.Path, "analytics", 1)
		_, domainOk := domainConfigs[domain]
		if !domainOk {
			writeJSONError(w, "unknown analytics domain", http.StatusBadRequest)
			return
		}

		var body struct {
			Reason string `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil && !errors.Is(err, io.EOF) {
			writeJSONError(w, "invalid refresh request", http.StatusBadRequest)
			return
		}

		ctx := r.Context()
		now := time.Now().UTC()

		var runID string
		err := db.QueryRow(ctx, `
			INSERT INTO analytics.rollup_run (name, status, window_start, window_end, metrics, details, started_at)
			VALUES ($1, 'accepted', $2, $2, 0,
			        jsonb_build_object('requestedBy', $3::text, 'reason', $4::text), $2)
			RETURNING id`, domain, now, identity.ActorID, body.Reason).Scan(&runID)
		if err != nil {
			logger.Error("record analytics refresh", "error", err, "domain", domain)
			writeJSONError(w, "could not record analytics refresh", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusAccepted)
		writeJSON(w, http.StatusAccepted, map[string]any{
			"runId":       runID,
			"domain":      domain,
			"reason":      body.Reason,
			"requestedAt": now.Format(time.RFC3339),
			"status":      "accepted",
		})
	}
}

// adminAnalyticsExecutiveHandler implements GET /api/admin/analytics.
// Returns an aggregate executive dashboard response matching the frontend
// AdminAnalyticsExecutiveResponse contract (apps/admin/lib/admin-overview-types.ts).
func adminAnalyticsExecutiveHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		from, to, days := parseAnalyticsRange(r)
		prevFrom := from.AddDate(0, 0, -days)
		prevTo := from

		type kpiModel struct {
			Available       bool     `json:"available"`
			DeltaRatio      *float64 `json:"deltaRatio"`
			Format          string   `json:"format"`
			Previous        *float64 `json:"previous"`
			Value           *float64 `json:"value"`
			UnavailableCode *string  `json:"unavailableCode,omitempty"`
		}
		newKPI := func(v, p float64, format string) kpiModel {
			k := kpiModel{Available: true, Format: format, Value: &v, Previous: &p}
			if p > 0 {
				d := (v - p) / p
				k.DeltaRatio = &d
			}
			return k
		}
		unavail := func(code string) kpiModel {
			return kpiModel{Available: false, Format: "int", UnavailableCode: &code}
		}

		countRows := func(query string, f, t time.Time) (int, error) {
			var n int
			err := db.QueryRow(ctx, query, f, t).Scan(&n)
			return n, err
		}
		countUsers := func(f, t time.Time) (int, error) {
			return countRows("SELECT COUNT(DISTINCT user_id) FROM learning.study_session WHERE started_at >= $1 AND started_at < $2", f, t)
		}
		pair := func(query string) (int, int, error) {
			current, err := countRows(query, from, to)
			if err != nil {
				return 0, 0, err
			}
			previous, err := countRows(query, prevFrom, prevTo)
			return current, previous, err
		}
		fail := func(label string, err error) {
			logger.Error("admin analytics executive query", "query", label, "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
		}
		dauCur, dauPrev, err := pair("SELECT COUNT(DISTINCT user_id) FROM learning.study_session WHERE started_at >= $1 AND started_at < $2")
		if err != nil {
			fail("active learners", err)
			return
		}
		wauCur, err := countUsers(to.AddDate(0, 0, -7), to)
		if err != nil {
			fail("WAU", err)
			return
		}
		wauPrev, err := countUsers(prevTo.AddDate(0, 0, -7), prevTo)
		if err != nil {
			fail("previous WAU", err)
			return
		}
		mauCur, err := countUsers(to.AddDate(0, -1, 0), to)
		if err != nil {
			fail("MAU", err)
			return
		}
		mauPrev, err := countUsers(prevTo.AddDate(0, -1, 0), prevTo)
		if err != nil {
			fail("previous MAU", err)
			return
		}
		bjtCur, bjtPrev, err := pair("SELECT COUNT(*) FROM assessment.quiz_session WHERE status = 'completed' AND completed_at >= $1 AND completed_at < $2")
		if err != nil {
			fail("BJT completions", err)
			return
		}
		flashCur, flashPrev, err := pair("SELECT COUNT(*) FROM learning.review_event WHERE reviewed_at >= $1 AND reviewed_at < $2")
		if err != nil {
			fail("flashcard reviews", err)
			return
		}
		newUsersCur, newUsersPrev, err := pair("SELECT COUNT(*) FROM profile.user_profile WHERE created_at >= $1 AND created_at < $2")
		if err != nil {
			fail("new learners", err)
			return
		}
		var searchTotal, searchZero int
		searchQuery := `SELECT COUNT(*), COUNT(*) FILTER (WHERE CASE WHEN payload->>'resultCount' ~ '^[0-9]+$' THEN (payload->>'resultCount')::int ELSE 0 END = 0)
			FROM analytics.analytics_event WHERE event_name = 'content_search_submitted' AND created_at >= $1 AND created_at < $2`
		if err := db.QueryRow(ctx, searchQuery, from, to).Scan(&searchTotal, &searchZero); err != nil {
			fail("search events", err)
			return
		}
		searchRate := 0.0
		if searchTotal > 0 {
			searchRate = float64(searchTotal-searchZero) / float64(searchTotal)
		}
		var searchTotalP, searchZeroP int
		if err := db.QueryRow(ctx, searchQuery, prevFrom, prevTo).Scan(&searchTotalP, &searchZeroP); err != nil {
			fail("previous search events", err)
			return
		}
		searchRateP := 0.0
		if searchTotalP > 0 {
			searchRateP = float64(searchTotalP-searchZeroP) / float64(searchTotalP)
		}

		var userProfiles int
		if err := db.QueryRow(ctx, "SELECT COUNT(*) FROM profile.user_profile").Scan(&userProfiles); err != nil {
			fail("learner profiles", err)
			return
		}
		var rawEvents int
		if err := db.QueryRow(ctx, "SELECT COUNT(*) FROM analytics.analytics_event WHERE created_at >= $1 AND created_at < $2", from, to).Scan(&rawEvents); err != nil {
			fail("analytics events", err)
			return
		}
		var activeContent int
		err = db.QueryRow(ctx, `SELECT (SELECT COUNT(*) FROM content.lexeme WHERE status IN ('active', 'published')) +
			(SELECT COUNT(*) FROM content.kanji WHERE status IN ('active', 'published')) +
			(SELECT COUNT(*) FROM content.grammar_point WHERE status IN ('active', 'published')) +
			(SELECT COUNT(*) FROM content.example_sentence WHERE status IN ('active', 'published'))`).Scan(&activeContent)
		if err != nil {
			fail("active content", err)
			return
		}

		var lastRollupAt *time.Time
		var rollupStatus *string
		err = db.QueryRow(ctx, "SELECT completed_at, status FROM analytics.rollup_run ORDER BY started_at DESC LIMIT 1").Scan(&lastRollupAt, &rollupStatus)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			fail("rollup freshness", err)
			return
		}
		freshnessStale := lastRollupAt == nil
		if lastRollupAt != nil {
			freshnessStale = time.Since(*lastRollupAt) > 24*time.Hour
		}

		resp := map[string]any{
			"activeContentCount": activeContent,
			"executive": map[string]any{
				"compareLabel": map[string]any{"days": days, "key": fmt.Sprintf("d%d", days)},
				"globalRollup": map[string]any{"studyMinutes": map[string]any{"available": false, "code": "not_implemented"}},
				"insights":     map[string]any{"anomalyKey": nil, "biggestNegative": nil, "biggestPositive": nil, "freshnessStale": freshnessStale, "recommendedKey": nil, "searchZeroShare": nil},
				"kpi": map[string]any{
					"activeToday":      newKPI(float64(dauCur), float64(dauPrev), "int"),
					"bjtCompletions":   newKPI(float64(bjtCur), float64(bjtPrev), "int"),
					"d7":               unavail("not_computed"),
					"dataFreshness":    map[string]any{"available": lastRollupAt != nil, "completedAt": lastRollupAt, "format": "time", "runStatus": rollupStatus},
					"flashcardReviews": newKPI(float64(flashCur), float64(flashPrev), "int"),
					"mau":              newKPI(float64(mauCur), float64(mauPrev), "int"),
					"monetization":     map[string]any{},
					"newUsers":         newKPI(float64(newUsersCur), float64(newUsersPrev), "int"),
					"searchSuccessRate": func() kpiModel {
						if searchTotal == 0 {
							return unavail("no_data")
						}
						return newKPI(searchRate*100, searchRateP*100, "percent")
					}(),
					"wau": newKPI(float64(wauCur), float64(wauPrev), "int"),
				},
				"lastRollup": func() any {
					if lastRollupAt == nil {
						return nil
					}
					s := ""
					if rollupStatus != nil {
						s = *rollupStatus
					}
					return map[string]any{"completedAt": lastRollupAt, "status": s}
				}(),
				"mauDauWau":            map[string]any{"byDay": []any{}, "noteKey": "aggregate_only"},
				"previousMetricTotals": map[string]any{},
				"previousRange":        map[string]string{"end": prevTo.Format(time.RFC3339), "start": prevFrom.Format(time.RFC3339)},
				"search":               map[string]any{"current": map[string]int{"total": searchTotal, "zero": searchZero}, "previous": map[string]int{"total": searchTotalP, "zero": searchZeroP}},
				"studyMinutes":         map[string]any{"available": false, "code": "not_implemented"},
			},
			"latestRun": func() any {
				if lastRollupAt == nil {
					return nil
				}
				s := ""
				if rollupStatus != nil {
					s = *rollupStatus
				}
				return map[string]any{"completedAt": lastRollupAt, "status": s}
			}(),
			"metricTotals":    map[string]any{},
			"range":           map[string]any{"days": days, "end": to.Format(time.RFC3339), "start": from.Format(time.RFC3339)},
			"rawEvents":       rawEvents,
			"rollupAlignment": map[string]bool{"rawMetricKeysRespectUserFilters": false, "respectsFilters": false},
			"userProfiles":    userProfiles,
		}
		writeJSON(w, http.StatusOK, resp)
	}
}

// Ensure imports are used.
var _ = strconv.Itoa
var _ = strings.Join
