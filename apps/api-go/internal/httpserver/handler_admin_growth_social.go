package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
)

// ── P1-A3.3: Admin Growth — Social Templates & Events Sub-Domain (8 routes) ─
// All routes require admin session + appropriate permissions.
// Contracts derived from NestJS apps/api/src/growth/growth-social-admin.repository.ts
// listTemplates, detailTemplate, createTemplate, patchTemplate, publishTemplate,
// archiveTemplate, listEvents, moderateEvent.
// Social templates share the share_template table with postcards but are
// distinguished by kind IN GROWTH_SOCIAL_TEMPLATE_KINDS.

var growthSocialKinds = []string{
	"social_achievement",
	"social_streak",
	"social_level_up",
	"social_exam_result",
	"social_welcome",
	"social_seasonal",
	"social_challenge",
}

var validSocialSlugRe = regexp.MustCompile(`^[a-z0-9_-]+$`)

// adminGrowthSocialTemplatesListHandler implements GET /api/admin/growth/social/templates.
func adminGrowthSocialTemplatesListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		q := r.URL.Query().Get("q")
		kindFilter := r.URL.Query().Get("kind")
		statusFilter := r.URL.Query().Get("status")
		page := queryInt(r, "page", 1)
		pageSize := queryInt(r, "pageSize", 20)
		if page < 1 {
			page = 1
		}
		if pageSize < 1 || pageSize > 100 {
			pageSize = 20
		}
		offset := (page - 1) * pageSize

		whereParts := []string{"kind = ANY($1)"}
		args := []any{growthSocialKinds}
		argIdx := 2

		if kindFilter != "" {
			whereParts = append(whereParts, fmt.Sprintf("kind = $%d", argIdx))
			args = append(args, kindFilter)
			argIdx++
		}
		if statusFilter == "published" {
			whereParts = append(whereParts, "active = true")
		} else if statusFilter == "archived" {
			whereParts = append(whereParts, "active = false")
		}
		if q != "" {
			pattern := "%" + q + "%"
			whereParts = append(whereParts, fmt.Sprintf("slug ILIKE $%d", argIdx))
			args = append(args, pattern)
			argIdx++
		}

		whereClause := "WHERE " + strings.Join(whereParts, " AND ")
		countQuery := "SELECT COUNT(*) FROM growth.share_template " + whereClause
		var total int
		if err := db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
			logger.Error("count social templates", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		dataQuery := fmt.Sprintf(`
			SELECT id, slug, kind, version, active, config, created_at, updated_at
			FROM growth.share_template %s
			ORDER BY updated_at DESC LIMIT $%d OFFSET $%d`,
			whereClause, argIdx, argIdx+1)
		args = append(args, pageSize, offset)

		rows, err := db.Query(ctx, dataQuery, args...)
		if err != nil {
			logger.Error("list social templates", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type TemplateSummary struct {
			ID            string `json:"id"`
			Slug          string `json:"slug"`
			Name          string `json:"name"`
			Kind          string `json:"kind"`
			Version       int    `json:"version"`
			Active        bool   `json:"active"`
			PrivacyClass  string `json:"privacyClass"`
			NoPIIVerified bool   `json:"noPiiVerified"`
			Surface       string `json:"surface"`
			CreatedAt     string `json:"createdAt"`
			UpdatedAt     string `json:"updatedAt"`
		}
		var items []TemplateSummary
		for rows.Next() {
			var ts TemplateSummary
			var configBytes []byte
			var createdAt, updatedAt time.Time
			if err := rows.Scan(&ts.ID, &ts.Slug, &ts.Kind, &ts.Version, &ts.Active,
				&configBytes, &createdAt, &updatedAt); err == nil {
				ts.CreatedAt = createdAt.UTC().Format(time.RFC3339)
				ts.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
				if len(configBytes) > 0 {
					var cfg map[string]any
					if json.Unmarshal(configBytes, &cfg) == nil {
						if v, ok := cfg["name"].(string); ok {
							ts.Name = v
						} else {
							ts.Name = ts.Slug
						}
						if v, ok := cfg["privacyClass"].(string); ok {
							ts.PrivacyClass = v
						} else {
							ts.PrivacyClass = "learner_private"
						}
						if v, ok := cfg["noPiiVerified"].(bool); ok {
							ts.NoPIIVerified = v
						}
						if v, ok := cfg["surface"].(string); ok {
							ts.Surface = v
						} else {
							ts.Surface = "social"
						}
					}
				}
				if ts.Name == "" {
					ts.Name = ts.Slug
				}
				if ts.PrivacyClass == "" {
					ts.PrivacyClass = "learner_private"
				}
				if ts.Surface == "" {
					ts.Surface = "social"
				}
				items = append(items, ts)
			}
		}
		if items == nil {
			items = []TemplateSummary{}
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"items":    items,
			"page":     page,
			"pageSize": pageSize,
			"total":    total,
		})
	}
}

