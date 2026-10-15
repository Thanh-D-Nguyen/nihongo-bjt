package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
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
	return importAdminPermission(db, "admin.content.read", func(w http.ResponseWriter, r *http.Request) {
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
			if !isValidUUID(batchID) {
				writeJSONError(w, "invalid batch id", http.StatusBadRequest)
				return
			}
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
			if severity != "info" && severity != "warning" && severity != "error" {
				writeJSONError(w, "invalid severity", http.StatusBadRequest)
				return
			}
			whereClauses = append(whereClauses, fmt.Sprintf("e.severity = $%d", argIdx))
			args = append(args, severity)
			argIdx++
		}
		whereSQL := ""
		if len(whereClauses) > 0 {
			whereSQL = " WHERE " + strings.Join(whereClauses, " AND ")
		}

		query := `SELECT e.id, e.import_batch_id, e.raw_item_id, e.code, e.message, e.phase, e.severity,
			e.sample, e.source_file, e.source_key, e.created_at, e.status,
			latest.operation, latest.status,
			COALESCE(b.source_type, '') as batch_source_type, COALESCE(b.source_dir, '') as batch_source_dir
			FROM content.content_import_error e
			LEFT JOIN content.content_import_batch b ON b.id = e.import_batch_id
			LEFT JOIN LATERAL (
				SELECT operation, status FROM content.content_import_operation_request
				WHERE import_error_id = e.id ORDER BY created_at DESC, id DESC LIMIT 1
			) latest ON true` +
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
			ID              string   `json:"id"`
			ImportBatchID   string   `json:"importBatchId"`
			RawItemID       *string  `json:"rawItemId,omitempty"`
			Code            *string  `json:"code,omitempty"`
			Message         string   `json:"message"`
			Phase           *string  `json:"phase,omitempty"`
			Severity        string   `json:"severity"`
			Status          string   `json:"status"`
			Operation       *string  `json:"operation,omitempty"`
			OperationStatus *string  `json:"operationStatus,omitempty"`
			Sample          *string  `json:"sample,omitempty"`
			SourceFile      *string  `json:"sourceFile,omitempty"`
			SourceKey       *string  `json:"sourceKey,omitempty"`
			CreatedAt       string   `json:"createdAt"`
			Batch           *Batch   `json:"batch,omitempty"`
			RawItem         *RawItem `json:"rawItem,omitempty"`
		}
		var items []Error
		for rows.Next() {
			var e Error
			var createdAt time.Time
			var rawItemID *string
			var operation, operationStatus *string
			var batchSourceType, batchSourceDir string
			if err := rows.Scan(&e.ID, &e.ImportBatchID, &rawItemID, &e.Code, &e.Message,
				&e.Phase, &e.Severity, &e.Sample, &e.SourceFile, &e.SourceKey, &createdAt, &e.Status,
				&operation, &operationStatus,
				&batchSourceType, &batchSourceDir); err != nil {
				logger.Error("scan import staging error", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			} else {
				e.CreatedAt = createdAt.UTC().Format(time.RFC3339)
				e.RawItemID = rawItemID
				e.Operation = operation
				e.OperationStatus = operationStatus
				if batchSourceType != "" || batchSourceDir != "" {
					e.Batch = &Batch{SourceType: batchSourceType, SourceDir: batchSourceDir}
				}
				if rawItemID != nil {
					e.RawItem = &RawItem{ID: *rawItemID, SourceFile: e.SourceFile, SourceKey: e.SourceKey}
				}
				items = append(items, e)
			}
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate import staging errors", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if items == nil {
			items = []Error{}
		}
		writeJSON(w, http.StatusOK, items)
	})
}

