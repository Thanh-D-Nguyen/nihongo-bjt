package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
)

// ── P1-A1.5: Admin Operations — Import Staging Sub-Domain (5 routes) ────────
// All routes require admin session + appropriate permissions.
// Contracts derived from NestJS apps/api/src/operations/operations.service.ts
// listImportStagingErrors, escalateImportErrorToDeadLetter, retryImportError,
// discardImportError, bulkImportErrorAction.

// adminOpsImportStagingErrorsListHandler implements GET /api/admin/operations/import-staging/errors.
func adminOpsImportStagingErrorsListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		batchID := r.URL.Query().Get("batchId")
		phase := r.URL.Query().Get("phase")
		severity := r.URL.Query().Get("severity")
		limit := queryInt(r, "limit", 50)
		if limit < 1 {
			limit = 1
		}
		if limit > 100 {
			limit = 100
		}

		whereClauses := []string{}
		args := []any{}
		argIdx := 1
		if batchID != "" {
			whereClauses = append(whereClauses, fmt.Sprintf("e.import_batch_id = $%d", argIdx))
			args = append(args, batchID)
			argIdx++
		}
		if phase != "" {
			whereClauses = append(whereClauses, fmt.Sprintf("e.phase = $%d", argIdx))
			args = append(args, phase)
			argIdx++
		}
		if severity != "" {
			whereClauses = append(whereClauses, fmt.Sprintf("e.severity = $%d", argIdx))
			args = append(args, severity)
			argIdx++
		}
		whereSQL := ""
		if len(whereClauses) > 0 {
			whereSQL = " WHERE " + strings.Join(whereClauses, " AND ")
		}

		query := `SELECT e.id, e.import_batch_id, e.raw_item_id, e.code, e.message, e.phase, e.severity,
			e.sample, e.source_file, e.source_key, e.created_at,
			COALESCE(b.source_type, '') as batch_source_type, COALESCE(b.source_dir, '') as batch_source_dir
			FROM content.content_import_error e
			LEFT JOIN content.content_import_batch b ON b.id = e.import_batch_id` +
			whereSQL + ` ORDER BY e.created_at DESC LIMIT $` + itoa(argIdx)
		args = append(args, limit)

		rows, err := db.Query(ctx, query, args...)
		if err != nil {
			logger.Error("list import staging errors", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type RawItem struct {
			ID         string  `json:"id"`
			SourceFile *string `json:"sourceFile,omitempty"`
			SourceKey  *string `json:"sourceKey,omitempty"`
		}
		type Batch struct {
			SourceType string `json:"sourceType"`
			SourceDir  string `json:"sourceDir"`
		}
		type Error struct {
			ID            string     `json:"id"`
			ImportBatchID string     `json:"importBatchId"`
			RawItemID     *string    `json:"rawItemId,omitempty"`
			Code          *string    `json:"code,omitempty"`
			Message       string     `json:"message"`
			Phase         *string    `json:"phase,omitempty"`
			Severity      string     `json:"severity"`
			Sample        *string    `json:"sample,omitempty"`
			SourceFile    *string    `json:"sourceFile,omitempty"`
			SourceKey     *string    `json:"sourceKey,omitempty"`
			CreatedAt     string     `json:"createdAt"`
			Batch         *Batch     `json:"batch,omitempty"`
			RawItem       *RawItem   `json:"rawItem,omitempty"`
		}
		var items []Error
		for rows.Next() {
			var e Error
			var createdAt time.Time
			var rawItemID *string
			var batchSourceType, batchSourceDir string
			if err := rows.Scan(&e.ID, &e.ImportBatchID, &rawItemID, &e.Code, &e.Message,
				&e.Phase, &e.Severity, &e.Sample, &e.SourceFile, &e.SourceKey, &createdAt,
				&batchSourceType, &batchSourceDir); err == nil {
				e.CreatedAt = createdAt.UTC().Format(time.RFC3339)
				e.RawItemID = rawItemID
				if batchSourceType != "" || batchSourceDir != "" {
					e.Batch = &Batch{SourceType: batchSourceType, SourceDir: batchSourceDir}
				}
				if rawItemID != nil {
					e.RawItem = &RawItem{ID: *rawItemID, SourceFile: e.SourceFile, SourceKey: e.SourceKey}
				}
				items = append(items, e)
			}
		}
		if items == nil {
			items = []Error{}
		}
		writeJSON(w, http.StatusOK, items)
	}
}

