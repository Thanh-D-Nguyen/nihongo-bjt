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

// ── P1-A4.2: Admin Battle — Bots Sub-Domain (8 routes) ─────────────────────
// All routes require admin session + appropriate permissions.
// Contracts derived from NestJS apps/api/src/battle/battle-bots-admin.repository.ts
// list, detail, create, patch, enable, disable, archive, delete.

// adminBattleBotsListHandler implements GET /api/admin/battle/bots.
func adminBattleBotsListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		q := r.URL.Query().Get("q")
		statusFilter := r.URL.Query().Get("status")
		difficultyFilter := r.URL.Query().Get("difficulty")
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
		if difficultyFilter != "" {
			whereParts = append(whereParts, fmt.Sprintf("difficulty = $%d", argIdx))
			args = append(args, difficultyFilter)
			argIdx++
		}
		if q != "" {
			pattern := "%" + q + "%"
			whereParts = append(whereParts, fmt.Sprintf(
				"(name ILIKE $%[1]d OR persona ILIKE $%[1]d)", argIdx))
			args = append(args, pattern)
			argIdx++
		}

		whereClause := ""
		if len(whereParts) > 0 {
			whereClause = "WHERE " + strings.Join(whereParts, " AND ")
		}

		countQuery := "SELECT COUNT(*) FROM learning.battle_bot " + whereClause
		var total int
		if err := db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
			logger.Error("count battle bots", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		dataQuery := fmt.Sprintf(`
			SELECT id, bot_key, name, difficulty, status, accuracy_pct,
			       min_delay_ms, max_delay_ms, vocabulary_level,
			       avatar_fallback, style_token, rive_src,
			       created_at, updated_at
			FROM learning.battle_bot %s
			ORDER BY updated_at DESC LIMIT $%d OFFSET $%d`,
			whereClause, argIdx, argIdx+1)
		args = append(args, pageSize, offset)

		rows, err := db.Query(ctx, dataQuery, args...)
		if err != nil {
			logger.Error("list battle bots", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type BotSummary struct {
			ID              string  `json:"id"`
			BotKey          string  `json:"botKey"`
			Name            string  `json:"name"`
			Difficulty      string  `json:"difficulty"`
			Status          string  `json:"status"`
			AccuracyPct     float64 `json:"accuracyPct"`
			MinDelayMs      int     `json:"minDelayMs"`
			MaxDelayMs      int     `json:"maxDelayMs"`
			VocabularyLevel string  `json:"vocabularyLevel"`
			AvatarFallback  string  `json:"avatarFallback"`
			StyleToken      string  `json:"styleToken"`
			RiveSrc         *string `json:"riveSrc,omitempty"`
			CreatedAt       string  `json:"createdAt"`
			UpdatedAt       string  `json:"updatedAt"`
		}

		var items []BotSummary
		for rows.Next() {
			var b BotSummary
			var createdAt, updatedAt time.Time
			if err := rows.Scan(&b.ID, &b.BotKey, &b.Name, &b.Difficulty, &b.Status,
				&b.AccuracyPct, &b.MinDelayMs, &b.MaxDelayMs, &b.VocabularyLevel,
				&b.AvatarFallback, &b.StyleToken, &b.RiveSrc,
				&createdAt, &updatedAt); err == nil {
				b.CreatedAt = createdAt.UTC().Format(time.RFC3339)
				b.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
				items = append(items, b)
			}
		}
		if items == nil {
			items = []BotSummary{}
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"items":    items,
			"page":     page,
			"pageSize": pageSize,
			"total":    total,
		})
	}
}

