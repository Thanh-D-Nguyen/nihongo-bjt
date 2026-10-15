package httpserver

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/profile"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/realtime"
)

func publicProfileHandler(store *profile.Store, presence *realtime.PresenceService, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := chi.URLParam(r, "userId")
		if _, err := uuid.Parse(userID); err != nil {
			writeJSONError(w, "userId must be a valid UUID", http.StatusBadRequest)
			return
		}
		if store == nil {
			writeJSONError(w, "service unavailable", http.StatusServiceUnavailable)
			return
		}
		var viewerID *string
		if identity, ok := authn.GetLearnerIdentity(r.Context()); ok {
			viewerID = &identity.UserID
		}
		result, err := store.GetPublicProfile(r.Context(), userID, viewerID)
		if errors.Is(err, profile.ErrProfileNotFound) {
			writeJSONError(w, "User not found", http.StatusNotFound)
			return
		}
		if err != nil {
			logger.Error("get public profile", "user_id", userID, "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		// Presence follows the same privacy gate as the other profile detail:
		// GetPublicProfile populates Stats only for viewers allowed to see it.
		if presence != nil && result.Stats != nil {
			values, err := presence.GetPresenceBatch(r.Context(), []string{userID})
			if err == nil {
				if value, ok := values[userID]; ok {
					result.Online, result.LastSeenAt = value.Online, value.LastSeenAt
				}
			}
		}
		writeJSON(w, http.StatusOK, result)
	}
}
