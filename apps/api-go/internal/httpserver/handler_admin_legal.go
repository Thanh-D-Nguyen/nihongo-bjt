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

// ── P1-A13: Admin Legal — Policies + Cookie Categories + Retention (11 routes) ──
// Contracts derived from NestJS legal-policy-admin.controller.ts,
// legal-cookie-category-admin.controller.ts, legal-retention-admin.controller.ts,
// legal-policy-admin.service.ts.
// DB tables: legal.legal_policy, ops.admin_audit_log.
// Cookie categories and retention domains are code-owned curated lists
// (partial_schema_pending: no cookie_category or retention_policy table yet).

// ── Legal Policies ──────────────────────────────────────────────────────────

// adminLegalPoliciesListHandler implements GET /api/admin/legal/policies.
func adminLegalPoliciesListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		policyKey := r.URL.Query().Get("policyKey")
		status := r.URL.Query().Get("status")
		limit := queryInt(r, "limit", 100)
		offset := queryInt(r, "offset", 0)
		if limit < 1 || limit > 500 {
			limit = 100
		}
		if offset < 0 {
			offset = 0
		}

		whereParts := []string{}
		args := []any{}
		argIdx := 1
		if policyKey != "" {
			whereParts = append(whereParts, fmt.Sprintf("policy_key = $%d", argIdx))
			args = append(args, policyKey)
			argIdx++
		}
		if status != "" {
			whereParts = append(whereParts, fmt.Sprintf("status = $%d", argIdx))
			args = append(args, status)
			argIdx++
		}
		whereClause := ""
		if len(whereParts) > 0 {
			whereClause = "WHERE " + strings.Join(whereParts, " AND ")
		}

		var total int
		db.QueryRow(r.Context(), "SELECT COUNT(*) FROM legal.legal_policy "+whereClause, args...).Scan(&total)

		dataQ := fmt.Sprintf(`SELECT id, policy_key, version, status, effective_at, created_at
FROM legal.legal_policy %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
			whereClause, argIdx, argIdx+1)
		args = append(args, limit, offset)

		rows, err := db.Query(r.Context(), dataQ, args...)
		if err != nil {
			logger.Error("list legal policies", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type Policy struct {
			ID          string  `json:"id"`
			PolicyKey   string  `json:"policyKey"`
			Version     string  `json:"version"`
			Title       string  `json:"title"`
			Status      string  `json:"status"`
			EffectiveAt *string `json:"effectiveAt,omitempty"`
			PublishedAt *string `json:"publishedAt,omitempty"`
			CreatedAt   string  `json:"createdAt"`
			UpdatedAt   string  `json:"updatedAt"`
		}
		var items []Policy
		for rows.Next() {
			var p Policy
			var ca, ua time.Time
			var ea, pa *time.Time
			if rows.Scan(&p.ID, &p.PolicyKey, &p.Version, &p.Title, &p.Status, &ea, &pa, &ca, &ua) == nil {
				p.CreatedAt = ca.UTC().Format(time.RFC3339)
				p.UpdatedAt = ua.UTC().Format(time.RFC3339)
				if ea != nil {
					s := ea.UTC().Format(time.RFC3339)
					p.EffectiveAt = &s
				}
				if pa != nil {
					s := pa.UTC().Format(time.RFC3339)
					p.PublishedAt = &s
				}
				items = append(items, p)
			}
		}
		if items == nil {
			items = []Policy{}
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"items": items, "total": total, "limit": limit, "offset": offset,
		})
	}
}

// adminLegalPolicyDetailHandler implements GET /api/admin/legal/policies/{id}.
func adminLegalPolicyDetailHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := extractPathParam(r.URL.Path, "policies", 1)
		if id == "" {
			writeJSONError(w, "policy id required", http.StatusBadRequest)
			return
		}

		type PolicyDetail struct {
			ID           string            `json:"id"`
			PolicyKey    string            `json:"policyKey"`
			Version      string            `json:"version"`
			Title        string            `json:"title"`
			Status       string            `json:"status"`
			BodyMarkdown *string           `json:"bodyMarkdown,omitempty"`
			BodyHTML     *string           `json:"bodyHtml,omitempty"`
			Checksum     *string           `json:"checksum,omitempty"`
			EffectiveAt  *string           `json:"effectiveAt,omitempty"`
			PublishedAt  *string           `json:"publishedAt,omitempty"`
			CreatedAt    string            `json:"createdAt"`
			UpdatedAt    string            `json:"updatedAt"`
			Audit        []json.RawMessage `json:"audit"`
		}
		var pd PolicyDetail
		var ca, ua time.Time
		var ea, pa *time.Time
		err := db.QueryRow(r.Context(), `SELECT id, policy_key, version, title, status, body_markdown, body_html, checksum, effective_at, published_at, created_at, updated_at
FROM legal.legal_policy WHERE id=$1`, id).
			Scan(&pd.ID, &pd.PolicyKey, &pd.Version, &pd.Title, &pd.Status, &pd.BodyMarkdown, &pd.BodyHTML, &pd.Checksum, &ea, &pa, &ca, &ua)
		if err != nil {
			writeJSONError(w, "policy not found", http.StatusNotFound)
			return
		}
		pd.CreatedAt = ca.UTC().Format(time.RFC3339)
		pd.UpdatedAt = ua.UTC().Format(time.RFC3339)
		if ea != nil {
			s := ea.UTC().Format(time.RFC3339)
			pd.EffectiveAt = &s
		}
		if pa != nil {
			s := pa.UTC().Format(time.RFC3339)
			pd.PublishedAt = &s
		}

		// Audit trail
		pd.Audit = []json.RawMessage{}
		auditRows, _ := db.Query(r.Context(), `SELECT id, action, actor_id, reason, before, after, created_at
FROM ops.admin_audit_log WHERE target_id=$1 AND target_type='legal.legal_policy'
ORDER BY created_at DESC LIMIT 30`, id)
		if auditRows != nil {
			for auditRows.Next() {
				var aid, action, actorID string
				var reason *string
				var before, after json.RawMessage
				var aca time.Time
				if auditRows.Scan(&aid, &action, &actorID, &reason, &before, &after, &aca) == nil {
					entry, _ := json.Marshal(map[string]any{
						"id": aid, "action": action, "actorId": actorID,
						"reason": reason, "before": before, "after": after,
						"createdAt": aca.UTC().Format(time.RFC3339),
					})
					pd.Audit = append(pd.Audit, entry)
				}
			}
			auditRows.Close()
		}
		writeJSON(w, http.StatusOK, pd)
	}
}

// adminLegalPolicyDiffHandler implements GET /api/admin/legal/policies/{id}/diff.
func adminLegalPolicyDiffHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := extractPathParam(r.URL.Path, "policies", 1)
		if id == "" {
			writeJSONError(w, "policy id required", http.StatusBadRequest)
			return
		}
		against := r.URL.Query().Get("against")
		if against == "" {
			writeJSONError(w, "against query parameter required", http.StatusBadRequest)
			return
		}

		type Version struct {
			ID           string  `json:"id"`
			PolicyKey    string  `json:"policyKey"`
			Version      string  `json:"version"`
			Title        string  `json:"title"`
			Status       string  `json:"status"`
			BodyMarkdown *string `json:"bodyMarkdown,omitempty"`
			Checksum     *string `json:"checksum,omitempty"`
			CreatedAt    string  `json:"createdAt"`
		}
		loadVersion := func(vid string) (*Version, error) {
			var v Version
			var ca time.Time
			err := db.QueryRow(r.Context(), `SELECT id, policy_key, version, title, status, body_markdown, checksum, created_at
FROM legal.legal_policy WHERE id=$1`, vid).
				Scan(&v.ID, &v.PolicyKey, &v.Version, &v.Title, &v.Status, &v.BodyMarkdown, &v.Checksum, &ca)
			if err != nil {
				return nil, err
			}
			v.CreatedAt = ca.UTC().Format(time.RFC3339)
			return &v, nil
		}

		current, err := loadVersion(id)
		if err != nil {
			writeJSONError(w, "policy not found", http.StatusNotFound)
			return
		}
		target, err := loadVersion(against)
		if err != nil {
			writeJSONError(w, "against policy not found", http.StatusNotFound)
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"current": current,
			"against": target,
			"sameBody": current.BodyMarkdown != nil && target.BodyMarkdown != nil &&
				*current.BodyMarkdown == *target.BodyMarkdown,
		})
	}
}

// adminLegalPolicyCreateHandler implements POST /api/admin/legal/policies.
func adminLegalPolicyCreateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			PolicyKey    string `json:"policyKey"`
			Version      string `json:"version"`
			Title        string `json:"title"`
			BodyMarkdown string `json:"bodyMarkdown"`
			BodyHTML     string `json:"bodyHtml"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.PolicyKey == "" || req.Version == "" || req.Title == "" {
			writeJSONError(w, "policyKey, version, and title required", http.StatusBadRequest)
			return
		}

		var id string
		err := db.QueryRow(r.Context(), `INSERT INTO legal.legal_policy
(policy_key, version, effective_at, content_md, status, created_at)
VALUES ($1,$2,$3,$4,$5,'draft',NOW(),NOW()) RETURNING id`,
			req.PolicyKey, req.Version, req.Title, req.BodyMarkdown, req.BodyHTML).Scan(&id)
		if err != nil {
			logger.Error("create legal policy", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		afterJSON, _ := json.Marshal(map[string]any{"id": id, "policyKey": req.PolicyKey, "version": req.Version})
		db.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
VALUES ('legal.policy.created',$1,$2,'legal.legal_policy','initial_draft',$3,NOW())`,
			identity.ActorID, id, afterJSON)

		writeJSON(w, http.StatusCreated, map[string]any{"id": id, "status": "draft"})
	}
}

// adminLegalPolicyPatchHandler implements PATCH /api/admin/legal/policies/{id}.
func adminLegalPolicyPatchHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "policies", 1)
		if id == "" {
			writeJSONError(w, "policy id required", http.StatusBadRequest)
			return
		}

		// Verify draft status
		var currentStatus string
		err := db.QueryRow(r.Context(), "SELECT status FROM legal.legal_policy WHERE id=$1", id).Scan(&currentStatus)
		if err != nil {
			writeJSONError(w, "policy not found", http.StatusNotFound)
			return
		}
		if currentStatus != "draft" {
			writeJSONError(w, "only draft policies can be updated", http.StatusBadRequest)
			return
		}

		var req map[string]any
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}

		setClauses := []string{}
		args := []any{}
		argIdx := 1
		fieldMap := map[string]string{
			"title": "title", "version": "version", "bodyMarkdown": "body_markdown",
			"bodyHtml": "body_html",
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
		query := "UPDATE legal.legal_policy SET " + joinStrings(setClauses, ", ") + " WHERE id = $" + itoa(argIdx)
		args = append(args, id)

		if _, err := db.Exec(r.Context(), query, args...); err != nil {
			logger.Error("patch legal policy", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		afterJSON, _ := json.Marshal(req)
		db.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
VALUES ('legal.policy.updated',$1,$2,'legal.legal_policy','draft_edit',$3,NOW())`,
			identity.ActorID, id, afterJSON)

		writeJSON(w, http.StatusOK, map[string]any{"id": id, "updated": true})
	}
}