// adminOpsImportStagingEscalateHandler implements PATCH /api/admin/operations/import-staging/errors/{id}/dead-letter.
// Creates a dead-letter entry from an import error.
func adminOpsImportStagingEscalateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "errors", 1)
		if id == "" {
			writeJSONError(w, "error id required", http.StatusBadRequest)
			return
		}
		var req struct {
			Reason string `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.Reason == "" {
			writeJSONError(w, "reason is required", http.StatusBadRequest)
			return
		}

		ctx := r.Context()
		// Fetch import error with batch details
		type ImportError struct {
			ID            string
			ImportBatchID string
			RawItemID     *string
			Code          *string
			Message       string
			Phase         *string
			Severity      string
			Sample        *string
			SourceFile    *string
			SourceKey     *string
			BatchSourceType string
			BatchSourceDir  string
		}
		var ie ImportError
		err := db.QueryRow(ctx, `
			SELECT e.id, e.import_batch_id, e.raw_item_id, e.code, e.message, e.phase, e.severity,
				e.sample, e.source_file, e.source_key,
				COALESCE(b.source_type, ''), COALESCE(b.source_dir, '')
			FROM content.content_import_error e
			LEFT JOIN content.content_import_batch b ON b.id = e.import_batch_id
			WHERE e.id = $1`, id).Scan(
			&ie.ID, &ie.ImportBatchID, &ie.RawItemID, &ie.Code, &ie.Message,
			&ie.Phase, &ie.Severity, &ie.Sample, &ie.SourceFile, &ie.SourceKey,
			&ie.BatchSourceType, &ie.BatchSourceDir)
		if err != nil {
			writeJSONError(w, "import error not found", http.StatusNotFound)
			return
		}

		eventType := "content_import_error:" + ie.ID
		// Check for existing open/failed dead letter
		var existingID string
		err = db.QueryRow(ctx, `SELECT id FROM ops.dead_letter_entry
			WHERE event_type = $1 AND source = 'content_import_error' AND status IN ('open', 'failed')
			LIMIT 1`, eventType).Scan(&existingID)
		if err == nil && existingID != "" {
			writeJSON(w, http.StatusOK, map[string]any{"id": existingID, "alreadyExists": true})
			return
		}

		payloadJSON, _ := json.Marshal(map[string]any{
			"batchId":       ie.ImportBatchID,
			"importErrorId": ie.ID,
			"phase":         ie.Phase,
			"rawItemId":     ie.RawItemID,
			"sample":        ie.Sample,
			"severity":      ie.Severity,
			"sourceDir":     ie.BatchSourceDir,
			"sourceFile":    ie.SourceFile,
			"sourceKey":     ie.SourceKey,
			"sourceType":    ie.BatchSourceType,
		})
		var dlID string
		err = db.QueryRow(ctx, `
			INSERT INTO ops.dead_letter_entry (event_type, queue_name, source, error_code, error_message, payload, status, retry_count, created_at)
			VALUES ($1, 'content.import', 'content_import_error', $2, $3, $4, 'open', 0, NOW())
			RETURNING id`, eventType, ie.Code, ie.Message, payloadJSON).Scan(&dlID)
		if err != nil {
			logger.Error("create dead letter from import error", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		// Record audit
		afterJSON, _ := json.Marshal(map[string]any{"deadLetterId": dlID})
		beforeJSON, _ := json.Marshal(map[string]any{"importErrorId": ie.ID})
		db.Exec(ctx, `
			INSERT INTO admin.admin_audit_log (action, actor_id, target_id, target_type, reason, after, before, created_at)
			VALUES ('ops.import_error.dead_letter.create', $1, $2, 'content.import_error', $3, $4, $5, NOW())`,
			identity.ActorID, ie.ID, req.Reason, afterJSON, beforeJSON)

		writeJSON(w, http.StatusOK, map[string]any{"id": dlID, "status": "open"})
	}
}

// adminOpsImportStagingRetryHandler implements PATCH /api/admin/operations/import-staging/errors/{id}/retry.
func adminOpsImportStagingRetryHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "errors", 1)
		if id == "" {
			writeJSONError(w, "error id required", http.StatusBadRequest)
			return
		}
		var req struct {
			Reason string `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.Reason == "" {
			writeJSONError(w, "reason is required", http.StatusBadRequest)
			return
		}

		ctx := r.Context()
		// Verify error exists
		var existingID string
		if err := db.QueryRow(ctx, "SELECT id FROM content.content_import_error WHERE id = $1", id).Scan(&existingID); err != nil {
			writeJSONError(w, "import error not found", http.StatusNotFound)
			return
		}

		// Record audit (actual retry is async/partial_schema_pending)
		afterJSON, _ := json.Marshal(map[string]any{"id": id, "status": "retry_requested"})
		beforeJSON, _ := json.Marshal(map[string]any{"id": id})
		_, err := db.Exec(ctx, `
			INSERT INTO admin.admin_audit_log (action, actor_id, target_id, target_type, reason, after, before, created_at)
			VALUES ('ops.import_error.retry', $1, $2, 'content.import_error', $3, $4, $5, NOW())`,
			identity.ActorID, id, req.Reason, afterJSON, beforeJSON)
		if err != nil {
			logger.Error("audit import error retry", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"id": id, "status": "retry_requested"})
	}
}

