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

// ── P1-A2.4: Admin Assessment — Remediation Rules Sub-Domain (7 routes) ─────
// All routes require admin session + appropriate permissions.
// Contracts derived from NestJS apps/api/src/assessment/remediation-admin.repository.ts
// listRules, ruleDetail, createRule, patchRule, enableRule, disableRule, removeRule.

// adminAssessmentRemediationRulesListHandler implements GET /api/admin/assessment/remediation/rules.
func adminAssessmentRemediationRulesListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		q := r.URL.Query().Get("q")
		topicFilter := r.URL.Query().Get("topicSkillTag")
		levelFilter := r.URL.Query().Get("level")
		activeFilter := r.URL.Query().Get("active")
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

		if topicFilter != "" {
			whereParts = append(whereParts, fmt.Sprintf("topic_skill_tag = $%d", argIdx))
			args = append(args, topicFilter)
			argIdx++
		}
		if levelFilter != "" {
			whereParts = append(whereParts, fmt.Sprintf("level = $%d", argIdx))
			args = append(args, levelFilter)
			argIdx++
		}
		if activeFilter != "" {
			boolVal := activeFilter == "true"
			whereParts = append(whereParts, fmt.Sprintf("active = $%d", argIdx))
			args = append(args, boolVal)
			argIdx++
		}
		if q != "" {
			pattern := "%" + q + "%"
			whereParts = append(whereParts, fmt.Sprintf(
				"(name ILIKE $%[1]d OR description ILIKE $%[1]d)", argIdx))
			args = append(args, pattern)
			argIdx++
		}

		whereClause := ""
		if len(whereParts) > 0 {
			whereClause = "WHERE " + strings.Join(whereParts, " AND ")
		}

		countQuery := "SELECT COUNT(*) FROM assessment.assessment_remediation_rule " + whereClause
		var total int
		if err := db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
			logger.Error("count remediation rules", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		dataQuery := fmt.Sprintf(`
			SELECT id, name, description, topic_skill_tag, level,
				threshold_failed_count, threshold_window_questions,
				recommended_content_type, recommended_content_id,
				active, created_by_id, updated_by_id, created_at, updated_at
			FROM assessment.assessment_remediation_rule %s
			ORDER BY updated_at DESC LIMIT $%d OFFSET $%d`,
			whereClause, argIdx, argIdx+1)
		args = append(args, pageSize, offset)

		rows, err := db.Query(ctx, dataQuery, args...)
		if err != nil {
			logger.Error("list remediation rules", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type RuleSummary struct {
			ID                       string  `json:"id"`
			Name                     string  `json:"name"`
			Description              *string `json:"description,omitempty"`
			TopicSkillTag            string  `json:"topicSkillTag"`
			Level                    string  `json:"level"`
			ThresholdFailedCount     int     `json:"thresholdFailedCount"`
			ThresholdWindowQuestions int     `json:"thresholdWindowQuestions"`
			RecommendedContentType   string  `json:"recommendedContentType"`
			RecommendedContentID     string  `json:"recommendedContentId"`
			Active                   bool    `json:"active"`
			CreatedByID              *string `json:"createdById,omitempty"`
			UpdatedByID              *string `json:"updatedById,omitempty"`
			CreatedAt                string  `json:"createdAt"`
			UpdatedAt                string  `json:"updatedAt"`
		}

		var items []RuleSummary
		for rows.Next() {
			var rs RuleSummary
			var createdAt, updatedAt time.Time
			if err := rows.Scan(&rs.ID, &rs.Name, &rs.Description, &rs.TopicSkillTag, &rs.Level,
				&rs.ThresholdFailedCount, &rs.ThresholdWindowQuestions,
				&rs.RecommendedContentType, &rs.RecommendedContentID,
				&rs.Active, &rs.CreatedByID, &rs.UpdatedByID,
				&createdAt, &updatedAt); err == nil {
				rs.CreatedAt = createdAt.UTC().Format(time.RFC3339)
				rs.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
				items = append(items, rs)
			}
		}
		if items == nil {
			items = []RuleSummary{}
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"items":    items,
			"page":     page,
			"pageSize": pageSize,
			"total":    total,
		})
	}
}