// adminBattleBotsDetailHandler implements GET /api/admin/battle/bots/{id}.
func adminBattleBotsDetailHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := extractPathParam(r.URL.Path, "bots", 1)
		if id == "" {
			writeJSONError(w, "bot id required", http.StatusBadRequest)
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

		type BotDetail struct {
			ID              string          `json:"id"`
			BotKey          string          `json:"botKey"`
			Name            string          `json:"name"`
			Persona         *string         `json:"persona,omitempty"`
			Difficulty      string          `json:"difficulty"`
			Status          string          `json:"status"`
			AccuracyPct     float64         `json:"accuracyPct"`
			MinDelayMs      int             `json:"minDelayMs"`
			MaxDelayMs      int             `json:"maxDelayMs"`
			VocabularyLevel string          `json:"vocabularyLevel"`
			AvatarFallback  string          `json:"avatarFallback"`
			StyleToken      string          `json:"styleToken"`
			RiveSrc         *string         `json:"riveSrc,omitempty"`
			RiveArtboard    string          `json:"riveArtboard"`
			RiveStateMachine string         `json:"riveStateMachine"`
			RiveLicense     *string         `json:"riveLicense,omitempty"`
			RiveProvenance  json.RawMessage `json:"riveProvenance,omitempty"`
			CreatedByID     *string         `json:"createdById,omitempty"`
			UpdatedByID     *string         `json:"updatedById,omitempty"`
			CreatedAt       string          `json:"createdAt"`
			UpdatedAt       string          `json:"updatedAt"`
			Audit           []AuditEntry    `json:"audit"`
		}

		var bd BotDetail
		var createdAt, updatedAt time.Time
		var riveProvBytes []byte
		err := db.QueryRow(ctx, `
			SELECT id, bot_key, name, persona, difficulty, status,
			       accuracy_pct, min_delay_ms, max_delay_ms, vocabulary_level,
			       avatar_fallback, style_token, rive_src, rive_artboard,
			       rive_state_machine, rive_license, rive_provenance,
			       created_by_id, updated_by_id, created_at, updated_at
			FROM learning.battle_bot WHERE id = $1`, id).Scan(
			&bd.ID, &bd.BotKey, &bd.Name, &bd.Persona, &bd.Difficulty, &bd.Status,
			&bd.AccuracyPct, &bd.MinDelayMs, &bd.MaxDelayMs, &bd.VocabularyLevel,
			&bd.AvatarFallback, &bd.StyleToken, &bd.RiveSrc, &bd.RiveArtboard,
			&bd.RiveStateMachine, &bd.RiveLicense, &riveProvBytes,
			&bd.CreatedByID, &bd.UpdatedByID, &createdAt, &updatedAt)
		if err != nil {
			writeJSONError(w, "bot not found", http.StatusNotFound)
			return
		}

		bd.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		bd.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
		if riveProvBytes != nil {
			bd.RiveProvenance = riveProvBytes
		} else {
			bd.RiveProvenance = json.RawMessage("{}")
		}

		// Audit trail
		aRows, err := db.Query(ctx, `
			SELECT a.id, a.action, a.actor_id, act.display_name, act.email,
			       a.reason, a.after, a.before, a.created_at
			FROM ops.admin_audit_log a
			LEFT JOIN admin.admin_actor act ON act.id = a.actor_id
			WHERE a.target_id = $1 AND a.target_type = 'learning.battle_bot'
			ORDER BY a.created_at DESC LIMIT 20`, id)
		if err == nil {
			for aRows.Next() {
				var ae AuditEntry
				var ts time.Time
				if err := aRows.Scan(&ae.ID, &ae.Action, &ae.ActorID, &ae.ActorName,
					&ae.ActorEmail, &ae.Reason, &ae.After, &ae.Before, &ts); err == nil {
					ae.CreatedAt = ts.UTC().Format(time.RFC3339)
					bd.Audit = append(bd.Audit, ae)
				}
			}
			aRows.Close()
		}
		if bd.Audit == nil {
			bd.Audit = []AuditEntry{}
		}

		writeJSON(w, http.StatusOK, bd)
	}
}

