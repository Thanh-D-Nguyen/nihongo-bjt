package httpserver

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/career"
)

// startStoryAttemptHandler implements POST /api/story/chapters/{id}/attempts.
// It returns the learner's in-progress attempt (200) or creates one (201).
func startStoryAttemptHandler(store *career.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		chapterID, ok := canonicalChapterID(r)
		if !ok {
			writeJSONError(w, "chapter not found", http.StatusNotFound)
			return
		}
		attempt, created, err := store.StartChapterAttempt(r.Context(), identity.UserID, chapterID)
		switch {
		case errors.Is(err, career.ErrNotFound):
			writeJSONError(w, "chapter not found", http.StatusNotFound)
		case errors.Is(err, career.ErrChapterLocked):
			writeJSONError(w, "chapter locked", http.StatusForbidden)
		case err != nil:
			logger.Error("start story attempt", "error", err, "user_id", identity.UserID, "chapter_id", chapterID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
		case created:
			writeJSON(w, http.StatusCreated, attempt)
		default:
			writeJSON(w, http.StatusOK, attempt)
		}
	}
}

// completeStoryAttemptHandler implements POST /api/story/chapters/{id}/attempts/current/complete.
// The optional body {"optionKey": "A"} is the answer the learner chose.
func completeStoryAttemptHandler(store *career.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		chapterID, ok := canonicalChapterID(r)
		if !ok {
			writeJSONError(w, "chapter not found", http.StatusNotFound)
			return
		}
		var body struct {
			OptionKey string `json:"optionKey"`
		}
		raw, err := io.ReadAll(io.LimitReader(r.Body, 4<<10))
		if err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if len(raw) > 0 {
			if err := json.Unmarshal(raw, &body); err != nil {
				writeJSONError(w, "invalid request body", http.StatusBadRequest)
				return
			}
		}
		completion, err := store.CompleteChapterAttempt(r.Context(), identity.UserID, chapterID, body.OptionKey)
		switch {
		case errors.Is(err, career.ErrNotFound):
			writeJSONError(w, "chapter not found", http.StatusNotFound)
		case errors.Is(err, career.ErrNoActiveAttempt):
			writeJSONError(w, "no in-progress chapter attempt", http.StatusNotFound)
		case errors.Is(err, career.ErrInvalidOption):
			writeJSONError(w, "invalid optionKey", http.StatusBadRequest)
		case err != nil:
			logger.Error("complete story attempt", "error", err, "user_id", identity.UserID, "chapter_id", chapterID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
		default:
			writeJSON(w, http.StatusOK, completion)
		}
	}
}

// getStoryProgressHandler implements GET /api/story/progress for the signed-in learner.
func getStoryProgressHandler(store *career.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		progress, err := store.GetStoryProgress(r.Context(), identity.UserID)
		if err != nil {
			logger.Error("get story progress", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, progress)
	}
}
