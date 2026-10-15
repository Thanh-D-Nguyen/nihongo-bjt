package httpserver

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

type learnerSubscriptionSummaryBody struct {
	Subscription *struct {
		ID string `json:"id"`
	} `json:"subscription"`
	PendingSubscription *struct {
		ID string `json:"id"`
	} `json:"pendingSubscription"`
	PlanSlug          string   `json:"planSlug"`
	PlanName          string   `json:"planName"`
	PlanNameVi        string   `json:"planNameVi"`
	PlanNameJa        string   `json:"planNameJa"`
	Source            string   `json:"source"`
	Status            *string  `json:"status"`
	CurrentPeriodEnd  *string  `json:"currentPeriodEnd"`
	CancelAtPeriodEnd bool     `json:"cancelAtPeriodEnd"`
	Entitlements      []string `json:"entitlements"`
	Quotas            []struct {
		Key    string `json:"key"`
		Limit  int    `json:"limit"`
		Window string `json:"window"`
	} `json:"quotas"`
}

func getLearnerSubscriptionSummary(t *testing.T, db *pgxpool.Pool, router http.Handler, userID string) (learnerSubscriptionSummaryBody, string) {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/api/learner/monetization/subscription", nil)
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: createLearnerSession(t, session.NewStore(db), userID)})
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("GET subscription status = %d, want 200: %s", w.Code, w.Body.String())
	}
	var body learnerSubscriptionSummaryBody
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode subscription response: %v: %s", err, w.Body.String())
	}
	return body, w.Body.String()
}

func TestLearnerSubscriptionSummaryDescribesActivePlan(t *testing.T) {
	db := testPool(t)
	ctx := context.Background()
	userID := seedInAppLearner(t, db, "subscription-summary")
	planID := newUUID(t)
	planSlug := "summary-" + planID[:8]
	if _, err := db.Exec(ctx, `INSERT INTO monetization.plan (id, slug, name_key, status, sort_order, config, updated_at)
		VALUES ($1, $2, $2, 'active', 1, '{"displayName":"Plus","displayNameVi":"Plus VN","displayNameJa":"プラス"}'::jsonb, now())`, planID, planSlug); err != nil {
		t.Fatalf("seed plan: %v", err)
	}
	t.Cleanup(func() { _, _ = db.Exec(context.Background(), `DELETE FROM monetization.plan WHERE id = $1`, planID) })

	entitlementID := newUUID(t)
	entitlementKey := "summary.ent." + entitlementID[:8]
	if _, err := db.Exec(ctx, `INSERT INTO monetization.entitlement_definition (id, key) VALUES ($1, $2)`, entitlementID, entitlementKey); err != nil {
		t.Fatalf("seed entitlement: %v", err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO monetization.plan_entitlement (plan_id, entitlement_id) VALUES ($1, $2)`, planID, entitlementID); err != nil {
		t.Fatalf("link entitlement: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM monetization.entitlement_definition WHERE id = $1`, entitlementID)
	})
	quotaPolicyID := newUUID(t)
	quotaKey := "summary.quota." + quotaPolicyID[:8]
	if _, err := db.Exec(ctx, `INSERT INTO monetization.quota_policy (id, key, window_code) VALUES ($1, $2, 'month')`, quotaPolicyID, quotaKey); err != nil {
		t.Fatalf("seed quota policy: %v", err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO monetization.plan_quota (id, plan_id, quota_policy_id, limit_value) VALUES ($1, $2, $3, 5)`, newUUID(t), planID, quotaPolicyID); err != nil {
		t.Fatalf("link quota: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM monetization.quota_policy WHERE id = $1`, quotaPolicyID)
	})

	subscriptionID := newUUID(t)
	periodEnd := time.Now().UTC().Add(30 * 24 * time.Hour).Truncate(time.Second)
	if _, err := db.Exec(ctx, `INSERT INTO monetization.user_subscription (id, user_id, plan_id, status, current_period_end, cancel_at_period_end, updated_at)
		VALUES ($1, $2, $3, 'active', $4, true, now())`, subscriptionID, userID, planID, periodEnd); err != nil {
		t.Fatalf("seed subscription: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM monetization.user_subscription WHERE id = $1`, subscriptionID)
	})

	router := inAppNotificationTestRouter(db)
	body, raw := getLearnerSubscriptionSummary(t, db, router, userID)
	if body.Subscription == nil || body.Subscription.ID != subscriptionID {
		t.Fatalf("existing subscription field changed: %s", raw)
	}
	if body.Source != "subscription" || body.PlanSlug != planSlug {
		t.Fatalf("expected source subscription for plan %s, got source=%q planSlug=%q: %s", planSlug, body.Source, body.PlanSlug, raw)
	}
	if body.PlanName != "Plus" || body.PlanNameVi != "Plus VN" || body.PlanNameJa != "プラス" {
		t.Fatalf("plan names not read from plan config: %s", raw)
	}
	if body.Status == nil || *body.Status != "active" || body.CurrentPeriodEnd == nil || !body.CancelAtPeriodEnd {
		t.Fatalf("status/period/cancel flag wrong: %s", raw)
	}
	if len(body.Entitlements) != 1 || body.Entitlements[0] != entitlementKey {
		t.Fatalf("entitlements = %v, want [%s]: %s", body.Entitlements, entitlementKey, raw)
	}
	if len(body.Quotas) != 1 || body.Quotas[0].Key != quotaKey || body.Quotas[0].Limit != 5 || body.Quotas[0].Window != "month" {
		t.Fatalf("quotas = %+v, want one month quota of 5: %s", body.Quotas, raw)
	}
}

