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

// ── P1-A8: Admin Learning — Paths + Competencies + Review (20 routes) ───────
// Contracts derived from NestJS learning-paths-admin.controller.ts,
// learning-competencies-admin.controller.ts, learning-review-admin.controller.ts.
// DB tables: learning.learning_path, learning.competency, learning.user_flashcard,
// learning.review_event, ops.admin_audit_log.

// ── Learning Paths ──────────────────────────────────────────────────────────

// adminLearningPathsListHandler implements GET /api/admin/learning/paths.
func adminLearningPathsListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query().Get("q")
		status := r.URL.Query().Get("status")
		targetLevel := r.URL.Query().Get("targetLevel")
		page := queryInt(r, "page", 1)
		pageSize := queryInt(r, "pageSize", 25)
		if page < 1 {
			page = 1
		}
		if pageSize < 1 || pageSize > 100 {
			pageSize = 25
		}
		offset := (page - 1) * pageSize

		whereParts := []string{}
		args := []any{}
		argIdx := 1
		if q != "" {
			pattern := "%" + q + "%"
			whereParts = append(whereParts, fmt.Sprintf("(slug ILIKE $%[1]d OR title_vi ILIKE $%[1]d OR title_ja ILIKE $%[1]d)", argIdx))
			args = append(args, pattern)
			argIdx++
		}
		if status != "" && status != "all" {
			whereParts = append(whereParts, fmt.Sprintf("status = $%d", argIdx))
			args = append(args, status)
			argIdx++
		}
		if targetLevel != "" {
			whereParts = append(whereParts, fmt.Sprintf("target_level = $%d", argIdx))
			args = append(args, targetLevel)
			argIdx++
		}
		whereClause := ""
		if len(whereParts) > 0 {
			whereClause = "WHERE " + strings.Join(whereParts, " AND ")
		}

		var total int
		db.QueryRow(r.Context(), "SELECT COUNT(*) FROM learning.learning_path "+whereClause, args...).Scan(&total)

		dataQ := fmt.Sprintf(`SELECT id, slug, title_vi, title_ja, description_vi, description_ja,
			target_level, display_order, status, created_at, updated_at
			FROM learning.learning_path %s ORDER BY status ASC, display_order ASC, updated_at DESC LIMIT $%d OFFSET $%d`,
			whereClause, argIdx, argIdx+1)
		args = append(args, pageSize, offset)

		rows, err := db.Query(r.Context(), dataQ, args...)
		if err != nil {
			logger.Error("list learning paths", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type Path struct {
			ID            string  `json:"id"`
			Slug          string  `json:"slug"`
			TitleVi       string  `json:"titleVi"`
			TitleJa       *string `json:"titleJa,omitempty"`
			DescriptionVi *string `json:"descriptionVi,omitempty"`
			DescriptionJa *string `json:"descriptionJa,omitempty"`
			TargetLevel   *string `json:"targetLevel,omitempty"`
			DisplayOrder  int     `json:"displayOrder"`
			Status        string  `json:"status"`
			CreatedAt     string  `json:"createdAt"`
			UpdatedAt     string  `json:"updatedAt"`
		}
		var items []Path
		for rows.Next() {
			var p Path
			var ca, ua time.Time
			if rows.Scan(&p.ID, &p.Slug, &p.TitleVi, &p.TitleJa, &p.DescriptionVi, &p.DescriptionJa,
				&p.TargetLevel, &p.DisplayOrder, &p.Status, &ca, &ua) == nil {
				p.CreatedAt = ca.UTC().Format(time.RFC3339)
				p.UpdatedAt = ua.UTC().Format(time.RFC3339)
				items = append(items, p)
			}
		}
		if items == nil {
			items = []Path{}
		}

		// Status counts
		type SC struct {
			Status string `json:"status"`
			Count  int    `json:"count"`
		}
		scRows, _ := db.Query(r.Context(), "SELECT status, COUNT(*) FROM learning.learning_path GROUP BY status")
		statusCounts := map[string]int{}
		if scRows != nil {
			for scRows.Next() {
				var s string
				var c int
				if scRows.Scan(&s, &c) == nil {
					statusCounts[s] = c
				}
			}
			scRows.Close()
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"items":        items,
			"page":         page,
			"pageSize":     pageSize,
			"total":        total,
			"statusCounts": statusCounts,
		})
	}
}

