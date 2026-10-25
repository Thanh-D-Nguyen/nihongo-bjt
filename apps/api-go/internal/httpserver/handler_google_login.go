package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"mime"
	"net/http"
	"net/mail"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
	"google.golang.org/api/idtoken"
)

type googleTokenVerifier func(context.Context, string, string) (*idtoken.Payload, error)

// googleLoginHandler accepts a Google ID token issued for the configured web OAuth client.
// Native clients request a server ID token for that same audience. No client secret is needed.
func googleLoginHandler(db *pgxpool.Pool, sessions *session.Store, limiter *authn.RateLimiter, logger *slog.Logger, cookieSecure bool, clientID string, verify googleTokenVerifier) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if clientID == "" || limiter == nil || verify == nil {
			writeJSONError(w, "service unavailable", http.StatusServiceUnavailable)
			return
		}
		mediaType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
		if err != nil || mediaType != "application/json" {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}
		var input struct {
			IDToken string `json:"idToken"`
		}
		dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096))
		dec.DisallowUnknownFields()
		if err := dec.Decode(&input); err != nil || len(input.IDToken) < 1 || len(input.IDToken) > 4000 {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}
		var trailing json.RawMessage
		if err := dec.Decode(&trailing); !errors.Is(err, io.EOF) {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}
		peerIP := requestClientIP(r)
		allowed, err := limiter.Allow("ip:google:" + peerIP)
		if err != nil || !allowed {
			writeJSONError(w, "too many requests", http.StatusTooManyRequests)
			return
		}
		payload, err := verify(r.Context(), input.IDToken, clientID)
		if err != nil || payload == nil || payload.Subject == "" || len(payload.Subject) > 255 || payload.Audience != clientID ||
			(payload.Issuer != "https://accounts.google.com" && payload.Issuer != "accounts.google.com") || payload.Expires <= time.Now().Unix() {
			writeJSONError(w, "invalid Google credentials", http.StatusUnauthorized)
			return
		}
		email, _ := payload.Claims["email"].(string)
		verified, _ := payload.Claims["email_verified"].(bool)
		email = strings.ToLower(strings.TrimSpace(email))
		parsed, parseErr := mail.ParseAddress(email)
		if !verified || parseErr != nil || parsed.Address != email || len(email) > 255 {
			writeJSONError(w, "invalid Google credentials", http.StatusUnauthorized)
			return
		}
		name, _ := payload.Claims["name"].(string)
		name = strings.TrimSpace(name)
		if name == "" || len([]rune(name)) > 100 {
			name = strings.Split(email, "@")[0]
		}
		if len([]rune(name)) > 100 {
			name = string([]rune(name)[:100])
		}
		if db == nil || sessions == nil {
			writeJSONError(w, "service unavailable", http.StatusServiceUnavailable)
			return
		}

		userID, status, err := googleLearnerIdentity(r.Context(), db, payload.Subject, email, name)
		if errors.Is(err, pgx.ErrNoRows) || errors.Is(err, errGoogleEmailCollision) {
			writeJSONError(w, "account already exists; sign in with your existing method", http.StatusConflict)
			return
		}
		if err != nil {
			logger.Error("google login: identity error", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if status != "active" {
			writeJSONError(w, "invalid Google credentials", http.StatusUnauthorized)
			return
		}
		expiresAt := time.Now().Add(sessionTTL)
		token, err := sessions.CreateLearnerSession(r.Context(), userID, r.UserAgent(), peerIP, expiresAt)
		if err != nil {
			logger.Error("google login: session error", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		setSessionCookie(w, learnerCookieName, token, expiresAt, cookieSecure)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true, "token": token})
	}
}

var errGoogleEmailCollision = errors.New("google email belongs to another learner")

func googleLearnerIdentity(ctx context.Context, db *pgxpool.Pool, subject, email, name string) (string, string, error) {
	var id, status string
	err := db.QueryRow(ctx, `SELECT p.id, p.status FROM auth.identity_provider_account a
		JOIN profile.user_profile p ON p.id=a.user_id
		WHERE a.provider='google' AND a.provider_subject=$1`, subject).Scan(&id, &status)
	if err == nil {
		return id, status, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return "", "", err
	}

	// Create profile and identity atomically. An email collision never links accounts.
	tx, err := db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return "", "", err
	}
	defer tx.Rollback(ctx)
	err = tx.QueryRow(ctx, `INSERT INTO profile.user_profile (display_name, email, status, updated_at)
		VALUES ($1, $2, 'active', now()) ON CONFLICT (email) DO NOTHING RETURNING id`, name, email).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", "", errGoogleEmailCollision
	}
	if err != nil {
		return "", "", err
	}
	var identityID string
	err = tx.QueryRow(ctx, `INSERT INTO auth.identity_provider_account (user_id, provider, provider_subject, email_at_link)
		VALUES ($1, 'google', $2, $3) ON CONFLICT (provider, provider_subject) DO NOTHING RETURNING id`, id, subject, email).Scan(&identityID)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", "", errGoogleEmailCollision
	}
	if err != nil {
		return "", "", err
	}
	if err := tx.Commit(ctx); err != nil {
		return "", "", err
	}
	return id, "active", nil
}
