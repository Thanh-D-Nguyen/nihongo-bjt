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

// ── P1-A2.2: Admin Assessment — Question Bank Sub-Domain (7 routes) ─────────
// All routes require admin session + appropriate permissions.
// Contracts derived from NestJS apps/api/src/assessment/question-bank-admin.repository.ts
// list, detail, create, patch, bulk, suggestEdit, remove.

// adminAssessmentQuestionBankListHandler implements GET /api/admin/assessment/question-bank.
func adminAssessmentQuestionBankListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		q := r.URL.Query().Get("q")
		statusFilter := r.URL.Query().Get("status")
		topicFilter := r.URL.Query().Get("topic")
		difficultyFilter := r.URL.Query().Get("difficulty")
		sectionIDFilter := r.URL.Query().Get("sectionId")
		levelFilter := r.URL.Query().Get("level")
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
			whereParts = append(whereParts, fmt.Sprintf("q.status = $%d", argIdx))
			args = append(args, statusFilter)
			argIdx++
		}
		if topicFilter != "" {
			whereParts = append(whereParts, fmt.Sprintf("q.skill_tag = $%d", argIdx))
			args = append(args, topicFilter)
			argIdx++
		}
		if difficultyFilter != "" {
			whereParts = append(whereParts, fmt.Sprintf("q.difficulty = $%d", argIdx))
			args = append(args, difficultyFilter)
			argIdx++
		}
		if sectionIDFilter != "" {
			whereParts = append(whereParts, fmt.Sprintf("q.section_id = $%d", argIdx))
			args = append(args, sectionIDFilter)
			argIdx++
		}
		if levelFilter != "" {
			whereParts = append(whereParts, fmt.Sprintf("t.level = $%d", argIdx))
			args = append(args, levelFilter)
			argIdx++
		}
		if q != "" {
			pattern := "%" + q + "%"
			whereParts = append(whereParts, fmt.Sprintf(
				"(q.prompt ILIKE $%[1]d OR q.explanation_vi ILIKE $%[1]d OR q.scenario ILIKE $%[1]d)", argIdx))
			args = append(args, pattern)
			argIdx++
		}

		whereClause := ""
		if len(whereParts) > 0 {
			whereClause = "WHERE " + strings.Join(whereParts, " AND ")
		}

		countQuery := `SELECT COUNT(*) FROM assessment.bjt_question q
LEFT JOIN assessment.bjt_mock_test_section s ON s.id = q.section_id
LEFT JOIN assessment.bjt_mock_test t ON t.id = s.test_id ` + whereClause
		var total int
		if err := db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
			logger.Error("count questions", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		dataQuery := fmt.Sprintf(`
SELECT q.id, q.section_id, q.prompt, q.scenario, q.skill_tag, q.difficulty,
       q.tags, q.status, q.remediation_card_id, q.created_at, q.updated_at,
       s.code as section_code, s.title_vi as section_title_vi,
       t.id as test_id, t.slug as test_slug, t.title_vi as test_title_vi, t.level as test_level, t.type as test_type,
       (SELECT COUNT(*) FROM assessment.bjt_question_option o WHERE o.question_id = q.id) as option_count,
       (SELECT COUNT(*) FROM study.quiz_answer a WHERE a.question_id = q.id) as answer_count
FROM assessment.bjt_question q
LEFT JOIN assessment.bjt_mock_test_section s ON s.id = q.section_id
LEFT JOIN assessment.bjt_mock_test t ON t.id = s.test_id
%s ORDER BY q.updated_at DESC LIMIT $%d OFFSET $%d`,
			whereClause, argIdx, argIdx+1)
		args = append(args, pageSize, offset)

		rows, err := db.Query(ctx, dataQuery, args...)
		if err != nil {
			logger.Error("list questions", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type QuestionSummary struct {
			ID              string          `json:"id"`
			SectionID       string          `json:"sectionId"`
			Prompt          string          `json:"prompt"`
			Scenario        *string         `json:"scenario,omitempty"`
			SkillTag        string          `json:"skillTag"`
			Difficulty      string          `json:"difficulty"`
			Tags            json.RawMessage `json:"tags"`
			Status          string          `json:"status"`
			RemediationCardID *string       `json:"remediationCardId,omitempty"`
			CreatedAt       string          `json:"createdAt"`
			UpdatedAt       string          `json:"updatedAt"`
			OptionCount     int             `json:"optionCount"`
			AnswerCount     int             `json:"answerCount"`
			Section         *struct {
				ID     string `json:"id"`
				Code   string `json:"code"`
				TitleVi string `json:"titleVi"`
				Test   *struct {
					ID    string `json:"id"`
					Slug  string `json:"slug"`
					TitleVi string `json:"titleVi"`
					Level string `json:"level"`
					Type  string `json:"type"`
				} `json:"test"`
			} `json:"section,omitempty"`
		}

		var items []QuestionSummary
		for rows.Next() {
			var qs QuestionSummary
			var createdAt, updatedAt time.Time
			var sectionCode, sectionTitleVi *string
			var testID, testSlug, testTitleVi, testLevel, testType *string
			var tagsBytes []byte
			if err := rows.Scan(&qs.ID, &qs.SectionID, &qs.Prompt, &qs.Scenario, &qs.SkillTag,
				&qs.Difficulty, &tagsBytes, &qs.Status, &qs.RemediationCardID,
				&createdAt, &updatedAt, &sectionCode, &sectionTitleVi,
				&testID, &testSlug, &testTitleVi, &testLevel, &testType,
				&qs.OptionCount, &qs.AnswerCount); err == nil {
				qs.CreatedAt = createdAt.UTC().Format(time.RFC3339)
				qs.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
				if tagsBytes != nil {
					qs.Tags = tagsBytes
				} else {
					qs.Tags = json.RawMessage("[]")
				}
				if sectionCode != nil {
					qs.Section = &struct {
						ID     string `json:"id"`
						Code   string `json:"code"`
						TitleVi string `json:"titleVi"`
						Test   *struct {
							ID    string `json:"id"`
							Slug  string `json:"slug"`
							TitleVi string `json:"titleVi"`
							Level string `json:"level"`
							Type  string `json:"type"`
						} `json:"test"`
					}{
						ID:      qs.SectionID,
						Code:    *sectionCode,
						TitleVi: derefString(sectionTitleVi),
					}
					if testID != nil {
						qs.Section.Test = &struct {
							ID    string `json:"id"`
							Slug  string `json:"slug"`
							TitleVi string `json:"titleVi"`
							Level string `json:"level"`
							Type  string `json:"type"`
						}{
							ID:      *testID,
							Slug:    derefString(testSlug),
							TitleVi: derefString(testTitleVi),
							Level:   derefString(testLevel),
							Type:    derefString(testType),
						}
					}
				}
				items = append(items, qs)
			}
		}
		if items == nil {
			items = []QuestionSummary{}
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"items":    items,
			"page":     page,
			"pageSize": pageSize,
			"total":    total,
		})
	}
}

