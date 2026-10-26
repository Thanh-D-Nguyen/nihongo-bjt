package httpserver

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// ── P1-A1.12: Admin Operations — BJT Dashboard Sub-Domain (1 route) ─────────
// All routes require admin session + appropriate permissions.
// Contracts derived from NestJS apps/api/src/operations/operations.service.ts
// bjtDashboard.

// adminOpsBJTDashboardHandler implements GET /api/admin/operations/bjt/dashboard.
func adminOpsBJTDashboardHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !requireOperationsPermission(w, r, db, logger, "iam.manage", "admin.content.read") {
			return
		}
		ctx := r.Context()

		var testsTotal, testsActive, sessionsTotal, attempts30d int

		if err := db.QueryRow(ctx, `
		SELECT (SELECT COUNT(*) FROM assessment.bjt_mock_test),
		       (SELECT COUNT(*) FROM assessment.bjt_mock_test WHERE status = 'published'),
		       (SELECT COUNT(*) FROM assessment.quiz_session),
		       (SELECT COUNT(*) FROM assessment.quiz_session WHERE started_at >= NOW() - INTERVAL '30 days' AND started_at <= NOW())
	`).Scan(&testsTotal, &testsActive, &sessionsTotal, &attempts30d); err != nil {
			logger.Error("query BJT dashboard totals", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		// Completion and estimated score do not define a canonical BJT pass result.
		var passRate *float64

		// byLevel aggregation
		rows, err := db.Query(ctx, `SELECT COALESCE(NULLIF(level, ''), 'unknown') AS level, COUNT(*)
			FROM assessment.bjt_mock_test GROUP BY COALESCE(NULLIF(level, ''), 'unknown') ORDER BY level ASC`)
		type LevelCount struct {
			Level string `json:"level"`
			Count int    `json:"count"`
		}
		var byLevel []LevelCount
		if err != nil {
			logger.Error("query BJT dashboard levels", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		for rows.Next() {
			var lc LevelCount
			if err := rows.Scan(&lc.Level, &lc.Count); err != nil {
				logger.Error("scan BJT dashboard level", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			byLevel = append(byLevel, lc)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate BJT dashboard levels", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if byLevel == nil {
			byLevel = []LevelCount{}
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"generatedAt":            time.Now().UTC().Format(time.RFC3339),
			"partial_schema_pending": []string{"per_skill_pass_rate", "upcoming_exam_dates", "bjt_pass_rate_30d"},
			"bjtTestsTotal":          testsTotal,
			"bjtTestsActive":         testsActive,
			"bjtSessionsTotal":       sessionsTotal,
			"bjtAttempts30d":         attempts30d,
			"bjtPassRate30d":         passRate,
			"byLevel":                byLevel,
		})
	}
}
