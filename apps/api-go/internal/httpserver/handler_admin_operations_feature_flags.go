package httpserver

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
)

// ── P1-A1.7: Admin Operations — Feature Flags Sub-Domain (3 routes) ─────────
// All routes require admin session + appropriate permissions.
// Contracts derived from NestJS apps/api/src/operations/operations.service.ts
// listFeatureFlags, updateFeatureFlag, featureFlagHistory.

// adminOpsFeatureFlagsListHandler implements GET /api/admin/operations/feature-flags.
func adminOpsFeatureFlagsListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := db.Query(r.Context(), `
			SELECT key, enabled, description, scope, rules, kill_switch, created_at, updated_at
			FROM ops.feature_flag
			ORDER BY key ASC`)
		if err != nil {
			logger.Error("list feature flags", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type Flag struct {
			Key         string          `json:"key"`
			Enabled     bool            `json:"enabled"`
			Description *string         `json:"description,omitempty"`
			Scope       *string         `json:"scope,omitempty"`
			Rules       json.RawMessage `json:"rules,omitempty"`
			KillSwitch  bool            `json:"killSwitch"`
			CreatedAt   string          `json:"createdAt"`
			UpdatedAt   string          `json:"updatedAt"`
		}
		var items []Flag
		for rows.Next() {
			var f Flag
			var createdAt, updatedAt time.Time
			if err := rows.Scan(&f.Key, &f.Enabled, &f.Description,
				&f.Scope, &f.Rules, &f.KillSwitch, &createdAt, &updatedAt); err == nil {
				f.CreatedAt = createdAt.UTC().Format(time.RFC3339)
				f.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
				items = append(items, f)
			}
		}
		if items == nil {
			items = []Flag{}
		}
		writeJSON(w, http.StatusOK, items)
	}
}

// adminOpsFeatureFlagsUpdateHandler implements PATCH /api/admin/operations/feature-flags/{key}.
func adminOpsFeatureFlagsUpdateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		key := extractPathParam(r.URL.Path, "feature-flags", 1)
		if key == "" {
			writeJSONError(w, "feature flag key required", http.StatusBadRequest)
			return
		}

		var req struct {
			Enabled    *bool           `json:"enabled,omitempty"`
			KillSwitch *bool           `json:"killSwitch,omitempty"`
			Rules      json.RawMessage `json:"rules,omitempty"`
			Reason     string          `json:"reason"`
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

		// Fetch existing state for audit
		type Flag struct {
			Key         string          `json:"key"`
			Enabled     bool            `json:"enabled"`
			KillSwitch  bool            `json:"killSwitch"`
			Description *string         `json:"description,omitempty"`
			Scope       *string         `json:"scope,omitempty"`
			Rules       json.RawMessage `json:"rules,omitempty"`
			CreatedAt   string          `json:"createdAt"`
			UpdatedAt   string          `json:"updatedAt"`
		}
		var existing Flag
		var createdAt, updatedAt time.Time
		err := db.QueryRow(ctx, `
			SELECT key, enabled, kill_switch, description, scope, rules, created_at, updated_at
			FROM ops.feature_flag WHERE key = $1`, key).Scan(
			&existing.Key, &existing.Enabled, &existing.KillSwitch, &existing.Description,
			&existing.Scope, &existing.Rules, &createdAt, &updatedAt)
		if err != nil {
			writeJSONError(w, "feature flag not found", http.StatusNotFound)
			return
		}
		existing.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		existing.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)

		// Build dynamic UPDATE
		setClauses := []string{}
		args := []any{}
		argIdx := 1
		if req.Enabled != nil {
			setClauses = append(setClauses, "enabled = $"+itoa(argIdx))
			args = append(args, *req.Enabled)
			argIdx++
		}
		if req.KillSwitch != nil {
			setClauses = append(setClauses, "kill_switch = $"+itoa(argIdx))
			args = append(args, *req.KillSwitch)
			argIdx++
		}
		if req.Rules != nil {
			setClauses = append(setClauses, "rules = $"+itoa(argIdx))
			args = append(args, req.Rules)
			argIdx++
		}
		if len(setClauses) == 0 {
			writeJSONError(w, "at least one field to update is required", http.StatusBadRequest)
			return
		}
		setClauses = append(setClauses, "updated_at = NOW()")

		query := "UPDATE ops.feature_flag SET " + joinStrings(setClauses, ", ") +
			" WHERE key = $" + itoa(argIdx) +
			" RETURNING key, enabled, kill_switch, description, scope, rules, created_at, updated_at"
		args = append(args, key)

		var updated Flag
		var uCreatedAt, uUpdatedAt time.Time
		err = db.QueryRow(ctx, query, args...).Scan(
			&updated.Key, &updated.Enabled, &updated.KillSwitch, &updated.Description,
			&updated.Scope, &updated.Rules, &uCreatedAt, &uUpdatedAt)
		if err != nil {
			logger.Error("update feature flag", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		updated.CreatedAt = uCreatedAt.UTC().Format(time.RFC3339)
		updated.UpdatedAt = uUpdatedAt.UTC().Format(time.RFC3339)

		// Record feature_flag_audit
		beforeJSON, _ := json.Marshal(existing)
		afterJSON, _ := json.Marshal(updated)
		db.Exec(ctx, `
			INSERT INTO ops.feature_flag_audit (flag_key, action, actor_id, before, after, reason, created_at)
			VALUES ($1, 'feature_flag.update', $2, $3, $4, $5, NOW())`,
			key, identity.ActorID, beforeJSON, afterJSON, req.Reason)

		// Record admin_audit_log
		db.Exec(ctx, `
			INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, before, created_at)
			VALUES ('ops.feature_flag.update', $1, $2, 'ops.feature_flag', $3, $4, $5, NOW())`,
			identity.ActorID, key, req.Reason, afterJSON, beforeJSON)

		writeJSON(w, http.StatusOK, updated)
	}
}

