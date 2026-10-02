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

// ── P1-A5.1: Admin Monetization — Core Sub-Domain (7 routes) ───────────────
// All routes require admin session + appropriate permissions.
// Contracts derived from NestJS apps/api/src/monetization/monetization-admin-console.service.ts
// overview, summary (alias), analytics, audit, plans list, plans create, plans patch.

// adminMonetizationOverviewHandler implements GET /api/admin/monetization/overview.
func adminMonetizationOverviewHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()

		type KPIs struct {
			TotalUsers            int     `json:"totalUsers"`
			FreeUsersActive       int     `json:"freeUsersActiveOnFreePlan"`
			PaidUsersActive       int     `json:"paidUsersActive"`
			TrialUsers            int     `json:"trialUsers"`
			ConversionRatePercent float64 `json:"conversionRatePercent"`
			ActiveSubscriptions   int     `json:"activeSubscriptions"`
			PastDueSubscriptions  int     `json:"pastDueSubscriptions"`
			QuotaWarningUsers     *int    `json:"quotaWarningUsers"`
			AdsEnabledPlacements  int     `json:"adsEnabledPlacements"`
		}

		type PlanDist struct {
			PlanSlug string `json:"planSlug"`
			Status   string `json:"status"`
			Count    int    `json:"count"`
		}

		type TrendPoint struct {
			Day   string `json:"day"`
			Count int    `json:"count"`
		}

		type PaywallFunnel struct {
			PaywallViews     int `json:"paywallViews"`
			CheckoutSessions int `json:"checkoutSessions"`
		}

		type Charts struct {
			PlanDistribution  []PlanDist    `json:"planDistribution"`
			SubscriptionTrend []TrendPoint  `json:"subscriptionTrend"`
			PaywallFunnel     PaywallFunnel `json:"paywallFunnel"`
		}

		type Tasks struct {
			PlansMissingEntitlementCount  int      `json:"plansMissingEntitlementCount"`
			PlansMissingEntitlementIds    []string `json:"plansMissingEntitlementIds"`
			QuotasNearExhaustionAvailable bool     `json:"quotasNearExhaustionAvailable"`
			FailedBillingSyncAvailable    bool     `json:"failedBillingSyncAvailable"`
			DisabledAdPlacements          int      `json:"disabledAdPlacements"`
		}

		type Overview struct {
			KPIs      KPIs            `json:"kpis"`
			Charts    Charts          `json:"charts"`
			Tasks     Tasks           `json:"tasks"`
			DataNotes map[string]bool `json:"dataNotes"`
		}

		var ov Overview
		ov.DataNotes = map[string]bool{"quotaPressureNeedsRollup": true}
		ov.Tasks.QuotasNearExhaustionAvailable = false
		ov.Tasks.FailedBillingSyncAvailable = false

		// KPIs
		db.QueryRow(ctx, "SELECT COUNT(*) FROM profile.user_profile").Scan(&ov.KPIs.TotalUsers)
		db.QueryRow(ctx, "SELECT COUNT(*) FROM monetization.user_subscription WHERE status IN ('active','trialing')").Scan(&ov.KPIs.ActiveSubscriptions)
		db.QueryRow(ctx, "SELECT COUNT(*) FROM monetization.user_subscription WHERE status = 'past_due'").Scan(&ov.KPIs.PastDueSubscriptions)
		db.QueryRow(ctx, "SELECT COUNT(*) FROM monetization.ad_placement WHERE active = true").Scan(&ov.KPIs.AdsEnabledPlacements)

		// Free plan ID
		var freePlanID *string
		db.QueryRow(ctx, "SELECT id FROM monetization.plan WHERE slug = 'free' LIMIT 1").Scan(&freePlanID)

		if freePlanID != nil {
			db.QueryRow(ctx, "SELECT COUNT(*) FROM monetization.user_subscription WHERE status IN ('active','trialing') AND plan_id != $1", *freePlanID).Scan(&ov.KPIs.PaidUsersActive)
			db.QueryRow(ctx, "SELECT COUNT(*) FROM monetization.user_subscription WHERE status IN ('active','trialing') AND plan_id = $1", *freePlanID).Scan(&ov.KPIs.FreeUsersActive)
		}

		// Trial users
		db.QueryRow(ctx, "SELECT COUNT(*) FROM monetization.user_subscription WHERE status = 'trialing'").Scan(&ov.KPIs.TrialUsers)

		// Conversion rate
		denom := ov.KPIs.PaidUsersActive + ov.KPIs.FreeUsersActive
		if denom > 0 {
			ov.KPIs.ConversionRatePercent = float64(ov.KPIs.PaidUsersActive) / float64(denom) * 100
			ov.KPIs.ConversionRatePercent = float64(int(ov.KPIs.ConversionRatePercent*100)) / 100
		}

		// Plan distribution
		distRows, err := db.Query(ctx, `
			SELECT p.slug, us.status, COUNT(*) as cnt
			FROM monetization.user_subscription us
			JOIN monetization.plan p ON p.id = us.plan_id
			GROUP BY p.slug, us.status
			ORDER BY p.slug, us.status`)
		if err == nil {
			for distRows.Next() {
				var pd PlanDist
				if distRows.Scan(&pd.PlanSlug, &pd.Status, &pd.Count) == nil {
					ov.Charts.PlanDistribution = append(ov.Charts.PlanDistribution, pd)
				}
			}
			distRows.Close()
		}
		if ov.Charts.PlanDistribution == nil {
			ov.Charts.PlanDistribution = []PlanDist{}
		}

		// Subscription trend (last 14 days)
		trendRows, err := db.Query(ctx, `
			SELECT date_trunc('day', created_at)::date as day, COUNT(*)::int as count
			FROM monetization.user_subscription
			WHERE created_at >= NOW() - INTERVAL '14 days'
			GROUP BY 1 ORDER BY 1 ASC`)
		if err == nil {
			for trendRows.Next() {
				var tp TrendPoint
				var day time.Time
				if trendRows.Scan(&day, &tp.Count) == nil {
					tp.Day = day.Format("2006-01-02")
					ov.Charts.SubscriptionTrend = append(ov.Charts.SubscriptionTrend, tp)
				}
			}
			trendRows.Close()
		}
		if ov.Charts.SubscriptionTrend == nil {
			ov.Charts.SubscriptionTrend = []TrendPoint{}
		}

		// Paywall funnel
		db.QueryRow(ctx, "SELECT COUNT(*) FROM analytics.event WHERE event_name = 'monetization_paywall_view'").Scan(&ov.Charts.PaywallFunnel.PaywallViews)
		db.QueryRow(ctx, "SELECT COUNT(*) FROM analytics.event WHERE event_name = 'monetization_checkout_session'").Scan(&ov.Charts.PaywallFunnel.CheckoutSessions)

		// Plans missing entitlements
		missingRows, err := db.Query(ctx, `
			SELECT p.id FROM monetization.plan p
			WHERE NOT EXISTS (SELECT 1 FROM monetization.plan_entitlement pe WHERE pe.plan_id = p.id)`)
		if err == nil {
			for missingRows.Next() {
				var pid string
				if missingRows.Scan(&pid) == nil {
					ov.Tasks.PlansMissingEntitlementIds = append(ov.Tasks.PlansMissingEntitlementIds, pid)
				}
			}
			missingRows.Close()
		}
		ov.Tasks.PlansMissingEntitlementCount = len(ov.Tasks.PlansMissingEntitlementIds)
		if ov.Tasks.PlansMissingEntitlementIds == nil {
			ov.Tasks.PlansMissingEntitlementIds = []string{}
		}

		// Disabled ad placements
		db.QueryRow(ctx, "SELECT COUNT(*) FROM monetization.ad_placement WHERE active = false").Scan(&ov.Tasks.DisabledAdPlacements)

		writeJSON(w, http.StatusOK, ov)
	}
}