// adminLearningPathDetailHandler implements GET /api/admin/learning/paths/{id}.
func adminLearningPathDetailHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := extractPathParam(r.URL.Path, "paths", 1)
		if id == "" {
			writeJSONError(w, "path id required", http.StatusBadRequest)
			return
		}
		type PathDetail struct {
			ID            string          `json:"id"`
			Slug          string          `json:"slug"`
			TitleVi       string          `json:"titleVi"`
			TitleJa       *string         `json:"titleJa,omitempty"`
			DescriptionVi *string         `json:"descriptionVi,omitempty"`
			DescriptionJa *string         `json:"descriptionJa,omitempty"`
			TargetLevel   *string         `json:"targetLevel,omitempty"`
			DisplayOrder  int             `json:"displayOrder"`
			Status        string          `json:"status"`
			CreatedAt     string          `json:"createdAt"`
			UpdatedAt     string          `json:"updatedAt"`
			Audit         json.RawMessage `json:"audit"`
		}
		var pd PathDetail
		var ca, ua time.Time
		err := db.QueryRow(r.Context(), `SELECT id, slug, title_vi, title_ja, description_vi, description_ja,
			target_level, display_order, status, created_at, updated_at
			FROM learning.learning_path WHERE id = $1`, id).
			Scan(&pd.ID, &pd.Slug, &pd.TitleVi, &pd.TitleJa, &pd.DescriptionVi, &pd.DescriptionJa,
				&pd.TargetLevel, &pd.DisplayOrder, &pd.Status, &ca, &ua)
		if err != nil {
			writeJSONError(w, "learning path not found", http.StatusNotFound)
			return
		}
		pd.CreatedAt = ca.UTC().Format(time.RFC3339)
		pd.UpdatedAt = ua.UTC().Format(time.RFC3339)

		auditRows, _ := db.Query(r.Context(), `SELECT id, action, actor_id, reason, before, after, created_at
			FROM ops.admin_audit_log WHERE target_id = $1 AND target_type = 'learning.learning_path'
			ORDER BY created_at DESC LIMIT 25`, id)
		auditItems := []map[string]any{}
		if auditRows != nil {
			for auditRows.Next() {
				var aid, action, actorID string
				var reason *string
				var before, after json.RawMessage
				var cat time.Time
				if auditRows.Scan(&aid, &action, &actorID, &reason, &before, &after, &cat) == nil {
					item := map[string]any{"id": aid, "action": action, "actorId": actorID, "createdAt": cat.UTC().Format(time.RFC3339)}
					if reason != nil {
						item["reason"] = *reason
					}
					if len(before) > 0 {
						item["before"] = before
					}
					if len(after) > 0 {
						item["after"] = after
					}
					auditItems = append(auditItems, item)
				}
			}
			auditRows.Close()
		}
		pd.Audit, _ = json.Marshal(auditItems)
		writeJSON(w, http.StatusOK, pd)
	}
}

// adminLearningPathCreateHandler implements POST /api/admin/learning/paths.
func adminLearningPathCreateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			Slug          string  `json:"slug"`
			TitleVi       string  `json:"titleVi"`
			TitleJa       *string `json:"titleJa,omitempty"`
			DescriptionVi *string `json:"descriptionVi,omitempty"`
			DescriptionJa *string `json:"descriptionJa,omitempty"`
			TargetLevel   *string `json:"targetLevel,omitempty"`
			DisplayOrder  int     `json:"displayOrder"`
			Reason        string  `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.Slug == "" || req.TitleVi == "" {
			writeJSONError(w, "slug and titleVi required", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		// Check slug uniqueness
		var exists bool
		db.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM learning.learning_path WHERE slug = $1)", req.Slug).Scan(&exists)
		if exists {
			writeJSONError(w, "slug already exists", http.StatusConflict)
			return
		}
		var createdID string
		err := db.QueryRow(ctx, `INSERT INTO learning.learning_path
			(slug, title_vi, title_ja, description_vi, description_ja, target_level, display_order, status, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', NOW(), NOW()) RETURNING id`,
			req.Slug, req.TitleVi, req.TitleJa, req.DescriptionVi, req.DescriptionJa, req.TargetLevel, req.DisplayOrder).Scan(&createdID)
		if err != nil {
			logger.Error("create learning path", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		afterJSON, _ := json.Marshal(map[string]any{"id": createdID, "slug": req.Slug})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('admin.learning.path.created', $1, $2, 'learning.learning_path', $3, $4, NOW())`,
			identity.ActorID, createdID, req.Reason, afterJSON)
		writeJSON(w, http.StatusCreated, map[string]any{"id": createdID, "slug": req.Slug, "status": "draft"})
	}
}

// adminLearningPathPatchHandler implements PATCH /api/admin/learning/paths/{id}.
func adminLearningPathPatchHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "paths", 1)
		if id == "" {
			writeJSONError(w, "path id required", http.StatusBadRequest)
			return
		}
		var req map[string]any
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		setClauses := []string{}
		args := []any{}
		argIdx := 1
		fieldMap := map[string]string{
			"slug": "slug", "titleVi": "title_vi", "titleJa": "title_ja",
			"descriptionVi": "description_vi", "descriptionJa": "description_ja",
			"targetLevel": "target_level", "displayOrder": "display_order",
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
		query := "UPDATE learning.learning_path SET " + joinStrings(setClauses, ", ") + " WHERE id = $" + itoa(argIdx)
		args = append(args, id)
		if _, err := db.Exec(ctx, query, args...); err != nil {
			logger.Error("patch learning path", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		reason, _ := req["reason"].(string)
		afterJSON, _ := json.Marshal(req)
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('admin.learning.path.updated', $1, $2, 'learning.learning_path', $3, $4, NOW())`,
			identity.ActorID, id, reason, afterJSON)
		writeJSON(w, http.StatusOK, map[string]any{"id": id, "updated": true})
	}
}

