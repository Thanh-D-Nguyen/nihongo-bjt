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

// ── P1-A1.4: Admin Operations — Dead Letter Queue Sub-Domain (5 routes) ─────
// All routes require admin session + appropriate permissions.
// Contracts derived from NestJS apps/api/src/operations/operations.service.ts
// listDeadLettersFiltered, getDeadLetterDetail, retryDeadLetter, resolveDeadLetter, bulkDeadLetter.

// adminOpsDeadLetterListHandler implements GET /api/admin/operations/dead-letter-queue.
func adminOpsDeadLetterListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
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

		dataQuery := `SELECT id, event_type, queue_name, source, error_code, error_message, payload, status, retry_count, created_at, resolved_at
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
				&createdAt, &resolvedAt); err == nil {
				e.CreatedAt = createdAt.UTC().Format(time.RFC3339)
				if resolvedAt != nil {
					s := resolvedAt.UTC().Format(time.RFC3339)
					e.ResolvedAt = &s
				}
				items = append(items, e)
			}
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
		id := extractPathParam(r.URL.Path, "dead-letter-queue", 1)
		if id == "" {
			writeJSONError(w, "dead letter id required", http.StatusBadRequest)
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
			SELECT id, event_type, queue_name, source, error_code, error_message, payload, status, retry_count, created_at, resolved_at
			FROM ops.dead_letter_entry WHERE id = $1`, id).Scan(
			&e.ID, &e.EventType, &e.QueueName, &e.Source,
			&e.ErrorCode, &e.ErrorMessage, &e.Payload, &e.Status, &e.RetryCount,
			&createdAt, &resolvedAt)
		if err != nil {
			writeJSONError(w, "dead letter not found", http.StatusNotFound)
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
			FROM admin.admin_audit_log a
			LEFT JOIN admin.admin_actor act ON act.id = a.actor_id
			WHERE a.target_id = $1 AND a.target_type = 'ops.dead_letter_entry'
			ORDER BY a.created_at DESC LIMIT 100`, id)
		type AuditEntry struct {
			ID         string          `json:"id"`
			Action     string          `json:"action"`
			ActorID    string          `json:"actorId"`
			ActorName  string          `json:"actorName"`
			ActorEmail string          `json:"actorEmail"`
			Reason     string          `json:"reason"`
			After      json.RawMessage `json:"after,omitempty"`
			Before     json.RawMessage `json:"before,omitempty"`
			CreatedAt  string          `json:"createdAt"`
		}
		var audit []AuditEntry
		if aErr == nil {
			defer auditRows.Close()
			for auditRows.Next() {
				var ae AuditEntry
				var ts time.Time
				if err := auditRows.Scan(&ae.ID, &ae.Action, &ae.ActorID, &ae.Reason,
					&ae.After, &ae.Before, &ts, &ae.ActorName, &ae.ActorEmail); err == nil {
					ae.CreatedAt = ts.UTC().Format(time.RFC3339)
					audit = append(audit, ae)
				}
			}
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
		id := extractPathParam(r.URL.Path, "dead-letter-queue", 1)
		if id == "" {
			writeJSONError(w, "dead letter id required", http.StatusBadRequest)
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

		// Verify entry exists and has retryable status
		var existingStatus string
		err := db.QueryRow(r.Context(), "SELECT status FROM ops.dead_letter_entry WHERE id = $1", id).Scan(&existingStatus)
		if err != nil {
			writeJSONError(w, "dead letter not found", http.StatusNotFound)
			return
		}
		if existingStatus != "open" && existingStatus != "failed" && existingStatus != "discarded" && existingStatus != "resolved" {
			writeJSONError(w, "dead letter entry has unsupported status for retry", http.StatusBadRequest)
			return
		}

		// Update entry: reset to open, increment retry count
		_, err = db.Exec(r.Context(), `
			UPDATE ops.dead_letter_entry SET status = 'open', resolved_at = NULL, retry_count = retry_count + 1
			WHERE id = $1`, id)
		if err != nil {
			logger.Error("retry dead letter", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		// Record audit
		afterJSON, _ := json.Marshal(map[string]any{"status": "open"})
		_, err = db.Exec(r.Context(), `
			INSERT INTO admin.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('ops.dead_letter.retry', $1, $2, 'ops.dead_letter_entry', $3, $4, NOW())`,
			identity.ActorID, id, req.Reason, afterJSON)
		if err != nil {
			logger.Error("audit dead letter retry", "error", err)
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
		id := extractPathParam(r.URL.Path, "dead-letter-queue", 1)
		if id == "" {
			writeJSONError(w, "dead letter id required", http.StatusBadRequest)
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
		if req.Reason == "" {
			writeJSONError(w, "reason is required", http.StatusBadRequest)
			return
		}

		// Verify entry exists and is open/failed
		var existingStatus string
		err := db.QueryRow(r.Context(), "SELECT status FROM ops.dead_letter_entry WHERE id = $1", id).Scan(&existingStatus)
		if err != nil {
			writeJSONError(w, "dead letter not found", http.StatusNotFound)
			return
		}
		if existingStatus != "open" && existingStatus != "failed" {
			writeJSONError(w, "dead letter entry is not open", http.StatusBadRequest)
			return
		}

		// Update entry
		_, err = db.Exec(r.Context(), `
			UPDATE ops.dead_letter_entry SET status = $1, resolved_at = NOW() WHERE id = $2`, req.Status, id)
		if err != nil {
			logger.Error("resolve dead letter", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		// Record audit
		action := "ops.dead_letter." + req.Status
		afterJSON, _ := json.Marshal(map[string]any{"status": req.Status})
		_, err = db.Exec(r.Context(), `
			INSERT INTO admin.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ($1, $2, $3, 'ops.dead_letter_entry', $4, $5, NOW())`,
			action, identity.ActorID, id, req.Reason, afterJSON)
		if err != nil {
			logger.Error("audit dead letter resolve", "error", err)
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

		if req.Action == "retry" {
			// Set all to open, increment retry counts
			placeholders := make([]string, len(req.IDs))
			args := make([]any, len(req.IDs))
			for i, id := range req.IDs {
				placeholders[i] = fmt.Sprintf("$%d", i+1)
				args[i] = id
			}
			inClause := strings.Join(placeholders, ",")

			_, err := db.Exec(ctx, fmt.Sprintf(`
				UPDATE ops.dead_letter_entry SET status = 'open', resolved_at = NULL, retry_count = retry_count + 1
				WHERE id IN (%s)`, inClause), args...)
			if err != nil {
				logger.Error("bulk retry dead letters", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}

			// Record individual audit entries
			for _, id := range req.IDs {
				afterJSON, _ := json.Marshal(map[string]any{"bulk": true})
				db.Exec(ctx, `
					INSERT INTO admin.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
					VALUES ('ops.dead_letter.retry', $1, $2, 'ops.dead_letter_entry', $3, $4, NOW())`,
					identity.ActorID, id, req.Reason, afterJSON)
			}
		} else {
			// Discard
			placeholders := make([]string, len(req.IDs))
			args := make([]any, len(req.IDs))
			for i, id := range req.IDs {
				placeholders[i] = fmt.Sprintf("$%d", i+1)
				args[i] = id
			}
			inClause := strings.Join(placeholders, ",")

			_, err := db.Exec(ctx, fmt.Sprintf(`
				UPDATE ops.dead_letter_entry SET status = 'discarded', resolved_at = NOW()
				WHERE id IN (%s)`, inClause), args...)
			if err != nil {
				logger.Error("bulk discard dead letters", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}

			for _, id := range req.IDs {
				afterJSON, _ := json.Marshal(map[string]any{"bulk": true, "status": "discarded"})
				db.Exec(ctx, `
					INSERT INTO admin.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
					VALUES ('ops.dead_letter.discarded', $1, $2, 'ops.dead_letter_entry', $3, $4, NOW())`,
					identity.ActorID, id, req.Reason, afterJSON)
			}
		}

		writeJSON(w, http.StatusOK, map[string]any{"processed": len(req.IDs), "action": req.Action})
	}
}

// Ensure context import is used.
var _ = context.Background