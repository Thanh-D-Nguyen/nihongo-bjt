package realtime

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

// AuthenticatedUser holds identity extracted from a session cookie.
type AuthenticatedUser struct {
	UserID      string
	DisplayName string
	IsAdmin     bool
}

// AuthenticateRequest extracts and validates the session from the request cookies.
// It checks learner session first, then admin session. Returns nil if neither is valid.
func AuthenticateRequest(ctx context.Context, r *http.Request, sessStore *session.Store) *AuthenticatedUser {
	if sessStore == nil {
		return nil
	}

	// Try learner session cookie.
	if cookie, err := r.Cookie("bjt_web_session"); err == nil && cookie.Value != "" {
		sess, err := sessStore.LookupLearnerSession(ctx, cookie.Value)
		if err == nil && sess != nil {
			return &AuthenticatedUser{
				UserID:  sess.UserID,
				IsAdmin: false,
			}
		}
	}

	// Try admin session cookie.
	if cookie, err := r.Cookie("bjt_admin_session"); err == nil && cookie.Value != "" {
		sess, err := sessStore.LookupAdminSession(ctx, cookie.Value)
		if err == nil && sess != nil {
			return &AuthenticatedUser{
				UserID:  sess.ActorID,
				IsAdmin: true,
			}
		}
	}

	return nil
}

// AuthenticateBattleRequest validates a learner session for the battle namespace.
// Only learner sessions are accepted; admin sessions are rejected.
func AuthenticateBattleRequest(ctx context.Context, r *http.Request, sessStore *session.Store) *AuthenticatedUser {
	if sessStore == nil {
		return nil
	}

	cookie, err := r.Cookie("bjt_web_session")
	if err != nil || cookie.Value == "" {
		return nil
	}

	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	sess, err := sessStore.LookupLearnerSession(ctx, cookie.Value)
	if err != nil || sess == nil {
		return nil
	}

	return &AuthenticatedUser{
		UserID:  sess.UserID,
		IsAdmin: false,
	}
}

// extractOrigin returns the Origin header value, or empty string if absent.
func extractOrigin(r *http.Request) string {
	return strings.TrimSpace(r.Header.Get("Origin"))
}
