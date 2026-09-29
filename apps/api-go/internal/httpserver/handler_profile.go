package httpserver

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/profile"
)

// learnerGetMeHandler implements GET /api/auth/me — returns the authenticated
// learner's full profile as a flat JSON object (no wrapper).
// Session-guarded only; no CSRF required for safe methods.
func learnerGetMeHandler(profileStore *profile.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		p, err := profileStore.GetLearnerFullProfile(r.Context(), identity.UserID)
		if err != nil {
			if errors.Is(err, profile.ErrProfileNotFound) {
				writeJSONError(w, "unauthorized", http.StatusUnauthorized)
				return
			}
			logger.Error("learner get me: profile lookup failed", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(p)
	}
}

// updateMeRequest is the JSON body accepted by PUT /api/auth/me.
// Only mutable fields are included; immutable fields (id, email, status,
// createdAt, updatedAt) are silently ignored if present in the raw payload.
type updateMeRequest struct {
	DisplayName             *string `json:"displayName"`
	ThemeMode               *string `json:"themeMode"`
	FontSizePreference      *string `json:"fontSizePreference"`
	DensityPreference       *string `json:"densityPreference"`
	FlashcardStyleSlug      *string `json:"flashcardStyleSlug"`
	CoverAssetID            *string `json:"coverAssetId"`
	AdsPersonalizationOptIn *bool   `json:"adsPersonalizationOptIn"`
	SharePostcardOptIn      *bool   `json:"sharePostcardOptIn"`
}

// learnerUpdateMeHandler implements PUT /api/auth/me — applies a partial update
// to the authenticated learner's mutable profile fields and returns the updated
// full profile. Requires session cookie + CSRF token (enforced at router level).
func learnerUpdateMeHandler(profileStore *profile.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		var req updateMeRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}

		params := profile.UpdateProfileParams{
			DisplayName:             req.DisplayName,
			ThemeMode:               req.ThemeMode,
			FontSizePreference:      req.FontSizePreference,
			DensityPreference:       req.DensityPreference,
			FlashcardStyleSlug:      req.FlashcardStyleSlug,
			AdsPersonalizationOptIn: req.AdsPersonalizationOptIn,
			SharePostcardOptIn:      req.SharePostcardOptIn,
		}

		// Handle coverAssetId: explicit null clears the field, non-nil sets it.
		if req.CoverAssetID != nil {
			if *req.CoverAssetID == "" {
				params.ClearCoverAssetID = true
			} else {
				params.CoverAssetID = req.CoverAssetID
			}
		}

		p, err := profileStore.UpdateLearnerProfile(r.Context(), identity.UserID, params)
		if err != nil {
			if errors.Is(err, profile.ErrProfileNotFound) {
				writeJSONError(w, "unauthorized", http.StatusUnauthorized)
				return
			}
			logger.Error("learner update me: update failed", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(p)
	}
}
