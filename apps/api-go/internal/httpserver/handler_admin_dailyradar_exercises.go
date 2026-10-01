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

// ── P1-A14: Admin Daily Radar + Exercises — Modules/Cards + Config/CRUD/Analytics (22 routes) ──
// Contracts derived from NestJS daily-radar.controller.ts (admin section lines 125-220),
// exercise-admin.controller.ts, daily-radar.repository.ts, exercise.repository.ts.
// DB tables: daily.daily_radar_module_config, daily.daily_radar_card,
// exercise.exercise, exercise.exercise_config, ops.admin_audit_log.

// ── Daily Radar Admin ───────────────────────────────────────────────────────

// adminDailyRadarSummaryHandler implements GET /api/admin/daily-radar/summary.
func adminDailyRadarSummaryHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var totalModules, publishedModules, totalCards, publishedCards int
		db.QueryRow(r.Context(), "SELECT COUNT(*) FROM daily.daily_radar_module_config").Scan(&totalModules)
		db.QueryRow(r.Context(), "SELECT COUNT(*) FROM daily.daily_radar_module_config WHERE status='published'").Scan(&publishedModules)
		db.QueryRow(r.Context(), "SELECT COUNT(*) FROM daily.daily_radar_card").Scan(&totalCards)
		db.QueryRow(r.Context(), "SELECT COUNT(*) FROM daily.daily_radar_card WHERE status='published'").Scan(&publishedCards)
		writeJSON(w, http.StatusOK, map[string]any{
			"totalModules": totalModules, "publishedModules": publishedModules,
			"totalCards": totalCards, "publishedCards": publishedCards,
		})
	}
}

// adminDailyRadarModulesListHandler implements GET /api/admin/daily-radar/modules.
func adminDailyRadarModulesListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		page := queryInt(r, "page", 1)
		pageSize := queryInt(r, "pageSize", 50)
		q := r.URL.Query().Get("q")
		status := r.URL.Query().Get("status")
		if page < 1 {
			page = 1
		}
		if pageSize < 1 || pageSize > 200 {
			pageSize = 50
		}
		offset := (page - 1) * pageSize
		whereParts := []string{}
		args := []any{}
		argIdx := 1
		if status != "" && status != "all" {
			whereParts = append(whereParts, fmt.Sprintf("status = $%d", argIdx))
			args = append(args, status)
			argIdx++
		}
		if q != "" {
			pattern := "%" + q + "%"
			whereParts = append(whereParts, fmt.Sprintf("(title ILIKE $%[1]d OR key ILIKE $%[1]d)", argIdx))
			args = append(args, pattern)
			argIdx++
		}
		whereClause := ""
		if len(whereParts) > 0 {
			whereClause = "WHERE " + strings.Join(whereParts, " AND ")
		}
		var total int
		db.QueryRow(r.Context(), "SELECT COUNT(*) FROM daily.daily_radar_module_config "+whereClause, args...).Scan(&total)
		dataQ := fmt.Sprintf(`SELECT id, module_key, title_vi, description_vi, icon_key, default_priority, status, created_at, updated_at
FROM daily.daily_radar_module_config %s ORDER BY sort_order ASC, created_at ASC LIMIT $%d OFFSET $%d`,
			whereClause, argIdx, argIdx+1)
		args = append(args, pageSize, offset)
		rows, err := db.Query(r.Context(), dataQ, args...)
		if err != nil {
			logger.Error("list daily radar modules admin", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		type Module struct {
			ID          string  `json:"id"`
			Key         string  `json:"key"`
			Title       string  `json:"title"`
			Description *string `json:"description,omitempty"`
			Icon        *string `json:"icon,omitempty"`
			SortOrder   int     `json:"sortOrder"`
			Status      string  `json:"status"`
			CreatedAt   string  `json:"createdAt"`
			UpdatedAt   string  `json:"updatedAt"`
		}
		var items []Module
		for rows.Next() {
			var m Module
			var ca, ua time.Time
			if rows.Scan(&m.ID, &m.Key, &m.Title, &m.Description, &m.Icon, &m.SortOrder, &m.Status, &ca, &ua) == nil {
				m.CreatedAt = ca.UTC().Format(time.RFC3339)
				m.UpdatedAt = ua.UTC().Format(time.RFC3339)
				items = append(items, m)
			}
		}
		if items == nil {
			items = []Module{}
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"items": items, "page": page, "pageSize": pageSize, "total": total,
		})
	}
}

// adminDailyRadarModuleCreateHandler implements POST /api/admin/daily-radar/modules.
func adminDailyRadarModuleCreateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			Key         string  `json:"key"`
			Title       string  `json:"title"`
			Description *string `json:"description"`
			Icon        *string `json:"icon"`
			SortOrder   *int    `json:"sortOrder"`
			Status      *string `json:"status"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.Key == "" || req.Title == "" {
			writeJSONError(w, "key and title required", http.StatusBadRequest)
			return
		}
		sortOrder := 0
		if req.SortOrder != nil {
			sortOrder = *req.SortOrder
		}
		status := "draft"
		if req.Status != nil {
			status = *req.Status
		}
		var id string
		err := db.QueryRow(r.Context(), `INSERT INTO daily.daily_radar_module_config