// adminBattleBotsCreateHandler implements POST /api/admin/battle/bots.
func adminBattleBotsCreateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		var req struct {
			BotKey          string          `json:"botKey"`
			Name            string          `json:"name"`
			Persona         *string         `json:"persona,omitempty"`
			Difficulty      string          `json:"difficulty"`
			AccuracyPct     float64         `json:"accuracyPct"`
			MinDelayMs      int             `json:"minDelayMs"`
			MaxDelayMs      int             `json:"maxDelayMs"`
			VocabularyLevel string          `json:"vocabularyLevel"`
			AvatarFallback  string          `json:"avatarFallback"`
			StyleToken      string          `json:"styleToken"`
			RiveSrc         *string         `json:"riveSrc,omitempty"`
			RiveArtboard    string          `json:"riveArtboard"`
			RiveStateMachine string         `json:"riveStateMachine"`
			RiveLicense     *string         `json:"riveLicense,omitempty"`
			RiveProvenance  json.RawMessage `json:"riveProvenance,omitempty"`
			Reason          string          `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.BotKey == "" || req.Name == "" || req.Difficulty == "" {
			writeJSONError(w, "botKey, name, and difficulty are required", http.StatusBadRequest)
			return
		}

		ctx := r.Context()
		riveProvJSON := req.RiveProvenance
		if riveProvJSON == nil {
			riveProvJSON = json.RawMessage("{}")
		}

		var createdID string
		err := db.QueryRow(ctx, `
			INSERT INTO learning.battle_bot (bot_key, name, persona, difficulty, status,
				accuracy_pct, min_delay_ms, max_delay_ms, vocabulary_level,
				avatar_fallback, style_token, rive_src, rive_artboard,
				rive_state_machine, rive_license, rive_provenance,
				created_by_id, updated_by_id, created_at, updated_at)
			VALUES ($1, $2, $3, $4, 'active', $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $16, NOW(), NOW())
			RETURNING id`,
			req.BotKey, req.Name, req.Persona, req.Difficulty,
			req.AccuracyPct, req.MinDelayMs, req.MaxDelayMs, req.VocabularyLevel,
			req.AvatarFallback, req.StyleToken, req.RiveSrc, req.RiveArtboard,
			req.RiveStateMachine, req.RiveLicense, riveProvJSON,
			identity.ActorID).Scan(&createdID)
		if err != nil {
			logger.Error("create battle bot", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		afterJSON, _ := json.Marshal(map[string]any{
			"botKey": req.BotKey, "name": req.Name, "difficulty": req.Difficulty,
			"status": "active",
		})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('admin.battle.bot.created', $1, $2, 'learning.battle_bot', $3, $4, NOW())`,
			identity.ActorID, createdID, req.Reason, afterJSON)

		r.URL.Path = "/api/admin/battle/bots/" + createdID
		detailHandler := adminBattleBotsDetailHandler(db, logger)
		detailHandler(w, r)
	}
}