// adminMonetizationSummaryHandler implements GET /api/admin/monetization/summary.
// Alias for overview — same contract.
func adminMonetizationSummaryHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return adminMonetizationOverviewHandler(db, logger)
}

// adminMonetizationAnalyticsHandler implements GET /api/admin/monetization/analytics.
func adminMonetizationAnalyticsHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()

		type EventCount struct {
			Name  string `json:"name"`
			Count int    `json:"count"`
		}

		type Analytics struct {
			BillingProviderConnected bool         `json:"billingProviderConnected"`
			WindowDays               int          `json:"windowDays"`
			EventsByName             []EventCount `json:"eventsByName"`
			RevenuePlaceholder       *string      `json:"revenuePlaceholder"`
		}

		var a Analytics
		a.BillingProviderConnected = true
		a.WindowDays = 30

		rows, err := db.Query(ctx, `
			SELECT event_name, COUNT(*)::int as cnt
			FROM analytics.event
			WHERE created_at >= NOW() - INTERVAL '30 days'
			  AND event_name LIKE 'monetization_%'
			GROUP BY event_name
			ORDER BY event_name`)
		if err == nil {
			for rows.Next() {
				var ec EventCount
				if rows.Scan(&ec.Name, &ec.Count) == nil {
					a.EventsByName = append(a.EventsByName, ec)
				}
			}
			rows.Close()
		}
		if a.EventsByName == nil {
			a.EventsByName = []EventCount{}
		}

		writeJSON(w, http.StatusOK, a)
	}
}