// adminAssessmentQuestionBankDetailHandler implements GET /api/admin/assessment/question-bank/{id}.
func adminAssessmentQuestionBankDetailHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := extractPathParam(r.URL.Path, "question-bank", 1)
		if id == "" {
			writeJSONError(w, "question id required", http.StatusBadRequest)
			return
		}
		ctx := r.Context()

		type Option struct {
			ID        string `json:"id"`
			OptionKey string `json:"optionKey"`
			Text      string `json:"text"`
			IsCorrect bool   `json:"isCorrect"`
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
		type QuestionDetail struct {
			ID                string          `json:"id"`
			SectionID         string          `json:"sectionId"`
			Prompt            string          `json:"prompt"`
			Scenario          *string         `json:"scenario,omitempty"`
			ExplanationVi     string          `json:"explanationVi"`
			SkillTag          string          `json:"skillTag"`
			Difficulty        string          `json:"difficulty"`
			Tags              json.RawMessage `json:"tags"`
			Status            string          `json:"status"`
			SourceType        *string         `json:"sourceType,omitempty"`
			SourceID          *string         `json:"sourceId,omitempty"`
			ImageURL          *string         `json:"imageUrl,omitempty"`
			ImageAlt          *string         `json:"imageAlt,omitempty"`
			ImagePrompt       *string         `json:"imagePrompt,omitempty"`
			AudioURL          *string         `json:"audioUrl,omitempty"`
			AudioScript       *string         `json:"audioScript,omitempty"`
			RemediationCardID *string         `json:"remediationCardId,omitempty"`
			CreatedAt         string          `json:"createdAt"`
			UpdatedAt         string          `json:"updatedAt"`
			Options           []Option        `json:"options"`
			AnswerCount       int             `json:"answerCount"`
			Audit             []AuditEntry    `json:"audit"`
		}

		var qd QuestionDetail
		var createdAt, updatedAt time.Time
		var tagsBytes []byte
		err := db.QueryRow(ctx, `
SELECT id, section_id, prompt, scenario, explanation_vi, skill_tag, difficulty,
       tags, status, source_type, source_id, image_url, image_alt, image_prompt,
       audio_url, audio_script, remediation_card_id, created_at, updated_at
FROM assessment.bjt_question WHERE id = $1`, id).Scan(
			&qd.ID, &qd.SectionID, &qd.Prompt, &qd.Scenario, &qd.ExplanationVi,
			&qd.SkillTag, &qd.Difficulty, &tagsBytes, &qd.Status,
			&qd.SourceType, &qd.SourceID, &qd.ImageURL, &qd.ImageAlt, &qd.ImagePrompt,
			&qd.AudioURL, &qd.AudioScript, &qd.RemediationCardID,
			&createdAt, &updatedAt)
		if err != nil {
			writeJSONError(w, "question not found", http.StatusNotFound)
			return
		}
		qd.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		qd.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
		if tagsBytes != nil {
			qd.Tags = tagsBytes
		} else {
			qd.Tags = json.RawMessage("[]")
		}

		// Options
		oRows, err := db.Query(ctx, `
SELECT id, option_key, text, is_correct FROM assessment.bjt_question_option
WHERE question_id = $1 ORDER BY option_key ASC`, id)
		if err == nil {
			for oRows.Next() {
				var o Option
				if err := oRows.Scan(&o.ID, &o.OptionKey, &o.Text, &o.IsCorrect); err == nil {
					qd.Options = append(qd.Options, o)
				}
			}
			oRows.Close()
		}
		if qd.Options == nil {
			qd.Options = []Option{}
		}

		// Answer count
		db.QueryRow(ctx, "SELECT COUNT(*) FROM study.quiz_answer WHERE question_id = $1", id).Scan(&qd.AnswerCount)

		// Audit trail
		aRows, err := db.Query(ctx, `
SELECT a.id, a.action, a.actor_id, act.display_name, act.email,
       a.reason, a.after, a.before, a.created_at
FROM ops.admin_audit_log a
LEFT JOIN authz.admin_actor act ON act.id = a.actor_id
WHERE a.target_id = $1 AND a.target_type = 'assessment.question'
ORDER BY a.created_at DESC LIMIT 30`, id)
		if err == nil {
			for aRows.Next() {
				var ae AuditEntry
				var ts time.Time
				if err := aRows.Scan(&ae.ID, &ae.Action, &ae.ActorID, &ae.ActorName,
					&ae.ActorEmail, &ae.Reason, &ae.After, &ae.Before, &ts); err == nil {
					ae.CreatedAt = ts.UTC().Format(time.RFC3339)
					qd.Audit = append(qd.Audit, ae)
				}
			}
			aRows.Close()
		}
		if qd.Audit == nil {
			qd.Audit = []AuditEntry{}
		}

		writeJSON(w, http.StatusOK, qd)
	}
}