// adminAssessmentRemediationRulesDetailHandler implements GET /api/admin/assessment/remediation/rules/{id}.
func adminAssessmentRemediationRulesDetailHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := extractPathParam(r.URL.Path, "rules", 1)
		if id == "" {
			writeJSONError(w, "remediation rule id required", http.StatusBadRequest)
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
		type TriggerEntry struct {
			ID        string `json:"id"`
			RuleID    string `json:"ruleId"`
			UserID    string `json:"userId"`
			CreatedAt string `json:"createdAt"`
		}
		type RuleDetail struct {
			ID                       string         `json:"id"`
			Name                     string         `json:"name"`
			Description              *string        `json:"description,omitempty"`
			TopicSkillTag            string         `json:"topicSkillTag"`
			Level                    string         `json:"level"`
			ThresholdFailedCount     int            `json:"thresholdFailedCount"`
			ThresholdWindowQuestions int            `json:"thresholdWindowQuestions"`
			RecommendedContentType   string         `json:"recommendedContentType"`
			RecommendedContentID     string         `json:"recommendedContentId"`
			Active                   bool           `json:"active"`
			CreatedByID              *string        `json:"createdById,omitempty"`
			UpdatedByID              *string        `json:"updatedById,omitempty"`
			CreatedAt                string         `json:"createdAt"`
			UpdatedAt                string         `json:"updatedAt"`
			Audit                    []AuditEntry   `json:"audit"`
			RecentTriggers           []TriggerEntry `json:"recentTriggers"`
		}

		var rd RuleDetail
		var createdAt, updatedAt time.Time
		err := db.QueryRow(ctx, `
			SELECT id, name, description, topic_skill_tag, level,
				threshold_failed_count, threshold_window_questions,
				recommended_content_type, recommended_content_id,
				active, created_by_id, updated_by_id, created_at, updated_at
			FROM assessment.assessment_remediation_rule WHERE id = $1`, id).Scan(
			&rd.ID, &rd.Name, &rd.Description, &rd.TopicSkillTag, &rd.Level,
			&rd.ThresholdFailedCount, &rd.ThresholdWindowQuestions,
			&rd.RecommendedContentType, &rd.RecommendedContentID,
			&rd.Active, &rd.CreatedByID, &rd.UpdatedByID,
			&createdAt, &updatedAt)
		if err != nil {
			writeJSONError(w, "remediation rule not found", http.StatusNotFound)
			return
		}
		rd.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		rd.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)

		// Audit trail
		aRows, err := db.Query(ctx, `
			SELECT a.id, a.action, a.actor_id, act.display_name, act.email,
				a.reason, a.after, a.before, a.created_at
			FROM ops.admin_audit_log a
			LEFT JOIN authz.admin_actor act ON act.id = a.actor_id
			WHERE a.target_id = $1 AND a.target_type = 'assessment.assessment_remediation_rule'
			ORDER BY a.created_at DESC LIMIT 30`, id)
		if err == nil {
			for aRows.Next() {
				var ae AuditEntry
				var ts time.Time
				if err := aRows.Scan(&ae.ID, &ae.Action, &ae.ActorID, &ae.ActorName,
					&ae.ActorEmail, &ae.Reason, &ae.After, &ae.Before, &ts); err == nil {
					ae.CreatedAt = ts.UTC().Format(time.RFC3339)
					rd.Audit = append(rd.Audit, ae)
				}
			}
			aRows.Close()
		}
		if rd.Audit == nil {
			rd.Audit = []AuditEntry{}
		}

		// Recent triggers
		tRows, err := db.Query(ctx, `
			SELECT id, rule_id, user_id, created_at
			FROM assessment.remediation_trigger
			WHERE rule_id = $1
			ORDER BY created_at DESC LIMIT 25`, id)
		if err == nil {
			for tRows.Next() {
				var te TriggerEntry
				var ts time.Time
				if err := tRows.Scan(&te.ID, &te.RuleID, &te.UserID, &ts); err == nil {
					te.CreatedAt = ts.UTC().Format(time.RFC3339)
					rd.RecentTriggers = append(rd.RecentTriggers, te)
				}
			}
			tRows.Close()
		}
		if rd.RecentTriggers == nil {
			rd.RecentTriggers = []TriggerEntry{}
		}

		writeJSON(w, http.StatusOK, rd)
	}
}

