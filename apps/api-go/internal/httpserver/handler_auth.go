package httpserver

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/profile"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

// learnerMeHandler implements GET /api/auth/me — returns the authenticated learner's public profile.
// Mirrors NestJS AuthController.me() response shape: { profile, sub }.
func learnerMeHandler(profileStore *profile.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
			return
		}

		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		p, err := profileStore.GetLearnerPublicProfile(r.Context(), identity.UserID)
		if err != nil {
			if errors.Is(err, profile.ErrProfileNotFound) {
				writeJSONError(w, "unauthorized", http.StatusUnauthorized)
				return
			}
			logger.Error("learner me: profile lookup failed", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		resp := map[string]any{
			"profile": p,
		}
		// Preserve NestJS compatibility: include sub from stored keycloakSubject if present.
		if p.KeycloakSubject != nil && *p.KeycloakSubject != "" {
			resp["sub"] = *p.KeycloakSubject
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(resp)
	}
}

// learnerLogoutHandler implements POST /api/auth/logout — revokes the current learner session and clears the cookie.
// CSRF protection is applied at the router level via authn.CSRFGuard middleware.
func learnerLogoutHandler(sessionStore *session.Store, logger *slog.Logger, cookieName string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
			return
		}

		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		// Revoke only the current session (owner-scoped to prevent cross-user revocation).
		if err := sessionStore.RevokeLearnerSession(r.Context(), identity.SessionID, identity.UserID); err != nil {
			logger.Error("learner logout: revoke failed", "error", err, "session_id", identity.SessionID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		// Clear the session cookie.
		clearSessionCookie(w, cookieName)

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]bool{"ok": true})
	}
}

func writeJSONError(w http.ResponseWriter, msg string, status int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

func clearSessionCookie(w http.ResponseWriter, name string) {
	http.SetCookie(w, &http.Cookie{
		Name:     name,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
	})
}
