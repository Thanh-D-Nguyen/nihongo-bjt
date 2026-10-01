package httpserver

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
)

// ── P1-A16: Admin Cardgen — Rules + Jobs (7 routes) ────────────────────────
// Contracts derived from NestJS cardgen-admin.controller.ts, cardgen.repository.ts.
// DB tables: learning.flashcard_gen_rule, learning.flashcard_gen_job, ops.admin_audit_log.

// ── Rules ───────────────────────────────────────────────────────────────────

// adminCardgenRulesListHandler implements GET /api/admin/cardgen/rules.
func adminCardgenRulesListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := db.Query(r.Context(), `SELECT id, name, description, filter_level, filter_tags,
			card_template, enabled, created_at, updated_at
			FROM learning.flashcard_gen_rule ORDER BY created_at DESC`)
		if err != nil {
			logger.Error("list cardgen rules", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type Rule struct {
			ID           string          `json:"id"`
			Name         string          `json:"name"`
			Description  *string         `json:"description,omitempty"`
			FilterLevel  *string         `json:"filterLevel,omitempty"`
			FilterTags   json.RawMessage `json:"filterTags"`
			CardTemplate json.RawMessage `json:"cardTemplate"`
			Enabled      bool            `json:"enabled"`
			CreatedAt    string          `json:"createdAt"`
			UpdatedAt    string          `json:"updatedAt"`
		}
		var items []Rule
		for rows.Next() {
			var rl Rule
			var ca, ua time.Time
			if rows.Scan(&rl.ID, &rl.Name, &rl.Description, &rl.FilterLevel,
				&rl.FilterTags, &rl.CardTemplate, &rl.Enabled, &ca, &ua) == nil {
				rl.CreatedAt = ca.UTC().Format(time.RFC3339)
				rl.UpdatedAt = ua.UTC().Format(time.RFC3339)
				if rl.FilterTags == nil {
					rl.FilterTags = []byte("[]")
				}
				if rl.CardTemplate == nil {
					rl.CardTemplate = []byte("{}")
				}
				items = append(items, rl)
			}
		}
		if items == nil {
			items = []Rule{}
		}
		writeJSON(w, http.StatusOK, items)
	}
}

// adminCardgenRuleDetailHandler implements GET /api/admin/cardgen/rules/{id}.
func adminCardgenRuleDetailHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := extractPathParam(r.URL.Path, "rules", 1)
		if id == "" {
			writeJSONError(w, "rule id required", http.StatusBadRequest)
			return
		}

		type Rule struct {
			ID           string          `json:"id"`
			Name         string          `json:"name"`
			Description  *string         `json:"description,omitempty"`
			FilterLevel  *string         `json:"filterLevel,omitempty"`
			FilterTags   json.RawMessage `json:"filterTags"`
			CardTemplate json.RawMessage `json:"cardTemplate"`
			Enabled      bool            `json:"enabled"`
			CreatedAt    string          `json:"createdAt"`
			UpdatedAt    string          `json:"updatedAt"`
		}
		var rl Rule
		var ca, ua time.Time
		err := db.QueryRow(r.Context(), `SELECT id, name, description, filter_level, filter_tags,
			card_template, enabled, created_at, updated_at
			FROM learning.flashcard_gen_rule WHERE id=$1`, id).
			Scan(&rl.ID, &rl.Name, &rl.Description, &rl.FilterLevel,
				&rl.FilterTags, &rl.CardTemplate, &rl.Enabled, &ca, &ua)
		if err != nil {
			writeJSONError(w, "rule not found", http.StatusNotFound)
			return
		}
		rl.CreatedAt = ca.UTC().Format(time.RFC3339)
		rl.UpdatedAt = ua.UTC().Format(time.RFC3339)
		if rl.FilterTags == nil {
			rl.FilterTags = []byte("[]")
		}
		if rl.CardTemplate == nil {
			rl.CardTemplate = []byte("{}")
		}
		writeJSON(w, http.StatusOK, rl)
	}
}

