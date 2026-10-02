package httpserver

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
)

// ── P1-A4.3: Admin Battle — Configs Sub-Domain (8 routes) ───────────────────
// All routes require admin session + appropriate permissions.
// Contracts derived from NestJS apps/api/src/battle/battle-configs-admin.repository.ts
// list, detail, create, patch, publish, archive, duplicate, delete.

// adminBattleConfigsListHandler implements GET /api/admin/battle/configs.
func adminBattleConfigsListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		q := r.URL.Query().Get("q")
		statusFilter := r.URL.Query().Get("status")
		levelFilter := r.URL.Query().Get("level")
		page := queryInt(r, "page", 1)
		pageSize := queryInt(r, "pageSize", 20)
		if page < 1 {
			page = 1
		}
		if pageSize < 1 || pageSize > 100 {
			pageSize = 20
		}
		offset := (page - 1) * pageSize

		whereParts := []string{}
		args := []any{}
		argIdx := 1
		if statusFilter != "" {
			whereParts = append(whereParts, fmt.Sprintf("status = $%d", argIdx))
			args = append(args, statusFilter)
			argIdx++
		}
		if levelFilter != "" {
			whereParts = append(whereParts, fmt.Sprintf("level = $%d", argIdx))
			args = append(args, levelFilter)
			argIdx++
		}
		if q != "" {
			pattern := "%" + q + "%"
			whereParts = append(whereParts, fmt.Sprintf(
				"(name ILIKE $%[1]d OR description ILIKE $%[1]d)", argIdx))
			args = append(args, pattern)
			argIdx++
		}
		whereClause := ""
		if len(whereParts) > 0 {
			whereClause = "WHERE " + strings.Join(whereParts, " AND ")
		}

		countQuery := "SELECT COUNT(*) FROM learning.battle_config " + whereClause
		var total int
		if err := db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
			logger.Error("count battle configs", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		dataQuery := fmt.Sprintf(`
			SELECT id, name, level, status, question_count, time_per_question_sec,
			       max_participants, scoring_rules, published_at, archived_at,
			       created_at, updated_at
			FROM learning.battle_config %s
			ORDER BY updated_at DESC LIMIT $%d OFFSET $%d`,
			whereClause, argIdx, argIdx+1)
		args = append(args, pageSize, offset)

		rows, err := db.Query(ctx, dataQuery, args...)
		if err != nil {
			logger.Error("list battle configs", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type ConfigSummary struct {
			ID                 string          `json:"id"`
			Name               string          `json:"name"`
			Level              string          `json:"level"`
			Status             string          `json:"status"`
			QuestionCount      int             `json:"questionCount"`
			TimePerQuestionSec int             `json:"timePerQuestionSec"`
			MaxParticipants    int             `json:"maxParticipants"`
			ScoringRules       json.RawMessage `json:"scoringRules,omitempty"`
			PublishedAt        *string         `json:"publishedAt,omitempty"`
			ArchivedAt         *string         `json:"archivedAt,omitempty"`
			CreatedAt          string          `json:"createdAt"`
			UpdatedAt          string          `json:"updatedAt"`
		}
		var items []ConfigSummary
		for rows.Next() {
			var c ConfigSummary
			var createdAt, updatedAt time.Time
			var publishedAt, archivedAt *time.Time
			var scoringBytes []byte
			if err := rows.Scan(&c.ID, &c.Name, &c.Level, &c.Status,
				&c.QuestionCount, &c.TimePerQuestionSec, &c.MaxParticipants,
				&scoringBytes, &publishedAt, &archivedAt,
				&createdAt, &updatedAt); err == nil {
				c.CreatedAt = createdAt.UTC().Format(time.RFC3339)
				c.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
				if publishedAt != nil {
					s := publishedAt.UTC().Format(time.RFC3339)
					c.PublishedAt = &s
				}
				if archivedAt != nil {
					s := archivedAt.UTC().Format(time.RFC3339)
					c.ArchivedAt = &s
				}
				if scoringBytes != nil {
					c.ScoringRules = scoringBytes
				}
				items = append(items, c)
			}
		}
		if items == nil {
			items = []ConfigSummary{}
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"items":    items,
			"page":     page,
			"pageSize": pageSize,
			"total":    total,
		})
	}
}

