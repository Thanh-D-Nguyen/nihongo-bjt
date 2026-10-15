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

		var testsTotal, testsActive, sessionsTotal, attempts30d, completedAttempts int

		if err := db.QueryRow(ctx, `
		SELECT (SELECT COUNT(*) FROM assessment.bjt_mock_test),
		       (SELECT COUNT(*) FROM assessment.bjt_mock_test WHERE status = 'active'),
		       (SELECT COUNT(*) FROM assessment.quiz_session),
		       (SELECT COUNT(*) FROM assessment.quiz_session WHERE started_at >= NOW() - INTERVAL '30 days'),
		       (SELECT COUNT(*) FROM assessment.quiz_session WHERE status = 'submitted')
	`).Scan(&testsTotal, &testsActive, &sessionsTotal, &attempts30d, &completedAttempts); err != nil {
			logger.Error("query BJT dashboard totals", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		var passRate *float64
		if attempts30d > 0 {
			rate := float64(completedAttempts) / float64(attempts30d)
			passRate = &rate
		}

		// byLevel aggregation
		rows, err := db.Query(ctx, `SELECT level, COUNT(*) FROM assessment.bjt_mock_test GROUP BY level ORDER BY level ASC`)
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
			if lc.Level == "" {
				lc.Level = "unknown"
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
			"partial_schema_pending": []string{"per_skill_pass_rate", "upcoming_exam_dates"},
			"bjtTestsTotal":          testsTotal,
			"bjtTestsActive":         testsActive,
			"bjtSessionsTotal":       sessionsTotal,
			"bjtAttempts30d":         attempts30d,
			"bjtPassRate30d":         passRate,
			"byLevel":                byLevel,
		})
	}
}
