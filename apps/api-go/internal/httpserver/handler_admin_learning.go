package httpserver

import (
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
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
		tx, err := db.Begin(ctx)
		if err != nil {
			logger.Error("begin patch learning path", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(ctx)
		tag, err := tx.Exec(ctx, query, args...)
		if err != nil {
			logger.Error("patch learning path", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if tag.RowsAffected() == 0 {
			writeJSONError(w, "learning path not found", http.StatusNotFound)
			return
		}
		reason, _ := req["reason"].(string)
		afterJSON, _ := json.Marshal(req)
		if _, err := tx.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('admin.learning.path.updated', $1, $2, 'learning.learning_path', $3, $4, NOW())`,
			identity.ActorID, id, reason, afterJSON); err != nil {
			logger.Error("audit patch learning path", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			logger.Error("commit patch learning path", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
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
		tx, err := db.Begin(ctx)
		if err != nil {
			logger.Error("begin archive learning path", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(ctx)
		tag, err := tx.Exec(ctx, "UPDATE learning.learning_path SET status = 'archived', updated_at = NOW() WHERE id = $1", id)
		if err != nil {
			logger.Error("archive learning path", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if tag.RowsAffected() == 0 {
			writeJSONError(w, "learning path not found", http.StatusNotFound)
			return
		}
		afterJSON, _ := json.Marshal(map[string]any{"status": "archived"})
		if _, err := tx.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('admin.learning.path.archived', $1, $2, 'learning.learning_path', $3, $4, NOW())`,
			identity.ActorID, id, body.Reason, afterJSON); err != nil {
			logger.Error("audit archive learning path", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			logger.Error("commit archive learning path", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
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
func validCompetencyLevel(level string) bool {
	switch level {
	case "beginner", "intermediate", "advanced", "BJT-J5", "BJT-J4", "BJT-J3", "BJT-J2", "BJT-J1":
		return true
	default:
		return false
	}
}

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
		req.Code, req.TitleVi, req.Level, req.Reason = strings.TrimSpace(req.Code), strings.TrimSpace(req.TitleVi), strings.TrimSpace(req.Level), strings.TrimSpace(req.Reason)
		if req.Code == "" || req.TitleVi == "" || req.Reason == "" || !validCompetencyLevel(req.Level) {
			writeJSONError(w, "valid code, titleVi, level, and reason required", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		tx, err := db.Begin(ctx)
		if err != nil {
			logger.Error("begin competency create", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(ctx)
		var createdID string
		var before json.RawMessage
		err = tx.QueryRow(ctx, `SELECT to_jsonb(c) FROM learning.competency c WHERE code=$1`, req.Code).Scan(&before)
		if err == nil {
			writeJSONError(w, "code already exists", http.StatusConflict)
			return
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			logger.Error("check competency code", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		err = tx.QueryRow(ctx, `INSERT INTO learning.competency
			(code, title_vi, title_ja, description_vi, level, status, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, 'draft', NOW(), NOW()) RETURNING id`,
			req.Code, req.TitleVi, req.TitleJa, req.DescriptionVi, req.Level).Scan(&createdID)
		if err != nil {
			logger.Error("create competency", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		var after json.RawMessage
		if err := tx.QueryRow(ctx, `SELECT to_jsonb(c) FROM learning.competency c WHERE id=$1`, createdID).Scan(&after); err != nil {
			logger.Error("read created competency", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := writeAdminAuditWithReason(ctx, tx, identity.ActorID, "admin.learning.competency.created", "learning.competency", createdID, req.Reason, nil, after); err != nil {
			logger.Error("audit competency create", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			logger.Error("commit competency create", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		var stored struct {
			ID            string    `json:"id"`
			Code          string    `json:"code"`
			TitleVi       string    `json:"title_vi"`
			TitleJa       *string   `json:"title_ja"`
			DescriptionVi *string   `json:"description_vi"`
			Level         string    `json:"level"`
			Status        string    `json:"status"`
			CreatedAt     time.Time `json:"created_at"`
			UpdatedAt     time.Time `json:"updated_at"`
		}
		if err := json.Unmarshal(after, &stored); err != nil {
			logger.Error("decode created competency", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusCreated, map[string]any{"id": stored.ID, "code": stored.Code, "titleVi": stored.TitleVi, "titleJa": stored.TitleJa, "descriptionVi": stored.DescriptionVi, "level": stored.Level, "status": stored.Status, "createdAt": stored.CreatedAt.UTC().Format(time.RFC3339), "updatedAt": stored.UpdatedAt.UTC().Format(time.RFC3339), "audit": []any{}})
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
		reason, _ := req["reason"].(string)
		reason = strings.TrimSpace(reason)
		if len([]rune(reason)) < 3 {
			writeJSONError(w, "reason is required", http.StatusBadRequest)
			return
		}
		fieldMap := []struct{ key, column string }{{"code", "code"}, {"titleVi", "title_vi"}, {"titleJa", "title_ja"}, {"descriptionVi", "description_vi"}, {"level", "level"}}
		setClauses, args := []string{}, []any{}
		for _, field := range fieldMap {
			if value, exists := req[field.key]; exists {
				if value != nil {
					text, ok := value.(string)
					if !ok || ((field.key == "code" || field.key == "titleVi") && strings.TrimSpace(text) == "") || (field.key == "level" && !validCompetencyLevel(strings.TrimSpace(text))) {
						writeJSONError(w, "invalid "+field.key, http.StatusBadRequest)
						return
					}
					value = strings.TrimSpace(text)
				}
				setClauses = append(setClauses, field.column+" = $"+itoa(len(args)+1))
				args = append(args, value)
			}
		}
		if len(setClauses) == 0 {
			writeJSONError(w, "at least one field to update is required", http.StatusBadRequest)
			return
		}
		tx, err := db.Begin(ctx)
		if err != nil {
			logger.Error("begin competency patch", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(ctx)
		var before json.RawMessage
		if err := tx.QueryRow(ctx, `SELECT to_jsonb(c) FROM learning.competency c WHERE id=$1 FOR UPDATE`, id).Scan(&before); errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "competency not found", http.StatusNotFound)
			return
		} else if err != nil {
			logger.Error("load competency", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		setClauses = append(setClauses, "updated_at = NOW()")
		query := "UPDATE learning.competency SET " + joinStrings(setClauses, ", ") + " WHERE id = $" + itoa(len(args)+1)
		args = append(args, id)
		if _, err := tx.Exec(ctx, query, args...); err != nil {
			logger.Error("patch competency", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		var after json.RawMessage
		if err := tx.QueryRow(ctx, `SELECT to_jsonb(c) FROM learning.competency c WHERE id=$1`, id).Scan(&after); err != nil {
			logger.Error("read patched competency", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := writeAdminAuditWithReason(ctx, tx, identity.ActorID, "admin.learning.competency.updated", "learning.competency", id, reason, before, after); err != nil {
			logger.Error("audit competency patch", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			logger.Error("commit competency patch", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
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
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		body.Reason = strings.TrimSpace(body.Reason)
		if len([]rune(body.Reason)) < 3 {
			writeJSONError(w, "reason is required", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		tx, err := db.Begin(ctx)
		if err != nil {
			logger.Error("begin competency publish", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(ctx)
		var currentStatus string
		var before json.RawMessage
		if err := tx.QueryRow(ctx, "SELECT status,to_jsonb(c) FROM learning.competency c WHERE id=$1 FOR UPDATE", id).Scan(&currentStatus, &before); errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "competency not found", http.StatusNotFound)
			return
		} else if err != nil {
			logger.Error("load competency for publish", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if currentStatus == "archived" {
			writeJSONError(w, "cannot publish archived competency", http.StatusBadRequest)
			return
		}
		if currentStatus != "published" {
			if _, err := tx.Exec(ctx, "UPDATE learning.competency SET status='published',updated_at=NOW() WHERE id=$1", id); err != nil {
				logger.Error("publish competency", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
		}
		var after json.RawMessage
		if err := tx.QueryRow(ctx, "SELECT to_jsonb(c) FROM learning.competency c WHERE id=$1", id).Scan(&after); err != nil {
			logger.Error("read published competency", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := writeAdminAuditWithReason(ctx, tx, identity.ActorID, "admin.learning.competency.published", "learning.competency", id, body.Reason, before, after); err != nil {
			logger.Error("audit competency publish", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			logger.Error("commit competency publish", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
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
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		body.Reason = strings.TrimSpace(body.Reason)
		if len([]rune(body.Reason)) < 3 {
			writeJSONError(w, "reason is required", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		tx, err := db.Begin(ctx)
		if err != nil {
			logger.Error("begin competency archive", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(ctx)
		var before json.RawMessage
		if err := tx.QueryRow(ctx, "SELECT to_jsonb(c) FROM learning.competency c WHERE id=$1 FOR UPDATE", id).Scan(&before); errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "competency not found", http.StatusNotFound)
			return
		} else if err != nil {
			logger.Error("load competency for archive", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if _, err := tx.Exec(ctx, "UPDATE learning.competency SET status='archived',updated_at=NOW() WHERE id=$1", id); err != nil {
			logger.Error("archive competency", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		var after json.RawMessage
		if err := tx.QueryRow(ctx, "SELECT to_jsonb(c) FROM learning.competency c WHERE id=$1", id).Scan(&after); err != nil {
			logger.Error("read archived competency", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := writeAdminAuditWithReason(ctx, tx, identity.ActorID, "admin.learning.competency.archived", "learning.competency", id, body.Reason, before, after); err != nil {
			logger.Error("audit competency archive", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			logger.Error("commit competency archive", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
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
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		body.Reason = strings.TrimSpace(body.Reason)
		if len([]rune(body.Reason)) < 3 {
			writeJSONError(w, "reason is required", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		tx, err := db.Begin(ctx)
		if err != nil {
			logger.Error("begin competency delete", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(ctx)
		var currentStatus string
		var before json.RawMessage
		if err := tx.QueryRow(ctx, "SELECT status,to_jsonb(c) FROM learning.competency c WHERE id=$1 FOR UPDATE", id).Scan(&currentStatus, &before); errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "competency not found", http.StatusNotFound)
			return
		} else if err != nil {
			logger.Error("load competency for delete", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if currentStatus != "draft" {
			writeJSONError(w, "only draft competencies can be deleted", http.StatusBadRequest)
			return
		}
		if _, err := tx.Exec(ctx, "DELETE FROM learning.competency WHERE id=$1", id); err != nil {
			logger.Error("delete competency", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := writeAdminAuditWithReason(ctx, tx, identity.ActorID, "admin.learning.competency.deleted", "learning.competency", id, body.Reason, before, nil); err != nil {
			logger.Error("audit competency delete", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			logger.Error("commit competency delete", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
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
			WindowDays      int            `json:"windowDays"`
			TotalCards      int            `json:"totalCards"`
			DueNow          int            `json:"dueNow"`
			Leeched         int            `json:"leeched"`
			ReviewsTotal    int            `json:"reviewsTotal"`
			ReviewsByRating map[string]int `json:"reviewsByRating"`
			RetentionPct    *float64       `json:"retentionPct,omitempty"`
			AvgEaseFactor   *float64       `json:"avgEaseFactor,omitempty"`
			AvgLapses       *float64       `json:"avgLapses,omitempty"`
			AvgIntervalDays *float64       `json:"avgIntervalDays,omitempty"`
		}
		var s Summary
		s.WindowDays = windowDays
		s.ReviewsByRating = map[string]int{}

		for _, query := range []struct {
			sql    string
			target *int
		}{
			{"SELECT COUNT(*) FROM learning.user_flashcard", &s.TotalCards},
			{"SELECT COUNT(*) FROM learning.user_flashcard WHERE due_at <= NOW()", &s.DueNow},
			{"SELECT COUNT(*) FROM learning.user_flashcard WHERE leeched = true", &s.Leeched},
		} {
			if err := db.QueryRow(r.Context(), query.sql).Scan(query.target); err != nil {
				logger.Error("learning review summary", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
		}

		interval := fmt.Sprintf("%d days", windowDays)
		if err := db.QueryRow(r.Context(), "SELECT COUNT(*) FROM learning.review_event WHERE reviewed_at >= NOW() - $1::interval", interval).Scan(&s.ReviewsTotal); err != nil {
			logger.Error("learning review event count", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		ratingRows, err := db.Query(r.Context(), "SELECT rating, COUNT(*) FROM learning.review_event WHERE reviewed_at >= NOW() - $1::interval GROUP BY rating", interval)
		if err != nil {
			logger.Error("learning review ratings", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		for ratingRows.Next() {
			var rating string
			var cnt int
			if err := ratingRows.Scan(&rating, &cnt); err != nil {
				ratingRows.Close()
				logger.Error("scan learning review rating", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			s.ReviewsByRating[rating] = cnt
		}
		if err := ratingRows.Err(); err != nil {
			ratingRows.Close()
			logger.Error("iterate learning review ratings", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		ratingRows.Close()

		goodCount := s.ReviewsByRating["good"] + s.ReviewsByRating["easy"]
		if s.ReviewsTotal > 0 {
			pct := float64(goodCount) / float64(s.ReviewsTotal) * 100
			s.RetentionPct = &pct
		}

		if err := db.QueryRow(r.Context(), "SELECT AVG(ease_factor), AVG(lapses), AVG(interval_days) FROM learning.user_flashcard").Scan(&s.AvgEaseFactor, &s.AvgLapses, &s.AvgIntervalDays); err != nil {
			logger.Error("learning review averages", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

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
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type Point struct {
			Day          string  `json:"day"`
			Reviews      int     `json:"reviews"`
			GoodReviews  int     `json:"goodReviews"`
			RetentionPct float64 `json:"retentionPct"`
		}
		var points []Point
		for rows.Next() {
			var p Point
			var day time.Time
			if err := rows.Scan(&day, &p.Reviews, &p.GoodReviews); err != nil {
				logger.Error("scan retention point", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			p.Day = day.Format("2006-01-02")
			if p.Reviews > 0 {
				p.RetentionPct = float64(p.GoodReviews) / float64(p.Reviews) * 100
			}
			points = append(points, p)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate retention points", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if points == nil {
			points = []Point{}
		}
		writeJSON(w, http.StatusOK, map[string]any{"points": points})
	}
}

// adminLearningReviewProblemCardsHandler implements GET /api/admin/learning/review/problem-cards.
func adminLearningReviewProblemCardsHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query().Get("q")
		minLapses := queryInt(r, "minLapses", 2)
		maxRetention := queryInt(r, "maxRetention", 100)
		if maxRetention < 0 {
			maxRetention = 0
		} else if maxRetention > 100 {
			maxRetention = 100
		}
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

		whereParts := []string{
			"uf.lapses >= $1",
			"(SELECT CASE WHEN COUNT(*) = 0 THEN 0 ELSE COUNT(*) FILTER (WHERE rating IN ('good','easy')) * 100.0 / COUNT(*) END FROM learning.review_event re WHERE re.user_flashcard_id=uf.id AND re.reviewed_at>=NOW()-INTERVAL '30 days') <= $2",
		}
		args := []any{minLapses, maxRetention}
		argIdx := 3
		if leeched == "leeched" || leeched == "true" {
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
		countQ := "SELECT COUNT(*) FROM learning.user_flashcard uf LEFT JOIN learning.flashcard_variant fv ON fv.id = uf.card_id " + whereClause
		if err := db.QueryRow(r.Context(), countQ, args...).Scan(&total); err != nil {
			logger.Error("count problem cards", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		dataQ := fmt.Sprintf(`SELECT uf.id, uf.user_id, uf.card_id, uf.lapses, uf.leeched, uf.state, uf.ease_factor, uf.interval_days, uf.repetitions, uf.due_at,
			fv.source_type, fv.front_text,
			(SELECT COUNT(*)::int FROM learning.review_event re WHERE re.user_flashcard_id=uf.id AND re.reviewed_at>=NOW()-INTERVAL '30 days'),
			(SELECT COUNT(*)::int FROM learning.review_event re WHERE re.user_flashcard_id=uf.id AND re.reviewed_at>=NOW()-INTERVAL '30 days' AND re.rating IN ('good','easy'))
			FROM learning.user_flashcard uf LEFT JOIN learning.flashcard_variant fv ON fv.id = uf.card_id
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
			ID     string `json:"id"`
			UserID string `json:"userId"`
			Card   struct {
				ID       string  `json:"id"`
				CardType *string `json:"cardType"`
				Title    *string `json:"title"`
			} `json:"card"`
			State        string  `json:"state"`
			IntervalDays int     `json:"intervalDays"`
			EaseFactor   float64 `json:"easeFactor"`
			Lapses       int     `json:"lapses"`
			Repetitions  int     `json:"repetitions"`
			IsLeech      bool    `json:"isLeech"`
			DueAt        *string `json:"dueAt"`
			Recent       struct {
				Reviews      int     `json:"reviews"`
				GoodReviews  int     `json:"goodReviews"`
				RetentionPct float64 `json:"retentionPct"`
			} `json:"recent"`
		}
		var items []ProblemCard
		for rows.Next() {
			var pc ProblemCard
			var cardID string
			var dueAt *time.Time
			var reviews, goodReviews int
			if err := rows.Scan(&pc.ID, &pc.UserID, &cardID, &pc.Lapses, &pc.IsLeech, &pc.State, &pc.EaseFactor, &pc.IntervalDays, &pc.Repetitions, &dueAt, &pc.Card.CardType, &pc.Card.Title, &reviews, &goodReviews); err != nil {
				logger.Error("scan problem card", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			pc.Card.ID, pc.Recent.Reviews, pc.Recent.GoodReviews = cardID, reviews, goodReviews
			if reviews > 0 {
				pc.Recent.RetentionPct = float64(goodReviews) / float64(reviews) * 100
			}
			if dueAt != nil {
				formatted := dueAt.UTC().Format(time.RFC3339)
				pc.DueAt = &formatted
			}
			items = append(items, pc)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate problem cards", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
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
		type RecentReview struct {
			ID                string `json:"id"`
			Rating            string `json:"rating"`
			ReviewedAt        string `json:"reviewedAt"`
			ElapsedSec        int    `json:"elapsedSec"`
			IntervalAfterDays int    `json:"intervalAfterDays"`
		}
		type AuditActor struct {
			ID          string `json:"id"`
			DisplayName string `json:"displayName"`
			Email       string `json:"email"`
		}
		type AuditEntry struct {
			ID        string      `json:"id"`
			Action    string      `json:"action"`
			CreatedAt string      `json:"createdAt"`
			Reason    *string     `json:"reason"`
			Actor     *AuditActor `json:"actor"`
		}
		type CardDetail struct {
			ID           string  `json:"id"`
			UserID       string  `json:"userId"`
			CardType     string  `json:"cardType"`
			State        string  `json:"state"`
			IntervalDays int     `json:"intervalDays"`
			EaseFactor   float64 `json:"easeFactor"`
			Lapses       int     `json:"lapses"`
			Repetitions  int     `json:"repetitions"`
			IsLeech      bool    `json:"isLeech"`
			DueAt        *string `json:"dueAt"`
			ReviewedAt   *string `json:"reviewedAt"`
			Card         struct {
				ID    string  `json:"id"`
				Title string  `json:"title"`
				Level *string `json:"level"`
			} `json:"card"`
			RecentReviews []RecentReview `json:"recentReviews"`
			Audit         []AuditEntry   `json:"audit"`
		}
		var cd CardDetail
		var cardID string
		var dueAt *time.Time
		var title *string
		err := db.QueryRow(r.Context(), `SELECT uf.id, uf.user_id, fv.source_type, uf.state, uf.interval_days, uf.ease_factor, uf.lapses, uf.repetitions, uf.leeched, uf.due_at, fv.id, fv.front_text
			FROM learning.user_flashcard uf LEFT JOIN learning.flashcard_variant fv ON fv.id = uf.card_id WHERE uf.id=$1`, id).
			Scan(&cd.ID, &cd.UserID, &cd.CardType, &cd.State, &cd.IntervalDays, &cd.EaseFactor, &cd.Lapses, &cd.Repetitions, &cd.IsLeech, &dueAt, &cardID, &title)
		if err != nil {
			writeJSONError(w, "user flashcard not found", http.StatusNotFound)
			return
		}
		cd.Card.ID = cardID
		if title != nil {
			cd.Card.Title = *title
		}
		if dueAt != nil {
			s := dueAt.UTC().Format(time.RFC3339)
			cd.DueAt = &s
		}

		// Recent reviews
		reviewRows, err := db.Query(r.Context(), `SELECT id, rating, COALESCE(elapsed_ms,0),
			(EXTRACT(EPOCH FROM (next_due_at-previous_due_at))/86400)::int, reviewed_at
			FROM learning.review_event WHERE user_flashcard_id = $1 ORDER BY reviewed_at DESC LIMIT 30`, id)
		if err != nil {
			logger.Error("query review card events", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer reviewRows.Close()
		cd.RecentReviews = []RecentReview{}
		for reviewRows.Next() {
			var review RecentReview
			var elapsedMs int
			var reviewedAt time.Time
			if err := reviewRows.Scan(&review.ID, &review.Rating, &elapsedMs, &review.IntervalAfterDays, &reviewedAt); err != nil {
				logger.Error("scan review card event", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			review.ElapsedSec, review.ReviewedAt = elapsedMs/1000, reviewedAt.UTC().Format(time.RFC3339)
			if cd.ReviewedAt == nil {
				value := review.ReviewedAt
				cd.ReviewedAt = &value
			}
			cd.RecentReviews = append(cd.RecentReviews, review)
		}
		if err := reviewRows.Err(); err != nil {
			logger.Error("iterate review card events", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		// Audit
		auditRows, err := db.Query(r.Context(), `SELECT l.id, l.action, l.reason, l.created_at, a.id, a.display_name, a.email
			FROM ops.admin_audit_log l LEFT JOIN authz.admin_actor a ON a.id=l.actor_id WHERE l.target_id = $1 AND l.target_type = 'learning.user_flashcard'
			ORDER BY created_at DESC LIMIT 25`, id)
		if err != nil {
			logger.Error("query review card audit", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer auditRows.Close()
		cd.Audit = []AuditEntry{}
		for auditRows.Next() {
			var entry AuditEntry
			var created time.Time
			var actorID, displayName, email *string
			if err := auditRows.Scan(&entry.ID, &entry.Action, &entry.Reason, &created, &actorID, &displayName, &email); err != nil {
				logger.Error("scan review card audit", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			entry.CreatedAt = created.UTC().Format(time.RFC3339)
			if actorID != nil {
				entry.Actor = &AuditActor{ID: *actorID}
				if displayName != nil {
					entry.Actor.DisplayName = *displayName
				}
				if email != nil {
					entry.Actor.Email = *email
				}
			}
			cd.Audit = append(cd.Audit, entry)
		}
		if err := auditRows.Err(); err != nil {
			logger.Error("iterate review card audit", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
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
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		body.Reason = strings.TrimSpace(body.Reason)
		if len([]rune(body.Reason)) < 3 {
			writeJSONError(w, "reason is required", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		tx, err := db.Begin(ctx)
		if err != nil {
			logger.Error("begin force reintroduce", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(ctx)
		var before json.RawMessage
		if err := tx.QueryRow(ctx, `SELECT to_jsonb(uf) FROM learning.user_flashcard uf WHERE id=$1 FOR UPDATE`, id).Scan(&before); errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "user flashcard not found", http.StatusNotFound)
			return
		} else if err != nil {
			logger.Error("load flashcard for reintroduction", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if _, err := tx.Exec(ctx, `UPDATE learning.user_flashcard
			SET due_at = NOW(), interval_days = 0, repetitions = 0, state = 'relearning', updated_at = NOW()
			WHERE id = $1`, id); err != nil {
			logger.Error("force reintroduce", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		var after json.RawMessage
		if err := tx.QueryRow(ctx, `SELECT to_jsonb(uf) FROM learning.user_flashcard uf WHERE id=$1`, id).Scan(&after); err != nil {
			logger.Error("read reintroduced flashcard", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := writeAdminAuditWithReason(ctx, tx, identity.ActorID, "admin.learning.review.force_reintroduce", "learning.user_flashcard", id, body.Reason, before, after); err != nil {
			logger.Error("audit force reintroduce", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			logger.Error("commit force reintroduce", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"id": id, "reintroduced": true})
	}
}
