package httpserver

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/scenario"
)

// listScenariosHandler implements GET /api/scenarios.
// Authenticated learner route.
func listScenariosHandler(store *scenario.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		scenarios, err := store.ListScenarios(r.Context())
		if err != nil {
			logger.Error("list scenarios", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(scenarios)
	}
}

// getScenarioHandler implements GET /api/scenarios/{scenarioId}.
// Authenticated learner route.
func getScenarioHandler(store *scenario.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		scenarioID := extractPathParam(r.URL.Path, "scenarios", 1)
		if scenarioID == "" {
			writeJSONError(w, "scenario id required", http.StatusBadRequest)
			return
		}
		sd, err := store.GetScenario(r.Context(), scenarioID)
		if err != nil {
			if errors.Is(err, scenario.ErrNotFound) {
				writeJSONError(w, "scenario not found", http.StatusNotFound)
				return
			}
			logger.Error("get scenario", "error", err, "id", scenarioID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(sd)
	}
}

// submitStepAnswerHandler implements POST /api/scenarios/steps/{stepId}/answer.
// Authenticated learner route with CSRF protection.
func submitStepAnswerHandler(store *scenario.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Extract stepId from path: .../steps/{stepId}/answer
		parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		var stepID string
		for i, p := range parts {
			if p == "steps" && i+1 < len(parts) {
				stepID = parts[i+1]
				break
			}
		}
		if stepID == "" {
			writeJSONError(w, "step id required", http.StatusBadRequest)
			return
		}

		var req scenario.StepAnswerRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.ChoiceID == "" {
			writeJSONError(w, "choiceId required", http.StatusBadRequest)
			return
		}

		result, err := store.SubmitStepAnswer(r.Context(), stepID, req.ChoiceID)
		if err != nil {
			if errors.Is(err, scenario.ErrNotFound) {
				writeJSONError(w, "choice not found", http.StatusNotFound)
				return
			}
			logger.Error("submit step answer", "error", err, "step_id", stepID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(result)
	}
}

// completeScenarioHandler implements POST /api/scenarios/{scenarioId}/complete.
// Authenticated learner route with CSRF protection.
func completeScenarioHandler(store *scenario.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		scenarioID := extractPathParam(r.URL.Path, "scenarios", 1)
		if scenarioID == "" {
			writeJSONError(w, "scenario id required", http.StatusBadRequest)
			return
		}

		var req scenario.CompleteRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}

		if err := store.CompleteScenario(r.Context(), identity.UserID, scenarioID, req.Choices); err != nil {
			logger.Error("complete scenario", "error", err, "user_id", identity.UserID, "scenario_id", scenarioID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]bool{"completed": true})
	}
}

// getScenarioAttemptsHandler implements GET /api/scenarios/{scenarioId}/attempts.
// Authenticated learner route.
func getScenarioAttemptsHandler(store *scenario.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		scenarioID := extractPathParam(r.URL.Path, "scenarios", 1)
		if scenarioID == "" {
			writeJSONError(w, "scenario id required", http.StatusBadRequest)
			return
		}

		attempts, err := store.GetAttempts(r.Context(), identity.UserID, scenarioID)
		if err != nil {
			logger.Error("get scenario attempts", "error", err, "user_id", identity.UserID, "scenario_id", scenarioID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(attempts)
	}
}