// adminCardgenRuleCreateHandler implements POST /api/admin/cardgen/rules.
func adminCardgenRuleCreateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		var req struct {
			Name         string          `json:"name"`
			Description  *string         `json:"description"`
			FilterLevel  *string         `json:"filterLevel"`
			FilterTags   json.RawMessage `json:"filterTags"`
			CardTemplate json.RawMessage `json:"cardTemplate"`
			Enabled      *bool           `json:"enabled"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.Name == "" {
			writeJSONError(w, "name required", http.StatusBadRequest)
			return
		}
		if len(req.CardTemplate) == 0 {
			req.CardTemplate = []byte("{}")
		}
		if len(req.FilterTags) == 0 {
			req.FilterTags = []byte("[]")
		}
		enabled := true
		if req.Enabled != nil {
			enabled = *req.Enabled
		}

		var id string
		err := db.QueryRow(r.Context(), `INSERT INTO learning.flashcard_gen_rule
			(name, description, filter_level, filter_tags, card_template, enabled, created_at, updated_at)
			VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW()) RETURNING id`,
			req.Name, req.Description, req.FilterLevel, req.FilterTags, req.CardTemplate, enabled).Scan(&id)
		if err != nil {
			logger.Error("create cardgen rule", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		afterJSON, _ := json.Marshal(map[string]any{"id": id, "name": req.Name})
		db.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('cardgen.rule.created',$1,$2,'flashcard_gen_rule','create',$3,NOW())`,
			identity.ActorID, id, afterJSON)

		writeJSON(w, http.StatusCreated, map[string]any{"id": id})
	}
}

// adminCardgenRuleUpdateHandler implements PUT /api/admin/cardgen/rules/{id}.
func adminCardgenRuleUpdateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		id := extractPathParam(r.URL.Path, "rules", 1)
		if id == "" {
			writeJSONError(w, "rule id required", http.StatusBadRequest)
			return
		}

		var req struct {
			Name         *string         `json:"name"`
			Description  *string         `json:"description"`
			FilterLevel  *string         `json:"filterLevel"`
			FilterTags   json.RawMessage `json:"filterTags"`
			CardTemplate json.RawMessage `json:"cardTemplate"`
			Enabled      *bool           `json:"enabled"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}

		setClauses := []string{}
		args := []any{}
		argIdx := 1
		if req.Name != nil {
			setClauses = append(setClauses, "name = $"+itoa(argIdx))
			args = append(args, *req.Name)
			argIdx++
		}
		if req.Description != nil {
			setClauses = append(setClauses, "description = $"+itoa(argIdx))
			args = append(args, *req.Description)
			argIdx++
		}
		if req.FilterLevel != nil {
			setClauses = append(setClauses, "filter_level = $"+itoa(argIdx))
			args = append(args, *req.FilterLevel)
			argIdx++
		}
		if len(req.FilterTags) > 0 {
			setClauses = append(setClauses, "filter_tags = $"+itoa(argIdx))
			args = append(args, req.FilterTags)
			argIdx++
		}
		if len(req.CardTemplate) > 0 {
			setClauses = append(setClauses, "card_template = $"+itoa(argIdx))
			args = append(args, req.CardTemplate)
			argIdx++
		}
		if req.Enabled != nil {
			setClauses = append(setClauses, "enabled = $"+itoa(argIdx))
			args = append(args, *req.Enabled)
			argIdx++
		}
		if len(setClauses) == 0 {
			writeJSONError(w, "at least one field to update is required", http.StatusBadRequest)
			return
		}
		setClauses = append(setClauses, "updated_at = NOW()")

		query := "UPDATE learning.flashcard_gen_rule SET " + joinStrings(setClauses, ", ") + " WHERE id = $" + itoa(argIdx)
		args = append(args, id)
		if _, err := db.Exec(r.Context(), query, args...); err != nil {
			logger.Error("update cardgen rule", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		afterJSON, _ := json.Marshal(req)
		db.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('cardgen.rule.updated',$1,$2,'flashcard_gen_rule','update',$3,NOW())`,
			identity.ActorID, id, afterJSON)

		writeJSON(w, http.StatusOK, map[string]any{"id": id, "updated": true})
	}
}