// adminBattleConfigsDetailHandler implements GET /api/admin/battle/configs/{id}.
func adminBattleConfigsDetailHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := extractPathParam(r.URL.Path, "configs", 1)
		if id == "" {
			writeJSONError(w, "config id required", http.StatusBadRequest)
			return
		}
		ctx := r.Context()

		type AuditEntry struct {
			ID         string          `json:"id"`
			Action     string          `json:"action"`
			ActorID    string          `json:"actorId"`
			ActorName  *string         `json:"actorName,omitempty"`
			ActorEmail *string         `json:"actorEmail,omitempty"`
			Reason     string          `json:"reason"`
			After      json.RawMessage `json:"after,omitempty"`
			Before     json.RawMessage `json:"before,omitempty"`
			CreatedAt  string          `json:"createdAt"`
		}
		type ConfigDetail struct {
			ID                 string          `json:"id"`
			Name               string          `json:"name"`
			Description        *string         `json:"description,omitempty"`
			Level              string          `json:"level"`
			Status             string          `json:"status"`
			QuestionPoolKey    string          `json:"questionPoolKey"`
			QuestionCount      int             `json:"questionCount"`
			TimePerQuestionSec int             `json:"timePerQuestionSec"`
			MaxParticipants    int             `json:"maxParticipants"`
			BotDifficulties    []string        `json:"botDifficulties"`
			ScoringRules       json.RawMessage `json:"scoringRules,omitempty"`
			ScheduleStart      *string         `json:"scheduleStart,omitempty"`
			ScheduleEnd        *string         `json:"scheduleEnd,omitempty"`
			PublishedAt        *string         `json:"publishedAt,omitempty"`
			ArchivedAt         *string         `json:"archivedAt,omitempty"`
			CreatedByID        *string         `json:"createdById,omitempty"`
			UpdatedByID        *string         `json:"updatedById,omitempty"`
			CreatedAt          string          `json:"createdAt"`
			UpdatedAt          string          `json:"updatedAt"`
			Audit              []AuditEntry    `json:"audit"`
		}

		var cd ConfigDetail
		var createdAt, updatedAt time.Time
		var publishedAt, archivedAt, scheduleStart, scheduleEnd *time.Time
		var scoringBytes, botDiffBytes []byte
		err := db.QueryRow(ctx, `
			SELECT id, name, description, level, status, question_pool_key,
			       question_count, time_per_question_sec, max_participants,
			       bot_difficulties, scoring_rules, schedule_start, schedule_end,
			       published_at, archived_at, created_by_id, updated_by_id,
			       created_at, updated_at
			FROM learning.battle_config WHERE id = $1`, id).Scan(
			&cd.ID, &cd.Name, &cd.Description, &cd.Level, &cd.Status,
			&cd.QuestionPoolKey, &cd.QuestionCount, &cd.TimePerQuestionSec,
			&cd.MaxParticipants, &botDiffBytes, &scoringBytes,
			&scheduleStart, &scheduleEnd, &publishedAt, &archivedAt,
			&cd.CreatedByID, &cd.UpdatedByID, &createdAt, &updatedAt)
		if err != nil {
			writeJSONError(w, "config not found", http.StatusNotFound)
			return
		}
		cd.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		cd.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
		if publishedAt != nil {
			s := publishedAt.UTC().Format(time.RFC3339)
			cd.PublishedAt = &s
		}
		if archivedAt != nil {
			s := archivedAt.UTC().Format(time.RFC3339)
			cd.ArchivedAt = &s
		}
		if scheduleStart != nil {
			s := scheduleStart.UTC().Format(time.RFC3339)
			cd.ScheduleStart = &s
		}
		if scheduleEnd != nil {
			s := scheduleEnd.UTC().Format(time.RFC3339)
			cd.ScheduleEnd = &s
		}
		if scoringBytes != nil {
			cd.ScoringRules = scoringBytes
		}
		if botDiffBytes != nil {
			_ = json.Unmarshal(botDiffBytes, &cd.BotDifficulties)
		}
		if cd.BotDifficulties == nil {
			cd.BotDifficulties = []string{}
		}

		// Audit trail
		aRows, err := db.Query(ctx, `
			SELECT a.id, a.action, a.actor_id, act.display_name, act.email,
			       a.reason, a.after, a.before, a.created_at
			FROM ops.admin_audit_log a
			LEFT JOIN authz.admin_actor act ON act.id = a.actor_id
			WHERE a.target_id = $1 AND a.target_type = 'learning.battle_config'
			ORDER BY a.created_at DESC LIMIT 20`, id)
		if err == nil {
			for aRows.Next() {
				var ae AuditEntry
				var ts time.Time
				if err := aRows.Scan(&ae.ID, &ae.Action, &ae.ActorID, &ae.ActorName,
					&ae.ActorEmail, &ae.Reason, &ae.After, &ae.Before, &ts); err == nil {
					ae.CreatedAt = ts.UTC().Format(time.RFC3339)
					cd.Audit = append(cd.Audit, ae)
				}
			}
			aRows.Close()
		}
		if cd.Audit == nil {
			cd.Audit = []AuditEntry{}
		}
		writeJSON(w, http.StatusOK, cd)
	}
}

