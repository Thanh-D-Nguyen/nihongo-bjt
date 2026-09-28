package httpserver

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/authz"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

// adminSessionHandler implements GET /api/admin/session — validates the admin session
// and returns actor ID + display name. Mirrors NestJS AdminController.session().
// This is a session bootstrap probe; it does NOT check fine-grained permissions.
// GET /api/admin/me is intentionally deferred to M6 (full admin RBAC cutover).
func adminSessionHandler(rbacStore *authz.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
			return
		}

		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		principal, err := rbacStore.LoadPrincipal(r.Context(), identity.ActorID)
		if err != nil {
			logger.Error("admin session: load principal failed", "error", err, "actor_id", identity.ActorID)
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"actorId":     principal.ActorID,
			"displayName": principal.DisplayName,
		})
	}
}

// adminLogoutHandler implements POST /api/admin/logout — revokes the current admin session
// and clears the admin cookie. CSRF protection applied at router level.
func adminLogoutHandler(sessionStore *session.Store, logger *slog.Logger, cookieName string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
			return
		}

		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		// Revoke only the current session (owner-scoped to prevent cross-actor revocation).
		if err := sessionStore.RevokeAdminSession(r.Context(), identity.SessionID, identity.ActorID); err != nil {
			logger.Error("admin logout: revoke failed", "error", err, "session_id", identity.SessionID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		clearSessionCookie(w, cookieName)

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]bool{"ok": true})
	}
}