// adminLegalPolicyPublishHandler implements PATCH /api/admin/legal/policies/{id}/publish.
func adminLegalPolicyPublishHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "policies", 1)
		if id == "" {
			writeJSONError(w, "policy id required", http.StatusBadRequest)
			return
		}

		var beforeStatus string
		err := db.QueryRow(r.Context(), "SELECT status FROM legal.legal_policy WHERE id=$1", id).Scan(&beforeStatus)
		if err != nil {
			writeJSONError(w, "policy not found", http.StatusNotFound)
			return
		}

		_, err = db.Exec(r.Context(), `UPDATE legal.legal_policy SET
status='published', published_at=NOW(), effective_at=COALESCE(effective_at,NOW()), updated_at=NOW()
WHERE id=$1`, id)
		if err != nil {
			logger.Error("publish legal policy", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		beforeJSON, _ := json.Marshal(map[string]any{"status": beforeStatus})
		afterJSON, _ := json.Marshal(map[string]any{"status": "published"})
		db.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, before, after, created_at)
VALUES ('legal.policy.published',$1,$2,'legal.legal_policy','publish',$3,$4,NOW())`,
			identity.ActorID, id, beforeJSON, afterJSON)

		writeJSON(w, http.StatusOK, map[string]any{"id": id, "status": "published"})
	}
}

// adminLegalPolicyArchiveHandler implements PATCH /api/admin/legal/policies/{id}/archive.
func adminLegalPolicyArchiveHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "policies", 1)
		if id == "" {
			writeJSONError(w, "policy id required", http.StatusBadRequest)
			return
		}

		var beforeStatus string
		err := db.QueryRow(r.Context(), "SELECT status FROM legal.legal_policy WHERE id=$1", id).Scan(&beforeStatus)
		if err != nil {
			writeJSONError(w, "policy not found", http.StatusNotFound)
			return
		}

		_, err = db.Exec(r.Context(), "UPDATE legal.legal_policy SET status='archived' WHERE id=$1", id)
		if err != nil {
			logger.Error("archive legal policy", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		beforeJSON, _ := json.Marshal(map[string]any{"status": beforeStatus})
		afterJSON, _ := json.Marshal(map[string]any{"status": "archived"})
		db.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, before, after, created_at)
VALUES ('legal.policy.archived',$1,$2,'legal.legal_policy','archive',$3,$4,NOW())`,
			identity.ActorID, id, beforeJSON, afterJSON)

		writeJSON(w, http.StatusOK, map[string]any{"id": id, "status": "archived"})
	}
}