// adminMonetizationAuditHandler implements GET /api/admin/monetization/audit.
func adminMonetizationAuditHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		actionFilter := r.URL.Query().Get("action")
		fromStr := r.URL.Query().Get("from")
		toStr := r.URL.Query().Get("to")
		take := queryInt(r, "take", 50)
		if take < 1 || take > 200 {
			take = 50
		}

		type AuditItem struct {
			ID         string          `json:"id"`
			Source     string          `json:"source"`
			Action     string          `json:"action"`
			ActorID    *string         `json:"actorId,omitempty"`
			UserID     *string         `json:"userId,omitempty"`
			ActorKind  *string         `json:"actorKind,omitempty"`
			TargetID   *string         `json:"targetId,omitempty"`
			TargetType *string         `json:"targetType,omitempty"`
			Payload    json.RawMessage `json:"payload,omitempty"`
			At         string          `json:"at"`
		}

		whereParts := []string{}
		args := []any{}
		argIdx := 1

		if actionFilter != "" {
			whereParts = append(whereParts, fmt.Sprintf("(a.action ILIKE $%d OR a.target_type ILIKE $%d)", argIdx, argIdx))
			args = append(args, "%"+actionFilter+"%")
			argIdx++
		}
		if fromStr != "" {
			whereParts = append(whereParts, fmt.Sprintf("a.created_at >= $%d", argIdx))
			args = append(args, fromStr)
			argIdx++
		}
		if toStr != "" {
			whereParts = append(whereParts, fmt.Sprintf("a.created_at <= $%d", argIdx))
			args = append(args, toStr)
			argIdx++
		}

		whereClause := ""
		if len(whereParts) > 0 {
			whereClause = "WHERE " + strings.Join(whereParts, " AND ")
		}

		// Admin audit logs related to monetization
		adminQuery := fmt.Sprintf(`
			SELECT a.id, 'ops.admin_audit' as source, a.action, a.actor_id,
			       NULL::text as user_id, NULL::text as actor_kind,
			       a.target_id, a.target_type, NULL::jsonb as payload,
			       a.created_at
			FROM ops.admin_audit_log a
			%s AND (a.target_type ILIKE '%%monetization%%' OR a.action ILIKE '%%monetization%%' OR a.action ILIKE '%%billing%%')
			ORDER BY a.created_at DESC LIMIT $%d`,
			strings.Replace(whereClause, "WHERE", "WHERE", 1), argIdx)
		if whereClause == "" {
			adminQuery = fmt.Sprintf(`
				SELECT a.id, 'ops.admin_audit' as source, a.action, a.actor_id,
				       NULL::text as user_id, NULL::text as actor_kind,
				       a.target_id, a.target_type, NULL::jsonb as payload,
				       a.created_at
				FROM ops.admin_audit_log a
				WHERE (a.target_type ILIKE '%%monetization%%' OR a.action ILIKE '%%monetization%%' OR a.action ILIKE '%%billing%%')
				ORDER BY a.created_at DESC LIMIT $1`)
			args = []any{take}
			argIdx = 2
		} else {
			args = append(args, take)
		}

		var items []AuditItem

		rows, err := db.Query(ctx, adminQuery, args...)
		if err == nil {
			for rows.Next() {
				var ai AuditItem
				var ts time.Time
				if rows.Scan(&ai.ID, &ai.Source, &ai.Action, &ai.ActorID,
					&ai.UserID, &ai.ActorKind, &ai.TargetID, &ai.TargetType,
					&ai.Payload, &ts) == nil {
					ai.At = ts.UTC().Format(time.RFC3339)
					items = append(items, ai)
				}
			}
			rows.Close()
		}

		// Monetization-specific audit logs
		mWhereParts := []string{}
		mArgs := []any{}
		mArgIdx := 1
		if fromStr != "" {
			mWhereParts = append(mWhereParts, fmt.Sprintf("created_at >= $%d", mArgIdx))
			mArgs = append(mArgs, fromStr)
			mArgIdx++
		}
		if toStr != "" {
			mWhereParts = append(mWhereParts, fmt.Sprintf("created_at <= $%d", mArgIdx))
			mArgs = append(mArgs, toStr)
			mArgIdx++
		}
		mWhereClause := ""
		if len(mWhereParts) > 0 {
			mWhereClause = "WHERE " + strings.Join(mWhereParts, " AND ")
		}
		mQuery := fmt.Sprintf(`
			SELECT id, 'monetization.audit' as source, action, NULL::text as actor_id,
			       user_id, actor_kind, NULL::text as target_id, NULL::text as target_type,
			       payload, created_at
			FROM monetization.monetization_audit_log %s
			ORDER BY created_at DESC LIMIT $%d`, mWhereClause, mArgIdx)
		mArgs = append(mArgs, take)

		mRows, err := db.Query(ctx, mQuery, mArgs...)
		if err == nil {
			for mRows.Next() {
				var ai AuditItem
				var ts time.Time
				if mRows.Scan(&ai.ID, &ai.Source, &ai.Action, &ai.ActorID,
					&ai.UserID, &ai.ActorKind, &ai.TargetID, &ai.TargetType,
					&ai.Payload, &ts) == nil {
					ai.At = ts.UTC().Format(time.RFC3339)
					items = append(items, ai)
				}
			}
			mRows.Close()
		}

		if items == nil {
			items = []AuditItem{}
		}

		writeJSON(w, http.StatusOK, map[string]any{"items": items})
	}
}

