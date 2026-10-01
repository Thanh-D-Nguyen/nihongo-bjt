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

// ── P1-A2.1: Admin Assessment — Mock Exams Sub-Domain (8 routes) ────────────
// All routes require admin session + appropriate permissions.
// Contracts derived from NestJS apps/api/src/assessment/mock-exams-admin.repository.ts
// list, detail, create, patch, publish, archive, duplicate, remove.

// visibleMockExamTypes matches NestJS VISIBLE_TEST_TYPES = [...EXAM_TYPES, "practice"].
var visibleMockExamTypes = []string{"mock", "official", "practice"}

// examTypes matches NestJS EXAM_TYPES = ["mock", "official"].
var examTypes = []string{"mock", "official"}

// adminAssessmentMockExamsListHandler implements GET /api/admin/assessment/mock-exams.
func adminAssessmentMockExamsListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
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

		// Build WHERE clause
		whereParts := []string{}
		args := []any{}
		argIdx := 1

		// Type filter
		if typeFilter != "" {
			whereParts = append(whereParts, fmt.Sprintf("type = $%d", argIdx))
			args = append(args, typeFilter)
			argIdx++
		} else {
			placeholders := make([]string, len(visibleMockExamTypes))
			for i := range visibleMockExamTypes {
				placeholders[i] = fmt.Sprintf("$%d", argIdx+i)
			}
			whereParts = append(whereParts, fmt.Sprintf("type IN (%s)", strings.Join(placeholders, ", ")))
			for _, t := range visibleMockExamTypes {
				args = append(args, t)
			}
			argIdx += len(visibleMockExamTypes)
		}

		if statusFilter != "" {
			whereParts = append(whereParts, fmt.Sprintf("status = $%d", argIdx))
			args = append(args, statusFilter)
			argIdx++
		}

		if levelFilter != "" {
			// Match NestJS levelCandidates: level, BJT-{level}, strip BJT- prefix variants
			candidates := levelCandidates(levelFilter)
			placeholders := make([]string, len(candidates))
			for i := range candidates {
				placeholders[i] = fmt.Sprintf("$%d", argIdx+i)
			}
			whereParts = append(whereParts, fmt.Sprintf("level IN (%s)", strings.Join(placeholders, ", ")))
			for _, c := range candidates {
				args = append(args, c)
			}
			argIdx += len(candidates)
		}

		if q != "" {
			pattern := "%" + q + "%"
			whereParts = append(whereParts, fmt.Sprintf(
				"(slug ILIKE $%[1]d OR title_vi ILIKE $%[1]d OR title_ja ILIKE $%[1]d OR description ILIKE $%[1]d)", argIdx))
			args = append(args, pattern)
			argIdx++
		}

		whereClause := ""
		if len(whereParts) > 0 {
			whereClause = "WHERE " + strings.Join(whereParts, " AND ")
		}

		// Count total
		countQuery := "SELECT COUNT(*) FROM bjt.mock_test " + whereClause
		var total int
		if err := db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
			logger.Error("count mock exams", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		// Fetch items with section/session counts
		dataQuery := fmt.Sprintf(`
			SELECT m.id, m.slug, m.title_vi, m.title_ja, m.type, m.status, m.level,
			       m.time_limit_seconds, m.description, m.blueprint_meta,
			       m.created_at, m.updated_at,
			       (SELECT COUNT(*) FROM bjt.mock_test_section s WHERE s.test_id = m.id) as section_count,
			       (SELECT COUNT(*) FROM study.quiz_session qs WHERE qs.test_id = m.id) as session_count
			FROM bjt.mock_test m %s
			ORDER BY m.updated_at DESC LIMIT $%d OFFSET $%d`,
			whereClause, argIdx, argIdx+1)
		args = append(args, pageSize, offset)

		rows, err := db.Query(ctx, dataQuery, args...)
		if err != nil {
			logger.Error("list mock exams", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type MockExamSummary struct {
			ID                string          `json:"id"`
			Slug              string          `json:"slug"`
			TitleVi           string          `json:"titleVi"`
			TitleJa           *string         `json:"titleJa,omitempty"`
			Type              string          `json:"type"`
			Status            string          `json:"status"`
			Level             *string         `json:"level,omitempty"`
			TimeLimitSeconds  *int            `json:"timeLimitSeconds,omitempty"`
			Description       *string         `json:"description,omitempty"`
			BlueprintMeta     json.RawMessage `json:"blueprintMeta,omitempty"`
			CreatedAt         string          `json:"createdAt"`
			UpdatedAt         string          `json:"updatedAt"`
			SectionCount      int             `json:"sectionCount"`
			SessionCount      int             `json:"sessionCount"`
		}

		var items []MockExamSummary
		for rows.Next() {
			var m MockExamSummary
			var createdAt, updatedAt time.Time
			if err := rows.Scan(&m.ID, &m.Slug, &m.TitleVi, &m.TitleJa, &m.Type, &m.Status,
				&m.Level, &m.TimeLimitSeconds, &m.Description, &m.BlueprintMeta,
				&createdAt, &updatedAt, &m.SectionCount, &m.SessionCount); err == nil {
				m.CreatedAt = createdAt.UTC().Format(time.RFC3339)
				m.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
				items = append(items, m)
			}
		}
		if items == nil {
			items = []MockExamSummary{}
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"items":    items,
			"page":     page,
			"pageSize": pageSize,
			"total":    total,
		})
	}
}