// adminAssessmentQuestionBankCreateHandler implements POST /api/admin/assessment/question-bank.
func adminAssessmentQuestionBankCreateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			SectionID     string `json:"sectionId"`
			Prompt        string `json:"prompt"`
			Scenario      *string `json:"scenario,omitempty"`
			ExplanationVi string `json:"explanationVi"`
			SkillTag      string `json:"skillTag"`
			Difficulty    string `json:"difficulty"`
			Tags          json.RawMessage `json:"tags"`
			SourceType    *string `json:"sourceType,omitempty"`
			SourceID      *string `json:"sourceId,omitempty"`
			ImageURL      *string `json:"imageUrl,omitempty"`
			ImageAlt      *string `json:"imageAlt,omitempty"`
			ImagePrompt   *string `json:"imagePrompt,omitempty"`
			AudioURL      *string `json:"audioUrl,omitempty"`
			AudioScript   *string `json:"audioScript,omitempty"`
			Options       []struct {
				OptionKey string `json:"optionKey"`
				Text      string `json:"text"`
				IsCorrect bool   `json:"isCorrect"`
			} `json:"options"`
			Reason string `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.SectionID == "" || req.Prompt == "" || req.ExplanationVi == "" ||
			req.SkillTag == "" || req.Difficulty == "" {
			writeJSONError(w, "sectionId, prompt, explanationVi, skillTag, and difficulty are required", http.StatusBadRequest)
			return
		}

		ctx := r.Context()
		tagsJSON := req.Tags
		if tagsJSON == nil {
			tagsJSON = json.RawMessage("[]")
		}

		var createdID string
		err := db.QueryRow(ctx, `
