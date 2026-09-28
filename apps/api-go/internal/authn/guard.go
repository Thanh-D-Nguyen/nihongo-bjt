// Package authn provides HTTP session authentication guards for learner and admin sessions.
// These guards validate opaque session cookies against the PostgreSQL session store.
// They do NOT implement login endpoints or credential verification.
package authn

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

// Context keys for authenticated identity. Unexported to prevent cross-package collision.
type contextKey int

const (
	learnerIdentityKey contextKey = iota
	adminIdentityKey
)

// LearnerIdentity is the authenticated learner extracted from a valid session.
type LearnerIdentity struct {
	SessionID string
	UserID    string
}

// AdminIdentity is the authenticated admin actor extracted from a valid session.
type AdminIdentity struct {
	SessionID string
	ActorID   string
}

// GuardConfig holds configuration for session guards.
type GuardConfig struct {
	LearnerCookieName string // default: "bjt_web_session"
	AdminCookieName   string // default: "bjt_admin_session"
	Logger            *slog.Logger
}

// DefaultGuardConfig returns sensible defaults matching canonical spec cookie naming.
func DefaultGuardConfig(logger *slog.Logger) GuardConfig {
	return GuardConfig{
		LearnerCookieName: "bjt_web_session",
		AdminCookieName:   "bjt_admin_session",
		Logger:            logger,
	}
}

// LearnerGuard returns middleware that validates a learner session cookie and injects
// LearnerIdentity into the request context. Returns 401 for missing/invalid/expired/revoked/disabled sessions.
// Does NOT touch health routes — caller should mount only on authenticated route groups.
func LearnerGuard(store *session.Store, cfg GuardConfig) func(http.Handler) http.Handler {
	cookieName := cfg.LearnerCookieName
	if cookieName == "" {
		cookieName = "bjt_web_session"
	}
	logger := cfg.Logger
	if logger == nil {
		logger = slog.Default()
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			raw := extractCookie(r, cookieName)
			if raw == "" {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}

			sess, err := store.LookupLearnerSession(r.Context(), raw)
			if err != nil {
				if errors.Is(err, session.ErrSessionNotFound) || errors.Is(err, session.ErrInvalidToken) {
					http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
					return
				}
				logger.Error("learner session lookup failed", "error", err)
				http.Error(w, `{"error":"internal"}`, http.StatusInternalServerError)
				return
			}

			ctx := context.WithValue(r.Context(), learnerIdentityKey, LearnerIdentity{
				SessionID: sess.ID,
				UserID:    sess.UserID,
			})
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// AdminGuard returns middleware that validates an admin session cookie and injects
// AdminIdentity into the request context. Returns 401 for missing/invalid/expired/revoked/disabled sessions.
func AdminGuard(store *session.Store, cfg GuardConfig) func(http.Handler) http.Handler {
	cookieName := cfg.AdminCookieName
	if cookieName == "" {
		cookieName = "bjt_admin_session"
	}
	logger := cfg.Logger
	if logger == nil {
		logger = slog.Default()
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			raw := extractCookie(r, cookieName)
			if raw == "" {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}

			sess, err := store.LookupAdminSession(r.Context(), raw)
			if err != nil {
				if errors.Is(err, session.ErrSessionNotFound) || errors.Is(err, session.ErrInvalidToken) {
					http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
					return
				}
				logger.Error("admin session lookup failed", "error", err)
				http.Error(w, `{"error":"internal"}`, http.StatusInternalServerError)
				return
			}

			ctx := context.WithValue(r.Context(), adminIdentityKey, AdminIdentity{
				SessionID: sess.ID,
				ActorID:   sess.ActorID,
			})
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// GetLearnerIdentity extracts the authenticated learner from the request context.
// Returns zero value and false if not authenticated.
func GetLearnerIdentity(ctx context.Context) (LearnerIdentity, bool) {
	id, ok := ctx.Value(learnerIdentityKey).(LearnerIdentity)
	return id, ok
}

// GetAdminIdentity extracts the authenticated admin from the request context.
// Returns zero value and false if not authenticated.
func GetAdminIdentity(ctx context.Context) (AdminIdentity, bool) {
	id, ok := ctx.Value(adminIdentityKey).(AdminIdentity)
	return id, ok
}

func extractCookie(r *http.Request, name string) string {
	c, err := r.Cookie(name)
	if err != nil {
		return ""
	}
	return strings.TrimSpace(c.Value)
}