// adminBattleBotsPatchHandler implements PATCH /api/admin/battle/bots/{id}.
func adminBattleBotsPatchHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		id := extractPathParam(r.URL.Path, "bots", 1)
		if id == "" {
			writeJSONError(w, "bot id required", http.StatusBadRequest)
			return
		}

		var req struct {
			BotKey          *string         `json:"botKey,omitempty"`
			Name            *string         `json:"name,omitempty"`
			Persona         *string         `json:"persona,omitempty"`
			Difficulty      *string         `json:"difficulty,omitempty"`
			AccuracyPct     *float64        `json:"accuracyPct,omitempty"`
			MinDelayMs      *int            `json:"minDelayMs,omitempty"`
			MaxDelayMs      *int            `json:"maxDelayMs,omitempty"`
			VocabularyLevel *string         `json:"vocabularyLevel,omitempty"`
			AvatarFallback  *string         `json:"avatarFallback,omitempty"`
			StyleToken      *string         `json:"styleToken,omitempty"`
			RiveSrc         *string         `json:"riveSrc,omitempty"`
			RiveArtboard    *string         `json:"riveArtboard,omitempty"`
			RiveStateMachine *string        `json:"riveStateMachine,omitempty"`
			RiveLicense     *string         `json:"riveLicense,omitempty"`
			RiveProvenance  json.RawMessage `json:"riveProvenance,omitempty"`
			Reason          string          `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}

		ctx := r.Context()

		var exists bool
		db.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM learning.battle_bot WHERE id = $1)", id).Scan(&exists)
		if !exists {
			writeJSONError(w, "bot not found", http.StatusNotFound)
			return
		}

		setClauses := []string{}
		args := []any{}
		argIdx := 1

		if req.BotKey != nil {
			setClauses = append(setClauses, "bot_key = $"+itoa(argIdx))
			args = append(args, *req.BotKey)
			argIdx++
		}
		if req.Name != nil {
			setClauses = append(setClauses, "name = $"+itoa(argIdx))
			args = append(args, *req.Name)
			argIdx++
		}
		if req.Persona != nil {
			setClauses = append(setClauses, "persona = $"+itoa(argIdx))
			args = append(args, *req.Persona)
			argIdx++
		}
		if req.Difficulty != nil {
			setClauses = append(setClauses, "difficulty = $"+itoa(argIdx))
			args = append(args, *req.Difficulty)
			argIdx++
		}
		if req.AccuracyPct != nil {
			setClauses = append(setClauses, "accuracy_pct = $"+itoa(argIdx))
			args = append(args, *req.AccuracyPct)
			argIdx++
		}
		if req.MinDelayMs != nil {
			setClauses = append(setClauses, "min_delay_ms = $"+itoa(argIdx))
			args = append(args, *req.MinDelayMs)
			argIdx++
		}
		if req.MaxDelayMs != nil {
			setClauses = append(setClauses, "max_delay_ms = $"+itoa(argIdx))
			args = append(args, *req.MaxDelayMs)
			argIdx++
		}
		if req.VocabularyLevel != nil {
			setClauses = append(setClauses, "vocabulary_level = $"+itoa(argIdx))
			args = append(args, *req.VocabularyLevel)
			argIdx++
		}
		if req.AvatarFallback != nil {
			setClauses = append(setClauses, "avatar_fallback = $"+itoa(argIdx))
			args = append(args, *req.AvatarFallback)
			argIdx++
		}
		if req.StyleToken != nil {
			setClauses = append(setClauses, "style_token = $"+itoa(argIdx))
			args = append(args, *req.StyleToken)
			argIdx++
		}
		if req.RiveSrc != nil {
			setClauses = append(setClauses, "rive_src = $"+itoa(argIdx))
			args = append(args, *req.RiveSrc)
			argIdx++
		}
		if req.RiveArtboard != nil {
			setClauses = append(setClauses, "rive_artboard = $"+itoa(argIdx))
			args = append(args, *req.RiveArtboard)
			argIdx++
		}
		if req.RiveStateMachine != nil {
			setClauses = append(setClauses, "rive_state_machine = $"+itoa(argIdx))
			args = append(args, *req.RiveStateMachine)
			argIdx++
		}
		if req.RiveLicense != nil {
			setClauses = append(setClauses, "rive_license = $"+itoa(argIdx))
			args = append(args, *req.RiveLicense)
			argIdx++
		}
		if req.RiveProvenance != nil {
			setClauses = append(setClauses, "rive_provenance = $"+itoa(argIdx))
			args = append(args, req.RiveProvenance)
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

		query := "UPDATE learning.battle_bot SET " + joinStrings(setClauses, ", ") +
			" WHERE id = $" + itoa(argIdx)
		args = append(args, id)

		if _, err := db.Exec(ctx, query, args...); err != nil {
			logger.Error("patch battle bot", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		afterJSON, _ := json.Marshal(map[string]any{"updated": true, "fields": setClauses})
		beforeJSON, _ := json.Marshal(map[string]any{"id": id})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, before, created_at)
			VALUES ('admin.battle.bot.updated', $1, $2, 'learning.battle_bot', $3, $4, $5, NOW())`,
			identity.ActorID, id, req.Reason, afterJSON, beforeJSON)

		detailHandler := adminBattleBotsDetailHandler(db, logger)
		detailHandler(w, r)
	}
}

