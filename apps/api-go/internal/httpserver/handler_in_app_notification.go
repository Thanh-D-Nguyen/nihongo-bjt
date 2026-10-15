package httpserver

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/notification"
)

const (
	inAppNotificationDefaultLimit = 20
	inAppNotificationMaxLimit     = 100
)

// listInAppNotificationsHandler implements GET /api/learner/in-app-notifications.
func listInAppNotificationsHandler(store *notification.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		limit := inAppNotificationDefaultLimit
		if raw := r.URL.Query().Get("limit"); raw != "" {
			parsed, err := strconv.Atoi(raw)
			if err != nil || parsed < 1 || parsed > inAppNotificationMaxLimit {
				writeJSONError(w, "invalid limit", http.StatusBadRequest)
				return
			}
			limit = parsed
		}

		items, err := store.ListInAppNotifications(r.Context(), identity.UserID, limit)
		if err != nil {
			logger.Error("list in-app notifications", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(items)
	}
}

// markInAppNotificationReadHandler implements POST /api/learner/in-app-notifications/{id}/read.
func markInAppNotificationReadHandler(store *notification.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		id, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			writeJSONError(w, "invalid notification id", http.StatusBadRequest)
			return
		}

		err = store.MarkInAppNotificationRead(r.Context(), identity.UserID, id.String())
		if errors.Is(err, notification.ErrInAppNotificationNotFound) {
			writeJSONError(w, "not found", http.StatusNotFound)
			return
		}
		if err != nil {
			logger.Error("mark in-app notification read", "error", err, "user_id", identity.UserID, "notification_id", id)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusCreated)
	}
}