// adminAssessmentMockExamsDetailHandler implements GET /api/admin/assessment/mock-exams/{id}.
func adminAssessmentMockExamsDetailHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := extractPathParam(r.URL.Path, "mock-exams", 1)
		if id == "" {
			writeJSONError(w, "mock exam id required", http.StatusBadRequest)
			return
		}
		ctx := r.Context()

		type Section struct {
			ID           string `json:"id"`
			Code         string `json:"code"`
			TitleVi      string `json:"titleVi"`
			TitleJa      *string `json:"titleJa,omitempty"`
			DisplayOrder int    `json:"displayOrder"`
			QuestionCount int   `json:"questionCount"`
		}
		type AuditEntry struct {
			ID        string          `json:"id"`
			Action    string          `json:"action"`
			ActorID   string          `json:"actorId"`
			ActorName *string         `json:"actorName,omitempty"`
			ActorEmail *string        `json:"actorEmail,omitempty"`
			Reason    string          `json:"reason"`
			After     json.RawMessage `json:"after,omitempty"`
			Before    json.RawMessage `json:"before,omitempty"`
			CreatedAt string          `json:"createdAt"`
		}
		type MockExamDetail struct {
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
			Sections         []Section       `json:"sections"`
			SessionCount     int             `json:"sessionCount"`
			AudienceEstimate int             `json:"audienceEstimate"`
			Audit            []AuditEntry    `json:"audit"`
		}

		var m MockExamDetail
		var createdAt, updatedAt time.Time
		err := db.QueryRow(ctx, `
			SELECT id, slug, title_vi, title_ja, type, status, level,
			       time_limit_seconds, description, blueprint_meta, created_at, updated_at
			FROM bjt.mock_test WHERE id = $1 AND type = ANY($2)`,
			id, examTypes).Scan(&m.ID, &m.Slug, &m.TitleVi, &m.TitleJa, &m.Type, &m.Status,
			&m.Level, &m.TimeLimitSeconds, &m.Description, &m.BlueprintMeta,
			&createdAt, &updatedAt)
		if err != nil {
			writeJSONError(w, "mock exam not found", http.StatusNotFound)
			return
		}
		m.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		m.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)

		// Sections
		sRows, err := db.Query(ctx, `
			SELECT id, code, title_vi, title_ja, display_order,
			       (SELECT COUNT(*) FROM bjt.mock_test_question q WHERE q.section_id = s.id)
			FROM bjt.mock_test_section s WHERE s.test_id = $1 ORDER BY s.display_order ASC`, id)
		if err == nil {
			for sRows.Next() {
				var sec Section
				if err := sRows.Scan(&sec.ID, &sec.Code, &sec.TitleVi, &sec.TitleJa,
					&sec.DisplayOrder, &sec.QuestionCount); err == nil {
					m.Sections = append(m.Sections, sec)
				}
			}
			sRows.Close()
		}
		if m.Sections == nil {
			m.Sections = []Section{}
		}

		// Session count
		db.QueryRow(ctx, "SELECT COUNT(*) FROM study.quiz_session WHERE test_id = $1", id).Scan(&m.SessionCount)

		// Audience estimate
		if m.Level != nil {
			candidates := levelCandidates(*m.Level)
			placeholders := make([]string, len(candidates))
			aArgs := make([]any, len(candidates))
			for i, c := range candidates {
				placeholders[i] = fmt.Sprintf("$%d", i+1)
				aArgs[i] = c
			}
			db.QueryRow(ctx, fmt.Sprintf(
				"SELECT COUNT(*) FROM learner.user_profile WHERE status = 'active' AND target_bjt_band IN (%s)",
				strings.Join(placeholders, ", ")), aArgs...).Scan(&m.AudienceEstimate)
		}

		// Audit trail
		aRows, err := db.Query(ctx, `
			SELECT a.id, a.action, a.actor_id, act.display_name, act.email,
			       a.reason, a.after, a.before, a.created_at
			FROM ops.admin_audit_log a
			LEFT JOIN admin.admin_actor act ON act.id = a.actor_id
			WHERE a.target_id = $1 AND a.target_type = 'assessment.mock_exam'
			ORDER BY a.created_at DESC LIMIT 20`, id)
		if err == nil {
			for aRows.Next() {
				var ae AuditEntry
				var ts time.Time
				if err := aRows.Scan(&ae.ID, &ae.Action, &ae.ActorID, &ae.ActorName,
					&ae.ActorEmail, &ae.Reason, &ae.After, &ae.Before, &ts); err == nil {
					ae.CreatedAt = ts.UTC().Format(time.RFC3339)
					m.Audit = append(m.Audit, ae)
				}
			}
			aRows.Close()
		}
		if m.Audit == nil {
			m.Audit = []AuditEntry{}
		}

		writeJSON(w, http.StatusOK, m)
	}
}

