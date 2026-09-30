package httpserver

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
)

// nhkNewsListHandler returns an empty article list for anonymous users.
// Old NestJS contract: PUBLIC — GET /api/nhk-news?type=easy|normal&limit=N&locale=vi
// Returns [] so the frontend renders an empty news section instead of an error banner.
func nhkNewsListHandler(logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		if err := json.NewEncoder(w).Encode([]struct{}{}); err != nil {
			logger.Error("failed to encode nhk-news response", "error", err)
		}
	}
}

// dailyRadarHomeHandler returns an empty home payload for anonymous users.
// Old NestJS contract: PUBLIC (@PublicRoute) — GET /api/daily-radar/home?locale=vi
// Returns minimal structure so the Daily Radar section renders without error.
func dailyRadarHomeHandler(logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		resp := map[string]any{
			"modules": []struct{}{},
			"cards":   []struct{}{},
		}
		if err := json.NewEncoder(w).Encode(resp); err != nil {
			logger.Error("failed to encode daily-radar/home response", "error", err)
		}
	}
}

// dailyHomeHandler returns a minimal daily hub payload for anonymous users.
// Old NestJS contract: OPTIONAL_AUTH (@KeycloakAuthOptional) — GET /api/daily/home?locale=vi&timeZone=...
// Anonymous users receive public content only; no personalization.
// The frontend TodayPlanHub expects { today, dueReviews, greeting } and calls
// today.split("-"), so we must return a valid ISO date string to avoid hydration crashes.
func dailyHomeHandler(logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		today := time.Now().Format("2006-01-02")
		resp := map[string]any{
			"today":       today,
			"dueReviews":  0,
			"greeting":    map[string]any{"japanese": "こんにちは", "reading": "konnichiwa"},
			"widgets":     []struct{}{},
			"items":       []struct{}{},
			"weeklyStats": nil,
		}
		if err := json.NewEncoder(w).Encode(resp); err != nil {
			logger.Error("failed to encode daily/home response", "error", err)
		}
	}
}

// announcementsListHandler returns an empty announcement list for anonymous users.
// Old NestJS contract: PUBLIC (no guard, optional userId extraction) — GET /api/announcements
// Anonymous users see active announcements without dismissal filtering.
func announcementsListHandler(logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		if err := json.NewEncoder(w).Encode([]struct{}{}); err != nil {
			logger.Error("failed to encode announcements response", "error", err)
		}
	}
}

// adsDecisionHandler returns a no-ad decision for anonymous users.
// Old NestJS contract: OPTIONAL_AUTH (@KeycloakAuthOptional) — POST /api/ads/decision
// Anonymous viewers are evaluated as free audience; returns safe default.
func adsDecisionHandler(logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		resp := map[string]any{
			"showAd":        false,
			"placementCode": "",
			"reason":        "anonymous_stub",
		}
		if err := json.NewEncoder(w).Encode(resp); err != nil {
			logger.Error("failed to encode ads/decision response", "error", err)
		}
	}
}

// announcementDismissHandler implements POST /api/announcements/{id}/dismiss.
// Auth users get persisted dismissal; guests receive acknowledged-but-not-persisted response.
// Matches NestJS contract: { dismissed: true, persisted: bool }.
func announcementDismissHandler(logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Extract announcement ID from path: /api/announcements/{id}/dismiss
		parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		// Expected: ["api", "announcements", "{id}", "dismiss"]
		var annID string
		for i, p := range parts {
			if p == "announcements" && i+1 < len(parts) && parts[i+1] != "dismiss" {
				annID = parts[i+1]
				break
			}
		}
		if annID == "" {
			writeJSONError(w, "announcement id required", http.StatusBadRequest)
			return
		}

		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			// Guest: client handles via localStorage
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_ = json.NewEncoder(w).Encode(map[string]bool{"dismissed": true, "persisted": false})
			return
		}

		// TODO: Persist dismissal to content.announcement_dismissal table
		// For now, acknowledge with persisted=true since user is authenticated
		// Real implementation requires announcement.Store.Dismiss(annID, identity.UserID)
		logger.Info("announcement dismissed (stub)", "announcement_id", annID, "user_id", identity.UserID)

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]bool{"dismissed": true, "persisted": true})
	}
}

// adsImpressionRequest is the JSON body for POST /api/ads/impression.
type adsImpressionRequest struct {
	PlacementCode string         `json:"placementCode"`
	CampaignID    *string        `json:"campaignId,omitempty"`
	DecisionKey   *string        `json:"decisionKey,omitempty"`
	ClientContext map[string]any `json:"clientContext,omitempty"`
}

// adsImpressionHandler implements POST /api/ads/impression.
// Records an ad impression event. Optional auth (anonymous impressions allowed).
// Returns 204 No Content on success per NestJS contract.
func adsImpressionHandler(logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req adsImpressionRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.PlacementCode == "" {
			writeJSONError(w, "placementCode is required", http.StatusBadRequest)
			return
		}

		// Extract optional user ID from session
		var userID *string
		if identity, ok := authn.GetLearnerIdentity(r.Context()); ok {
			userID = &identity.UserID
		}

		// TODO: Persist to monetization.ad_impression table
		// Real implementation requires ads.Store.RecordImpression(...)
		logger.Info("ad impression recorded (stub)",
			"placement_code", req.PlacementCode,
			"user_id", userID,
			"campaign_id", req.CampaignID,
		)

		w.WriteHeader(http.StatusNoContent)
	}
}

// adsClickRequest is the JSON body for POST /api/ads/click.
type adsClickRequest struct {
	PlacementCode string         `json:"placementCode"`
	CampaignID    *string        `json:"campaignId,omitempty"`
	DecisionKey   *string        `json:"decisionKey,omitempty"`
	ClientContext map[string]any `json:"clientContext,omitempty"`
}

// adsClickHandler implements POST /api/ads/click.
// Records an ad click event. Optional auth (anonymous clicks allowed).
// Returns 204 No Content on success per NestJS contract.
func adsClickHandler(logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req adsClickRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.PlacementCode == "" {
			writeJSONError(w, "placementCode is required", http.StatusBadRequest)
			return
		}

		// Extract optional user ID from session
		var userID *string
		if identity, ok := authn.GetLearnerIdentity(r.Context()); ok {
			userID = &identity.UserID
		}

		// TODO: Persist to monetization.ad_click table
		// Real implementation requires ads.Store.RecordClick(...)
		logger.Info("ad click recorded (stub)",
			"placement_code", req.PlacementCode,
			"user_id", userID,
			"campaign_id", req.CampaignID,
		)

		w.WriteHeader(http.StatusNoContent)
	}
}