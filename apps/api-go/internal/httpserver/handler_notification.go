package httpserver

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/notification"
)

// getNotificationPreferencesHandler implements GET /api/learner/notification-preferences.
func getNotificationPreferencesHandler(store *notification.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		prefs, err := store.GetPreferences(r.Context(), identity.UserID)
		if err != nil {
			logger.Error("get notification preferences", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(prefs)
	}
}

// updateNotificationPreferencesRequest is the JSON body for PUT /api/learner/notification-preferences.
type updateNotificationPreferencesRequest struct {
	StudyRemindersEnabled *bool `json:"studyRemindersEnabled"`
	ProductNewsEnabled    *bool `json:"productNewsEnabled"`
	EmailEnabled          *bool `json:"emailEnabled"`
	InAppEnabled          *bool `json:"inAppEnabled"`
}

// putNotificationPreferencesHandler implements PUT /api/learner/notification-preferences.
func putNotificationPreferencesHandler(store *notification.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		var req updateNotificationPreferencesRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}

		prefs, err := store.UpdatePreferences(r.Context(), identity.UserID, notification.UpdateInput{
			StudyRemindersEnabled: req.StudyRemindersEnabled,
			ProductNewsEnabled:    req.ProductNewsEnabled,
			EmailEnabled:          req.EmailEnabled,
			InAppEnabled:          req.InAppEnabled,
		})
		if err != nil {
			logger.Error("update notification preferences", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(prefs)
	}
}
