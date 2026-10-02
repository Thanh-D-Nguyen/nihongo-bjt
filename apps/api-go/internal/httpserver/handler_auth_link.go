package httpserver

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authlink"
)

// exchangeLinkCodeRequest is the JSON body for POST /api/auth/link/exchange.
type exchangeLinkCodeRequest struct {
	Code string `json:"code"`
}

// exchangeLinkCodeHandler implements POST /api/auth/link/exchange.
// Exchanges a one-time code from the OAuth link flow and returns masked user info.
// This endpoint is NOT session-guarded (called during linking before session exists).
func exchangeLinkCodeHandler(store *authlink.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req exchangeLinkCodeRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.Code == "" {
			writeJSONError(w, "code is required", http.StatusBadRequest)
			return
		}

		result, err := store.ExchangeCode(r.Context(), req.Code)
		if err != nil {
			if errors.Is(err, authlink.ErrInvalidOrExpired) {
				writeJSONError(w, "Invalid or expired link code", http.StatusBadRequest)
				return
			}
			logger.Error("exchange link code", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(result)
	}
}
