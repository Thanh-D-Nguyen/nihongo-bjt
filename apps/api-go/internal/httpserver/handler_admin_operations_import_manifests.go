package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
)

// ── P1-A1.3: Admin Operations — Import Manifests Sub-Domain (6 routes) ──────
// All routes require admin session + appropriate permissions.
// Contracts derived from NestJS apps/api/src/operations/operations.service.ts
// listImportManifests, getImportManifestDetail, createImportManifest,
// updateImportManifest, runImportManifest, manifestRunHistory.

// adminOpsImportManifestsListHandler implements GET /api/admin/operations/import-manifests.
func adminOpsImportManifestsListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return importAdminPermission(db, "admin.content.read", func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		statusFilter := r.URL.Query().Get("status")
		limit := queryInt(r, "limit", 100)
		offset := queryInt(r, "offset", 0)
		if limit < 1 {
			limit = 1
		}
		if limit > 200 {
			limit = 200
		}
		if offset < 0 {
			writeJSONError(w, "offset must be non-negative", http.StatusBadRequest)
			return
		}
		if statusFilter != "" && statusFilter != "draft" && statusFilter != "active" && statusFilter != "archived" {
			writeJSONError(w, "invalid status", http.StatusBadRequest)
			return
		}
		statusFilter = importManifestDatabaseStatus(statusFilter)

		query := `SELECT m.id, m.source_type, m.target_type, m.version, m.status, m.notes, m.created_at, m.updated_at,
latest.id, latest.status
FROM content.content_import_mapping m
LEFT JOIN LATERAL (
	SELECT id, status FROM content.content_import_operation_request
	WHERE import_mapping_id=m.id AND operation='manifest_run'
	ORDER BY created_at DESC, id DESC LIMIT 1
) latest ON true`
		args := []any{}
		argIdx := 1
		if statusFilter != "" {
			query += ` WHERE m.status = $` + itoa(argIdx)
			args = append(args, statusFilter)
			argIdx++
		}
		query += ` ORDER BY created_at DESC LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
		args = append(args, limit, offset)

		rows, err := db.Query(ctx, query, args...)
		if err != nil {
			logger.Error("list import manifests", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type Manifest struct {
			ID           string  `json:"id"`
			SourceType   string  `json:"sourceType"`
			TargetType   string  `json:"targetType"`
			Version      int     `json:"version"`
			Status       string  `json:"status"`
			Notes        *string `json:"notes,omitempty"`
			CreatedAt    string  `json:"createdAt"`
			UpdatedAt    string  `json:"updatedAt"`
			RunRequestID *string `json:"runRequestId,omitempty"`
			RunStatus    *string `json:"runStatus,omitempty"`
		}
		var items []Manifest
		for rows.Next() {
			var m Manifest
			var createdAt, updatedAt time.Time
			if err := rows.Scan(&m.ID, &m.SourceType, &m.TargetType, &m.Version, &m.Status, &m.Notes, &createdAt, &updatedAt, &m.RunRequestID, &m.RunStatus); err != nil {
				logger.Error("scan import manifests", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			} else {
				m.Status = importManifestAPIStatus(m.Status)
				m.CreatedAt = createdAt.UTC().Format(time.RFC3339)
				m.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
				items = append(items, m)
			}
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate import manifests", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if items == nil {
			items = []Manifest{}
		}

		// Count total for pagination
		countQuery := `SELECT COUNT(*) FROM content.content_import_mapping`
		countArgs := []any{}
		if statusFilter != "" {
			countQuery += ` WHERE status = $1`
			countArgs = append(countArgs, statusFilter)
		}
		var total int
		if err := db.QueryRow(ctx, countQuery, countArgs...).Scan(&total); err != nil {
			logger.Error("count import manifests", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{"items": items, "total": total, "importProcessorAvailable": false})
	})
}

// adminOpsImportManifestsGetHandler implements GET /api/admin/operations/import-manifests/{id}.
func adminOpsImportManifestsGetHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return importAdminPermission(db, "admin.content.read", func(w http.ResponseWriter, r *http.Request) {
		id := extractPathParam(r.URL.Path, "import-manifests", 1)
		if !isValidUUID(id) {
			writeJSONError(w, "manifest id required", http.StatusBadRequest)
			return
		}

		type Manifest struct {
			ID           string          `json:"id"`
			SourceType   string          `json:"sourceType"`
			TargetType   string          `json:"targetType"`
			Version      int             `json:"version"`
			Status       string          `json:"status"`
			Mapping      json.RawMessage `json:"mapping"`
			Notes        *string         `json:"notes,omitempty"`
			CreatedAt    string          `json:"createdAt"`
			UpdatedAt    string          `json:"updatedAt"`
			RunRequestID *string         `json:"runRequestId,omitempty"`
			RunStatus    *string         `json:"runStatus,omitempty"`
		}
		var m Manifest
		var createdAt, updatedAt time.Time
		err := db.QueryRow(r.Context(), `
SELECT m.id, m.source_type, m.target_type, m.version, m.status, m.mapping, m.notes, m.created_at, m.updated_at,
latest.id, latest.status
FROM content.content_import_mapping m
LEFT JOIN LATERAL (
	SELECT id, status FROM content.content_import_operation_request
	WHERE import_mapping_id=m.id AND operation='manifest_run'
	ORDER BY created_at DESC, id DESC LIMIT 1
) latest ON true
WHERE m.id = $1`, id).Scan(
			&m.ID, &m.SourceType, &m.TargetType, &m.Version, &m.Status, &m.Mapping, &m.Notes, &createdAt, &updatedAt, &m.RunRequestID, &m.RunStatus)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "manifest not found", http.StatusNotFound)
			return
		}
		if err != nil {
			logger.Error("get import manifest", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		m.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		m.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
		m.Status = importManifestAPIStatus(m.Status)

		// Fetch audit history
		auditRows, err := db.Query(r.Context(), `
SELECT a.id, a.action, a.actor_id, a.reason, a.after, a.before, a.created_at,
       COALESCE(act.display_name, '') as actor_name, COALESCE(act.email, '') as actor_email
FROM ops.admin_audit_log a
LEFT JOIN authz.admin_actor act ON act.id = a.actor_id
WHERE a.target_id = $1 AND a.target_type = 'content.import_mapping'
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
		if err != nil {
			logger.Error("list import manifest audit", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer auditRows.Close()
		for auditRows.Next() {
			var ae AuditEntry
			var ts time.Time
			if err := auditRows.Scan(&ae.ID, &ae.Action, &ae.ActorID, &ae.Reason, &ae.After, &ae.Before, &ts, &ae.ActorName, &ae.ActorEmail); err != nil {
				logger.Error("scan import manifest audit", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			} else {
				ae.CreatedAt = ts.UTC().Format(time.RFC3339)
				audit = append(audit, ae)
			}
		}
		if err := auditRows.Err(); err != nil {
			logger.Error("iterate import manifest audit", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if audit == nil {
			audit = []AuditEntry{}
		}

		resp := map[string]any{
			"id":         m.ID,
			"sourceType": m.SourceType,
			"targetType": m.TargetType,
			"version":    m.Version,
			"status":     m.Status,
			"mapping":    m.Mapping,
			"notes":      m.Notes,
			"createdAt":  m.CreatedAt,
			"updatedAt":  m.UpdatedAt,
			"audit":      audit,
		}
		writeJSON(w, http.StatusOK, resp)
	})
}

// adminOpsImportManifestsCreateHandler implements POST /api/admin/operations/import-manifests.
func adminOpsImportManifestsCreateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return importAdminPermission(db, "admin.content.write", func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		var req struct {
			SourceType string          `json:"sourceType"`
			TargetType string          `json:"targetType"`
			Version    *int            `json:"version,omitempty"`
			Mapping    json.RawMessage `json:"mapping"`
			Notes      *string         `json:"notes,omitempty"`
			Reason     string          `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if strings.TrimSpace(req.SourceType) == "" || strings.TrimSpace(req.TargetType) == "" || len(strings.TrimSpace(req.Reason)) < 3 || !validJSONObject(req.Mapping) {
			writeJSONError(w, "sourceType, targetType, and reason are required", http.StatusBadRequest)
			return
		}

		version := 1
		if req.Version != nil {
			version = *req.Version
		}
		if version < 1 {
			writeJSONError(w, "version must be positive", http.StatusBadRequest)
			return
		}

		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin create import manifest", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(r.Context())
		var createdID string
		err = tx.QueryRow(r.Context(), `
INSERT INTO content.content_import_mapping (source_type, target_type, version, mapping, notes, status, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, 'draft', NOW(), NOW())
RETURNING id`, req.SourceType, req.TargetType, version, req.Mapping, req.Notes).Scan(&createdID)
		if err != nil {
			logger.Error("create import manifest", "error", err)
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.Code == "23505" {
				writeJSONError(w, "manifest version already exists", http.StatusConflict)
				return
			}
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		// Record audit
		afterJSON, _ := json.Marshal(map[string]any{
			"id": createdID, "sourceType": req.SourceType, "targetType": req.TargetType,
			"version": version, "status": "draft",
		})
		_, err = tx.Exec(r.Context(), `
INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
VALUES ('ops.import_manifest.create', $1, $2, 'content.import_mapping', $3, $4, NOW())`,
			identity.ActorID, createdID, req.Reason, afterJSON)
		if err != nil {
			logger.Error("audit import manifest create", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			logger.Error("commit create import manifest", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"id":         createdID,
			"sourceType": req.SourceType,
			"targetType": req.TargetType,
			"version":    version,
			"status":     "draft",
		})
	})
}

// adminOpsImportManifestsUpdateHandler implements PATCH /api/admin/operations/import-manifests/{id}.
func adminOpsImportManifestsUpdateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return importAdminPermission(db, "admin.content.write", func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		id := extractPathParam(r.URL.Path, "import-manifests", 1)
		if !isValidUUID(id) {
			writeJSONError(w, "manifest id required", http.StatusBadRequest)
			return
		}

		var req struct {
			Mapping json.RawMessage `json:"mapping,omitempty"`
			Notes   *string         `json:"notes,omitempty"`
			Status  *string         `json:"status,omitempty"`
			Reason  string          `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if len(strings.TrimSpace(req.Reason)) < 3 {
			writeJSONError(w, "reason is required", http.StatusBadRequest)
			return
		}

		// Build dynamic UPDATE
		setClauses := []string{}
		args := []any{}
		argIdx := 1
		if req.Mapping != nil {
			if !validJSONObject(req.Mapping) {
				writeJSONError(w, "mapping must be a JSON object", http.StatusBadRequest)
				return
			}
			setClauses = append(setClauses, "mapping = $"+itoa(argIdx))
			args = append(args, req.Mapping)
			argIdx++
		}
		if req.Notes != nil {
			setClauses = append(setClauses, "notes = $"+itoa(argIdx))
			args = append(args, *req.Notes)
			argIdx++
		}
		if req.Status != nil {
			if *req.Status != "draft" && *req.Status != "active" && *req.Status != "archived" {
				writeJSONError(w, "invalid status", http.StatusBadRequest)
				return
			}
			setClauses = append(setClauses, "status = $"+itoa(argIdx))
			args = append(args, importManifestDatabaseStatus(*req.Status))
			argIdx++
		}
		if len(setClauses) == 0 {
			writeJSONError(w, "at least one field to update is required", http.StatusBadRequest)
			return
		}
		setClauses = append(setClauses, "updated_at = NOW()")

		query := "UPDATE content.content_import_mapping SET " + joinStrings(setClauses, ", ") +
			" WHERE id = $" + itoa(argIdx) + " RETURNING id, source_type, target_type, version, status, mapping, notes, created_at, updated_at"
		args = append(args, id)

		type Updated struct {
			ID         string          `json:"id"`
			SourceType string          `json:"sourceType"`
			TargetType string          `json:"targetType"`
			Version    int             `json:"version"`
			Status     string          `json:"status"`
			Mapping    json.RawMessage `json:"mapping"`
			Notes      *string         `json:"notes,omitempty"`
			CreatedAt  string          `json:"createdAt"`
			UpdatedAt  string          `json:"updatedAt"`
		}
		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin update import manifest", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(r.Context())
		var u Updated
		var createdAt, updatedAt time.Time
		err = tx.QueryRow(r.Context(), query, args...).Scan(
			&u.ID, &u.SourceType, &u.TargetType, &u.Version, &u.Status, &u.Mapping, &u.Notes, &createdAt, &updatedAt)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "manifest not found", http.StatusNotFound)
			return
		}
		if err != nil {
			logger.Error("update import manifest", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		u.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		u.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
		u.Status = importManifestAPIStatus(u.Status)

		// Record audit
		afterJSON, _ := json.Marshal(u)
		_, err = tx.Exec(r.Context(), `
INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
VALUES ('ops.import_manifest.update', $1, $2, 'content.import_mapping', $3, $4, NOW())`,
			identity.ActorID, id, req.Reason, afterJSON)
		if err != nil {
			logger.Error("audit import manifest update", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			logger.Error("commit update import manifest", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		writeJSON(w, http.StatusOK, u)
	})
}

// adminOpsImportManifestsRunHandler implements POST /api/admin/operations/import-manifests/{id}/run.
// Persists and audits a queued run request. No import manifest executor is registered yet.
func adminOpsImportManifestsRunHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return importAdminPermission(db, "admin.content.write", func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		id := extractPathParam(r.URL.Path, "import-manifests", 1)
		if !isValidUUID(id) {
			writeJSONError(w, "manifest id required", http.StatusBadRequest)
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
			logger.Error("begin import manifest run", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(ctx)
		var status string
		err = tx.QueryRow(ctx, "SELECT status FROM content.content_import_mapping WHERE id = $1 FOR UPDATE", id).Scan(&status)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "manifest not found", http.StatusNotFound)
			return
		}
		if err != nil {
			logger.Error("load import manifest for run", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if status != "approved" {
			writeJSONError(w, "only approved manifests can be run", http.StatusBadRequest)
			return
		}

		var requestID string
		err = tx.QueryRow(ctx, `
INSERT INTO content.content_import_operation_request
	(import_mapping_id, operation, status, reason, requested_by, created_at, updated_at)
VALUES ($1, 'manifest_run', 'queued', $2, $3, now(), now())
ON CONFLICT (import_mapping_id) WHERE operation='manifest_run' AND status IN ('queued','processing') DO NOTHING
RETURNING id`, id, req.Reason, identity.ActorID).Scan(&requestID)
		created := err == nil
		if errors.Is(err, pgx.ErrNoRows) {
			err = tx.QueryRow(ctx, `SELECT id FROM content.content_import_operation_request WHERE import_mapping_id=$1 AND operation='manifest_run' AND status IN ('queued','processing')`, id).Scan(&requestID)
		}
		if err != nil {
			logger.Error("queue import manifest run", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if created {
			if err := insertImportOperationAudit(ctx, tx, identity.ActorID, id, "content.import_mapping", "ops.import_manifest.run", req.Reason,
				map[string]any{"manifestId": id, "requestId": requestID, "status": "queued", "requestStatus": "queued"}, nil); err != nil {
				logger.Error("audit import manifest run", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
		}
		if err := tx.Commit(ctx); err != nil {
			logger.Error("commit import manifest run", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		writeJSON(w, http.StatusAccepted, map[string]any{
			"manifestId":         id,
			"requestId":          requestID,
			"status":             "queued",
			"requestStatus":      "queued",
			"processorAvailable": false,
			"executionNote":      "No import executor is registered; this request remains queued.",
		})
	})
}

// adminOpsImportManifestsHistoryHandler implements GET /api/admin/operations/import-manifests/{id}/history.
func adminOpsImportManifestsHistoryHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return importAdminPermission(db, "admin.content.read", func(w http.ResponseWriter, r *http.Request) {
		id := extractPathParam(r.URL.Path, "import-manifests", 1)
		if !isValidUUID(id) {
			writeJSONError(w, "manifest id required", http.StatusBadRequest)
			return
		}

		limit := queryInt(r, "limit", 50)
		if limit < 1 {
			limit = 1
		}
		if limit > 200 {
			limit = 200
		}

		rows, err := db.Query(r.Context(), `
SELECT a.id, a.action, a.actor_id, a.reason, a.after, a.before, a.created_at,
       COALESCE(act.display_name, '') as actor_name, COALESCE(act.email, '') as actor_email
FROM ops.admin_audit_log a
LEFT JOIN authz.admin_actor act ON act.id = a.actor_id
WHERE a.target_id = $1 AND a.target_type = 'content.import_mapping' AND a.action = 'ops.import_manifest.run'
ORDER BY a.created_at DESC LIMIT $2`, id, limit)
		if err != nil {
			logger.Error("import manifest history", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type Event struct {
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
		var events []Event
		for rows.Next() {
			var e Event
			var ts time.Time
			if err := rows.Scan(&e.ID, &e.Action, &e.ActorID, &e.Reason, &e.After, &e.Before, &ts, &e.ActorName, &e.ActorEmail); err != nil {
				logger.Error("scan import manifest history", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			} else {
				e.CreatedAt = ts.UTC().Format(time.RFC3339)
				events = append(events, e)
			}
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate import manifest history", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if events == nil {
			events = []Event{}
		}
		writeJSON(w, http.StatusOK, events)
	})
}

func validJSONObject(raw json.RawMessage) bool {
	var object map[string]json.RawMessage
	return json.Unmarshal(raw, &object) == nil && object != nil
}

func importManifestDatabaseStatus(status string) string {
	switch status {
	case "active":
		return "approved"
	case "archived":
		return "deprecated"
	default:
		return status
	}
}

func importManifestAPIStatus(status string) string {
	switch status {
	case "approved":
		return "active"
	case "deprecated":
		return "archived"
	default:
		return status
	}
}

// ── Helpers ─────────────────────────────────────────────────────────────────

func itoa(n int) string {
	if n < 10 {
		return string(rune('0' + n))
	}
	return itoa(n/10) + string(rune('0'+n%10))
}

func joinStrings(parts []string, sep string) string {
	if len(parts) == 0 {
		return ""
	}
	result := parts[0]
	for _, p := range parts[1:] {
		result += sep + p
	}
	return result
}

// Ensure context import is used.
var _ = context.Background