// adminLearningPathPublishHandler implements POST /api/admin/learning/paths/{id}/publish.
func adminLearningPathPublishHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "paths", 1)
		if id == "" {
			writeJSONError(w, "path id required", http.StatusBadRequest)
			return
		}
		var body struct {
			Reason string `json:"reason"`
		}
		json.NewDecoder(r.Body).Decode(&body)
		ctx := r.Context()
		var currentStatus string
		if err := db.QueryRow(ctx, "SELECT status FROM learning.learning_path WHERE id = $1", id).Scan(&currentStatus); err != nil {
			writeJSONError(w, "learning path not found", http.StatusNotFound)
			return
		}
		if currentStatus == "archived" {
			writeJSONError(w, "cannot publish archived path", http.StatusBadRequest)
			return
		}
		if currentStatus != "published" {
			db.Exec(ctx, "UPDATE learning.learning_path SET status = 'published', updated_at = NOW() WHERE id = $1", id)
		}
		afterJSON, _ := json.Marshal(map[string]any{"status": "published"})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('admin.learning.path.published', $1, $2, 'learning.learning_path', $3, $4, NOW())`,
			identity.ActorID, id, body.Reason, afterJSON)
		writeJSON(w, http.StatusOK, map[string]any{"id": id, "status": "published"})
	}
}

// adminLearningPathArchiveHandler implements POST /api/admin/learning/paths/{id}/archive.
func adminLearningPathArchiveHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "paths", 1)
		if id == "" {
			writeJSONError(w, "path id required", http.StatusBadRequest)
			return
		}
		var body struct {
			Reason string `json:"reason"`
		}
		json.NewDecoder(r.Body).Decode(&body)
		ctx := r.Context()
		db.Exec(ctx, "UPDATE learning.learning_path SET status = 'archived', updated_at = NOW() WHERE id = $1", id)
		afterJSON, _ := json.Marshal(map[string]any{"status": "archived"})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('admin.learning.path.archived', $1, $2, 'learning.learning_path', $3, $4, NOW())`,
			identity.ActorID, id, body.Reason, afterJSON)
		writeJSON(w, http.StatusOK, map[string]any{"id": id, "status": "archived"})
	}
}

// adminLearningPathDuplicateHandler implements POST /api/admin/learning/paths/{id}/duplicate.
func adminLearningPathDuplicateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "paths", 1)
		if id == "" {
			writeJSONError(w, "path id required", http.StatusBadRequest)
			return
		}
		var body struct {
			Reason string `json:"reason"`
		}
		json.NewDecoder(r.Body).Decode(&body)
		ctx := r.Context()
		type Src struct {
			Slug          string
			TitleVi       string
			TitleJa       *string
			DescriptionVi *string
			DescriptionJa *string
			TargetLevel   *string
			DisplayOrder  int
		}
		var src Src
		if err := db.QueryRow(ctx, `SELECT slug, title_vi, title_ja, description_vi, description_ja,
			target_level, display_order FROM learning.learning_path WHERE id = $1`, id).
			Scan(&src.Slug, &src.TitleVi, &src.TitleJa, &src.DescriptionVi, &src.DescriptionJa, &src.TargetLevel, &src.DisplayOrder); err != nil {
			writeJSONError(w, "learning path not found", http.StatusNotFound)
			return
		}
		newSlug := src.Slug + "-copy"
		newTitleVi := src.TitleVi + " (copy)"
		var newID string
		err := db.QueryRow(ctx, `INSERT INTO learning.learning_path
			(slug, title_vi, title_ja, description_vi, description_ja, target_level, display_order, status, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', NOW(), NOW()) RETURNING id`,
			newSlug, newTitleVi, src.TitleJa, src.DescriptionVi, src.DescriptionJa, src.TargetLevel, src.DisplayOrder).Scan(&newID)
		if err != nil {
			logger.Error("duplicate learning path", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		afterJSON, _ := json.Marshal(map[string]any{"newId": newID, "slug": newSlug, "sourceId": id})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('admin.learning.path.duplicated', $1, $2, 'learning.learning_path', $3, $4, NOW())`,
			identity.ActorID, newID, body.Reason, afterJSON)
		writeJSON(w, http.StatusCreated, map[string]any{"id": newID, "slug": newSlug, "status": "draft"})
	}
}

// adminLearningPathDeleteHandler implements DELETE /api/admin/learning/paths/{id}.
func adminLearningPathDeleteHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "paths", 1)
		if id == "" {
			writeJSONError(w, "path id required", http.StatusBadRequest)
			return
		}
		var body struct {
			Reason string `json:"reason"`
		}
		json.NewDecoder(r.Body).Decode(&body)
		ctx := r.Context()
		var currentStatus string
		if err := db.QueryRow(ctx, "SELECT status FROM learning.learning_path WHERE id = $1", id).Scan(&currentStatus); err != nil {
			writeJSONError(w, "learning path not found", http.StatusNotFound)
			return
		}
		if currentStatus != "draft" {
			writeJSONError(w, "only draft paths can be deleted", http.StatusBadRequest)
			return
		}
		db.Exec(ctx, "DELETE FROM learning.learning_path WHERE id = $1", id)
		beforeJSON, _ := json.Marshal(map[string]any{"id": id, "status": currentStatus})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, before, created_at)
			VALUES ('admin.learning.path.deleted', $1, $2, 'learning.learning_path', $3, $4, NOW())`,
			identity.ActorID, id, body.Reason, beforeJSON)
		writeJSON(w, http.StatusOK, map[string]any{"deleted": true, "id": id})
	}
}