// adminBattleConfigsCreateHandler implements POST /api/admin/battle/configs.
func adminBattleConfigsCreateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			Name               string          `json:"name"`
			Description        *string         `json:"description,omitempty"`
			Level              string          `json:"level"`
			QuestionPoolKey    string          `json:"questionPoolKey"`
			QuestionCount      int             `json:"questionCount"`
			TimePerQuestionSec int             `json:"timePerQuestionSec"`
			MaxParticipants    int             `json:"maxParticipants"`
			BotDifficulties    []string        `json:"botDifficulties"`
			ScoringRules       json.RawMessage `json:"scoringRules,omitempty"`
			ScheduleStart      *string         `json:"scheduleStart,omitempty"`
			ScheduleEnd        *string         `json:"scheduleEnd,omitempty"`
			Reason             string          `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.Name == "" || req.Level == "" || req.QuestionPoolKey == "" {
			writeJSONError(w, "name, level, and questionPoolKey are required", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		scoringJSON := req.ScoringRules
		if scoringJSON == nil {
			scoringJSON = json.RawMessage("{}")
		}
		botDiffJSON, _ := json.Marshal(req.BotDifficulties)

		var createdID string
		err := db.QueryRow(ctx, `
			INSERT INTO learning.battle_config (name, description, level, status,
				question_pool_key, question_count, time_per_question_sec, max_participants,
				bot_difficulties, scoring_rules, schedule_start, schedule_end,
				created_by_id, updated_by_id, created_at, updated_at)
			VALUES ($1, $2, $3, 'draft', $4, $5, $6, $7, $8, $9, $10, $11, $12, $12, NOW(), NOW())
			RETURNING id`,
			req.Name, req.Description, req.Level, req.QuestionPoolKey,
			req.QuestionCount, req.TimePerQuestionSec, req.MaxParticipants,
			botDiffJSON, scoringJSON, req.ScheduleStart, req.ScheduleEnd,
			identity.ActorID).Scan(&createdID)
		if err != nil {
			logger.Error("create battle config", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		afterJSON, _ := json.Marshal(map[string]any{
			"name": req.Name, "level": req.Level, "status": "draft",
		})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('admin.battle.config.created', $1, $2, 'learning.battle_config', $3, $4, NOW())`,
			identity.ActorID, createdID, req.Reason, afterJSON)

		r.URL.Path = "/api/admin/battle/configs/" + createdID
		detailHandler := adminBattleConfigsDetailHandler(db, logger)
		detailHandler(w, r)
	}
}

