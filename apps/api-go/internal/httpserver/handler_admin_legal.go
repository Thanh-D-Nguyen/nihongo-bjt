package httpserver

import (
	"crypto/sha256"
	"encoding/base32"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/authz"
)

// ── P1-A13: Admin Legal — Policies + Cookie Categories + Retention (11 routes) ──
// Contracts derived from NestJS legal-policy-admin.controller.ts,
// legal-cookie-category-admin.controller.ts, legal-retention-admin.controller.ts,
// legal-policy-admin.service.ts.
// DB tables: legal.legal_policy, ops.admin_audit_log.
// Cookie categories and retention domains are code-owned curated lists
// (partial_schema_pending: no cookie_category or retention_policy table yet).

// ── Legal Policies ──────────────────────────────────────────────────────────

type adminLegalPolicy struct {
	ID          string    `json:"id"`
	PolicyKey   string    `json:"policyKey"`
	Version     string    `json:"version"`
	Status      string    `json:"status"`
	EffectiveAt time.Time `json:"effectiveAt"`
	ContentMd   *string   `json:"contentMd"`
	CreatedAt   time.Time `json:"createdAt"`
}

func scanAdminLegalPolicy(row pgx.Row) (adminLegalPolicy, error) {
	var policy adminLegalPolicy
	err := row.Scan(&policy.ID, &policy.PolicyKey, &policy.Version, &policy.Status, &policy.EffectiveAt, &policy.ContentMd, &policy.CreatedAt)
	return policy, err
}

func adminLegalPolicyPermission(db *pgxpool.Pool, write bool, handler http.HandlerFunc) http.HandlerFunc {
	permissions := []string{"admin.legal.write", "legal.admin", "iam.manage"}
	if !write {
		permissions = append(permissions, "admin.legal.read")
	}
	return authz.RequireAnyPermission(authz.NewStore(db), permissions)(handler).ServeHTTP
}

func adminLegalPolicyError(w http.ResponseWriter, logger *slog.Logger, err error) {
	var pgErr *pgconn.PgError
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		writeJSONError(w, "policy not found", http.StatusNotFound)
	case errors.As(err, &pgErr) && pgErr.Code == "23505":
		writeJSONError(w, "policy key and version already exist", http.StatusConflict)
	default:
		logger.Error("admin legal policy", "error", err)
		writeJSONError(w, "internal error", http.StatusInternalServerError)
	}
}

