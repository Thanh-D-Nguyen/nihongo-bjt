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
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
)

// ── P1-A5.1: Admin Monetization — Core Sub-Domain ──────────────────────────
// All routes require admin session + appropriate permissions.
// Contracts derived from NestJS apps/api/src/monetization/monetization-admin-console.service.ts
// overview, summary (alias), analytics, audit, plans list, plans create, plans patch.

// adminMonetizationOverviewHandler implements GET /api/admin/monetization/overview.
func adminMonetizationOverviewHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return adminMonetizationOverviewDataHandler(db, logger, true)
}

func adminMonetizationOverviewDataHandler(db *pgxpool.Pool, logger *slog.Logger, checkPermission bool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if checkPermission && !requireMonetizationPermission(w, r, db, "admin.monetization.read", "billing.plan.view") {
			return
		}
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
		for _, metric := range []struct {
			query string
			dest  *int
		}{
			{"SELECT COUNT(*) FROM profile.user_profile", &ov.KPIs.TotalUsers},
			{"SELECT COUNT(*) FROM monetization.user_subscription WHERE status IN ('active','trialing')", &ov.KPIs.ActiveSubscriptions},
			{"SELECT COUNT(*) FROM monetization.user_subscription WHERE status = 'past_due'", &ov.KPIs.PastDueSubscriptions},
			{"SELECT COUNT(*) FROM monetization.ad_placement WHERE active = true", &ov.KPIs.AdsEnabledPlacements},
		} {
			if err := db.QueryRow(ctx, metric.query).Scan(metric.dest); err != nil {
				adminMonetizationQueryError(w, logger, "load monetization overview metric", err)
				return
			}
		}

		// Free plan ID
		var freePlanID *string
		if err := db.QueryRow(ctx, "SELECT id FROM monetization.plan WHERE slug = 'free' LIMIT 1").Scan(&freePlanID); err != nil && err != pgx.ErrNoRows {
			adminMonetizationQueryError(w, logger, "load free monetization plan", err)
			return
		}

		if freePlanID != nil {
			if err := db.QueryRow(ctx, "SELECT COUNT(*) FROM monetization.user_subscription WHERE status IN ('active','trialing') AND plan_id != $1", *freePlanID).Scan(&ov.KPIs.PaidUsersActive); err != nil {
				adminMonetizationQueryError(w, logger, "load paid monetization users", err)
				return
			}
			if err := db.QueryRow(ctx, "SELECT COUNT(*) FROM monetization.user_subscription WHERE status IN ('active','trialing') AND plan_id = $1", *freePlanID).Scan(&ov.KPIs.FreeUsersActive); err != nil {
				adminMonetizationQueryError(w, logger, "load free monetization users", err)
				return
			}
		}

		// Trial users
		if err := db.QueryRow(ctx, "SELECT COUNT(*) FROM monetization.user_subscription WHERE status = 'trialing'").Scan(&ov.KPIs.TrialUsers); err != nil {
			adminMonetizationQueryError(w, logger, "load monetization trial users", err)
			return
		}

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
		if err != nil {
			adminMonetizationQueryError(w, logger, "load monetization plan distribution", err)
			return
		}
		for distRows.Next() {
			var pd PlanDist
			if err := distRows.Scan(&pd.PlanSlug, &pd.Status, &pd.Count); err != nil {
				distRows.Close()
				adminMonetizationQueryError(w, logger, "scan monetization plan distribution", err)
				return
			}
			ov.Charts.PlanDistribution = append(ov.Charts.PlanDistribution, pd)
		}
		if err := distRows.Err(); err != nil {
			distRows.Close()
			adminMonetizationQueryError(w, logger, "iterate monetization plan distribution", err)
			return
		}
		distRows.Close()
		if ov.Charts.PlanDistribution == nil {
			ov.Charts.PlanDistribution = []PlanDist{}
		}

		// Subscription trend (last 14 days)
		trendRows, err := db.Query(ctx, `
			SELECT date_trunc('day', created_at)::date as day, COUNT(*)::int as count
			FROM monetization.user_subscription
			WHERE created_at >= NOW() - INTERVAL '14 days'
			GROUP BY 1 ORDER BY 1 ASC`)
		if err != nil {
			adminMonetizationQueryError(w, logger, "load monetization subscription trend", err)
			return
		}
		for trendRows.Next() {
			var tp TrendPoint
			var day time.Time
			if err := trendRows.Scan(&day, &tp.Count); err != nil {
				trendRows.Close()
				adminMonetizationQueryError(w, logger, "scan monetization subscription trend", err)
				return
			}
			tp.Day = day.Format("2006-01-02")
			ov.Charts.SubscriptionTrend = append(ov.Charts.SubscriptionTrend, tp)
		}
		if err := trendRows.Err(); err != nil {
			trendRows.Close()
			adminMonetizationQueryError(w, logger, "iterate monetization subscription trend", err)
			return
		}
		trendRows.Close()
		if ov.Charts.SubscriptionTrend == nil {
			ov.Charts.SubscriptionTrend = []TrendPoint{}
		}

		// Paywall funnel
		if err := db.QueryRow(ctx, "SELECT COUNT(*) FROM analytics.analytics_event WHERE event_name = 'monetization_paywall_view'").Scan(&ov.Charts.PaywallFunnel.PaywallViews); err != nil {
			adminMonetizationQueryError(w, logger, "load monetization paywall views", err)
			return
		}
		if err := db.QueryRow(ctx, "SELECT COUNT(*) FROM analytics.analytics_event WHERE event_name = 'monetization_checkout_session'").Scan(&ov.Charts.PaywallFunnel.CheckoutSessions); err != nil {
			adminMonetizationQueryError(w, logger, "load monetization checkout sessions", err)
			return
		}

		// Plans missing entitlements
		missingRows, err := db.Query(ctx, `
			SELECT p.id FROM monetization.plan p
			WHERE NOT EXISTS (SELECT 1 FROM monetization.plan_entitlement pe WHERE pe.plan_id = p.id)`)
		if err != nil {
			adminMonetizationQueryError(w, logger, "load plans missing entitlements", err)
			return
		}
		for missingRows.Next() {
			var pid string
			if err := missingRows.Scan(&pid); err != nil {
				missingRows.Close()
				adminMonetizationQueryError(w, logger, "scan plans missing entitlements", err)
				return
			}
			ov.Tasks.PlansMissingEntitlementIds = append(ov.Tasks.PlansMissingEntitlementIds, pid)
		}
		if err := missingRows.Err(); err != nil {
			missingRows.Close()
			adminMonetizationQueryError(w, logger, "iterate plans missing entitlements", err)
			return
		}
		missingRows.Close()
		ov.Tasks.PlansMissingEntitlementCount = len(ov.Tasks.PlansMissingEntitlementIds)
		if ov.Tasks.PlansMissingEntitlementIds == nil {
			ov.Tasks.PlansMissingEntitlementIds = []string{}
		}

		// Disabled ad placements
		if err := db.QueryRow(ctx, "SELECT COUNT(*) FROM monetization.ad_placement WHERE active = false").Scan(&ov.Tasks.DisabledAdPlacements); err != nil {
			adminMonetizationQueryError(w, logger, "load disabled monetization placements", err)
			return
		}

		writeJSON(w, http.StatusOK, ov)
	}
}

