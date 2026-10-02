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

// ── P1-A3.2: Admin Growth — Postcards Sub-Domain (6 routes) ─────────────────
// All routes require admin session + appropriate permissions.
// Contracts derived from NestJS apps/api/src/growth/growth-postcards-admin.repository.ts
// list, detail, create, patch, publish, archive.
// Postcards share the share_template table with social templates but are
// distinguished by kind IN GROWTH_POSTCARD_EVENT_KINDS.

var growthPostcardKinds = []string{
	"postcard_achievement",
	"postcard_streak",
	"postcard_level_up",
	"postcard_exam_result",
	"postcard_welcome",
	"postcard_seasonal",
}

var validSlugRe = regexp.MustCompile(`^[a-z0-9_-]+$`)

// adminGrowthPostcardsListHandler implements GET /api/admin/growth/postcards.
func adminGrowthPostcardsListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
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
		args := []any{growthPostcardKinds}
		argIdx := 2

		if kindFilter != "" {
			whereParts = append(whereParts, fmt.Sprintf("kind = $%d", argIdx))
			args = append(args, kindFilter)
			argIdx++
		}
		if statusFilter == "published" {
			whereParts = append(whereParts, fmt.Sprintf("active = true"))
		} else if statusFilter == "archived" {
			whereParts = append(whereParts, fmt.Sprintf("active = false"))
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
			logger.Error("count growth postcards", "error", err)
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
			logger.Error("list growth postcards", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type PostcardSummary struct {
			ID            string  `json:"id"`
			Slug          string  `json:"slug"`
			Name          string  `json:"name"`
			Kind          string  `json:"kind"`
			Version       int     `json:"version"`
			Active        bool    `json:"active"`
			PrivacyClass  string  `json:"privacyClass"`
			NoPIIVerified bool    `json:"noPiiVerified"`
			Surface       string  `json:"surface"`
			ThumbnailKey  *string `json:"thumbnailKey,omitempty"`
			CreatedAt     string  `json:"createdAt"`
			UpdatedAt     string  `json:"updatedAt"`
		}

		var items []PostcardSummary
		for rows.Next() {
			var ps PostcardSummary
			var configBytes []byte
			var createdAt, updatedAt time.Time
			if err := rows.Scan(&ps.ID, &ps.Slug, &ps.Kind, &ps.Version, &ps.Active,
				&configBytes, &createdAt, &updatedAt); err == nil {
				ps.CreatedAt = createdAt.UTC().Format(time.RFC3339)
				ps.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
				// Extract summary fields from config JSON
				if len(configBytes) > 0 {
					var cfg map[string]any
					if json.Unmarshal(configBytes, &cfg) == nil {
						if v, ok := cfg["name"].(string); ok {
							ps.Name = v
						} else {
							ps.Name = ps.Slug
						}
						if v, ok := cfg["privacyClass"].(string); ok {
							ps.PrivacyClass = v
						} else {
							ps.PrivacyClass = "learner_private"
						}
						if v, ok := cfg["noPiiVerified"].(bool); ok {
							ps.NoPIIVerified = v
						}
						if v, ok := cfg["surface"].(string); ok {
							ps.Surface = v
						} else {
							ps.Surface = "postcard"
						}
						if v, ok := cfg["thumbnailKey"].(string); ok && v != "" {
							ps.ThumbnailKey = &v
						}
					}
				}
				if ps.Name == "" {
					ps.Name = ps.Slug
				}
				if ps.PrivacyClass == "" {
					ps.PrivacyClass = "learner_private"
				}
				if ps.Surface == "" {
					ps.Surface = "postcard"
				}
				items = append(items, ps)
			}
		}
		if items == nil {
			items = []PostcardSummary{}
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"items":    items,
			"page":     page,
			"pageSize": pageSize,
			"total":    total,
		})
	}
}