// adminLegalPoliciesListHandler implements GET /api/admin/legal/policies.
func adminLegalPoliciesListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return adminLegalPolicyPermission(db, false, func(w http.ResponseWriter, r *http.Request) {
		policyKey, status := r.URL.Query().Get("policyKey"), r.URL.Query().Get("status")
		limit, offset := queryInt(r, "limit", 100), queryInt(r, "offset", 0)
		if limit < 1 || limit > 500 {
			limit = 100
		}
		if offset < 0 {
			offset = 0
		}
		whereParts, args := []string{}, []any{}
		for _, filter := range []struct{ column, value string }{{"policy_key", policyKey}, {"status", status}} {
			if filter.value != "" {
				args = append(args, filter.value)
				whereParts = append(whereParts, fmt.Sprintf("%s = $%d", filter.column, len(args)))
			}
		}
		whereClause := ""
		if len(whereParts) > 0 {
			whereClause = "WHERE " + strings.Join(whereParts, " AND ")
		}
		var total int
		if err := db.QueryRow(r.Context(), "SELECT COUNT(*) FROM legal.legal_policy "+whereClause, args...).Scan(&total); err != nil {
			adminLegalPolicyError(w, logger, err)
			return
		}
		query := fmt.Sprintf(`SELECT id, policy_key, version, status, effective_at, content_md, created_at
FROM legal.legal_policy %s ORDER BY created_at DESC, id DESC LIMIT $%d OFFSET $%d`, whereClause, len(args)+1, len(args)+2)
		rows, err := db.Query(r.Context(), query, append(args, limit, offset)...)
		if err != nil {
			adminLegalPolicyError(w, logger, err)
			return
		}
		defer rows.Close()
		items := []adminLegalPolicy{}
		for rows.Next() {
			policy, err := scanAdminLegalPolicy(rows)
			if err != nil {
				adminLegalPolicyError(w, logger, err)
				return
			}
			items = append(items, policy)
		}
		if err := rows.Err(); err != nil {
			adminLegalPolicyError(w, logger, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": items, "total": total, "limit": limit, "offset": offset})
	})
}

// adminLegalPolicyDetailHandler implements GET /api/admin/legal/policies/{id}.
func adminLegalPolicyDetailHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return adminLegalPolicyPermission(db, false, func(w http.ResponseWriter, r *http.Request) {
		id := extractPathParam(r.URL.Path, "policies", 1)
		if !isValidUUID(id) {
			writeJSONError(w, "valid policy id required", http.StatusBadRequest)
			return
		}
		policy, err := scanAdminLegalPolicy(db.QueryRow(r.Context(), `SELECT id, policy_key, version, status, effective_at, content_md, created_at FROM legal.legal_policy WHERE id=$1`, id))
		if err != nil {
			adminLegalPolicyError(w, logger, err)
			return
		}
		rows, err := db.Query(r.Context(), `SELECT a.id, a.action, a.created_at, actor.id, actor.display_name, actor.email
FROM ops.admin_audit_log a JOIN authz.admin_actor actor ON actor.id=a.actor_id
WHERE a.target_id=$1 AND a.target_type='legal.legal_policy' ORDER BY a.created_at DESC, a.id DESC LIMIT 30`, id)
		if err != nil {
			adminLegalPolicyError(w, logger, err)
			return
		}
		defer rows.Close()
		audit := []map[string]any{}
		for rows.Next() {
			var auditID, action, actorID, name, email string
			var created time.Time
			if err := rows.Scan(&auditID, &action, &created, &actorID, &name, &email); err != nil {
				adminLegalPolicyError(w, logger, err)
				return
			}
			audit = append(audit, map[string]any{"id": auditID, "action": action, "createdAt": created, "actor": map[string]string{"id": actorID, "displayName": name, "email": email}})
		}
		if err := rows.Err(); err != nil {
			adminLegalPolicyError(w, logger, err)
			return
		}
		writeJSON(w, http.StatusOK, struct {
			adminLegalPolicy
			Audit []map[string]any `json:"audit"`
		}{policy, audit})
	})
}

// adminLegalPolicyDiffHandler implements GET /api/admin/legal/policies/{id}/diff.
func adminLegalPolicyDiffHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return adminLegalPolicyPermission(db, false, func(w http.ResponseWriter, r *http.Request) {
		id := extractPathParam(r.URL.Path, "policies", 1)
		if !isValidUUID(id) {
			writeJSONError(w, "valid policy id required", http.StatusBadRequest)
			return
		}
		against := r.URL.Query().Get("against")
		if against == "" {
			writeJSONError(w, "against query parameter required", http.StatusBadRequest)
			return
		}

		type version struct {
			ID        string    `json:"id"`
			PolicyKey string    `json:"policyKey"`
			Version   string    `json:"version"`
			Status    string    `json:"status"`
			ContentMd *string   `json:"contentMd"`
			CreatedAt time.Time `json:"createdAt"`
		}
		loadVersion := func(vid string) (*version, error) {
			var v version
			err := db.QueryRow(r.Context(), `SELECT id, policy_key, version, status, content_md, created_at
FROM legal.legal_policy WHERE id=$1`, vid).
				Scan(&v.ID, &v.PolicyKey, &v.Version, &v.Status, &v.ContentMd, &v.CreatedAt)
			if err != nil {
				return nil, err
			}
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

		sameBody := current.ContentMd != nil && target.ContentMd != nil && *current.ContentMd == *target.ContentMd
		writeJSON(w, http.StatusOK, map[string]any{
			"current":  current,
			"against":  target,
			"sameBody": sameBody,
		})
	})
}

