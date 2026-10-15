// Package httpserver provides HTTP handlers for billing webhook endpoints.
package httpserver

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
)

const (
	// maxWebhookBodyBytes bounds raw body size for webhook endpoints.
	maxWebhookBodyBytes = 1 << 20 // 1 MiB

	// webhookMaxRetries is the maximum retry count before dead-lettering.
	webhookMaxRetries = 3
)

type stripeSubscriptionObject struct {
	ID                 string `json:"id"`
	Status             string `json:"status"`
	CurrentPeriodStart *int64 `json:"current_period_start"`
	CurrentPeriodEnd   *int64 `json:"current_period_end"`
	CancelAtPeriodEnd  *bool  `json:"cancel_at_period_end"`
}

// stripeWebhookHandler implements POST /api/webhooks/stripe.
// This endpoint is PUBLIC — no session/auth guard. Authenticity is verified
// by HMAC SHA256 signature verification using the Stripe webhook secret.
// Idempotency is enforced via the idempotency_key unique constraint.
func stripeWebhookHandler(
	db *pgxpool.Pool,
	cfg *config.Config,
	logger *slog.Logger,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeJSONError(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		// Fail closed if webhook secret is not configured.
		if cfg.StripeWebhookSecret == "" {
			logger.Error("stripe-webhook: STRIPE_WEBHOOK_SECRET not configured")
			writeJSONError(w, "service unavailable", http.StatusServiceUnavailable)
			return
		}

		// Read raw body BEFORE any JSON parsing — critical for signature verification.
		body, err := io.ReadAll(io.LimitReader(r.Body, maxWebhookBodyBytes+1))
		if err != nil {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}
		if len(body) > maxWebhookBodyBytes {
			writeJSONError(w, "request too large", http.StatusRequestEntityTooLarge)
			return
		}
		if len(body) == 0 {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}

		// Verify stripe-signature header.
		sigHeader := r.Header.Get("Stripe-Signature")
		if sigHeader == "" {
			writeJSONError(w, "missing stripe-signature header", http.StatusBadRequest)
			return
		}

		if !verifyStripeSignature(body, sigHeader, cfg.StripeWebhookSecret) {
			logger.Warn("stripe-webhook: signature verification failed")
			writeJSONError(w, "invalid webhook signature", http.StatusBadRequest)
			return
		}

		// Parse the verified event to extract id and type.
		var event struct {
			ID      string `json:"id"`
			Type    string `json:"type"`
			Created int64  `json:"created"`
			Data    struct {
				Object stripeSubscriptionObject `json:"object"`
			} `json:"data"`
		}
		if err := json.Unmarshal(body, &event); err != nil {
			writeJSONError(w, "invalid event payload", http.StatusBadRequest)
			return
		}
		if event.ID == "" || event.Type == "" {
			writeJSONError(w, "invalid event payload", http.StatusBadRequest)
			return
		}
		if !supportedStripeSubscriptionEvent(event.Type) {
			writeJSONError(w, "unsupported stripe event", http.StatusBadRequest)
			return
		}
		if event.Created <= 0 || event.Data.Object.ID == "" {
			writeJSONError(w, "invalid subscription event payload", http.StatusBadRequest)
			return
		}
		stripeStatus, ok := stripeSubscriptionStatus(event.Type, event.Data.Object.Status)
		if !ok {
			writeJSONError(w, "invalid subscription status", http.StatusBadRequest)
			return
		}

		ctx := r.Context()

		// Idempotent ingest: attempt insert; on unique violation return 200 (duplicate).
		id, _, err := ingestWebhookEvent(ctx, db, event.ID, event.Type, "stripe", body, logger)
		if err != nil {
			if errors.Is(err, errDuplicateWebhook) {
				id, err = stripeWebhookEventID(ctx, db, event.ID)
				if err != nil {
					logger.Error("stripe-webhook: duplicate lookup failed", "error", err, "event_id", event.ID)
					writeJSONError(w, "internal error", http.StatusInternalServerError)
					return
				}
				var currentStatus string
				if err := db.QueryRow(ctx, `SELECT status FROM monetization.billing_webhook_event WHERE id=$1`, id).Scan(&currentStatus); err != nil {
					writeJSONError(w, "internal error", http.StatusInternalServerError)
					return
				}
				if currentStatus == "processed" {
					writeWebhookReceived(w)
					return
				}
				logger.Info("stripe-webhook: retrying unprocessed event", "event_id", event.ID, "status", currentStatus)
			} else {
				logger.Error("stripe-webhook: ingest failed", "error", err, "event_id", event.ID)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
		}

		// Write audit log.
		if err := writeMonetizationAudit(ctx, db, "billing", "webhook_received", map[string]interface{}{
			"eventType":      event.Type,
			"provider":       "stripe",
			"webhookEventId": id,
		}); err != nil {
			logger.Error("stripe-webhook: audit log failed", "error", err)
			// Non-fatal: event was persisted successfully.
		}

		if err := applyStripeSubscriptionEvent(ctx, db, id, event.ID, event.Type, event.Created, event.Data.Object, stripeStatus); err != nil {
			logger.Error("stripe-webhook: subscription event failed", "error", err, "event_id", event.ID)
			writeJSONError(w, "subscription event could not be applied", http.StatusInternalServerError)
			return
		}
		writeWebhookReceived(w)
	}
}

func supportedStripeSubscriptionEvent(eventType string) bool {
	switch eventType {
	case "customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted":
		return true
	default:
		return false
	}
}

func stripeSubscriptionStatus(eventType, status string) (string, bool) {
	if eventType == "customer.subscription.deleted" {
		return "canceled", true
	}
	switch status {
	case "active", "trialing", "past_due", "canceled", "unpaid", "incomplete", "ended", "paused":
		return status, true
	case "incomplete_expired":
		return "ended", true
	default:
		return "", false
	}
}

func writeWebhookReceived(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]bool{"received": true})
}

