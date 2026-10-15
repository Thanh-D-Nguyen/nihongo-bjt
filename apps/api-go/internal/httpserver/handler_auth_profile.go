package httpserver

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/google/uuid"
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
	DisplayName        *string         `json:"displayName"`
	ThemeMode          *string         `json:"themeMode"`
	FontSizePreference *string         `json:"fontSizePreference"`
	DensityPreference  *string         `json:"densityPreference"`
	AvatarAssetID      json.RawMessage `json:"avatarAssetId"`
	CoverAssetID       json.RawMessage `json:"coverAssetId"`
	SharePostcardOptIn *bool           `json:"sharePostcardOptIn"`
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
		dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxLifecycleBodyBytes))
		if err := dec.Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		var trailing json.RawMessage
		if err := dec.Decode(&trailing); !errors.Is(err, io.EOF) {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if utf8.RuneCountInString(strings.TrimSpace(authProfileDerefString(req.DisplayName))) > 120 ||
			req.DisplayName != nil && strings.TrimSpace(*req.DisplayName) == "" {
			writeJSONError(w, "invalid displayName", http.StatusBadRequest)
			return
		}
		if req.ThemeMode != nil && !authProfileOneOf(*req.ThemeMode, "light", "dark", "system") {
			writeJSONError(w, "invalid themeMode", http.StatusBadRequest)
			return
		}
		if req.FontSizePreference != nil && !authProfileOneOf(*req.FontSizePreference, "small", "default", "large", "xl") {
			writeJSONError(w, "invalid fontSizePreference", http.StatusBadRequest)
			return
		}
		if req.DensityPreference != nil && !authProfileOneOf(*req.DensityPreference, "compact", "comfortable") {
			writeJSONError(w, "invalid densityPreference", http.StatusBadRequest)
			return
		}
		params := profile.UpdateProfileParams{
			DisplayName:        req.DisplayName,
			ThemeMode:          req.ThemeMode,
			FontSizePreference: req.FontSizePreference,
			DensityPreference:  req.DensityPreference,
			SharePostcardOptIn: req.SharePostcardOptIn,
		}
		if req.AvatarAssetID != nil {
			if bytes.Equal(bytes.TrimSpace(req.AvatarAssetID), []byte("null")) {
				params.ClearAvatarAssetID = true
			} else {
				var avatarAssetID string
				if err := json.Unmarshal(req.AvatarAssetID, &avatarAssetID); err != nil {
					writeJSONError(w, "invalid avatarAssetId", http.StatusBadRequest)
					return
				}
				if _, err := uuid.Parse(avatarAssetID); err != nil {
					writeJSONError(w, "invalid avatarAssetId", http.StatusBadRequest)
					return
				}
				params.AvatarAssetID = &avatarAssetID
			}
		}
		if req.CoverAssetID != nil {
			if bytes.Equal(bytes.TrimSpace(req.CoverAssetID), []byte("null")) {
				params.ClearCoverAssetID = true
			} else {
				var coverAssetID string
				if err := json.Unmarshal(req.CoverAssetID, &coverAssetID); err != nil {
					writeJSONError(w, "invalid coverAssetId", http.StatusBadRequest)
					return
				}
				if _, err := uuid.Parse(coverAssetID); err != nil {
					writeJSONError(w, "invalid coverAssetId", http.StatusBadRequest)
					return
				}
				params.CoverAssetID = &coverAssetID
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

func authProfileDerefString(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func authProfileOneOf(value string, allowed ...string) bool {
	for _, candidate := range allowed {
		if value == candidate {
			return true
		}
	}
	return false
}
