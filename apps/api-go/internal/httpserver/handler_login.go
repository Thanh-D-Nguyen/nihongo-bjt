// Package httpserver provides HTTP handlers for authentication endpoints.
package httpserver

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"mime"
	"net/http"
	"strings"
	"time"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/authz"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/credential"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/profile"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

const (
	// maxLoginBodyBytes bounds JSON body size to prevent memory exhaustion.
	maxLoginBodyBytes = 4096

	// sessionTTL aligns cookie MaxAge with DB session expiry.
	sessionTTL = 24 * time.Hour

	// learnerCookieName and adminCookieName are separate to enforce namespace isolation.
	learnerCookieName = "bjt_web_session"
	adminCookieName   = "bjt_admin_session"
)

// loginRequest is the expected JSON shape for POST /api/auth/login and /api/admin/login.
type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// learnerLoginHandler implements POST /api/auth/login.
// Requires non-nil rateLimiter (fail closed). Uses authn.NormalizePeerIP for IP key.
// Generic 401 for all credential failures; 500 only for backend outages.
func learnerLoginHandler(
	credStore *credential.Store,
	profileStore *profile.Store,
	sessionStore *session.Store,
	rateLimiter *authn.RateLimiter,
	logger *slog.Logger,
	cookieSecure bool,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeJSONError(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		// Fail closed: limiter must be present BEFORE any expensive work.
		if rateLimiter == nil {
			logger.Error("learner login: rate limiter nil; rejecting")
			writeJSONError(w, "service unavailable", http.StatusServiceUnavailable)
			return
		}

		// Content-Type enforcement via mime.ParseMediaType (rejects application/jsonx etc.).
		ct := r.Header.Get("Content-Type")
		mediaType, _, err := mime.ParseMediaType(ct)
		if err != nil || mediaType != "application/json" {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}

		// Bounded body read.
		body, err := io.ReadAll(io.LimitReader(r.Body, maxLoginBodyBytes+1))
		if err != nil {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}
		if len(body) > maxLoginBodyBytes {
			writeJSONError(w, "request too large", http.StatusRequestEntityTooLarge)
			return
		}
		if len(body) == 0 {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}

		// Strict JSON decode: reject unknown fields and trailing data.
		dec := json.NewDecoder(strings.NewReader(string(body)))
		dec.DisallowUnknownFields()
		var req loginRequest
		if err := dec.Decode(&req); err != nil {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}
		// Reject trailing tokens/garbage by attempting a second decode expecting EOF.
		var trailing json.RawMessage
		if err := dec.Decode(&trailing); !errors.Is(err, io.EOF) {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}

		email := strings.ToLower(strings.TrimSpace(req.Email))
		password := req.Password

		// Cheap input validation BEFORE rate limiting or expensive crypto.
		if email == "" || password == "" {
			writeJSONError(w, "invalid credentials", http.StatusUnauthorized)
			return
		}
		if len(password) > credential.MaxPasswordLen {
			writeJSONError(w, "invalid credentials", http.StatusUnauthorized)
			return
		}

		// Rate limit by normalized peer IP (ignores X-Forwarded-For/X-Real-IP).
		peerIP := authn.NormalizePeerIP(r.RemoteAddr)
		ipKey := "ip:" + peerIP
		ok, err := rateLimiter.Allow(ipKey)
		if err != nil || !ok {
			writeJSONError(w, "too many requests", http.StatusTooManyRequests)
			return
		}

		// Rate limit by account key (SHA-256 prefix to avoid raw email in map/logs).
		acctKey := "acct:l:" + hashAccountKey(email)
		ok, err = rateLimiter.Allow(acctKey)
		if err != nil || !ok {
			writeJSONError(w, "too many requests", http.StatusTooManyRequests)
			return
		}

		// Lookup learner profile.
		p, err := profileStore.GetLearnerByEmail(r.Context(), email)
		if err != nil {
			// DB error — safe 500, no credential detail.
			logger.Error("learner login: profile lookup failed", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if p == nil || p.Status != "active" {
			// Unknown/disabled: single bounded burn to prevent timing oracle.
			burnTime()
			writeJSONError(w, "invalid credentials", http.StatusUnauthorized)
			return
		}

		// Verify credential. On mismatch, do NOT burn again — Verify already
		// performed a full Argon2 hash. Double-burning creates a measurable
		// timing difference between wrong-password and unknown-user paths.
		if err := credStore.VerifyLearner(r.Context(), p.ID, []byte(password)); err != nil {
			if errors.Is(err, credential.ErrMismatch) ||
				errors.Is(err, credential.ErrCredentialNotFound) ||
				errors.Is(err, credential.ErrMalformedRecord) ||
				errors.Is(err, credential.ErrUnsupportedAlgo) ||
				errors.Is(err, credential.ErrInvalidParams) {
				writeJSONError(w, "invalid credentials", http.StatusUnauthorized)
				return
			}
			// Backend/DB error.
			logger.Error("learner login: verify failed", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		// Create new session (opaque token, digest persisted).
		expiresAt := time.Now().Add(sessionTTL)
		rawToken, err := sessionStore.CreateLearnerSession(r.Context(), p.ID, r.UserAgent(), peerIP, expiresAt)
		if err != nil {
			logger.Error("learner login: create session failed", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		setSessionCookie(w, learnerCookieName, rawToken, expiresAt, cookieSecure)

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":    true,
			"token": rawToken,
		})
	}
}

// adminLoginHandler implements POST /api/admin/login.
// Requires non-nil rateLimiter (fail closed). Uses authn.NormalizePeerIP for IP key.
// Generic 401 for all credential failures; 500 only for backend outages.
func adminLoginHandler(
	credStore *credential.Store,
	rbacStore *authz.Store,
	sessionStore *session.Store,
	rateLimiter *authn.RateLimiter,
	logger *slog.Logger,
	cookieSecure bool,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeJSONError(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		// Fail closed: limiter must be present BEFORE any expensive work.
		if rateLimiter == nil {
			logger.Error("admin login: rate limiter nil; rejecting")
			writeJSONError(w, "service unavailable", http.StatusServiceUnavailable)
			return
		}

		// Content-Type enforcement via mime.ParseMediaType.
		ct := r.Header.Get("Content-Type")
		mediaType, _, err := mime.ParseMediaType(ct)
		if err != nil || mediaType != "application/json" {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}

		// Bounded body read.
		body, err := io.ReadAll(io.LimitReader(r.Body, maxLoginBodyBytes+1))
		if err != nil {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}
		if len(body) > maxLoginBodyBytes {
			writeJSONError(w, "request too large", http.StatusRequestEntityTooLarge)
			return
		}
		if len(body) == 0 {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}

		// Strict JSON decode: reject unknown fields and trailing data.
		dec := json.NewDecoder(strings.NewReader(string(body)))
		dec.DisallowUnknownFields()
		var req loginRequest
		if err := dec.Decode(&req); err != nil {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}
		// Reject trailing tokens/garbage by attempting a second decode expecting EOF.
		var trailing json.RawMessage
		if err := dec.Decode(&trailing); !errors.Is(err, io.EOF) {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}

		email := strings.ToLower(strings.TrimSpace(req.Email))
		password := req.Password

		// Cheap input validation BEFORE rate limiting or expensive crypto.
		if email == "" || password == "" {
			writeJSONError(w, "invalid credentials", http.StatusUnauthorized)
			return
		}
		if len(password) > credential.MaxPasswordLen {
			writeJSONError(w, "invalid credentials", http.StatusUnauthorized)
			return
		}

		// Rate limit by normalized peer IP.
		peerIP := authn.NormalizePeerIP(r.RemoteAddr)
		ipKey := "ip:" + peerIP
		ok, err := rateLimiter.Allow(ipKey)
		if err != nil || !ok {
			writeJSONError(w, "too many requests", http.StatusTooManyRequests)
			return
		}

		// Rate limit by account key.
		acctKey := "acct:a:" + hashAccountKey(email)
		ok, err = rateLimiter.Allow(acctKey)
		if err != nil || !ok {
			writeJSONError(w, "too many requests", http.StatusTooManyRequests)
			return
		}

		// Lookup admin actor.
		actorID, err := rbacStore.GetActiveActorIDByEmail(r.Context(), email)
		if err != nil {
			logger.Error("admin login: actor lookup failed", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if actorID == "" {
			burnTime()
			writeJSONError(w, "invalid credentials", http.StatusUnauthorized)
			return
		}

		// Verify credential. No additional burn on mismatch — Verify already hashed.
		if err := credStore.VerifyAdmin(r.Context(), actorID, []byte(password)); err != nil {
			if errors.Is(err, credential.ErrMismatch) ||
				errors.Is(err, credential.ErrCredentialNotFound) ||
				errors.Is(err, credential.ErrMalformedRecord) ||
				errors.Is(err, credential.ErrUnsupportedAlgo) ||
				errors.Is(err, credential.ErrInvalidParams) {
				writeJSONError(w, "invalid credentials", http.StatusUnauthorized)
				return
			}
			logger.Error("admin login: verify failed", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		// Create new admin session.
		expiresAt := time.Now().Add(sessionTTL)
		rawToken, err := sessionStore.CreateAdminSession(r.Context(), actorID, r.UserAgent(), peerIP, expiresAt)
		if err != nil {
			logger.Error("admin login: create session failed", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		setSessionCookie(w, adminCookieName, rawToken, expiresAt, cookieSecure)

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]bool{"ok": true})
	}
}

// setSessionCookie sets an HttpOnly SameSite=Lax cookie with expiry aligned to DB.
// The Secure flag is controlled by cfg.CookieSecure (env COOKIE_SECURE); defaults
// to true for production HTTPS. Set COOKIE_SECURE=false for HTTP-only staging.
func setSessionCookie(w http.ResponseWriter, name, value string, expiresAt time.Time, secure bool) {
	http.SetCookie(w, &http.Cookie{
		Name:     name,
		Value:    value,
		Path:     "/",
		Expires:  expiresAt,
		MaxAge:   int(time.Until(expiresAt).Seconds()),
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteLaxMode,
	})
}

// burnTime performs a dummy Argon2id hash to prevent timing oracle on user existence.
// The cost matches a real verification (~64MiB, 3 iterations, 2 parallelism).
// Called ONLY when no real Verify was performed (unknown user / disabled / missing credential).
func burnTime() {
	_, _ = credential.Hash([]byte("burn"), credential.DefaultParams())
}

// hashAccountKey returns a truncated SHA-256 hex of the normalized email to avoid
// storing raw PII in the rate-limiter map or logs. 16 bytes (32 hex chars) provides
// sufficient collision resistance for rate-limit bucketing.
func hashAccountKey(email string) string {
	h := sha256.Sum256([]byte(email))
	return hex.EncodeToString(h[:16])
}