INSERT INTO assessment.bjt_question (section_id, prompt, scenario, explanation_vi, skill_tag, difficulty,
       tags, status, source_type, source_id, image_url, image_alt, image_prompt,
       audio_url, audio_script, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
RETURNING id`,
			req.SectionID, req.Prompt, req.Scenario, req.ExplanationVi, req.SkillTag,
			req.Difficulty, tagsJSON, req.SourceType, req.SourceID,
			req.ImageURL, req.ImageAlt, req.ImagePrompt,
			req.AudioURL, req.AudioScript).Scan(&createdID)
		if err != nil {
			logger.Error("create question", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		// Create options
		for _, o := range req.Options {
			db.Exec(ctx, `INSERT INTO assessment.bjt_question_option (question_id, option_key, text, is_correct)
VALUES ($1, $2, $3, $4)`, createdID, o.OptionKey, o.Text, o.IsCorrect)
		}

		// Write audit
		afterJSON, _ := json.Marshal(map[string]any{
			"sectionId": req.SectionID, "prompt": req.Prompt, "scenario": req.Scenario,
			"explanationVi": req.ExplanationVi, "skillTag": req.SkillTag,
			"difficulty": req.Difficulty, "tags": req.Tags, "status": "draft",
		})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
VALUES ('admin.assessment.question.created', $1, $2, 'assessment.question', $3, $4, NOW())`,
			identity.ActorID, createdID, req.Reason, afterJSON)

		// Return detail view
		r.URL.Path = "/api/admin/assessment/question-bank/" + createdID
		detailHandler := adminAssessmentQuestionBankDetailHandler(db, logger)
		detailHandler(w, r)
	}
}