// adminAssessmentMockExamsCreateHandler implements POST /api/admin/assessment/mock-exams.
func adminAssessmentMockExamsCreateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			Slug             string          `json:"slug"`
			TitleVi          string          `json:"titleVi"`
			TitleJa          *string         `json:"titleJa,omitempty"`
			Description      *string         `json:"description,omitempty"`
			Type             *string         `json:"type,omitempty"`
			Level            string          `json:"level"`
			TimeLimitSeconds *int            `json:"timeLimitSeconds,omitempty"`
			BlueprintMeta    json.RawMessage `json:"blueprintMeta,omitempty"`
			Reason           string          `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.Slug == "" || req.TitleVi == "" || req.Level == "" {
			writeJSONError(w, "slug, titleVi, and level are required", http.StatusBadRequest)
			return
		}
		examType := "mock"
		if req.Type != nil {
			examType = *req.Type
		}

		ctx := r.Context()
		// Check slug uniqueness
		var slugExists bool
		db.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM bjt.mock_test WHERE slug = $1)", req.Slug).Scan(&slugExists)
		if slugExists {
			writeJSONError(w, "slug already in use", http.StatusConflict)
			return
		}

		var createdID string
		err := db.QueryRow(ctx, `
			INSERT INTO bjt.mock_test (slug, title_vi, title_ja, description, type, status, level, time_limit_seconds, blueprint_meta, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, 'draft', $6, $7, $8, NOW(), NOW())
			RETURNING id`,
			req.Slug, req.TitleVi, req.TitleJa, req.Description, examType, req.Level,
			req.TimeLimitSeconds, req.BlueprintMeta).Scan(&createdID)
		if err != nil {
			logger.Error("create mock exam", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		// Write audit
		afterJSON, _ := json.Marshal(map[string]any{
			"slug": req.Slug, "titleVi": req.TitleVi, "titleJa": req.TitleJa,
			"description": req.Description, "level": req.Level,
			"timeLimitSeconds": req.TimeLimitSeconds, "blueprintMeta": req.BlueprintMeta,
			"status": "draft",
		})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('admin.assessment.mock_exam.created', $1, $2, 'assessment.mock_exam', $3, $4, NOW())`,
			identity.ActorID, createdID, req.Reason, afterJSON)

		// Return detail view by redirecting internally
		detailHandler := adminAssessmentMockExamsDetailHandler(db, logger)
		r.URL.Path = "/api/admin/assessment/mock-exams/" + createdID
		detailHandler(w, r)
	}
}

