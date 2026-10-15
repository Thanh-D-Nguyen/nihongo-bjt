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

func validGrowthSocialKind(kind string) bool {
	for _, allowed := range growthSocialKinds {
		if kind == allowed {
			return true
		}
	}
	return false
}

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
			ID         string  `json:"id"`
			Action     string  `json:"action"`
			ActorID    string  `json:"actorId"`
			ActorName  *string `json:"actorName,omitempty"`
			ActorEmail *string `json:"actorEmail,omitempty"`
			Actor      *struct {
				ID          string `json:"id"`
				DisplayName string `json:"displayName"`
				Email       string `json:"email"`
			} `json:"actor"`
			Reason    string          `json:"reason"`
			After     json.RawMessage `json:"after,omitempty"`
			Before    json.RawMessage `json:"before,omitempty"`
			CreatedAt string          `json:"createdAt"`
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
					if ae.ActorName != nil && ae.ActorEmail != nil {
						ae.Actor = &struct {
							ID          string `json:"id"`
							DisplayName string `json:"displayName"`
							Email       string `json:"email"`
						}{ID: ae.ActorID, DisplayName: *ae.ActorName, Email: *ae.ActorEmail}
					}
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
		if len(strings.TrimSpace(req.Reason)) < 3 {
			writeJSONError(w, "reason is required", http.StatusBadRequest)
			return
		}
		if req.Slug == "" || !validGrowthSocialKind(req.Kind) {
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
		tx, err := db.BeginTx(ctx, pgx.TxOptions{})
		if err != nil {
			logger.Error("begin social template create", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(ctx)
		configJSON := req.Config
		if configJSON == nil {
			configJSON = json.RawMessage("{}")
		}
		var createdID string
		err = tx.QueryRow(ctx, `
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
		if err := writeAdminAuditWithReason(ctx, tx, identity.ActorID, "admin.growth.social_template.created", "growth.social_template", createdID, req.Reason, nil, json.RawMessage(afterJSON)); err != nil {
			logger.Error("audit social template create", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			logger.Error("commit social template create", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

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
		tx, err := db.BeginTx(ctx, pgx.TxOptions{})
		if err != nil {
			logger.Error("begin social template update", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(ctx)
		var beforeSlug, beforeKind string
		var beforeVersion int
		var beforeActive bool
		var beforeConfig []byte
		err = tx.QueryRow(ctx, `
			SELECT slug, kind, version, active, config
			FROM growth.share_template WHERE id = $1 AND kind = ANY($2) FOR UPDATE`,
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
			if !validGrowthSocialKind(*req.Kind) {
				writeJSONError(w, "invalid social template kind", http.StatusBadRequest)
				return
			}
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
		if _, err := tx.Exec(ctx, query, args...); err != nil {
			logger.Error("patch social template", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		beforeJSON, _ := json.Marshal(map[string]any{
			"config": json.RawMessage(beforeConfig), "kind": beforeKind,
			"slug": beforeSlug, "version": beforeVersion,
		})
		afterSlug, afterKind, afterConfig, afterVersion := beforeSlug, beforeKind, beforeConfig, beforeVersion
		if req.Slug != nil {
			afterSlug = *req.Slug
		}
		if req.Kind != nil {
			afterKind = *req.Kind
		}
		if req.Config != nil {
			afterConfig = req.Config
			afterVersion++
		}
		afterJSON, _ := json.Marshal(map[string]any{
			"config": json.RawMessage(afterConfig), "kind": afterKind,
			"slug": afterSlug, "version": afterVersion,
		})
		if err := writeAdminAuditWithReason(ctx, tx, identity.ActorID, "admin.growth.social_template.updated", "growth.social_template", id, req.Reason, json.RawMessage(beforeJSON), json.RawMessage(afterJSON)); err != nil {
			logger.Error("audit social template update", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			logger.Error("commit social template update", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

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
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || len(strings.TrimSpace(req.Reason)) < 3 {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}

		ctx := r.Context()
		tx, err := db.BeginTx(ctx, pgx.TxOptions{})
		if err != nil {
			logger.Error("begin social template publish", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(ctx)
		var beforeActive bool
		var configBytes []byte
		err = tx.QueryRow(ctx, `
			SELECT active, config FROM growth.share_template
			WHERE id = $1 AND kind = ANY($2) FOR UPDATE`, id, growthSocialKinds).Scan(&beforeActive, &configBytes)
		if err != nil {
			writeJSONError(w, "social template not found", http.StatusNotFound)
			return
		}

		if err := assertSocialPrivacyForPublish(configBytes); err != nil {
			writeJSONError(w, err.Error(), http.StatusBadRequest)
			return
		}

		if !beforeActive {
			if _, err := tx.Exec(ctx, "UPDATE growth.share_template SET active = true, updated_at = NOW() WHERE id = $1", id); err != nil {
				logger.Error("publish social template", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
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
		if err := writeAdminAuditWithReason(ctx, tx, identity.ActorID, "admin.growth.social_template.published", "growth.social_template", id, req.Reason, json.RawMessage(beforeJSON), json.RawMessage(afterJSON)); err != nil {
			logger.Error("audit social template publish", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			logger.Error("commit social template publish", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

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
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || len(strings.TrimSpace(req.Reason)) < 3 {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}

		ctx := r.Context()
		tx, err := db.BeginTx(ctx, pgx.TxOptions{})
		if err != nil {
			logger.Error("begin social template archive", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(ctx)
		var beforeActive bool
		err = tx.QueryRow(ctx, `
			SELECT active FROM growth.share_template
			WHERE id = $1 AND kind = ANY($2) FOR UPDATE`, id, growthSocialKinds).Scan(&beforeActive)
		if err != nil {
			writeJSONError(w, "social template not found", http.StatusNotFound)
			return
		}

		if beforeActive {
			if _, err := tx.Exec(ctx, "UPDATE growth.share_template SET active = false, updated_at = NOW() WHERE id = $1", id); err != nil {
				logger.Error("archive social template", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
		}

		afterJSON, _ := json.Marshal(map[string]any{"active": false})
		beforeJSON, _ := json.Marshal(map[string]any{"active": beforeActive})
		if err := writeAdminAuditWithReason(ctx, tx, identity.ActorID, "admin.growth.social_template.archived", "growth.social_template", id, req.Reason, json.RawMessage(beforeJSON), json.RawMessage(afterJSON)); err != nil {
			logger.Error("audit social template archive", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			logger.Error("commit social template archive", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		detailHandler := adminGrowthSocialTemplatesDetailHandler(db, logger)
		detailHandler(w, r)
	}
}

// adminGrowthSocialEventsListHandler implements GET /api/admin/growth/social/events.
func adminGrowthSocialEventsListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		hiddenFilter := r.URL.Query().Get("hidden")
		page := queryInt(r, "page", 1)
		pageSize := queryInt(r, "pageSize", 20)
		if page < 1 {
			page = 1
		}
		if pageSize < 1 || pageSize > 100 {
			pageSize = 20
		}
		offset := (page - 1) * pageSize

		whereClause := `WHERE NOT EXISTS (SELECT 1 FROM ops.admin_audit_log a WHERE a.target_type='growth.share_item' AND a.target_id=s.id::text AND a.action='admin.growth.share_item.dismiss')`
		if hiddenFilter == "active" {
			whereClause += ` AND (s.expires_at IS NULL OR s.expires_at > NOW())`
		} else if hiddenFilter == "hidden" {
			whereClause += ` AND s.expires_at <= NOW()`
		}
		countQuery := `SELECT COUNT(*) FROM growth.share_item s ` + whereClause
		var total int
		if err := db.QueryRow(ctx, countQuery).Scan(&total); err != nil {
			logger.Error("count social events", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		dataQuery := fmt.Sprintf(`
			SELECT s.id, s.public_token, s.kind,
			       (s.expires_at IS NOT NULL AND s.expires_at <= NOW()), s.expires_at, s.created_at,
			       s.summary_payload, st.id, st.kind, st.slug, u.id, COALESCE(u.display_name, '')
			FROM growth.share_item s
			LEFT JOIN growth.share_template st ON st.id = s.template_id
			JOIN profile.user_profile u ON u.id = s.user_id
			%s
			ORDER BY s.created_at DESC LIMIT $1 OFFSET $2`, whereClause)
		rows, err := db.Query(ctx, dataQuery, pageSize, offset)
		if err != nil {
			logger.Error("list social events", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type EventSummary struct {
			ID          string  `json:"id"`
			PublicToken string  `json:"publicToken"`
			Kind        string  `json:"kind"`
			Hidden      bool    `json:"hidden"`
			ExpiresAt   *string `json:"expiresAt"`
			CreatedAt   string  `json:"createdAt"`
			Template    *struct {
				ID   string `json:"id"`
				Kind string `json:"kind"`
				Slug string `json:"slug"`
			} `json:"template"`
			User struct {
				ID          string `json:"id"`
				DisplayName string `json:"displayName"`
			} `json:"user"`
			SummaryPreview struct {
				Headline string `json:"headline,omitempty"`
				Sub      string `json:"sub,omitempty"`
			} `json:"summaryPreview"`
		}
		var items []EventSummary
		for rows.Next() {
			var e EventSummary
			var createdAt time.Time
			var expiresAt *time.Time
			var payloadBytes []byte
			var templateID, templateKind, templateSlug *string
			if err := rows.Scan(&e.ID, &e.PublicToken, &e.Kind, &e.Hidden, &expiresAt, &createdAt,
				&payloadBytes, &templateID, &templateKind, &templateSlug, &e.User.ID, &e.User.DisplayName); err != nil {
				logger.Error("scan social event", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			e.CreatedAt = createdAt.UTC().Format(time.RFC3339)
			if expiresAt != nil {
				s := expiresAt.UTC().Format(time.RFC3339)
				e.ExpiresAt = &s
			}
			if templateID != nil {
				e.Template = &struct {
					ID   string `json:"id"`
					Kind string `json:"kind"`
					Slug string `json:"slug"`
				}{ID: *templateID, Kind: *templateKind, Slug: *templateSlug}
			}
			var summary struct {
				Headline string `json:"headline"`
				Sub      string `json:"sub"`
			}
			if err := json.Unmarshal(payloadBytes, &summary); err == nil {
				e.SummaryPreview.Headline = summary.Headline
				e.SummaryPreview.Sub = summary.Sub
			}
			items = append(items, e)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate social events", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
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
		if len(strings.TrimSpace(req.Reason)) < 3 {
			writeJSONError(w, "reason is required", http.StatusBadRequest)
			return
		}
		if req.Action != "dismiss" && req.Action != "hide_from_public" && req.Action != "report_to_legal" {
			writeJSONError(w, "action must be dismiss, hide_from_public, or report_to_legal", http.StatusBadRequest)
			return
		}

		ctx := r.Context()
		tx, err := db.BeginTx(ctx, pgx.TxOptions{})
		if err != nil {
			logger.Error("begin social event moderation", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(ctx)
		var beforeExpiresAt *time.Time
		err = tx.QueryRow(ctx, "SELECT expires_at FROM growth.share_item WHERE id = $1 FOR UPDATE", id).Scan(&beforeExpiresAt)
		if err != nil {
			writeJSONError(w, "share item not found", http.StatusNotFound)
			return
		}

		var afterJSON json.RawMessage
		if req.Action == "hide_from_public" || req.Action == "report_to_legal" {
			now := time.Now().UTC()
			if _, err := tx.Exec(ctx, "UPDATE growth.share_item SET expires_at = $1 WHERE id = $2", now, id); err != nil {
				logger.Error("moderate social event", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
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
		if err := writeAdminAuditWithReason(ctx, tx, identity.ActorID, auditAction, "growth.share_item", id, req.Reason, json.RawMessage(beforeJSON), json.RawMessage(afterJSON)); err != nil {
			logger.Error("audit social event moderation", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			logger.Error("commit social event moderation", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

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
