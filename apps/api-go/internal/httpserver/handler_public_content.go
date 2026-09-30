package httpserver

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"time"
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
			"showAd":      false,
			"placementCode": "",
			"reason":      "anonymous_stub",
		}
		if err := json.NewEncoder(w).Encode(resp); err != nil {
			logger.Error("failed to encode ads/decision response", "error", err)
		}
	}
}