// ── Competencies ────────────────────────────────────────────────────────────

// adminCompetenciesListHandler implements GET /api/admin/learning/competencies.
func adminCompetenciesListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query().Get("q")
		status := r.URL.Query().Get("status")
		level := r.URL.Query().Get("level")
		page := queryInt(r, "page", 1)
		pageSize := queryInt(r, "pageSize", 25)
		if page < 1 {
			page = 1
		}
		if pageSize < 1 || pageSize > 100 {
			pageSize = 25
		}
		offset := (page - 1) * pageSize

		whereParts := []string{}
		args := []any{}
		argIdx := 1
		if q != "" {
			pattern := "%" + q + "%"
			whereParts = append(whereParts, fmt.Sprintf("(code ILIKE $%[1]d OR title_vi ILIKE $%[1]d OR title_ja ILIKE $%[1]d)", argIdx))
			args = append(args, pattern)
			argIdx++
		}
		if status != "" {
			whereParts = append(whereParts, fmt.Sprintf("status = $%d", argIdx))
			args = append(args, status)
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
		db.QueryRow(r.Context(), "SELECT COUNT(*) FROM learning.competency "+whereClause, args...).Scan(&total)

		dataQ := fmt.Sprintf(`SELECT id, code, title_vi, title_ja, description_vi, level, status, created_at, updated_at
			FROM learning.competency %s ORDER BY status ASC, level ASC, updated_at DESC LIMIT $%d OFFSET $%d`,
			whereClause, argIdx, argIdx+1)
		args = append(args, pageSize, offset)

		rows, err := db.Query(r.Context(), dataQ, args...)
		if err != nil {
			logger.Error("list competencies", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type Comp struct {
			ID            string  `json:"id"`
			Code          string  `json:"code"`
			TitleVi       string  `json:"titleVi"`
			TitleJa       *string `json:"titleJa,omitempty"`
			DescriptionVi *string `json:"descriptionVi,omitempty"`
			Level         string  `json:"level"`
			Status        string  `json:"status"`
			CreatedAt     string  `json:"createdAt"`
			UpdatedAt     string  `json:"updatedAt"`
		}
		var items []Comp
		for rows.Next() {
			var c Comp
			var ca, ua time.Time
			if rows.Scan(&c.ID, &c.Code, &c.TitleVi, &c.TitleJa, &c.DescriptionVi, &c.Level, &c.Status, &ca, &ua) == nil {
				c.CreatedAt = ca.UTC().Format(time.RFC3339)
				c.UpdatedAt = ua.UTC().Format(time.RFC3339)
				items = append(items, c)
			}
		}
		if items == nil {
			items = []Comp{}
		}

		statusCounts := map[string]int{}
		scRows, _ := db.Query(r.Context(), "SELECT status, COUNT(*) FROM learning.competency GROUP BY status")
		if scRows != nil {
			for scRows.Next() {
				var s string
				var cnt int
				if scRows.Scan(&s, &cnt) == nil {
					statusCounts[s] = cnt
				}
			}
			scRows.Close()
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"items":        items,
			"page":         page,
			"pageSize":     pageSize,
			"total":        total,
			"statusCounts": statusCounts,
		})
	}
}

// adminCompetencyDetailHandler implements GET /api/admin/learning/competencies/{id}.
func adminCompetencyDetailHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := extractPathParam(r.URL.Path, "competencies", 1)
		if id == "" {
			writeJSONError(w, "competency id required", http.StatusBadRequest)
			return
		}
		type Detail struct {
			ID            string          `json:"id"`
			Code          string          `json:"code"`
			TitleVi       string          `json:"titleVi"`
			TitleJa       *string         `json:"titleJa,omitempty"`
			DescriptionVi *string         `json:"descriptionVi,omitempty"`
			Level         string          `json:"level"`
			Status        string          `json:"status"`
			CreatedAt     string          `json:"createdAt"`
			UpdatedAt     string          `json:"updatedAt"`
			Audit         json.RawMessage `json:"audit"`
		}
		var d Detail
		var ca, ua time.Time
		err := db.QueryRow(r.Context(), `SELECT id, code, title_vi, title_ja, description_vi, level, status, created_at, updated_at
			FROM learning.competency WHERE id = $1`, id).
			Scan(&d.ID, &d.Code, &d.TitleVi, &d.TitleJa, &d.DescriptionVi, &d.Level, &d.Status, &ca, &ua)
		if err != nil {
			writeJSONError(w, "competency not found", http.StatusNotFound)
			return
		}
		d.CreatedAt = ca.UTC().Format(time.RFC3339)
		d.UpdatedAt = ua.UTC().Format(time.RFC3339)

		auditRows, _ := db.Query(r.Context(), `SELECT id, action, actor_id, reason, before, after, created_at
			FROM ops.admin_audit_log WHERE target_id = $1 AND target_type = 'learning.competency'
			ORDER BY created_at DESC LIMIT 25`, id)
		auditItems := []map[string]any{}
		if auditRows != nil {
			for auditRows.Next() {
				var aid, action, actorID string
				var reason *string
				var before, after json.RawMessage
				var cat time.Time
				if auditRows.Scan(&aid, &action, &actorID, &reason, &before, &after, &cat) == nil {
					item := map[string]any{"id": aid, "action": action, "actorId": actorID, "createdAt": cat.UTC().Format(time.RFC3339)}
					if reason != nil {
						item["reason"] = *reason
					}
					if len(before) > 0 {
						item["before"] = before
					}
					if len(after) > 0 {
						item["after"] = after
					}
					auditItems = append(auditItems, item)
				}
			}
			auditRows.Close()
		}
		d.Audit, _ = json.Marshal(auditItems)
		writeJSON(w, http.StatusOK, d)
	}
}