// adminAssessmentQuestionBankPatchHandler implements PATCH /api/admin/assessment/question-bank/{id}.
func adminAssessmentQuestionBankPatchHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "question-bank", 1)
		if id == "" {
			writeJSONError(w, "question id required", http.StatusBadRequest)
			return
		}
		var req struct {
			SectionID     *string `json:"sectionId,omitempty"`
			Prompt        *string `json:"prompt,omitempty"`
			Scenario      *string `json:"scenario,omitempty"`
			ExplanationVi *string `json:"explanationVi,omitempty"`
			SkillTag      *string `json:"skillTag,omitempty"`
			Difficulty    *string `json:"difficulty,omitempty"`
			Tags          json.RawMessage `json:"tags,omitempty"`
			SourceType    *string `json:"sourceType,omitempty"`
			SourceID      *string `json:"sourceId,omitempty"`
			ImageURL      *string `json:"imageUrl,omitempty"`
			ImageAlt      *string `json:"imageAlt,omitempty"`
			ImagePrompt   *string `json:"imagePrompt,omitempty"`
			AudioURL      *string `json:"audioUrl,omitempty"`
			AudioScript   *string `json:"audioScript,omitempty"`
			Options       []struct {
				OptionKey string `json:"optionKey"`
				Text      string `json:"text"`
				IsCorrect bool   `json:"isCorrect"`
			} `json:"options,omitempty"`
			Reason string `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}

		ctx := r.Context()

		// Fetch before state
		type Before struct {
			SectionID     string          `json:"sectionId"`
			Prompt        string          `json:"prompt"`
			Scenario      *string         `json:"scenario,omitempty"`
			ExplanationVi string          `json:"explanationVi"`
			SkillTag      string          `json:"skillTag"`
			Difficulty    string          `json:"difficulty"`
			Tags          json.RawMessage `json:"tags"`
			Status        string          `json:"status"`
		}
		var before Before
		var tagsBytes []byte
		err := db.QueryRow(ctx, `
SELECT section_id, prompt, scenario, explanation_vi, skill_tag, difficulty, tags, status
FROM assessment.bjt_question WHERE id = $1`, id).Scan(
			&before.SectionID, &before.Prompt, &before.Scenario, &before.ExplanationVi,
			&before.SkillTag, &before.Difficulty, &tagsBytes, &before.Status)
		if err != nil {
			writeJSONError(w, "question not found", http.StatusNotFound)
			return
		}
		if tagsBytes != nil {
			before.Tags = tagsBytes
		} else {
			before.Tags = json.RawMessage("[]")
		}

		// Build dynamic UPDATE
		setClauses := []string{}
		args := []any{}
		argIdx := 1
		if req.SectionID != nil {
			setClauses = append(setClauses, "section_id = $"+itoa(argIdx))
			args = append(args, *req.SectionID)
			argIdx++
		}
		if req.Prompt != nil {
			setClauses = append(setClauses, "prompt = $"+itoa(argIdx))
			args = append(args, *req.Prompt)
			argIdx++
		}
		if req.Scenario != nil {
			setClauses = append(setClauses, "scenario = $"+itoa(argIdx))
			args = append(args, *req.Scenario)
			argIdx++
		}
		if req.ExplanationVi != nil {
			setClauses = append(setClauses, "explanation_vi = $"+itoa(argIdx))
			args = append(args, *req.ExplanationVi)
			argIdx++
		}
		if req.SkillTag != nil {
			setClauses = append(setClauses, "skill_tag = $"+itoa(argIdx))
			args = append(args, *req.SkillTag)
			argIdx++
		}
		if req.Difficulty != nil {
			setClauses = append(setClauses, "difficulty = $"+itoa(argIdx))
			args = append(args, *req.Difficulty)
			argIdx++
		}
		if req.Tags != nil {
			setClauses = append(setClauses, "tags = $"+itoa(argIdx))
			args = append(args, req.Tags)
			argIdx++
		}
		if req.SourceType != nil {
			setClauses = append(setClauses, "source_type = $"+itoa(argIdx))
			args = append(args, *req.SourceType)
			argIdx++
		}
		if req.SourceID != nil {
			setClauses = append(setClauses, "source_id = $"+itoa(argIdx))
			args = append(args, *req.SourceID)
			argIdx++
		}
		if req.ImageURL != nil {
			setClauses = append(setClauses, "image_url = $"+itoa(argIdx))
			args = append(args, *req.ImageURL)
			argIdx++
		}
		if req.ImageAlt != nil {
			setClauses = append(setClauses, "image_alt = $"+itoa(argIdx))
			args = append(args, *req.ImageAlt)
			argIdx++
		}
		if req.ImagePrompt != nil {
			setClauses = append(setClauses, "image_prompt = $"+itoa(argIdx))
			args = append(args, *req.ImagePrompt)
			argIdx++
		}
		if req.AudioURL != nil {
			setClauses = append(setClauses, "audio_url = $"+itoa(argIdx))
			args = append(args, *req.AudioURL)
			argIdx++
		}
		if req.AudioScript != nil {
			setClauses = append(setClauses, "audio_script = $"+itoa(argIdx))
			args = append(args, *req.AudioScript)
			argIdx++
		}
		if len(setClauses) == 0 && len(req.Options) == 0 {
			writeJSONError(w, "at least one field to update is required", http.StatusBadRequest)
			return
		}

		if len(setClauses) > 0 {
			setClauses = append(setClauses, "updated_at = NOW()")
			query := "UPDATE assessment.bjt_question SET " + joinStrings(setClauses, ", ") +
				" WHERE id = $" + itoa(argIdx)
			args = append(args, id)
			if _, err := db.Exec(ctx, query, args...); err != nil {
				logger.Error("patch question", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
		}

		// Replace options if provided
		if len(req.Options) > 0 {
			db.Exec(ctx, "DELETE FROM assessment.bjt_question_option WHERE question_id = $1", id)
			for _, o := range req.Options {
				db.Exec(ctx, `INSERT INTO assessment.bjt_question_option (question_id, option_key, text, is_correct)
VALUES ($1, $2, $3, $4)`, id, o.OptionKey, o.Text, o.IsCorrect)
			}
		}

		// Write audit
		beforeJSON, _ := json.Marshal(before)
		afterJSON, _ := json.Marshal(map[string]any{"updated": true})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, before, created_at)
VALUES ('admin.assessment.question.updated', $1, $2, 'assessment.question', $3, $4, $5, NOW())`,
			identity.ActorID, id, req.Reason, afterJSON, beforeJSON)

		// Return detail view
		detailHandler := adminAssessmentQuestionBankDetailHandler(db, logger)
		detailHandler(w, r)
	}
}

