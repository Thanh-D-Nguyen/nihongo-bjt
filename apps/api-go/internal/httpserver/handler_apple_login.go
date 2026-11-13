package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"mime"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kiokoto/nihongo-bjt/api-go/internal/authn"
	"github.com/kiokoto/nihongo-bjt/api-go/internal/session"
)

func appleLoginHandler(db *pgxpool.Pool, sessions *session.Store, limiter *authn.RateLimiter, logger *slog.Logger, secure bool, clientIDs []string, verify appleTokenVerifier) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if len(clientIDs) == 0 || limiter == nil || verify == nil {
			writeJSONError(w, "service unavailable", http.StatusServiceUnavailable)
			return
		}
		mediaType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
		if err != nil || mediaType != "application/json" {
			writeJSONError(w, "invalid request", 400)
			return
		}
		var in struct {
			IDToken string `json:"idToken"`
			Nonce   string `json:"nonce"`
		}
		dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4608))
		dec.DisallowUnknownFields()
		if dec.Decode(&in) != nil || len(in.IDToken) < 1 || len(in.IDToken) > 4000 || len(in.Nonce) < 8 || len(in.Nonce) > 256 {
			writeJSONError(w, "invalid request", 400)
			return
		}
		var extra json.RawMessage
		if !errors.Is(dec.Decode(&extra), io.EOF) {
			writeJSONError(w, "invalid request", 400)
			return
		}
		peerIP := requestClientIP(r)
		allowed, err := limiter.Allow("ip:apple:" + peerIP)
		if err != nil || !allowed {
			writeJSONError(w, "too many requests", 429)
			return
		}
		claims, err := verify(r.Context(), in.IDToken, clientIDs, in.Nonce)
		if err != nil || !claims.Verified || claims.Subject == "" || len(claims.Subject) > 255 {
			writeJSONError(w, "invalid Apple credentials", 401)
			return
		}
		if db == nil || sessions == nil {
			writeJSONError(w, "service unavailable", 503)
			return
		}
		name := strings.Split(claims.Email, "@")[0]
		if len([]rune(name)) > 100 {
			name = string([]rune(name)[:100])
		}
		id, status, err := socialLearnerIdentity(r.Context(), db, "apple", claims.Subject, claims.Email, name)
		if claims.Email == "" && errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "Apple email is required to create a new account", 401)
			return
		}
		if errors.Is(err, pgx.ErrNoRows) || errors.Is(err, errGoogleEmailCollision) {
			writeJSONError(w, "account already exists; sign in with your existing method", 409)
			return
		}
		if err != nil {
			logger.Error("apple login: identity error", "error", err)
			writeJSONError(w, "internal error", 500)
			return
		}
		if status != "active" {
			writeJSONError(w, "invalid Apple credentials", 401)
			return
		}
		expires := time.Now().Add(sessionTTL)
		token, err := sessions.CreateLearnerSession(r.Context(), id, r.UserAgent(), peerIP, expires)
		if err != nil {
			logger.Error("apple login: session error", "error", err)
			writeJSONError(w, "internal error", 500)
			return
		}
		setSessionCookie(w, learnerCookieName, token, expires, secure)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true, "token": token})
	}
}

// Kept separate from provider verification, so Apple identities never auto-link by email.
func socialLearnerIdentity(ctx context.Context, db *pgxpool.Pool, provider, subject, email, name string) (string, string, error) {
	return providerLearnerIdentity(ctx, db, provider, subject, email, name)
}