// adminCompetencyCreateHandler implements POST /api/admin/learning/competencies.
func adminCompetencyCreateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			Code          string  `json:"code"`
			TitleVi       string  `json:"titleVi"`
			TitleJa       *string `json:"titleJa,omitempty"`
			DescriptionVi *string `json:"descriptionVi,omitempty"`
			Level         string  `json:"level"`
			Reason        string  `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.Code == "" || req.TitleVi == "" || req.Level == "" {
			writeJSONError(w, "code, titleVi, and level required", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		var exists bool
		db.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM learning.competency WHERE code = $1)", req.Code).Scan(&exists)
		if exists {
			writeJSONError(w, "code already exists", http.StatusConflict)
			return
		}
		var createdID string
		err := db.QueryRow(ctx, `INSERT INTO learning.competency
			(code, title_vi, title_ja, description_vi, level, status, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, 'draft', NOW(), NOW()) RETURNING id`,
			req.Code, req.TitleVi, req.TitleJa, req.DescriptionVi, req.Level).Scan(&createdID)
		if err != nil {
			logger.Error("create competency", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		afterJSON, _ := json.Marshal(map[string]any{"id": createdID, "code": req.Code})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('admin.learning.competency.created', $1, $2, 'learning.competency', $3, $4, NOW())`,
			identity.ActorID, createdID, req.Reason, afterJSON)
		writeJSON(w, http.StatusCreated, map[string]any{"id": createdID, "code": req.Code, "status": "draft"})
	}
}

// adminCompetencyPatchHandler implements PATCH /api/admin/learning/competencies/{id}.
func adminCompetencyPatchHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "competencies", 1)
		if id == "" {
			writeJSONError(w, "competency id required", http.StatusBadRequest)
			return
		}
		var req map[string]any
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		setClauses := []string{}
		args := []any{}
		argIdx := 1
		fieldMap := map[string]string{
			"code": "code", "titleVi": "title_vi", "titleJa": "title_ja",
			"descriptionVi": "description_vi", "level": "level",
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
		query := "UPDATE learning.competency SET " + joinStrings(setClauses, ", ") + " WHERE id = $" + itoa(argIdx)
		args = append(args, id)
		if _, err := db.Exec(ctx, query, args...); err != nil {
			logger.Error("patch competency", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		reason, _ := req["reason"].(string)
		afterJSON, _ := json.Marshal(req)
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('admin.learning.competency.updated', $1, $2, 'learning.competency', $3, $4, NOW())`,
			identity.ActorID, id, reason, afterJSON)
		writeJSON(w, http.StatusOK, map[string]any{"id": id, "updated": true})
	}
}

// adminCompetencyPublishHandler implements POST /api/admin/learning/competencies/{id}/publish.
func adminCompetencyPublishHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "competencies", 1)
		if id == "" {
			writeJSONError(w, "competency id required", http.StatusBadRequest)
			return
		}
		var body struct {
			Reason string `json:"reason"`
		}
		json.NewDecoder(r.Body).Decode(&body)
		ctx := r.Context()
		var currentStatus string
		if err := db.QueryRow(ctx, "SELECT status FROM learning.competency WHERE id = $1", id).Scan(&currentStatus); err != nil {
			writeJSONError(w, "competency not found", http.StatusNotFound)
			return
		}
		if currentStatus == "archived" {
			writeJSONError(w, "cannot publish archived competency", http.StatusBadRequest)
			return
		}
		if currentStatus != "published" {
			db.Exec(ctx, "UPDATE learning.competency SET status = 'published', updated_at = NOW() WHERE id = $1", id)
		}
		afterJSON, _ := json.Marshal(map[string]any{"status": "published"})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('admin.learning.competency.published', $1, $2, 'learning.competency', $3, $4, NOW())`,
			identity.ActorID, id, body.Reason, afterJSON)
		writeJSON(w, http.StatusOK, map[string]any{"id": id, "status": "published"})
	}
}