// adminOpsImportStagingEscalateHandler implements PATCH /api/admin/operations/import-staging/errors/{id}/dead-letter.
// Creates a dead-letter entry from an import error.
func adminOpsImportStagingEscalateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return importAdminPermission(db, "admin.content.write", func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "errors", 1)
		if !isValidUUID(id) {
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
		if len(strings.TrimSpace(req.Reason)) < 3 {
			writeJSONError(w, "reason is required", http.StatusBadRequest)
			return
		}

		ctx := r.Context()
		// Fetch import error with batch details
		type ImportError struct {
			ID              string
			ImportBatchID   string
			RawItemID       *string
			Code            *string
			Message         string
			Phase           *string
			Severity        string
			Sample          *string
			SourceFile      *string
			SourceKey       *string
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
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "import error not found", http.StatusNotFound)
			return
		}
		if err != nil {
			logger.Error("load import error for dead letter", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		eventType := "content_import_error:" + ie.ID
		tx, err := db.Begin(ctx)
		if err != nil {
			logger.Error("begin import dead letter", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(ctx)
		if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext($1))`, eventType); err != nil {
			logger.Error("lock import dead letter", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		// Check for existing open/failed dead letter
		var existingID string
		err = tx.QueryRow(ctx, `SELECT id FROM ops.dead_letter_entry
			WHERE event_type = $1 AND source = 'content_import_error' AND status IN ('open', 'failed')
			LIMIT 1`, eventType).Scan(&existingID)
		if err == nil && existingID != "" {
			if err := tx.Commit(ctx); err != nil {
				logger.Error("commit existing import dead letter", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"id": existingID, "alreadyExists": true})
			return
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			logger.Error("lookup import dead letter", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
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
		err = tx.QueryRow(ctx, `
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
		_, err = tx.Exec(ctx, `
			INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, before, created_at)
			VALUES ('ops.import_error.dead_letter.create', $1, $2, 'content.content_import_error', $3, $4, $5, NOW())`,
			identity.ActorID, ie.ID, req.Reason, afterJSON, beforeJSON)
		if err != nil {
			logger.Error("audit import error dead letter", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			logger.Error("commit import dead letter", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{"id": dlID, "status": "open"})
	})
}

// adminOpsImportStagingRetryHandler implements PATCH /api/admin/operations/import-staging/errors/{id}/retry.
func adminOpsImportStagingRetryHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return importAdminPermission(db, "admin.content.write", func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "errors", 1)
		if !isValidUUID(id) {
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
		if len(strings.TrimSpace(req.Reason)) < 3 {
			writeJSONError(w, "reason is required", http.StatusBadRequest)
			return
		}

		ctx := r.Context()
		tx, err := db.Begin(ctx)
		if err != nil {
			logger.Error("begin import error retry", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(ctx)
		requestID, created, err := enqueueImportRetry(ctx, tx, identity.ActorID, id, req.Reason)
		if errors.Is(err, errImportErrorDiscarded) {
			writeJSONError(w, "discarded import errors cannot be retried", http.StatusConflict)
			return
		}
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "import error not found", http.StatusNotFound)
			return
		}
		if err != nil {
			logger.Error("queue import error retry", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if created {
			if err := insertImportOperationAudit(ctx, tx, identity.ActorID, id, "content.content_import_error", "ops.import_error.retry", req.Reason,
				map[string]any{"id": id, "requestId": requestID, "status": "queued"}, map[string]any{"id": id}); err != nil {
				logger.Error("audit import error retry", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
		}
		if err := tx.Commit(ctx); err != nil {
			logger.Error("commit import error retry", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusAccepted, map[string]any{
			"id": id, "requestId": requestID, "operation": "retry", "status": "queued", "requestStatus": "queued",
			"processorAvailable": false, "executionNote": "No import retry executor is registered; this request remains queued.",
		})
	})
}

// adminOpsImportStagingDiscardHandler implements PATCH /api/admin/operations/import-staging/errors/{id}/discard.
func adminOpsImportStagingDiscardHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return importAdminPermission(db, "admin.content.write", func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "errors", 1)
		if !isValidUUID(id) {
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
		if len(strings.TrimSpace(req.Reason)) < 3 {
			writeJSONError(w, "reason is required", http.StatusBadRequest)
			return
		}

		ctx := r.Context()
		tx, err := db.Begin(ctx)
		if err != nil {
			logger.Error("begin import error discard", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(ctx)
		var currentStatus string
		err = tx.QueryRow(ctx, `SELECT status FROM content.content_import_error WHERE id=$1 FOR UPDATE`, id).Scan(&currentStatus)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "import error not found", http.StatusNotFound)
			return
		}
		if err != nil {
			logger.Error("load import error for discard", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if currentStatus != "discarded" {
			if _, err := tx.Exec(ctx, `UPDATE content.content_import_error SET status='discarded' WHERE id=$1`, id); err != nil {
				logger.Error("persist import error discard", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			if _, err := tx.Exec(ctx, `UPDATE content.content_import_operation_request SET status='cancelled', updated_at=now() WHERE import_error_id=$1 AND operation='retry' AND status IN ('queued','processing')`, id); err != nil {
				logger.Error("cancel queued import retry", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			if err := insertImportOperationAudit(ctx, tx, identity.ActorID, id, "content.content_import_error", "ops.import_error.discard", req.Reason,
				map[string]any{"id": id, "status": "discarded"}, map[string]any{"id": id, "status": currentStatus}); err != nil {
				logger.Error("audit import error discard", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
		}
		if err := tx.Commit(ctx); err != nil {
			logger.Error("commit import error discard", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"id": id, "status": "discarded", "alreadyDiscarded": currentStatus == "discarded"})
	})
}

// adminOpsImportStagingBulkHandler implements PATCH /api/admin/operations/import-staging/errors/bulk.
func adminOpsImportStagingBulkHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return importAdminPermission(db, "admin.content.write", func(w http.ResponseWriter, r *http.Request) {
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
		if len(strings.TrimSpace(req.Reason)) < 3 {
			writeJSONError(w, "reason is required", http.StatusBadRequest)
			return
		}

		ctx := r.Context()
		seenIDs := make(map[string]struct{}, len(req.IDs))
		for i, id := range req.IDs {
			if !isValidUUID(id) {
				writeJSONError(w, "invalid import error id", http.StatusBadRequest)
				return
			}
			req.IDs[i] = strings.ToLower(id)
			if _, exists := seenIDs[req.IDs[i]]; exists {
				writeJSONError(w, "ids must be unique", http.StatusBadRequest)
				return
			}
			seenIDs[req.IDs[i]] = struct{}{}
		}
		tx, err := db.Begin(ctx)
		if err != nil {
			logger.Error("begin bulk import error action", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(ctx)
		rows, err := tx.Query(ctx, `SELECT id, status FROM content.content_import_error WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE`, req.IDs)
		if err != nil {
			logger.Error("bulk import error fetch", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		type item struct{ id, status string }
		var matched []item
		for rows.Next() {
			var it item
			if err := rows.Scan(&it.id, &it.status); err != nil {
				rows.Close()
				logger.Error("scan bulk import error", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			matched = append(matched, it)
		}
		rowErr := rows.Err()
		rows.Close()
		if rowErr != nil {
			logger.Error("iterate bulk import errors", "error", rowErr)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if len(matched) != len(req.IDs) {
			writeJSONError(w, "one or more import errors not found", http.StatusNotFound)
			return
		}
		requestIDs := make([]string, 0, len(matched))
		processed := 0
		for _, it := range matched {
			if req.Action == "retry" {
				if it.status == "discarded" {
					continue
				}
				requestID, created, err := enqueueImportRetry(ctx, tx, identity.ActorID, it.id, req.Reason)
				if err != nil {
					logger.Error("queue bulk import retry", "error", err)
					writeJSONError(w, "internal error", http.StatusInternalServerError)
					return
				}
				requestIDs = append(requestIDs, requestID)
				processed++
				if created {
					if err := insertImportOperationAudit(ctx, tx, identity.ActorID, it.id, "content.content_import_error", "ops.import_error.retry", req.Reason,
						map[string]any{"id": it.id, "requestId": requestID, "status": "queued"}, map[string]any{"id": it.id, "status": it.status}); err != nil {
						logger.Error("audit bulk import retry", "error", err)
						writeJSONError(w, "internal error", http.StatusInternalServerError)
						return
					}
				}
				continue
			}
			if it.status == "discarded" {
				processed++
				continue
			}
			if _, err := tx.Exec(ctx, `UPDATE content.content_import_error SET status='discarded' WHERE id=$1`, it.id); err != nil {
				logger.Error("persist bulk import discard", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			if _, err := tx.Exec(ctx, `UPDATE content.content_import_operation_request SET status='cancelled', updated_at=now() WHERE import_error_id=$1 AND operation='retry' AND status IN ('queued','processing')`, it.id); err != nil {
				logger.Error("cancel bulk import retry", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			if err := insertImportOperationAudit(ctx, tx, identity.ActorID, it.id, "content.content_import_error", "ops.import_error.discard", req.Reason,
				map[string]any{"id": it.id, "status": "discarded"}, map[string]any{"id": it.id, "status": it.status}); err != nil {
				logger.Error("audit bulk import discard", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			processed++
		}
		if err := tx.Commit(ctx); err != nil {
			logger.Error("commit bulk import error action", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		statusCode, status := http.StatusOK, "discarded"
		if req.Action == "retry" {
			statusCode, status = http.StatusAccepted, "queued"
		}
		response := map[string]any{"processed": processed, "action": req.Action, "status": status, "requestIds": requestIDs}
		if req.Action == "retry" {
			response["processorAvailable"] = false
			response["executionNote"] = "No import retry executor is registered; requests remain queued."
		}
		writeJSON(w, statusCode, response)
	})
}

var errImportErrorDiscarded = errors.New("import error is discarded")

// enqueueImportRetry persists a retry command and the visible error state in the
// caller's transaction. A partial unique index makes repeated requests reuse
// the active command instead of creating duplicate work.
func enqueueImportRetry(ctx context.Context, tx pgx.Tx, actorID, errorID, reason string) (string, bool, error) {
	var currentStatus string
	if err := tx.QueryRow(ctx, `SELECT status FROM content.content_import_error WHERE id=$1 FOR UPDATE`, errorID).Scan(&currentStatus); err != nil {
		return "", false, err
	}
	if currentStatus == "discarded" {
		return "", false, errImportErrorDiscarded
	}
	var requestID string
	err := tx.QueryRow(ctx, `
INSERT INTO content.content_import_operation_request
	(import_error_id, operation, status, reason, requested_by, created_at, updated_at)
VALUES ($1, 'retry', 'queued', $2, $3, now(), now())
ON CONFLICT (import_error_id) WHERE operation='retry' AND status IN ('queued','processing') DO NOTHING
RETURNING id`, errorID, reason, actorID).Scan(&requestID)
	created := err == nil
	if errors.Is(err, pgx.ErrNoRows) {
		err = tx.QueryRow(ctx, `SELECT id FROM content.content_import_operation_request WHERE import_error_id=$1 AND operation='retry' AND status IN ('queued','processing')`, errorID).Scan(&requestID)
	}
	if err != nil {
		return "", false, err
	}
	if _, err := tx.Exec(ctx, `UPDATE content.content_import_error SET status='retry_queued' WHERE id=$1`, errorID); err != nil {
		return "", false, err
	}
	return requestID, created, nil
}

func insertImportOperationAudit(ctx context.Context, tx pgx.Tx, actorID, targetID, targetType, action, reason string, after, before map[string]any) error {
	afterJSON, err := json.Marshal(after)
	if err != nil {
		return err
	}
	beforeJSON, err := json.Marshal(before)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `
INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, before, created_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, now())`, action, actorID, targetID, targetType, reason, afterJSON, beforeJSON)
	return err
}

// Ensure context import is used.
var _ = context.Background
