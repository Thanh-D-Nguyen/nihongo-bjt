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
	"github.com/kotobawork/nihongo-bjt/api-go/internal/flashcardreview"
)

// getDueFlashcardsHandler implements GET /api/flashcards/reviews/due.
func getDueFlashcardsHandler(store *flashcardreview.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		limit := 50
		if l := r.URL.Query().Get("limit"); l != "" {
			if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
				limit = parsed
			}
		}
		cards, err := store.GetDueFlashcards(r.Context(), identity.UserID, limit)
		if err != nil {
			logger.Error("get due flashcards", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(cards)
	}
}

// submitReviewRequest is the JSON body for POST /api/flashcards/reviews/{userFlashcardId}.
type submitReviewRequest struct {
	Rating     string     `json:"rating"`
	ElapsedMs  *int       `json:"elapsedMs,omitempty"`
	ReviewedAt *time.Time `json:"reviewedAt,omitempty"`
}

// submitReviewHandler implements POST /api/flashcards/reviews/{userFlashcardId}.
func submitReviewHandler(store *flashcardreview.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		// Extract userFlashcardId from path
		parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		var ufID string
		for i, p := range parts {
			if p == "reviews" && i+1 < len(parts) && parts[i+1] != "due" && parts[i+1] != "batch" && parts[i+1] != "comeback-summary" {
				ufID = parts[i+1]
				break
			}
		}
		if ufID == "" {
			writeJSONError(w, "userFlashcardId required", http.StatusBadRequest)
			return
		}

		var req submitReviewRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		validRatings := map[string]bool{"again": true, "hard": true, "good": true, "easy": true}
		if !validRatings[req.Rating] {
			writeJSONError(w, "invalid rating; must be again|hard|good|easy", http.StatusBadRequest)
			return
		}

		reviewedAt := time.Now()
		if req.ReviewedAt != nil {
			reviewedAt = *req.ReviewedAt
		}

		input := flashcardreview.ReviewInput{
			UserFlashcardID: ufID,
			Rating:          req.Rating,
			ElapsedMs:       req.ElapsedMs,
			ReviewedAt:      reviewedAt,
		}
		if err := store.SubmitReview(r.Context(), identity.UserID, input); err != nil {
			if errors.Is(err, flashcardreview.ErrNotFound) {
				writeJSONError(w, "user flashcard not found", http.StatusNotFound)
				return
			}
			logger.Error("submit flashcard review", "error", err, "user_flashcard_id", ufID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]bool{"success": true})
	}
}

// batchReviewRequest is the JSON body for POST /api/flashcards/reviews/batch.
type batchReviewRequest struct {
	Items []flashcardreview.BatchReviewItem `json:"items"`
}

// batchReviewHandler implements POST /api/flashcards/reviews/batch.
// Each item is processed in its own transaction; partial success is reported per-item.
func batchReviewHandler(store *flashcardreview.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req batchReviewRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if len(req.Items) == 0 {
			writeJSONError(w, "items array is required and must not be empty", http.StatusBadRequest)
			return
		}

		results := make([]flashcardreview.BatchReviewResult, 0, len(req.Items))
		for _, item := range req.Items {
			validRatings := map[string]bool{"again": true, "hard": true, "good": true, "easy": true}
			if !validRatings[item.Rating] {
				results = append(results, flashcardreview.BatchReviewResult{
					ClientMutationID: item.ClientMutationID,
					OK:               false,
					Error:            "invalid rating",
				})
				continue
			}
			reviewedAt := time.Now()
			if item.ReviewedAt != nil {
				reviewedAt = *item.ReviewedAt
			}
			input := flashcardreview.ReviewInput{
				UserFlashcardID: item.UserFlashcardID,
				Rating:          item.Rating,
				ElapsedMs:       item.ElapsedMs,
				ReviewedAt:      reviewedAt,
			}
			if err := store.SubmitReview(r.Context(), identity.UserID, input); err != nil {
				errMsg := "internal error"
				if errors.Is(err, flashcardreview.ErrNotFound) {
					errMsg = "user flashcard not found"
				} else {
					logger.Error("batch review item failed", "error", err, "client_mutation_id", item.ClientMutationID)
				}
				results = append(results, flashcardreview.BatchReviewResult{
					ClientMutationID: item.ClientMutationID,
					OK:               false,
					Error:            errMsg,
				})
				continue
			}
			results = append(results, flashcardreview.BatchReviewResult{
				ClientMutationID: item.ClientMutationID,
				OK:               true,
			})
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(results)
	}
}

// getDistractorsHandler implements GET /api/flashcards/reviews/{userFlashcardId}/distractors.
func getDistractorsHandler(store *flashcardreview.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		// Extract userFlashcardId from path: .../reviews/{id}/distractors
		parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		var ufID string
		for i, p := range parts {
			if p == "reviews" && i+2 < len(parts) && parts[i+2] == "distractors" {
				ufID = parts[i+1]
				break
			}
		}
		if ufID == "" {
			writeJSONError(w, "userFlashcardId required", http.StatusBadRequest)
			return
		}
		limit := 5
		if l := r.URL.Query().Get("limit"); l != "" {
			if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
				limit = parsed
			}
		}
		distractors, err := store.GetDistractors(r.Context(), identity.UserID, ufID, limit)
		if err != nil {
			if errors.Is(err, flashcardreview.ErrNotFound) {
				writeJSONError(w, "user flashcard not found", http.StatusNotFound)
				return
			}
			logger.Error("get distractors", "error", err, "user_flashcard_id", ufID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(distractors)
	}
}

// getComebackSummaryHandler implements GET /api/flashcards/reviews/comeback-summary.
func getComebackSummaryHandler(store *flashcardreview.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		summary, err := store.GetComebackSummary(r.Context(), identity.UserID)
		if err != nil {
			logger.Error("get comeback summary", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(summary)
	}
}