// adminGrowthPostcardsDetailHandler implements GET /api/admin/growth/postcards/{id}.
func adminGrowthPostcardsDetailHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := extractPathParam(r.URL.Path, "postcards", 1)
		if id == "" {
			writeJSONError(w, "postcard id required", http.StatusBadRequest)
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

		type PostcardDetail struct {
			ID            string          `json:"id"`
			Slug          string          `json:"slug"`
			Name          string          `json:"name"`
			Kind          string          `json:"kind"`
			Version       int             `json:"version"`
			Active        bool            `json:"active"`
			PrivacyClass  string          `json:"privacyClass"`
			NoPIIVerified bool            `json:"noPiiVerified"`
			Surface       string          `json:"surface"`
			ThumbnailKey  *string         `json:"thumbnailKey,omitempty"`
			Config        json.RawMessage `json:"config,omitempty"`
			CreatedAt     string          `json:"createdAt"`
			UpdatedAt     string          `json:"updatedAt"`
			Audit         []AuditEntry    `json:"audit"`
		}

		var pd PostcardDetail
		var configBytes []byte
		var createdAt, updatedAt time.Time
		err := db.QueryRow(ctx, `
			SELECT id, slug, kind, version, active, config, created_at, updated_at
			FROM growth.share_template WHERE id = $1 AND kind = ANY($2)`,
			id, growthPostcardKinds).Scan(&pd.ID, &pd.Slug, &pd.Kind, &pd.Version,
			&pd.Active, &configBytes, &createdAt, &updatedAt)
		if err != nil {
			writeJSONError(w, "postcard not found", http.StatusNotFound)
			return
		}
		pd.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		pd.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)

		if len(configBytes) > 0 {
			pd.Config = configBytes
			var cfg map[string]any
			if json.Unmarshal(configBytes, &cfg) == nil {
				if v, ok := cfg["name"].(string); ok {
					pd.Name = v
				} else {
					pd.Name = pd.Slug
				}
				if v, ok := cfg["privacyClass"].(string); ok {
					pd.PrivacyClass = v
				} else {
					pd.PrivacyClass = "learner_private"
				}
				if v, ok := cfg["noPiiVerified"].(bool); ok {
					pd.NoPIIVerified = v
				}
				if v, ok := cfg["surface"].(string); ok {
					pd.Surface = v
				} else {
					pd.Surface = "postcard"
				}
				if v, ok := cfg["thumbnailKey"].(string); ok && v != "" {
					pd.ThumbnailKey = &v
				}
			}
		}
		if pd.Name == "" {
			pd.Name = pd.Slug
		}
		if pd.PrivacyClass == "" {
			pd.PrivacyClass = "learner_private"
		}
		if pd.Surface == "" {
			pd.Surface = "postcard"
		}

		// Audit trail
		aRows, err := db.Query(ctx, `
			SELECT a.id, a.action, a.actor_id, act.display_name, act.email,
			       a.reason, a.after, a.before, a.created_at
			FROM ops.admin_audit_log a
			LEFT JOIN authz.admin_actor act ON act.id = a.actor_id
			WHERE a.target_id = $1 AND a.target_type = 'growth.postcard_template'
			ORDER BY a.created_at DESC LIMIT 20`, id)
		if err == nil {
			for aRows.Next() {
				var ae AuditEntry
				var ts time.Time
				if err := aRows.Scan(&ae.ID, &ae.Action, &ae.ActorID, &ae.ActorName,
					&ae.ActorEmail, &ae.Reason, &ae.After, &ae.Before, &ts); err == nil {
					ae.CreatedAt = ts.UTC().Format(time.RFC3339)
					pd.Audit = append(pd.Audit, ae)
				}
			}
			aRows.Close()
		}
		if pd.Audit == nil {
			pd.Audit = []AuditEntry{}
		}

		writeJSON(w, http.StatusOK, pd)
	}
}