// adminAssessmentMockExamsPatchHandler implements PATCH /api/admin/assessment/mock-exams/{id}.
func adminAssessmentMockExamsPatchHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "mock-exams", 1)
		if id == "" {
			writeJSONError(w, "mock exam id required", http.StatusBadRequest)
			return
		}
		var req struct {
			Slug             *string         `json:"slug,omitempty"`
			TitleVi          *string         `json:"titleVi,omitempty"`
			TitleJa          *string         `json:"titleJa,omitempty"`
			Description      *string         `json:"description,omitempty"`
			Type             *string         `json:"type,omitempty"`
			Level            *string         `json:"level,omitempty"`
			TimeLimitSeconds *int            `json:"timeLimitSeconds,omitempty"`
			BlueprintMeta    json.RawMessage `json:"blueprintMeta,omitempty"`
			Reason           string          `json:"reason"`
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
			FROM bjt.mock_test WHERE id = $1 AND type = ANY($2)`, id, examTypes).Scan(
			&before.Slug, &before.TitleVi, &before.TitleJa, &before.Description,
			&before.Type, &before.Status, &before.Level, &before.TimeLimitSeconds, &before.BlueprintMeta)
		if err != nil {
			writeJSONError(w, "mock exam not found", http.StatusNotFound)
			return
		}

		// Check slug uniqueness if changing
		if req.Slug != nil && *req.Slug != before.Slug {
			var slugExists bool
			db.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM bjt.mock_test WHERE slug = $1 AND id != $2)", *req.Slug, id).Scan(&slugExists)
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
		if req.TimeLimitSeconds != nil {
			setClauses = append(setClauses, "time_limit_seconds = $"+itoa(argIdx))
			args = append(args, *req.TimeLimitSeconds)
			argIdx++
		}
		if req.BlueprintMeta != nil {
			setClauses = append(setClauses, "blueprint_meta = $"+itoa(argIdx))
			args = append(args, req.BlueprintMeta)
			argIdx++
		}
		if len(setClauses) == 0 {
			writeJSONError(w, "at least one field to update is required", http.StatusBadRequest)
			return
		}
		setClauses = append(setClauses, "updated_at = NOW()")
		query := "UPDATE bjt.mock_test SET " + joinStrings(setClauses, ", ") +
			" WHERE id = $" + itoa(argIdx)
		args = append(args, id)
		if _, err := db.Exec(ctx, query, args...); err != nil {
			logger.Error("patch mock exam", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		// Write audit
		beforeJSON, _ := json.Marshal(before)
		afterJSON, _ := json.Marshal(map[string]any{"updated": true, "fields": setClauses})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, before, created_at)
			VALUES ('admin.assessment.mock_exam.updated', $1, $2, 'assessment.mock_exam', $3, $4, $5, NOW())`,
			identity.ActorID, id, req.Reason, afterJSON, beforeJSON)

		// Return detail view
		detailHandler := adminAssessmentMockExamsDetailHandler(db, logger)
		detailHandler(w, r)
	}
}