(module_key, title_vi, description_vi, icon_key, default_priority, status, created_at, updated_at)
VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW()) RETURNING id`,
			req.Key, req.Title, req.Description, req.Icon, sortOrder, status).Scan(&id)
		if err != nil {
			logger.Error("create daily radar module", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		afterJSON, _ := json.Marshal(map[string]any{"id": id, "key": req.Key})
		db.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
VALUES ('daily_radar.module.created',$1,$2,'daily_radar_module','create',$3,NOW())`,
			identity.ActorID, id, afterJSON)
		writeJSON(w, http.StatusCreated, map[string]any{"id": id, "status": status})
	}
}

// adminDailyRadarModuleDetailHandler implements GET /api/admin/daily-radar/modules/{id}.
func adminDailyRadarModuleDetailHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := extractPathParam(r.URL.Path, "modules", 1)
		if id == "" {
			writeJSONError(w, "module id required", http.StatusBadRequest)
			return
		}
		type Module struct {
			ID          string  `json:"id"`
			Key         string  `json:"key"`
			Title       string  `json:"title"`
			Description *string `json:"description,omitempty"`
			Icon        *string `json:"icon,omitempty"`
			SortOrder   int     `json:"sortOrder"`
			Status      string  `json:"status"`
			CreatedAt   string  `json:"createdAt"`
			UpdatedAt   string  `json:"updatedAt"`
		}
		var m Module
		var ca, ua time.Time
		err := db.QueryRow(r.Context(), `SELECT id, module_key, title_vi, description_vi, icon_key, default_priority, status, created_at, updated_at
FROM daily.daily_radar_module_config WHERE id=$1`, id).
			Scan(&m.ID, &m.Key, &m.Title, &m.Description, &m.Icon, &m.SortOrder, &m.Status, &ca, &ua)
		if err != nil {
			writeJSONError(w, "module not found", http.StatusNotFound)
			return
		}
		m.CreatedAt = ca.UTC().Format(time.RFC3339)
		m.UpdatedAt = ua.UTC().Format(time.RFC3339)
		writeJSON(w, http.StatusOK, m)
	}
}

// adminDailyRadarModulePatchHandler implements PATCH /api/admin/daily-radar/modules/{id}.
func adminDailyRadarModulePatchHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "modules", 1)
		if id == "" {
			writeJSONError(w, "module id required", http.StatusBadRequest)
			return
		}
		var req map[string]any
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		setClauses := []string{}
		args := []any{}
		argIdx := 1
		fieldMap := map[string]string{
			"title": "title", "description": "description", "icon": "icon",
			"sortOrder": "sort_order", "status": "status",
		}
		for k, col := range fieldMap {
			if v, ok := req[k]; ok {
				setClauses = append(setClauses, col+" = $"+itoa(argIdx))
				args = append(args, v)
				argIdx++
			}
		}
		if len(setClauses) == 0 {
			writeJSONError(w, "at least one field to update is required", http.StatusBadRequest)
			return
		}
		setClauses = append(setClauses, "updated_at = NOW()")
		query := "UPDATE daily.daily_radar_module_config SET " + joinStrings(setClauses, ", ") + " WHERE id = $" + itoa(argIdx)
		args = append(args, id)
		if _, err := db.Exec(r.Context(), query, args...); err != nil {
			logger.Error("patch daily radar module", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		afterJSON, _ := json.Marshal(req)
		db.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
VALUES ('daily_radar.module.updated',$1,$2,'daily_radar_module','patch',$3,NOW())`,
			identity.ActorID, id, afterJSON)
		writeJSON(w, http.StatusOK, map[string]any{"id": id, "updated": true})
	}
}

// adminDailyRadarModuleArchiveHandler implements POST /api/admin/daily-radar/modules/{id}/archive.
func adminDailyRadarModuleArchiveHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "modules", 1)
		if id == "" {
			writeJSONError(w, "module id required", http.StatusBadRequest)
			return
		}
		var beforeStatus string
		err := db.QueryRow(r.Context(), "SELECT status FROM daily.daily_radar_module_config WHERE id=$1", id).Scan(&beforeStatus)
		if err != nil {
			writeJSONError(w, "module not found", http.StatusNotFound)
			return
		}
		_, err = db.Exec(r.Context(), "UPDATE daily.daily_radar_module_config SET status='archived', updated_at=NOW() WHERE id=$1", id)
		if err != nil {
			logger.Error("archive daily radar module", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		beforeJSON, _ := json.Marshal(map[string]any{"status": beforeStatus})
		afterJSON, _ := json.Marshal(map[string]any{"status": "archived"})
		db.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, before, after, created_at)
VALUES ('daily_radar.module.archived',$1,$2,'daily_radar_module','archive',$3,$4,NOW())`,
			identity.ActorID, id, beforeJSON, afterJSON)
		writeJSON(w, http.StatusOK, map[string]any{"id": id, "status": "archived"})
	}
}

