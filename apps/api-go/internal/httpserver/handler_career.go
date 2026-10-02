package httpserver

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/career"
)

// getCareerMeHandler implements GET /api/career/me.
// Authenticated learner route.
func getCareerMeHandler(store *career.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		me, err := store.GetMe(r.Context(), identity.UserID)
		if err != nil {
			logger.Error("get career me", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(me)
	}
}

// updateCareerMeHandler implements PATCH /api/career/me.
// Authenticated learner route with CSRF protection.
func updateCareerMeHandler(store *career.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			JPWorkName   *string `json:"jpWorkName"`
			CompanyTheme *string `json:"companyTheme"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		me, err := store.UpdateMe(r.Context(), identity.UserID, req.JPWorkName, req.CompanyTheme)
		if err != nil {
			logger.Error("update career me", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(me)
	}
}

// clockInHandler implements POST /api/career/clock-in.
// Authenticated learner route with CSRF protection.
func clockInHandler(store *career.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		me, err := store.ClockIn(r.Context(), identity.UserID)
		if err != nil {
			logger.Error("clock in", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(me)
	}
}

// listCareerRanksHandler implements GET /api/career/ranks.
// Authenticated learner route.
func listCareerRanksHandler(store *career.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ranks, err := store.ListRanks(r.Context())
		if err != nil {
			logger.Error("list career ranks", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(ranks)
	}
}

// getCareerInboxHandler implements GET /api/career/inbox.
// Authenticated learner route.
func getCareerInboxHandler(store *career.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		memos, err := store.GetInbox(r.Context(), identity.UserID)
		if err != nil {
			logger.Error("get career inbox", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(memos)
	}
}
