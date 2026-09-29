package realtime

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

// MountRoutes registers WebSocket upgrade endpoints on the given router.
// Both endpoints require session authentication via cookie.
func MountRoutes(r chi.Router, sessStore *session.Store, server *Server, csrfCfg authn.CSRFConfig) {
	// Battle namespace — learner session required.
	r.Group(func(lr chi.Router) {
		lr.Use(authn.LearnerGuard(sessStore, authn.DefaultGuardConfig(nil)))
		lr.Get("/ws/battle", server.HandleBattleUpgrade)
	})

	// Presence namespace — learner or admin session accepted.
	// No CSRF guard: WebSocket upgrade is a GET request; auth is via cookie.
	r.Get("/ws/presence", func(w http.ResponseWriter, r *http.Request) {
		server.HandlePresenceUpgrade(w, r)
	})
}