// adminDailyRadarCardsListHandler implements GET /api/admin/daily-radar/cards.
func adminDailyRadarCardsListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		page := queryInt(r, "page", 1)
		pageSize := queryInt(r, "pageSize", 50)
		q := r.URL.Query().Get("q")
		status := r.URL.Query().Get("status")
		moduleKey := r.URL.Query().Get("moduleKey")
		category := r.URL.Query().Get("category")
		if page < 1 {
			page = 1
		}
		if pageSize < 1 || pageSize > 200 {
			pageSize = 50
		}
		offset := (page - 1) * pageSize
		whereParts := []string{}
		args := []any{}
		argIdx := 1
		if status != "" && status != "all" {
			whereParts = append(whereParts, fmt.Sprintf("status = $%d", argIdx))
			args = append(args, status)
			argIdx++
		}
		if moduleKey != "" {
			whereParts = append(whereParts, fmt.Sprintf("module_key = $%d", argIdx))
			args = append(args, moduleKey)
			argIdx++
		}
		if category != "" {
			whereParts = append(whereParts, fmt.Sprintf("category = $%d", argIdx))
			args = append(args, category)
			argIdx++
		}
		if q != "" {
			pattern := "%" + q + "%"
			whereParts = append(whereParts, fmt.Sprintf("(title ILIKE $%[1]d OR slug ILIKE $%[1]d)", argIdx))
			args = append(args, pattern)
			argIdx++
		}
		whereClause := ""
		if len(whereParts) > 0 {
			whereClause = "WHERE " + strings.Join(whereParts, " AND ")
		}
		var total int
		db.QueryRow(r.Context(), "SELECT COUNT(*) FROM daily.daily_radar_card "+whereClause, args...).Scan(&total)
		dataQ := fmt.Sprintf(`SELECT id, slug, title_vi, description_vi, category, m.module_key, image_url, status, created_at, updated_at
FROM daily.daily_radar_card %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
			whereClause, argIdx, argIdx+1)
		args = append(args, pageSize, offset)
		rows, err := db.Query(r.Context(), dataQ, args...)
		if err != nil {
			logger.Error("list daily radar cards admin", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		type Card struct {
			ID          string  `json:"id"`
			Slug        string  `json:"slug"`
			Title       string  `json:"title"`
			Summary     *string `json:"summary,omitempty"`
			Category    string  `json:"category"`
			ModuleKey   *string `json:"moduleKey,omitempty"`
			ImageURL    *string `json:"imageUrl,omitempty"`
			Status      string  `json:"status"`
			PublishedAt *string `json:"publishedAt,omitempty"`
			CreatedAt   string  `json:"createdAt"`
			UpdatedAt   string  `json:"updatedAt"`
		}
		var items []Card
		for rows.Next() {
			var c Card
			var ca, ua time.Time
			var pa *time.Time
			if rows.Scan(&c.ID, &c.Slug, &c.Title, &c.Summary, &c.Category, &c.ModuleKey, &c.ImageURL, &c.Status, &pa, &ca, &ua) == nil {
				c.CreatedAt = ca.UTC().Format(time.RFC3339)
				c.UpdatedAt = ua.UTC().Format(time.RFC3339)
				if pa != nil {
					s := pa.UTC().Format(time.RFC3339)
					c.PublishedAt = &s
				}
				items = append(items, c)
			}
		}
		if items == nil {
			items = []Card{}
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"items": items, "page": page, "pageSize": pageSize, "total": total,
		})
	}
}

// adminDailyRadarCardCreateHandler implements POST /api/admin/daily-radar/cards.
func adminDailyRadarCardCreateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			Slug        string  `json:"slug"`
			Title       string  `json:"title"`
			Summary     *string `json:"summary"`
			Body        *string `json:"body"`
			Category    string  `json:"category"`
			ModuleKey   *string `json:"moduleKey"`
			ImageURL    *string `json:"imageUrl"`
			Status      *string `json:"status"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.Slug == "" || req.Title == "" || req.Category == "" {
			writeJSONError(w, "slug, title, and category required", http.StatusBadRequest)
			return
		}
		status := "draft"
		if req.Status != nil {
			status = *req.Status
		}
		var id string
		err := db.QueryRow(r.Context(), `INSERT INTO daily.daily_radar_card
(slug, title, summary, body, category, module_key, image_url, status, created_at, updated_at)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW()) RETURNING id`,
			req.Slug, req.Title, req.Summary, req.Body, req.Category, req.ModuleKey, req.ImageURL, status).Scan(&id)
		if err != nil {
			logger.Error("create daily radar card", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		afterJSON, _ := json.Marshal(map[string]any{"id": id, "slug": req.Slug})
		db.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
VALUES ('daily_radar.card.created',$1,$2,'daily_radar_card','create',$3,NOW())`,
			identity.ActorID, id, afterJSON)
		writeJSON(w, http.StatusCreated, map[string]any{"id": id, "status": status})
	}
}

// adminDailyRadarCardDetailHandler implements GET /api/admin/daily-radar/cards/{id}.
func adminDailyRadarCardDetailHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := extractPathParam(r.URL.Path, "cards", 1)
		if id == "" {
			writeJSONError(w, "card id required", http.StatusBadRequest)
			return
		}
		type Card struct {
			ID          string  `json:"id"`
			Slug        string  `json:"slug"`
			Title       string  `json:"title"`
			Summary     *string `json:"summary,omitempty"`
			Body        *string `json:"body,omitempty"`
			Category    string  `json:"category"`
			ModuleKey   *string `json:"moduleKey,omitempty"`
			ImageURL    *string `json:"imageUrl,omitempty"`
			Status      string  `json:"status"`
			PublishedAt *string `json:"publishedAt,omitempty"`
			CreatedAt   string  `json:"createdAt"`
			UpdatedAt   string  `json:"updatedAt"`
		}
		var c Card
		var ca, ua time.Time
		var pa *time.Time
		err := db.QueryRow(r.Context(), `SELECT id, slug, title_vi, description_vi, metadata->>'body', category, m.module_key, image_url, status, created_at, updated_at
FROM daily.daily_radar_card WHERE id=$1`, id).
			Scan(&c.ID, &c.Slug, &c.Title, &c.Summary, &c.Body, &c.Category, &c.ModuleKey, &c.ImageURL, &c.Status, &pa, &ca, &ua)
		if err != nil {
			writeJSONError(w, "card not found", http.StatusNotFound)
			return
		}
		c.CreatedAt = ca.UTC().Format(time.RFC3339)
		c.UpdatedAt = ua.UTC().Format(time.RFC3339)
		if pa != nil {
			s := pa.UTC().Format(time.RFC3339)
			c.PublishedAt = &s
		}
		writeJSON(w, http.StatusOK, c)
	}
}

// adminDailyRadarCardPatchHandler implements PATCH /api/admin/daily-radar/cards/{id}.
func adminDailyRadarCardPatchHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "cards", 1)
		if id == "" {
			writeJSONError(w, "card id required", http.StatusBadRequest)
			return
		}
		var req map[string]any
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		setClauses := []string{}
		args := []any{}
		argIdx := 1
		fieldMap := map[string]string{
			"title": "title", "summary": "summary", "body": "body",
			"category": "category", "moduleKey": "module_key", "imageUrl": "image_url", "status": "status",
		}
		for k, col := range fieldMap {
			if v, ok := req[k]; ok {
				setClauses = append(setClauses, col+" = $"+itoa(argIdx))
				args = append(args, v)
				argIdx++
			}
		}
		if len(setClauses) == 0 {
			writeJSONError(w, "at least one field to update is required", http.StatusBadRequest)
			return
		}
		setClauses = append(setClauses, "updated_at = NOW()")
		query := "UPDATE daily.daily_radar_card SET " + joinStrings(setClauses, ", ") + " WHERE id = $" + itoa(argIdx)
		args = append(args, id)
		if _, err := db.Exec(r.Context(), query, args...); err != nil {
			logger.Error("patch daily radar card", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		afterJSON, _ := json.Marshal(req)
		db.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
VALUES ('daily_radar.card.updated',$1,$2,'daily_radar_card','patch',$3,NOW())`,
			identity.ActorID, id, afterJSON)
		writeJSON(w, http.StatusOK, map[string]any{"id": id, "updated": true})
	}
}

