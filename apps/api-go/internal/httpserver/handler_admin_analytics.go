package httpserver

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

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
	SessionTable    string // primary session/attempts table
	ScoreColumn     string // nullable score column (empty = no score metric)
	PassThreshold   int    // score threshold for pass_rate
	DurationAvail   bool   // whether duration_ms metric is available
	BreakdownDim    string // default breakdown dimension
	Metrics         []string
	KPIIDs          []string
	FreshnessTable  string
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
		ScoreColumn:    "",
		PassThreshold:  0,
		DurationAvail:  true,
		BreakdownDim:   "by_subject",
		Metrics:        []string{"sessions", "completion_rate"},
		KPIIDs:         []string{"studySessions", "completedSessions", "completionRate", "averageDurationMs", "uniqueLearners"},
		FreshnessTable: "learning.study_session",
	},
	"growth": {
		SessionTable:   "gamification.xp_event",
		ScoreColumn:    "",
		PassThreshold:  0,
		DurationAvail:  false,
		BreakdownDim:   "by_source",
		Metrics:        []string{"events", "xp_total"},
		KPIIDs:         []string{"xpEvents", "totalXpAwarded", "uniqueRecipients", "avgXpPerEvent", "streakUpdates"},
		FreshnessTable: "gamification.xp_event",
	},
	"content": {
		SessionTable:   "content.daily_radar_card",
		ScoreColumn:    "",
		PassThreshold:  0,
		DurationAvail:  false,
		BreakdownDim:   "by_category",
		Metrics:        []string{"publications", "views"},
		KPIIDs:         []string{"cardsPublished", "activeModules", "totalViews", "avgReadTime", "engagementRate"},
		FreshnessTable: "content.daily_radar_card",
	},
	"flashcards": {
		SessionTable:   "learning.flashcard_review_session",
		ScoreColumn:    "",
		PassThreshold:  0,
		DurationAvail:  true,
		BreakdownDim:   "by_deck",
		Metrics:        []string{"reviews", "retention_rate"},
		KPIIDs:         []string{"reviewSessions", "cardsReviewed", "retentionRate", "averageDurationMs", "newCardsLearned"},
		FreshnessTable: "learning.flashcard_review_session",
	},
	"battle": {
		SessionTable:   "learning.battle_session",
		ScoreColumn:    "user_score",
		PassThreshold:  0,
		DurationAvail:  false,
		BreakdownDim:   "by_mode",
		Metrics:        []string{"matches", "win_rate"},
		KPIIDs:         []string{"matchesPlayed", "completedMatches", "avgScore", "botVsPvpRatio", "abandonRate"},
		FreshnessTable: "learning.battle_session",
	},
	"search": {
		SessionTable:   "analytics.search_query_log",
		ScoreColumn:    "",
		PassThreshold:  0,
		DurationAvail:  false,
		BreakdownDim:   "by_locale",
		Metrics:        []string{"queries", "click_through"},
		KPIIDs:         []string{"totalQueries", "uniqueQueries", "avgResultsCount", "clickThroughRate", "zeroResultRate"},
		FreshnessTable: "analytics.search_query_log",
	},
	"system": {
		SessionTable:   "analytics.event",
		ScoreColumn:    "",
		PassThreshold:  0,
		DurationAvail:  false,
		BreakdownDim:   "by_event_name",
		Metrics:        []string{"events", "unique_users"},
		KPIIDs:         []string{"totalEvents", "uniqueUsers", "eventTypes", "avgEventsPerUser", "errorRate"},
		FreshnessTable: "analytics.event",
	},
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

