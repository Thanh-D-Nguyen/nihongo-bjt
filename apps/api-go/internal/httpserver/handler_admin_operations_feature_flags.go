package httpserver

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
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
		if !requireOperationsPermission(w, r, db, logger, "iam.manage") {
			return
		}
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
				&f.Scope, &f.Rules, &f.KillSwitch, &createdAt, &updatedAt); err != nil {
				logger.Error("scan feature flags", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			f.CreatedAt = createdAt.UTC().Format(time.RFC3339)
			f.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
			items = append(items, f)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate feature flags", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
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
		if !requireOperationsPermission(w, r, db, logger, "iam.manage") {
			return
		}
		identity, _ := authn.GetAdminIdentity(r.Context())

		key := extractPathParam(r.URL.Path, "feature-flags", 1)
		if key == "" {
			writeJSONError(w, "feature flag key required", http.StatusBadRequest)
			return
		}

		var req struct {
			Enabled      *bool           `json:"enabled,omitempty"`
			KillSwitch   *bool           `json:"killSwitch,omitempty"`
			Rules        json.RawMessage `json:"rules,omitempty"`
			Reason       string          `json:"reason"`
			Confirmation string          `json:"confirmation"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		req.Reason = strings.TrimSpace(req.Reason)
		if len([]rune(req.Reason)) < 3 {
			writeJSONError(w, "reason is required", http.StatusBadRequest)
			return
		}
		if req.Rules != nil {
			var rules map[string]json.RawMessage
			if err := json.Unmarshal(req.Rules, &rules); err != nil || rules == nil {
				writeJSONError(w, "rules must be a JSON object", http.StatusBadRequest)
				return
			}
		}

		ctx := r.Context()
		tx, err := db.Begin(ctx)
		if err != nil {
			logger.Error("begin feature flag update", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer func() { _ = tx.Rollback(ctx) }()

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
		err = tx.QueryRow(ctx, `
			SELECT key, enabled, kill_switch, description, scope, rules, created_at, updated_at
			FROM ops.feature_flag WHERE key = $1 FOR UPDATE`, key).Scan(
			&existing.Key, &existing.Enabled, &existing.KillSwitch, &existing.Description,
			&existing.Scope, &existing.Rules, &createdAt, &updatedAt)
		if err != nil {
			if err == pgx.ErrNoRows {
				writeJSONError(w, "feature flag not found", http.StatusNotFound)
			} else {
				logger.Error("load feature flag for update", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
			}
			return
		}
		highRisk := existing.KillSwitch || (req.KillSwitch != nil && *req.KillSwitch) || isHighRiskFeatureFlagKey(key)
		if highRisk && req.Confirmation != key {
			writeJSON(w, http.StatusBadRequest, map[string]string{"code": "high_risk_confirmation_required"})
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
		err = tx.QueryRow(ctx, query, args...).Scan(
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
		if _, err := tx.Exec(ctx, `
			INSERT INTO ops.feature_flag_audit (flag_key, action, actor_id, before, after, reason, created_at)
			VALUES ($1, 'feature_flag.update', $2, $3, $4, $5, NOW())`,
			key, identity.ActorID, beforeJSON, afterJSON, req.Reason); err != nil {
			logger.Error("write feature flag history", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		// Record admin_audit_log
		if _, err := tx.Exec(ctx, `
			INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, before, created_at)
			VALUES ('ops.feature_flag.update', $1, $2, 'ops.feature_flag', $3, $4, $5, NOW())`,
			identity.ActorID, key, req.Reason, afterJSON, beforeJSON); err != nil {
			logger.Error("write feature flag admin audit", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			logger.Error("commit feature flag update", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		writeJSON(w, http.StatusOK, updated)
	}
}

// adminOpsFeatureFlagsHistoryHandler implements GET /api/admin/operations/feature-flags/{key}/history.
func adminOpsFeatureFlagsHistoryHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !requireOperationsPermission(w, r, db, logger, "iam.manage") {
			return
		}
		key := extractPathParam(r.URL.Path, "feature-flags", 1)
		if key == "" {
			writeJSONError(w, "feature flag key required", http.StatusBadRequest)
			return
		}

		limit := queryInt(r, "limit", 50)
		if limit > 200 {
			limit = 200
		}
		ctx := r.Context()

		// Verify flag exists
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
		var flag Flag
		var createdAt, updatedAt time.Time
		err := db.QueryRow(ctx, `SELECT key, enabled, description, scope, rules, kill_switch, created_at, updated_at FROM ops.feature_flag WHERE key=$1`, key).Scan(
			&flag.Key, &flag.Enabled, &flag.Description, &flag.Scope, &flag.Rules, &flag.KillSwitch, &createdAt, &updatedAt)
		if err == pgx.ErrNoRows {
			writeJSONError(w, "feature flag not found", http.StatusNotFound)
			return
		}
		if err != nil {
			logger.Error("load feature flag history target", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		flag.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		flag.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)

		type AuditEntry struct {
			ID        string          `json:"id"`
			Action    string          `json:"action"`
			ActorID   string          `json:"actorId"`
			Actor     map[string]any  `json:"actor,omitempty"`
			Before    json.RawMessage `json:"before,omitempty"`
			After     json.RawMessage `json:"after,omitempty"`
			Reason    *string         `json:"reason"`
			CreatedAt string          `json:"createdAt"`
		}

		rows, err := db.Query(ctx, `
			SELECT a.id, a.action, a.actor_id, act.display_name, act.email, a.before, a.after, a.reason, a.created_at
			FROM ops.feature_flag_audit a
			LEFT JOIN authz.admin_actor act ON act.id = a.actor_id
			WHERE a.flag_key = $1
			ORDER BY a.created_at DESC
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
			var actorID, displayName, email *string
			if err := rows.Scan(&a.ID, &a.Action, &actorID, &displayName, &email, &a.Before, &a.After, &a.Reason, &ts); err != nil {
				logger.Error("scan feature flag history", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			if actorID != nil {
				a.ActorID = *actorID
				a.Actor = map[string]any{"id": *actorID}
				if displayName != nil {
					a.Actor["displayName"] = *displayName
				}
				if email != nil {
					a.Actor["email"] = *email
				}
			}
			a.CreatedAt = ts.UTC().Format(time.RFC3339)
			audits = append(audits, a)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate feature flag history", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if audits == nil {
			audits = []AuditEntry{}
		}

		writeJSON(w, http.StatusOK, map[string]any{"flag": flag, "audits": audits})
	}
}

func isHighRiskFeatureFlagKey(key string) bool {
	normalized := strings.ToLower(strings.NewReplacer("-", "_", ".", "_").Replace(key))
	for _, prefix := range []string{"monetization_", "billing_", "auth_", "security_"} {
		if strings.HasPrefix(normalized, prefix) {
			return true
		}
	}
	return strings.Contains(normalized, "rate_limit") || strings.Contains(normalized, "ratelimit") || strings.Contains(normalized, "kill_switch") || strings.Contains(normalized, "killswitch")
}