func stripeWebhookEventID(ctx context.Context, db *pgxpool.Pool, eventID string) (string, error) {
	var id string
	err := db.QueryRow(ctx, `SELECT id FROM monetization.billing_webhook_event WHERE provider='stripe' AND idempotency_key=$1`, eventID).Scan(&id)
	return id, err
}

func applyStripeSubscriptionEvent(ctx context.Context, db *pgxpool.Pool, webhookID, eventID, eventType string, eventCreated int64, object stripeSubscriptionObject, status string) error {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	tx, err := db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin stripe subscription transaction: %w", err)
	}
	defer tx.Rollback(ctx)
	var webhookStatus string
	if err := tx.QueryRow(ctx, `SELECT status FROM monetization.billing_webhook_event WHERE id=$1 FOR UPDATE`, webhookID).Scan(&webhookStatus); err != nil {
		return fmt.Errorf("lock stripe webhook event: %w", err)
	}
	if webhookStatus == "processed" {
		return tx.Commit(ctx)
	}

	var subscriptionID string
	err = tx.QueryRow(ctx, `SELECT id FROM monetization.user_subscription
		WHERE provider='stripe' AND provider_ref=$1 FOR UPDATE`, object.ID).Scan(&subscriptionID)
	if err != nil {
		return fmt.Errorf("find linked stripe subscription: %w", err)
	}
	var latestCreated int64
	if err := tx.QueryRow(ctx, `SELECT COALESCE(max((payload->>'eventCreated')::bigint), 0)
		FROM monetization.subscription_event WHERE subscription_id=$1 AND kind LIKE 'stripe.customer.subscription.%'`, subscriptionID).Scan(&latestCreated); err != nil {
		return fmt.Errorf("read latest stripe subscription event: %w", err)
	}
	if eventCreated > latestCreated {
		_, err = tx.Exec(ctx, `UPDATE monetization.user_subscription SET status=$2,
			current_period_start=COALESCE($3, current_period_start),
			current_period_end=COALESCE($4, current_period_end),
			cancel_at_period_end=COALESCE($5, cancel_at_period_end), updated_at=now() WHERE id=$1`,
			subscriptionID, status, unixTime(object.CurrentPeriodStart), unixTime(object.CurrentPeriodEnd), object.CancelAtPeriodEnd)
		if err != nil {
			return fmt.Errorf("update linked stripe subscription: %w", err)
		}
	}
	payload, err := json.Marshal(map[string]interface{}{"eventId": eventID, "eventCreated": eventCreated, "status": status, "applied": eventCreated > latestCreated})
	if err != nil {
		return fmt.Errorf("marshal stripe subscription event: %w", err)
	}
	if _, err := tx.Exec(ctx, `INSERT INTO monetization.subscription_event (subscription_id, kind, payload) VALUES ($1,$2,$3::jsonb)`, subscriptionID, "stripe."+eventType, payload); err != nil {
		return fmt.Errorf("record stripe subscription event: %w", err)
	}
	if _, err := tx.Exec(ctx, `UPDATE monetization.billing_webhook_event SET status='processed', processed_at=now(), last_error=NULL WHERE id=$1`, webhookID); err != nil {
		return fmt.Errorf("mark stripe webhook processed: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit stripe subscription event: %w", err)
	}
	return nil
}