// adminDailyRadarCardPublishHandler implements POST /api/admin/daily-radar/cards/{id}/publish.
func adminDailyRadarCardPublishHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "cards", 1)
		if id == "" {
			writeJSONError(w, "card id required", http.StatusBadRequest)
			return
		}
		var beforeStatus string
		err := db.QueryRow(r.Context(), "SELECT status FROM daily.daily_radar_card WHERE id=$1", id).Scan(&beforeStatus)
		if err != nil {
			writeJSONError(w, "card not found", http.StatusNotFound)
			return
		}
		_, err = db.Exec(r.Context(), `UPDATE daily.daily_radar_card SET
status='published', published_at=COALESCE(published_at,NOW()), updated_at=NOW() WHERE id=$1`, id)
		if err != nil {
			logger.Error("publish daily radar card", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		beforeJSON, _ := json.Marshal(map[string]any{"status": beforeStatus})
		afterJSON, _ := json.Marshal(map[string]any{"status": "published"})
		db.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, before, after, created_at)
VALUES ('daily_radar.card.published',$1,$2,'daily_radar_card','publish',$3,$4,NOW())`,
			identity.ActorID, id, beforeJSON, afterJSON)
		writeJSON(w, http.StatusOK, map[string]any{"id": id, "status": "published"})
	}
}

// adminDailyRadarCardArchiveHandler implements POST /api/admin/daily-radar/cards/{id}/archive.
func adminDailyRadarCardArchiveHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "cards", 1)
		if id == "" {
			writeJSONError(w, "card id required", http.StatusBadRequest)
			return
		}
		var beforeStatus string
		err := db.QueryRow(r.Context(), "SELECT status FROM daily.daily_radar_card WHERE id=$1", id).Scan(&beforeStatus)
		if err != nil {
			writeJSONError(w, "card not found", http.StatusNotFound)
			return
		}
		_, err = db.Exec(r.Context(), "UPDATE daily.daily_radar_card SET status='archived', updated_at=NOW() WHERE id=$1", id)
		if err != nil {
			logger.Error("archive daily radar card", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		beforeJSON, _ := json.Marshal(map[string]any{"status": beforeStatus})
		afterJSON, _ := json.Marshal(map[string]any{"status": "archived"})
		db.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, before, after, created_at)
VALUES ('daily_radar.card.archived',$1,$2,'daily_radar_card','archive',$3,$4,NOW())`,
			identity.ActorID, id, beforeJSON, afterJSON)
		writeJSON(w, http.StatusOK, map[string]any{"id": id, "status": "archived"})
	}
}