// adminGrowthPostcardsCreateHandler implements POST /api/admin/growth/postcards.
func adminGrowthPostcardsCreateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
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
		// Validate slug format
		if !validSlugRe.MatchString(req.Slug) || len(req.Slug) < 2 || len(req.Slug) > 64 {
			writeJSONError(w, "invalid slug format", http.StatusBadRequest)
			return
		}
		// Validate privacy before create
		if err := assertPostcardPrivacy(req.Config, false); err != nil {
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
			logger.Error("create growth postcard", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		// Write audit
		afterJSON, _ := json.Marshal(map[string]any{
			"config": req.Config, "kind": req.Kind, "slug": req.Slug,
		})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('admin.growth.postcard_template.created', $1, $2, 'growth.postcard_template', $3, $4, NOW())`,
			identity.ActorID, createdID, req.Reason, afterJSON)

		// Return detail view
		r.URL.Path = "/api/admin/growth/postcards/" + createdID
		detailHandler := adminGrowthPostcardsDetailHandler(db, logger)
		detailHandler(w, r)
	}
}

// adminGrowthPostcardsPatchHandler implements PATCH /api/admin/growth/postcards/{id}.
func adminGrowthPostcardsPatchHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "postcards", 1)
		if id == "" {
			writeJSONError(w, "postcard id required", http.StatusBadRequest)
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

		// Fetch existing
		var beforeSlug, beforeKind string
		var beforeVersion int
		var beforeActive bool
		var beforeConfig []byte
		err := db.QueryRow(ctx, `
			SELECT slug, kind, version, active, config
			FROM growth.share_template WHERE id = $1 AND kind = ANY($2)`,
			id, growthPostcardKinds).Scan(&beforeSlug, &beforeKind, &beforeVersion, &beforeActive, &beforeConfig)
		if err != nil {
			writeJSONError(w, "postcard not found", http.StatusNotFound)
			return
		}

		// Validate slug if changing
		if req.Slug != nil {
			if !validSlugRe.MatchString(*req.Slug) || len(*req.Slug) < 2 || len(*req.Slug) > 64 {
				writeJSONError(w, "invalid slug format", http.StatusBadRequest)
				return
			}
		}
		// Validate privacy if config changes
		if req.Config != nil {
			if err := assertPostcardPrivacyWithActive(req.Config, beforeActive); err != nil {
				writeJSONError(w, err.Error(), http.StatusBadRequest)
				return
			}
		}

		// Build dynamic UPDATE
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
			logger.Error("patch growth postcard", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		// Write audit
		beforeJSON, _ := json.Marshal(map[string]any{
			"config": json.RawMessage(beforeConfig), "kind": beforeKind,
			"slug": beforeSlug, "version": beforeVersion,
		})
		afterJSON, _ := json.Marshal(map[string]any{"updated": true, "fields": setClauses})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, before, created_at)
			VALUES ('admin.growth.postcard_template.updated', $1, $2, 'growth.postcard_template', $3, $4, $5, NOW())`,
			identity.ActorID, id, req.Reason, afterJSON, beforeJSON)

		// Return detail view
		detailHandler := adminGrowthPostcardsDetailHandler(db, logger)
		detailHandler(w, r)
	}
}