func unixTime(seconds *int64) *time.Time {
	if seconds == nil || *seconds <= 0 {
		return nil
	}
	value := time.Unix(*seconds, 0).UTC()
	return &value
}

// verifyStripeSignature verifies the Stripe webhook signature using HMAC SHA256.
// Stripe-Signature format: t=<timestamp>,v1=<signature>[,v1=<signature>...]
// The signed payload is: <timestamp>.<raw_body>
func verifyStripeSignature(payload []byte, sigHeader, secret string) bool {
	parts := strings.Split(sigHeader, ",")
	var timestamp string
	var signatures []string

	for _, part := range parts {
		kv := strings.SplitN(strings.TrimSpace(part), "=", 2)
		if len(kv) != 2 {
			continue
		}
		switch kv[0] {
		case "t":
			timestamp = kv[1]
		case "v1":
			signatures = append(signatures, kv[1])
		}
	}

	if timestamp == "" || len(signatures) == 0 {
		return false
	}

	// Reject timestamps older than 5 minutes to prevent replay attacks.
	ts, err := strconv.ParseInt(timestamp, 10, 64)
	if err != nil {
		return false
	}
	if time.Since(time.Unix(ts, 0)).Abs() > 5*time.Minute {
		return false
	}

	// Compute expected signature: HMAC-SHA256(secret, "<timestamp>.<payload>")
	signedPayload := timestamp + "." + string(payload)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(signedPayload))
	expectedSig := hex.EncodeToString(mac.Sum(nil))

	// Check against all provided v1 signatures (Stripe may rotate keys).
	for _, sig := range signatures {
		if hmac.Equal([]byte(sig), []byte(expectedSig)) {
			return true
		}
	}

	return false
}

// errDuplicateWebhook signals that the idempotency key already exists.
var errDuplicateWebhook = errors.New("duplicate webhook event")

// ingestWebhookEvent persists a webhook event with idempotency enforcement.
// Returns the event ID and initial status, or errDuplicateWebhook for replays.
func ingestWebhookEvent(
	ctx context.Context,
	db *pgxpool.Pool,
	idempotencyKey, eventType, provider string,
	rawPayload []byte,
	logger *slog.Logger,
) (id string, status string, err error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	const q = `
		INSERT INTO monetization.billing_webhook_event
			(provider, event_type, idempotency_key, signature_verified, status, raw_payload, meta)
		VALUES ($1, $2, $3, true, 'processing', $4::jsonb, $5::jsonb)
		RETURNING id, status`

	meta, _ := json.Marshal(map[string]string{
		"eventType": eventType,
		"provider":  provider,
	})

	err = db.QueryRow(ctx, q,
		provider,
		eventType,
		idempotencyKey,
		rawPayload,
		meta,
	).Scan(&id, &status)
	if err != nil {
		// Unique constraint violation = duplicate idempotency key.
		if strings.Contains(err.Error(), "unique constraint") ||
			strings.Contains(err.Error(), "duplicate key") ||
			strings.Contains(err.Error(), "23505") {
			return "", "", fmt.Errorf("%w: %s", errDuplicateWebhook, idempotencyKey)
		}
		return "", "", fmt.Errorf("ingest webhook event: %w", err)
	}

	logger.Info("webhook event ingested",
		"id", id,
		"provider", provider,
		"event_type", eventType,
	)

	return id, status, nil
}

// writeMonetizationAudit writes an audit entry to monetization.monetization_audit_log.
func writeMonetizationAudit(
	ctx context.Context,
	db *pgxpool.Pool,
	actorKind, action string,
	payload map[string]interface{},
) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal audit payload: %w", err)
	}

	const q = `INSERT INTO monetization.monetization_audit_log (actor_kind, action, payload) VALUES ($1, $2, $3::jsonb)`
	_, err = db.Exec(ctx, q, actorKind, action, payloadJSON)
	if err != nil {
		return fmt.Errorf("write monetization audit: %w", err)
	}
	return nil
}

// shareImageStubHandler returns 501 for share image generation.
// Decision rationale: Sharp SVG→PNG rendering requires font rasterization and
// complex SVG feature support that Go's standard library cannot provide without
// significant additional dependencies (e.g., gsvg + freetype + font loading).
// This is deferred to a future milestone when share image generation is needed.
func shareImageStubHandler(logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		logger.Info("share-image: stub called (not implemented)", "path", r.URL.Path)
		writeJSONError(w, "share image generation not yet implemented", http.StatusNotImplemented)
	}
}

// Ensure pgx import is used (for ErrNoRows in other files in this package).
var _ = pgx.ErrNoRows
