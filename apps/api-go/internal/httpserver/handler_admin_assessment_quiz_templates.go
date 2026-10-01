package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
)

// ── P1-A2.3: Admin Assessment — Quiz Templates Sub-Domain (8 routes) ────────
// All routes require admin session + appropriate permissions.
// Contracts derived from NestJS apps/api/src/assessment/quiz-templates-admin.repository.ts
// list, detail, create, patch, publish, archive, duplicate, remove.
// Quiz templates share the assessment.bjt_mock_test table with mock exams but are
// distinguished by type IN ('practice','daily','weekly','topic_mastery','diagnostic').

var quizTemplateTypes = []string{"practice", "daily", "weekly", "topic_mastery", "diagnostic"}

// adminAssessmentQuizTemplatesListHandler implements GET /api/admin/assessment/quiz-templates.
func adminAssessmentQuizTemplatesListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		q := r.URL.Query().Get("q")
		statusFilter := r.URL.Query().Get("status")
		levelFilter := r.URL.Query().Get("level")
		typeFilter := r.URL.Query().Get("type")
		page := queryInt(r, "page", 1)
		pageSize := queryInt(r, "pageSize", 20)
		if page < 1 {
			page = 1
		}
		if pageSize < 1 || pageSize > 100 {
			pageSize = 20
		}
		offset := (page - 1) * pageSize

		whereParts := []string{"type = ANY($1)"}
		args := []any{quizTemplateTypes}
		argIdx := 2

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
		if typeFilter != "" {
			whereParts = append(whereParts, fmt.Sprintf("type = $%d", argIdx))
			args = append(args, typeFilter)
			argIdx++
		}
		if q != "" {
			pattern := "%" + q + "%"
			whereParts = append(whereParts, fmt.Sprintf(
				"(slug ILIKE $%[1]d OR title_vi ILIKE $%[1]d OR title_ja ILIKE $%[1]d OR description ILIKE $%[1]d)", argIdx))
			args = append(args, pattern)
			argIdx++
		}

		whereClause := "WHERE " + strings.Join(whereParts, " AND ")

		countQuery := "SELECT COUNT(*) FROM assessment.bjt_mock_test " + whereClause
		var total int
		if err := db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
			logger.Error("count quiz templates", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		dataQuery := fmt.Sprintf(`
			SELECT id, slug, title_vi, title_ja, type, status, level,
			       time_limit_seconds, description, blueprint_meta, created_at, updated_at
			FROM assessment.bjt_mock_test %s
			ORDER BY updated_at DESC LIMIT $%d OFFSET $%d`,
			whereClause, argIdx, argIdx+1)
		args = append(args, pageSize, offset)

		rows, err := db.Query(ctx, dataQuery, args...)
		if err != nil {
			logger.Error("list quiz templates", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type TemplateSummary struct {
			ID               string          `json:"id"`
			Slug             string          `json:"slug"`
			TitleVi          string          `json:"titleVi"`
			TitleJa          *string         `json:"titleJa,omitempty"`
			Type             string          `json:"type"`
			Status           string          `json:"status"`
			Level            *string         `json:"level,omitempty"`
			TimeLimitSeconds *int            `json:"timeLimitSeconds,omitempty"`
			Description      *string         `json:"description,omitempty"`
			BlueprintMeta    json.RawMessage `json:"blueprintMeta,omitempty"`
			CreatedAt        string          `json:"createdAt"`
			UpdatedAt        string          `json:"updatedAt"`
		}
		var items []TemplateSummary
		for rows.Next() {
			var t TemplateSummary
			var createdAt, updatedAt time.Time
			if err := rows.Scan(&t.ID, &t.Slug, &t.TitleVi, &t.TitleJa, &t.Type, &t.Status,
				&t.Level, &t.TimeLimitSeconds, &t.Description, &t.BlueprintMeta,
				&createdAt, &updatedAt); err == nil {
				t.CreatedAt = createdAt.UTC().Format(time.RFC3339)
				t.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
				items = append(items, t)
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

// adminAssessmentQuizTemplatesDetailHandler implements GET /api/admin/assessment/quiz-templates/{id}.
func adminAssessmentQuizTemplatesDetailHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := extractPathParam(r.URL.Path, "quiz-templates", 1)
		if id == "" {
			writeJSONError(w, "quiz template id required", http.StatusBadRequest)
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
			ID               string          `json:"id"`
			Slug             string          `json:"slug"`
			TitleVi          string          `json:"titleVi"`
			TitleJa          *string         `json:"titleJa,omitempty"`
			Type             string          `json:"type"`
			Status           string          `json:"status"`
			Level            *string         `json:"level,omitempty"`
			TimeLimitSeconds *int            `json:"timeLimitSeconds,omitempty"`
			Description      *string         `json:"description,omitempty"`
			BlueprintMeta    json.RawMessage `json:"blueprintMeta,omitempty"`
			SamplePreview    json.RawMessage `json:"samplePreview,omitempty"`
			CreatedAt        string          `json:"createdAt"`
			UpdatedAt        string          `json:"updatedAt"`
			Audit            []AuditEntry  `json:"audit"`
		}

		var td TemplateDetail
		var createdAt, updatedAt time.Time
		err := db.QueryRow(ctx, `
			SELECT id, slug, title_vi, title_ja, type, status, level,
			       time_limit_seconds, description, blueprint_meta, created_at, updated_at
			FROM assessment.bjt_mock_test WHERE id = $1 AND type = ANY($2)`,
			id, quizTemplateTypes).Scan(&td.ID, &td.Slug, &td.TitleVi, &td.TitleJa, &td.Type, &td.Status,
			&td.Level, &td.TimeLimitSeconds, &td.Description, &td.BlueprintMeta,
			&createdAt, &updatedAt)
		if err != nil {
			writeJSONError(w, "quiz template not found", http.StatusNotFound)
			return
		}
		td.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		td.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)

		// Build sample preview from blueprint meta (matches NestJS buildSamplePreview)
		td.SamplePreview = buildSamplePreview(td.BlueprintMeta)

		// Audit trail
		aRows, err := db.Query(ctx, `
			SELECT a.id, a.action, a.actor_id, act.display_name, act.email,
			       a.reason, a.after, a.before, a.created_at
			FROM ops.admin_audit_log a
			LEFT JOIN authz.admin_actor act ON act.id = a.actor_id
			WHERE a.target_id = $1 AND a.target_type = 'assessment.quiz_template'
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

// adminAssessmentQuizTemplatesCreateHandler implements POST /api/admin/assessment/quiz-templates.
func adminAssessmentQuizTemplatesCreateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			Slug            string          `json:"slug"`
			TitleVi         string          `json:"titleVi"`
			TitleJa         *string         `json:"titleJa,omitempty"`
			Description     *string         `json:"description,omitempty"`
			Type            string          `json:"type"`
			Level           string          `json:"level"`
			GenerationRules json.RawMessage `json:"generationRules"`
			Reason          string          `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.Slug == "" || req.TitleVi == "" || req.Type == "" || req.Level == "" {
			writeJSONError(w, "slug, titleVi, type, and level are required", http.StatusBadRequest)
			return
		}
		ctx := r.Context()

		// Check slug uniqueness
		var slugExists bool
		db.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM assessment.bjt_mock_test WHERE slug = $1)", req.Slug).Scan(&slugExists)
		if slugExists {
			writeJSONError(w, "slug already in use", http.StatusConflict)
			return
		}

		// Build blueprint from generation rules (matches NestJS toBlueprint)
		blueprint := toBlueprint(req.GenerationRules)
		timeLimitSec := extractTimeLimitSec(req.GenerationRules)

		var createdID string
		err := db.QueryRow(ctx, `
			INSERT INTO assessment.bjt_mock_test (slug, title_vi, title_ja, description, type, status, level,
			                           time_limit_seconds, blueprint_meta, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, 'draft', $6, $7, $8, NOW(), NOW())
			RETURNING id`,
			req.Slug, req.TitleVi, req.TitleJa, req.Description, req.Type, req.Level,
			timeLimitSec, blueprint).Scan(&createdID)
		if err != nil {
			logger.Error("create quiz template", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		// Write audit
		afterJSON, _ := json.Marshal(map[string]any{
			"slug": req.Slug, "titleVi": req.TitleVi, "titleJa": req.TitleJa,
			"description": req.Description, "level": req.Level, "type": req.Type,
			"timeLimitSeconds": timeLimitSec, "blueprintMeta": blueprint, "status": "draft",
		})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('admin.assessment.quiz_template.created', $1, $2, 'assessment.quiz_template', $3, $4, NOW())`,
			identity.ActorID, createdID, req.Reason, afterJSON)

		// Return detail view
		r.URL.Path = "/api/admin/assessment/quiz-templates/" + createdID
		detailHandler := adminAssessmentQuizTemplatesDetailHandler(db, logger)
		detailHandler(w, r)
	}
}

// adminAssessmentQuizTemplatesPatchHandler implements PATCH /api/admin/assessment/quiz-templates/{id}.
func adminAssessmentQuizTemplatesPatchHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "quiz-templates", 1)
		if id == "" {
			writeJSONError(w, "quiz template id required", http.StatusBadRequest)
			return
		}
		var req struct {
			Slug            *string         `json:"slug,omitempty"`
			TitleVi         *string         `json:"titleVi,omitempty"`
			TitleJa         *string         `json:"titleJa,omitempty"`
			Description     *string         `json:"description,omitempty"`
			Type            *string         `json:"type,omitempty"`
			Level           *string         `json:"level,omitempty"`
			GenerationRules json.RawMessage `json:"generationRules,omitempty"`
			Reason          string          `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		ctx := r.Context()

		// Fetch existing
		type Existing struct {
			Slug             string          `json:"slug"`
			TitleVi          string          `json:"titleVi"`
			TitleJa          *string         `json:"titleJa,omitempty"`
			Description      *string         `json:"description,omitempty"`
			Type             string          `json:"type"`
			Status           string          `json:"status"`
			Level            *string         `json:"level,omitempty"`
			TimeLimitSeconds *int            `json:"timeLimitSeconds,omitempty"`
			BlueprintMeta    json.RawMessage `json:"blueprintMeta,omitempty"`
		}
		var before Existing
		err := db.QueryRow(ctx, `
			SELECT slug, title_vi, title_ja, description, type, status, level, time_limit_seconds, blueprint_meta
			FROM assessment.bjt_mock_test WHERE id = $1 AND type = ANY($2)`, id, quizTemplateTypes).Scan(
			&before.Slug, &before.TitleVi, &before.TitleJa, &before.Description,
			&before.Type, &before.Status, &before.Level, &before.TimeLimitSeconds, &before.BlueprintMeta)
		if err != nil {
			writeJSONError(w, "quiz template not found", http.StatusNotFound)
			return
		}

		// Check slug uniqueness if changing
		if req.Slug != nil && *req.Slug != before.Slug {
			var slugExists bool
			db.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM assessment.bjt_mock_test WHERE slug = $1 AND id != $2)", *req.Slug, id).Scan(&slugExists)
			if slugExists {
				writeJSONError(w, "slug already in use", http.StatusConflict)
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
		if req.TitleVi != nil {
			setClauses = append(setClauses, "title_vi = $"+itoa(argIdx))
			args = append(args, *req.TitleVi)
			argIdx++
		}
		if req.TitleJa != nil {
			setClauses = append(setClauses, "title_ja = $"+itoa(argIdx))
			args = append(args, *req.TitleJa)
			argIdx++
		}
		if req.Description != nil {
			setClauses = append(setClauses, "description = $"+itoa(argIdx))
			args = append(args, *req.Description)
			argIdx++
		}
		if req.Type != nil {
			setClauses = append(setClauses, "type = $"+itoa(argIdx))
			args = append(args, *req.Type)
			argIdx++
		}
		if req.Level != nil {
			setClauses = append(setClauses, "level = $"+itoa(argIdx))
			args = append(args, *req.Level)
			argIdx++
		}
		if req.GenerationRules != nil {
			blueprint := toBlueprint(req.GenerationRules)
			timeLimitSec := extractTimeLimitSec(req.GenerationRules)
			setClauses = append(setClauses, "blueprint_meta = $"+itoa(argIdx))
			args = append(args, blueprint)
			argIdx++
			setClauses = append(setClauses, "time_limit_seconds = $"+itoa(argIdx))
			args = append(args, timeLimitSec)
			argIdx++
		}
		if len(setClauses) == 0 {
			writeJSONError(w, "at least one field to update is required", http.StatusBadRequest)
			return
		}
		setClauses = append(setClauses, "updated_at = NOW()")
		query := "UPDATE assessment.bjt_mock_test SET " + joinStrings(setClauses, ", ") +
			" WHERE id = $" + itoa(argIdx)
		args = append(args, id)
		if _, err := db.Exec(ctx, query, args...); err != nil {
			logger.Error("patch quiz template", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		// Write audit
		beforeJSON, _ := json.Marshal(before)
		afterJSON, _ := json.Marshal(map[string]any{"updated": true, "fields": setClauses})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, before, created_at)
			VALUES ('admin.assessment.quiz_template.updated', $1, $2, 'assessment.quiz_template', $3, $4, $5, NOW())`,
			identity.ActorID, id, req.Reason, afterJSON, beforeJSON)

		// Return detail view
		detailHandler := adminAssessmentQuizTemplatesDetailHandler(db, logger)
		detailHandler(w, r)
	}
}

// adminAssessmentQuizTemplatesPublishHandler implements POST /api/admin/assessment/quiz-templates/{id}/publish.
func adminAssessmentQuizTemplatesPublishHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "quiz-templates", 1)
		if id == "" {
			writeJSONError(w, "quiz template id required", http.StatusBadRequest)
			return
		}
		var req struct {
			Reason string `json:"reason"`
		}
		json.NewDecoder(r.Body).Decode(&req)
		ctx := r.Context()

		var currentStatus string
		err := db.QueryRow(ctx, "SELECT status FROM assessment.bjt_mock_test WHERE id = $1 AND type = ANY($2)",
			id, quizTemplateTypes).Scan(&currentStatus)
		if err != nil {
			writeJSONError(w, "quiz template not found", http.StatusNotFound)
			return
		}
		if currentStatus == "archived" {
			writeJSONError(w, "cannot publish archived template", http.StatusBadRequest)
			return
		}
		if currentStatus != "published" {
			db.Exec(ctx, "UPDATE assessment.bjt_mock_test SET status = 'published', updated_at = NOW() WHERE id = $1", id)
		}

		afterJSON, _ := json.Marshal(map[string]any{"status": "published", "noop": currentStatus == "published"})
		beforeJSON, _ := json.Marshal(map[string]any{"status": currentStatus})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, before, created_at)
			VALUES ('admin.assessment.quiz_template.published', $1, $2, 'assessment.quiz_template', $3, $4, $5, NOW())`,
			identity.ActorID, id, req.Reason, afterJSON, beforeJSON)

		detailHandler := adminAssessmentQuizTemplatesDetailHandler(db, logger)
		detailHandler(w, r)
	}
}

// adminAssessmentQuizTemplatesArchiveHandler implements POST /api/admin/assessment/quiz-templates/{id}/archive.
func adminAssessmentQuizTemplatesArchiveHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "quiz-templates", 1)
		if id == "" {
			writeJSONError(w, "quiz template id required", http.StatusBadRequest)
			return
		}
		var req struct {
			Reason string `json:"reason"`
		}
		json.NewDecoder(r.Body).Decode(&req)
		ctx := r.Context()

		var currentStatus string
		err := db.QueryRow(ctx, "SELECT status FROM assessment.bjt_mock_test WHERE id = $1 AND type = ANY($2)",
			id, quizTemplateTypes).Scan(&currentStatus)
		if err != nil {
			writeJSONError(w, "quiz template not found", http.StatusNotFound)
			return
		}
		if currentStatus != "archived" {
			db.Exec(ctx, "UPDATE assessment.bjt_mock_test SET status = 'archived', updated_at = NOW() WHERE id = $1", id)
		}

		afterJSON, _ := json.Marshal(map[string]any{"status": "archived"})
		beforeJSON, _ := json.Marshal(map[string]any{"status": currentStatus})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, before, created_at)
			VALUES ('admin.assessment.quiz_template.archived', $1, $2, 'assessment.quiz_template', $3, $4, $5, NOW())`,
			identity.ActorID, id, req.Reason, afterJSON, beforeJSON)

		detailHandler := adminAssessmentQuizTemplatesDetailHandler(db, logger)
		detailHandler(w, r)
	}
}

// adminAssessmentQuizTemplatesDuplicateHandler implements POST /api/admin/assessment/quiz-templates/{id}/duplicate.
func adminAssessmentQuizTemplatesDuplicateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "quiz-templates", 1)
		if id == "" {
			writeJSONError(w, "quiz template id required", http.StatusBadRequest)
			return
		}
		var req struct {
			Reason string `json:"reason"`
		}
		json.NewDecoder(r.Body).Decode(&req)
		ctx := r.Context()

		type Source struct {
			Slug             string          `json:"slug"`
			TitleVi          string          `json:"titleVi"`
			TitleJa          *string         `json:"titleJa,omitempty"`
			Description      *string         `json:"description,omitempty"`
			Type             string          `json:"type"`
			Level            *string         `json:"level,omitempty"`
			TimeLimitSeconds *int            `json:"timeLimitSeconds,omitempty"`
			BlueprintMeta    json.RawMessage `json:"blueprintMeta,omitempty"`
		}
		var src Source
		err := db.QueryRow(ctx, `
			SELECT slug, title_vi, title_ja, description, type, level, time_limit_seconds, blueprint_meta
			FROM assessment.bjt_mock_test WHERE id = $1 AND type = ANY($2)`, id, quizTemplateTypes).Scan(
			&src.Slug, &src.TitleVi, &src.TitleJa, &src.Description,
			&src.Type, &src.Level, &src.TimeLimitSeconds, &src.BlueprintMeta)
		if err != nil {
			writeJSONError(w, "quiz template not found", http.StatusNotFound)
			return
		}

		newSlug := uniqueCopySlugSync(ctx, db, src.Slug)
		newTitleVi := suffixCopy(src.TitleVi, " (copy)", 200)

		var newID string
		err = db.QueryRow(ctx, `
			INSERT INTO assessment.bjt_mock_test (slug, title_vi, title_ja, description, type, status, level,
			                           time_limit_seconds, blueprint_meta, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, 'draft', $6, $7, $8, NOW(), NOW())
			RETURNING id`,
			newSlug, newTitleVi, src.TitleJa, src.Description, src.Type, src.Level,
			src.TimeLimitSeconds, src.BlueprintMeta).Scan(&newID)
		if err != nil {
			logger.Error("duplicate quiz template", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		afterJSON, _ := json.Marshal(map[string]any{"newId": newID, "slug": newSlug, "sourceId": id})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('admin.assessment.quiz_template.duplicated', $1, $2, 'assessment.quiz_template', $3, $4, NOW())`,
			identity.ActorID, newID, req.Reason, afterJSON)

		r.URL.Path = "/api/admin/assessment/quiz-templates/" + newID
		detailHandler := adminAssessmentQuizTemplatesDetailHandler(db, logger)
		detailHandler(w, r)
	}
}