// adminBattleConfigsPatchHandler implements PATCH /api/admin/battle/configs/{id}.
func adminBattleConfigsPatchHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "configs", 1)
		if id == "" {
			writeJSONError(w, "config id required", http.StatusBadRequest)
			return
		}
		var req struct {
			Name               *string         `json:"name,omitempty"`
			Description        *string         `json:"description,omitempty"`
			Level              *string         `json:"level,omitempty"`
			QuestionPoolKey    *string         `json:"questionPoolKey,omitempty"`
			QuestionCount      *int            `json:"questionCount,omitempty"`
			TimePerQuestionSec *int            `json:"timePerQuestionSec,omitempty"`
			MaxParticipants    *int            `json:"maxParticipants,omitempty"`
			BotDifficulties    []string        `json:"botDifficulties,omitempty"`
			ScoringRules       json.RawMessage `json:"scoringRules,omitempty"`
			ScheduleStart      *string         `json:"scheduleStart,omitempty"`
			ScheduleEnd        *string         `json:"scheduleEnd,omitempty"`
			Reason             string          `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		ctx := r.Context()

		var exists bool
		db.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM learning.battle_config WHERE id = $1)", id).Scan(&exists)
		if !exists {
			writeJSONError(w, "config not found", http.StatusNotFound)
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
		if req.Level != nil {
			setClauses = append(setClauses, "level = $"+itoa(argIdx))
			args = append(args, *req.Level)
			argIdx++
		}
		if req.QuestionPoolKey != nil {
			setClauses = append(setClauses, "question_pool_key = $"+itoa(argIdx))
			args = append(args, *req.QuestionPoolKey)
			argIdx++
		}
		if req.QuestionCount != nil {
			setClauses = append(setClauses, "question_count = $"+itoa(argIdx))
			args = append(args, *req.QuestionCount)
			argIdx++
		}
		if req.TimePerQuestionSec != nil {
			setClauses = append(setClauses, "time_per_question_sec = $"+itoa(argIdx))
			args = append(args, *req.TimePerQuestionSec)
			argIdx++
		}
		if req.MaxParticipants != nil {
			setClauses = append(setClauses, "max_participants = $"+itoa(argIdx))
			args = append(args, *req.MaxParticipants)
			argIdx++
		}
		if req.BotDifficulties != nil {
			botDiffJSON, _ := json.Marshal(req.BotDifficulties)
			setClauses = append(setClauses, "bot_difficulties = $"+itoa(argIdx))
			args = append(args, botDiffJSON)
			argIdx++
		}
		if req.ScoringRules != nil {
			setClauses = append(setClauses, "scoring_rules = $"+itoa(argIdx))
			args = append(args, req.ScoringRules)
			argIdx++
		}
		if req.ScheduleStart != nil {
			setClauses = append(setClauses, "schedule_start = $"+itoa(argIdx))
			args = append(args, *req.ScheduleStart)
			argIdx++
		}
		if req.ScheduleEnd != nil {
			setClauses = append(setClauses, "schedule_end = $"+itoa(argIdx))
			args = append(args, *req.ScheduleEnd)
			argIdx++
		}
		if len(setClauses) == 0 {
			writeJSONError(w, "at least one field to update is required", http.StatusBadRequest)
			return
		}
		setClauses = append(setClauses, "updated_by_id = $"+itoa(argIdx))
		args = append(args, identity.ActorID)
		argIdx++
		setClauses = append(setClauses, "updated_at = NOW()")

		query := "UPDATE learning.battle_config SET " + joinStrings(setClauses, ", ") +
			" WHERE id = $" + itoa(argIdx)
		args = append(args, id)
		if _, err := db.Exec(ctx, query, args...); err != nil {
			logger.Error("patch battle config", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		afterJSON, _ := json.Marshal(map[string]any{"updated": true, "fields": setClauses})
		beforeJSON, _ := json.Marshal(map[string]any{"id": id})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, before, created_at)
			VALUES ('admin.battle.config.updated', $1, $2, 'learning.battle_config', $3, $4, $5, NOW())`,
			identity.ActorID, id, req.Reason, afterJSON, beforeJSON)

		detailHandler := adminBattleConfigsDetailHandler(db, logger)
		detailHandler(w, r)
	}
}