// adminOpsImportStagingDiscardHandler implements PATCH /api/admin/operations/import-staging/errors/{id}/discard.
func adminOpsImportStagingDiscardHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "errors", 1)
		if id == "" {
			writeJSONError(w, "error id required", http.StatusBadRequest)
			return
		}
		var req struct {
			Reason string `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.Reason == "" {
			writeJSONError(w, "reason is required", http.StatusBadRequest)
			return
		}

		ctx := r.Context()
		var existingID string
		if err := db.QueryRow(ctx, "SELECT id FROM content.content_import_error WHERE id = $1", id).Scan(&existingID); err != nil {
			writeJSONError(w, "import error not found", http.StatusNotFound)
			return
		}

		afterJSON, _ := json.Marshal(map[string]any{"id": id, "status": "discarded"})
		beforeJSON, _ := json.Marshal(map[string]any{"id": id})
		_, err := db.Exec(ctx, `
			INSERT INTO admin.admin_audit_log (action, actor_id, target_id, target_type, reason, after, before, created_at)
			VALUES ('ops.import_error.discard', $1, $2, 'content.import_error', $3, $4, $5, NOW())`,
			identity.ActorID, id, req.Reason, afterJSON, beforeJSON)
		if err != nil {
			logger.Error("audit import error discard", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"id": id, "status": "discarded"})
	}
}

// adminOpsImportStagingBulkHandler implements PATCH /api/admin/operations/import-staging/errors/bulk.
func adminOpsImportStagingBulkHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			IDs    []string `json:"ids"`
			Action string   `json:"action"` // "retry" or "discard"
			Reason string   `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if len(req.IDs) == 0 || len(req.IDs) > 200 {
			writeJSONError(w, "ids must contain 1-200 entries", http.StatusBadRequest)
			return
		}
		if req.Action != "retry" && req.Action != "discard" {
			writeJSONError(w, "action must be 'retry' or 'discard'", http.StatusBadRequest)
			return
		}
		if req.Reason == "" {
			writeJSONError(w, "reason is required", http.StatusBadRequest)
			return
		}

		ctx := r.Context()
		// Fetch matching errors
		placeholders := make([]string, len(req.IDs))
		args := make([]any, len(req.IDs))
		for i, id := range req.IDs {
			placeholders[i] = fmt.Sprintf("$%d", i+1)
			args[i] = id
		}
		inClause := strings.Join(placeholders, ",")
		rows, err := db.Query(ctx, fmt.Sprintf("SELECT id FROM content.content_import_error WHERE id IN (%s)", inClause), args...)
		if err != nil {
			logger.Error("bulk import error fetch", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		var matchedIDs []string
		for rows.Next() {
			var eid string
			if err := rows.Scan(&eid); err == nil {
				matchedIDs = append(matchedIDs, eid)
			}
		}
		rows.Close()

		if len(matchedIDs) == 0 {
			writeJSON(w, http.StatusOK, map[string]any{"processed": 0, "action": req.Action})
			return
		}

		actionSuffix := req.Action
		statusVal := "retry_requested"
		if req.Action == "discard" {
			statusVal = "discarded"
		}

		// Create audit entries for each matched error
		for _, eid := range matchedIDs {
			afterJSON, _ := json.Marshal(map[string]any{"id": eid, "status": statusVal})
			beforeJSON, _ := json.Marshal(map[string]any{"id": eid})
			db.Exec(ctx, `
				INSERT INTO admin.admin_audit_log (action, actor_id, target_id, target_type, reason, after, before, created_at)
				VALUES ($1, $2, $3, 'content.import_error', $4, $5, $6, NOW())`,
				"ops.import_error."+actionSuffix, identity.ActorID, eid, req.Reason, afterJSON, beforeJSON)
		}

		writeJSON(w, http.StatusOK, map[string]any{"processed": len(matchedIDs), "action": req.Action})
	}
}

// Ensure context import is used.
var _ = context.Background