// adminAssessmentMockExamsPublishHandler implements POST /api/admin/assessment/mock-exams/{id}/publish.
func adminAssessmentMockExamsPublishHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "mock-exams", 1)
		if id == "" {
			writeJSONError(w, "mock exam id required", http.StatusBadRequest)
			return
		}
		var req struct {
			Reason string `json:"reason"`
		}
		json.NewDecoder(r.Body).Decode(&req)

		ctx := r.Context()
		var currentStatus string
		err := db.QueryRow(ctx, "SELECT status FROM bjt.mock_test WHERE id = $1 AND type = ANY($2)",
			id, examTypes).Scan(&currentStatus)
		if err != nil {
			writeJSONError(w, "mock exam not found", http.StatusNotFound)
			return
		}
		if currentStatus == "archived" {
			writeJSONError(w, "cannot publish archived exam", http.StatusBadRequest)
			return
		}
		if currentStatus != "published" {
			db.Exec(ctx, "UPDATE bjt.mock_test SET status = 'published', updated_at = NOW() WHERE id = $1", id)
		}
		// Audit
		afterJSON, _ := json.Marshal(map[string]any{"status": "published", "noop": currentStatus == "published"})
		beforeJSON, _ := json.Marshal(map[string]any{"status": currentStatus})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, before, created_at)
			VALUES ('admin.assessment.mock_exam.published', $1, $2, 'assessment.mock_exam', $3, $4, $5, NOW())`,
			identity.ActorID, id, req.Reason, afterJSON, beforeJSON)

		detailHandler := adminAssessmentMockExamsDetailHandler(db, logger)
		detailHandler(w, r)
	}
}

// adminAssessmentMockExamsArchiveHandler implements POST /api/admin/assessment/mock-exams/{id}/archive.
func adminAssessmentMockExamsArchiveHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "mock-exams", 1)
		if id == "" {
			writeJSONError(w, "mock exam id required", http.StatusBadRequest)
			return
		}
		var req struct {
			Reason string `json:"reason"`
		}
		json.NewDecoder(r.Body).Decode(&req)

		ctx := r.Context()
		var currentStatus string
		err := db.QueryRow(ctx, "SELECT status FROM bjt.mock_test WHERE id = $1 AND type = ANY($2)",
			id, examTypes).Scan(&currentStatus)
		if err != nil {
			writeJSONError(w, "mock exam not found", http.StatusNotFound)
			return
		}
		if currentStatus != "archived" {
			db.Exec(ctx, "UPDATE bjt.mock_test SET status = 'archived', updated_at = NOW() WHERE id = $1", id)
		}
		afterJSON, _ := json.Marshal(map[string]any{"status": "archived"})
		beforeJSON, _ := json.Marshal(map[string]any{"status": currentStatus})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, before, created_at)
			VALUES ('admin.assessment.mock_exam.archived', $1, $2, 'assessment.mock_exam', $3, $4, $5, NOW())`,
			identity.ActorID, id, req.Reason, afterJSON, beforeJSON)

		detailHandler := adminAssessmentMockExamsDetailHandler(db, logger)
		detailHandler(w, r)
	}
}

// adminAssessmentMockExamsDuplicateHandler implements POST /api/admin/assessment/mock-exams/{id}/duplicate.
func adminAssessmentMockExamsDuplicateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "mock-exams", 1)
		if id == "" {
			writeJSONError(w, "mock exam id required", http.StatusBadRequest)
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
			FROM bjt.mock_test WHERE id = $1 AND type = ANY($2)`, id, examTypes).Scan(
			&src.Slug, &src.TitleVi, &src.TitleJa, &src.Description,
			&src.Type, &src.Level, &src.TimeLimitSeconds, &src.BlueprintMeta)
		if err != nil {
			writeJSONError(w, "mock exam not found", http.StatusNotFound)
			return
		}

		newSlug := uniqueCopySlugSync(ctx, db, src.Slug)
		newTitleVi := suffixCopy(src.TitleVi, " (copy)", 200)

		var newID string
		err = db.QueryRow(ctx, `
			INSERT INTO bjt.mock_test (slug, title_vi, title_ja, description, type, status, level, time_limit_seconds, blueprint_meta, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, 'draft', $6, $7, $8, NOW(), NOW())
			RETURNING id`,
			newSlug, newTitleVi, src.TitleJa, src.Description, src.Type, src.Level,
			src.TimeLimitSeconds, src.BlueprintMeta).Scan(&newID)
		if err != nil {
			logger.Error("duplicate mock exam", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		afterJSON, _ := json.Marshal(map[string]any{"newId": newID, "slug": newSlug, "sourceId": id})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('admin.assessment.mock_exam.duplicated', $1, $2, 'assessment.mock_exam', $3, $4, NOW())`,
			identity.ActorID, newID, req.Reason, afterJSON)

		// Return detail of new exam
		r.URL.Path = "/api/admin/assessment/mock-exams/" + newID
		detailHandler := adminAssessmentMockExamsDetailHandler(db, logger)
		detailHandler(w, r)
	}
}

