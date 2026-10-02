package httpserver

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/onboarding"
)

// AvailableTopics mirrors the NestJS AVAILABLE_TOPICS constant for onboarding.
var AvailableTopics = []string{
	"business_japanese",
	"daily_conversation",
	"reading_news",
	"jlpt_prep",
	"travel",
	"general",
	"tech",
	"finance",
	"healthcare",
	"education",
}

// ValidGoals and ValidStyles mirror the NestJS validation constants.
var (
	ValidGoals  = map[string]bool{"pass_bjt": true, "business_japanese": true, "daily_conversation": true, "reading_news": true, "jlpt_prep": true, "travel": true, "general": true}
	ValidStyles = map[string]bool{"visual": true, "practice": true, "immersion": true, "flashcard": true, "mixed": true}
)

// getOnboardingPreferencesHandler implements GET /api/recommendation/onboarding/preferences.
func getOnboardingPreferencesHandler(store *onboarding.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		prefs, err := store.GetPreferences(r.Context(), identity.UserID)
		if err != nil {
			if errors.Is(err, onboarding.ErrNotFound) {
				// Return empty preferences with available topics when not yet saved.
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusOK)
				_ = json.NewEncoder(w).Encode(map[string]interface{}{
					"preferences":     nil,
					"availableTopics": AvailableTopics,
				})
				return
			}
			logger.Error("get onboarding preferences", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"preferences":     prefs,
			"availableTopics": AvailableTopics,
		})
	}
}

// getOnboardingStatusHandler implements GET /api/recommendation/onboarding/status.
func getOnboardingStatusHandler(store *onboarding.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		completed, err := store.HasCompleted(r.Context(), identity.UserID)
		if err != nil {
			logger.Error("get onboarding status", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]bool{"completed": completed})
	}
}

// skipOnboardingHandler implements POST /api/recommendation/onboarding/skip.
func skipOnboardingHandler(store *onboarding.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		if err := store.MarkSkipped(r.Context(), identity.UserID); err != nil {
			logger.Error("skip onboarding", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]bool{"skipped": true})
	}
}

// saveOnboardingPreferencesRequest is the validated body for POST /api/recommendation/onboarding/preferences.
type saveOnboardingPreferencesRequest struct {
	CurrentLevel int      `json:"currentLevel"`
	Goal         string   `json:"goal"`
	Topics       []string `json:"topics"`
	DailyMinutes int      `json:"dailyMinutes"`
	Style        string   `json:"style"`
}

// saveOnboardingPreferencesHandler implements POST /api/recommendation/onboarding/preferences.
func saveOnboardingPreferencesHandler(store *onboarding.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req saveOnboardingPreferencesRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		// Validate fields matching NestJS contract.
		if req.CurrentLevel < 0 || req.CurrentLevel > 5 {
			writeJSONError(w, "currentLevel must be 0-5", http.StatusBadRequest)
			return
		}
		if !ValidGoals[req.Goal] {
			writeJSONError(w, "invalid goal", http.StatusBadRequest)
			return
		}
		if !ValidStyles[req.Style] {
			writeJSONError(w, "invalid style", http.StatusBadRequest)
			return
		}
		if len(req.Topics) > 5 {
			req.Topics = req.Topics[:5]
		}
		if req.DailyMinutes < 5 {
			req.DailyMinutes = 5
		}
		if req.DailyMinutes > 120 {
			req.DailyMinutes = 120
		}
		prefs, err := store.SavePreferences(r.Context(), identity.UserID, onboarding.SaveInput{
			CurrentLevel: req.CurrentLevel,
			Goal:         req.Goal,
			Topics:       req.Topics,
			DailyMinutes: req.DailyMinutes,
			Style:        req.Style,
		})
		if err != nil {
			logger.Error("save onboarding preferences", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"preferences": prefs})
	}
}