func decodeAdminLegalPolicyInput(r *http.Request, create bool) (map[string]any, error) {
	var fields map[string]json.RawMessage
	decoder := json.NewDecoder(r.Body)
	if err := decoder.Decode(&fields); err != nil || len(fields) == 0 {
		return nil, errors.New("invalid request body")
	}
	if err := decoder.Decode(new(any)); err != io.EOF {
		return nil, errors.New("invalid request body")
	}
	values := map[string]any{}
	for field, raw := range fields {
		switch field {
		case "policyKey", "status", "version":
			if !create && field != "version" {
				return nil, errors.New("field cannot be updated")
			}
			var value string
			if err := json.Unmarshal(raw, &value); err != nil || strings.TrimSpace(value) == "" {
				return nil, errors.New("non-empty string required")
			}
			if field == "version" && len([]rune(value)) > 32 {
				return nil, errors.New("version too long")
			}
			if field == "policyKey" {
				switch value {
				case "terms_of_service", "privacy_policy", "cookie_policy", "tokusho", "consent_marketing", "consent_analytics", "legal_document":
				default:
					return nil, errors.New("invalid policyKey")
				}
			}
			if field == "status" && value != "draft" {
				return nil, errors.New("new policies must be drafts")
			}
			values[field] = value
		case "effectiveAt":
			var value time.Time
			if err := json.Unmarshal(raw, &value); err != nil || value.IsZero() {
				return nil, errors.New("valid effectiveAt required")
			}
			if create && value.Before(time.Now()) {
				return nil, errors.New("effectiveAt must not be in the past")
			}
			values[field] = value
		case "contentMd":
			var value *string
			if err := json.Unmarshal(raw, &value); err != nil {
				return nil, errors.New("contentMd must be a string or null")
			}
			values[field] = value
		default:
			return nil, errors.New("unknown policy field")
		}
	}
	if create && (values["policyKey"] == nil || values["version"] == nil || values["effectiveAt"] == nil) {
		return nil, errors.New("policyKey, version, and effectiveAt required")
	}
	return values, nil
}