// adminCompetencyArchiveHandler implements POST /api/admin/learning/competencies/{id}/archive.
func adminCompetencyArchiveHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "competencies", 1)
		if id == "" {
			writeJSONError(w, "competency id required", http.StatusBadRequest)
			return
		}
		var body struct {
			Reason string `json:"reason"`
		}
		json.NewDecoder(r.Body).Decode(&body)
		ctx := r.Context()
		db.Exec(ctx, "UPDATE learning.competency SET status = 'archived', updated_at = NOW() WHERE id = $1", id)
		afterJSON, _ := json.Marshal(map[string]any{"status": "archived"})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('admin.learning.competency.archived', $1, $2, 'learning.competency', $3, $4, NOW())`,
			identity.ActorID, id, body.Reason, afterJSON)
		writeJSON(w, http.StatusOK, map[string]any{"id": id, "status": "archived"})
	}
}

// adminCompetencyDeleteHandler implements DELETE /api/admin/learning/competencies/{id}.
func adminCompetencyDeleteHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "competencies", 1)
		if id == "" {
			writeJSONError(w, "competency id required", http.StatusBadRequest)
			return
		}
		var body struct {
			Reason string `json:"reason"`
		}
		json.NewDecoder(r.Body).Decode(&body)
		ctx := r.Context()
		var currentStatus string
		if err := db.QueryRow(ctx, "SELECT status FROM learning.competency WHERE id = $1", id).Scan(&currentStatus); err != nil {
			writeJSONError(w, "competency not found", http.StatusNotFound)
			return
		}
		if currentStatus != "draft" {
			writeJSONError(w, "only draft competencies can be deleted", http.StatusBadRequest)
			return
		}
		db.Exec(ctx, "DELETE FROM learning.competency WHERE id = $1", id)
		beforeJSON, _ := json.Marshal(map[string]any{"id": id, "status": currentStatus})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, before, created_at)
			VALUES ('admin.learning.competency.deleted', $1, $2, 'learning.competency', $3, $4, NOW())`,
			identity.ActorID, id, body.Reason, beforeJSON)
		writeJSON(w, http.StatusOK, map[string]any{"deleted": true, "id": id})
	}
}

// ── Learning Review ─────────────────────────────────────────────────────────

// adminLearningReviewSummaryHandler implements GET /api/admin/learning/review/summary.
func adminLearningReviewSummaryHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		windowDays := queryInt(r, "windowDays", 30)
		if windowDays < 1 {
			windowDays = 30
		}
		type Summary struct {
			WindowDays      int              `json:"windowDays"`
			TotalCards      int              `json:"totalCards"`
			DueNow          int              `json:"dueNow"`
			Leeched         int              `json:"leeched"`
			ReviewsTotal    int              `json:"reviewsTotal"`
			ReviewsByRating map[string]int   `json:"reviewsByRating"`
			RetentionPct    *float64         `json:"retentionPct,omitempty"`
			AvgEaseFactor   *float64         `json:"avgEaseFactor,omitempty"`
			AvgLapses       *float64         `json:"avgLapses,omitempty"`
			AvgIntervalDays *float64         `json:"avgIntervalDays,omitempty"`
		}
		var s Summary
		s.WindowDays = windowDays
		s.ReviewsByRating = map[string]int{}

		db.QueryRow(r.Context(), "SELECT COUNT(*) FROM learning.user_flashcard").Scan(&s.TotalCards)
		db.QueryRow(r.Context(), "SELECT COUNT(*) FROM learning.user_flashcard WHERE due_at <= NOW()").Scan(&s.DueNow)
		db.QueryRow(r.Context(), "SELECT COUNT(*) FROM learning.user_flashcard WHERE leeched = true").Scan(&s.Leeched)

		interval := fmt.Sprintf("%d days", windowDays)
		db.QueryRow(r.Context(), "SELECT COUNT(*) FROM learning.review_event WHERE reviewed_at >= NOW() - $1::interval", interval).Scan(&s.ReviewsTotal)

		ratingRows, _ := db.Query(r.Context(), "SELECT rating, COUNT(*) FROM learning.review_event WHERE reviewed_at >= NOW() - $1::interval GROUP BY rating", interval)
		if ratingRows != nil {
			for ratingRows.Next() {
				var rating string
				var cnt int
				if ratingRows.Scan(&rating, &cnt) == nil {
					s.ReviewsByRating[rating] = cnt
				}
			}
			ratingRows.Close()
		}

		goodCount := s.ReviewsByRating["good"] + s.ReviewsByRating["easy"]
		if s.ReviewsTotal > 0 {
			pct := float64(goodCount) / float64(s.ReviewsTotal) * 100
			s.RetentionPct = &pct
		}

		db.QueryRow(r.Context(), "SELECT AVG(ease_factor), AVG(lapses), AVG(interval_days) FROM learning.user_flashcard").
			Scan(&s.AvgEaseFactor, &s.AvgLapses, &s.AvgIntervalDays)

		writeJSON(w, http.StatusOK, s)
	}
}

