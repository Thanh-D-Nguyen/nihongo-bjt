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

// ── P1-A5.2: Admin Monetization — Entitlements + Quotas Sub-Domain (11 routes) ─
// All routes require admin session + appropriate permissions.
// Contracts derived from NestJS apps/api/src/monetization/monetization-admin-console.service.ts
// entitlements catalog, create entitlement, link/unlink plan entitlement,
// quota policies list/create/update, link plan quota,
// quota overrides list/create/delete.

// adminMonetizationEntitlementsListHandler implements GET /api/admin/monetization/entitlements.
func adminMonetizationEntitlementsListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		type Entitlement struct {
			ID          string  `json:"id"`
			Key         string  `json:"key"`
			Category    *string `json:"category,omitempty"`
			Description *string `json:"description,omitempty"`
			PlansCount  int     `json:"plansCount"`
		}
		rows, err := db.Query(ctx, `
			SELECT ed.id, ed.key, ed.category, ed.description,
				(SELECT COUNT(*) FROM monetization.plan_entitlement pe WHERE pe.entitlement_id = ed.id) as plans_count
			FROM monetization.entitlement_definition ed
			ORDER BY ed.key ASC`)
		if err != nil {
			logger.Error("list entitlements", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		var items []Entitlement
		for rows.Next() {
			var e Entitlement
			if err := rows.Scan(&e.ID, &e.Key, &e.Category, &e.Description, &e.PlansCount); err == nil {
				items = append(items, e)
			}
		}
		if items == nil {
			items = []Entitlement{}
		}
		writeJSON(w, http.StatusOK, items)
	}
}

// adminMonetizationEntitlementsCreateHandler implements POST /api/admin/monetization/entitlements.
func adminMonetizationEntitlementsCreateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			Key         string  `json:"key"`
			Category    *string `json:"category,omitempty"`
			Description *string `json:"description,omitempty"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.Key == "" {
			writeJSONError(w, "key is required", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		var createdID string
		err := db.QueryRow(ctx, `
			INSERT INTO monetization.entitlement_definition (key, category, description)
			VALUES ($1, $2, $3) RETURNING id`,
			req.Key, req.Category, req.Description).Scan(&createdID)
		if err != nil {
			logger.Error("create entitlement", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		afterJSON, _ := json.Marshal(map[string]any{"key": req.Key})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('admin.monetization.entitlement.created', $1, $2, 'monetization.entitlement_definition', $3, $4, NOW())`,
			identity.ActorID, createdID, "entitlement created", afterJSON)
		writeJSON(w, http.StatusCreated, map[string]any{"id": createdID, "key": req.Key})
	}
}

// adminMonetizationPlanEntitlementLinkHandler implements POST /api/admin/monetization/plans/{planId}/entitlements.
func adminMonetizationPlanEntitlementLinkHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		planID := extractPathParam(r.URL.Path, "plans", 2) // .../plans/{planId}/entitlements
		if planID == "" {
			writeJSONError(w, "plan id required", http.StatusBadRequest)
			return
		}
		var req struct {
			EntitlementID string `json:"entitlementId"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.EntitlementID == "" {
			writeJSONError(w, "entitlementId is required", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		_, err := db.Exec(ctx, `
			INSERT INTO monetization.plan_entitlement (plan_id, entitlement_id)
			VALUES ($1, $2) ON CONFLICT DO NOTHING`, planID, req.EntitlementID)
		if err != nil {
			logger.Error("link plan entitlement", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		afterJSON, _ := json.Marshal(map[string]any{"planId": planID, "entitlementId": req.EntitlementID})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('admin.monetization.plan_entitlement.linked', $1, $2, 'monetization.plan_entitlement', $3, $4, NOW())`,
			identity.ActorID, planID, "plan entitlement linked", afterJSON)
		writeJSON(w, http.StatusOK, map[string]any{"linked": true, "planId": planID, "entitlementId": req.EntitlementID})
	}
}