// adminMonetizationSummaryHandler implements GET /api/admin/monetization/summary.
// Alias for overview — same contract.
func adminMonetizationSummaryHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !requireMonetizationPermission(w, r, db, "admin.monetization.read", "billing.plan.view") {
			return
		}
		adminMonetizationOverviewDataHandler(db, logger, false)(w, r)
	}
}

// adminMonetizationAnalyticsHandler implements GET /api/admin/monetization/analytics.
func adminMonetizationAnalyticsHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !requireMonetizationPermission(w, r, db, "admin.monetization.read", "billing.plan.view") {
			return
		}
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
			FROM analytics.analytics_event
			WHERE created_at >= NOW() - INTERVAL '30 days'
			  AND event_name LIKE 'monetization_%'
			GROUP BY event_name
			ORDER BY event_name`)
		if err != nil {
			adminMonetizationQueryError(w, logger, "load monetization analytics", err)
			return
		}
		for rows.Next() {
			var ec EventCount
			if err := rows.Scan(&ec.Name, &ec.Count); err != nil {
				rows.Close()
				adminMonetizationQueryError(w, logger, "scan monetization analytics", err)
				return
			}
			a.EventsByName = append(a.EventsByName, ec)
		}
		if err := rows.Err(); err != nil {
			rows.Close()
			adminMonetizationQueryError(w, logger, "iterate monetization analytics", err)
			return
		}
		rows.Close()
		if a.EventsByName == nil {
			a.EventsByName = []EventCount{}
		}

		writeJSON(w, http.StatusOK, a)
	}
}

// adminMonetizationAuditHandler implements GET /api/admin/monetization/audit.
func adminMonetizationAuditHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !requireMonetizationPermission(w, r, db, "admin.monetization.read", "billing.plan.view") {
			return
		}
		ctx := r.Context()
		actionFilter := r.URL.Query().Get("action")
		fromStr := r.URL.Query().Get("from")
		toStr := r.URL.Query().Get("to")
		fromTime, err := parseMonetizationAuditTime(fromStr)
		if err != nil {
			writeJSONError(w, "invalid from date", http.StatusBadRequest)
			return
		}
		toTime, err := parseMonetizationAuditTime(toStr)
		if err != nil {
			writeJSONError(w, "invalid to date", http.StatusBadRequest)
			return
		}
		if fromTime != nil && toTime != nil && fromTime.After(*toTime) {
			writeJSONError(w, "from date must not be after to date", http.StatusBadRequest)
			return
		}
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
		if fromTime != nil {
			whereParts = append(whereParts, fmt.Sprintf("a.created_at >= $%d", argIdx))
			args = append(args, *fromTime)
			argIdx++
		}
		if toTime != nil {
			whereParts = append(whereParts, fmt.Sprintf("a.created_at <= $%d", argIdx))
			args = append(args, *toTime)
			argIdx++
		}

		// Admin audit logs related to monetization
		adminFilters := append([]string(nil), whereParts...)
		adminFilters = append(adminFilters, "(a.target_type ILIKE '%%monetization%%' OR a.action ILIKE '%%monetization%%' OR a.action ILIKE '%%billing%%')")
		adminQuery := fmt.Sprintf(`
			SELECT a.id, 'ops.admin_audit' as source, a.action, a.actor_id,
			       NULL::text as user_id, NULL::text as actor_kind,
			       a.target_id, a.target_type, NULL::jsonb as payload,
			       a.created_at
			FROM ops.admin_audit_log a
			WHERE %s
			ORDER BY a.created_at DESC LIMIT $%d`,
			strings.Join(adminFilters, " AND "), argIdx)
		adminArgs := append(append([]any(nil), args...), take)

		var items []AuditItem

		rows, err := db.Query(ctx, adminQuery, adminArgs...)
		if err != nil {
			adminMonetizationQueryError(w, logger, "load admin monetization audit", err)
			return
		}
		for rows.Next() {
			var ai AuditItem
			var ts time.Time
			if err := rows.Scan(&ai.ID, &ai.Source, &ai.Action, &ai.ActorID,
				&ai.UserID, &ai.ActorKind, &ai.TargetID, &ai.TargetType,
				&ai.Payload, &ts); err != nil {
				rows.Close()
				adminMonetizationQueryError(w, logger, "scan admin monetization audit", err)
				return
			}
			ai.At = ts.UTC().Format(time.RFC3339)
			items = append(items, ai)
		}
		if err := rows.Err(); err != nil {
			rows.Close()
			adminMonetizationQueryError(w, logger, "iterate admin monetization audit", err)
			return
		}
		rows.Close()

		// Monetization-specific audit logs
		mWhereParts := []string{}
		mArgs := []any{}
		mArgIdx := 1
		if fromTime != nil {
			mWhereParts = append(mWhereParts, fmt.Sprintf("created_at >= $%d", mArgIdx))
			mArgs = append(mArgs, *fromTime)
			mArgIdx++
		}
		if toTime != nil {
			mWhereParts = append(mWhereParts, fmt.Sprintf("created_at <= $%d", mArgIdx))
			mArgs = append(mArgs, *toTime)
			mArgIdx++
		}
		if actionFilter != "" {
			mWhereParts = append(mWhereParts, fmt.Sprintf("action ILIKE $%d", mArgIdx))
			mArgs = append(mArgs, "%"+actionFilter+"%")
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
		if err != nil {
			adminMonetizationQueryError(w, logger, "load monetization audit", err)
			return
		}
		for mRows.Next() {
			var ai AuditItem
			var ts time.Time
			if err := mRows.Scan(&ai.ID, &ai.Source, &ai.Action, &ai.ActorID,
				&ai.UserID, &ai.ActorKind, &ai.TargetID, &ai.TargetType,
				&ai.Payload, &ts); err != nil {
				mRows.Close()
				adminMonetizationQueryError(w, logger, "scan monetization audit", err)
				return
			}
			ai.At = ts.UTC().Format(time.RFC3339)
			items = append(items, ai)
		}
		if err := mRows.Err(); err != nil {
			mRows.Close()
			adminMonetizationQueryError(w, logger, "iterate monetization audit", err)
			return
		}
		mRows.Close()

		if items == nil {
			items = []AuditItem{}
		}

		writeJSON(w, http.StatusOK, map[string]any{"items": items})
	}
}

// adminMonetizationPlansListHandler implements GET /api/admin/monetization/plans.
func adminMonetizationPlansListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !requireMonetizationPermission(w, r, db, "admin.monetization.read", "billing.plan.view") {
			return
		}
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
				&pl.SubscriptionsCount); err != nil {
				logger.Error("scan monetization plan", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			} else {
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
				if eErr != nil {
					logger.Error("list monetization plan entitlements", "error", eErr)
					writeJSONError(w, "internal error", http.StatusInternalServerError)
					return
				}
				for eRows.Next() {
					var ent PlanEntitlement
					if err := eRows.Scan(&ent.ID, &ent.Key, &ent.Category, &ent.Description); err != nil {
						eRows.Close()
						logger.Error("scan monetization plan entitlement", "error", err)
						writeJSONError(w, "internal error", http.StatusInternalServerError)
						return
					}
					pl.Entitlements = append(pl.Entitlements, ent)
				}
				if err := eRows.Err(); err != nil {
					eRows.Close()
					logger.Error("iterate monetization plan entitlements", "error", err)
					writeJSONError(w, "internal error", http.StatusInternalServerError)
					return
				}
				eRows.Close()
				if pl.Entitlements == nil {
					pl.Entitlements = []PlanEntitlement{}
				}

				// Plan quotas
				qRows, qErr := db.Query(ctx, `
					SELECT pq.id, pq.quota_policy_id, pq.limit_value
					FROM monetization.plan_quota pq
					WHERE pq.plan_id = $1`, pl.ID)
				if qErr != nil {
					logger.Error("list monetization plan quotas", "error", qErr)
					writeJSONError(w, "internal error", http.StatusInternalServerError)
					return
				}
				for qRows.Next() {
					var pq PlanQuota
					if err := qRows.Scan(&pq.ID, &pq.QuotaPolicyID, &pq.LimitValue); err != nil {
						qRows.Close()
						logger.Error("scan monetization plan quota", "error", err)
						writeJSONError(w, "internal error", http.StatusInternalServerError)
						return
					}
					pl.PlanQuotas = append(pl.PlanQuotas, pq)
				}
				if err := qRows.Err(); err != nil {
					qRows.Close()
					logger.Error("iterate monetization plan quotas", "error", err)
					writeJSONError(w, "internal error", http.StatusInternalServerError)
					return
				}
				qRows.Close()
				if pl.PlanQuotas == nil {
					pl.PlanQuotas = []PlanQuota{}
				}

				plans = append(plans, pl)
			}
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate monetization plans", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
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
		if !requireMonetizationPermission(w, r, db, "admin.monetization.write", "billing.plan.manage") {
			return
		}
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
		req.Slug = strings.TrimSpace(req.Slug)
		req.NameKey = strings.TrimSpace(req.NameKey)
		req.Status = strings.TrimSpace(req.Status)
		if req.Slug == "" || req.NameKey == "" || len(req.Slug) > 64 || len(req.NameKey) > 160 || len(req.Status) > 32 {
			writeJSONError(w, "invalid plan fields", http.StatusBadRequest)
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
		tx, err := db.Begin(ctx)
		if err != nil {
			adminMonetizationQueryError(w, logger, "begin monetization plan create", err)
			return
		}
		defer tx.Rollback(ctx)
		var createdID string
		err = tx.QueryRow(ctx, `
			INSERT INTO monetization.plan (slug, name_key, status, config, created_at, updated_at)
			VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING id`,
			req.Slug, req.NameKey, req.Status, configJSON).Scan(&createdID)
		if err != nil {
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.Code == "23505" {
				writeJSONError(w, "plan slug already exists", http.StatusConflict)
				return
			}
			adminMonetizationQueryError(w, logger, "create monetization plan", err)
			return
		}

		afterJSON, err := json.Marshal(map[string]any{"slug": req.Slug, "nameKey": req.NameKey, "status": req.Status})
		if err != nil {
			adminMonetizationQueryError(w, logger, "encode monetization plan audit", err)
			return
		}
		if _, err := tx.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('admin.monetization.plan.created', $1, $2, 'monetization.plan', $3, $4, NOW())`,
			identity.ActorID, createdID, "plan created via admin console", afterJSON); err != nil {
			adminMonetizationQueryError(w, logger, "audit monetization plan create", err)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			adminMonetizationQueryError(w, logger, "commit monetization plan create", err)
			return
		}

		writeJSON(w, http.StatusCreated, map[string]any{"id": createdID, "slug": req.Slug, "nameKey": req.NameKey, "status": req.Status})
	}
}