// adminAssessmentRemediationRulesCreateHandler implements POST /api/admin/assessment/remediation/rules.
func adminAssessmentRemediationRulesCreateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			Name                     string  `json:"name"`
			Description              *string `json:"description,omitempty"`
			TopicSkillTag            string  `json:"topicSkillTag"`
			Level                    string  `json:"level"`
			ThresholdFailedCount     int     `json:"thresholdFailedCount"`
			ThresholdWindowQuestions int     `json:"thresholdWindowQuestions"`
			RecommendedContentType   string  `json:"recommendedContentType"`
			RecommendedContentID     string  `json:"recommendedContentId"`
			Reason                   string  `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.Name == "" || req.TopicSkillTag == "" || req.Level == "" ||
			req.RecommendedContentType == "" || req.RecommendedContentID == "" {
			writeJSONError(w, "name, topicSkillTag, level, recommendedContentType, and recommendedContentId are required", http.StatusBadRequest)
			return
		}

		ctx := r.Context()
		var createdID string
		err := db.QueryRow(ctx, `
			INSERT INTO assessment.assessment_remediation_rule (name, description, topic_skill_tag, level,
				threshold_failed_count, threshold_window_questions,
				recommended_content_type, recommended_content_id,
				active, created_by_id, updated_by_id, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9, $9, NOW(), NOW())
			RETURNING id`,
			req.Name, req.Description, req.TopicSkillTag, req.Level,
			req.ThresholdFailedCount, req.ThresholdWindowQuestions,
			req.RecommendedContentType, req.RecommendedContentID,
			identity.ActorID).Scan(&createdID)
		if err != nil {
			logger.Error("create remediation rule", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		// Write audit
		afterJSON, _ := json.Marshal(map[string]any{
			"name": req.Name, "description": req.Description,
			"topicSkillTag": req.TopicSkillTag, "level": req.Level,
			"thresholdFailedCount":     req.ThresholdFailedCount,
			"thresholdWindowQuestions": req.ThresholdWindowQuestions,
			"recommendedContentType":   req.RecommendedContentType,
			"recommendedContentId":     req.RecommendedContentID,
			"active":                   true,
		})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('admin.assessment.remediation_rule.created', $1, $2, 'assessment.assessment_remediation_rule', $3, $4, NOW())`,
			identity.ActorID, createdID, req.Reason, afterJSON)

		// Return detail view
		r.URL.Path = "/api/admin/assessment/remediation/rules/" + createdID
		detailHandler := adminAssessmentRemediationRulesDetailHandler(db, logger)
		detailHandler(w, r)
	}
}