// adminOpsFeatureFlagsHistoryHandler implements GET /api/admin/operations/feature-flags/{key}/history.
func adminOpsFeatureFlagsHistoryHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		key := extractPathParam(r.URL.Path, "feature-flags", 1)
		if key == "" {
			writeJSONError(w, "feature flag key required", http.StatusBadRequest)
			return
		}

		limit := queryInt(r, "limit", 50)
		ctx := r.Context()

		// Verify flag exists
		var flagExists bool
		db.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM ops.feature_flag WHERE key = $1)", key).Scan(&flagExists)
		if !flagExists {
			writeJSONError(w, "feature flag not found", http.StatusNotFound)
			return
		}

		type AuditEntry struct {
			ID        string          `json:"id"`
			Action    string          `json:"action"`
			ActorID   string          `json:"actorId"`
			Before    json.RawMessage `json:"before,omitempty"`
			After     json.RawMessage `json:"after,omitempty"`
			Reason    string          `json:"reason"`
			CreatedAt string          `json:"createdAt"`
		}

		rows, err := db.Query(ctx, `
			SELECT id, action, actor_id, before, after, reason, created_at
			FROM ops.feature_flag_audit
			WHERE flag_key = $1
			ORDER BY created_at DESC
			LIMIT $2`, key, limit)
		if err != nil {
			logger.Error("feature flag history", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		var audits []AuditEntry
		for rows.Next() {
			var a AuditEntry
			var ts time.Time
			if err := rows.Scan(&a.ID, &a.Action, &a.ActorID, &a.Before, &a.After, &a.Reason, &ts); err == nil {
				a.CreatedAt = ts.UTC().Format(time.RFC3339)
				audits = append(audits, a)
			}
		}
		if audits == nil {
			audits = []AuditEntry{}
		}

		writeJSON(w, http.StatusOK, map[string]any{"audits": audits})
	}
}