// adminDailyRadarCardDuplicateHandler implements POST /api/admin/daily-radar/cards/{id}/duplicate.
func adminDailyRadarCardDuplicateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "cards", 1)
		if id == "" {
			writeJSONError(w, "card id required", http.StatusBadRequest)
			return
		}
		var slug, title, category string
		var summary, body, moduleKey, imageURL *string
		err := db.QueryRow(r.Context(), `SELECT slug, title_vi, description_vi, metadata->>'body', category, m.module_key, image_url
FROM daily.daily_radar_card WHERE id=$1`, id).
			Scan(&slug, &title, &summary, &body, &category, &moduleKey, &imageURL)
		if err != nil {
			writeJSONError(w, "source card not found", http.StatusNotFound)
			return
		}
		newSlug := slug + "-copy-" + time.Now().UTC().Format("20060102150405")
		var newID string
		err = db.QueryRow(r.Context(), `INSERT INTO daily.daily_radar_card
(slug, title, summary, body, category, module_key, image_url, status, created_at, updated_at)
VALUES ($1,$2,$3,$4,$5,$6,$7,'draft',NOW(),NOW()) RETURNING id`,
			newSlug, title, summary, body, category, moduleKey, imageURL).Scan(&newID)
		if err != nil {
			logger.Error("duplicate daily radar card", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		afterJSON, _ := json.Marshal(map[string]any{"id": newID, "duplicatedFrom": id})
		db.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
VALUES ('daily_radar.card.duplicated',$1,$2,'daily_radar_card','duplicate_from_'+$3,$4,NOW())`,
			identity.ActorID, newID, id, afterJSON)
		writeJSON(w, http.StatusCreated, map[string]any{"id": newID, "status": "draft", "duplicatedFrom": id})
	}
}

// ── Exercises Admin ─────────────────────────────────────────────────────────

// adminExercisesConfigListHandler implements GET /api/admin/exercises/config.
func adminExercisesConfigListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := db.Query(r.Context(), `SELECT id, exercise_type, placement, display_order, enabled,
min_level, max_level, time_limit_sec, points_per_correct, created_at, updated_at
FROM exercise.exercise_config ORDER BY placement ASC, display_order ASC`)
		if err != nil {
			logger.Error("list exercise configs", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		type Config struct {
			ID               string  `json:"id"`
			ExerciseType     string  `json:"exerciseType"`
			Placement        string  `json:"placement"`
			DisplayOrder     int     `json:"displayOrder"`
			Enabled          bool    `json:"enabled"`
			MinLevel         *string `json:"minLevel,omitempty"`
			MaxLevel         *string `json:"maxLevel,omitempty"`
			TimeLimitSec     *int    `json:"timeLimitSec,omitempty"`
			PointsPerCorrect int     `json:"pointsPerCorrect"`
			CreatedAt        string  `json:"createdAt"`
			UpdatedAt        string  `json:"updatedAt"`
		}
		var items []Config
		for rows.Next() {
			var c Config
			var ca, ua time.Time
			if rows.Scan(&c.ID, &c.ExerciseType, &c.Placement, &c.DisplayOrder, &c.Enabled,
				&c.MinLevel, &c.MaxLevel, &c.TimeLimitSec, &c.PointsPerCorrect, &ca, &ua) == nil {
				c.CreatedAt = ca.UTC().Format(time.RFC3339)
				c.UpdatedAt = ua.UTC().Format(time.RFC3339)
				items = append(items, c)
			}
		}
		if items == nil {
			items = []Config{}
		}
		writeJSON(w, http.StatusOK, items)
	}
}

// adminExercisesConfigUpsertHandler implements PUT /api/admin/exercises/config.
func adminExercisesConfigUpsertHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			ExerciseType     string  `json:"exerciseType"`
			Placement        string  `json:"placement"`
			DisplayOrder     int     `json:"displayOrder"`
			Enabled          bool    `json:"enabled"`
			MinLevel         *string `json:"minLevel"`
			MaxLevel         *string `json:"maxLevel"`
			TimeLimitSec     *int    `json:"timeLimitSec"`
			PointsPerCorrect int     `json:"pointsPerCorrect"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.ExerciseType == "" || req.Placement == "" {
			writeJSONError(w, "exerciseType and placement required", http.StatusBadRequest)
			return
		}
		var id string
		err := db.QueryRow(r.Context(), `INSERT INTO exercise.exercise_config
(exercise_type, placement, display_order, enabled, min_level, max_level, time_limit_sec, points_per_correct, created_at, updated_at)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())
ON CONFLICT (exercise_type, placement) DO UPDATE SET
display_order=$3, enabled=$4, min_level=$5, max_level=$6, time_limit_sec=$7, points_per_correct=$8, updated_at=NOW()
RETURNING id`,
			req.ExerciseType, req.Placement, req.DisplayOrder, req.Enabled,
			req.MinLevel, req.MaxLevel, req.TimeLimitSec, req.PointsPerCorrect).Scan(&id)
		if err != nil {
			logger.Error("upsert exercise config", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		afterJSON, _ := json.Marshal(req)
		db.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
VALUES ('exercise.config.upserted',$1,$2,'exercise_config','upsert',$3,NOW())`,
			identity.ActorID, id, afterJSON)
		writeJSON(w, http.StatusOK, map[string]any{"id": id, "exerciseType": req.ExerciseType, "placement": req.Placement})
	}
}

// adminExercisesConfigDeleteHandler implements DELETE /api/admin/exercises/config/{id}.
func adminExercisesConfigDeleteHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "config", 1)
		if id == "" {
			writeJSONError(w, "config id required", http.StatusBadRequest)
			return
		}
		db.Exec(r.Context(), "DELETE FROM exercise.exercise_config WHERE id=$1", id)
		beforeJSON, _ := json.Marshal(map[string]any{"id": id})
		db.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, before, created_at)
VALUES ('exercise.config.deleted',$1,$2,'exercise_config','delete',$3,NOW())`,
			identity.ActorID, id, beforeJSON)
		writeJSON(w, http.StatusOK, map[string]any{"deleted": true})
	}
}

// adminExercisesListHandler implements GET /api/admin/exercises.
func adminExercisesListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		page := queryInt(r, "page", 1)
		pageSize := queryInt(r, "pageSize", 20)
		exerciseType := r.URL.Query().Get("type")
		level := r.URL.Query().Get("level")
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
		if exerciseType != "" {
			whereParts = append(whereParts, fmt.Sprintf("exercise_type = $%d", argIdx))
			args = append(args, exerciseType)
			argIdx++
		}
		if level != "" {
			whereParts = append(whereParts, fmt.Sprintf("level = $%d", argIdx))
			args = append(args, level)
			argIdx++
		}
		whereClause := ""
		if len(whereParts) > 0 {
			whereClause = "WHERE " + strings.Join(whereParts, " AND ")
		}
		var total int
		db.QueryRow(r.Context(), "SELECT COUNT(*) FROM exercise.exercise "+whereClause, args...).Scan(&total)
		dataQ := fmt.Sprintf(`SELECT id, exercise_type, source_type, source_id, level, prompt, correct_answer,
difficulty, created_at, updated_at
FROM exercise.exercise %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
			whereClause, argIdx, argIdx+1)
		args = append(args, pageSize, offset)
		rows, err := db.Query(r.Context(), dataQ, args...)
		if err != nil {
			logger.Error("list exercises admin", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		type Exercise struct {
			ID            string  `json:"id"`
			ExerciseType  string  `json:"exerciseType"`
			SourceType    string  `json:"sourceType"`
			SourceID      string  `json:"sourceId"`
			Level         *string `json:"level,omitempty"`
			Prompt        string  `json:"prompt"`
			CorrectAnswer string  `json:"correctAnswer"`
			Difficulty    string  `json:"difficulty"`
			CreatedAt     string  `json:"createdAt"`
			UpdatedAt     string  `json:"updatedAt"`
		}
		var items []Exercise
		for rows.Next() {
			var e Exercise
			var ca, ua time.Time
			if rows.Scan(&e.ID, &e.ExerciseType, &e.SourceType, &e.SourceID, &e.Level, &e.Prompt,
				&e.CorrectAnswer, &e.Difficulty, &ca, &ua) == nil {
				e.CreatedAt = ca.UTC().Format(time.RFC3339)
				e.UpdatedAt = ua.UTC().Format(time.RFC3339)
				items = append(items, e)
			}
		}
		if items == nil {
			items = []Exercise{}
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"items": items, "page": page, "pageSize": pageSize, "total": total,
		})
	}
}

// adminExerciseDetailHandler implements GET /api/admin/exercises/{id}.
func adminExerciseDetailHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := extractPathParam(r.URL.Path, "exercises", 1)
		if id == "" {
			writeJSONError(w, "exercise id required", http.StatusBadRequest)
			return
		}
		type Exercise struct {
			ID            string          `json:"id"`
			ExerciseType  string          `json:"exerciseType"`
			SourceType    string          `json:"sourceType"`
			SourceID      string          `json:"sourceId"`
			Level         *string         `json:"level,omitempty"`
			Prompt        string          `json:"prompt"`
			Choices       json.RawMessage `json:"choices"`
			CorrectAnswer string          `json:"correctAnswer"`
			Explanation   *string         `json:"explanation,omitempty"`
			Difficulty    string          `json:"difficulty"`
			Tags          json.RawMessage `json:"tags"`
			CreatedAt     string          `json:"createdAt"`
			UpdatedAt     string          `json:"updatedAt"`
		}
		var e Exercise
		var ca, ua time.Time
		err := db.QueryRow(r.Context(), `SELECT id, exercise_type, source_type, source_id, level, prompt, choices,
correct_answer, explanation, difficulty, tags, created_at, updated_at
FROM exercise.exercise WHERE id=$1`, id).
			Scan(&e.ID, &e.ExerciseType, &e.SourceType, &e.SourceID, &e.Level, &e.Prompt, &e.Choices,
				&e.CorrectAnswer, &e.Explanation, &e.Difficulty, &e.Tags, &ca, &ua)
		if err != nil {
			writeJSONError(w, "exercise not found", http.StatusNotFound)
			return
		}
		e.CreatedAt = ca.UTC().Format(time.RFC3339)
		e.UpdatedAt = ua.UTC().Format(time.RFC3339)
		writeJSON(w, http.StatusOK, e)
	}
}

// adminExerciseCreateHandler implements POST /api/admin/exercises.
func adminExerciseCreateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			ExerciseType  string          `json:"exerciseType"`
			SourceType    *string         `json:"sourceType"`
			SourceID      *string         `json:"sourceId"`
			Level         *string         `json:"level"`
			Prompt        string          `json:"prompt"`
			Choices       json.RawMessage `json:"choices"`
			CorrectAnswer string          `json:"correctAnswer"`
			Explanation   *string         `json:"explanation"`
			Difficulty    *string         `json:"difficulty"`
			Tags          json.RawMessage `json:"tags"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.ExerciseType == "" || req.Prompt == "" || req.CorrectAnswer == "" {
			writeJSONError(w, "exerciseType, prompt, and correctAnswer required", http.StatusBadRequest)
			return
		}
		sourceType := "manual"
		if req.SourceType != nil {
			sourceType = *req.SourceType
		}
		sourceID := "admin"
		if req.SourceID != nil {
			sourceID = *req.SourceID
		}
		difficulty := "medium"
		if req.Difficulty != nil {
			difficulty = *req.Difficulty
		}
		choices := req.Choices
		if len(choices) == 0 {
			choices = []byte("[]")
		}
		tags := req.Tags
		if len(tags) == 0 {
			tags = []byte("[]")
		}
		var id string
		err := db.QueryRow(r.Context(), `INSERT INTO learning.exercise
(exercise_type, source_type, source_id, level, prompt, choices, correct_answer, explanation, difficulty, tags, created_at, updated_at)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW()) RETURNING id`,
			req.ExerciseType, sourceType, sourceID, req.Level, req.Prompt, choices,
			req.CorrectAnswer, req.Explanation, difficulty, tags).Scan(&id)
		if err != nil {
			logger.Error("create exercise", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		afterJSON, _ := json.Marshal(map[string]any{"id": id, "exerciseType": req.ExerciseType})
		db.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
VALUES ('exercise.created',$1,$2,'exercise','create',$3,NOW())`,
			identity.ActorID, id, afterJSON)
		writeJSON(w, http.StatusCreated, map[string]any{"id": id})
	}
}

// adminExerciseUpdateHandler implements PUT /api/admin/exercises/{id}.
func adminExerciseUpdateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "exercises", 1)
		if id == "" {
			writeJSONError(w, "exercise id required", http.StatusBadRequest)
			return
		}
		var req map[string]any
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		setClauses := []string{}
		args := []any{}
		argIdx := 1
		fieldMap := map[string]string{
			"prompt": "prompt", "correctAnswer": "correct_answer", "explanation": "explanation",
			"difficulty": "difficulty", "level": "level",
		}
		for k, col := range fieldMap {
			if v, ok := req[k]; ok {
				setClauses = append(setClauses, col+" = $"+itoa(argIdx))
				args = append(args, v)
				argIdx++
			}
		}
		if choices, ok := req["choices"]; ok {
			choicesJSON, _ := json.Marshal(choices)
			setClauses = append(setClauses, "choices = $"+itoa(argIdx))
			args = append(args, choicesJSON)
			argIdx++
		}
		if tags, ok := req["tags"]; ok {
			tagsJSON, _ := json.Marshal(tags)
			setClauses = append(setClauses, "tags = $"+itoa(argIdx))
			args = append(args, tagsJSON)
			argIdx++
		}
		if len(setClauses) == 0 {
			writeJSONError(w, "at least one field to update is required", http.StatusBadRequest)
			return
		}
		setClauses = append(setClauses, "updated_at = NOW()")
		query := "UPDATE exercise.exercise SET " + joinStrings(setClauses, ", ") + " WHERE id = $" + itoa(argIdx)
		args = append(args, id)
		if _, err := db.Exec(r.Context(), query, args...); err != nil {
			logger.Error("update exercise", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		afterJSON, _ := json.Marshal(req)
		db.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
VALUES ('exercise.updated',$1,$2,'exercise','update',$3,NOW())`,
			identity.ActorID, id, afterJSON)
		writeJSON(w, http.StatusOK, map[string]any{"id": id, "updated": true})
	}
}

// adminExerciseDeleteHandler implements DELETE /api/admin/exercises/{id}.
func adminExerciseDeleteHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "exercises", 1)
		if id == "" {
			writeJSONError(w, "exercise id required", http.StatusBadRequest)
			return
		}
		db.Exec(r.Context(), "DELETE FROM exercise.exercise WHERE id=$1", id)
		beforeJSON, _ := json.Marshal(map[string]any{"id": id})
		db.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, before, created_at)