// adminMonetizationPlansListHandler implements GET /api/admin/monetization/plans.
func adminMonetizationPlansListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()

		type PlanEntitlement struct {
			ID          string  `json:"id"`
			Key         string  `json:"key"`
			Category    *string `json:"category,omitempty"`
			Description *string `json:"description,omitempty"`
		}

		type PlanQuota struct {
			ID            string `json:"id"`
			QuotaPolicyID string `json:"quotaPolicyId"`
			LimitValue    int    `json:"limitValue"`
		}

		type Plan struct {
			ID                 string            `json:"id"`
			Slug               string            `json:"slug"`
			NameKey            string            `json:"nameKey"`
			Status             string            `json:"status"`
			Config             json.RawMessage   `json:"config,omitempty"`
			SortOrder          int               `json:"sortOrder"`
			Entitlements       []PlanEntitlement `json:"entitlements"`
			PlanQuotas         []PlanQuota       `json:"planQuotas"`
			SubscriptionsCount int               `json:"subscriptionsCount"`
			CreatedAt          string            `json:"createdAt"`
			UpdatedAt          string            `json:"updatedAt"`
		}

		rows, err := db.Query(ctx, `
			SELECT p.id, p.slug, p.name_key, p.status, p.config, p.sort_order,
			       p.created_at, p.updated_at,
			       (SELECT COUNT(*) FROM monetization.user_subscription us WHERE us.plan_id = p.id) as sub_count
			FROM monetization.plan p
			ORDER BY p.sort_order ASC, p.created_at ASC`)
		if err != nil {
			logger.Error("list monetization plans", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		var plans []Plan
		for rows.Next() {
			var pl Plan
			var createdAt, updatedAt time.Time
			var configBytes []byte
			if err := rows.Scan(&pl.ID, &pl.Slug, &pl.NameKey, &pl.Status,
				&configBytes, &pl.SortOrder, &createdAt, &updatedAt,
				&pl.SubscriptionsCount); err == nil {
				pl.CreatedAt = createdAt.UTC().Format(time.RFC3339)
				pl.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
				if configBytes != nil {
					pl.Config = configBytes
				} else {
					pl.Config = json.RawMessage("{}")
				}

				// Entitlements
				eRows, eErr := db.Query(ctx, `
					SELECT ed.id, ed.key, ed.category, ed.description
					FROM monetization.plan_entitlement pe
					JOIN monetization.entitlement_definition ed ON ed.id = pe.entitlement_id
					WHERE pe.plan_id = $1`, pl.ID)
				if eErr == nil {
					for eRows.Next() {
						var ent PlanEntitlement
						if eRows.Scan(&ent.ID, &ent.Key, &ent.Category, &ent.Description) == nil {
							pl.Entitlements = append(pl.Entitlements, ent)
						}
					}
					eRows.Close()
				}
				if pl.Entitlements == nil {
					pl.Entitlements = []PlanEntitlement{}
				}

				// Plan quotas
				qRows, qErr := db.Query(ctx, `
					SELECT pq.id, pq.quota_policy_id, pq.limit_value
					FROM monetization.plan_quota pq
					WHERE pq.plan_id = $1`, pl.ID)
				if qErr == nil {
					for qRows.Next() {
						var pq PlanQuota
						if qRows.Scan(&pq.ID, &pq.QuotaPolicyID, &pq.LimitValue) == nil {
							pl.PlanQuotas = append(pl.PlanQuotas, pq)
						}
					}
					qRows.Close()
				}
				if pl.PlanQuotas == nil {
					pl.PlanQuotas = []PlanQuota{}
				}

				plans = append(plans, pl)
			}
		}
		if plans == nil {
			plans = []Plan{}
		}

		writeJSON(w, http.StatusOK, plans)
	}
}

