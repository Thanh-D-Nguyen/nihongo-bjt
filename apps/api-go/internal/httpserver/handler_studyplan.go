package httpserver

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/studyplan"
)

// getTodayStudyPlanHandler implements GET /api/gamification/study-plan/today.
func getTodayStudyPlanHandler(store *studyplan.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		plan, err := store.GetTodayPlan(r.Context(), identity.UserID)
		if err != nil {
			logger.Error("get today study plan", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(plan)
	}
}

// recordStudyProgressRequest is the JSON body for POST /api/gamification/study-plan/progress.
type recordStudyProgressRequest struct {
	TaskType string `json:"taskType"`
}

// recordStudyProgressHandler implements POST /api/gamification/study-plan/progress.
func recordStudyProgressHandler(store *studyplan.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req recordStudyProgressRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		validTypes := map[string]bool{
			"srs_review":   true,
			"bjt_quiz":     true,
			"daily_phrase": true,
			"battle_bot":   true,
		}
		if !validTypes[req.TaskType] {
			writeJSONError(w, "invalid taskType; must be srs_review|bjt_quiz|daily_phrase|battle_bot", http.StatusBadRequest)
			return
		}
		result, err := store.RecordProgress(r.Context(), identity.UserID, req.TaskType)
		if err != nil {
			logger.Error("record study progress", "error", err, "user_id", identity.UserID, "task_type", req.TaskType)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(result)
	}
}