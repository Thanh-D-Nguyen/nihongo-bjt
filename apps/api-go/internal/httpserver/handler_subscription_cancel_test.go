package httpserver

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

func postSubscriptionCancel(t *testing.T, router http.Handler, userID, origin string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/api/learner/monetization/subscription/cancel", nil)
	req.Header.Set("Origin", origin)
	if userID != "" {
		req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: createLearnerSession(t, session.NewStore(testPool(t)), userID)})
	}
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	return w
}

func TestSubscriptionCancelKeepsAccessUntilPeriodEnd(t *testing.T) {
	db := testPool(t)
	ctx := context.Background()
	userID := seedInAppLearner(t, db, "cancel-period")
	planID := newUUID(t)
	seedPricingPlan(t, db, planID, "cancel-"+planID[:8])
	subscriptionID := newUUID(t)
	periodEnd := time.Now().UTC().Add(20 * 24 * time.Hour).Truncate(time.Second)
	if _, err := db.Exec(ctx, `INSERT INTO monetization.user_subscription (id, user_id, plan_id, status, current_period_end, cancel_at_period_end, updated_at)
		VALUES ($1, $2, $3, 'active', $4, false, now())`, subscriptionID, userID, planID, periodEnd); err != nil {
		t.Fatalf("seed subscription: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM monetization.user_subscription WHERE user_id = $1`, userID)
	})
	router := inAppNotificationTestRouter(db)

	w := postSubscriptionCancel(t, router, userID, inAppTestOrigin)
	if w.Code != http.StatusOK {
		t.Fatalf("cancel status = %d, want 200: %s", w.Code, w.Body.String())
	}
	var body struct {
		OK                bool `json:"ok"`
		CancelAtPeriodEnd bool `json:"cancelAtPeriodEnd"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode cancel response: %v: %s", err, w.Body.String())
	}
	if !body.OK || !body.CancelAtPeriodEnd {
		t.Fatalf("cancel response = %s, want {ok:true,cancelAtPeriodEnd:true}", w.Body.String())
	}

	var status string
	var cancelAtPeriodEnd bool
	if err := db.QueryRow(ctx, `SELECT status, cancel_at_period_end FROM monetization.user_subscription WHERE id = $1`, subscriptionID).Scan(&status, &cancelAtPeriodEnd); err != nil {
		t.Fatalf("read subscription after cancel: %v", err)
	}
	if status != "active" || !cancelAtPeriodEnd {
		t.Fatalf("after cancel status=%q cancel_at_period_end=%v, want active and true", status, cancelAtPeriodEnd)
	}
}

func TestSubscriptionCancelContractForMissingAndUnauthorizedRequests(t *testing.T) {
	db := testPool(t)
	userID := seedInAppLearner(t, db, "cancel-none")
	router := inAppNotificationTestRouter(db)

	none := postSubscriptionCancel(t, router, userID, inAppTestOrigin)
	if none.Code != http.StatusNotFound {
		t.Fatalf("cancel without active subscription status = %d, want 404: %s", none.Code, none.Body.String())
	}

	anon := postSubscriptionCancel(t, router, "", inAppTestOrigin)
	if anon.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous cancel status = %d, want 401: %s", anon.Code, anon.Body.String())
	}

	untrusted := postSubscriptionCancel(t, router, userID, "https://evil.example.com")
	if untrusted.Code != http.StatusForbidden {
		t.Fatalf("untrusted-origin cancel status = %d, want 403: %s", untrusted.Code, untrusted.Body.String())
	}
}
