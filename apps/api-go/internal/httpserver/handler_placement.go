package httpserver

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/placement"
)

func placementOnboardingStatusHandler(store *placement.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		state, err := store.GetOnboardingState(r.Context(), identity.UserID)
		if err != nil {
			logger.Error("get learner onboarding state", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, state)
	}
}

// startPlacementHandler implements POST /api/learner/placement/start.
// Creates or resumes an in-progress placement session for the authenticated learner.
func startPlacementHandler(store *placement.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		// Check for existing in-progress session (idempotent resume)
		existing, err := store.FindActiveSession(r.Context(), identity.UserID)
		if err != nil {
			logger.Error("find active placement session", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if existing != nil {
			questions, err := store.LoadQuestions(r.Context(), existing.QuestionIDs)
			if err != nil {
				logger.Error("load active placement questions", "error", err, "user_id", identity.UserID)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_ = json.NewEncoder(w).Encode(placement.StartResponse{
				SessionID:   existing.ID,
				QuestionIDs: existing.QuestionIDs,
				Status:      existing.Status,
				Questions:   questions,
			})
			return
		}

		// Load question pool and create new session
		pool, err := store.LoadQuestionPool(r.Context())
		if err != nil {
			logger.Error("load placement question pool", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if len(pool) == 0 {
			writeJSONError(w, "No published BJT questions available for placement", http.StatusBadRequest)
			return
		}
		questions, err := store.LoadQuestions(r.Context(), pool)
		if err != nil {
			logger.Error("load placement questions", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		// Generate fairness seed
		seedBytes := make([]byte, 16)
		if _, err := rand.Read(seedBytes); err != nil {
			logger.Error("generate placement seed", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		seed := hex.EncodeToString(seedBytes)

		resp, err := store.CreateSession(r.Context(), identity.UserID, pool, seed)
		if err != nil {
			logger.Error("create placement session", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		resp.Questions = questions

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(resp)
	}
}

// submitPlacementRequest is the JSON body for POST /api/learner/placement/submit.
type submitPlacementRequest struct {
	SessionID string            `json:"sessionId"`
	Answers   map[string]string `json:"answers"`
}

// submitPlacementHandler implements POST /api/learner/placement/submit.
// Scores answers against the session's questions and returns estimated BJT band.
func submitPlacementHandler(store *placement.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		var req submitPlacementRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.SessionID == "" {
			writeJSONError(w, "sessionId is required", http.StatusBadRequest)
			return
		}

		session, err := store.GetSession(r.Context(), req.SessionID, identity.UserID)
		if err != nil {
			if errors.Is(err, placement.ErrSessionNotFound) {
				writeJSONError(w, "Placement session not found", http.StatusNotFound)
				return
			}
			logger.Error("get placement session", "error", err, "session_id", req.SessionID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		// Already completed — return cached result
		if session.Status == "completed" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_ = json.NewEncoder(w).Encode(placement.SubmitResponse{
				AlreadyCompleted: true,
				CorrectCount:     session.CorrectCount,
				EstimatedBjtBand: session.EstimatedBjtBand,
			})
			return
		}

		correctCount, err := store.ScoreAnswers(r.Context(), req.SessionID, identity.UserID, req.Answers)
		if errors.Is(err, placement.ErrInvalidAnswer) {
			writeJSONError(w, "answers must include a valid option for every question", http.StatusBadRequest)
			return
		}
		if err != nil {
			logger.Error("score placement answers", "error", err, "session_id", req.SessionID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		total := len(session.QuestionIDs)
		band := estimateBjtBand(correctCount, total)

		resp, err := store.CompleteSession(r.Context(), req.SessionID, identity.UserID, correctCount, band)
		if err != nil {
			logger.Error("complete placement session", "error", err, "session_id", req.SessionID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(resp)
	}
}

// estimateBjtBand returns a BJT band estimate based on correct/total ratio.
// This is a simplified placeholder; real scoring uses question difficulty weights.
func estimateBjtBand(correct, total int) string {
	if total == 0 {
		return "N5"
	}
	ratio := float64(correct) / float64(total)
	switch {
	case ratio >= 0.9:
		return "A"
	case ratio >= 0.8:
		return "B"
	case ratio >= 0.7:
		return "C"
	case ratio >= 0.6:
		return "D"
	case ratio >= 0.5:
		return "E"
	default:
		return "F"
	}
}