// adminLegalPolicyCreateHandler implements POST /api/admin/legal/policies.
func adminLegalPolicyCreateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return adminLegalPolicyPermission(db, true, func(w http.ResponseWriter, r *http.Request) {
		identity, _ := authn.GetAdminIdentity(r.Context())
		values, err := decodeAdminLegalPolicyInput(r, true)
		if err != nil {
			writeJSONError(w, err.Error(), http.StatusBadRequest)
			return
		}
		tx, err := db.Begin(r.Context())
		if err != nil {
			adminLegalPolicyError(w, logger, err)
			return
		}
		defer tx.Rollback(r.Context())
		policy, err := scanAdminLegalPolicy(tx.QueryRow(r.Context(), `INSERT INTO legal.legal_policy (policy_key,version,effective_at,content_md,status)
VALUES ($1,$2,$3,$4,'draft') RETURNING id,policy_key,version,status,effective_at,content_md,created_at`, values["policyKey"], values["version"], values["effectiveAt"], values["contentMd"]))
		if err != nil {
			adminLegalPolicyError(w, logger, err)
			return
		}
		after, _ := json.Marshal(policy)
		if _, err := tx.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action,actor_id,target_id,target_type,reason,after)
VALUES ('legal.policy.created',$1,$2,'legal.legal_policy','initial_draft',$3)`, identity.ActorID, policy.ID, after); err != nil {
			adminLegalPolicyError(w, logger, err)
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			adminLegalPolicyError(w, logger, err)
			return
		}
		writeJSON(w, http.StatusCreated, policy)
	})
}

// adminLegalPolicyPatchHandler implements PATCH /api/admin/legal/policies/{id}.
func adminLegalPolicyPatchHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return adminLegalPolicyPermission(db, true, func(w http.ResponseWriter, r *http.Request) {
		identity, _ := authn.GetAdminIdentity(r.Context())
		id := extractPathParam(r.URL.Path, "policies", 1)
		if !isValidUUID(id) {
			writeJSONError(w, "valid policy id required", http.StatusBadRequest)
			return
		}
		values, err := decodeAdminLegalPolicyInput(r, false)
		if err != nil {
			writeJSONError(w, err.Error(), http.StatusBadRequest)
			return
		}
		tx, err := db.Begin(r.Context())
		if err != nil {
			adminLegalPolicyError(w, logger, err)
			return
		}
		defer tx.Rollback(r.Context())
		before, err := scanAdminLegalPolicy(tx.QueryRow(r.Context(), `SELECT id,policy_key,version,status,effective_at,content_md,created_at FROM legal.legal_policy WHERE id=$1 FOR UPDATE`, id))
		if err != nil {
			adminLegalPolicyError(w, logger, err)
			return
		}
		if before.Status != "draft" {
			writeJSONError(w, "only draft policies can be updated", http.StatusBadRequest)
			return
		}
		clauses, args := []string{}, []any{}
		for _, field := range []struct{ key, column string }{{"version", "version"}, {"effectiveAt", "effective_at"}, {"contentMd", "content_md"}} {
			if value, ok := values[field.key]; ok {
				args = append(args, value)
				clauses = append(clauses, fmt.Sprintf("%s=$%d", field.column, len(args)))
			}
		}
		args = append(args, id)
		query := "UPDATE legal.legal_policy SET " + strings.Join(clauses, ", ") + fmt.Sprintf(" WHERE id=$%d RETURNING id,policy_key,version,status,effective_at,content_md,created_at", len(args))
		policy, err := scanAdminLegalPolicy(tx.QueryRow(r.Context(), query, args...))
		if err != nil {
			adminLegalPolicyError(w, logger, err)
			return
		}
		beforeJSON, _ := json.Marshal(before)
		afterJSON, _ := json.Marshal(policy)
		if _, err := tx.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action,actor_id,target_id,target_type,reason,before,after)
VALUES ('legal.policy.updated',$1,$2,'legal.legal_policy','draft_edit',$3,$4)`, identity.ActorID, id, beforeJSON, afterJSON); err != nil {
			adminLegalPolicyError(w, logger, err)
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			adminLegalPolicyError(w, logger, err)
			return
		}
		writeJSON(w, http.StatusOK, policy)
	})
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
		if !isValidUUID(id) {
			writeJSONError(w, "valid policy id required", http.StatusBadRequest)
			return
		}
		tx, err := db.Begin(r.Context())
		if err != nil {
			adminLegalPolicyError(w, logger, err)
			return
		}
		defer tx.Rollback(r.Context())
		var beforeStatus string
		err = tx.QueryRow(r.Context(), "SELECT status FROM legal.legal_policy WHERE id=$1 FOR UPDATE", id).Scan(&beforeStatus)
		if err != nil {
			adminLegalPolicyError(w, logger, err)
			return
		}
		if _, err = tx.Exec(r.Context(), `UPDATE legal.legal_policy SET
status='published', effective_at=COALESCE(effective_at,NOW())
		WHERE id=$1`, id); err != nil {
			adminLegalPolicyError(w, logger, err)
			return
		}
		beforeJSON, _ := json.Marshal(map[string]any{"status": beforeStatus})
		afterJSON, _ := json.Marshal(map[string]any{"status": "published"})
		if _, err = tx.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, before, after, created_at)