// adminAssessmentQuizTemplatesDeleteHandler implements DELETE /api/admin/assessment/quiz-templates/{id}.
func adminAssessmentQuizTemplatesDeleteHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "quiz-templates", 1)
		if id == "" {
			writeJSONError(w, "quiz template id required", http.StatusBadRequest)
			return
		}
		var req struct {
			Reason string `json:"reason"`
		}
		json.NewDecoder(r.Body).Decode(&req)
		ctx := r.Context()

		var currentStatus string
		err := db.QueryRow(ctx, "SELECT status FROM assessment.bjt_mock_test WHERE id = $1 AND type = ANY($2)",
			id, quizTemplateTypes).Scan(&currentStatus)
		if err != nil {
			writeJSONError(w, "quiz template not found", http.StatusNotFound)
			return
		}
		if currentStatus != "draft" {
			writeJSONError(w, "only draft templates can be deleted", http.StatusBadRequest)
			return
		}

		var sessionCount int
		db.QueryRow(ctx, "SELECT COUNT(*) FROM assessment.quiz_session WHERE test_id = $1", id).Scan(&sessionCount)
		if sessionCount > 0 {
			writeJSONError(w, "quiz template has sessions; cannot delete", http.StatusBadRequest)
			return
		}

		// Capture before state for audit
		type Before struct {
			Slug             string          `json:"slug"`
			TitleVi          string          `json:"titleVi"`
			TitleJa          *string         `json:"titleJa,omitempty"`
			Description      *string         `json:"description,omitempty"`
			Level            *string         `json:"level,omitempty"`
			Type             string          `json:"type"`
			Status           string          `json:"status"`
			TimeLimitSeconds *int            `json:"timeLimitSeconds,omitempty"`
			BlueprintMeta    json.RawMessage `json:"blueprintMeta,omitempty"`
		}
		var before Before
		db.QueryRow(ctx, `SELECT slug, title_vi, title_ja, description, level, type, status, time_limit_seconds, blueprint_meta
			FROM assessment.bjt_mock_test WHERE id = $1`, id).Scan(&before.Slug, &before.TitleVi, &before.TitleJa,
			&before.Description, &before.Level, &before.Type, &before.Status, &before.TimeLimitSeconds, &before.BlueprintMeta)

		db.Exec(ctx, "DELETE FROM assessment.bjt_mock_test WHERE id = $1", id)

		beforeJSON, _ := json.Marshal(before)
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, before, created_at)
			VALUES ('admin.assessment.quiz_template.deleted', $1, $2, 'assessment.quiz_template', $3, $4, NOW())`,
			identity.ActorID, id, req.Reason, beforeJSON)

		writeJSON(w, http.StatusOK, map[string]any{"deleted": true, "id": id})
	}
}

// ── Quiz Template Helpers ───────────────────────────────────────────────────

// toBlueprint converts generation rules JSON into the blueprint meta structure
// matching NestJS QuizTemplatesAdminRepository.toBlueprint().
func toBlueprint(rulesJSON json.RawMessage) json.RawMessage {
	if len(rulesJSON) == 0 {
		return json.RawMessage(`{"kind":"quiz_template","sections":[],"totalTimeMin":1}`)
	}
	var rules struct {
		QuestionCount int `json:"questionCount"`
		TimeLimitSec  int `json:"timeLimitSec"`
	}
	_ = json.Unmarshal(rulesJSON, &rules)
	totalTimeMin := rules.TimeLimitSec / 60
	if totalTimeMin < 1 {
		totalTimeMin = 1
	}
	blueprint := map[string]any{
		"kind": "quiz_template",
		"generationRules": json.RawMessage(rulesJSON),
		"sections": []map[string]any{
			{
				"code":          "AUTO",
				"titleVi":       "Câu hỏi tự sinh",
				"type":          "auto",
				"questionCount": rules.QuestionCount,
				"timeLimitSec":  rules.TimeLimitSec,
			},
		},
		"totalTimeMin": totalTimeMin,
	}
	b, _ := json.Marshal(blueprint)
	return b
}

// extractTimeLimitSec extracts timeLimitSec from generation rules JSON.
func extractTimeLimitSec(rulesJSON json.RawMessage) *int {
	if len(rulesJSON) == 0 {
		return nil
	}
	var rules struct {
		TimeLimitSec *int `json:"timeLimitSec"`
	}
	_ = json.Unmarshal(rulesJSON, &rules)
	return rules.TimeLimitSec
}

// buildSamplePreview generates a sample preview from blueprint meta,
// matching NestJS QuizTemplatesAdminRepository.buildSamplePreview().
func buildSamplePreview(blueprintMeta json.RawMessage) json.RawMessage {
	if len(blueprintMeta) == 0 {
		return json.RawMessage(`{"totalQuestions":0,"timeLimitSec":0,"difficultyAllocation":[],"topicAllocation":[]}`)
	}
	var meta struct {
		GenerationRules *struct {
			QuestionCount int `json:"questionCount"`
			TimeLimitSec  int `json:"timeLimitSec"`
			DifficultyMix []struct {
				Difficulty string  `json:"difficulty"`
				Weight     float64 `json:"weight"`
			} `json:"difficultyMix"`
			TopicMix []struct {
				Topic  string  `json:"topic"`
				Weight float64 `json:"weight"`
			} `json:"topicMix"`
		} `json:"generationRules"`
	}
	if err := json.Unmarshal(blueprintMeta, &meta); err != nil || meta.GenerationRules == nil {
		return json.RawMessage(`{"totalQuestions":0,"timeLimitSec":0,"difficultyAllocation":[],"topicAllocation":[]}`)
	}
	rules := meta.GenerationRules
	total := rules.QuestionCount

	allocateBy := func(weights []float64) []int {
		sum := 0.0
		for _, w := range weights {
			sum += w
		}
		if sum == 0 {
			sum = 1
		}
		result := make([]int, len(weights))
		for i, w := range weights {
			v := int(float64(total) * w / sum)
			if v < 0 {
				v = 0
			}
			result[i] = v
		}
		return result
	}

	diffWeights := make([]float64, len(rules.DifficultyMix))
	for i, d := range rules.DifficultyMix {
		diffWeights[i] = d.Weight
	}
	diffAlloc := allocateBy(diffWeights)

	topicWeights := make([]float64, len(rules.TopicMix))
	for i, t := range rules.TopicMix {
		topicWeights[i] = t.Weight
	}
	topicAlloc := allocateBy(topicWeights)

	type DiffAlloc struct {
		Difficulty string `json:"difficulty"`
		Target     int    `json:"target"`
	}
	type TopicAlloc struct {
		Topic  string `json:"topic"`
		Target int    `json:"target"`
	}
	preview := map[string]any{
		"totalQuestions":       total,
		"timeLimitSec":         rules.TimeLimitSec,
		"difficultyAllocation": make([]DiffAlloc, len(rules.DifficultyMix)),
		"topicAllocation":      make([]TopicAlloc, len(rules.TopicMix)),
	}
	for i, d := range rules.DifficultyMix {
		target := 0
		if i < len(diffAlloc) {
			target = diffAlloc[i]
		}
		preview["difficultyAllocation"].([]DiffAlloc)[i] = DiffAlloc{Difficulty: d.Difficulty, Target: target}
	}
	for i, t := range rules.TopicMix {
		target := 0
		if i < len(topicAlloc) {
			target = topicAlloc[i]
		}
		preview["topicAllocation"].([]TopicAlloc)[i] = TopicAlloc{Topic: t.Topic, Target: target}
	}
	b, _ := json.Marshal(preview)
	return b
}

// Ensure imports are used.
var _ = context.Background
var _ = pgx.ErrNoRows