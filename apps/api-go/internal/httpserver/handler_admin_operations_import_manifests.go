package httpserver

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

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
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		statusFilter := r.URL.Query().Get("status")
		limit := queryInt(r, "limit", 100)
		offset := queryInt(r, "offset", 0)

		query := `SELECT id, source_type, target_type, version, status, notes, created_at, updated_at
FROM content.content_import_mapping`
		args := []any{}
		argIdx := 1
		if statusFilter != "" {
			query += ` WHERE status = $` + itoa(argIdx)
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
			ID         string  `json:"id"`
			SourceType string  `json:"sourceType"`
			TargetType string  `json:"targetType"`
			Version    int     `json:"version"`
			Status     string  `json:"status"`
			Notes      *string `json:"notes,omitempty"`
			CreatedAt  string  `json:"createdAt"`
			UpdatedAt  string  `json:"updatedAt"`
		}
		var items []Manifest
		for rows.Next() {
			var m Manifest
			var createdAt, updatedAt time.Time
			if err := rows.Scan(&m.ID, &m.SourceType, &m.TargetType, &m.Version, &m.Status, &m.Notes, &createdAt, &updatedAt); err == nil {
				m.CreatedAt = createdAt.UTC().Format(time.RFC3339)
				m.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
				items = append(items, m)
			}
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
		}

		writeJSON(w, http.StatusOK, map[string]any{"items": items, "total": total})
	}
}