// adminMonetizationPlanEntitlementUnlinkHandler implements DELETE /api/admin/monetization/plans/{planId}/entitlements/{entitlementId}.
func adminMonetizationPlanEntitlementUnlinkHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		// Extract planId and entitlementId from path: .../plans/{planId}/entitlements/{entitlementId}
		parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		var planID, entitlementID string
		for i, p := range parts {
			if p == "plans" && i+1 < len(parts) {
				planID = parts[i+1]
			}
			if p == "entitlements" && i+1 < len(parts) {
				entitlementID = parts[i+1]
			}
		}
		if planID == "" || entitlementID == "" {
			writeJSONError(w, "plan id and entitlement id required", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		db.Exec(ctx, `DELETE FROM monetization.plan_entitlement WHERE plan_id = $1 AND entitlement_id = $2`, planID, entitlementID)
		afterJSON, _ := json.Marshal(map[string]any{"planId": planID, "entitlementId": entitlementID})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('admin.monetization.plan_entitlement.unlinked', $1, $2, 'monetization.plan_entitlement', $3, $4, NOW())`,
			identity.ActorID, planID, "plan entitlement unlinked", afterJSON)
		writeJSON(w, http.StatusOK, map[string]any{"unlinked": true, "planId": planID, "entitlementId": entitlementID})
	}
}

// adminMonetizationQuotasListHandler implements GET /api/admin/monetization/quotas.
func adminMonetizationQuotasListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		type QuotaPolicy struct {
			ID                   string  `json:"id"`
			Key                  string  `json:"key"`
			Description          *string `json:"description,omitempty"`
			WindowCode           string  `json:"windowCode"`
			WarnThresholdPercent *int    `json:"warnThresholdPercent,omitempty"`
		}
		type PlanQuota struct {
			ID            string `json:"id"`
			PlanID        string `json:"planId"`
			PlanSlug      string `json:"planSlug"`
			QuotaPolicyID string `json:"quotaPolicyId"`
			LimitValue    int    `json:"limitValue"`
		}
		policyRows, err := db.Query(ctx, `SELECT id, key, description, window_code, warn_threshold_percent FROM monetization.quota_policy ORDER BY key ASC`)
		if err != nil {
			logger.Error("list quota policies", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer policyRows.Close()
		var policies []QuotaPolicy
		for policyRows.Next() {
			var qp QuotaPolicy
			if err := policyRows.Scan(&qp.ID, &qp.Key, &qp.Description, &qp.WindowCode, &qp.WarnThresholdPercent); err == nil {
				policies = append(policies, qp)
			}
		}
		if policies == nil {
			policies = []QuotaPolicy{}
		}
		pqRows, err := db.Query(ctx, `
			SELECT pq.id, pq.plan_id, p.slug, pq.quota_policy_id, pq.limit_value
			FROM monetization.plan_quota pq
			JOIN monetization.plan p ON p.id = pq.plan_id
			ORDER BY p.sort_order ASC, pq.quota_policy_id ASC`)
		if err != nil {
			logger.Error("list plan quotas", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer pqRows.Close()
		var planQuotas []PlanQuota
		for pqRows.Next() {
			var pq PlanQuota
			if err := pqRows.Scan(&pq.ID, &pq.PlanID, &pq.PlanSlug, &pq.QuotaPolicyID, &pq.LimitValue); err == nil {
				planQuotas = append(planQuotas, pq)
			}
		}
		if planQuotas == nil {
			planQuotas = []PlanQuota{}
		}
		writeJSON(w, http.StatusOK, map[string]any{"policies": policies, "planQuotas": planQuotas})
	}
}

// adminMonetizationQuotaPoliciesCreateHandler implements POST /api/admin/monetization/quotas/policies.
func adminMonetizationQuotaPoliciesCreateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			Key                  string  `json:"key"`
			Description          *string `json:"description,omitempty"`
			WindowCode           string  `json:"windowCode"`
			WarnThresholdPercent *int    `json:"warnThresholdPercent,omitempty"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.Key == "" || req.WindowCode == "" {
			writeJSONError(w, "key and windowCode are required", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		var createdID string
		err := db.QueryRow(ctx, `
			INSERT INTO monetization.quota_policy (key, description, window_code, warn_threshold_percent)
			VALUES ($1, $2, $3, $4) RETURNING id`,
			req.Key, req.Description, req.WindowCode, req.WarnThresholdPercent).Scan(&createdID)
		if err != nil {
			logger.Error("create quota policy", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		afterJSON, _ := json.Marshal(map[string]any{"key": req.Key, "windowCode": req.WindowCode})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('admin.monetization.quota_policy.created', $1, $2, 'monetization.quota_policy', $3, $4, NOW())`,
			identity.ActorID, createdID, "quota policy created", afterJSON)
		writeJSON(w, http.StatusCreated, map[string]any{"id": createdID, "key": req.Key})
	}
}

// adminMonetizationQuotaPoliciesPatchHandler implements PATCH /api/admin/monetization/quotas/policies/{id}.
func adminMonetizationQuotaPoliciesPatchHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
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
		var req struct {
			Description          *string `json:"description,omitempty"`
			WindowCode           *string `json:"windowCode,omitempty"`
			WarnThresholdPercent *int    `json:"warnThresholdPercent,omitempty"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		var exists bool
		db.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM monetization.quota_policy WHERE id = $1)", id).Scan(&exists)
		if !exists {
			writeJSONError(w, "quota policy not found", http.StatusNotFound)
			return
		}
		setClauses := []string{}
		args := []any{}
		argIdx := 1
		if req.Description != nil {
			setClauses = append(setClauses, "description = $"+itoa(argIdx))
			args = append(args, *req.Description)
			argIdx++
		}
		if req.WindowCode != nil {
			setClauses = append(setClauses, "window_code = $"+itoa(argIdx))
			args = append(args, *req.WindowCode)
			argIdx++
		}
		if req.WarnThresholdPercent != nil {
			setClauses = append(setClauses, "warn_threshold_percent = $"+itoa(argIdx))
			args = append(args, *req.WarnThresholdPercent)
			argIdx++
		}
		if len(setClauses) == 0 {
			writeJSONError(w, "at least one field to update is required", http.StatusBadRequest)
			return
		}
		query := "UPDATE monetization.quota_policy SET " + joinStrings(setClauses, ", ") +
			" WHERE id = $" + itoa(argIdx)
		args = append(args, id)
		if _, err := db.Exec(ctx, query, args...); err != nil {
			logger.Error("patch quota policy", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		afterJSON, _ := json.Marshal(map[string]any{"updated": true})
		beforeJSON, _ := json.Marshal(map[string]any{"id": id})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, before, created_at)
			VALUES ('admin.monetization.quota_policy.updated', $1, $2, 'monetization.quota_policy', $3, $4, $5, NOW())`,
			identity.ActorID, id, "quota policy updated", afterJSON, beforeJSON)
		writeJSON(w, http.StatusOK, map[string]any{"id": id, "updated": true})
	}
}

// adminMonetizationQuotaPlanLinksCreateHandler implements POST /api/admin/monetization/quotas/plan-links.
func adminMonetizationQuotaPlanLinksCreateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			PlanID        string `json:"planId"`
			QuotaPolicyID string `json:"quotaPolicyId"`
			LimitValue    int    `json:"limitValue"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.PlanID == "" || req.QuotaPolicyID == "" {
			writeJSONError(w, "planId and quotaPolicyId are required", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		var createdID string
		err := db.QueryRow(ctx, `
			INSERT INTO monetization.plan_quota (plan_id, quota_policy_id, limit_value)
			VALUES ($1, $2, $3) RETURNING id`,
			req.PlanID, req.QuotaPolicyID, req.LimitValue).Scan(&createdID)
		if err != nil {
			logger.Error("create plan quota link", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		afterJSON, _ := json.Marshal(map[string]any{"planId": req.PlanID, "quotaPolicyId": req.QuotaPolicyID, "limitValue": req.LimitValue})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('admin.monetization.plan_quota.created', $1, $2, 'monetization.plan_quota', $3, $4, NOW())`,
			identity.ActorID, createdID, "plan quota linked", afterJSON)
		writeJSON(w, http.StatusCreated, map[string]any{"id": createdID, "planId": req.PlanID, "quotaPolicyId": req.QuotaPolicyID})
	}
}

// adminMonetizationQuotaOverridesListHandler implements GET /api/admin/monetization/quota-overrides.
func adminMonetizationQuotaOverridesListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		type Override struct {
			ID               string  `json:"id"`
			UserID           string  `json:"userId"`
			UserEmail        *string `json:"userEmail,omitempty"`
			UserDisplayName  *string `json:"userDisplayName,omitempty"`
			QuotaKey         string  `json:"quotaKey"`
			LimitValue       int     `json:"limitValue"`
			Reason           string  `json:"reason"`
			CreatedByActorID string  `json:"createdByActorId"`
			ExpiresAt        *string `json:"expiresAt,omitempty"`
			CreatedAt        string  `json:"createdAt"`
		}
		rows, err := db.Query(ctx, `
			SELECT qo.id, qo.user_id, up.email, up.display_name,
				qo.quota_key, qo.limit_value, qo.reason, qo.created_by_actor_id,
				qo.expires_at, qo.created_at
			FROM monetization.quota_user_override qo
			LEFT JOIN profile.user_profile up ON up.id = qo.user_id
			ORDER BY qo.created_at DESC LIMIT 200`)
		if err != nil {
			logger.Error("list quota overrides", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		var items []Override
		for rows.Next() {
			var o Override
			var createdAt time.Time
			var expiresAt *time.Time
			if err := rows.Scan(&o.ID, &o.UserID, &o.UserEmail, &o.UserDisplayName,
				&o.QuotaKey, &o.LimitValue, &o.Reason, &o.CreatedByActorID,
				&expiresAt, &createdAt); err == nil {
				o.CreatedAt = createdAt.UTC().Format(time.RFC3339)
				if expiresAt != nil {
					s := expiresAt.UTC().Format(time.RFC3339)
					o.ExpiresAt = &s
				}
				items = append(items, o)
			}
		}
		if items == nil {
			items = []Override{}
		}
		writeJSON(w, http.StatusOK, items)
	}
}

// adminMonetizationQuotaOverridesCreateHandler implements POST /api/admin/monetization/quota-overrides.
func adminMonetizationQuotaOverridesCreateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			UserID     string  `json:"userId"`
			QuotaKey   string  `json:"quotaKey"`
			LimitValue int     `json:"limitValue"`
			Reason     string  `json:"reason"`
			ExpiresAt  *string `json:"expiresAt,omitempty"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.UserID == "" || req.QuotaKey == "" || req.Reason == "" {
			writeJSONError(w, "userId, quotaKey, and reason are required", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		var createdID string
		err := db.QueryRow(ctx, `
			INSERT INTO monetization.quota_user_override (user_id, quota_key, limit_value, reason, created_by_actor_id, expires_at, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING id`,
			req.UserID, req.QuotaKey, req.LimitValue, req.Reason, identity.ActorID, req.ExpiresAt).Scan(&createdID)
		if err != nil {
			logger.Error("create quota override", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		afterJSON, _ := json.Marshal(map[string]any{"userId": req.UserID, "quotaKey": req.QuotaKey, "limitValue": req.LimitValue})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('admin.monetization.quota_override.created', $1, $2, 'monetization.quota_user_override', $3, $4, NOW())`,
			identity.ActorID, createdID, req.Reason, afterJSON)
		writeJSON(w, http.StatusCreated, map[string]any{"id": createdID, "userId": req.UserID, "quotaKey": req.QuotaKey})
	}
}

// adminMonetizationQuotaOverridesDeleteHandler implements DELETE /api/admin/monetization/quota-overrides/{id}.
func adminMonetizationQuotaOverridesDeleteHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "quota-overrides", 1)
		if id == "" {
			writeJSONError(w, "override id required", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		var reason string
		db.QueryRow(ctx, "SELECT reason FROM monetization.quota_user_override WHERE id = $1", id).Scan(&reason)
		db.Exec(ctx, "DELETE FROM monetization.quota_user_override WHERE id = $1", id)
		beforeJSON, _ := json.Marshal(map[string]any{"id": id, "reason": reason})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, before, created_at)
			VALUES ('admin.monetization.quota_override.deleted', $1, $2, 'monetization.quota_user_override', $3, NULL, $4, NOW())`,
			identity.ActorID, id, "quota override deleted", beforeJSON)
		writeJSON(w, http.StatusOK, map[string]any{"deleted": true, "id": id})
	}
}

// Ensure fmt is used.
var _ = fmt.Sprintf
