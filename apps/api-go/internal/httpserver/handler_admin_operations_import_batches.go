package httpserver

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// ── P1-A1.11: Admin Operations — Import Batches Sub-Domain (1 route) ────────
// All routes require admin session + appropriate permissions.
// Contracts derived from NestJS apps/api/src/operations/operations.service.ts
// listImportBatches.

// adminOpsImportBatchesListHandler implements GET /api/admin/operations/import-batches.
func adminOpsImportBatchesListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		statusFilter := r.URL.Query().Get("status")
		limit := queryInt(r, "limit", 50)
		offset := queryInt(r, "offset", 0)

		whereClause := ""
		args := []any{}
		argIdx := 1
		if statusFilter != "" {
			whereClause = " WHERE status = $" + itoa(argIdx)
			args = append(args, statusFilter)
			argIdx++
		}

		// Count total
		countQuery := "SELECT COUNT(*) FROM content.content_import_batch" + whereClause
		var total int
		if err := db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
			logger.Error("count import batches", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		// Fetch items
		dataQuery := `SELECT id, source_type, source_dir, status, file_count, item_count, error_count, started_at, completed_at, created_at
FROM content.content_import_batch` + whereClause + ` ORDER BY created_at DESC LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
		args = append(args, limit, offset)

		rows, err := db.Query(ctx, dataQuery, args...)
		if err != nil {
			logger.Error("list import batches", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type Batch struct {
			ID          string  `json:"id"`
			SourceType  string  `json:"sourceType"`
			SourceDir   string  `json:"sourceDir"`
			Status      string  `json:"status"`
			FileCount   int     `json:"fileCount"`
			ItemCount   int     `json:"itemCount"`
			ErrorCount  int     `json:"errorCount"`
			StartedAt   *string `json:"startedAt,omitempty"`
			CompletedAt *string `json:"completedAt,omitempty"`
			CreatedAt   string  `json:"createdAt"`
		}

		var items []Batch
		for rows.Next() {
			var b Batch
			var createdAt time.Time
			var startedAt, completedAt *time.Time
			if err := rows.Scan(&b.ID, &b.SourceType, &b.SourceDir, &b.Status,
				&b.FileCount, &b.ItemCount, &b.ErrorCount,
				&startedAt, &completedAt, &createdAt); err == nil {
				b.CreatedAt = createdAt.UTC().Format(time.RFC3339)
				if startedAt != nil {
					s := startedAt.UTC().Format(time.RFC3339)
					b.StartedAt = &s
				}
				if completedAt != nil {
					c := completedAt.UTC().Format(time.RFC3339)
					b.CompletedAt = &c
				}
				items = append(items, b)
			}
		}

		if items == nil {
			items = []Batch{}
		}

		writeJSON(w, http.StatusOK, map[string]any{"items": items, "total": total})
	}
}