func TestLearnerSubscriptionSummaryFallsBackToFreePlan(t *testing.T) {
	db := testPool(t)
	ctx := context.Background()
	userID := seedInAppLearner(t, db, "subscription-default")

	var freeExists bool
	if err := db.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM monetization.plan WHERE slug = 'free' AND status = 'active')`).Scan(&freeExists); err != nil {
		t.Fatalf("check free plan: %v", err)
	}
	if !freeExists {
		freeID := newUUID(t)
		if _, err := db.Exec(ctx, `INSERT INTO monetization.plan (id, slug, name_key, status, sort_order, config, updated_at)
			VALUES ($1, 'free', 'plan.free.name', 'active', 0, '{"displayName":"Free","displayNameVi":"Miễn phí","displayNameJa":"無料"}'::jsonb, now())`, freeID); err != nil {
			t.Fatalf("seed free plan: %v", err)
		}
		t.Cleanup(func() { _, _ = db.Exec(context.Background(), `DELETE FROM monetization.plan WHERE id = $1`, freeID) })
	}

	body, raw := getLearnerSubscriptionSummary(t, db, inAppNotificationTestRouter(db), userID)
	if body.Subscription != nil || body.PendingSubscription != nil {
		t.Fatalf("learner without subscription must keep null subscription fields: %s", raw)
	}
	if body.Source != "default" || body.PlanSlug != "free" || body.Status != nil || body.CancelAtPeriodEnd {
		t.Fatalf("expected default free plan without subscription status, got %s", raw)
	}
	if body.Entitlements == nil || body.Quotas == nil {
		t.Fatalf("entitlements and quotas must be arrays, not null: %s", raw)
	}
}

func TestLearnerSubscriptionSummaryExcludesExpiredPeriod(t *testing.T) {
	db := testPool(t)
	ctx := context.Background()
	userID := seedInAppLearner(t, db, "subscription-expired-summary")
	planID := newUUID(t)
	planSlug := "expired-summary-" + planID[:8]
	if _, err := db.Exec(ctx, `INSERT INTO monetization.plan (id, slug, name_key, status, sort_order, config, updated_at)
		VALUES ($1, $2, $2, 'active', 1, '{"displayName":"Expired Plus"}'::jsonb, now())`, planID, planSlug); err != nil {
		t.Fatalf("seed expired plan: %v", err)
	}
	t.Cleanup(func() { _, _ = db.Exec(context.Background(), `DELETE FROM monetization.plan WHERE id=$1`, planID) })
	subscriptionID := newUUID(t)
	if _, err := db.Exec(ctx, `INSERT INTO monetization.user_subscription (id, user_id, plan_id, status, current_period_end, cancel_at_period_end, updated_at)
		VALUES ($1, $2, $3, 'active', now() - interval '1 day', true, now())`, subscriptionID, userID, planID); err != nil {
		t.Fatalf("seed expired subscription: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM monetization.user_subscription WHERE id=$1`, subscriptionID)
	})

	body, raw := getLearnerSubscriptionSummary(t, db, inAppNotificationTestRouter(db), userID)
	if body.Subscription != nil {
		t.Fatalf("expired subscription must be absent from response, got: %s", raw)
	}
	if body.Source != "default" || body.PlanSlug != "free" || body.Status != nil || body.CurrentPeriodEnd != nil || body.CancelAtPeriodEnd {
		t.Fatalf("expired subscription must be excluded, got: %s", raw)
	}
}

