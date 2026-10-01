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
		ctx := r.Context()

		var testsTotal, testsActive, sessionsTotal, attempts30d, completedAttempts int

		if err := db.QueryRow(ctx, "SELECT COUNT(*) FROM assessment.bjt_mock_test").Scan(&testsTotal); err != nil {
			logger.Error("count bjt tests", "error", err)
		}
		if err := db.QueryRow(ctx, "SELECT COUNT(*) FROM assessment.bjt_mock_test WHERE status = 'active'").Scan(&testsActive); err != nil {
			logger.Error("count active bjt tests", "error", err)
		}
		if err := db.QueryRow(ctx, "SELECT COUNT(*) FROM study.quiz_session").Scan(&sessionsTotal); err != nil {
			logger.Error("count quiz sessions", "error", err)
		}
		if err := db.QueryRow(ctx, "SELECT COUNT(*) FROM study.quiz_session WHERE started_at >= NOW() - INTERVAL '30 days'").Scan(&attempts30d); err != nil {
			logger.Error("count recent quiz attempts", "error", err)
		}
		if err := db.QueryRow(ctx, "SELECT COUNT(*) FROM study.quiz_session WHERE status = 'submitted'").Scan(&completedAttempts); err != nil {
			logger.Error("count completed quiz attempts", "error", err)
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
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var lc LevelCount
				if err := rows.Scan(&lc.Level, &lc.Count); err == nil {
					if lc.Level == "" {
						lc.Level = "unknown"
					}
					byLevel = append(byLevel, lc)
				}
			}
		}
		if byLevel == nil {
			byLevel = []LevelCount{}
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"generatedAt":          time.Now().UTC().Format(time.RFC3339),
			"partial_schema_pending": []string{"per_skill_pass_rate", "upcoming_exam_dates"},
			"bjtTestsTotal":        testsTotal,
			"bjtTestsActive":       testsActive,
			"bjtSessionsTotal":     sessionsTotal,
			"bjtAttempts30d":       attempts30d,
			"bjtPassRate30d":       passRate,
			"byLevel":              byLevel,
		})
	}
}