// adminGrowthSocialTemplatesDetailHandler implements GET /api/admin/growth/social/templates/{id}.
func adminGrowthSocialTemplatesDetailHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := extractPathParam(r.URL.Path, "templates", 1)
		if id == "" {
			writeJSONError(w, "social template id required", http.StatusBadRequest)
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
		type TemplateDetail struct {
			ID            string          `json:"id"`
			Slug          string          `json:"slug"`
			Name          string          `json:"name"`
			Kind          string          `json:"kind"`
			Version       int             `json:"version"`
			Active        bool            `json:"active"`
			PrivacyClass  string          `json:"privacyClass"`
			NoPIIVerified bool            `json:"noPiiVerified"`
			Surface       string          `json:"surface"`
			Config        json.RawMessage `json:"config,omitempty"`
			CreatedAt     string          `json:"createdAt"`
			UpdatedAt     string          `json:"updatedAt"`
			Audit         []AuditEntry    `json:"audit"`
		}

		var td TemplateDetail
		var configBytes []byte
		var createdAt, updatedAt time.Time
		err := db.QueryRow(ctx, `
			SELECT id, slug, kind, version, active, config, created_at, updated_at
			FROM growth.share_template WHERE id = $1 AND kind = ANY($2)`,
			id, growthSocialKinds).Scan(&td.ID, &td.Slug, &td.Kind, &td.Version,
			&td.Active, &configBytes, &createdAt, &updatedAt)
		if err != nil {
			writeJSONError(w, "social template not found", http.StatusNotFound)
			return
		}
		td.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		td.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)

		if len(configBytes) > 0 {
			td.Config = configBytes
			var cfg map[string]any
			if json.Unmarshal(configBytes, &cfg) == nil {
				if v, ok := cfg["name"].(string); ok {
					td.Name = v
				} else {
					td.Name = td.Slug
				}
				if v, ok := cfg["privacyClass"].(string); ok {
					td.PrivacyClass = v
				} else {
					td.PrivacyClass = "learner_private"
				}
				if v, ok := cfg["noPiiVerified"].(bool); ok {
					td.NoPIIVerified = v
				}
				if v, ok := cfg["surface"].(string); ok {
					td.Surface = v
				} else {
					td.Surface = "social"
				}
			}
		}
		if td.Name == "" {
			td.Name = td.Slug
		}
		if td.PrivacyClass == "" {
			td.PrivacyClass = "learner_private"
		}
		if td.Surface == "" {
			td.Surface = "social"
		}

		// Audit trail
		aRows, err := db.Query(ctx, `
			SELECT a.id, a.action, a.actor_id, act.display_name, act.email,
			       a.reason, a.after, a.before, a.created_at
			FROM ops.admin_audit_log a
			LEFT JOIN authz.admin_actor act ON act.id = a.actor_id
			WHERE a.target_id = $1 AND a.target_type = 'growth.social_template'
			ORDER BY a.created_at DESC LIMIT 20`, id)
		if err == nil {
			for aRows.Next() {
				var ae AuditEntry
				var ts time.Time
				if err := aRows.Scan(&ae.ID, &ae.Action, &ae.ActorID, &ae.ActorName,
					&ae.ActorEmail, &ae.Reason, &ae.After, &ae.Before, &ts); err == nil {
					ae.CreatedAt = ts.UTC().Format(time.RFC3339)
					td.Audit = append(td.Audit, ae)
				}
			}
			aRows.Close()
		}
		if td.Audit == nil {
			td.Audit = []AuditEntry{}
		}
		writeJSON(w, http.StatusOK, td)
	}
}