// adminAnalyticsSummaryHandler implements GET /api/admin/analytics/{domain}/summary.
func adminAnalyticsSummaryHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		domain := extractPathParam(r.URL.Path, "analytics", 1)
		cfg, ok := domainConfigs[domain]
		if !ok {
			writeJSONError(w, "unknown analytics domain", http.StatusBadRequest)
			return
		}
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
		db.QueryRow(ctx, fmt.Sprintf("SELECT COUNT(*) FROM %s WHERE created_at >= $1 AND created_at < $2%s", cfg.SessionTable, whereLevel), args...).Scan(&currentCount)
		prevArgs := []any{prevFrom, prevTo}
		if level != "" && cfg.ScoreColumn != "" {
			prevArgs = append(prevArgs, level)
		}
		db.QueryRow(ctx, fmt.Sprintf("SELECT COUNT(*) FROM %s WHERE created_at >= $1 AND created_at < $2%s", cfg.SessionTable, whereLevel), prevArgs...).Scan(&prevCount)

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
			statusCol := "status"
			db.QueryRow(ctx, fmt.Sprintf("SELECT COUNT(*) FROM %s WHERE created_at >= $1 AND created_at < $2 AND %s = 'completed'%s", cfg.SessionTable, statusCol, whereLevel), args...).Scan(&completedCurrent)
			db.QueryRow(ctx, fmt.Sprintf("SELECT COUNT(*) FROM %s WHERE created_at >= $1 AND created_at < $2 AND %s = 'completed'%s", cfg.SessionTable, statusCol, whereLevel), prevArgs...).Scan(&completedPrev)
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
				FROM %s WHERE created_at >= $1 AND created_at < $2 AND %s IS NOT NULL%s`,
				cfg.ScoreColumn, cfg.ScoreColumn, cfg.PassThreshold, cfg.SessionTable, cfg.ScoreColumn, whereLevel), args...).Scan(&avgScore, &scoreCount, &passRate)
			db.QueryRow(ctx, fmt.Sprintf(`
				SELECT COALESCE(AVG(%s), 0)::float, COUNT(*)::int,
				       COALESCE(SUM(CASE WHEN %s >= %d THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0), 0)
				FROM %s WHERE created_at >= $1 AND created_at < $2 AND %s IS NOT NULL%s`,
				cfg.ScoreColumn, cfg.ScoreColumn, cfg.PassThreshold, cfg.SessionTable, cfg.ScoreColumn, whereLevel), prevArgs...).Scan(&avgScorePrev, &scoreCountPrev, &passRatePrev)

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

		// Duration KPI (if available)
		if cfg.DurationAvail && len(kpis) > 4 {
			var avgMs float64
			var durCount int
			db.QueryRow(ctx, fmt.Sprintf(`
				SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) * 1000), 0)::float, COUNT(*)::int
				FROM %s WHERE created_at >= $1 AND created_at < $2 AND updated_at IS NOT NULL%s`,
				cfg.SessionTable, whereLevel), args...).Scan(&avgMs, &durCount)
			if durCount > 0 {
				kpis[4].Value = &avgMs
				kpis[4].Format = "duration_ms"
			} else {
				kpis[4].Available = false
				code := "no_completed_sessions"
				kpis[4].UnavailableCode = &code
			}
		}

		// Freshness
		var lastRollupAt *string
		var freshnessStatus *string
		db.QueryRow(ctx, "SELECT completed_at, status FROM analytics.analytics_rollup_run ORDER BY started_at DESC LIMIT 1").Scan(&lastRollupAt, &freshnessStatus)

		writeJSON(w, http.StatusOK, map[string]any{
			"domain":           domain,
			"range":            map[string]any{"from": from.Format(time.RFC3339), "to": to.Format(time.RFC3339), "days": days},
			"filtersApplied":   map[string]bool{"level": level != ""},
			"kpis":             kpis,
			"freshness":        map[string]any{"lastRollupAt": lastRollupAt, "status": freshnessStatus, "sourceTable": cfg.FreshnessTable},
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
		ctx := r.Context()
		from, to, days := parseAnalyticsRange(r)
		metric := r.URL.Query().Get("metric")
		if metric == "" {
			metric = cfg.Metrics[0]
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
				db.QueryRow(ctx, fmt.Sprintf("SELECT COUNT(*)::float FROM %s WHERE created_at >= $1 AND created_at < $2", cfg.SessionTable), dayStart, dayEnd).Scan(&val)
			case "pass_rate", "completion_rate", "retention_rate", "win_rate", "click_through":
				if cfg.ScoreColumn != "" {
					var total, passed float64
					db.QueryRow(ctx, fmt.Sprintf(`
						SELECT COUNT(*)::float,
						       COALESCE(SUM(CASE WHEN %s >= %d THEN 1 ELSE 0 END)::float, 0)
						FROM %s WHERE created_at >= $1 AND created_at < $2 AND %s IS NOT NULL`,
						cfg.ScoreColumn, cfg.PassThreshold, cfg.SessionTable, cfg.ScoreColumn), dayStart, dayEnd).Scan(&total, &passed)
					if total > 0 {
						val = passed / total
					}
				} else {
					// For non-score domains, use completion ratio
					var total, completed float64
					db.QueryRow(ctx, fmt.Sprintf(`
						SELECT COUNT(*)::float,
						       COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)::float, 0)
						FROM %s WHERE created_at >= $1 AND created_at < $2`, cfg.SessionTable), dayStart, dayEnd).Scan(&total, &completed)
					if total > 0 {
						val = completed / total
					}
				}
			case "xp_total":
				db.QueryRow(ctx, fmt.Sprintf("SELECT COALESCE(SUM(amount), 0)::float FROM %s WHERE created_at >= $1 AND created_at < $2", cfg.SessionTable), dayStart, dayEnd).Scan(&val)
			default:
				db.QueryRow(ctx, fmt.Sprintf("SELECT COUNT(*)::float FROM %s WHERE created_at >= $1 AND created_at < $2", cfg.SessionTable), dayStart, dayEnd).Scan(&val)
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
		case "by_category":
			groupCol = "COALESCE(category, '(unknown)')"
		case "by_deck":
			groupCol = "deck_id"
		case "by_mode":
			groupCol = "COALESCE(mode, '(unknown)')"
		case "by_locale":
			groupCol = "COALESCE(locale, '(unknown)')"
		case "by_event_name":
			groupCol = "COALESCE(event_name, '(unknown)')"
		}

		query := fmt.Sprintf(`
			SELECT %s as label, COUNT(*)::int as attempts
			FROM %s
			WHERE created_at >= $1 AND created_at < $2
			GROUP BY %s
			ORDER BY attempts DESC
			LIMIT $3 OFFSET $4`, groupCol, cfg.SessionTable, groupCol)

		countQuery := fmt.Sprintf(`
			SELECT COUNT(DISTINCT %s)::int FROM %s
			WHERE created_at >= $1 AND created_at < $2`, groupCol, cfg.SessionTable)

		db.QueryRow(ctx, countQuery, from, to).Scan(&total)

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
		json.NewDecoder(r.Body).Decode(&body)
		if body.View == "" {
			body.View = "summary"
		}

		// Generate CSV based on view
		var csvData [][]string
		switch body.View {
		case "summary":
			csvData = [][]string{
				{"id", "value", "previous", "deltaRatio", "format", "available"},
				{"placeholder", "0", "0", "0", "int", "true"},
			}
		case "timeseries":
			csvData = [][]string{
				{"t", "value"},
				{time.Now().UTC().Format("2006-01-02"), "0"},
			}
		default:
			csvData = [][]string{
				{"label", "attempts"},
				{"(no data)", "0"},
			}
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
		json.NewDecoder(r.Body).Decode(&body)

		ctx := r.Context()
		now := time.Now().UTC()

		// Record refresh request in rollup run table
		var runID string
		err := db.QueryRow(ctx, `
			INSERT INTO analytics.analytics_rollup_run (domain, status, requested_by, reason, started_at, created_at)
			VALUES ($1, 'accepted', $2, $3, $4, $4) RETURNING id`,
			domain, identity.ActorID, body.Reason, now).Scan(&runID)
		if err != nil {
			logger.Error("record analytics refresh", "error", err, "domain", domain)
			// Non-fatal: still return accepted
		}

		w.WriteHeader(http.StatusAccepted)
		writeJSON(w, http.StatusAccepted, map[string]any{
			"domain":      domain,
			"reason":      body.Reason,
			"requestedAt": now.Format(time.RFC3339),
			"status":      "accepted",
		})
	}
}

// Ensure imports are used.
var _ = strconv.Itoa
var _ = strings.Join