// adminBattleConfigsPublishHandler implements POST /api/admin/battle/configs/{id}/publish.
func adminBattleConfigsPublishHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "configs", 1)
		if id == "" {
			writeJSONError(w, "config id required", http.StatusBadRequest)
			return
		}
		var req struct {
			Reason string `json:"reason"`
		}
		json.NewDecoder(r.Body).Decode(&req)
		ctx := r.Context()

		var beforeStatus string
		err := db.QueryRow(ctx, "SELECT status FROM learning.battle_config WHERE id = $1", id).Scan(&beforeStatus)
		if err != nil {
			writeJSONError(w, "config not found", http.StatusNotFound)
			return
		}
		if beforeStatus == "archived" {
			writeJSONError(w, "cannot publish archived config", http.StatusBadRequest)
			return
		}
		if beforeStatus != "published" {
			db.Exec(ctx, "UPDATE learning.battle_config SET status = 'published', published_at = NOW(), updated_by_id = $1, updated_at = NOW() WHERE id = $2",
				identity.ActorID, id)
		}
		afterJSON, _ := json.Marshal(map[string]any{"status": "published"})
		beforeJSON, _ := json.Marshal(map[string]any{"status": beforeStatus})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, before, created_at)
			VALUES ('admin.battle.config.published', $1, $2, 'learning.battle_config', $3, $4, $5, NOW())`,
			identity.ActorID, id, req.Reason, afterJSON, beforeJSON)

		detailHandler := adminBattleConfigsDetailHandler(db, logger)
		detailHandler(w, r)
	}
}

// adminBattleConfigsArchiveHandler implements POST /api/admin/battle/configs/{id}/archive.
func adminBattleConfigsArchiveHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "configs", 1)
		if id == "" {
			writeJSONError(w, "config id required", http.StatusBadRequest)
			return
		}
		var req struct {
			Reason string `json:"reason"`
		}
		json.NewDecoder(r.Body).Decode(&req)
		ctx := r.Context()

		var beforeStatus string
		err := db.QueryRow(ctx, "SELECT status FROM learning.battle_config WHERE id = $1", id).Scan(&beforeStatus)
		if err != nil {
			writeJSONError(w, "config not found", http.StatusNotFound)
			return
		}
		noop := beforeStatus == "archived"
		if !noop {
			db.Exec(ctx, "UPDATE learning.battle_config SET status = 'archived', archived_at = NOW(), updated_by_id = $1, updated_at = NOW() WHERE id = $2",
				identity.ActorID, id)
		}
		afterJSON, _ := json.Marshal(map[string]any{"status": "archived", "noop": noop})
		beforeJSON, _ := json.Marshal(map[string]any{"status": beforeStatus})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, before, created_at)
			VALUES ('admin.battle.config.archived', $1, $2, 'learning.battle_config', $3, $4, $5, NOW())`,
			identity.ActorID, id, req.Reason, afterJSON, beforeJSON)

		detailHandler := adminBattleConfigsDetailHandler(db, logger)
		detailHandler(w, r)
	}
}

