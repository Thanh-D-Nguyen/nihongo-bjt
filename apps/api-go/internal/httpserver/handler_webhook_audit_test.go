package httpserver

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
)

func TestAudit165ShareImageRouteIsPublicAndReportsMissingProvider(t *testing.T) {
	router := NewRouter(Dependencies{
		Config: &config.Config{},
		Logger: slog.New(slog.NewTextHandler(io.Discard, nil)),
	})
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/share/image/achievement", nil))
	if recorder.Code != http.StatusNotImplemented {
		t.Fatalf("public image status=%d body=%s; want explicit provider-unavailable 501", recorder.Code, recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), "not yet implemented") {
		t.Fatalf("public image response must disclose unavailable image generation: %s", recorder.Body.String())
	}
}

func TestAudit165StripeWebhookRejectsMissingConfigBadSignatureAndOversize(t *testing.T) {
	db := testPool(t)
	validBody := []byte(`{"id":"evt_audit165","type":"checkout.session.completed"}`)
	tests := []struct {
		name       string
		secret     string
		body       []byte
		signature  string
		wantStatus int
	}{
		{name: "missing secret", body: validBody, signature: audit165StripeSignature(validBody, "secret", time.Now()), wantStatus: http.StatusServiceUnavailable},
		{name: "missing signature", secret: "secret", body: validBody, wantStatus: http.StatusBadRequest},
		{name: "invalid signature", secret: "secret", body: validBody, signature: "t=1,v1=bad", wantStatus: http.StatusBadRequest},
		{name: "stale signature", secret: "secret", body: validBody, signature: audit165StripeSignature(validBody, "secret", time.Now().Add(-6*time.Minute)), wantStatus: http.StatusBadRequest},
		{name: "oversize", secret: "secret", body: bytes.Repeat([]byte("x"), maxWebhookBodyBytes+1), wantStatus: http.StatusRequestEntityTooLarge},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			router := NewRouter(Dependencies{
				Config: &config.Config{StripeWebhookSecret: tt.secret},
				DBPool: db,
				Logger: slog.New(slog.NewTextHandler(io.Discard, nil)),
			})
			req := httptest.NewRequest(http.MethodPost, "/api/webhooks/stripe", bytes.NewReader(tt.body))
			if tt.signature != "" {
				req.Header.Set("Stripe-Signature", tt.signature)
			}
			recorder := httptest.NewRecorder()
			router.ServeHTTP(recorder, req)
			if recorder.Code != tt.wantStatus {
				t.Fatalf("status=%d body=%s; want %d", recorder.Code, recorder.Body.String(), tt.wantStatus)
			}
		})
	}
}