// adminGrowthSocialTemplatesCreateHandler implements POST /api/admin/growth/social/templates.
func adminGrowthSocialTemplatesCreateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			Slug   string          `json:"slug"`
			Kind   string          `json:"kind"`
			Config json.RawMessage `json:"config"`
			Reason string          `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.Slug == "" || req.Kind == "" {
			writeJSONError(w, "slug and kind are required", http.StatusBadRequest)
			return
		}
		if !validSocialSlugRe.MatchString(req.Slug) || len(req.Slug) < 2 || len(req.Slug) > 64 {
			writeJSONError(w, "invalid slug format", http.StatusBadRequest)
			return
		}
		if err := assertSocialPrivacy(req.Config, false); err != nil {
			writeJSONError(w, err.Error(), http.StatusBadRequest)
			return
		}

		ctx := r.Context()
		configJSON := req.Config
		if configJSON == nil {
			configJSON = json.RawMessage("{}")
		}
		var createdID string
		err := db.QueryRow(ctx, `
			INSERT INTO growth.share_template (slug, kind, version, active, config, created_at, updated_at)
			VALUES ($1, $2, 1, false, $3, NOW(), NOW()) RETURNING id`,
			req.Slug, req.Kind, configJSON).Scan(&createdID)
		if err != nil {
			logger.Error("create social template", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		afterJSON, _ := json.Marshal(map[string]any{
			"config": req.Config, "kind": req.Kind, "slug": req.Slug,
		})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('admin.growth.social_template.created', $1, $2, 'growth.social_template', $3, $4, NOW())`,
			identity.ActorID, createdID, req.Reason, afterJSON)

		r.URL.Path = "/api/admin/growth/social/templates/" + createdID
		detailHandler := adminGrowthSocialTemplatesDetailHandler(db, logger)
		detailHandler(w, r)
	}
}

// adminGrowthSocialTemplatesPatchHandler implements PATCH /api/admin/growth/social/templates/{id}.
func adminGrowthSocialTemplatesPatchHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "templates", 1)
		if id == "" {
			writeJSONError(w, "social template id required", http.StatusBadRequest)
			return
		}
		var req struct {
			Slug   *string         `json:"slug,omitempty"`
			Kind   *string         `json:"kind,omitempty"`
			Config json.RawMessage `json:"config,omitempty"`
			Reason string          `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}

		ctx := r.Context()
		var beforeSlug, beforeKind string
		var beforeVersion int
		var beforeActive bool
		var beforeConfig []byte
		err := db.QueryRow(ctx, `
			SELECT slug, kind, version, active, config
			FROM growth.share_template WHERE id = $1 AND kind = ANY($2)`,
			id, growthSocialKinds).Scan(&beforeSlug, &beforeKind, &beforeVersion, &beforeActive, &beforeConfig)
		if err != nil {
			writeJSONError(w, "social template not found", http.StatusNotFound)
			return
		}

		if req.Slug != nil {
			if !validSocialSlugRe.MatchString(*req.Slug) || len(*req.Slug) < 2 || len(*req.Slug) > 64 {
				writeJSONError(w, "invalid slug format", http.StatusBadRequest)
				return
			}
		}
		if req.Config != nil {
			if err := assertSocialPrivacyWithActive(req.Config, beforeActive); err != nil {
				writeJSONError(w, err.Error(), http.StatusBadRequest)
				return
			}
		}

		setClauses := []string{}
		args := []any{}
		argIdx := 1
		if req.Slug != nil {
			setClauses = append(setClauses, "slug = $"+itoa(argIdx))
			args = append(args, *req.Slug)
			argIdx++
		}
		if req.Kind != nil {
			setClauses = append(setClauses, "kind = $"+itoa(argIdx))
			args = append(args, *req.Kind)
			argIdx++
		}
		if req.Config != nil {
			setClauses = append(setClauses, "config = $"+itoa(argIdx))
			args = append(args, req.Config)
			argIdx++
			setClauses = append(setClauses, "version = version + 1")
		}
		if len(setClauses) == 0 {
			writeJSONError(w, "at least one field to update is required", http.StatusBadRequest)
			return
		}
		setClauses = append(setClauses, "updated_at = NOW()")

		query := "UPDATE growth.share_template SET " + joinStrings(setClauses, ", ") +
			" WHERE id = $" + itoa(argIdx)
		args = append(args, id)
		if _, err := db.Exec(ctx, query, args...); err != nil {
			logger.Error("patch social template", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		beforeJSON, _ := json.Marshal(map[string]any{
			"config": json.RawMessage(beforeConfig), "kind": beforeKind,
			"slug": beforeSlug, "version": beforeVersion,
		})
		afterJSON, _ := json.Marshal(map[string]any{"updated": true, "fields": setClauses})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, before, created_at)
			VALUES ('admin.growth.social_template.updated', $1, $2, 'growth.social_template', $3, $4, $5, NOW())`,
			identity.ActorID, id, req.Reason, afterJSON, beforeJSON)

		detailHandler := adminGrowthSocialTemplatesDetailHandler(db, logger)
		detailHandler(w, r)
	}
}

