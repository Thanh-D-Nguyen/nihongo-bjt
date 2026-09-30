package httpserver

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/exercisereview"
)

// getDueReviewsHandler implements GET /api/exercises/review/due.
// Returns exercises due for SRS review, ordered by due date ascending.
func getDueReviewsHandler(store *exercisereview.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		limit := 20
		if l := r.URL.Query().Get("limit"); l != "" {
			if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
				limit = parsed
			}
		}

		exercises, err := store.GetDueExercises(r.Context(), identity.UserID, limit)
		if err != nil {
			logger.Error("get due reviews", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(exercises)
	}
}

// reviewExerciseRequest is the JSON body for POST /api/exercises/review/{exerciseId}.
type reviewExerciseRequest struct {
	Rating string `json:"rating"`
}

// reviewExerciseHandler implements POST /api/exercises/review/{exerciseId}.
// Submits an SRS review rating and updates the scheduling state.
func reviewExerciseHandler(store *exercisereview.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		// Extract exerciseId from path: /api/exercises/review/{exerciseId}
		parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		var exerciseID string
		for i, p := range parts {
			if p == "review" && i+1 < len(parts) {
				exerciseID = parts[i+1]
				break
			}
		}
		if exerciseID == "" {
			writeJSONError(w, "exerciseId required", http.StatusBadRequest)
			return
		}

		var req reviewExerciseRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}

		// Validate rating matches NestJS enum: again | hard | good | easy
		validRatings := map[string]bool{"again": true, "hard": true, "good": true, "easy": true}
		if !validRatings[req.Rating] {
			writeJSONError(w, "invalid rating; must be again|hard|good|easy", http.StatusBadRequest)
			return
		}

		// Load current state or create new
		state, err := store.GetReviewState(r.Context(), identity.UserID, exerciseID)
		if err != nil && !errors.Is(err, exercisereview.ErrNotFound) {
			logger.Error("get review state", "error", err, "exercise_id", exerciseID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		var next exercisereview.ReviewState
		if state == nil {
			// New entry — initialize with defaults
			next = computeNextReview(exercisereview.ReviewState{
				UserID:       identity.UserID,
				ExerciseID:   exerciseID,
				State:        "new",
				EaseFactor:   2.5,
				IntervalDays: 0,
				Repetitions:  0,
				Lapses:       0,
			}, req.Rating)
		} else {
			next = computeNextReview(*state, req.Rating)
		}

		if err := store.UpsertReviewState(r.Context(), next); err != nil {
			logger.Error("upsert review state", "error", err, "exercise_id", exerciseID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(next)
	}
}

// computeNextReview applies SM-2 spaced repetition algorithm to determine next review state.
// This mirrors the NestJS computeNextReview utility.
func computeNextReview(current exercisereview.ReviewState, rating string) exercisereview.ReviewState {
	next := current
	now := timeNow()

	switch rating {
	case "again":
		next.Lapses++
		next.Repetitions = 0
		next.IntervalDays = 0
		next.State = "learning"
		next.EaseFactor = maxFloat(1.3, current.EaseFactor-0.2)
		next.DueAt = now.Add(10 * time.Minute)
	case "hard":
		next.IntervalDays = maxInt(1, int(float64(current.IntervalDays)*1.2))
		next.EaseFactor = maxFloat(1.3, current.EaseFactor-0.15)
		next.Repetitions++
		if next.Repetitions >= 3 {
			next.State = "review"
		}
		next.DueAt = now.Add(time.Duration(next.IntervalDays) * 24 * time.Hour)
	case "good":
		if current.IntervalDays == 0 {
			next.IntervalDays = 1
		} else {
			next.IntervalDays = int(float64(current.IntervalDays) * current.EaseFactor)
		}
		next.Repetitions++
		if next.Repetitions >= 3 {
			next.State = "review"
		}
		next.DueAt = now.Add(time.Duration(next.IntervalDays) * 24 * time.Hour)
	case "easy":
		if current.IntervalDays == 0 {
			next.IntervalDays = 4
		} else {
			next.IntervalDays = int(float64(current.IntervalDays) * current.EaseFactor * 1.3)
		}
		next.EaseFactor += 0.15
		next.Repetitions++
		next.State = "review"
		next.DueAt = now.Add(time.Duration(next.IntervalDays) * 24 * time.Hour)
	}

	return next
}

// timeNow is a variable for testing; defaults to time.Now.
var timeNow = func() time.Time { return time.Now() }

func maxFloat(a, b float64) float64 {
	if a > b {
		return a
	}
	return b
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}