VALUES ('exercise.deleted',$1,$2,'exercise','delete',$3,NOW())`,
			identity.ActorID, id, beforeJSON)
		writeJSON(w, http.StatusOK, map[string]any{"deleted": true})
	}
}

// adminExercisesPerformanceAnalyticsHandler implements GET /api/admin/exercises/analytics/performance.
func adminExercisesPerformanceAnalyticsHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		exerciseType := r.URL.Query().Get("type")
		level := r.URL.Query().Get("level")
		whereParts := []string{}
		args := []any{}
		argIdx := 1
		if exerciseType != "" {
			whereParts = append(whereParts, fmt.Sprintf("e.exercise_type = $%d", argIdx))
			args = append(args, exerciseType)
			argIdx++
		}
		if level != "" {
			whereParts = append(whereParts, fmt.Sprintf("e.level = $%d", argIdx))
			args = append(args, level)
			argIdx++
		}
		whereClause := ""
		if len(whereParts) > 0 {
			whereClause = "WHERE " + strings.Join(whereParts, " AND ")
		}
		rows, err := db.Query(r.Context(), fmt.Sprintf(`SELECT e.exercise_type, COALESCE(e.level,'unknown') as level,
COUNT(*) as total_attempts,
SUM(CASE WHEN ea.is_correct THEN 1 ELSE 0 END) as correct_count,
AVG(CASE WHEN ea.time_spent_ms > 0 THEN ea.time_spent_ms ELSE NULL END) as avg_duration_ms
FROM exercise.exercise_answer ea
JOIN exercise.exercise e ON e.id = ea.exercise_id
%s GROUP BY e.exercise_type, e.level ORDER BY e.exercise_type, e.level`, whereClause), args...)
		if err != nil {
			logger.Error("exercise performance analytics", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		type PerfRow struct {
			ExerciseType   string   `json:"exerciseType"`
			Level          string   `json:"level"`
			TotalAttempts  int      `json:"totalAttempts"`
			CorrectCount   int      `json:"correctCount"`
			AvgDurationMs  *float64 `json:"avgDurationMs,omitempty"`
			AccuracyRate   float64  `json:"accuracyRate"`
		}
		var items []PerfRow
		for rows.Next() {
			var p PerfRow
			if rows.Scan(&p.ExerciseType, &p.Level, &p.TotalAttempts, &p.CorrectCount, &p.AvgDurationMs) == nil {
				if p.TotalAttempts > 0 {
					p.AccuracyRate = float64(p.CorrectCount) / float64(p.TotalAttempts)
				}
				items = append(items, p)
			}
		}
		if items == nil {
			items = []PerfRow{}
		}
		writeJSON(w, http.StatusOK, items)
	}
}