// adminGrowthSocialTemplatesPublishHandler implements POST /api/admin/growth/social/templates/{id}/publish.
func adminGrowthSocialTemplatesPublishHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "templates", 1)
		if id == "" {
			writeJSONError(w, "social template id required", http.StatusBadRequest)
			return
		}
		var req struct {
			Reason string `json:"reason"`
		}
		json.NewDecoder(r.Body).Decode(&req)

		ctx := r.Context()
		var beforeActive bool
		var configBytes []byte
		err := db.QueryRow(ctx, `
			SELECT active, config FROM growth.share_template
			WHERE id = $1 AND kind = ANY($2)`, id, growthSocialKinds).Scan(&beforeActive, &configBytes)
		if err != nil {
			writeJSONError(w, "social template not found", http.StatusNotFound)
			return
		}

		if err := assertSocialPrivacyForPublish(configBytes); err != nil {
			writeJSONError(w, err.Error(), http.StatusBadRequest)
			return
		}

		if !beforeActive {
			db.Exec(ctx, "UPDATE growth.share_template SET active = true, updated_at = NOW() WHERE id = $1", id)
		}

		privClass := "learner_private"
		if len(configBytes) > 0 {
			var cfg map[string]any
			if json.Unmarshal(configBytes, &cfg) == nil {
				if v, ok := cfg["privacyClass"].(string); ok {
					privClass = v
				}
			}
		}
		afterJSON, _ := json.Marshal(map[string]any{"active": true, "privacyClass": privClass})
		beforeJSON, _ := json.Marshal(map[string]any{"active": beforeActive})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, before, created_at)
			VALUES ('admin.growth.social_template.published', $1, $2, 'growth.social_template', $3, $4, $5, NOW())`,
			identity.ActorID, id, req.Reason, afterJSON, beforeJSON)

		detailHandler := adminGrowthSocialTemplatesDetailHandler(db, logger)
		detailHandler(w, r)
	}
}

// adminGrowthSocialTemplatesArchiveHandler implements POST /api/admin/growth/social/templates/{id}/archive.
func adminGrowthSocialTemplatesArchiveHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "templates", 1)
		if id == "" {
			writeJSONError(w, "social template id required", http.StatusBadRequest)
			return
		}
		var req struct {
			Reason string `json:"reason"`
		}
		json.NewDecoder(r.Body).Decode(&req)

		ctx := r.Context()
		var beforeActive bool
		err := db.QueryRow(ctx, `
			SELECT active FROM growth.share_template
			WHERE id = $1 AND kind = ANY($2)`, id, growthSocialKinds).Scan(&beforeActive)
		if err != nil {
			writeJSONError(w, "social template not found", http.StatusNotFound)
			return
		}

		if beforeActive {
			db.Exec(ctx, "UPDATE growth.share_template SET active = false, updated_at = NOW() WHERE id = $1", id)
		}

		afterJSON, _ := json.Marshal(map[string]any{"active": false})
		beforeJSON, _ := json.Marshal(map[string]any{"active": beforeActive})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, before, created_at)
			VALUES ('admin.growth.social_template.archived', $1, $2, 'growth.social_template', $3, $4, $5, NOW())`,
			identity.ActorID, id, req.Reason, afterJSON, beforeJSON)

		detailHandler := adminGrowthSocialTemplatesDetailHandler(db, logger)
		detailHandler(w, r)
	}
}