VALUES ('legal.policy.published',$1,$2,'legal.legal_policy','publish',$3,$4,NOW())`, identity.ActorID, id, beforeJSON, afterJSON); err != nil {
			adminLegalPolicyError(w, logger, err)
			return
		}
		if err = tx.Commit(r.Context()); err != nil {
			adminLegalPolicyError(w, logger, err)
			return
		}
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
		if !isValidUUID(id) {
			writeJSONError(w, "valid policy id required", http.StatusBadRequest)
			return
		}
		tx, err := db.Begin(r.Context())
		if err != nil {
			adminLegalPolicyError(w, logger, err)
			return
		}
		defer tx.Rollback(r.Context())
		var beforeStatus string
		err = tx.QueryRow(r.Context(), "SELECT status FROM legal.legal_policy WHERE id=$1 FOR UPDATE", id).Scan(&beforeStatus)
		if err != nil {
			adminLegalPolicyError(w, logger, err)
			return
		}
		if _, err = tx.Exec(r.Context(), "UPDATE legal.legal_policy SET status='archived' WHERE id=$1", id); err != nil {
			adminLegalPolicyError(w, logger, err)
			return
		}
		beforeJSON, _ := json.Marshal(map[string]any{"status": beforeStatus})
		afterJSON, _ := json.Marshal(map[string]any{"status": "archived"})
		if _, err = tx.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, before, after, created_at)
VALUES ('legal.policy.archived',$1,$2,'legal.legal_policy','archive',$3,$4,NOW())`, identity.ActorID, id, beforeJSON, afterJSON); err != nil {
			adminLegalPolicyError(w, logger, err)
			return
		}
		if err = tx.Commit(r.Context()); err != nil {
			adminLegalPolicyError(w, logger, err)
			return
		}
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
		if !isValidUUID(id) {
			writeJSONError(w, "valid policy id required", http.StatusBadRequest)
			return
		}
		tx, err := db.Begin(r.Context())
		if err != nil {
			adminLegalPolicyError(w, logger, err)
			return
		}
		defer tx.Rollback(r.Context())
		var policyKey, version string
		var contentMd *string
		var effectiveAt time.Time
		err = tx.QueryRow(r.Context(), `SELECT policy_key, version, effective_at, content_md
FROM legal.legal_policy WHERE id=$1 FOR UPDATE`, id).
			Scan(&policyKey, &version, &effectiveAt, &contentMd)
		if err != nil {
			adminLegalPolicyError(w, logger, err)
			return
		}

		versionRunes := []rune(version)
		newVersion := version + "-draft"
		if len(versionRunes) > 26 {
			digest := sha256.Sum256([]byte(version))
			newVersion = string(versionRunes[:4]) + "-" + base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(digest[:12]) + "-draft"
		}
		var newID string
		err = tx.QueryRow(r.Context(), `INSERT INTO legal.legal_policy
(policy_key, version, effective_at, content_md, status, created_at)
VALUES ($1,$2,$3,$4,'draft',NOW()) RETURNING id`,
			policyKey, newVersion, effectiveAt, contentMd).Scan(&newID)
		if err != nil {
			adminLegalPolicyError(w, logger, err)
			return
		}

		afterJSON, _ := json.Marshal(map[string]any{"id": newID, "duplicatedFrom": id})
		if _, err = tx.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
VALUES ('legal.policy.duplicated',$1,$2,'legal.legal_policy',$3,$4,NOW())`, identity.ActorID, newID, "duplicate_from_"+id, afterJSON); err != nil {
			adminLegalPolicyError(w, logger, err)
			return
		}
		if err = tx.Commit(r.Context()); err != nil {
			adminLegalPolicyError(w, logger, err)
			return
		}
		writeJSON(w, http.StatusCreated, map[string]any{"id": newID, "status": "draft", "duplicatedFrom": id})
	}
}

// adminLegalPolicyDeleteHandler implements DELETE /api/admin/legal/policies/{id}.
func adminLegalPolicyDeleteHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return adminLegalPolicyPermission(db, true, func(w http.ResponseWriter, r *http.Request) {
		identity, _ := authn.GetAdminIdentity(r.Context())
		id := extractPathParam(r.URL.Path, "policies", 1)
		if !isValidUUID(id) {
			writeJSONError(w, "valid policy id required", http.StatusBadRequest)
			return
		}
		tx, err := db.Begin(r.Context())
		if err != nil {
			adminLegalPolicyError(w, logger, err)
			return
		}
		defer tx.Rollback(r.Context())
		policy, err := scanAdminLegalPolicy(tx.QueryRow(r.Context(), `SELECT id,policy_key,version,status,effective_at,content_md,created_at FROM legal.legal_policy WHERE id=$1 FOR UPDATE`, id))
		if err != nil {
			adminLegalPolicyError(w, logger, err)
			return
		}
		if policy.Status != "draft" {
			writeJSONError(w, "only draft policies can be deleted", http.StatusBadRequest)
			return
		}
		if _, err := tx.Exec(r.Context(), "DELETE FROM legal.legal_policy WHERE id=$1", id); err != nil {
			adminLegalPolicyError(w, logger, err)
			return
		}
		before, _ := json.Marshal(policy)
		if _, err := tx.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action,actor_id,target_id,target_type,reason,before)
VALUES ('legal.policy.deleted',$1,$2,'legal.legal_policy','delete_draft',$3)`, identity.ActorID, id, before); err != nil {
			adminLegalPolicyError(w, logger, err)
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			adminLegalPolicyError(w, logger, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]bool{"deleted": true})
	})
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