// adminAssessmentRemediationRulesPatchHandler implements PATCH /api/admin/assessment/remediation/rules/{id}.
func adminAssessmentRemediationRulesPatchHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "rules", 1)
		if id == "" {
			writeJSONError(w, "remediation rule id required", http.StatusBadRequest)
			return
		}
		var req struct {
			Name                     *string `json:"name,omitempty"`
			Description              *string `json:"description,omitempty"`
			TopicSkillTag            *string `json:"topicSkillTag,omitempty"`
			Level                    *string `json:"level,omitempty"`
			ThresholdFailedCount     *int    `json:"thresholdFailedCount,omitempty"`
			ThresholdWindowQuestions *int    `json:"thresholdWindowQuestions,omitempty"`
			RecommendedContentType   *string `json:"recommendedContentType,omitempty"`
			RecommendedContentID     *string `json:"recommendedContentId,omitempty"`
			Reason                   string  `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}

		ctx := r.Context()

		// Fetch before state
		type Before struct {
			Name                     string  `json:"name"`
			Description              *string `json:"description,omitempty"`
			TopicSkillTag            string  `json:"topicSkillTag"`
			Level                    string  `json:"level"`
			ThresholdFailedCount     int     `json:"thresholdFailedCount"`
			ThresholdWindowQuestions int     `json:"thresholdWindowQuestions"`
			RecommendedContentType   string  `json:"recommendedContentType"`
			RecommendedContentID     string  `json:"recommendedContentId"`
			Active                   bool    `json:"active"`
		}
		var before Before
		err := db.QueryRow(ctx, `
			SELECT name, description, topic_skill_tag, level,
				threshold_failed_count, threshold_window_questions,
				recommended_content_type, recommended_content_id, active
			FROM assessment.assessment_remediation_rule WHERE id = $1`, id).Scan(
			&before.Name, &before.Description, &before.TopicSkillTag, &before.Level,
			&before.ThresholdFailedCount, &before.ThresholdWindowQuestions,
			&before.RecommendedContentType, &before.RecommendedContentID, &before.Active)
		if err != nil {
			writeJSONError(w, "remediation rule not found", http.StatusNotFound)
			return
		}

		// Build dynamic UPDATE
		setClauses := []string{}
		args := []any{}
		argIdx := 1

		if req.Name != nil {
			setClauses = append(setClauses, "name = $"+itoa(argIdx))
			args = append(args, *req.Name)
			argIdx++
		}
		if req.Description != nil {
			setClauses = append(setClauses, "description = $"+itoa(argIdx))
			args = append(args, *req.Description)
			argIdx++
		}
		if req.TopicSkillTag != nil {
			setClauses = append(setClauses, "topic_skill_tag = $"+itoa(argIdx))
			args = append(args, *req.TopicSkillTag)
			argIdx++
		}
		if req.Level != nil {
			setClauses = append(setClauses, "level = $"+itoa(argIdx))
			args = append(args, *req.Level)
			argIdx++
		}
		if req.ThresholdFailedCount != nil {
			setClauses = append(setClauses, "threshold_failed_count = $"+itoa(argIdx))
			args = append(args, *req.ThresholdFailedCount)
			argIdx++
		}
		if req.ThresholdWindowQuestions != nil {
			setClauses = append(setClauses, "threshold_window_questions = $"+itoa(argIdx))
			args = append(args, *req.ThresholdWindowQuestions)
			argIdx++
		}
		if req.RecommendedContentType != nil {
			setClauses = append(setClauses, "recommended_content_type = $"+itoa(argIdx))
			args = append(args, *req.RecommendedContentType)
			argIdx++
		}
		if req.RecommendedContentID != nil {
			setClauses = append(setClauses, "recommended_content_id = $"+itoa(argIdx))
			args = append(args, *req.RecommendedContentID)
			argIdx++
		}

		if len(setClauses) == 0 {
			writeJSONError(w, "at least one field to update is required", http.StatusBadRequest)
			return
		}

		setClauses = append(setClauses, "updated_by_id = $"+itoa(argIdx))
		args = append(args, identity.ActorID)
		argIdx++
		setClauses = append(setClauses, "updated_at = NOW()")

		query := "UPDATE assessment.assessment_remediation_rule SET " + joinStrings(setClauses, ", ") +
			" WHERE id = $" + itoa(argIdx)
		args = append(args, id)

		if _, err := db.Exec(ctx, query, args...); err != nil {
			logger.Error("patch remediation rule", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		// Write audit
		beforeJSON, _ := json.Marshal(before)
		afterJSON, _ := json.Marshal(map[string]any{"updated": true, "fields": setClauses})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, before, created_at)
			VALUES ('admin.assessment.remediation_rule.updated', $1, $2, 'assessment.assessment_remediation_rule', $3, $4, $5, NOW())`,
			identity.ActorID, id, req.Reason, afterJSON, beforeJSON)

		// Return detail view
		detailHandler := adminAssessmentRemediationRulesDetailHandler(db, logger)
		detailHandler(w, r)
	}
}