// adminAssessmentMockExamsDeleteHandler implements DELETE /api/admin/assessment/mock-exams/{id}.
func adminAssessmentMockExamsDeleteHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "mock-exams", 1)
		if id == "" {
			writeJSONError(w, "mock exam id required", http.StatusBadRequest)
			return
		}
		var req struct {
			Reason string `json:"reason"`
		}
		json.NewDecoder(r.Body).Decode(&req)

		ctx := r.Context()
		var currentStatus string
		err := db.QueryRow(ctx, "SELECT status FROM bjt.mock_test WHERE id = $1 AND type = ANY($2)",
			id, examTypes).Scan(&currentStatus)
		if err != nil {
			writeJSONError(w, "mock exam not found", http.StatusNotFound)
			return
		}
		if currentStatus != "draft" {
			writeJSONError(w, "only draft exams can be deleted", http.StatusBadRequest)
			return
		}
		var sessionCount int
		db.QueryRow(ctx, "SELECT COUNT(*) FROM study.quiz_session WHERE test_id = $1", id).Scan(&sessionCount)
		if sessionCount > 0 {
			writeJSONError(w, "mock exam has sessions; cannot delete", http.StatusBadRequest)
			return
		}

		// Capture before state for audit
		type Before struct {
			Slug             string          `json:"slug"`
			TitleVi          string          `json:"titleVi"`
			TitleJa          *string         `json:"titleJa,omitempty"`
			Description      *string         `json:"description,omitempty"`
			Level            *string         `json:"level,omitempty"`
			TimeLimitSeconds *int            `json:"timeLimitSeconds,omitempty"`
			BlueprintMeta    json.RawMessage `json:"blueprintMeta,omitempty"`
			Status           string          `json:"status"`
		}
		var before Before
		db.QueryRow(ctx, `SELECT slug, title_vi, title_ja, description, level, time_limit_seconds, blueprint_meta, status
			FROM bjt.mock_test WHERE id = $1`, id).Scan(&before.Slug, &before.TitleVi, &before.TitleJa,
			&before.Description, &before.Level, &before.TimeLimitSeconds, &before.BlueprintMeta, &before.Status)

		db.Exec(ctx, "DELETE FROM bjt.mock_test WHERE id = $1", id)

		beforeJSON, _ := json.Marshal(before)
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, before, created_at)
			VALUES ('admin.assessment.mock_exam.deleted', $1, $2, 'assessment.mock_exam', $3, $4, NOW())`,
			identity.ActorID, id, req.Reason, beforeJSON)

		writeJSON(w, http.StatusOK, map[string]any{"deleted": true, "id": id})
	}
}

// ── Helpers ──────────────────────────────────────────────────────────────────

func levelCandidates(level string) []string {
	seen := map[string]bool{}
	result := []string{level}
	seen[level] = true
	stripped := strings.TrimPrefix(level, "BJT-")
	if stripped != level && !seen[stripped] {
		result = append(result, stripped)
		seen[stripped] = true
	}
	prefixed := "BJT-" + level
	if !strings.HasPrefix(level, "BJT-") && !seen[prefixed] {
		result = append(result, prefixed)
		seen[prefixed] = true
	}
	jStripped := strings.Replace(level, "BJT-J", "J", 1)
	if jStripped != level && !seen[jStripped] {
		result = append(result, jStripped)
		seen[jStripped] = true
	}
	jPlain := strings.Replace(level, "BJT-J", "", 1)
	if jPlain != level && !seen[jPlain] {
		result = append(result, jPlain)
		seen[jPlain] = true
	}
	return result
}

func uniqueCopySlugSync(ctx context.Context, db *pgxpool.Pool, base string) string {
	candidate := base + "-copy"
	for n := 1; n <= 50; n++ {
		var exists bool
		db.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM bjt.mock_test WHERE slug = $1)", candidate).Scan(&exists)
		if !exists {
			return candidate
		}
		candidate = fmt.Sprintf("%s-copy-%d", base, n+1)
	}
	return fmt.Sprintf("%s-copy-%d", base, time.Now().UnixMilli())
}

func suffixCopy(name, suffix string, maxLen int) string {
	if len(name)+len(suffix) <= maxLen {
		return name + suffix
	}
	return name[:maxLen-len(suffix)] + suffix
}

// Ensure imports are used.
var _ = context.Background
var _ = pgx.ErrNoRows