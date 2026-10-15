package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

func seedPricingPlan(t *testing.T, db *pgxpool.Pool, planID, slug string) {
	t.Helper()
	_, err := db.Exec(context.Background(), `
		INSERT INTO monetization.plan (id, slug, name_key, status, sort_order, config, updated_at)
		VALUES ($1, $2, $2, 'active', 1, '{"displayName":"Plus"}'::jsonb, now())`, planID, slug)
	if err != nil {
		t.Fatalf("seed pricing plan: %v", err)
	}
	t.Cleanup(func() { _, _ = db.Exec(context.Background(), `DELETE FROM monetization.plan WHERE id = $1`, planID) })
}

func TestPricingPlanReadIncludesCanonicalFeaturesAndCheckoutIsSessionOwned(t *testing.T) {
	db := testPool(t)
	userID, otherUserID := newUUID(t), newUUID(t)
	seedActiveUser(t, db, userID, "Pricing Learner", "pricing-"+userID[:8]+"@example.com", "")
	seedActiveUser(t, db, otherUserID, "Other Pricing Learner", "pricing-"+otherUserID[:8]+"@example.com", "")
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM monetization.user_subscription WHERE user_id IN ($1, $2)`, userID, otherUserID)
	})
	planID := newUUID(t)
	seedPricingPlan(t, db, planID, "pricing-"+planID[:8])
	entitlementID, quotaID := newUUID(t), newUUID(t)
	_, err := db.Exec(context.Background(), `INSERT INTO monetization.entitlement_definition (id, key) VALUES ($1, $2)`, entitlementID, "pricing.test."+entitlementID[:8])
	if err == nil {
		_, err = db.Exec(context.Background(), `INSERT INTO monetization.plan_entitlement (plan_id, entitlement_id) VALUES ($1, $2)`, planID, entitlementID)
	}
	if err == nil {
		_, err = db.Exec(context.Background(), `INSERT INTO monetization.quota_policy (id, key, window_code) VALUES ($1, $2, 'day')`, quotaID, "pricing.quota."+quotaID[:8])
	}
	if err == nil {
		_, err = db.Exec(context.Background(), `INSERT INTO monetization.plan_quota (plan_id, quota_policy_id, limit_value) VALUES ($1, $2, 30)`, planID, quotaID)
	}
	if err != nil {
		t.Fatalf("seed pricing features: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM monetization.entitlement_definition WHERE id = $1`, entitlementID)
		_, _ = db.Exec(context.Background(), `DELETE FROM monetization.quota_policy WHERE id = $1`, quotaID)
	})

	otherSubscriptionID := newUUID(t)
	_, err = db.Exec(context.Background(), `INSERT INTO monetization.user_subscription (id, user_id, plan_id, status, updated_at) VALUES ($1, $2, $3, 'active', now())`, otherSubscriptionID, otherUserID, planID)
	if err != nil {
		t.Fatalf("seed other subscription: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM monetization.user_subscription WHERE id = $1`, otherSubscriptionID)
	})
	activeSubscriptionID := newUUID(t)
	_, err = db.Exec(context.Background(), `INSERT INTO monetization.user_subscription (id, user_id, plan_id, status, updated_at) VALUES ($1, $2, $3, 'active', now())`, activeSubscriptionID, userID, planID)
	if err != nil {
		t.Fatalf("seed current subscription: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM monetization.user_subscription WHERE id = $1`, activeSubscriptionID)
	})

	sessions := session.NewStore(db)
	router := NewRouter(Dependencies{Config: &config.Config{CORSOrigins: []string{"http://localhost:18081"}}, Logger: testLogger(), DBPool: db, SessionStore: sessions})
	token := createLearnerSession(t, sessions, userID)
	request := func(method, path, body string, auth bool) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		if auth {
			req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: token})
		}
		if method != http.MethodGet {
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("X-CSRF-Token", "test-csrf")
			req.Header.Set("Origin", "http://localhost:18081")
		}
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		return w
	}

	if got := request(http.MethodGet, "/api/learner/monetization/plans", "", false); got.Code != http.StatusOK {
		t.Fatalf("public plan list should succeed, got %d: %s", got.Code, got.Body.String())
	} else {
		var plans []struct {
			ID           string   `json:"id"`
			Entitlements []string `json:"entitlements"`
			Quotas       []struct {
				Key    string `json:"key"`
				Limit  int    `json:"limit"`
				Window string `json:"window"`
			} `json:"quotas"`
		}
		if err := json.Unmarshal(got.Body.Bytes(), &plans); err != nil {
			t.Fatalf("decode plans: %v", err)
		}
		foundPlan := false
		for _, plan := range plans {
			if plan.ID == planID && (len(plan.Entitlements) != 1 || len(plan.Quotas) != 1 || plan.Quotas[0].Limit != 30 || plan.Quotas[0].Window != "day") {
				t.Fatalf("plan features missing from public contract: %+v", plan)
			}
			foundPlan = foundPlan || plan.ID == planID
		}
		if !foundPlan {
			t.Fatalf("public plan list omitted seeded active plan %s", planID)
		}
	}
	if got := request(http.MethodGet, "/api/learner/monetization/subscription", "", false); got.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous subscription read should be unauthorized, got %d: %s", got.Code, got.Body.String())
	}

	if got := request(http.MethodGet, "/api/learner/monetization/subscription?userId="+otherUserID, "", true); got.Code != http.StatusOK || strings.Contains(got.Body.String(), otherSubscriptionID) {
		t.Fatalf("subscription query must be scoped to session learner, got %d: %s", got.Code, got.Body.String())
	}
	if got := request(http.MethodPost, "/api/learner/monetization/checkout", fmt.Sprintf(`{"planId":%q}`, planID), false); got.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous checkout should be unauthorized, got %d: %s", got.Code, got.Body.String())
	}
	if got := request(http.MethodPost, "/api/learner/monetization/checkout", `{"planId":"00000000-0000-4000-8000-000000000000"}`, true); got.Code != http.StatusBadRequest {
		t.Fatalf("unknown plan should be rejected, got %d: %s", got.Code, got.Body.String())
	}
	got := request(http.MethodPost, "/api/learner/monetization/checkout", fmt.Sprintf(`{"planId":%q}`, planID), true)
	if got.Code != http.StatusOK {
		t.Fatalf("authenticated checkout should create pending intent, got %d: %s", got.Code, got.Body.String())
	}
	var checkout struct {
		SubscriptionID string `json:"subscriptionId"`
		Status         string `json:"status"`
	}
	if err := json.Unmarshal(got.Body.Bytes(), &checkout); err != nil || checkout.SubscriptionID == "" || checkout.Status != "pending" {
		t.Fatalf("expected explicit pending subscription response, got %s (%v)", got.Body.String(), err)
	}
	var ownerID, status string
	if err := db.QueryRow(context.Background(), `SELECT user_id::text, status FROM monetization.user_subscription WHERE id = $1`, checkout.SubscriptionID).Scan(&ownerID, &status); err != nil || ownerID != userID || status != "pending" {
		t.Fatalf("pending subscription must persist for session user, owner=%s status=%s err=%v", ownerID, status, err)
	}
	retried := request(http.MethodPost, "/api/learner/monetization/checkout", fmt.Sprintf(`{"planId":%q}`, planID), true)
	var retryCheckout struct {
		SubscriptionID string `json:"subscriptionId"`
		Status         string `json:"status"`
	}
	if err := json.Unmarshal(retried.Body.Bytes(), &retryCheckout); retried.Code != http.StatusOK || err != nil || retryCheckout.SubscriptionID != checkout.SubscriptionID {
		t.Fatalf("repeated checkout must reuse the pending intent, got %d %s (%v)", retried.Code, retried.Body.String(), err)
	}
	var pendingCount int
	if err := db.QueryRow(context.Background(), `SELECT count(*) FROM monetization.user_subscription WHERE user_id = $1 AND plan_id = $2 AND status = 'pending'`, userID, planID).Scan(&pendingCount); err != nil || pendingCount != 1 {
		t.Fatalf("repeated checkout must persist one pending intent, count=%d err=%v", pendingCount, err)
	}
	current := request(http.MethodGet, "/api/learner/monetization/subscription", "", true)
	var currentState struct {
		Subscription *struct {
			ID string `json:"id"`
		} `json:"subscription"`
		PendingSubscription *struct {
			ID string `json:"id"`
		} `json:"pendingSubscription"`
	}
	if err := json.Unmarshal(current.Body.Bytes(), &currentState); current.Code != http.StatusOK || err != nil || currentState.Subscription == nil || currentState.Subscription.ID != activeSubscriptionID || currentState.PendingSubscription == nil || currentState.PendingSubscription.ID != checkout.SubscriptionID {
		t.Fatalf("current and pending subscriptions must both be returned, got %d %s (%v)", current.Code, current.Body.String(), err)
	}
	var eventCount int
	if err := db.QueryRow(context.Background(), `SELECT count(*) FROM monetization.subscription_event WHERE subscription_id = $1 AND kind = 'checkout_started'`, checkout.SubscriptionID).Scan(&eventCount); err != nil || eventCount != 1 {
		t.Fatalf("pending checkout event missing, count=%d err=%v", eventCount, err)
	}
	_, _ = db.Exec(context.Background(), `DELETE FROM monetization.user_subscription WHERE id = $1`, checkout.SubscriptionID)
}