// adminAssessmentRemediationRulesEnableHandler implements POST /api/admin/assessment/remediation/rules/{id}/enable.
func adminAssessmentRemediationRulesEnableHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "rules", 1)
		if id == "" {
			writeJSONError(w, "remediation rule id required", http.StatusBadRequest)
			return
		}
		var req struct {
			Reason string `json:"reason"`
		}
		json.NewDecoder(r.Body).Decode(&req)

		ctx := r.Context()
		var currentActive bool
		err := db.QueryRow(ctx, "SELECT active FROM assessment.assessment_remediation_rule WHERE id = $1", id).Scan(&currentActive)
		if err != nil {
			writeJSONError(w, "remediation rule not found", http.StatusNotFound)
			return
		}

		action := "admin.assessment.remediation_rule.enabled"
		noop := false
		if currentActive {
			action = "admin.assessment.remediation_rule.enable_noop"
			noop = true
		} else {
			db.Exec(ctx, "UPDATE assessment.assessment_remediation_rule SET active = true, updated_by_id = $1, updated_at = NOW() WHERE id = $2",
				identity.ActorID, id)
		}

		afterJSON, _ := json.Marshal(map[string]any{"active": true, "noop": noop})
		beforeJSON, _ := json.Marshal(map[string]any{"active": currentActive})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, before, created_at)
			VALUES ($1, $2, $3, 'assessment.assessment_remediation_rule', $4, $5, $6, NOW())`,
			action, identity.ActorID, id, req.Reason, afterJSON, beforeJSON)

		detailHandler := adminAssessmentRemediationRulesDetailHandler(db, logger)
		detailHandler(w, r)
	}
}

// adminAssessmentRemediationRulesDisableHandler implements POST /api/admin/assessment/remediation/rules/{id}/disable.
func adminAssessmentRemediationRulesDisableHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "rules", 1)
		if id == "" {
			writeJSONError(w, "remediation rule id required", http.StatusBadRequest)
			return
		}
		var req struct {
			Reason string `json:"reason"`
		}
		json.NewDecoder(r.Body).Decode(&req)

		ctx := r.Context()
		var currentActive bool
		err := db.QueryRow(ctx, "SELECT active FROM assessment.assessment_remediation_rule WHERE id = $1", id).Scan(&currentActive)
		if err != nil {
			writeJSONError(w, "remediation rule not found", http.StatusNotFound)
			return
		}

		action := "admin.assessment.remediation_rule.disabled"
		noop := false
		if !currentActive {
			action = "admin.assessment.remediation_rule.disable_noop"
			noop = true
		} else {
			db.Exec(ctx, "UPDATE assessment.assessment_remediation_rule SET active = false, updated_by_id = $1, updated_at = NOW() WHERE id = $2",
				identity.ActorID, id)
		}

		afterJSON, _ := json.Marshal(map[string]any{"active": false, "noop": noop})
		beforeJSON, _ := json.Marshal(map[string]any{"active": currentActive})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, before, created_at)
			VALUES ($1, $2, $3, 'assessment.assessment_remediation_rule', $4, $5, $6, NOW())`,
			action, identity.ActorID, id, req.Reason, afterJSON, beforeJSON)

		detailHandler := adminAssessmentRemediationRulesDetailHandler(db, logger)
		detailHandler(w, r)
	}
}

// adminAssessmentRemediationRulesDeleteHandler implements DELETE /api/admin/assessment/remediation/rules/{id}.
func adminAssessmentRemediationRulesDeleteHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "rules", 1)
		if id == "" {
			writeJSONError(w, "remediation rule id required", http.StatusBadRequest)
			return
		}
		var req struct {
			Reason string `json:"reason"`
		}
		json.NewDecoder(r.Body).Decode(&req)

		ctx := r.Context()

		// Check trigger count guard
		var triggerCount int
		db.QueryRow(ctx, "SELECT COUNT(*) FROM assessment.remediation_trigger WHERE rule_id = $1", id).Scan(&triggerCount)
		if triggerCount > 0 {
			writeJSONError(w, "rule has triggers; cannot delete", http.StatusBadRequest)
			return
		}

		// Capture before state for audit
		type Before struct {
			Name                     string  `json:"name"`
			Description              *string `json:"description,omitempty"`
			TopicSkillTag            string  `json:"topicSkillTag"`
			Level                    string  `json:"level"`
			ThresholdFailedCount     int     `json:"thresholdFailedCount"`
			ThresholdWindowQuestions int     `json:"thresholdWindowQuestions"`
			RecommendedContentType   string  `json:"recommendedContentType"`
			RecommendedContentID     string  `json:"recommendedContentId"`
			Active                   bool    `json:"active"`
		}
		var before Before
		err := db.QueryRow(ctx, `
			SELECT name, description, topic_skill_tag, level,
				threshold_failed_count, threshold_window_questions,
				recommended_content_type, recommended_content_id, active
			FROM assessment.assessment_remediation_rule WHERE id = $1`, id).Scan(
			&before.Name, &before.Description, &before.TopicSkillTag, &before.Level,
			&before.ThresholdFailedCount, &before.ThresholdWindowQuestions,
			&before.RecommendedContentType, &before.RecommendedContentID, &before.Active)
		if err != nil {
			writeJSONError(w, "remediation rule not found", http.StatusNotFound)
			return
		}

		db.Exec(ctx, "DELETE FROM assessment.assessment_remediation_rule WHERE id = $1", id)

		beforeJSON, _ := json.Marshal(before)
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, before, created_at)
			VALUES ('admin.assessment.remediation_rule.deleted', $1, $2, 'assessment.assessment_remediation_rule', $3, $4, NOW())`,
			identity.ActorID, id, req.Reason, beforeJSON)

		writeJSON(w, http.StatusOK, map[string]any{"deleted": true, "id": id})
	}
}

// Ensure imports are used.
var _ = context.Background
var _ = pgx.ErrNoRows
