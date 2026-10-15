package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
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
		pageSize := queryInt(r, "pageSize", queryInt(r, "limit", 50))
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
			whereParts = append(whereParts, fmt.Sprintf("(title_vi ILIKE $%[1]d OR module_key ILIKE $%[1]d)", argIdx))
			args = append(args, pattern)
			argIdx++
		}
		whereClause := ""
		if len(whereParts) > 0 {
			whereClause = "WHERE " + strings.Join(whereParts, " AND ")
		}
		var total int
		if err := db.QueryRow(r.Context(), "SELECT COUNT(*) FROM daily.daily_radar_module_config "+whereClause, args...).Scan(&total); err != nil {
			logger.Error("count daily radar modules admin", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		dataQ := fmt.Sprintf(`SELECT id, module_key, title_vi, title_ja, description_vi, category, module_type, status, is_enabled, is_spotlight_eligible, default_priority, visual_theme, route_path, updated_at
FROM daily.daily_radar_module_config %s ORDER BY default_priority ASC, created_at ASC LIMIT $%d OFFSET $%d`,
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
			ID                  string  `json:"id"`
			ModuleKey           string  `json:"moduleKey"`
			TitleVi             string  `json:"titleVi"`
			TitleJa             string  `json:"titleJa"`
			DescriptionVi       string  `json:"descriptionVi"`
			Category            string  `json:"category"`
			ModuleType          string  `json:"moduleType"`
			Status              string  `json:"status"`
			IsEnabled           bool    `json:"isEnabled"`
			IsSpotlightEligible bool    `json:"isSpotlightEligible"`
			DefaultPriority     int     `json:"defaultPriority"`
			VisualTheme         *string `json:"visualTheme"`
			RoutePath           *string `json:"routePath"`
			UpdatedAt           string  `json:"updatedAt"`
		}
		var items []Module
		for rows.Next() {
			var m Module
			var updatedAt time.Time
			if err := rows.Scan(&m.ID, &m.ModuleKey, &m.TitleVi, &m.TitleJa, &m.DescriptionVi, &m.Category, &m.ModuleType, &m.Status, &m.IsEnabled, &m.IsSpotlightEligible, &m.DefaultPriority, &m.VisualTheme, &m.RoutePath, &updatedAt); err != nil {
				logger.Error("scan daily radar module admin", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			m.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
			items = append(items, m)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate daily radar modules admin", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
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
			ModuleKey           string          `json:"moduleKey"`
			TitleVi             string          `json:"titleVi"`
			TitleJa             string          `json:"titleJa"`
			DescriptionVi       string          `json:"descriptionVi"`
			Category            string          `json:"category"`
			ModuleType          string          `json:"moduleType"`
			Status              string          `json:"status"`
			IsEnabled           bool            `json:"isEnabled"`
			IsSpotlightEligible bool            `json:"isSpotlightEligible"`
			DefaultPriority     int             `json:"defaultPriority"`
			VisualTheme         *string         `json:"visualTheme"`
			RoutePath           *string         `json:"routePath"`
			Metadata            json.RawMessage `json:"metadata"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if strings.TrimSpace(req.ModuleKey) == "" || strings.TrimSpace(req.TitleVi) == "" || strings.TrimSpace(req.TitleJa) == "" || strings.TrimSpace(req.Category) == "" || strings.TrimSpace(req.ModuleType) == "" {
			writeJSONError(w, "moduleKey, titleVi, titleJa, category and moduleType required", http.StatusBadRequest)
			return
		}
		if req.Status == "" {
			req.Status = "draft"
		}
		if req.Status != "draft" && req.Status != "published" && req.Status != "archived" {
			writeJSONError(w, "invalid status", http.StatusBadRequest)
			return
		}
		if len(req.Metadata) == 0 {
			req.Metadata = json.RawMessage(`{}`)
		}
		if !json.Valid(req.Metadata) {
			writeJSONError(w, "invalid metadata", http.StatusBadRequest)
			return
		}
		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin daily radar module create", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(r.Context())
		var id string
		err = tx.QueryRow(r.Context(), `INSERT INTO daily.daily_radar_module_config
(module_key,title_vi,title_ja,description_vi,category,module_type,status,is_enabled,is_spotlight_eligible,default_priority,visual_theme,route_path,metadata,created_at,updated_at)
VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,NOW(),NOW()) RETURNING id::text`,
			req.ModuleKey, req.TitleVi, req.TitleJa, req.DescriptionVi, req.Category, req.ModuleType, req.Status, req.IsEnabled, req.IsSpotlightEligible, req.DefaultPriority, req.VisualTheme, req.RoutePath, string(req.Metadata)).Scan(&id)
		if err != nil {
			logger.Error("create daily radar module", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		after := map[string]any{"id": id, "moduleKey": req.ModuleKey, "titleVi": req.TitleVi, "titleJa": req.TitleJa, "category": req.Category, "status": req.Status}
		if err := writeDailyRadarModuleAudit(r.Context(), tx, identity.ActorID, "daily_radar.module.created", id, nil, after); err != nil {
			logger.Error("audit daily radar module create", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			logger.Error("commit daily radar module create", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusCreated, map[string]any{"id": id, "status": req.Status})
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
		var req map[string]json.RawMessage
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		fieldMap := map[string]string{
			"moduleKey": "module_key", "titleVi": "title_vi", "titleJa": "title_ja", "descriptionVi": "description_vi",
			"category": "category", "moduleType": "module_type", "status": "status", "isEnabled": "is_enabled",
			"isSpotlightEligible": "is_spotlight_eligible", "defaultPriority": "default_priority", "visualTheme": "visual_theme",
			"routePath": "route_path", "metadata": "metadata",
		}
		setClauses := make([]string, 0, len(req))
		args := []any{}
		argIdx := 1
		updatedFields := map[string]json.RawMessage{}
		for key, raw := range req {
			column, ok := fieldMap[key]
			if !ok {
				writeJSONError(w, "unsupported module field", http.StatusBadRequest)
				return
			}
			var value any
			if string(raw) == "null" {
				if key != "visualTheme" && key != "routePath" {
					writeJSONError(w, "null is not allowed for this field", http.StatusBadRequest)
					return
				}
				value = nil
			} else if key == "metadata" {
				if !json.Valid(raw) {
					writeJSONError(w, "invalid metadata", http.StatusBadRequest)
					return
				}
				value = string(raw)
				column += " = $" + itoa(argIdx) + "::jsonb"
				setClauses = append(setClauses, column)
				args = append(args, value)
				updatedFields[key] = raw
				argIdx++
				continue
			} else if key == "isEnabled" || key == "isSpotlightEligible" {
				var boolean bool
				if err := json.Unmarshal(raw, &boolean); err != nil {
					writeJSONError(w, "invalid boolean field", http.StatusBadRequest)
					return
				}
				value = boolean
			} else if key == "defaultPriority" {
				var number int
				if err := json.Unmarshal(raw, &number); err != nil {
					writeJSONError(w, "invalid priority", http.StatusBadRequest)
					return
				}
				value = number
			} else {
				var text string
				if err := json.Unmarshal(raw, &text); err != nil {
					writeJSONError(w, "invalid string field", http.StatusBadRequest)
					return
				}
				value = text
			}
			setClauses = append(setClauses, column+" = $"+itoa(argIdx))
			args = append(args, value)
			updatedFields[key] = raw
			argIdx++
		}
		if len(setClauses) == 0 {
			writeJSONError(w, "at least one field to update is required", http.StatusBadRequest)
			return
		}
		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin daily radar module patch", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(r.Context())
		var before []byte
		if err := tx.QueryRow(r.Context(), `SELECT to_jsonb(m) FROM daily.daily_radar_module_config m WHERE id=$1 FOR UPDATE`, id).Scan(&before); errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "module not found", http.StatusNotFound)
			return
		} else if err != nil {
			logger.Error("load daily radar module for patch", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		setClauses = append(setClauses, "updated_at = NOW()")
		query := "UPDATE daily.daily_radar_module_config SET " + joinStrings(setClauses, ", ") + " WHERE id = $" + itoa(argIdx) + " RETURNING id::text"
		args = append(args, id)
		var updatedID string
		if err := tx.QueryRow(r.Context(), query, args...).Scan(&updatedID); err != nil {
			logger.Error("patch daily radar module", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := writeDailyRadarModuleAudit(r.Context(), tx, identity.ActorID, "daily_radar.module.updated", id, json.RawMessage(before), updatedFields); err != nil {
			logger.Error("audit daily radar module patch", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			logger.Error("commit daily radar module patch", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"id": updatedID, "updated": true})
	}
}

func writeDailyRadarModuleAudit(ctx context.Context, tx pgx.Tx, actorID, action, moduleID string, before, after any) error {
	var beforeJSON, afterJSON []byte
	var err error
	if before != nil {
		beforeJSON, err = json.Marshal(before)
		if err != nil {
			return err
		}
	}
	if after != nil {
		afterJSON, err = json.Marshal(after)
		if err != nil {
			return err
		}
	}
	_, err = tx.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, before, after, created_at)
VALUES ($1,$2,$3,'daily_radar_module',$4,$5,$6,NOW())`, action, actorID, moduleID, strings.TrimPrefix(action, "daily_radar.module."), beforeJSON, afterJSON)
	return err
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
		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin daily radar module archive", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(r.Context())
		var beforeStatus string
		err = tx.QueryRow(r.Context(), "SELECT status FROM daily.daily_radar_module_config WHERE id=$1 FOR UPDATE", id).Scan(&beforeStatus)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "module not found", http.StatusNotFound)
			return
		}
		if err != nil {
			logger.Error("read daily radar module for archive", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		_, err = tx.Exec(r.Context(), "UPDATE daily.daily_radar_module_config SET status='archived', updated_at=NOW() WHERE id=$1", id)
		if err != nil {
			logger.Error("archive daily radar module", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := writeAdminAuditLog(r.Context(), tx, identity.ActorID, "daily_radar.module.archived", "daily_radar_module", id,
			map[string]any{"status": beforeStatus}, map[string]any{"status": "archived"}); err != nil {
			logger.Error("audit daily radar module archive", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			logger.Error("commit daily radar module archive", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"id": id, "status": "archived"})
	}
}

// adminDailyRadarCardsListHandler implements GET /api/admin/daily-radar/cards.
func adminDailyRadarCardsListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		page := queryInt(r, "page", 1)
		pageSize := queryInt(r, "pageSize", queryInt(r, "limit", 50))
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
			whereParts = append(whereParts, fmt.Sprintf("c.status = $%d", argIdx))
			args = append(args, status)
			argIdx++
		}
		if moduleKey != "" {
			whereParts = append(whereParts, fmt.Sprintf("m.module_key = $%d", argIdx))
			args = append(args, moduleKey)
			argIdx++
		}
		if category != "" {
			whereParts = append(whereParts, fmt.Sprintf("c.category = $%d", argIdx))
			args = append(args, category)
			argIdx++
		}
		if q != "" {
			pattern := "%" + q + "%"
			whereParts = append(whereParts, fmt.Sprintf("(c.title_vi ILIKE $%[1]d OR c.slug ILIKE $%[1]d)", argIdx))
			args = append(args, pattern)
			argIdx++
		}
		whereClause := ""
		if len(whereParts) > 0 {
			whereClause = "WHERE " + strings.Join(whereParts, " AND ")
		}
		var total int
		if err := db.QueryRow(r.Context(), `SELECT COUNT(*) FROM daily.daily_radar_card c
			JOIN daily.daily_radar_module_config m ON m.id=c.module_config_id `+whereClause, args...).Scan(&total); err != nil {
			logger.Error("count admin daily radar cards", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		dataQ := fmt.Sprintf(`SELECT c.id, c.slug, c.title_vi, c.description_vi, c.category, m.module_key, c.module_config_id, c.image_url, c.status, c.created_at, c.updated_at,
	c.priority, c.badge_text_vi, c.estimated_minutes, c.level_label, c.target_route, c.is_spotlight, c.is_pinned, c.module_type, c.recommendation_reason_vi, m.title_vi
FROM daily.daily_radar_card c JOIN daily.daily_radar_module_config m ON m.id = c.module_config_id %s ORDER BY c.created_at DESC LIMIT $%d OFFSET $%d`,
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
			ID                     string  `json:"id"`
			Slug                   string  `json:"slug"`
			TitleVi                string  `json:"titleVi"`
			DescriptionVi          string  `json:"descriptionVi"`
			Category               string  `json:"category"`
			ModuleConfig           any     `json:"moduleConfig"`
			ModuleConfigID         string  `json:"moduleConfigId"`
			ImageURL               *string `json:"imageUrl"`
			Status                 string  `json:"status"`
			CreatedAt              string  `json:"createdAt"`
			UpdatedAt              string  `json:"updatedAt"`
			Priority               int     `json:"priority"`
			BadgeTextVi            *string `json:"badgeTextVi"`
			EstimatedMinutes       *int    `json:"estimatedMinutes"`
			LevelLabel             *string `json:"levelLabel"`
			TargetRoute            *string `json:"targetRoute"`
			IsSpotlight            bool    `json:"isSpotlight"`
			IsPinned               bool    `json:"isPinned"`
			ModuleType             string  `json:"moduleType"`
			RecommendationReasonVi *string `json:"recommendationReasonVi"`
		}
		var items []Card
		for rows.Next() {
			var c Card
			var ca, ua time.Time
			var moduleKey, moduleTitle string
			if err := rows.Scan(&c.ID, &c.Slug, &c.TitleVi, &c.DescriptionVi, &c.Category, &moduleKey, &c.ModuleConfigID, &c.ImageURL, &c.Status, &ca, &ua,
				&c.Priority, &c.BadgeTextVi, &c.EstimatedMinutes, &c.LevelLabel, &c.TargetRoute, &c.IsSpotlight, &c.IsPinned, &c.ModuleType, &c.RecommendationReasonVi, &moduleTitle); err != nil {
				logger.Error("scan admin daily radar card", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			c.CreatedAt = ca.UTC().Format(time.RFC3339)
			c.UpdatedAt = ua.UTC().Format(time.RFC3339)
			c.ModuleConfig = map[string]string{"moduleKey": moduleKey, "titleVi": moduleTitle}
			items = append(items, c)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate admin daily radar cards", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
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
			BadgeTextVi            *string        `json:"badgeTextVi"`
			Category               string         `json:"category"`
			CtaLabelVi             string         `json:"ctaLabelVi"`
			DescriptionVi          string         `json:"descriptionVi"`
			EstimatedMinutes       *int           `json:"estimatedMinutes"`
			IsPinned               bool           `json:"isPinned"`
			IsSpotlight            bool           `json:"isSpotlight"`
			LevelLabel             *string        `json:"levelLabel"`
			Metadata               map[string]any `json:"metadata"`
			ModuleConfigID         string         `json:"moduleConfigId"`
			ModuleType             string         `json:"moduleType"`
			Priority               int            `json:"priority"`
			RecommendationReasonVi *string        `json:"recommendationReasonVi"`
			Slug                   string         `json:"slug"`
			Status                 string         `json:"status"`
			TargetRoute            *string        `json:"targetRoute"`
			TitleVi                string         `json:"titleVi"`
			VisualTheme            *string        `json:"visualTheme"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		req.Slug = strings.TrimSpace(req.Slug)
		req.TitleVi = strings.TrimSpace(req.TitleVi)
		if req.Slug == "" || len(req.Slug) > 120 || req.TitleVi == "" || req.DescriptionVi == "" || req.Category == "" || req.ModuleType == "" || req.CtaLabelVi == "" {
			writeJSONError(w, "slug, titleVi, descriptionVi, category, moduleType, and ctaLabelVi required", http.StatusBadRequest)
			return
		}
		moduleID, err := uuid.Parse(req.ModuleConfigID)
		if err != nil {
			writeJSONError(w, "valid moduleConfigId required", http.StatusBadRequest)
			return
		}
		if req.Status == "" {
			req.Status = "draft"
		}
		if req.Status != "draft" && req.Status != "published" && req.Status != "archived" {
			writeJSONError(w, "invalid status", http.StatusBadRequest)
			return
		}
		if req.Metadata == nil {
			req.Metadata = map[string]any{}
		}
		metadata, err := json.Marshal(req.Metadata)
		if err != nil {
			writeJSONError(w, "invalid metadata", http.StatusBadRequest)
			return
		}
		var moduleExists bool
		if err := db.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM daily.daily_radar_module_config WHERE id=$1)`, moduleID).Scan(&moduleExists); err != nil {
			logger.Error("check daily radar module for card", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if !moduleExists {
			writeJSONError(w, "module not found", http.StatusNotFound)
			return
		}
		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin daily radar card create", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(r.Context())
		var id string
		err = tx.QueryRow(r.Context(), `INSERT INTO daily.daily_radar_card
(module_config_id,slug,title_vi,description_vi,recommendation_reason_vi,category,module_type,badge_text_vi,estimated_minutes,level_label,cta_label_vi,target_route,visual_theme,priority,status,is_spotlight,is_pinned,metadata,created_at,updated_at)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,NOW(),NOW()) ON CONFLICT (slug) DO NOTHING RETURNING id::text`,
			moduleID, req.Slug, req.TitleVi, req.DescriptionVi, req.RecommendationReasonVi, req.Category, req.ModuleType, req.BadgeTextVi, req.EstimatedMinutes, req.LevelLabel, req.CtaLabelVi, req.TargetRoute, req.VisualTheme, req.Priority, req.Status, req.IsSpotlight, req.IsPinned, metadata).Scan(&id)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				writeJSONError(w, "slug already exists", http.StatusConflict)
				return
			}
			logger.Error("create daily radar card", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		after := map[string]any{"id": id, "slug": req.Slug, "titleVi": req.TitleVi, "status": req.Status}
		if err := writeAdminAuditLog(r.Context(), tx, identity.ActorID, "daily_radar.card.created", "daily_radar_card", id, nil, after); err != nil {
			logger.Error("audit daily radar card create", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			logger.Error("commit daily radar card create", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusCreated, map[string]any{"id": id, "status": req.Status})
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
			ID        string  `json:"id"`
			Slug      string  `json:"slug"`
			Title     string  `json:"title"`
			Summary   *string `json:"summary,omitempty"`
			Body      *string `json:"body,omitempty"`
			Category  string  `json:"category"`
			ModuleKey *string `json:"moduleKey,omitempty"`
			ImageURL  *string `json:"imageUrl,omitempty"`
			Status    string  `json:"status"`
			CreatedAt string  `json:"createdAt"`
			UpdatedAt string  `json:"updatedAt"`
		}
		var c Card
		var ca, ua time.Time
		err := db.QueryRow(r.Context(), `SELECT c.id, c.slug, c.title_vi, c.description_vi, c.metadata->>'body', c.category, m.module_key, c.image_url, c.status, c.created_at, c.updated_at
FROM daily.daily_radar_card c JOIN daily.daily_radar_module_config m ON m.id = c.module_config_id WHERE c.id=$1`, id).
			Scan(&c.ID, &c.Slug, &c.Title, &c.Summary, &c.Body, &c.Category, &c.ModuleKey, &c.ImageURL, &c.Status, &ca, &ua)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				writeJSONError(w, "card not found", http.StatusNotFound)
				return
			}
			logger.Error("get daily radar card", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		c.CreatedAt = ca.UTC().Format(time.RFC3339)
		c.UpdatedAt = ua.UTC().Format(time.RFC3339)
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
		var req map[string]json.RawMessage
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		setClauses := make([]string, 0, len(req)+1)
		args := make([]any, 0, len(req)+1)
		add := func(column string, value any) {
			args = append(args, value)
			setClauses = append(setClauses, column+" = $"+itoa(len(args)))
		}
		stringFields := map[string]string{
			"slug": "slug", "titleVi": "title_vi", "descriptionVi": "description_vi", "category": "category",
			"moduleType": "module_type", "ctaLabelVi": "cta_label_vi", "status": "status",
			"recommendationReasonVi": "recommendation_reason_vi", "badgeTextVi": "badge_text_vi",
			"levelLabel": "level_label", "visualTheme": "visual_theme", "targetRoute": "target_route",
		}
		for field, column := range stringFields {
			if raw, exists := req[field]; exists {
				var value *string
				if string(raw) != "null" {
					var parsed string
					if err := json.Unmarshal(raw, &parsed); err != nil {
						writeJSONError(w, "invalid request body", http.StatusBadRequest)
						return
					}
					value = &parsed
				}
				add(column, value)
			}
		}
		if raw, exists := req["moduleConfigId"]; exists {
			var value string
			if err := json.Unmarshal(raw, &value); err != nil || uuid.Validate(value) != nil {
				writeJSONError(w, "invalid moduleConfigId", http.StatusBadRequest)
				return
			}
			var exists bool
			if err := db.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM daily.daily_radar_module_config WHERE id=$1)`, value).Scan(&exists); err != nil {
				logger.Error("validate daily radar card module", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			if !exists {
				writeJSONError(w, "module not found", http.StatusBadRequest)
				return
			}
			add("module_config_id", value)
		}
		for field, column := range map[string]string{"priority": "priority", "estimatedMinutes": "estimated_minutes"} {
			if raw, exists := req[field]; exists {
				var value *int
				if string(raw) != "null" {
					var parsed int
					if err := json.Unmarshal(raw, &parsed); err != nil {
						writeJSONError(w, "invalid request body", http.StatusBadRequest)
						return
					}
					value = &parsed
				}
				add(column, value)
			}
		}
		for field, column := range map[string]string{"isPinned": "is_pinned", "isSpotlight": "is_spotlight"} {
			if raw, exists := req[field]; exists {
				var value bool
				if err := json.Unmarshal(raw, &value); err != nil {
					writeJSONError(w, "invalid request body", http.StatusBadRequest)
					return
				}
				add(column, value)
			}
		}
		if raw, exists := req["metadata"]; exists {
			if !json.Valid(raw) {
				writeJSONError(w, "invalid metadata", http.StatusBadRequest)
				return
			}
			add("metadata", string(raw))
			setClauses[len(setClauses)-1] += "::jsonb"
		}
		if len(setClauses) == 0 {
			writeJSONError(w, "at least one field to update is required", http.StatusBadRequest)
			return
		}
		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin daily radar card patch", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(r.Context())
		args = append(args, id)
		var updatedID string
		query := "UPDATE daily.daily_radar_card SET " + joinStrings(setClauses, ", ") + ", updated_at = NOW() WHERE id = $" + itoa(len(args)) + " RETURNING id::text"
		if err := tx.QueryRow(r.Context(), query, args...).Scan(&updatedID); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				writeJSONError(w, "card not found", http.StatusNotFound)
				return
			}
			logger.Error("patch daily radar card", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := writeAdminAuditLog(r.Context(), tx, identity.ActorID, "daily_radar.card.updated", "daily_radar_card", id, nil, map[string]any{"fields": req}); err != nil {
			logger.Error("audit daily radar card patch", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			logger.Error("commit daily radar card patch", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"id": updatedID, "updated": true})
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
		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin daily radar card publish", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(r.Context())
		var beforeStatus string
		err = tx.QueryRow(r.Context(), "SELECT status FROM daily.daily_radar_card WHERE id=$1 FOR UPDATE", id).Scan(&beforeStatus)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "card not found", http.StatusNotFound)
			return
		}
		if err != nil {
			logger.Error("read daily radar card for publish", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		_, err = tx.Exec(r.Context(), `UPDATE daily.daily_radar_card SET
status='published', updated_at=NOW() WHERE id=$1`, id)
		if err != nil {
			logger.Error("publish daily radar card", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := writeAdminAuditLog(r.Context(), tx, identity.ActorID, "daily_radar.card.published", "daily_radar_card", id,
			map[string]any{"status": beforeStatus}, map[string]any{"status": "published"}); err != nil {
			logger.Error("audit daily radar card publish", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			logger.Error("commit daily radar card publish", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
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
		if uuid.Validate(id) != nil {
			writeJSONError(w, "invalid card id", http.StatusBadRequest)
			return
		}
		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin daily radar card archive", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(r.Context())
		var beforeStatus string
		err = tx.QueryRow(r.Context(), "SELECT status FROM daily.daily_radar_card WHERE id=$1 FOR UPDATE", id).Scan(&beforeStatus)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "card not found", http.StatusNotFound)
			return
		}
		if err != nil {
			logger.Error("load daily radar card for archive", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if _, err = tx.Exec(r.Context(), "UPDATE daily.daily_radar_card SET status='archived', updated_at=NOW() WHERE id=$1", id); err != nil {
			logger.Error("archive daily radar card", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := writeAdminAuditLog(r.Context(), tx, identity.ActorID, "daily_radar.card.archived", "daily_radar_card", id, map[string]any{"status": beforeStatus}, map[string]any{"status": "archived"}); err != nil {
			logger.Error("audit daily radar card archive", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			logger.Error("commit daily radar card archive", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
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
		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin daily radar card duplicate", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(r.Context())
		var source struct {
			moduleID, slug, titleVi, description, category, moduleType, ctaLabelVi string
			titleJa, subtitleVi, recommendation, badge, level                      *string
			ctaLabelJa, targetRoute, targetEntityType, targetEntityID              *string
			imageURL, iconKey, visualTheme                                         *string
			estimatedMinutes                                                       *int
			priority                                                               int
			metadata                                                               []byte
		}
		err = tx.QueryRow(r.Context(), `SELECT c.module_config_id::text,c.slug,c.title_vi,c.title_ja,c.subtitle_vi,
c.description_vi,c.recommendation_reason_vi,c.category,c.module_type,c.badge_text_vi,c.estimated_minutes,
c.level_label,c.cta_label_vi,c.cta_label_ja,c.target_route,c.target_entity_type,c.target_entity_id,
c.image_url,c.icon_key,c.visual_theme,c.priority,c.metadata
FROM daily.daily_radar_card c WHERE c.id=$1 FOR SHARE`, id).Scan(
			&source.moduleID, &source.slug, &source.titleVi, &source.titleJa, &source.subtitleVi, &source.description,
			&source.recommendation, &source.category, &source.moduleType, &source.badge, &source.estimatedMinutes,
			&source.level, &source.ctaLabelVi, &source.ctaLabelJa, &source.targetRoute, &source.targetEntityType,
			&source.targetEntityID, &source.imageURL, &source.iconKey, &source.visualTheme, &source.priority, &source.metadata)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				writeJSONError(w, "source card not found", http.StatusNotFound)
				return
			}
			logger.Error("read daily radar card for duplicate", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		const maxSlugLength = 120
		suffix := "-copy-" + uuid.NewString()
		base := []rune(source.slug)
		if len(base) > maxSlugLength-len(suffix) {
			base = base[:maxSlugLength-len(suffix)]
		}
		newSlug := strings.TrimRight(string(base), "-") + suffix
		var newID string
		err = tx.QueryRow(r.Context(), `INSERT INTO daily.daily_radar_card
(module_config_id,slug,title_vi,title_ja,subtitle_vi,description_vi,recommendation_reason_vi,category,module_type,
badge_text_vi,estimated_minutes,level_label,cta_label_vi,cta_label_ja,target_route,target_entity_type,target_entity_id,
image_url,icon_key,visual_theme,priority,status,is_spotlight,is_pinned,metadata,created_at,updated_at)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,'draft',false,false,$22::jsonb,NOW(),NOW()) RETURNING id::text`,
			source.moduleID, newSlug, source.titleVi, source.titleJa, source.subtitleVi, source.description,
			source.recommendation, source.category, source.moduleType, source.badge, source.estimatedMinutes, source.level, source.ctaLabelVi,
			source.ctaLabelJa, source.targetRoute, source.targetEntityType, source.targetEntityID, source.imageURL,
			source.iconKey, source.visualTheme, source.priority, source.metadata).Scan(&newID)
		if err != nil {
			logger.Error("duplicate daily radar card", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := writeAdminAuditLog(r.Context(), tx, identity.ActorID, "daily_radar.card.duplicated", "daily_radar_card", newID,
			map[string]any{"duplicatedFrom": id}, map[string]any{"id": newID, "duplicatedFrom": id, "slug": newSlug, "status": "draft"}); err != nil {
			logger.Error("audit daily radar card duplicate", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			logger.Error("commit daily radar card duplicate", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
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
			if err := rows.Scan(&c.ID, &c.ExerciseType, &c.Placement, &c.DisplayOrder, &c.Enabled,
				&c.MinLevel, &c.MaxLevel, &c.TimeLimitSec, &c.PointsPerCorrect, &ca, &ua); err != nil {
				logger.Error("scan exercise config", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			c.CreatedAt = ca.UTC().Format(time.RFC3339)
			c.UpdatedAt = ua.UTC().Format(time.RFC3339)
			items = append(items, c)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate exercise configs", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
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
			Enabled          *bool   `json:"enabled"`
			MinLevel         *string `json:"minLevel"`
			MaxLevel         *string `json:"maxLevel"`
			TimeLimitSec     *int    `json:"timeLimitSec"`
			PointsPerCorrect *int    `json:"pointsPerCorrect"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if !exerciseValueAllowed(req.ExerciseType, "word_order", "cloze", "translation", "meaning_match", "listening") ||
			!exerciseValueAllowed(req.Placement, "practice_tab", "post_review", "daily_hub") || req.DisplayOrder < 0 ||
			(req.MinLevel != nil && !exerciseValueAllowed(*req.MinLevel, "N5", "N4", "N3", "N2", "N1")) ||
			(req.MaxLevel != nil && !exerciseValueAllowed(*req.MaxLevel, "N5", "N4", "N3", "N2", "N1")) ||
			(req.TimeLimitSec != nil && (*req.TimeLimitSec < 5 || *req.TimeLimitSec > 300)) ||
			(req.PointsPerCorrect != nil && (*req.PointsPerCorrect < 1 || *req.PointsPerCorrect > 100)) {
			writeJSONError(w, "invalid exercise config", http.StatusBadRequest)
			return
		}
		enabled := true
		if req.Enabled != nil {
			enabled = *req.Enabled
		}
		pointsPerCorrect := 10
		if req.PointsPerCorrect != nil {
			pointsPerCorrect = *req.PointsPerCorrect
		}
		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin exercise config upsert", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(r.Context())
		var id string
		err = tx.QueryRow(r.Context(), `INSERT INTO exercise.exercise_config
(exercise_type, placement, display_order, enabled, min_level, max_level, time_limit_sec, points_per_correct, created_by, updated_by, created_at, updated_at)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,NOW(),NOW())
ON CONFLICT (exercise_type, placement) DO UPDATE SET
display_order=$3, enabled=$4, min_level=$5, max_level=$6, time_limit_sec=$7, points_per_correct=$8, updated_by=$9, updated_at=NOW()
RETURNING id`,
			req.ExerciseType, req.Placement, req.DisplayOrder, enabled,
			req.MinLevel, req.MaxLevel, req.TimeLimitSec, pointsPerCorrect, identity.ActorID).Scan(&id)
		if err != nil {
			logger.Error("upsert exercise config", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		after := map[string]any{"exerciseType": req.ExerciseType, "placement": req.Placement, "displayOrder": req.DisplayOrder, "enabled": enabled, "minLevel": req.MinLevel, "maxLevel": req.MaxLevel, "timeLimitSec": req.TimeLimitSec, "pointsPerCorrect": pointsPerCorrect}
		if !finishExerciseAdminMutation(w, r, logger, tx, "exercise.config.upserted", identity.ActorID, id, "exercise_config", "upsert", nil, after) {
			return
		}
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
		if _, err := uuid.Parse(id); err != nil {
			writeJSONError(w, "invalid config id", http.StatusBadRequest)
			return
		}
		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin exercise config delete", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(r.Context())
		var before map[string]any
		err = tx.QueryRow(r.Context(), `DELETE FROM exercise.exercise_config WHERE id=$1 RETURNING jsonb_build_object('id',id,'exerciseType',exercise_type,'placement',placement,'enabled',enabled)`, id).Scan(&before)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "exercise config not found", http.StatusNotFound)
			return
		}
		if err != nil {
			logger.Error("delete exercise config", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if !finishExerciseAdminMutation(w, r, logger, tx, "exercise.config.deleted", identity.ActorID, id, "exercise_config", "delete", before, nil) {
			return
		}
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
		if err := db.QueryRow(r.Context(), "SELECT COUNT(*) FROM exercise.exercise "+whereClause, args...).Scan(&total); err != nil {
			logger.Error("count admin exercises", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		dataQ := fmt.Sprintf(`SELECT id, exercise_type, source_type, source_id, level, prompt, correct_answer,
difficulty, created_at
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
			ID            string          `json:"id"`
			ExerciseType  string          `json:"exerciseType"`
			SourceType    string          `json:"sourceType"`
			SourceID      string          `json:"sourceId"`
			Level         *string         `json:"level,omitempty"`
			Prompt        json.RawMessage `json:"prompt"`
			CorrectAnswer json.RawMessage `json:"correctAnswer"`
			Difficulty    string          `json:"difficulty"`
			CreatedAt     string          `json:"createdAt"`
		}
		var items []Exercise
		for rows.Next() {
			var e Exercise
			var ca time.Time
			if err := rows.Scan(&e.ID, &e.ExerciseType, &e.SourceType, &e.SourceID, &e.Level, &e.Prompt,
				&e.CorrectAnswer, &e.Difficulty, &ca); err != nil {
				logger.Error("scan admin exercise", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			e.CreatedAt = ca.UTC().Format(time.RFC3339)
			items = append(items, e)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate admin exercises", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
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
		if _, err := uuid.Parse(id); err != nil {
			writeJSONError(w, "invalid exercise id", http.StatusBadRequest)
			return
		}
		type Exercise struct {
			ID            string          `json:"id"`
			ExerciseType  string          `json:"exerciseType"`
			SourceType    string          `json:"sourceType"`
			SourceID      string          `json:"sourceId"`
			Level         *string         `json:"level,omitempty"`
			Prompt        json.RawMessage `json:"prompt"`
			Choices       json.RawMessage `json:"choices"`
			CorrectAnswer json.RawMessage `json:"correctAnswer"`
			Explanation   *string         `json:"explanation,omitempty"`
			Difficulty    string          `json:"difficulty"`
			Tags          []string        `json:"tags"`
			CreatedAt     string          `json:"createdAt"`
		}
		var e Exercise
		var ca time.Time
		err := db.QueryRow(r.Context(), `SELECT id, exercise_type, source_type, source_id, level, prompt, choices,
correct_answer, explanation, difficulty, tags, created_at
FROM exercise.exercise WHERE id=$1`, id).
			Scan(&e.ID, &e.ExerciseType, &e.SourceType, &e.SourceID, &e.Level, &e.Prompt, &e.Choices,
				&e.CorrectAnswer, &e.Explanation, &e.Difficulty, &e.Tags, &ca)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "exercise not found", http.StatusNotFound)
			return
		}
		if err != nil {
			logger.Error("get admin exercise", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		e.CreatedAt = ca.UTC().Format(time.RFC3339)
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
			SourceType    string          `json:"sourceType"`
			SourceID      string          `json:"sourceId"`
			Level         *string         `json:"level"`
			Prompt        json.RawMessage `json:"prompt"`
			Choices       json.RawMessage `json:"choices"`
			CorrectAnswer json.RawMessage `json:"correctAnswer"`
			Explanation   *string         `json:"explanation"`
			Difficulty    string          `json:"difficulty"`
			Tags          []string        `json:"tags"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if !exerciseValueAllowed(req.ExerciseType, "word_order", "cloze", "translation", "meaning_match", "listening") ||
			!exerciseValueAllowed(req.SourceType, "lexeme", "grammar", "kanji") || req.SourceID == "" ||
			!exerciseJSONObject(req.Prompt) || !exerciseJSONObject(req.CorrectAnswer) {
			writeJSONError(w, "exerciseType, sourceType, sourceId, prompt, and correctAnswer required", http.StatusBadRequest)
			return
		}
		if _, err := uuid.Parse(req.SourceID); err != nil {
			writeJSONError(w, "invalid sourceId", http.StatusBadRequest)
			return
		}
		if req.Level != nil && !exerciseValueAllowed(*req.Level, "N5", "N4", "N3", "N2", "N1") {
			writeJSONError(w, "invalid level", http.StatusBadRequest)
			return
		}
		if len(req.Choices) == 0 {
			req.Choices = json.RawMessage("[]")
		}
		if !exerciseJSONArray(req.Choices) {
			writeJSONError(w, "choices must be an array", http.StatusBadRequest)
			return
		}
		if req.Difficulty == "" {
			req.Difficulty = "medium"
		}
		if !exerciseValueAllowed(req.Difficulty, "easy", "medium", "hard") {
			writeJSONError(w, "invalid difficulty", http.StatusBadRequest)
			return
		}
		if req.Tags == nil {
			req.Tags = []string{}
		}
		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin exercise create", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(r.Context())
		var id string
		err = tx.QueryRow(r.Context(), `INSERT INTO exercise.exercise
(exercise_type, source_type, source_id, level, prompt, choices, correct_answer, explanation, difficulty, tags)
VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8,$9,$10) RETURNING id::text`,
			req.ExerciseType, req.SourceType, req.SourceID, req.Level, string(req.Prompt), string(req.Choices),
			string(req.CorrectAnswer), req.Explanation, req.Difficulty, req.Tags).Scan(&id)
		if err != nil {
			logger.Error("create exercise", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if !finishExerciseAdminMutation(w, r, logger, tx, "exercise.created", identity.ActorID, id, "exercise", "create", nil, map[string]any{"id": id, "exerciseType": req.ExerciseType}) {
			return
		}
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
		if _, err := uuid.Parse(id); err != nil {
			writeJSONError(w, "invalid exercise id", http.StatusBadRequest)
			return
		}
		var req map[string]json.RawMessage
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		setClauses := []string{}
		args := []any{}
		argIdx := 1
		for key, raw := range req {
			column := map[string]string{"prompt": "prompt", "choices": "choices", "correctAnswer": "correct_answer"}[key]
			if column != "" {
				valid := exerciseJSONObject(raw)
				if key == "choices" {
					valid = exerciseJSONArray(raw)
				}
				if !valid {
					writeJSONError(w, key+" has invalid JSON shape", http.StatusBadRequest)
					return
				}
				setClauses = append(setClauses, column+" = $"+itoa(argIdx)+"::jsonb")
				args = append(args, string(raw))
				argIdx++
				continue
			}
			if key == "tags" {
				var tags []string
				if err := json.Unmarshal(raw, &tags); err != nil || tags == nil {
					writeJSONError(w, "tags must be a string array", http.StatusBadRequest)
					return
				}
				setClauses = append(setClauses, "tags = $"+itoa(argIdx))
				args = append(args, tags)
				argIdx++
				continue
			}
			column = map[string]string{"explanation": "explanation", "difficulty": "difficulty", "level": "level"}[key]
			if column == "" {
				writeJSONError(w, "unknown exercise field", http.StatusBadRequest)
				return
			}
			var value any
			if err := json.Unmarshal(raw, &value); err != nil {
				writeJSONError(w, "invalid "+key, http.StatusBadRequest)
				return
			}
			if value != nil {
				text, ok := value.(string)
				if !ok {
					writeJSONError(w, key+" must be a string or null", http.StatusBadRequest)
					return
				}
				if key == "difficulty" && !exerciseValueAllowed(text, "easy", "medium", "hard") {
					writeJSONError(w, "invalid difficulty", http.StatusBadRequest)
					return
				}
				if key == "level" && !exerciseValueAllowed(text, "N5", "N4", "N3", "N2", "N1") {
					writeJSONError(w, "invalid level", http.StatusBadRequest)
					return
				}
			}
			setClauses = append(setClauses, column+" = $"+itoa(argIdx))
			args = append(args, value)
			argIdx++
		}
		if len(setClauses) == 0 {
			writeJSONError(w, "at least one field to update is required", http.StatusBadRequest)
			return
		}
		query := "UPDATE exercise.exercise SET " + joinStrings(setClauses, ", ") + " WHERE id = $" + itoa(argIdx)
		args = append(args, id)
		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin exercise update", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(r.Context())
		var updatedID string
		if err := tx.QueryRow(r.Context(), query+" RETURNING id::text", args...).Scan(&updatedID); errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "exercise not found", http.StatusNotFound)
			return
		} else if err != nil {
			logger.Error("update exercise", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if !finishExerciseAdminMutation(w, r, logger, tx, "exercise.updated", identity.ActorID, id, "exercise", "update", nil, req) {
			return
		}
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
		if _, err := uuid.Parse(id); err != nil {
			writeJSONError(w, "invalid exercise id", http.StatusBadRequest)
			return
		}
		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin exercise delete", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(r.Context())
		var lockedID string
		err = tx.QueryRow(r.Context(), `SELECT id::text FROM exercise.exercise WHERE id=$1 FOR UPDATE`, id).Scan(&lockedID)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "exercise not found", http.StatusNotFound)
			return
		}
		if err != nil {
			logger.Error("lock exercise for delete", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		var hasAnswers bool
		if err := tx.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM exercise.exercise_answer WHERE exercise_id=$1)`, id).Scan(&hasAnswers); err != nil {
			logger.Error("check exercise answers before delete", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if hasAnswers {
			writeJSONError(w, "exercise has answer history; deletion is blocked", http.StatusConflict)
			return
		}
		var before map[string]any
		err = tx.QueryRow(r.Context(), `DELETE FROM exercise.exercise WHERE id=$1 RETURNING jsonb_build_object('id',id,'exerciseType',exercise_type,'sourceType',source_type)`, id).Scan(&before)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "exercise not found", http.StatusNotFound)
			return
		}
		if err != nil {
			logger.Error("delete exercise", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if !finishExerciseAdminMutation(w, r, logger, tx, "exercise.deleted", identity.ActorID, id, "exercise", "delete", before, nil) {
			return
		}
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
			ExerciseType  string   `json:"exerciseType"`
			Level         string   `json:"level"`
			TotalAttempts int      `json:"totalAttempts"`
			CorrectCount  int      `json:"correctCount"`
			AvgDurationMs *float64 `json:"avgDurationMs,omitempty"`
			AccuracyRate  float64  `json:"accuracyRate"`
		}
		var items []PerfRow
		for rows.Next() {
			var p PerfRow
			if err := rows.Scan(&p.ExerciseType, &p.Level, &p.TotalAttempts, &p.CorrectCount, &p.AvgDurationMs); err != nil {
				logger.Error("scan exercise performance", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			if p.TotalAttempts > 0 {
				p.AccuracyRate = float64(p.CorrectCount) / float64(p.TotalAttempts)
			}
			items = append(items, p)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate exercise performance", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if items == nil {
			items = []PerfRow{}
		}
		writeJSON(w, http.StatusOK, items)
	}
}

func finishExerciseAdminMutation(w http.ResponseWriter, r *http.Request, logger *slog.Logger, tx pgx.Tx, action, actorID, targetID, targetType, reason string, before, after any) bool {
	beforeJSON, err := json.Marshal(before)
	if err != nil {
		logger.Error("marshal exercise audit before state", "action", action, "error", err)
		writeJSONError(w, "internal error", http.StatusInternalServerError)
		return false
	}
	afterJSON, err := json.Marshal(after)
	if err != nil {
		logger.Error("marshal exercise audit after state", "action", action, "error", err)
		writeJSONError(w, "internal error", http.StatusInternalServerError)
		return false
	}
	if _, err := tx.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action,actor_id,target_id,target_type,reason,before,after,created_at)
VALUES ($1,$2,$3,$4,$5,NULLIF($6::jsonb,'null'::jsonb),NULLIF($7::jsonb,'null'::jsonb),NOW())`, action, actorID, targetID, targetType, reason, beforeJSON, afterJSON); err != nil {
		logger.Error("write exercise admin audit", "action", action, "error", err)
		writeJSONError(w, "internal error", http.StatusInternalServerError)
		return false
	}
	if err := tx.Commit(r.Context()); err != nil {
		logger.Error("commit exercise admin mutation", "action", action, "error", err)
		writeJSONError(w, "internal error", http.StatusInternalServerError)
		return false
	}
	return true
}

func exerciseValueAllowed(value string, choices ...string) bool {
	for _, choice := range choices {
		if value == choice {
			return true
		}
	}
	return false
}

func exerciseJSONObject(raw json.RawMessage) bool {
	var value map[string]json.RawMessage
	return len(raw) > 0 && json.Unmarshal(raw, &value) == nil && value != nil
}

func exerciseJSONArray(raw json.RawMessage) bool {
	var value []json.RawMessage
	return len(raw) > 0 && json.Unmarshal(raw, &value) == nil && value != nil
}
