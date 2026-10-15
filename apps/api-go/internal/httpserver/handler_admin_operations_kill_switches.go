package httpserver

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
)

// ── P1-A1.8: Admin Operations — Kill Switches Sub-Domain (2 routes) ─────────
// All routes require admin session + appropriate permissions.
// Contracts derived from NestJS apps/api/src/operations/operations.service.ts
// listFeatureFlags (filtered to killSwitch=true), updateFeatureFlag (killSwitch semantics).
// Kill switches are stored in ops.feature_flag with kill_switch = true.

// adminOpsKillSwitchesListHandler implements GET /api/admin/operations/kill-switches.
func adminOpsKillSwitchesListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !requireOperationsPermission(w, r, db, logger, "iam.manage") {
			return
		}
		rows, err := db.Query(r.Context(), `
			SELECT key, enabled, description, scope, rules, created_at, updated_at
			FROM ops.feature_flag
			WHERE kill_switch = true
			ORDER BY key ASC`)
		if err != nil {
			logger.Error("list kill switches", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type KS struct {
			Key         string          `json:"key"`
			Enabled     bool            `json:"enabled"`
			Description *string         `json:"description,omitempty"`
			Scope       *string         `json:"scope,omitempty"`
			Rules       json.RawMessage `json:"rules,omitempty"`
			CreatedAt   string          `json:"createdAt"`
			UpdatedAt   string          `json:"updatedAt"`
		}
		var items []KS
		for rows.Next() {
			var k KS
			var createdAt, updatedAt time.Time
			if err := rows.Scan(&k.Key, &k.Enabled, &k.Description,
				&k.Scope, &k.Rules, &createdAt, &updatedAt); err != nil {
				logger.Error("scan kill switches", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			k.CreatedAt = createdAt.UTC().Format(time.RFC3339)
			k.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
			items = append(items, k)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate kill switches", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if items == nil {
			items = []KS{}
		}
		writeJSON(w, http.StatusOK, items)
	}
}

// adminOpsKillSwitchesUpdateHandler implements PATCH /api/admin/operations/kill-switches/{key}.
func adminOpsKillSwitchesUpdateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !requireOperationsPermission(w, r, db, logger, "iam.manage") {
			return
		}
		identity, _ := authn.GetAdminIdentity(r.Context())

		key := strings.TrimSpace(extractPathParam(r.URL.Path, "kill-switches", 1))
		if key == "" {
			writeJSONError(w, "kill switch key required", http.StatusBadRequest)
			return
		}

		var req struct {
			Enabled      *bool           `json:"enabled,omitempty"`
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
			logger.Error("begin kill switch update", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer func() { _ = tx.Rollback(ctx) }()

		// Lock the row so the before image and update belong to the same change.
		type KS struct {
			Key         string          `json:"key"`
			Enabled     bool            `json:"enabled"`
			KillSwitch  bool            `json:"killSwitch"`
			Description *string         `json:"description,omitempty"`
			Scope       *string         `json:"scope,omitempty"`
			Rules       json.RawMessage `json:"rules,omitempty"`
			CreatedAt   string          `json:"createdAt"`
			UpdatedAt   string          `json:"updatedAt"`
		}
		var existing KS
		var createdAt, updatedAt time.Time
		err = tx.QueryRow(ctx, `
			SELECT key, enabled, kill_switch, description, scope, rules, created_at, updated_at
			FROM ops.feature_flag WHERE key = $1 FOR UPDATE`, key).Scan(
			&existing.Key, &existing.Enabled, &existing.KillSwitch, &existing.Description,
			&existing.Scope, &existing.Rules, &createdAt, &updatedAt)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				writeJSONError(w, "kill switch not found", http.StatusNotFound)
			} else {
				logger.Error("load kill switch", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
			}
			return
		}
		if !existing.KillSwitch {
			writeJSONError(w, "specified key is not a kill switch", http.StatusBadRequest)
			return
		}
		if req.Confirmation != key {
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

		var updated KS
		var uCreatedAt, uUpdatedAt time.Time
		err = tx.QueryRow(ctx, query, args...).Scan(
			&updated.Key, &updated.Enabled, &updated.KillSwitch, &updated.Description,
			&updated.Scope, &updated.Rules, &uCreatedAt, &uUpdatedAt)
		if err != nil {
			logger.Error("update kill switch", "error", err)
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
			logger.Error("audit kill switch update", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		// Record admin_audit_log
		if _, err := tx.Exec(ctx, `
			INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, before, created_at)
			VALUES ('ops.feature_flag.update', $1, $2, 'ops.feature_flag', $3, $4, $5, NOW())`,
			identity.ActorID, key, req.Reason, afterJSON, beforeJSON); err != nil {
			logger.Error("admin audit kill switch update", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			logger.Error("commit kill switch update", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		writeJSON(w, http.StatusOK, updated)
	}
}