// adminLearningReviewRetentionCurveHandler implements GET /api/admin/learning/review/retention-curve.
func adminLearningReviewRetentionCurveHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		windowDays := queryInt(r, "windowDays", 30)
		if windowDays < 1 {
			windowDays = 30
		}
		interval := fmt.Sprintf("%d days", windowDays)
		rows, err := db.Query(r.Context(), `SELECT date_trunc('day', reviewed_at)::date AS day,
			COUNT(*)::int AS total,
			SUM(CASE WHEN rating IN ('good','easy') THEN 1 ELSE 0 END)::int AS good
			FROM learning.review_event WHERE reviewed_at >= NOW() - $1::interval
			GROUP BY 1 ORDER BY 1 ASC`, interval)
		if err != nil {
			logger.Error("retention curve", "error", err)
			writeJSON(w, http.StatusOK, []any{})
			return
		}
		defer rows.Close()

		type Point struct {
			Day          string   `json:"day"`
			Total        int      `json:"total"`
			Good         int      `json:"good"`
			RetentionPct *float64 `json:"retentionPct,omitempty"`
		}
		var points []Point
		for rows.Next() {
			var p Point
			var day time.Time
			if rows.Scan(&day, &p.Total, &p.Good) == nil {
				p.Day = day.Format("2006-01-02")
				if p.Total > 0 {
					pct := float64(p.Good) / float64(p.Total) * 100
					p.RetentionPct = &pct
				}
				points = append(points, p)
			}
		}
		if points == nil {
			points = []Point{}
		}
		writeJSON(w, http.StatusOK, points)
	}
}