// adminCardgenRuleDeleteHandler implements DELETE /api/admin/cardgen/rules/{id}.
func adminCardgenRuleDeleteHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		id := extractPathParam(r.URL.Path, "rules", 1)
		if id == "" {
			writeJSONError(w, "rule id required", http.StatusBadRequest)
			return
		}

		db.Exec(r.Context(), "DELETE FROM learning.flashcard_gen_rule WHERE id=$1", id)

		beforeJSON, _ := json.Marshal(map[string]any{"id": id})
		db.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, before, created_at)
			VALUES ('cardgen.rule.deleted',$1,$2,'flashcard_gen_rule','delete',$3,NOW())`,
			identity.ActorID, id, beforeJSON)

		writeJSON(w, http.StatusOK, map[string]any{"deleted": true})
	}
}

// ── Jobs (read-only for admin) ──────────────────────────────────────────────

// adminCardgenJobsListHandler implements GET /api/admin/cardgen/jobs.
func adminCardgenJobsListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		limit := queryInt(r, "limit", 50)
		if limit < 1 || limit > 500 {
			limit = 50
		}

		rows, err := db.Query(r.Context(), `SELECT id, rule_id, user_id, status, cards_generated,
			error_message, created_at, completed_at
			FROM learning.flashcard_gen_job ORDER BY created_at DESC LIMIT $1`, limit)
		if err != nil {
			logger.Error("list cardgen jobs", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type Job struct {
			ID             string  `json:"id"`
			RuleID         string  `json:"ruleId"`
			UserID         string  `json:"userId"`
			Status         string  `json:"status"`
			CardsGenerated int     `json:"cardsGenerated"`
			ErrorMessage   *string `json:"errorMessage,omitempty"`
			CreatedAt      string  `json:"createdAt"`
			CompletedAt    *string `json:"completedAt,omitempty"`
		}
		var items []Job
		for rows.Next() {
			var j Job
			var ca time.Time
			var cat *time.Time
			if rows.Scan(&j.ID, &j.RuleID, &j.UserID, &j.Status, &j.CardsGenerated,
				&j.ErrorMessage, &ca, &cat) == nil {
				j.CreatedAt = ca.UTC().Format(time.RFC3339)
				if cat != nil {
					s := cat.UTC().Format(time.RFC3339)
					j.CompletedAt = &s
				}
				items = append(items, j)
			}
		}
		if items == nil {
			items = []Job{}
		}
		writeJSON(w, http.StatusOK, items)
	}
}

// adminCardgenJobDetailHandler implements GET /api/admin/cardgen/jobs/{id}.
func adminCardgenJobDetailHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := extractPathParam(r.URL.Path, "jobs", 1)
		if id == "" {
			writeJSONError(w, "job id required", http.StatusBadRequest)
			return
		}

		type Job struct {
			ID             string          `json:"id"`
			RuleID         string          `json:"ruleId"`
			UserID         string          `json:"userId"`
			Status         string          `json:"status"`
			CardsGenerated int             `json:"cardsGenerated"`
			ErrorMessage   *string         `json:"errorMessage,omitempty"`
			ResultPayload  json.RawMessage `json:"resultPayload,omitempty"`
			CreatedAt      string          `json:"createdAt"`
			CompletedAt    *string         `json:"completedAt,omitempty"`
		}
		var j Job
		var ca time.Time
		var cat *time.Time
		err := db.QueryRow(r.Context(), `SELECT id, rule_id, user_id, status, cards_generated,
			error_message, result_payload, created_at, completed_at
			FROM learning.flashcard_gen_job WHERE id=$1`, id).
			Scan(&j.ID, &j.RuleID, &j.UserID, &j.Status, &j.CardsGenerated,
				&j.ErrorMessage, &j.ResultPayload, &ca, &cat)
		if err != nil {
			writeJSONError(w, "job not found", http.StatusNotFound)
			return
		}
		j.CreatedAt = ca.UTC().Format(time.RFC3339)
		if cat != nil {
			s := cat.UTC().Format(time.RFC3339)
			j.CompletedAt = &s
		}
		if j.ResultPayload == nil {
			j.ResultPayload = []byte("{}")
		}
		writeJSON(w, http.StatusOK, j)
	}
}