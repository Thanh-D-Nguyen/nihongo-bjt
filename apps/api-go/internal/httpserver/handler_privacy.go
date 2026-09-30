package httpserver

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/privacy"
)

// listPrivacyRequestsHandler implements GET /api/learner/privacy/requests.
func listPrivacyRequestsHandler(store *privacy.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		requests, err := store.ListRequests(r.Context(), identity.UserID)
		if err != nil {
			logger.Error("list privacy requests", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(requests)
	}
}

// createPrivacyRequestBody is the JSON body for POST /api/learner/privacy/requests.
type createPrivacyRequestBody struct {
	Kind string `json:"kind"`
}

// createPrivacyRequestHandler implements POST /api/learner/privacy/requests.
func createPrivacyRequestHandler(store *privacy.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req createPrivacyRequestBody
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.Kind == "" {
			req.Kind = "export" // default matching NestJS behavior
		}
		result, err := store.CreateRequest(r.Context(), identity.UserID, privacy.CreateInput{
			Kind: req.Kind,
		})
		if err != nil {
			logger.Error("create privacy request", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(result)
	}
}