// adminLearningReviewProblemCardsHandler implements GET /api/admin/learning/review/problem-cards.
func adminLearningReviewProblemCardsHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query().Get("q")
		minLapses := queryInt(r, "minLapses", 2)
		_ = queryInt(r, "maxRetention", 60) // reserved for post-filter; NestJS applies client-side
		leeched := r.URL.Query().Get("leeched")
		page := queryInt(r, "page", 1)
		pageSize := queryInt(r, "pageSize", 25)
		if page < 1 {
			page = 1
		}
		if pageSize < 1 || pageSize > 100 {
			pageSize = 25
		}
		offset := (page - 1) * pageSize

		whereParts := []string{fmt.Sprintf("uf.lapses >= $1")}
		args := []any{minLapses}
		argIdx := 2
		if leeched == "leeched" {
			whereParts = append(whereParts, fmt.Sprintf("uf.leeched = $%d", argIdx))
			args = append(args, true)
			argIdx++
		} else if leeched == "non_leeched" {
			whereParts = append(whereParts, fmt.Sprintf("uf.leeched = $%d", argIdx))
			args = append(args, false)
			argIdx++
		}
		if q != "" {
			pattern := "%" + q + "%"
			whereParts = append(whereParts, fmt.Sprintf("(fv.front_text ILIKE $%[1]d OR fv.back_text ILIKE $%[1]d)", argIdx))
			args = append(args, pattern)
			argIdx++
		}
		whereClause := "WHERE " + strings.Join(whereParts, " AND ")

		var total int
		countQ := "SELECT COUNT(*) FROM learning.user_flashcard uf LEFT JOIN learning.deck_card c ON c.id = uf.card_id LEFT JOIN learning.flashcard_variant fv ON fv.id = c.card_id " + whereClause
		db.QueryRow(r.Context(), countQ, args...).Scan(&total)

		dataQ := fmt.Sprintf(`SELECT uf.id, uf.card_id, uf.lapses, uf.leeched, uf.state, uf.ease_factor, uf.interval_days,
			fv.front_text, fv.back_text, fv.reading
			FROM learning.user_flashcard uf LEFT JOIN learning.deck_card c ON c.id = uf.card_id LEFT JOIN learning.flashcard_variant fv ON fv.id = c.card_id
			%s ORDER BY uf.lapses DESC, uf.updated_at DESC LIMIT $%d OFFSET $%d`,
			whereClause, argIdx, argIdx+1)
		args = append(args, pageSize, offset)

		rows, err := db.Query(r.Context(), dataQ, args...)
		if err != nil {
			logger.Error("problem cards", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type ProblemCard struct {
			ID                  string   `json:"id"`
			CardID              string   `json:"cardId"`
			Lapses              int      `json:"lapses"`
			Leeched             bool     `json:"leeched"`
			State               string   `json:"state"`
			EaseFactor          float64  `json:"easeFactor"`
			IntervalDays        int      `json:"intervalDays"`
			FrontText           *string  `json:"frontText,omitempty"`
			BackText            *string  `json:"backText,omitempty"`
			Reading             *string  `json:"reading,omitempty"`
			RecentReviews       int      `json:"recentReviews"`
			RecentRetentionPct  *float64 `json:"recentRetentionPct,omitempty"`
		}
		var items []ProblemCard
		for rows.Next() {
			var pc ProblemCard
			if rows.Scan(&pc.ID, &pc.CardID, &pc.Lapses, &pc.Leeched, &pc.State, &pc.EaseFactor, &pc.IntervalDays,
				&pc.FrontText, &pc.BackText, &pc.Reading) == nil {
				items = append(items, pc)
			}
		}
		if items == nil {
			items = []ProblemCard{}
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": items, "total": total, "page": page, "pageSize": pageSize})
	}
}

// adminLearningReviewCardDetailHandler implements GET /api/admin/learning/review/cards/{id}.
func adminLearningReviewCardDetailHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := extractPathParam(r.URL.Path, "cards", 1)
		if id == "" {
			writeJSONError(w, "card id required", http.StatusBadRequest)
			return
		}
		type CardDetail struct {
			ID           string          `json:"id"`
			CardID       string          `json:"cardId"`
			UserID       string          `json:"userId"`
			State        string          `json:"state"`
			Lapses       int             `json:"lapses"`
			Leeched      bool            `json:"leeched"`
			EaseFactor   float64         `json:"easeFactor"`
			IntervalDays int             `json:"intervalDays"`
			Repetitions  int             `json:"repetitions"`
			DueAt        *string         `json:"dueAt,omitempty"`
			FrontText    *string         `json:"frontText,omitempty"`
			BackText     *string         `json:"backText,omitempty"`
			Reading      *string         `json:"reading,omitempty"`
			Reviews      json.RawMessage `json:"reviews"`
			Audit        json.RawMessage `json:"audit"`
		}
		var cd CardDetail
		var dueAt *time.Time
		err := db.QueryRow(r.Context(), `SELECT uf.id, uf.card_id, uf.user_id, uf.state, uf.lapses, uf.leeched,
			uf.ease_factor, uf.interval_days, uf.repetitions, uf.due_at,
			fv.front_text, fv.back_text, fv.reading
			FROM learning.user_flashcard uf LEFT JOIN learning.deck_card c ON c.id = uf.card_id LEFT JOIN learning.flashcard_variant fv ON fv.id = c.card_id
			WHERE uf.id = $1`, id).
			Scan(&cd.ID, &cd.CardID, &cd.UserID, &cd.State, &cd.Lapses, &cd.Leeched,
				&cd.EaseFactor, &cd.IntervalDays, &cd.Repetitions, &dueAt,
				&cd.FrontText, &cd.BackText, &cd.Reading)
		if err != nil {
			writeJSONError(w, "user flashcard not found", http.StatusNotFound)
			return
		}
		if dueAt != nil {
			s := dueAt.UTC().Format(time.RFC3339)
			cd.DueAt = &s
		}

		// Recent reviews
		reviewRows, _ := db.Query(r.Context(), `SELECT id, rating, response_ms, reviewed_at
			FROM learning.review_event WHERE user_flashcard_id = $1 ORDER BY reviewed_at DESC LIMIT 30`, id)
		reviews := []map[string]any{}
		if reviewRows != nil {
			for reviewRows.Next() {
				var rid, rating string
				var responseMs *int
				var rat time.Time
				if reviewRows.Scan(&rid, &rating, &responseMs, &rat) == nil {
					item := map[string]any{"id": rid, "rating": rating, "reviewedAt": rat.UTC().Format(time.RFC3339)}
					if responseMs != nil {
						item["responseMs"] = *responseMs
					}
					reviews = append(reviews, item)
				}
			}
			reviewRows.Close()
		}
		cd.Reviews, _ = json.Marshal(reviews)

		// Audit
		auditRows, _ := db.Query(r.Context(), `SELECT id, action, actor_id, reason, before, after, created_at
			FROM ops.admin_audit_log WHERE target_id = $1 AND target_type = 'learning.user_flashcard'
			ORDER BY created_at DESC LIMIT 25`, id)
		auditItems := []map[string]any{}
		if auditRows != nil {
			for auditRows.Next() {
				var aid, action, actorID string
				var reason *string
				var before, after json.RawMessage
				var cat time.Time
				if auditRows.Scan(&aid, &action, &actorID, &reason, &before, &after, &cat) == nil {
					item := map[string]any{"id": aid, "action": action, "actorId": actorID, "createdAt": cat.UTC().Format(time.RFC3339)}
					if reason != nil {
						item["reason"] = *reason
					}
					if len(before) > 0 {
						item["before"] = before
					}
					if len(after) > 0 {
						item["after"] = after
					}
					auditItems = append(auditItems, item)
				}
			}
			auditRows.Close()
		}
		cd.Audit, _ = json.Marshal(auditItems)
		writeJSON(w, http.StatusOK, cd)
	}
}

// adminLearningReviewForceReintroduceHandler implements POST /api/admin/learning/review/cards/{id}/force-reintroduce.
func adminLearningReviewForceReintroduceHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
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
		var body struct {
			Reason string `json:"reason"`
		}
		json.NewDecoder(r.Body).Decode(&body)
		ctx := r.Context()

		var exists bool
		db.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM learning.user_flashcard WHERE id = $1)", id).Scan(&exists)
		if !exists {
			writeJSONError(w, "user flashcard not found", http.StatusNotFound)
			return
		}

		_, err := db.Exec(ctx, `UPDATE learning.user_flashcard
			SET due_at = NOW(), interval_days = 0, repetitions = 0, state = 'relearning', updated_at = NOW()
			WHERE id = $1`, id)
		if err != nil {
			logger.Error("force reintroduce", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		afterJSON, _ := json.Marshal(map[string]any{"state": "relearning", "intervalDays": 0, "dueAt": "now"})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('admin.learning.review.force_reintroduce', $1, $2, 'learning.user_flashcard', $3, $4, NOW())`,
			identity.ActorID, id, body.Reason, afterJSON)
		writeJSON(w, http.StatusOK, map[string]any{"id": id, "reintroduced": true})
	}
}