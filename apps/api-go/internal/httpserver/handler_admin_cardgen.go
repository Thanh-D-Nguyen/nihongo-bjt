package httpserver

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
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
		rows, err := db.Query(r.Context(), `SELECT id, name, source_type, filter_level, direction, filter_tags,
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
			SourceType   string          `json:"sourceType"`
			FilterLevel  *string         `json:"filterLevel,omitempty"`
			Direction    string          `json:"direction"`
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
			if err := rows.Scan(&rl.ID, &rl.Name, &rl.SourceType, &rl.FilterLevel, &rl.Direction,
				&rl.FilterTags, &rl.CardTemplate, &rl.Enabled, &ca, &ua); err != nil {
				logger.Error("scan cardgen rule", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
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
			items = append(items, rl)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate cardgen rules", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
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
		ruleID, err := uuid.Parse(id)
		if err != nil {
			writeJSONError(w, "invalid rule id", http.StatusBadRequest)
			return
		}

		type Rule struct {
			ID           string          `json:"id"`
			Name         string          `json:"name"`
			SourceType   string          `json:"sourceType"`
			FilterLevel  *string         `json:"filterLevel,omitempty"`
			Direction    string          `json:"direction"`
			FilterTags   json.RawMessage `json:"filterTags"`
			CardTemplate json.RawMessage `json:"cardTemplate"`
			Enabled      bool            `json:"enabled"`
			CreatedAt    string          `json:"createdAt"`
			UpdatedAt    string          `json:"updatedAt"`
		}
		var rl Rule
		var ca, ua time.Time
		err = db.QueryRow(r.Context(), `SELECT id, name, source_type, filter_level, direction, filter_tags,
			card_template, enabled, created_at, updated_at
			FROM learning.flashcard_gen_rule WHERE id=$1`, ruleID).
			Scan(&rl.ID, &rl.Name, &rl.SourceType, &rl.FilterLevel, &rl.Direction,
				&rl.FilterTags, &rl.CardTemplate, &rl.Enabled, &ca, &ua)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				writeJSONError(w, "rule not found", http.StatusNotFound)
				return
			}
			logger.Error("get cardgen rule", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
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
			SourceType   string          `json:"sourceType"`
			FilterLevel  *string         `json:"filterLevel"`
			Direction    string          `json:"direction"`
			FilterTags   json.RawMessage `json:"filterTags"`
			CardTemplate json.RawMessage `json:"cardTemplate"`
			Enabled      *bool           `json:"enabled"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		req.Name = strings.TrimSpace(req.Name)
		if req.Name == "" {
			writeJSONError(w, "name required", http.StatusBadRequest)
			return
		}
		if req.SourceType != "lexeme" && req.SourceType != "grammar" && req.SourceType != "kanji" {
			writeJSONError(w, "invalid sourceType", http.StatusBadRequest)
			return
		}
		if req.Direction != "jp_to_vn" && req.Direction != "vn_to_jp" && req.Direction != "both" {
			writeJSONError(w, "invalid direction", http.StatusBadRequest)
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

		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin create cardgen rule", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer func() { _ = tx.Rollback(r.Context()) }()
		var id string
		err = tx.QueryRow(r.Context(), `INSERT INTO learning.flashcard_gen_rule
			(name, source_type, filter_level, direction, filter_tags, card_template, enabled, created_at, updated_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW()) RETURNING id`,
			req.Name, req.SourceType, req.FilterLevel, req.Direction, req.FilterTags, req.CardTemplate, enabled).Scan(&id)
		if err != nil {
			logger.Error("create cardgen rule", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		afterJSON, err := json.Marshal(map[string]any{"id": id, "name": req.Name, "sourceType": req.SourceType, "direction": req.Direction, "enabled": enabled})
		if err != nil {
			logger.Error("encode cardgen rule audit", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if _, err := tx.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('cardgen.rule.created',$1,$2,'flashcard_gen_rule','create',$3,NOW())`,
			identity.ActorID, id, afterJSON); err != nil {
			logger.Error("audit create cardgen rule", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			logger.Error("commit create cardgen rule", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

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
		ruleID, err := uuid.Parse(id)
		if err != nil {
			writeJSONError(w, "invalid rule id", http.StatusBadRequest)
			return
		}

		var req struct {
			Name         *string         `json:"name"`
			SourceType   *string         `json:"sourceType"`
			FilterLevel  *string         `json:"filterLevel"`
			Direction    *string         `json:"direction"`
			FilterTags   json.RawMessage `json:"filterTags"`
			CardTemplate json.RawMessage `json:"cardTemplate"`
			Enabled      *bool           `json:"enabled"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.Name != nil {
			*req.Name = strings.TrimSpace(*req.Name)
			if *req.Name == "" {
				writeJSONError(w, "name required", http.StatusBadRequest)
				return
			}
		}
		if req.SourceType != nil && *req.SourceType != "lexeme" && *req.SourceType != "grammar" && *req.SourceType != "kanji" {
			writeJSONError(w, "invalid sourceType", http.StatusBadRequest)
			return
		}
		if req.Direction != nil && *req.Direction != "jp_to_vn" && *req.Direction != "vn_to_jp" && *req.Direction != "both" {
			writeJSONError(w, "invalid direction", http.StatusBadRequest)
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
		if req.SourceType != nil {
			setClauses = append(setClauses, "source_type = $"+itoa(argIdx))
			args = append(args, *req.SourceType)
			argIdx++
		}
		if req.FilterLevel != nil {
			setClauses = append(setClauses, "filter_level = $"+itoa(argIdx))
			args = append(args, *req.FilterLevel)
			argIdx++
		}
		if req.Direction != nil {
			setClauses = append(setClauses, "direction = $"+itoa(argIdx))
			args = append(args, *req.Direction)
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

		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin update cardgen rule", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer func() { _ = tx.Rollback(r.Context()) }()
		var beforeName, beforeSourceType, beforeDirection string
		var beforeLevel *string
		var beforeTags, beforeTemplate []byte
		var beforeEnabled bool
		err = tx.QueryRow(r.Context(), `SELECT name,source_type,filter_level,direction,filter_tags,card_template,enabled
			FROM learning.flashcard_gen_rule WHERE id=$1 FOR UPDATE`, ruleID).
			Scan(&beforeName, &beforeSourceType, &beforeLevel, &beforeDirection, &beforeTags, &beforeTemplate, &beforeEnabled)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "rule not found", http.StatusNotFound)
			return
		}
		if err != nil {
			logger.Error("read cardgen rule before update", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		beforeJSON, err := json.Marshal(map[string]any{"id": id, "name": beforeName, "sourceType": beforeSourceType, "filterLevel": beforeLevel, "direction": beforeDirection, "filterTags": json.RawMessage(beforeTags), "cardTemplate": json.RawMessage(beforeTemplate), "enabled": beforeEnabled})
		if err != nil {
			logger.Error("encode cardgen rule before snapshot", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		query := "UPDATE learning.flashcard_gen_rule SET " + joinStrings(setClauses, ", ") + " WHERE id = $" + itoa(argIdx)
		args = append(args, ruleID)
		if _, err := tx.Exec(r.Context(), query, args...); err != nil {
			logger.Error("update cardgen rule", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		afterJSON, err := json.Marshal(map[string]any{"id": id, "request": req})
		if err != nil {
			logger.Error("encode cardgen rule after snapshot", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if _, err := tx.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, before, after, created_at)
			VALUES ('cardgen.rule.updated',$1,$2,'flashcard_gen_rule','update',$3,$4,NOW())`,
			identity.ActorID, id, beforeJSON, afterJSON); err != nil {
			logger.Error("audit update cardgen rule", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			logger.Error("commit update cardgen rule", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

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
		ruleID, err := uuid.Parse(id)
		if err != nil {
			writeJSONError(w, "invalid rule id", http.StatusBadRequest)
			return
		}
		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin delete cardgen rule", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer func() { _ = tx.Rollback(r.Context()) }()
		var name string
		if err := tx.QueryRow(r.Context(), `DELETE FROM learning.flashcard_gen_rule WHERE id=$1 RETURNING name`, ruleID).Scan(&name); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				writeJSONError(w, "rule not found", http.StatusNotFound)
				return
			}
			logger.Error("delete cardgen rule", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		beforeJSON, err := json.Marshal(map[string]any{"id": id, "name": name})
		if err != nil {
			logger.Error("encode delete cardgen rule audit", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if _, err := tx.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, before, created_at)
			VALUES ('cardgen.rule.deleted',$1,$2,'flashcard_gen_rule','delete',$3,NOW())`,
			identity.ActorID, id, beforeJSON); err != nil {
			logger.Error("audit delete cardgen rule", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			logger.Error("commit delete cardgen rule", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

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
			var ruleID, userID *string
			if err := rows.Scan(&j.ID, &ruleID, &userID, &j.Status, &j.CardsGenerated,
				&j.ErrorMessage, &ca, &cat); err != nil {
				// Keep row decoding errors from silently dropping jobs.
				logger.Error("scan cardgen job", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			if ruleID != nil {
				j.RuleID = *ruleID
			}
			if userID != nil {
				j.UserID = *userID
			}
			j.CreatedAt = ca.UTC().Format(time.RFC3339)
			if cat != nil {
				s := cat.UTC().Format(time.RFC3339)
				j.CompletedAt = &s
			}
			items = append(items, j)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate cardgen jobs", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
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
		jobID, err := uuid.Parse(id)
		if err != nil {
			writeJSONError(w, "invalid job id", http.StatusBadRequest)
			return
		}

		type Job struct {
			ID             string          `json:"id"`
			RuleID         string          `json:"ruleId"`
			UserID         string          `json:"userId"`
			Status         string          `json:"status"`
			CardsGenerated int             `json:"cardsGenerated"`
			ErrorMessage   *string         `json:"errorMessage,omitempty"`
			Params         json.RawMessage `json:"params"`
			CreatedAt      string          `json:"createdAt"`
			CompletedAt    *string         `json:"completedAt,omitempty"`
		}
		var j Job
		var ca time.Time
		var cat *time.Time
		var ruleID, userID *string
		err = db.QueryRow(r.Context(), `SELECT id, rule_id, user_id, status, cards_generated,
			error_message, params, created_at, completed_at
			FROM learning.flashcard_gen_job WHERE id=$1`, jobID).
			Scan(&j.ID, &ruleID, &userID, &j.Status, &j.CardsGenerated,
				&j.ErrorMessage, &j.Params, &ca, &cat)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				writeJSONError(w, "job not found", http.StatusNotFound)
				return
			}
			logger.Error("get cardgen job", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if ruleID != nil {
			j.RuleID = *ruleID
		}
		if userID != nil {
			j.UserID = *userID
		}
		if j.Params == nil {
			j.Params = []byte("{}")
		}
		j.CreatedAt = ca.UTC().Format(time.RFC3339)
		if cat != nil {
			s := cat.UTC().Format(time.RFC3339)
			j.CompletedAt = &s
		}
		writeJSON(w, http.StatusOK, j)
	}
}