// adminGrowthSocialEventsListHandler implements GET /api/admin/growth/social/events.
func adminGrowthSocialEventsListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		page := queryInt(r, "page", 1)
		pageSize := queryInt(r, "pageSize", 20)
		if page < 1 {
			page = 1
		}
		if pageSize < 1 || pageSize > 100 {
			pageSize = 20
		}
		offset := (page - 1) * pageSize

		countQuery := "SELECT COUNT(*) FROM growth.share_item"
		var total int
		if err := db.QueryRow(ctx, countQuery).Scan(&total); err != nil {
			logger.Error("count social events", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		dataQuery := fmt.Sprintf(`
			SELECT id, user_id, template_id, payload, expires_at, created_at
			FROM growth.share_item
			ORDER BY created_at DESC LIMIT $%d OFFSET $%d`, 1, 2)
		rows, err := db.Query(ctx, dataQuery, pageSize, offset)
		if err != nil {
			logger.Error("list social events", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type EventSummary struct {
			ID         string          `json:"id"`
			UserID     string          `json:"userId"`
			TemplateID *string         `json:"templateId,omitempty"`
			Payload    json.RawMessage `json:"payload,omitempty"`
			ExpiresAt  *string         `json:"expiresAt,omitempty"`
			CreatedAt  string          `json:"createdAt"`
		}
		var items []EventSummary
		for rows.Next() {
			var e EventSummary
			var createdAt time.Time
			var expiresAt *time.Time
			var payloadBytes []byte
			if err := rows.Scan(&e.ID, &e.UserID, &e.TemplateID, &payloadBytes, &expiresAt, &createdAt); err == nil {
				e.CreatedAt = createdAt.UTC().Format(time.RFC3339)
				if expiresAt != nil {
					s := expiresAt.UTC().Format(time.RFC3339)
					e.ExpiresAt = &s
				}
				if payloadBytes != nil {
					e.Payload = payloadBytes
				}
				items = append(items, e)
			}
		}
		if items == nil {
			items = []EventSummary{}
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"items":    items,
			"page":     page,
			"pageSize": pageSize,
			"total":    total,
		})
	}
}

// adminGrowthSocialEventsModerateHandler implements POST /api/admin/growth/social/events/{id}/moderate.
func adminGrowthSocialEventsModerateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "events", 1)
		if id == "" {
			writeJSONError(w, "event id required", http.StatusBadRequest)
			return
		}
		var req struct {
			Action string `json:"action"`
			Reason string `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.Action != "dismiss" && req.Action != "hide_from_public" && req.Action != "report_to_legal" {
			writeJSONError(w, "action must be dismiss, hide_from_public, or report_to_legal", http.StatusBadRequest)
			return
		}

		ctx := r.Context()
		var beforeExpiresAt *time.Time
		err := db.QueryRow(ctx, "SELECT expires_at FROM growth.share_item WHERE id = $1", id).Scan(&beforeExpiresAt)
		if err != nil {
			writeJSONError(w, "share item not found", http.StatusNotFound)
			return
		}

		var afterJSON json.RawMessage
		if req.Action == "hide_from_public" || req.Action == "report_to_legal" {
			now := time.Now().UTC()
			db.Exec(ctx, "UPDATE growth.share_item SET expires_at = $1 WHERE id = $2", now, id)
			if req.Action == "report_to_legal" {
				afterJSON, _ = json.Marshal(map[string]any{"expiresAt": now.Format(time.RFC3339), "reportedToLegal": true})
			} else {
				afterJSON, _ = json.Marshal(map[string]any{"expiresAt": now.Format(time.RFC3339)})
			}
		} else {
			afterJSON, _ = json.Marshal(map[string]any{"dismissed": true})
		}

		var beforeExpiresStr *string
		if beforeExpiresAt != nil {
			s := beforeExpiresAt.UTC().Format(time.RFC3339)
			beforeExpiresStr = &s
		}
		beforeJSON, _ := json.Marshal(map[string]any{"expiresAt": beforeExpiresStr})

		auditAction := "admin.growth.share_item." + req.Action
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, before, created_at)
			VALUES ($1, $2, $3, 'growth.share_item', $4, $5, $6, NOW())`,
			auditAction, identity.ActorID, id, req.Reason, afterJSON, beforeJSON)

		writeJSON(w, http.StatusOK, map[string]any{"action": req.Action, "id": id, "ok": true})
	}
}

// ── Social Template Privacy Helpers ─────────────────────────────────────────

func assertSocialPrivacy(configJSON json.RawMessage, publishing bool) error {
	pc, noPii := extractPrivacyFromConfig(configJSON)
	if !isValidPrivacyClass(pc) {
		return fmt.Errorf("invalid privacy class: %s", pc)
	}
	if publishing && pc == "public" && !noPii {
		return fmt.Errorf("public template requires noPiiVerified=true before publish")
	}
	return nil
}

func assertSocialPrivacyWithActive(configJSON json.RawMessage, active bool) error {
	return assertSocialPrivacy(configJSON, active)
}

func assertSocialPrivacyForPublish(configJSON json.RawMessage) error {
	return assertSocialPrivacy(configJSON, true)
}

// Ensure imports are used.
var _ = context.Background
var _ = pgx.ErrNoRows
