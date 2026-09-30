package httpserver

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// ── P1-A1.10: Admin Operations — Notifications Sub-Domain (1 route) ─────────
// All routes require admin session + appropriate permissions.
// Contracts derived from NestJS apps/api/src/operations/operations.service.ts
// notificationsSummary.

// adminOpsNotificationsHandler implements GET /api/admin/operations/notifications.
// Returns aggregated notification health summary based on dead letters and import errors.
func adminOpsNotificationsHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()

		var openDeadLetters, failedDeadLetters, importErrorsHighSeverity int

		if err := db.QueryRow(ctx, "SELECT COUNT(*) FROM ops.dead_letter_entry WHERE status = 'open'").Scan(&openDeadLetters); err != nil {
			logger.Error("count open dead letters", "error", err)
		}
		if err := db.QueryRow(ctx, "SELECT COUNT(*) FROM ops.dead_letter_entry WHERE status = 'failed'").Scan(&failedDeadLetters); err != nil {
			logger.Error("count failed dead letters", "error", err)
		}
		if err := db.QueryRow(ctx, "SELECT COUNT(*) FROM content.content_import_error WHERE severity IN ('critical', 'high')").Scan(&importErrorsHighSeverity); err != nil {
			logger.Error("count high severity import errors", "error", err)
		}

		status := "healthy"
		if openDeadLetters > 0 || failedDeadLetters > 0 || importErrorsHighSeverity > 0 {
			status = "degraded"
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"openDeadLetters":         openDeadLetters,
			"failedDeadLetters":       failedDeadLetters,
			"importErrorsHighSeverity": importErrorsHighSeverity,
			"status":                  status,
			"generatedAt":             time.Now().UTC().Format(time.RFC3339),
		})
	}
}