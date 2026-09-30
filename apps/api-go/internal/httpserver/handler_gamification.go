package httpserver

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/gamification"
)

// getStreaksHandler implements GET /api/gamification/streaks.
func getStreaksHandler(store *gamification.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		streaks, err := store.GetUserStreaks(r.Context(), identity.UserID)
		if err != nil {
			logger.Error("get streaks", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(streaks)
	}
}

// recordStreakActivityHandler implements POST /api/gamification/streaks/record.
// Activity type is passed as query parameter per NestJS contract.
func recordStreakActivityHandler(store *gamification.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		activityType := r.URL.Query().Get("activityType")
		if activityType == "" {
			writeJSONError(w, "activityType query parameter is required", http.StatusBadRequest)
			return
		}
		// Validate activity type matches NestJS enum
		validTypes := map[string]bool{"review": true, "exercise": true, "quiz": true, "battle": true}
		if !validTypes[activityType] {
			writeJSONError(w, "invalid activityType", http.StatusBadRequest)
			return
		}
		if err := store.RecordActivity(r.Context(), identity.UserID, activityType); err != nil {
			logger.Error("record streak activity", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]bool{"success": true})
	}
}

// listLeaderboardsHandler implements GET /api/gamification/leaderboards.
func listLeaderboardsHandler(store *gamification.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		boards, err := store.GetEnabledLeaderboards(r.Context())
		if err != nil {
			logger.Error("list leaderboards", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(boards)
	}
}

// getLeaderboardHandler implements GET /api/gamification/leaderboards/{id}.
func getLeaderboardHandler(store *gamification.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Extract leaderboard ID from path: /api/gamification/leaderboards/{id}
		parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		var boardID string
		for i, p := range parts {
			if p == "leaderboards" && i+1 < len(parts) && parts[i+1] != "me" {
				boardID = parts[i+1]
				break
			}
		}
		if boardID == "" {
			writeJSONError(w, "leaderboard id required", http.StatusBadRequest)
			return
		}
		entries, err := store.GetLeaderboardEntries(r.Context(), boardID)
		if err != nil {
			logger.Error("get leaderboard entries", "error", err, "board_id", boardID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(entries)
	}
}

// getMyRankHandler implements GET /api/gamification/leaderboards/{id}/me.
// Note: NestJS uses /my-rank but matrix normalized to /me; support both via router alias if needed.
func getMyRankHandler(store *gamification.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		// Extract leaderboard ID from path: /api/gamification/leaderboards/{id}/me or /my-rank
		parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		var boardID string
		for i, p := range parts {
			if p == "leaderboards" && i+1 < len(parts) {
				boardID = parts[i+1]
				break
			}
		}
		if boardID == "" {
			writeJSONError(w, "leaderboard id required", http.StatusBadRequest)
			return
		}
		rank, err := store.GetMyRank(r.Context(), boardID, identity.UserID)
		if err != nil {
			logger.Error("get my rank", "error", err, "board_id", boardID, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(rank)
	}
}