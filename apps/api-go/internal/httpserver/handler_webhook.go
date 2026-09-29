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
			ID   string `json:"id"`
			Type string `json:"type"`
		}
		if err := json.Unmarshal(body, &event); err != nil {
			writeJSONError(w, "invalid event payload", http.StatusBadRequest)
			return
		}
		if event.ID == "" || event.Type == "" {
			writeJSONError(w, "invalid event payload", http.StatusBadRequest)
			return
		}

		ctx := r.Context()

		// Idempotent ingest: attempt insert; on unique violation return 200 (duplicate).
		id, status, err := ingestWebhookEvent(ctx, db, event.ID, event.Type, "stripe", body, logger)
		if err != nil {
			if errors.Is(err, errDuplicateWebhook) {
				logger.Debug("stripe-webhook: duplicate event acknowledged", "event_id", event.ID)
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusOK)
				_ = json.NewEncoder(w).Encode(map[string]bool{"received": true})
				return
			}
			logger.Error("stripe-webhook: ingest failed", "error", err, "event_id", event.ID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
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

		// Mark as processed (business logic dispatch is a no-op for now;
		// future: dispatch to subscription/entitlement handlers).
		if err := markWebhookProcessed(ctx, db, id); err != nil {
			logger.Error("stripe-webhook: mark processed failed", "error", err, "event_id", id)
			// Event is persisted; will be retried by background job or admin.
		}

		_ = status // reserved for future dispatch result handling

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]bool{"received": true})
	}
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

// markWebhookProcessed updates the webhook event status to "processed".
func markWebhookProcessed(ctx context.Context, db *pgxpool.Pool, id string) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `UPDATE monetization.billing_webhook_event SET status = 'processed', processed_at = now() WHERE id = $1`
	_, err := db.Exec(ctx, q, id)
	if err != nil {
		return fmt.Errorf("mark webhook processed: %w", err)
	}
	return nil
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