// adminLegalPolicyDuplicateHandler implements POST /api/admin/legal/policies/{id}/duplicate.
func adminLegalPolicyDuplicateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "policies", 1)
		if id == "" {
			writeJSONError(w, "policy id required", http.StatusBadRequest)
			return
		}

		var policyKey, version, bodyMarkdown string
		err := db.QueryRow(r.Context(), `SELECT policy_key, version, content_md
FROM legal.legal_policy WHERE id=$1`, id).
			Scan(&policyKey, &version, &bodyMarkdown)
		if err != nil {
			writeJSONError(w, "source policy not found", http.StatusNotFound)
			return
		}

		newVersion := version + "-draft"
		var newID string
		err = db.QueryRow(r.Context(), `INSERT INTO legal.legal_policy
(policy_key, version, effective_at, content_md, status, created_at)
VALUES ($1,$2,$3,$4,$5,'draft',NOW(),NOW()) RETURNING id`,
			policyKey, newVersion, bodyMarkdown).Scan(&newID)
		if err != nil {
			logger.Error("duplicate legal policy", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		afterJSON, _ := json.Marshal(map[string]any{"id": newID, "duplicatedFrom": id})
		db.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
VALUES ('legal.policy.duplicated',$1,$2,'legal.legal_policy','duplicate_from_'+$3,$4,NOW())`,
			identity.ActorID, newID, id, afterJSON)

		writeJSON(w, http.StatusCreated, map[string]any{"id": newID, "status": "draft", "duplicatedFrom": id})
	}
}

// adminLegalPolicyDeleteHandler implements DELETE /api/admin/legal/policies/{id}.
func adminLegalPolicyDeleteHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "policies", 1)
		if id == "" {
			writeJSONError(w, "policy id required", http.StatusBadRequest)
			return
		}

		var status string
		err := db.QueryRow(r.Context(), "SELECT status FROM legal.legal_policy WHERE id=$1", id).Scan(&status)
		if err != nil {
			writeJSONError(w, "policy not found", http.StatusNotFound)
			return
		}
		if status != "draft" {
			writeJSONError(w, "only draft policies can be deleted", http.StatusBadRequest)
			return
		}

		db.Exec(r.Context(), "DELETE FROM legal.legal_policy WHERE id=$1", id)

		beforeJSON, _ := json.Marshal(map[string]any{"status": status})
		db.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, before, created_at)
VALUES ('legal.policy.deleted',$1,$2,'legal.legal_policy','delete_draft',$3,NOW())`,
			identity.ActorID, id, beforeJSON)

		writeJSON(w, http.StatusOK, map[string]any{"deleted": true})
	}
}