// adminMonetizationPlansCreateHandler implements POST /api/admin/monetization/plans.
func adminMonetizationPlansCreateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		var req struct {
			Slug    string          `json:"slug"`
			NameKey string          `json:"nameKey"`
			Status  string          `json:"status"`
			Config  json.RawMessage `json:"config"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.Slug == "" || req.NameKey == "" {
			writeJSONError(w, "slug and nameKey are required", http.StatusBadRequest)
			return
		}
		if req.Status == "" {
			req.Status = "draft"
		}
		configJSON := req.Config
		if configJSON == nil {
			configJSON = json.RawMessage("{}")
		}

		ctx := r.Context()
		var createdID string
		err := db.QueryRow(ctx, `
			INSERT INTO monetization.plan (slug, name_key, status, config, created_at, updated_at)
			VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING id`,
			req.Slug, req.NameKey, req.Status, configJSON).Scan(&createdID)
		if err != nil {
			logger.Error("create monetization plan", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		afterJSON, _ := json.Marshal(map[string]any{"slug": req.Slug, "nameKey": req.NameKey, "status": req.Status})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('admin.monetization.plan.created', $1, $2, 'monetization.plan', $3, $4, NOW())`,
			identity.ActorID, createdID, "plan created via admin console", afterJSON)

		writeJSON(w, http.StatusCreated, map[string]any{"id": createdID, "slug": req.Slug, "nameKey": req.NameKey, "status": req.Status})
	}
}

// adminMonetizationPlansPatchHandler implements PATCH /api/admin/monetization/plans/{id}.
func adminMonetizationPlansPatchHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		id := extractPathParam(r.URL.Path, "plans", 1)
		if id == "" {
			writeJSONError(w, "plan id required", http.StatusBadRequest)
			return
		}

		var req struct {
			NameKey   *string         `json:"nameKey,omitempty"`
			Status    *string         `json:"status,omitempty"`
			Config    json.RawMessage `json:"config,omitempty"`
			SortOrder *int            `json:"sortOrder,omitempty"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}

		ctx := r.Context()
		var exists bool
		db.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM monetization.plan WHERE id = $1)", id).Scan(&exists)
		if !exists {
			writeJSONError(w, "plan not found", http.StatusNotFound)
			return
		}

		setClauses := []string{}
		args := []any{}
		argIdx := 1

		if req.NameKey != nil {
			setClauses = append(setClauses, "name_key = $"+itoa(argIdx))
			args = append(args, *req.NameKey)
			argIdx++
		}
		if req.Status != nil {
			setClauses = append(setClauses, "status = $"+itoa(argIdx))
			args = append(args, *req.Status)
			argIdx++
		}
		if req.Config != nil {
			setClauses = append(setClauses, "config = $"+itoa(argIdx))
			args = append(args, req.Config)
			argIdx++
		}
		if req.SortOrder != nil {
			setClauses = append(setClauses, "sort_order = $"+itoa(argIdx))
			args = append(args, *req.SortOrder)
			argIdx++
		}

		if len(setClauses) == 0 {
			writeJSONError(w, "at least one field to update is required", http.StatusBadRequest)
			return
		}

		setClauses = append(setClauses, "updated_at = NOW()")
		query := "UPDATE monetization.plan SET " + joinStrings(setClauses, ", ") +
			" WHERE id = $" + itoa(argIdx)
		args = append(args, id)

		if _, err := db.Exec(ctx, query, args...); err != nil {
			logger.Error("patch monetization plan", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		afterJSON, _ := json.Marshal(map[string]any{"updated": true, "fields": setClauses})
		beforeJSON, _ := json.Marshal(map[string]any{"id": id})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, before, created_at)
			VALUES ('admin.monetization.plan.updated', $1, $2, 'monetization.plan', $3, $4, $5, NOW())`,
			identity.ActorID, id, "plan updated via admin console", afterJSON, beforeJSON)

		writeJSON(w, http.StatusOK, map[string]any{"id": id, "updated": true})
	}
}