// adminAssessmentQuestionBankBulkHandler implements POST /api/admin/assessment/question-bank/bulk.
func adminAssessmentQuestionBankBulkHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			IDs    []string        `json:"ids"`
			Action string          `json:"action"`
			Tags   []string        `json:"tags,omitempty"`
			Reason string          `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if len(req.IDs) == 0 || req.Action == "" {
			writeJSONError(w, "ids and action are required", http.StatusBadRequest)
			return
		}

		ctx := r.Context()
		processed := 0

		for _, qid := range req.IDs {
			var currentStatus string
			var currentTags []byte
			err := db.QueryRow(ctx, "SELECT status, tags FROM assessment.bjt_question WHERE id = $1", qid).Scan(&currentStatus, &currentTags)
			if err != nil {
				continue
			}

			var after map[string]any
			var action string

			switch req.Action {
			case "publish":
				if currentStatus == "archived" {
					continue
				}
				db.Exec(ctx, "UPDATE assessment.bjt_question SET status = 'published', updated_at = NOW() WHERE id = $1", qid)
				after = map[string]any{"status": "published"}
				action = "admin.assessment.question.published"
			case "archive":
				if currentStatus == "archived" {
					continue
				}
				db.Exec(ctx, "UPDATE assessment.bjt_question SET status = 'archived', updated_at = NOW() WHERE id = $1", qid)
				after = map[string]any{"status": "archived"}
				action = "admin.assessment.question.archived"
			case "tag":
				if len(req.Tags) == 0 {
					continue
				}
				// Merge tags using PostgreSQL array operations
				db.Exec(ctx, `UPDATE assessment.bjt_question SET tags = (
					SELECT jsonb_agg(DISTINCT elem) FROM (
						SELECT jsonb_array_elements_text(COALESCE(tags, '[]'::jsonb)) as elem
						UNION
						SELECT unnest($2::text[])
					) sub
				), updated_at = NOW() WHERE id = $1`, qid, req.Tags)
				after = map[string]any{"tags": req.Tags}
				action = "admin.assessment.question.tagged"
			case "untag":
				if len(req.Tags) == 0 {
					continue
				}
				db.Exec(ctx, `UPDATE assessment.bjt_question SET tags = (
					SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb) FROM (
						SELECT jsonb_array_elements_text(COALESCE(tags, '[]'::jsonb)) as elem
						WHERE jsonb_array_elements_text(COALESCE(tags, '[]'::jsonb)) != ALL($2::text[])
					) sub
				), updated_at = NOW() WHERE id = $1`, qid, req.Tags)
				after = map[string]any{"tags": req.Tags}
				action = "admin.assessment.question.untagged"
			default:
				continue
			}

			afterJSON, _ := json.Marshal(after)
			beforeJSON, _ := json.Marshal(map[string]any{"status": currentStatus})
			db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, before, created_at)
VALUES ($1, $2, $3, 'assessment.question', $4, $5, $6, NOW())`,
				action, identity.ActorID, qid, req.Reason, afterJSON, beforeJSON)
			processed++
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"processed":     processed,
			"totalRequested": len(req.IDs),
			"action":        req.Action,
		})
	}
}