// ── Cookie Categories (code-owned curated list) ────────────────────────────

// adminLegalCookieCategoriesHandler implements GET /api/admin/legal/cookie-categories.
func adminLegalCookieCategoriesHandler() http.HandlerFunc {
	type Category struct {
		Key           string   `json:"key"`
		Name          string   `json:"name"`
		Description   string   `json:"description"`
		OptInDefault  bool     `json:"optInDefault"`
		CanOptOut     bool     `json:"canOptOut"`
		DataCollected []string `json:"dataCollected"`
		RetentionDays int      `json:"retentionDays"`
		ThirdParties  []string `json:"thirdParties"`
	}
	categories := []Category{
		{
			Key: "essential", Name: "Essential",
			Description:  "Cookies required for authentication, security, fraud prevention, and core platform functionality.",
			OptInDefault: true, CanOptOut: false,
			DataCollected: []string{"session id", "csrf token", "auth state"},
			RetentionDays: 30, ThirdParties: []string{},
		},
		{
			Key: "functional", Name: "Functional",
			Description:  "Cookies that remember learner preferences (locale, theme, onboarding state).",
			OptInDefault: true, CanOptOut: true,
			DataCollected: []string{"preferred locale", "ui preferences", "onboarding flags"},
			RetentionDays: 365, ThirdParties: []string{},
		},
		{
			Key: "analytics", Name: "Analytics",
			Description:  "Aggregated usage telemetry to improve the product. No personal identifiers shared with third parties.",
			OptInDefault: false, CanOptOut: true,
			DataCollected: []string{"page views", "feature events", "performance metrics"},
			RetentionDays: 180, ThirdParties: []string{"self-hosted analytics"},
		},
		{
			Key: "marketing", Name: "Marketing",
			Description:  "Cookies used for measuring campaign effectiveness. Disabled by default in EU/JP.",
			OptInDefault: false, CanOptOut: true,
			DataCollected: []string{"campaign attribution", "conversion events"},
			RetentionDays: 90, ThirdParties: []string{"payment provider attribution"},
		},
	}
	return func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{
			"items":                categories,
			"total":                len(categories),
			"partialSchemaPending": true,
			"note":                 "Cookie categories are code-owned today; CRUD lands once cookie_category table is added.",
		})
	}
}