// adminGrowthPostcardsPublishHandler implements POST /api/admin/growth/postcards/{id}/publish.
func adminGrowthPostcardsPublishHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "postcards", 1)
		if id == "" {
			writeJSONError(w, "postcard id required", http.StatusBadRequest)
			return
		}

		var req struct {
			Reason string `json:"reason"`
		}
		json.NewDecoder(r.Body).Decode(&req)

		ctx := r.Context()

		// Fetch current state and validate privacy for publish
		var beforeActive bool
		var configBytes []byte
		err := db.QueryRow(ctx, `
			SELECT active, config FROM growth.share_template
			WHERE id = $1 AND kind = ANY($2)`, id, growthPostcardKinds).Scan(&beforeActive, &configBytes)
		if err != nil {
			writeJSONError(w, "postcard not found", http.StatusNotFound)
			return
		}

		// Privacy check for publishing
		if err := assertPostcardPrivacyForPublish(configBytes); err != nil {
			writeJSONError(w, err.Error(), http.StatusBadRequest)
			return
		}

		if !beforeActive {
			db.Exec(ctx, "UPDATE growth.share_template SET active = true, updated_at = NOW() WHERE id = $1", id)
		}

		privacyClass := "learner_private"
		if len(configBytes) > 0 {
			var cfg map[string]any
			if json.Unmarshal(configBytes, &cfg) == nil {
				if v, ok := cfg["privacyClass"].(string); ok {
					privacyClass = v
				}
			}
		}

		afterJSON, _ := json.Marshal(map[string]any{"active": true, "privacyClass": privacyClass})
		beforeJSON, _ := json.Marshal(map[string]any{"active": beforeActive})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, before, created_at)
			VALUES ('admin.growth.postcard_template.published', $1, $2, 'growth.postcard_template', $3, $4, $5, NOW())`,
			identity.ActorID, id, req.Reason, afterJSON, beforeJSON)

		// Return detail view
		detailHandler := adminGrowthPostcardsDetailHandler(db, logger)
		detailHandler(w, r)
	}
}

// adminGrowthPostcardsArchiveHandler implements POST /api/admin/growth/postcards/{id}/archive.
func adminGrowthPostcardsArchiveHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "postcards", 1)
		if id == "" {
			writeJSONError(w, "postcard id required", http.StatusBadRequest)
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
			WHERE id = $1 AND kind = ANY($2)`, id, growthPostcardKinds).Scan(&beforeActive)
		if err != nil {
			writeJSONError(w, "postcard not found", http.StatusNotFound)
			return
		}

		if beforeActive {
			db.Exec(ctx, "UPDATE growth.share_template SET active = false, updated_at = NOW() WHERE id = $1", id)
		}

		afterJSON, _ := json.Marshal(map[string]any{"active": false})
		beforeJSON, _ := json.Marshal(map[string]any{"active": beforeActive})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, before, created_at)
			VALUES ('admin.growth.postcard_template.archived', $1, $2, 'growth.postcard_template', $3, $4, $5, NOW())`,
			identity.ActorID, id, req.Reason, afterJSON, beforeJSON)

		// Return detail view
		detailHandler := adminGrowthPostcardsDetailHandler(db, logger)
		detailHandler(w, r)
	}
}

// ── Postcard Helpers ────────────────────────────────────────────────────────

var validPrivacyClasses = []string{"learner_private", "community_visible", "public"}

func isValidPrivacyClass(pc string) bool {
	for _, v := range validPrivacyClasses {
		if pc == v {
			return true
		}
	}
	return false
}

func extractPrivacyFromConfig(configJSON json.RawMessage) (string, bool) {
	if len(configJSON) == 0 {
		return "learner_private", false
	}
	var cfg map[string]any
	if json.Unmarshal(configJSON, &cfg) != nil {
		return "learner_private", false
	}
	pc, _ := cfg["privacyClass"].(string)
	if pc == "" {
		pc = "learner_private"
	}
	noPii, _ := cfg["noPiiVerified"].(bool)
	return pc, noPii
}

func assertPostcardPrivacy(configJSON json.RawMessage, publishing bool) error {
	pc, noPii := extractPrivacyFromConfig(configJSON)
	if !isValidPrivacyClass(pc) {
		return fmt.Errorf("invalid privacy class: %s", pc)
	}
	if publishing && pc == "public" && !noPii {
		return fmt.Errorf("public template requires noPiiVerified=true before publish")
	}
	return nil
}

func assertPostcardPrivacyWithActive(configJSON json.RawMessage, active bool) error {
	return assertPostcardPrivacy(configJSON, active)
}

func assertPostcardPrivacyForPublish(configJSON json.RawMessage) error {
	return assertPostcardPrivacy(configJSON, true)
}

// Ensure imports are used.
var _ = context.Background
var _ = pgx.ErrNoRows
