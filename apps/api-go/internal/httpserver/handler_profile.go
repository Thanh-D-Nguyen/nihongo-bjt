package httpserver

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"mime"
	"net/http"
	"strings"
	"time"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/profile"
)

// maxProfileBodyBytes is the maximum allowed request body for profile updates.
const maxProfileBodyBytes = 8 * 1024 // 8 KiB

// updateMeRequest holds the optional fields for PUT /api/auth/me.
// All fields are pointers so we can distinguish "not provided" from zero values.
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

// validThemeModes enumerates allowed theme mode values.
var validThemeModes = map[string]bool{
	"system": true,
	"light":  true,
	"dark":   true,
}

// validFontSizePreferences enumerates allowed font size values.
var validFontSizePreferences = map[string]bool{
	"small":   true,
	"default": true,
	"large":   true,
}

// validDensityPreferences enumerates allowed density values.
var validDensityPreferences = map[string]bool{
	"compact":     true,
	"comfortable": true,
	"spacious":    true,
}

// learnerGetMeHandler implements GET /api/auth/me — returns the authenticated
// learner's full profile including preferences.
func learnerGetMeHandler(profileStore *profile.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeJSONError(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

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
			logger.Error("get-me: profile lookup failed", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(p)
	}
}

// learnerUpdateMeHandler implements PUT /api/auth/me — updates the authenticated
// learner's profile preferences. All fields are optional; at least one must be present.
func learnerUpdateMeHandler(profileStore *profile.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPut {
			writeJSONError(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		ct := r.Header.Get("Content-Type")
		mediaType, _, err := mime.ParseMediaType(ct)
		if err != nil || mediaType != "application/json" {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}

		body, err := io.ReadAll(io.LimitReader(r.Body, maxProfileBodyBytes+1))
		if err != nil {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}
		if len(body) > maxProfileBodyBytes {
			writeJSONError(w, "request too large", http.StatusRequestEntityTooLarge)
			return
		}
		if len(body) == 0 {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}

		dec := json.NewDecoder(strings.NewReader(string(body)))
		dec.DisallowUnknownFields()
		var req updateMeRequest
		if err := dec.Decode(&req); err != nil {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}

		// Build update params, validating each provided field.
		params := profile.UpdateProfileParams{}
		fieldCount := 0

		if req.DisplayName != nil {
			dn := strings.TrimSpace(*req.DisplayName)
			if dn == "" || len(dn) > 120 {
				writeJSONError(w, "displayName must be between 1 and 120 characters", http.StatusBadRequest)
				return
			}
			params.DisplayName = &dn
			fieldCount++
		}

		if req.ThemeMode != nil {
			tm := strings.TrimSpace(*req.ThemeMode)
			if !validThemeModes[tm] {
				writeJSONError(w, fmt.Sprintf("themeMode must be one of: system, light, dark"), http.StatusBadRequest)
				return
			}
			params.ThemeMode = &tm
			fieldCount++
		}

		if req.FontSizePreference != nil {
			fs := strings.TrimSpace(*req.FontSizePreference)
			if !validFontSizePreferences[fs] {
				writeJSONError(w, fmt.Sprintf("fontSizePreference must be one of: small, default, large"), http.StatusBadRequest)
				return
			}
			params.FontSizePreference = &fs
			fieldCount++
		}

		if req.DensityPreference != nil {
			dp := strings.TrimSpace(*req.DensityPreference)
			if !validDensityPreferences[dp] {
				writeJSONError(w, fmt.Sprintf("densityPreference must be one of: compact, comfortable, spacious"), http.StatusBadRequest)
				return
			}
			params.DensityPreference = &dp
			fieldCount++
		}

		if req.FlashcardStyleSlug != nil {
			fss := strings.TrimSpace(*req.FlashcardStyleSlug)
			if len(fss) > 64 {
				writeJSONError(w, "flashcardStyleSlug must be at most 64 characters", http.StatusBadRequest)
				return
			}
			params.FlashcardStyleSlug = &fss
			fieldCount++
		}

		if req.CoverAssetID != nil {
			// Allow empty string or null to clear; non-empty must be a valid UUID format.
			cai := *req.CoverAssetID
			if cai != "" && !isValidUUID(cai) {
				writeJSONError(w, "coverAssetId must be a valid UUID or null", http.StatusBadRequest)
				return
			}
			if cai == "" {
				params.ClearCoverAssetID = true
			} else {
				params.CoverAssetID = &cai
			}
			fieldCount++
		}

		if req.AdsPersonalizationOptIn != nil {
			params.AdsPersonalizationOptIn = req.AdsPersonalizationOptIn
			fieldCount++
		}

		if req.SharePostcardOptIn != nil {
			params.SharePostcardOptIn = req.SharePostcardOptIn
			fieldCount++
		}

		if fieldCount == 0 {
			writeJSONError(w, "at least one field must be provided", http.StatusBadRequest)
			return
		}

		p, err := profileStore.UpdateLearnerProfile(r.Context(), identity.UserID, params)
		if err != nil {
			if errors.Is(err, profile.ErrProfileNotFound) {
				writeJSONError(w, "unauthorized", http.StatusUnauthorized)
				return
			}
			logger.Error("update-me: profile update failed", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(p)
	}
}

// isValidUUID performs basic UUID format validation (8-4-4-4-12 hex chars).
func isValidUUID(s string) bool {
	if len(s) != 36 {
		return false
	}
	for i, c := range s {
		if i == 8 || i == 13 || i == 18 || i == 23 {
			if c != '-' {
				return false
			}
			continue
		}
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')) {
			return false
		}
	}
	return true
}

// Ensure time import is used (for potential future rate limiting or timestamps).
var _ = time.Now