// adminBattleConfigsDuplicateHandler implements POST /api/admin/battle/configs/{id}/duplicate.
func adminBattleConfigsDuplicateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "configs", 1)
		if id == "" {
			writeJSONError(w, "config id required", http.StatusBadRequest)
			return
		}
		var req struct {
			Reason string `json:"reason"`
		}
		json.NewDecoder(r.Body).Decode(&req)
		ctx := r.Context()

		type Source struct {
			Name               string
			Description        *string
			Level              string
			QuestionPoolKey    string
			QuestionCount      int
			TimePerQuestionSec int
			MaxParticipants    int
			BotDifficulties    []byte
			ScoringRules       []byte
			ScheduleStart      *string
			ScheduleEnd        *string
		}
		var src Source
		err := db.QueryRow(ctx, `
			SELECT name, description, level, question_pool_key, question_count,
			       time_per_question_sec, max_participants, bot_difficulties,
			       scoring_rules, schedule_start, schedule_end
			FROM learning.battle_config WHERE id = $1`, id).Scan(
			&src.Name, &src.Description, &src.Level, &src.QuestionPoolKey,
			&src.QuestionCount, &src.TimePerQuestionSec, &src.MaxParticipants,
			&src.BotDifficulties, &src.ScoringRules, &src.ScheduleStart, &src.ScheduleEnd)
		if err != nil {
			writeJSONError(w, "config not found", http.StatusNotFound)
			return
		}

		newName := src.Name + " (copy)"
		if len(newName) > 120 {
			newName = src.Name[:120-6] + " (copy)"
		}
		scoringJSON := src.ScoringRules
		if scoringJSON == nil {
			scoringJSON = []byte("{}")
		}
		botDiffJSON := src.BotDifficulties
		if botDiffJSON == nil {
			botDiffJSON = []byte("[]")
		}

		var createdID string
		err = db.QueryRow(ctx, `
			INSERT INTO learning.battle_config (name, description, level, status,
				question_pool_key, question_count, time_per_question_sec, max_participants,
				bot_difficulties, scoring_rules, schedule_start, schedule_end,
				created_by_id, updated_by_id, created_at, updated_at)
			VALUES ($1, $2, $3, 'draft', $4, $5, $6, $7, $8, $9, $10, $11, $12, $12, NOW(), NOW())
			RETURNING id`,
			newName, src.Description, src.Level, src.QuestionPoolKey,
			src.QuestionCount, src.TimePerQuestionSec, src.MaxParticipants,
			botDiffJSON, scoringJSON, src.ScheduleStart, src.ScheduleEnd,
			identity.ActorID).Scan(&createdID)
		if err != nil {
			logger.Error("duplicate battle config", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		afterJSON, _ := json.Marshal(map[string]any{"newId": createdID, "name": newName, "sourceId": id})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('admin.battle.config.duplicated', $1, $2, 'learning.battle_config', $3, $4, NOW())`,
			identity.ActorID, createdID, req.Reason, afterJSON)

		r.URL.Path = "/api/admin/battle/configs/" + createdID
		detailHandler := adminBattleConfigsDetailHandler(db, logger)
		detailHandler(w, r)
	}
}

// adminBattleConfigsDeleteHandler implements DELETE /api/admin/battle/configs/{id}.
func adminBattleConfigsDeleteHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "configs", 1)
		if id == "" {
			writeJSONError(w, "config id required", http.StatusBadRequest)
			return
		}
		var req struct {
			Reason string `json:"reason"`
		}
		json.NewDecoder(r.Body).Decode(&req)
		ctx := r.Context()

		var beforeStatus string
		err := db.QueryRow(ctx, "SELECT status FROM learning.battle_config WHERE id = $1", id).Scan(&beforeStatus)
		if err != nil {
			writeJSONError(w, "config not found", http.StatusNotFound)
			return
		}
		if beforeStatus != "draft" {
			writeJSONError(w, "only draft configs can be deleted", http.StatusBadRequest)
			return
		}
		db.Exec(ctx, "DELETE FROM learning.battle_config WHERE id = $1", id)
		beforeJSON, _ := json.Marshal(map[string]any{"id": id, "status": beforeStatus})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, before, created_at)
			VALUES ('admin.battle.config.deleted', $1, $2, 'learning.battle_config', $3, NULL, $4, NOW())`,
			identity.ActorID, id, req.Reason, beforeJSON)

		writeJSON(w, http.StatusOK, map[string]any{"deleted": true, "id": id})
	}
}