// ── Retention Domains (code-owned curated list) ─────────────────────────────

// adminLegalRetentionHandler implements GET /api/admin/legal/retention.
func adminLegalRetentionHandler() http.HandlerFunc {
	type Domain struct {
		Domain          string `json:"domain"`
		Label           string `json:"label"`
		Description     string `json:"description"`
		RetentionDays   int    `json:"retentionDays"`
		GracePeriodDays int    `json:"gracePeriodDays"`
		Runner          string `json:"runner"`
		Schedule        string `json:"schedule"`
		Irreversible    bool   `json:"irreversible"`
	}
	domains := []Domain{
		{Domain: "users", Label: "Inactive accounts", Description: "Anonymise accounts after sustained inactivity. Personal identifiers removed; learning aggregates retained.", RetentionDays: 730, GracePeriodDays: 30, Runner: "scripts/retention/anonymize-inactive.ts", Schedule: "weekly", Irreversible: true},
		{Domain: "battle.sessions", Label: "Battle session logs", Description: "Anonymise per-session telemetry; retains aggregate counters for analytics.", RetentionDays: 90, GracePeriodDays: 0, Runner: "scripts/retention/anonymize-battle.ts", Schedule: "daily", Irreversible: true},
		{Domain: "messages", Label: "Battle/chat messages", Description: "Hard-delete chat messages older than retention window. No recovery once purged.", RetentionDays: 30, GracePeriodDays: 0, Runner: "scripts/retention/purge-messages.ts", Schedule: "daily", Irreversible: true},
		{Domain: "auth.sessions", Label: "Auth/session tokens", Description: "Expire and purge auth/session records and refresh tokens after retention window.", RetentionDays: 30, GracePeriodDays: 0, Runner: "scripts/retention/purge-sessions.ts", Schedule: "daily", Irreversible: true},
		{Domain: "logs.audit", Label: "Admin audit log", Description: "Audit logs are retained for compliance. No automated purge — archival exports only.", RetentionDays: 1825, GracePeriodDays: 0, Runner: "scripts/retention/audit-archival-export.ts", Schedule: "monthly", Irreversible: false},
		{Domain: "logs.events", Label: "Analytics events", Description: "Raw event rows; analytics rollups are retained separately. Hard-delete after window.", RetentionDays: 180, GracePeriodDays: 0, Runner: "scripts/retention/purge-events.ts", Schedule: "weekly", Irreversible: true},
		{Domain: "privacy.requests", Label: "Privacy data-subject requests", Description: "Completed privacy requests are retained for compliance evidence. No automated purge.", RetentionDays: 1825, GracePeriodDays: 0, Runner: "n/a", Schedule: "n/a", Irreversible: false},
	}
	return func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{
			"items":                domains,
			"total":                len(domains),
			"partialSchemaPending": true,
			"note":                 "Mutations require a schema migration (retention_policy table) plus operator scheduling. Edit retention windows via code+migration today.",
		})
	}
}
