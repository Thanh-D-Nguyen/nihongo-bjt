package httpserver

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/flashcardstyle"
)

// listFlashcardStylesHandler implements GET /api/flashcards/styles.
// Returns all active styles with lock status based on user plan.
func listFlashcardStylesHandler(store *flashcardstyle.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		styles, err := store.ListForLearner(r.Context(), identity.UserID)
		if err != nil {
			logger.Error("list flashcard styles", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(styles)
	}
}

// getActiveFlashcardStyleHandler implements GET /api/flashcards/styles/active.
// Returns the user's currently active style slug and config.
func getActiveFlashcardStyleHandler(store *flashcardstyle.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		active, err := store.GetActiveStyle(r.Context(), identity.UserID)
		if err != nil {
			logger.Error("get active flashcard style", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(active)
	}
}

// setActiveFlashcardStyleRequest is the JSON body for PUT /api/flashcards/styles/active.
type setActiveFlashcardStyleRequest struct {
	Slug *string `json:"slug"`
}

// setActiveFlashcardStyleHandler implements PUT /api/flashcards/styles/active.
// Sets the user's preferred style; pass null slug to reset to default.
func setActiveFlashcardStyleHandler(store *flashcardstyle.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		var req setActiveFlashcardStyleRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}

		active, err := store.SetActiveStyle(r.Context(), identity.UserID, req.Slug)
		if err != nil {
			if errors.Is(err, flashcardstyle.ErrNotFound) {
				writeJSONError(w, "style not found", http.StatusNotFound)
				return
			}
			logger.Error("set active flashcard style", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(active)
	}
}