func TestLearnerSubscriptionSummaryExcludesIneligibleSubscriptions(t *testing.T) {
	db := testPool(t)
	ctx := context.Background()
	var freeExists bool
	if err := db.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM monetization.plan WHERE slug='free' AND status='active')`).Scan(&freeExists); err != nil {
		t.Fatalf("check free plan: %v", err)
	}
	if !freeExists {
		freeID := newUUID(t)
		if _, err := db.Exec(ctx, `INSERT INTO monetization.plan (id, slug, name_key, status, sort_order, config, updated_at)
			VALUES ($1, 'free', 'plan.free.name', 'active', 0, '{}'::jsonb, now())`, freeID); err != nil {
			t.Fatalf("seed free plan: %v", err)
		}
		t.Cleanup(func() { _, _ = db.Exec(context.Background(), `DELETE FROM monetization.plan WHERE id=$1`, freeID) })
	}

	now := time.Now().UTC()
	for _, tc := range []struct {
		name       string
		status     string
		planStatus string
		start      time.Time
		end        time.Time
		trialEnd   *time.Time
	}{
		{name: "period has not started", status: "active", planStatus: "active", start: now.Add(time.Hour), end: now.Add(24 * time.Hour)},
		{name: "trial has expired", status: "trialing", planStatus: "active", start: now.Add(-time.Hour), end: now.Add(24 * time.Hour), trialEnd: timePointer(now.Add(-time.Minute))},
		{name: "plan is not active", status: "active", planStatus: "draft", start: now.Add(-time.Hour), end: now.Add(24 * time.Hour)},
	} {
		t.Run(tc.name, func(t *testing.T) {
			userID := seedInAppLearner(t, db, "subscription-ineligible-"+strings.ReplaceAll(tc.name, " ", "-"))
			planID := newUUID(t)
			if _, err := db.Exec(ctx, `INSERT INTO monetization.plan (id, slug, name_key, status, sort_order, config, updated_at)
				VALUES ($1, $2, $2, $3, 1, '{}'::jsonb, now())`, planID, "ineligible-"+planID[:8], tc.planStatus); err != nil {
				t.Fatalf("seed plan: %v", err)
			}
			t.Cleanup(func() { _, _ = db.Exec(context.Background(), `DELETE FROM monetization.plan WHERE id=$1`, planID) })
			subscriptionID := newUUID(t)
			if _, err := db.Exec(ctx, `INSERT INTO monetization.user_subscription
				(id, user_id, plan_id, status, provider, current_period_start, current_period_end, trial_end, cancel_at_period_end, updated_at)
				VALUES ($1, $2, $3, $4, 'local', $5, $6, $7, false, now())`,
				subscriptionID, userID, planID, tc.status, tc.start, tc.end, tc.trialEnd); err != nil {
				t.Fatalf("seed ineligible subscription: %v", err)
			}
			t.Cleanup(func() {
				_, _ = db.Exec(context.Background(), `DELETE FROM monetization.user_subscription WHERE id=$1`, subscriptionID)
			})

			body, raw := getLearnerSubscriptionSummary(t, db, inAppNotificationTestRouter(db), userID)
			if body.Subscription != nil || body.Source != "default" || body.PlanSlug != "free" {
				t.Fatalf("ineligible subscription %q must fall back to free, got: %s", tc.name, raw)
			}
		})
	}
}

func timePointer(value time.Time) *time.Time { return &value }