// adminAssessmentQuestionBankSuggestEditHandler implements POST /api/admin/assessment/question-bank/{id}/suggest-edit.
func adminAssessmentQuestionBankSuggestEditHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "question-bank", 1)
		if id == "" {
			writeJSONError(w, "question id required", http.StatusBadRequest)
			return
		}
		var req struct {
			Field         string `json:"field"`
			ProposedValue any    `json:"proposedValue"`
			Rationale     string `json:"rationale"`
			Reason        string `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}

		ctx := r.Context()
		var exists bool
		db.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM assessment.bjt_question WHERE id = $1)", id).Scan(&exists)
		if !exists {
			writeJSONError(w, "question not found", http.StatusNotFound)
			return
		}

		afterJSON, _ := json.Marshal(map[string]any{
			"field": req.Field, "proposedValue": req.ProposedValue, "rationale": req.Rationale,
		})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
VALUES ('admin.assessment.question.suggested_edit', $1, $2, 'assessment.question', $3, $4, NOW())`,
			identity.ActorID, id, req.Reason, afterJSON)

		writeJSON(w, http.StatusOK, map[string]any{
			"suggested": true,
			"id":        id,
			"field":     req.Field,
		})
	}
}

// adminAssessmentQuestionBankDeleteHandler implements DELETE /api/admin/assessment/question-bank/{id}.
func adminAssessmentQuestionBankDeleteHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "question-bank", 1)
		if id == "" {
			writeJSONError(w, "question id required", http.StatusBadRequest)
			return
		}
		var req struct {
			Reason string `json:"reason"`
		}
		json.NewDecoder(r.Body).Decode(&req)

		ctx := r.Context()
		var currentStatus string
		err := db.QueryRow(ctx, "SELECT status FROM assessment.bjt_question WHERE id = $1", id).Scan(&currentStatus)
		if err != nil {
			writeJSONError(w, "question not found", http.StatusNotFound)
			return
		}
		if currentStatus != "draft" {
			writeJSONError(w, "only draft questions can be deleted", http.StatusBadRequest)
			return
		}

		var answerCount int
		db.QueryRow(ctx, "SELECT COUNT(*) FROM study.quiz_answer WHERE question_id = $1", id).Scan(&answerCount)
		if answerCount > 0 {
			writeJSONError(w, "question has answers; cannot delete", http.StatusBadRequest)
			return
		}

		// Capture before state for audit
		type Before struct {
			SectionID     string          `json:"sectionId"`
			Prompt        string          `json:"prompt"`
			Scenario      *string         `json:"scenario,omitempty"`
			ExplanationVi string          `json:"explanationVi"`
			SkillTag      string          `json:"skillTag"`
			Difficulty    string          `json:"difficulty"`
			Tags          json.RawMessage `json:"tags"`
			Status        string          `json:"status"`
		}
		var before Before
		var tagsBytes []byte
		db.QueryRow(ctx, `SELECT section_id, prompt, scenario, explanation_vi, skill_tag, difficulty, tags, status
FROM assessment.bjt_question WHERE id = $1`, id).Scan(&before.SectionID, &before.Prompt, &before.Scenario,
			&before.ExplanationVi, &before.SkillTag, &before.Difficulty, &tagsBytes, &before.Status)
		if tagsBytes != nil {
			before.Tags = tagsBytes
		} else {
			before.Tags = json.RawMessage("[]")
		}

		db.Exec(ctx, "DELETE FROM assessment.bjt_question WHERE id = $1", id)

		beforeJSON, _ := json.Marshal(before)
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, before, created_at)
VALUES ('admin.assessment.question.deleted', $1, $2, 'assessment.question', $3, $4, NOW())`,
			identity.ActorID, id, req.Reason, beforeJSON)

		writeJSON(w, http.StatusOK, map[string]any{"deleted": true, "id": id})
	}
}

func derefString(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// Ensure imports are used.
var _ = context.Background
var _ = pgx.ErrNoRows