func TestAudit165StripeWebhookDoesNotAcknowledgeUnsupportedEventAsProcessed(t *testing.T) {
	db := testPool(t)
	secret := "whsec_audit165_test_secret"
	eventID := "evt_" + strings.ReplaceAll(newUUID(t), "-", "")
	body, err := json.Marshal(map[string]string{"id": eventID, "type": "checkout.session.completed"})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM monetization.billing_webhook_event WHERE idempotency_key=$1`, eventID)
	})
	router := NewRouter(Dependencies{
		Config: &config.Config{StripeWebhookSecret: secret},
		DBPool: db,
		Logger: slog.New(slog.NewTextHandler(io.Discard, nil)),
	})
	sig := audit165StripeSignature(body, secret, time.Now())
	for attempt := 0; attempt < 2; attempt++ {
		req := httptest.NewRequest(http.MethodPost, "/api/webhooks/stripe", bytes.NewReader(body))
		req.Header.Set("Stripe-Signature", sig)
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, req)
		if recorder.Code != http.StatusBadRequest {
			t.Fatalf("attempt %d status=%d body=%s; unsupported event must not be acknowledged", attempt+1, recorder.Code, recorder.Body.String())
		}
	}
	var count int
	err = db.QueryRow(context.Background(), `SELECT count(*) FROM monetization.billing_webhook_event WHERE provider='stripe' AND idempotency_key=$1`, eventID).Scan(&count)
	if err != nil {
		t.Fatalf("query persisted event: %v", err)
	}
	if count != 0 {
		t.Fatalf("unsupported event persisted as count=%d; want no processed event", count)
	}
}

func TestAudit165StripeSubscriptionUpdateAppliesToLinkedSubscription(t *testing.T) {
	db := testPool(t)
	ctx := context.Background()
	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Stripe webhook learner", "stripe-webhook-"+userID[:8]+"@example.test", "")
	planID := newUUID(t)
	if _, err := db.Exec(ctx, `INSERT INTO monetization.plan (id, slug, name_key, status, updated_at)
		VALUES ($1, $2, $2, 'active', now())`, planID, "stripe-webhook-"+planID[:8]); err != nil {
		t.Fatalf("seed plan: %v", err)
	}
	t.Cleanup(func() { _, _ = db.Exec(context.Background(), `DELETE FROM monetization.plan WHERE id=$1`, planID) })
	stripeSubscriptionID := "sub_" + strings.ReplaceAll(newUUID(t), "-", "")
	subscriptionID := newUUID(t)
	if _, err := db.Exec(ctx, `INSERT INTO monetization.user_subscription
		(id, user_id, plan_id, status, provider, provider_ref, updated_at)
		VALUES ($1, $2, $3, 'past_due', 'stripe', $4, now())`, subscriptionID, userID, planID, stripeSubscriptionID); err != nil {
		t.Fatalf("seed linked subscription: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM monetization.user_subscription WHERE id=$1`, subscriptionID)
	})
	eventID := "evt_" + strings.ReplaceAll(newUUID(t), "-", "")
	newerEventID := "evt_" + strings.ReplaceAll(newUUID(t), "-", "")
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM monetization.billing_webhook_event WHERE idempotency_key=$1`, eventID)
		_, _ = db.Exec(context.Background(), `DELETE FROM monetization.billing_webhook_event WHERE idempotency_key=$1`, newerEventID)
	})
	secret := "whsec_audit165_test_secret"
	periodStart := time.Now().UTC().Add(-time.Hour).Truncate(time.Second)
	periodEnd := time.Now().UTC().Add(30 * 24 * time.Hour).Truncate(time.Second)
	eventCreated := time.Now().Unix()
	body, err := json.Marshal(map[string]interface{}{
		"id": eventID, "type": "customer.subscription.updated", "created": eventCreated,
		"data": map[string]interface{}{"object": map[string]interface{}{
			"id": stripeSubscriptionID, "status": "active", "current_period_start": periodStart.Unix(),
			"current_period_end": periodEnd.Unix(), "cancel_at_period_end": true,
		}},
	})
	if err != nil {
		t.Fatal(err)
	}
	router := NewRouter(Dependencies{
		Config: &config.Config{StripeWebhookSecret: secret}, DBPool: db,
		Logger: slog.New(slog.NewTextHandler(io.Discard, nil)),
	})
	req := httptest.NewRequest(http.MethodPost, "/api/webhooks/stripe", bytes.NewReader(body))
	req.Header.Set("Stripe-Signature", audit165StripeSignature(body, secret, time.Now()))
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)
	if recorder.Code != http.StatusOK {
		t.Fatalf("webhook status=%d body=%s; want 200", recorder.Code, recorder.Body.String())
	}
	duplicate := httptest.NewRequest(http.MethodPost, "/api/webhooks/stripe", bytes.NewReader(body))
	duplicate.Header.Set("Stripe-Signature", audit165StripeSignature(body, secret, time.Now()))
	duplicateRecorder := httptest.NewRecorder()
	router.ServeHTTP(duplicateRecorder, duplicate)
	if duplicateRecorder.Code != http.StatusOK {
		t.Fatalf("duplicate webhook status=%d body=%s; want idempotent 200", duplicateRecorder.Code, duplicateRecorder.Body.String())
	}
	newerBody, err := json.Marshal(map[string]interface{}{
		"id": newerEventID, "type": "customer.subscription.updated", "created": eventCreated,
		"data": map[string]interface{}{"object": map[string]interface{}{
			"id": stripeSubscriptionID, "status": "past_due", "cancel_at_period_end": false,
		}},
	})
	if err != nil {
		t.Fatal(err)
	}
	newerReq := httptest.NewRequest(http.MethodPost, "/api/webhooks/stripe", bytes.NewReader(newerBody))
	newerReq.Header.Set("Stripe-Signature", audit165StripeSignature(newerBody, secret, time.Now()))
	newerRecorder := httptest.NewRecorder()
	router.ServeHTTP(newerRecorder, newerReq)
	if newerRecorder.Code != http.StatusOK {
		t.Fatalf("same-second webhook status=%d body=%s; want 200", newerRecorder.Code, newerRecorder.Body.String())
	}
	var status string
	var gotStart, gotEnd *time.Time
	var cancelAtPeriodEnd bool
	if err := db.QueryRow(ctx, `SELECT status, current_period_start, current_period_end, cancel_at_period_end
		FROM monetization.user_subscription WHERE id=$1`, subscriptionID).Scan(&status, &gotStart, &gotEnd, &cancelAtPeriodEnd); err != nil {
		t.Fatalf("read updated subscription: %v", err)
	}
	if status != "active" || gotStart == nil || !gotStart.Equal(periodStart) || gotEnd == nil || !gotEnd.Equal(periodEnd) || !cancelAtPeriodEnd {
		t.Fatalf("subscription status=%q period=(%v,%v) cancel=%t; want active, supplied period, cancel=true", status, gotStart, gotEnd, cancelAtPeriodEnd)
	}
	var eventCount int
	if err := db.QueryRow(ctx, `SELECT count(*) FROM monetization.subscription_event WHERE subscription_id=$1 AND kind=$2`, subscriptionID, "stripe.customer.subscription.updated").Scan(&eventCount); err != nil {
		t.Fatalf("count subscription events: %v", err)
	}
	if eventCount != 2 {
		t.Fatalf("subscription event count=%d after replay and same-second event; want 2", eventCount)
	}
	var applied string
	if err := db.QueryRow(ctx, `SELECT payload->>'applied' FROM monetization.subscription_event WHERE subscription_id=$1 AND payload->>'eventId'=$2`, subscriptionID, newerEventID).Scan(&applied); err != nil {
		t.Fatalf("read tied event application result: %v", err)
	}
	if applied != "false" {
		t.Fatalf("same-second event audit says applied=%q; want false", applied)
	}
}

func audit165StripeSignature(body []byte, secret string, timestamp time.Time) string {
	t := fmt.Sprintf("%d", timestamp.Unix())
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(t + "."))
	_, _ = mac.Write(body)
	return "t=" + t + ",v1=" + hex.EncodeToString(mac.Sum(nil))
}
