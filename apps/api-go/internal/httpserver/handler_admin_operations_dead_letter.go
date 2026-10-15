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

// ── P1-A1.4: Admin Operations — Dead Letter Queue Sub-Domain (5 routes) ─────
// All routes require admin session + appropriate permissions.
// Contracts derived from NestJS apps/api/src/operations/operations.service.ts
// listDeadLettersFiltered, getDeadLetterDetail, retryDeadLetter, resolveDeadLetter, bulkDeadLetter.

// adminOpsDeadLetterListHandler implements GET /api/admin/operations/dead-letter-queue.
func adminOpsDeadLetterListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !requireOperationsPermission(w, r, db, logger, "iam.manage", "admin.content.read") {
			return
		}
		ctx := r.Context()
		statusFilter := r.URL.Query().Get("status")
		queueName := r.URL.Query().Get("queueName")
		source := r.URL.Query().Get("source")
		q := r.URL.Query().Get("q")
		limit := queryInt(r, "limit", 100)
		offset := queryInt(r, "offset", 0)

		whereClauses := []string{}
		args := []any{}
		argIdx := 1

		if statusFilter != "" {
			whereClauses = append(whereClauses, fmt.Sprintf("status = $%d", argIdx))
			args = append(args, statusFilter)
			argIdx++
		}
		if queueName != "" {
			whereClauses = append(whereClauses, fmt.Sprintf("queue_name ILIKE $%d", argIdx))
			args = append(args, "%"+queueName+"%")
			argIdx++
		}
		if source != "" {
			whereClauses = append(whereClauses, fmt.Sprintf("source ILIKE $%d", argIdx))
			args = append(args, "%"+source+"%")
			argIdx++
		}
		if q != "" {
			whereClauses = append(whereClauses, fmt.Sprintf(
				"(event_type ILIKE $%d OR error_code ILIKE $%d OR error_message ILIKE $%d)", argIdx, argIdx, argIdx))
			args = append(args, "%"+q+"%")
			argIdx++
		}

		whereSQL := ""
		if len(whereClauses) > 0 {
			whereSQL = " WHERE " + strings.Join(whereClauses, " AND ")
		}

		countQuery := "SELECT COUNT(*) FROM ops.dead_letter_entry" + whereSQL
		var total int
		if err := db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
			logger.Error("count dead letters", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		dataQuery := `SELECT id, COALESCE(event_type,''), COALESCE(queue_name,''), source, error_code, error_message, payload, status, retry_count, created_at, resolved_at
FROM ops.dead_letter_entry` + whereSQL + ` ORDER BY created_at DESC LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
		args = append(args, limit, offset)

		rows, err := db.Query(ctx, dataQuery, args...)
		if err != nil {
			logger.Error("list dead letters", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type Entry struct {
			ID           string          `json:"id"`
			EventType    string          `json:"eventType"`
			QueueName    string          `json:"queueName"`
			Source       string          `json:"source"`
			ErrorCode    *string         `json:"errorCode,omitempty"`
			ErrorMessage *string         `json:"errorMessage,omitempty"`
			Payload      json.RawMessage `json:"payload,omitempty"`
			Status       string          `json:"status"`
			RetryCount   int             `json:"retryCount"`
			CreatedAt    string          `json:"createdAt"`
			ResolvedAt   *string         `json:"resolvedAt,omitempty"`
		}
		var items []Entry
		for rows.Next() {
			var e Entry
			var createdAt time.Time
			var resolvedAt *time.Time
			if err := rows.Scan(&e.ID, &e.EventType, &e.QueueName, &e.Source,
				&e.ErrorCode, &e.ErrorMessage, &e.Payload, &e.Status, &e.RetryCount,
				&createdAt, &resolvedAt); err != nil {
				logger.Error("scan dead letter entry", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			e.CreatedAt = createdAt.UTC().Format(time.RFC3339)
			if resolvedAt != nil {
				s := resolvedAt.UTC().Format(time.RFC3339)
				e.ResolvedAt = &s
			}
			items = append(items, e)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate dead letter entries", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if items == nil {
			items = []Entry{}
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": items, "total": total})
	}
}

// adminOpsDeadLetterGetHandler implements GET /api/admin/operations/dead-letter-queue/{id}.
func adminOpsDeadLetterGetHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !requireOperationsPermission(w, r, db, logger, "admin.content.read", "iam.manage") {
			return
		}
		id := extractPathParam(r.URL.Path, "dead-letter-queue", 1)
		if !isValidUUID(id) {
			writeJSONError(w, "invalid dead letter id", http.StatusBadRequest)
			return
		}

		type Entry struct {
			ID           string          `json:"id"`
			EventType    string          `json:"eventType"`
			QueueName    string          `json:"queueName"`
			Source       string          `json:"source"`
			ErrorCode    *string         `json:"errorCode,omitempty"`
			ErrorMessage *string         `json:"errorMessage,omitempty"`
			Payload      json.RawMessage `json:"payload,omitempty"`
			Status       string          `json:"status"`
			RetryCount   int             `json:"retryCount"`
			CreatedAt    string          `json:"createdAt"`
			ResolvedAt   *string         `json:"resolvedAt,omitempty"`
		}
		var e Entry
		var createdAt time.Time
		var resolvedAt *time.Time
		err := db.QueryRow(r.Context(), `
			SELECT id, COALESCE(event_type,''), COALESCE(queue_name,''), source, error_code, error_message, payload, status, retry_count, created_at, resolved_at
			FROM ops.dead_letter_entry WHERE id = $1`, id).Scan(
			&e.ID, &e.EventType, &e.QueueName, &e.Source,
			&e.ErrorCode, &e.ErrorMessage, &e.Payload, &e.Status, &e.RetryCount,
			&createdAt, &resolvedAt)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				writeJSONError(w, "dead letter not found", http.StatusNotFound)
			} else {
				logger.Error("get dead letter", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
			}
			return
		}
		e.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		if resolvedAt != nil {
			s := resolvedAt.UTC().Format(time.RFC3339)
			e.ResolvedAt = &s
		}

		// Fetch audit history
		auditRows, aErr := db.Query(r.Context(), `
			SELECT a.id, a.action, a.actor_id, a.reason, a.after, a.before, a.created_at,
			       COALESCE(act.display_name, '') as actor_name, COALESCE(act.email, '') as actor_email
			FROM ops.admin_audit_log a
			LEFT JOIN authz.admin_actor act ON act.id = a.actor_id
			WHERE a.target_id = $1 AND a.target_type = 'ops.dead_letter_entry'
			ORDER BY a.created_at DESC LIMIT 100`, id)
		type AuditActor struct {
			ID          string  `json:"id"`
			DisplayName *string `json:"displayName"`
			Email       *string `json:"email"`
		}
		type AuditEntry struct {
			ID        string          `json:"id"`
			Action    string          `json:"action"`
			Actor     *AuditActor     `json:"actor"`
			Reason    *string         `json:"reason"`
			After     json.RawMessage `json:"after,omitempty"`
			Before    json.RawMessage `json:"before,omitempty"`
			CreatedAt string          `json:"createdAt"`
		}
		var audit []AuditEntry
		if aErr != nil {
			logger.Error("get dead letter audit history", "error", aErr)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer auditRows.Close()
		for auditRows.Next() {
			var ae AuditEntry
			var actorID *string
			var actorName, actorEmail *string
			var ts time.Time
			if err := auditRows.Scan(&ae.ID, &ae.Action, &actorID, &ae.Reason,
				&ae.After, &ae.Before, &ts, &actorName, &actorEmail); err != nil {
				logger.Error("scan dead letter audit history", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			ae.CreatedAt = ts.UTC().Format(time.RFC3339)
			if actorID != nil {
				ae.Actor = &AuditActor{ID: *actorID, DisplayName: actorName, Email: actorEmail}
			}
			audit = append(audit, ae)
		}
		if err := auditRows.Err(); err != nil {
			logger.Error("iterate dead letter audit history", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if audit == nil {
			audit = []AuditEntry{}
		}

		resp := map[string]any{
			"id": e.ID, "eventType": e.EventType, "queueName": e.QueueName,
			"source": e.Source, "errorCode": e.ErrorCode, "errorMessage": e.ErrorMessage,
			"payload": e.Payload, "status": e.Status, "retryCount": e.RetryCount,
			"createdAt": e.CreatedAt, "resolvedAt": e.ResolvedAt, "audit": audit,
		}
		writeJSON(w, http.StatusOK, resp)
	}
}

// adminOpsDeadLetterRetryHandler implements PATCH /api/admin/operations/dead-letter-queue/{id}/retry.
func adminOpsDeadLetterRetryHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		if !requireOperationsPermission(w, r, db, logger, "iam.manage") {
			return
		}
		id := extractPathParam(r.URL.Path, "dead-letter-queue", 1)
		if !isValidUUID(id) {
			writeJSONError(w, "invalid dead letter id", http.StatusBadRequest)
			return
		}
		var req struct {
			Reason string `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		req.Reason = strings.TrimSpace(req.Reason)
		if len(req.Reason) < 3 {
			writeJSONError(w, "reason is required", http.StatusBadRequest)
			return
		}

		ctx := r.Context()
		tx, err := db.Begin(ctx)
		if err != nil {
			logger.Error("begin dead letter retry", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(ctx)
		var existingStatus string
		var retryCount int
		err = tx.QueryRow(ctx, `SELECT status,retry_count FROM ops.dead_letter_entry WHERE id=$1 FOR UPDATE`, id).Scan(&existingStatus, &retryCount)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "dead letter not found", http.StatusNotFound)
			return
		}
		if err != nil {
			logger.Error("load dead letter for retry", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if existingStatus == "open" {
			if err := tx.Commit(ctx); err != nil {
				logger.Error("commit idempotent dead letter retry", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"id": id, "status": "open"})
			return
		}
		if existingStatus != "failed" && existingStatus != "discarded" && existingStatus != "resolved" {
			writeJSONError(w, "dead letter entry has unsupported status for retry", http.StatusConflict)
			return
		}
		if _, err := tx.Exec(ctx, `UPDATE ops.dead_letter_entry SET status='open',resolved_at=NULL,retry_count=retry_count+1 WHERE id=$1`, id); err != nil {
			logger.Error("retry dead letter", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		beforeJSON, _ := json.Marshal(map[string]any{"status": existingStatus, "retryCount": retryCount})
		afterJSON, _ := json.Marshal(map[string]any{"status": "open", "retryCount": retryCount + 1})
		if err := recordDeadLetterAudit(ctx, tx, identity.ActorID, id, "ops.dead_letter.retry", req.Reason, beforeJSON, afterJSON); err != nil {
			logger.Error("audit dead letter retry", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			logger.Error("commit dead letter retry", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{"id": id, "status": "open"})
	}
}

// adminOpsDeadLetterResolveHandler implements PATCH /api/admin/operations/dead-letter-queue/{id}.
// Resolves or discards a dead letter entry.
func adminOpsDeadLetterResolveHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		if !requireOperationsPermission(w, r, db, logger, "iam.manage") {
			return
		}
		id := extractPathParam(r.URL.Path, "dead-letter-queue", 1)
		if !isValidUUID(id) {
			writeJSONError(w, "invalid dead letter id", http.StatusBadRequest)
			return
		}
		var req struct {
			Status string `json:"status"` // "resolved" or "discarded"
			Reason string `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.Status != "resolved" && req.Status != "discarded" {
			writeJSONError(w, "status must be 'resolved' or 'discarded'", http.StatusBadRequest)
			return
		}
		req.Reason = strings.TrimSpace(req.Reason)
		if len(req.Reason) < 3 {
			writeJSONError(w, "reason is required", http.StatusBadRequest)
			return
		}

		ctx := r.Context()
		tx, err := db.Begin(ctx)
		if err != nil {
			logger.Error("begin dead letter resolve", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(ctx)
		var existingStatus string
		err = tx.QueryRow(ctx, `SELECT status FROM ops.dead_letter_entry WHERE id=$1 FOR UPDATE`, id).Scan(&existingStatus)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "dead letter not found", http.StatusNotFound)
			return
		}
		if err != nil {
			logger.Error("load dead letter for resolve", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if existingStatus != "open" && existingStatus != "failed" {
			writeJSONError(w, "dead letter entry is not open", http.StatusConflict)
			return
		}
		if _, err := tx.Exec(ctx, `UPDATE ops.dead_letter_entry SET status=$1,resolved_at=NOW() WHERE id=$2`, req.Status, id); err != nil {
			logger.Error("resolve dead letter", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		action := "ops.dead_letter." + req.Status
		beforeJSON, _ := json.Marshal(map[string]any{"status": existingStatus})
		afterJSON, _ := json.Marshal(map[string]any{"status": req.Status})
		if err := recordDeadLetterAudit(ctx, tx, identity.ActorID, id, action, req.Reason, beforeJSON, afterJSON); err != nil {
			logger.Error("audit dead letter resolve", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			logger.Error("commit dead letter resolve", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{"id": id, "status": req.Status})
	}
}

// adminOpsDeadLetterBulkHandler implements PATCH /api/admin/operations/dead-letter-queue/bulk.
func adminOpsDeadLetterBulkHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		if !requireOperationsPermission(w, r, db, logger, "iam.manage") {
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
		req.Reason = strings.TrimSpace(req.Reason)
		if len(req.Reason) < 3 {
			writeJSONError(w, "reason is required", http.StatusBadRequest)
			return
		}
		seen := make(map[string]struct{}, len(req.IDs))
		for _, id := range req.IDs {
			if !isValidUUID(id) {
				writeJSONError(w, "invalid dead letter id", http.StatusBadRequest)
				return
			}
			canonicalID := strings.ToLower(id)
			if _, exists := seen[canonicalID]; exists {
				writeJSONError(w, "ids must be unique", http.StatusBadRequest)
				return
			}
			seen[canonicalID] = struct{}{}
		}

		ctx := r.Context()
		tx, err := db.Begin(ctx)
		if err != nil {
			logger.Error("begin bulk dead letter action", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(ctx)
		rows, err := tx.Query(ctx, `SELECT id::text,status FROM ops.dead_letter_entry WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE`, req.IDs)
		if err != nil {
			logger.Error("load bulk dead letters", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		type entry struct{ id, status string }
		entries := make([]entry, 0, len(req.IDs))
		for rows.Next() {
			var item entry
			if err := rows.Scan(&item.id, &item.status); err != nil {
				rows.Close()
				logger.Error("scan bulk dead letters", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			entries = append(entries, item)
		}
		rowsErr := rows.Err()
		rows.Close()
		if rowsErr != nil {
			logger.Error("iterate bulk dead letters", "error", rowsErr)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if len(entries) != len(req.IDs) {
			writeJSONError(w, "dead letter not found", http.StatusNotFound)
			return
		}
		for _, item := range entries {
			if req.Action == "retry" && item.status != "open" && item.status != "failed" && item.status != "discarded" && item.status != "resolved" {
				writeJSONError(w, "dead letter entry has unsupported status for retry", http.StatusConflict)
				return
			}
			if req.Action == "discard" && item.status != "open" && item.status != "failed" && item.status != "discarded" {
				writeJSONError(w, "dead letter entry is not open", http.StatusConflict)
				return
			}
		}
		for _, item := range entries {
			action, newStatus := "ops.dead_letter.discarded", "discarded"
			if req.Action == "retry" {
				action, newStatus = "ops.dead_letter.retry", "open"
			}
			if item.status == newStatus {
				continue
			}
			if req.Action == "retry" {
				if _, err := tx.Exec(ctx, `UPDATE ops.dead_letter_entry SET status='open',resolved_at=NULL,retry_count=retry_count+1 WHERE id=$1`, item.id); err != nil {
					logger.Error("bulk retry dead letters", "error", err)
					writeJSONError(w, "internal error", http.StatusInternalServerError)
					return
				}
			} else if _, err := tx.Exec(ctx, `UPDATE ops.dead_letter_entry SET status='discarded',resolved_at=NOW() WHERE id=$1`, item.id); err != nil {
				logger.Error("bulk discard dead letters", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			beforeJSON, _ := json.Marshal(map[string]any{"bulk": true, "status": item.status})
			afterJSON, _ := json.Marshal(map[string]any{"bulk": true, "status": newStatus})
			if err := recordDeadLetterAudit(ctx, tx, identity.ActorID, item.id, action, req.Reason, beforeJSON, afterJSON); err != nil {
				logger.Error("audit bulk dead letter action", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
		}
		if err := tx.Commit(ctx); err != nil {
			logger.Error("commit bulk dead letter action", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{"processed": len(req.IDs), "action": req.Action})
	}
}

func recordDeadLetterAudit(ctx context.Context, tx pgx.Tx, actorID, id, action, reason string, before, after []byte) error {
	_, err := tx.Exec(ctx, `
		INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, before, after, created_at)
		VALUES ($1, $2, $3, 'ops.dead_letter_entry', $4, $5, $6, NOW())`,
		action, actorID, id, reason, before, after)
	return err
}