// adminMonetizationPlansPatchHandler implements PATCH /api/admin/monetization/plans/{id}.
func adminMonetizationPlansPatchHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !requireMonetizationPermission(w, r, db, "admin.monetization.write", "billing.plan.manage") {
			return
		}
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
		var parsedID pgtype.UUID
		if err := parsedID.Scan(id); err != nil {
			writeJSONError(w, "invalid plan id", http.StatusBadRequest)
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
		if req.NameKey != nil && (strings.TrimSpace(*req.NameKey) == "" || len(strings.TrimSpace(*req.NameKey)) > 160) {
			writeJSONError(w, "invalid nameKey", http.StatusBadRequest)
			return
		}
		if req.Status != nil && (strings.TrimSpace(*req.Status) == "" || len(strings.TrimSpace(*req.Status)) > 32) {
			writeJSONError(w, "invalid status", http.StatusBadRequest)
			return
		}
		if req.NameKey != nil {
			nameKey := strings.TrimSpace(*req.NameKey)
			req.NameKey = &nameKey
		}
		if req.Status != nil {
			status := strings.TrimSpace(*req.Status)
			req.Status = &status
		}

		ctx := r.Context()
		var exists bool
		if err := db.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM monetization.plan WHERE id = $1)", id).Scan(&exists); err != nil {
			adminMonetizationQueryError(w, logger, "find monetization plan", err)
			return
		}
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

		tx, err := db.Begin(ctx)
		if err != nil {
			adminMonetizationQueryError(w, logger, "begin monetization plan update", err)
			return
		}
		defer tx.Rollback(ctx)
		if _, err := tx.Exec(ctx, query, args...); err != nil {
			adminMonetizationQueryError(w, logger, "update monetization plan", err)
			return
		}

		afterJSON, err := json.Marshal(map[string]any{"updated": true, "fields": setClauses})
		if err != nil {
			adminMonetizationQueryError(w, logger, "encode monetization plan update audit", err)
			return
		}
		beforeJSON, err := json.Marshal(map[string]any{"id": id})
		if err != nil {
			adminMonetizationQueryError(w, logger, "encode monetization plan before audit", err)
			return
		}
		if _, err := tx.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, before, created_at)
			VALUES ('admin.monetization.plan.updated', $1, $2, 'monetization.plan', $3, $4, $5, NOW())`,
			identity.ActorID, id, "plan updated via admin console", afterJSON, beforeJSON); err != nil {
			adminMonetizationQueryError(w, logger, "audit monetization plan update", err)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			adminMonetizationQueryError(w, logger, "commit monetization plan update", err)
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{"id": id, "updated": true})
	}
}

func adminMonetizationQueryError(w http.ResponseWriter, logger *slog.Logger, operation string, err error) {
	if logger == nil {
		logger = slog.Default()
	}
	logger.Error(operation, "error", err)
	writeJSONError(w, "internal error", http.StatusInternalServerError)
}

func parseMonetizationAuditTime(value string) (*time.Time, error) {
	if value == "" {
		return nil, nil
	}
	for _, layout := range []string{time.RFC3339Nano, "2006-01-02"} {
		parsed, err := time.Parse(layout, value)
		if err == nil {
			return &parsed, nil
		}
	}
	return nil, fmt.Errorf("invalid timestamp")
}
