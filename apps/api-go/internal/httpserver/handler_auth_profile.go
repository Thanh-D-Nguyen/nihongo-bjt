package httpserver

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/profile"
)

// learnerProfileEnvelope matches the NestJS LearnerProfileEnvelopeOpenApiDto shape:
// { "profile": <LearnerPublicProfile | LearnerFullProfile> }
// Frontend callers at /api/auth/profile expect this wrapper.
type learnerProfileEnvelope struct {
	Profile interface{} `json:"profile"`
}

// getAuthProfileHandler implements GET /api/auth/profile.
// Returns the authenticated learner's public profile wrapped in { profile: ... }.
func getAuthProfileHandler(profileStore *profile.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		p, err := profileStore.GetLearnerPublicProfile(r.Context(), identity.UserID)
		if err != nil {
			if errors.Is(err, profile.ErrProfileNotFound) {
				writeJSONError(w, "not found", http.StatusNotFound)
				return
			}
			logger.Error("get auth profile", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(learnerProfileEnvelope{Profile: p})
	}
}

// syncAuthProfileHandler implements POST /api/auth/profile.
// Canonical v15 profile sync from verified session — returns current profile envelope.
// Identical behavior to GET /api/auth/profile (NestJS delegated to same method).
func syncAuthProfileHandler(profileStore *profile.Store, logger *slog.Logger) http.HandlerFunc {
	return getAuthProfileHandler(profileStore, logger)
}

// updateAuthProfileRequest mirrors authProfileUpdateSchema from @nihongo-bjt/shared.
// Only mutable fields are accepted; immutable fields are silently ignored.
type updateAuthProfileRequest struct {
	DisplayName        *string `json:"displayName"`
	ThemeMode          *string `json:"themeMode"`
	FontSizePreference *string `json:"fontSizePreference"`
	DensityPreference  *string `json:"densityPreference"`
	CoverAssetID       *string `json:"coverAssetId"`
	SharePostcardOptIn *bool   `json:"sharePostcardOptIn"`
}

// putAuthProfileHandler implements PUT /api/auth/profile.
// Validates and applies partial profile update, returns updated profile in envelope.
func putAuthProfileHandler(profileStore *profile.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req updateAuthProfileRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		params := profile.UpdateProfileParams{
			DisplayName:        req.DisplayName,
			ThemeMode:          req.ThemeMode,
			FontSizePreference: req.FontSizePreference,
			DensityPreference:  req.DensityPreference,
			SharePostcardOptIn: req.SharePostcardOptIn,
		}
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
				writeJSONError(w, "not found", http.StatusNotFound)
				return
			}
			logger.Error("update auth profile", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(learnerProfileEnvelope{Profile: p})
	}
}