// adminBattleBotsToggleHandler implements POST /api/admin/battle/bots/{id}/enable and /disable.
func adminBattleBotsToggleHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		var id, action string
		for i, p := range parts {
			if p == "bots" && i+2 < len(parts) {
				id = parts[i+1]
				action = parts[i+2]
				break
			}
		}
		if id == "" || action == "" {
			writeJSONError(w, "bot id and action required", http.StatusBadRequest)
			return
		}

		var targetStatus string
		switch action {
		case "enable":
			targetStatus = "active"
		case "disable":
			targetStatus = "disabled"
		default:
			writeJSONError(w, "invalid toggle action", http.StatusBadRequest)
			return
		}

		var req struct {
			Reason string `json:"reason"`
		}
		json.NewDecoder(r.Body).Decode(&req)

		ctx := r.Context()

		var currentStatus string
		err := db.QueryRow(ctx, "SELECT status FROM learning.battle_bot WHERE id = $1", id).Scan(&currentStatus)
		if err != nil {
			writeJSONError(w, "bot not found", http.StatusNotFound)
			return
		}

		if currentStatus == "archived" {
			writeJSONError(w, "cannot toggle archived bot", http.StatusBadRequest)
			return
		}

		noop := currentStatus == targetStatus
		if !noop {
			db.Exec(ctx, "UPDATE learning.battle_bot SET status = $1, updated_by_id = $2, updated_at = NOW() WHERE id = $3",
				targetStatus, identity.ActorID, id)
		}

		afterJSON, _ := json.Marshal(map[string]any{"status": targetStatus, "noop": noop})
		beforeJSON, _ := json.Marshal(map[string]any{"status": currentStatus})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, before, created_at)
			VALUES ('admin.battle.bot.toggled', $1, $2, 'learning.battle_bot', $3, $4, $5, NOW())`,
			identity.ActorID, id, req.Reason, afterJSON, beforeJSON)

		detailHandler := adminBattleBotsDetailHandler(db, logger)
		detailHandler(w, r)
	}
}

// adminBattleBotsArchiveHandler implements POST /api/admin/battle/bots/{id}/archive.
func adminBattleBotsArchiveHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		id := extractPathParam(r.URL.Path, "bots", 1)
		if id == "" {
			writeJSONError(w, "bot id required", http.StatusBadRequest)
			return
		}

		var req struct {
			Reason string `json:"reason"`
		}
		json.NewDecoder(r.Body).Decode(&req)

		ctx := r.Context()

		var currentStatus string
		err := db.QueryRow(ctx, "SELECT status FROM learning.battle_bot WHERE id = $1", id).Scan(&currentStatus)
		if err != nil {
			writeJSONError(w, "bot not found", http.StatusNotFound)
			return
		}

		noop := currentStatus == "archived"
		if !noop {
			db.Exec(ctx, "UPDATE learning.battle_bot SET status = 'archived', updated_by_id = $1, updated_at = NOW() WHERE id = $2",
				identity.ActorID, id)
		}

		afterJSON, _ := json.Marshal(map[string]any{"status": "archived", "noop": noop})
		beforeJSON, _ := json.Marshal(map[string]any{"status": currentStatus})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, before, created_at)
			VALUES ('admin.battle.bot.archived', $1, $2, 'learning.battle_bot', $3, $4, $5, NOW())`,
			identity.ActorID, id, req.Reason, afterJSON, beforeJSON)

		detailHandler := adminBattleBotsDetailHandler(db, logger)
		detailHandler(w, r)
	}
}

// adminBattleBotsDeleteHandler implements DELETE /api/admin/battle/bots/{id}.
func adminBattleBotsDeleteHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		id := extractPathParam(r.URL.Path, "bots", 1)
		if id == "" {
			writeJSONError(w, "bot id required", http.StatusBadRequest)
			return
		}

		var req struct {
			Reason string `json:"reason"`
		}
		json.NewDecoder(r.Body).Decode(&req)

		ctx := r.Context()

		var currentStatus string
		err := db.QueryRow(ctx, "SELECT status FROM learning.battle_bot WHERE id = $1", id).Scan(&currentStatus)
		if err != nil {
			writeJSONError(w, "bot not found", http.StatusNotFound)
			return
		}

		if currentStatus != "archived" {
			writeJSONError(w, "only archived bots can be deleted", http.StatusBadRequest)
			return
		}

		db.Exec(ctx, "DELETE FROM learning.battle_bot WHERE id = $1", id)

		beforeJSON, _ := json.Marshal(map[string]any{"id": id, "status": currentStatus})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, before, created_at)
			VALUES ('admin.battle.bot.deleted', $1, $2, 'learning.battle_bot', $3, NULL, $4, NOW())`,
			identity.ActorID, id, req.Reason, beforeJSON)

		writeJSON(w, http.StatusOK, map[string]any{"deleted": true, "id": id})
	}
}