// adminOpsImportManifestsGetHandler implements GET /api/admin/operations/import-manifests/{id}.
func adminOpsImportManifestsGetHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := extractPathParam(r.URL.Path, "import-manifests", 1)
		if id == "" {
			writeJSONError(w, "manifest id required", http.StatusBadRequest)
			return
		}

		type Manifest struct {
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
		var m Manifest
		var createdAt, updatedAt time.Time
		err := db.QueryRow(r.Context(), `
SELECT id, source_type, target_type, version, status, mapping, notes, created_at, updated_at
FROM content.content_import_mapping WHERE id = $1`, id).Scan(
			&m.ID, &m.SourceType, &m.TargetType, &m.Version, &m.Status, &m.Mapping, &m.Notes, &createdAt, &updatedAt)
		if err != nil {
			writeJSONError(w, "manifest not found", http.StatusNotFound)
			return
		}
		m.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		m.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)

		// Fetch audit history
		auditRows, err := db.Query(r.Context(), `
SELECT a.id, a.action, a.actor_id, a.reason, a.after, a.before, a.created_at,
       COALESCE(act.display_name, '') as actor_name, COALESCE(act.email, '') as actor_email
FROM admin.admin_audit_log a
LEFT JOIN admin.admin_actor act ON act.id = a.actor_id
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
		if err == nil {
			defer auditRows.Close()
			for auditRows.Next() {
				var ae AuditEntry
				var ts time.Time
				if err := auditRows.Scan(&ae.ID, &ae.Action, &ae.ActorID, &ae.Reason, &ae.After, &ae.Before, &ts, &ae.ActorName, &ae.ActorEmail); err == nil {
					ae.CreatedAt = ts.UTC().Format(time.RFC3339)
					audit = append(audit, ae)
				}
			}
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
	}
}

// adminOpsImportManifestsCreateHandler implements POST /api/admin/operations/import-manifests.
func adminOpsImportManifestsCreateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
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
		if req.SourceType == "" || req.TargetType == "" || req.Reason == "" {
			writeJSONError(w, "sourceType, targetType, and reason are required", http.StatusBadRequest)
			return
		}

		version := 1
		if req.Version != nil {
			version = *req.Version
		}

		var createdID string
		err := db.QueryRow(r.Context(), `
INSERT INTO content.content_import_mapping (source_type, target_type, version, mapping, notes, status, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, 'draft', NOW(), NOW())
RETURNING id`, req.SourceType, req.TargetType, version, req.Mapping, req.Notes).Scan(&createdID)
		if err != nil {
			logger.Error("create import manifest", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		// Record audit
		afterJSON, _ := json.Marshal(map[string]any{
			"id": createdID, "sourceType": req.SourceType, "targetType": req.TargetType,
			"version": version, "status": "draft",
		})
		_, err = db.Exec(r.Context(), `
INSERT INTO admin.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
VALUES ('ops.import_manifest.create', $1, $2, 'content.import_mapping', $3, $4, NOW())`,
			identity.ActorID, createdID, req.Reason, afterJSON)
		if err != nil {
			logger.Error("audit import manifest create", "error", err)
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"id":         createdID,
			"sourceType": req.SourceType,
			"targetType": req.TargetType,
			"version":    version,
			"status":     "draft",
		})
	}
}

// adminOpsImportManifestsUpdateHandler implements PATCH /api/admin/operations/import-manifests/{id}.
func adminOpsImportManifestsUpdateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		id := extractPathParam(r.URL.Path, "import-manifests", 1)
		if id == "" {
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
		if req.Reason == "" {
			writeJSONError(w, "reason is required", http.StatusBadRequest)
			return
		}

		// Build dynamic UPDATE
		setClauses := []string{}
		args := []any{}
		argIdx := 1
		if req.Mapping != nil {
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
			setClauses = append(setClauses, "status = $"+itoa(argIdx))
			args = append(args, *req.Status)
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
		var u Updated
		var createdAt, updatedAt time.Time
		err := db.QueryRow(r.Context(), query, args...).Scan(
			&u.ID, &u.SourceType, &u.TargetType, &u.Version, &u.Status, &u.Mapping, &u.Notes, &createdAt, &updatedAt)
		if err != nil {
			logger.Error("update import manifest", "error", err)
			writeJSONError(w, "manifest not found or update failed", http.StatusNotFound)
			return
		}
		u.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		u.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)

		// Record audit
		afterJSON, _ := json.Marshal(u)
		_, err = db.Exec(r.Context(), `
INSERT INTO admin.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
VALUES ('ops.import_manifest.update', $1, $2, 'content.import_mapping', $3, $4, NOW())`,
			identity.ActorID, id, req.Reason, afterJSON)
		if err != nil {
			logger.Error("audit import manifest update", "error", err)
		}

		writeJSON(w, http.StatusOK, u)
	}
}

// adminOpsImportManifestsRunHandler implements POST /api/admin/operations/import-manifests/{id}/run.
// Records run request audit; actual execution is async (partial_schema_pending).
func adminOpsImportManifestsRunHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		id := extractPathParam(r.URL.Path, "import-manifests", 1)
		if id == "" {
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
		if req.Reason == "" {
			writeJSONError(w, "reason is required", http.StatusBadRequest)
			return
		}

		// Verify manifest exists and is active
		var status string
		err := db.QueryRow(r.Context(), "SELECT status FROM content.content_import_mapping WHERE id = $1", id).Scan(&status)
		if err != nil {
			writeJSONError(w, "manifest not found", http.StatusNotFound)
			return
		}
		if status != "active" {
			writeJSONError(w, "only active manifests can be run", http.StatusBadRequest)
			return
		}

		// Record audit (actual execution is async/partial_schema_pending)
		afterJSON, _ := json.Marshal(map[string]any{"manifestId": id, "status": "run_requested"})
		_, err = db.Exec(r.Context(), `
INSERT INTO admin.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
VALUES ('ops.import_manifest.run', $1, $2, 'content.import_mapping', $3, $4, NOW())`,
			identity.ActorID, id, req.Reason, afterJSON)
		if err != nil {
			logger.Error("audit import manifest run", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"manifestId":          id,
			"status":              "run_requested",
			"partial_schema_pending": true,
		})
	}
}

// adminOpsImportManifestsHistoryHandler implements GET /api/admin/operations/import-manifests/{id}/history.
func adminOpsImportManifestsHistoryHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := extractPathParam(r.URL.Path, "import-manifests", 1)
		if id == "" {
			writeJSONError(w, "manifest id required", http.StatusBadRequest)
			return
		}

		limit := queryInt(r, "limit", 50)

		rows, err := db.Query(r.Context(), `
SELECT a.id, a.action, a.actor_id, a.reason, a.after, a.before, a.created_at,
       COALESCE(act.display_name, '') as actor_name, COALESCE(act.email, '') as actor_email
FROM admin.admin_audit_log a
LEFT JOIN admin.admin_actor act ON act.id = a.actor_id
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
			if err := rows.Scan(&e.ID, &e.Action, &e.ActorID, &e.Reason, &e.After, &e.Before, &ts, &e.ActorName, &e.ActorEmail); err == nil {
				e.CreatedAt = ts.UTC().Format(time.RFC3339)
				events = append(events, e)
			}
		}
		if events == nil {
			events = []Event{}
		}
		writeJSON(w, http.StatusOK, events)
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