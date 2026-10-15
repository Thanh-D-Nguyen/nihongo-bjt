package httpserver

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// learnerSubscriptionQuota is one quota row of the learner's current plan.
type learnerSubscriptionQuota struct {
	Key    string `json:"key"`
	Limit  int    `json:"limit"`
	Window string `json:"window"`
}

// learnerSubscriptionSummary is the plan view the learner settings page renders.
// It is merged additively into GET /api/learner/monetization/subscription.
type learnerSubscriptionSummary struct {
	PlanSlug          string
	PlanName          string
	PlanNameVi        string
	PlanNameJa        string
	Source            string
	Status            *string
	CurrentPeriodEnd  *string
	CancelAtPeriodEnd bool
	Entitlements      []string
	Quotas            []learnerSubscriptionQuota
}

// loadLearnerSubscriptionSummary resolves the learner's current plan: the newest
// active or trialing subscription when one exists, otherwise the free plan.
func loadLearnerSubscriptionSummary(ctx context.Context, db *pgxpool.Pool, userID string) (learnerSubscriptionSummary, error) {
	summary := learnerSubscriptionSummary{Source: "default", PlanSlug: "free", Entitlements: []string{}, Quotas: []learnerSubscriptionQuota{}}
	var planID string

	const activeQ = `SELECT p.id::text, p.slug, COALESCE(p.config->>'displayName', p.slug),
			COALESCE(p.config->>'displayNameVi', ''), COALESCE(p.config->>'displayNameJa', ''),
			us.status, us.current_period_end::text, us.cancel_at_period_end
		FROM monetization.user_subscription us
		JOIN monetization.plan p ON p.id = us.plan_id
		WHERE us.user_id = $1 AND us.status IN ('active', 'trialing') AND p.status = 'active'
			AND (us.current_period_start IS NULL OR us.current_period_start <= NOW())
			AND (us.current_period_end IS NULL OR us.current_period_end > NOW())
			AND (us.status <> 'trialing' OR us.trial_end IS NULL OR us.trial_end > NOW())
		ORDER BY us.created_at DESC LIMIT 1`
	err := db.QueryRow(ctx, activeQ, userID).Scan(
		&planID, &summary.PlanSlug, &summary.PlanName, &summary.PlanNameVi, &summary.PlanNameJa,
		&summary.Status, &summary.CurrentPeriodEnd, &summary.CancelAtPeriodEnd,
	)
	switch {
	case err == nil:
		summary.Source = "subscription"
	case errors.Is(err, pgx.ErrNoRows):
		const freeQ = `SELECT id::text, slug, COALESCE(config->>'displayName', slug),
				COALESCE(config->>'displayNameVi', ''), COALESCE(config->>'displayNameJa', '')
			FROM monetization.plan WHERE slug = 'free' AND status = 'active' LIMIT 1`
		err = db.QueryRow(ctx, freeQ).Scan(&planID, &summary.PlanSlug, &summary.PlanName, &summary.PlanNameVi, &summary.PlanNameJa)
		if errors.Is(err, pgx.ErrNoRows) {
			// No free plan is configured: the response still carries the slug with empty names.
			summary.PlanName = summary.PlanSlug
			return summary, nil
		}
		if err != nil {
			return summary, err
		}
	default:
		return summary, err
	}

	const entitlementsQ = `SELECT ed.key FROM monetization.plan_entitlement pe
		JOIN monetization.entitlement_definition ed ON ed.id = pe.entitlement_id
		WHERE pe.plan_id = $1 ORDER BY ed.key`
	rows, err := db.Query(ctx, entitlementsQ, planID)
	if err != nil {
		return summary, err
	}
	for rows.Next() {
		var key string
		if err := rows.Scan(&key); err != nil {
			rows.Close()
			return summary, err
		}
		summary.Entitlements = append(summary.Entitlements, key)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return summary, err
	}

	const quotasQ = `SELECT qp.key, pq.limit_value, qp.window_code FROM monetization.plan_quota pq
		JOIN monetization.quota_policy qp ON qp.id = pq.quota_policy_id
		WHERE pq.plan_id = $1 ORDER BY qp.key`
	quotaRows, err := db.Query(ctx, quotasQ, planID)
	if err != nil {
		return summary, err
	}
	for quotaRows.Next() {
		var q learnerSubscriptionQuota
		if err := quotaRows.Scan(&q.Key, &q.Limit, &q.Window); err != nil {
			quotaRows.Close()
			return summary, err
		}
		summary.Quotas = append(summary.Quotas, q)
	}
	quotaRows.Close()
	if err := quotaRows.Err(); err != nil {
		return summary, err
	}
	return summary, nil
}

// addTo writes the summary fields into the subscription response map.
func (s learnerSubscriptionSummary) addTo(response map[string]interface{}) {
	response["planSlug"] = s.PlanSlug
	response["planName"] = s.PlanName
	response["planNameVi"] = s.PlanNameVi
	response["planNameJa"] = s.PlanNameJa
	response["source"] = s.Source
	response["status"] = s.Status
	response["currentPeriodEnd"] = s.CurrentPeriodEnd
	response["cancelAtPeriodEnd"] = s.CancelAtPeriodEnd
	response["entitlements"] = s.Entitlements
	response["quotas"] = s.Quotas
}
