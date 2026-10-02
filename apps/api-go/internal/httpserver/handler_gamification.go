package httpserver

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/gamification"
)

// ── Streaks ────────────────────────────────────────────────────────────────

// getStreaksHandler implements GET /api/gamification/streaks.
func getStreaksHandler(store *gamification.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		data, err := store.GetStreaks(r.Context(), identity.UserID)
		if err != nil {
			logger.Error("get streaks", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(data)
	}
}

// recordActivityHandler implements POST /api/gamification/streaks/record.
func recordActivityHandler(store *gamification.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		activityType := r.URL.Query().Get("activityType")
		if activityType == "" {
			writeJSONError(w, "activityType required", http.StatusBadRequest)
			return
		}
		if err := store.RecordActivity(r.Context(), identity.UserID, activityType); err != nil {
			logger.Error("record activity", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]bool{"success": true})
	}
}

// ── Achievements ───────────────────────────────────────────────────────────

// getAchievementDefinitionsHandler implements GET /api/gamification/achievements.
func getAchievementDefinitionsHandler(store *gamification.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		defs, err := store.GetAllAchievementDefinitions(r.Context())
		if err != nil {
			logger.Error("get achievement definitions", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(defs)
	}
}

// browseAchievementsHandler implements GET /api/gamification/achievements/browse.
func browseAchievementsHandler(store *gamification.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		result, err := store.BrowseAllAchievements(r.Context(), identity.UserID)
		if err != nil {
			logger.Error("browse achievements", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(result)
	}
}

// getMyAchievementsHandler implements GET /api/gamification/achievements/me.
func getMyAchievementsHandler(store *gamification.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		progress, err := store.GetUserAchievements(r.Context(), identity.UserID)
		if err != nil {
			logger.Error("get my achievements", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(progress)
	}
}

// getPendingAchievementsHandler implements GET /api/gamification/achievements/me/pending.
func getPendingAchievementsHandler(store *gamification.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		pending, err := store.GetPendingAchievements(r.Context(), identity.UserID)
		if err != nil {
			logger.Error("get pending achievements", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(pending)
	}
}

// acknowledgeAchievementsHandler implements POST /api/gamification/achievements/me/acknowledge.
func acknowledgeAchievementsHandler(store *gamification.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			IDs []string `json:"ids"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if err := store.AcknowledgeAchievements(r.Context(), identity.UserID, req.IDs); err != nil {
			logger.Error("acknowledge achievements", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]bool{"acknowledged": true})
	}
}

// ── Leaderboards ───────────────────────────────────────────────────────────

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
		id := extractPathParam(r.URL.Path, "leaderboards", 1)
		if id == "" {
			writeJSONError(w, "leaderboard id required", http.StatusBadRequest)
			return
		}
		entries, err := store.GetLeaderboard(r.Context(), id)
		if err != nil {
			logger.Error("get leaderboard", "error", err, "id", id)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(entries)
	}
}

// getMyRankHandler implements GET /api/gamification/leaderboards/{id}/me.
func getMyRankHandler(store *gamification.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "leaderboards", 1)
		if id == "" {
			writeJSONError(w, "leaderboard id required", http.StatusBadRequest)
			return
		}
		rank, err := store.GetUserRank(r.Context(), id, identity.UserID)
		if err != nil {
			logger.Error("get my rank", "error", err, "leaderboard_id", id, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(rank)
	}
}

// ── Focus / Study Timer ────────────────────────────────────────────────────

// startFocusHandler implements POST /api/gamification/focus/start.
func startFocusHandler(store *gamification.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			DurationMinutes int    `json:"durationMinutes"`
			Mode            string `json:"mode"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		session, err := store.StartFocusSession(r.Context(), identity.UserID, req.DurationMinutes, req.Mode)
		if err != nil {
			logger.Error("start focus", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(session)
	}
}

// endFocusHandler implements POST /api/gamification/focus/end.
func endFocusHandler(store *gamification.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			SessionID string `json:"sessionId"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.SessionID == "" {
			writeJSONError(w, "sessionId required", http.StatusBadRequest)
			return
		}
		if err := store.EndFocusSession(r.Context(), identity.UserID, req.SessionID); err != nil {
			if errors.Is(err, gamification.ErrNotFound) {
				writeJSONError(w, "session not found", http.StatusNotFound)
				return
			}
			logger.Error("end focus", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]bool{"completed": true})
	}
}

// focusTodayHandler implements GET /api/gamification/focus/today.
func focusTodayHandler(store *gamification.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		summary, err := store.GetFocusToday(r.Context(), identity.UserID)
		if err != nil {
			logger.Error("focus today", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(summary)
	}
}

// ── Companion Pet ──────────────────────────────────────────────────────────

// getPetHandler implements GET /api/gamification/pet.
func getPetHandler(store *gamification.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		pet, err := store.GetPet(r.Context(), identity.UserID)
		if err != nil {
			logger.Error("get pet", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(pet)
	}
}

// feedPetHandler implements POST /api/gamification/pet/feed.
func feedPetHandler(store *gamification.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		pet, err := store.FeedPet(r.Context(), identity.UserID)
		if err != nil {
			if errors.Is(err, gamification.ErrNotFound) {
				writeJSONError(w, "pet not found", http.StatusNotFound)
				return
			}
			logger.Error("feed pet", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(pet)
	}
}

// renamePetHandler implements POST /api/gamification/pet/rename.
func renamePetHandler(store *gamification.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			Name string `json:"name"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.Name == "" {
			writeJSONError(w, "name required", http.StatusBadRequest)
			return
		}
		pet, err := store.RenamePet(r.Context(), identity.UserID, req.Name)
		if err != nil {
			if errors.Is(err, gamification.ErrNotFound) {
				writeJSONError(w, "pet not found", http.StatusNotFound)
				return
			}
			logger.Error("rename pet", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(pet)
	}
}

// getPetCostumesHandler implements GET /api/gamification/pet/costumes.
func getPetCostumesHandler(store *gamification.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		costumes, err := store.GetPetCostumes(r.Context(), identity.UserID)
		if err != nil {
			logger.Error("get pet costumes", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(costumes)
	}
}

// ── Seasonal Events ────────────────────────────────────────────────────────

// getActiveEventsHandler implements GET /api/gamification/events.
func getActiveEventsHandler(store *gamification.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		events, err := store.GetActiveEvents(r.Context(), identity.UserID)
		if err != nil {
			logger.Error("get active events", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(events)
	}
}

// getEventHandler implements GET /api/gamification/events/{eventId}.
func getEventHandler(store *gamification.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		eventID := extractPathParam(r.URL.Path, "events", 1)
		if eventID == "" {
			writeJSONError(w, "event id required", http.StatusBadRequest)
			return
		}
		event, err := store.GetEvent(r.Context(), identity.UserID, eventID)
		if err != nil {
			if errors.Is(err, gamification.ErrNotFound) {
				writeJSONError(w, "event not found", http.StatusNotFound)
				return
			}
			logger.Error("get event", "error", err, "event_id", eventID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(event)
	}
}

// joinEventHandler implements POST /api/gamification/events/{eventId}/join.
func joinEventHandler(store *gamification.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		eventID := extractPathParam(r.URL.Path, "events", 1)
		if eventID == "" {
			writeJSONError(w, "event id required", http.StatusBadRequest)
			return
		}
		if err := store.JoinEvent(r.Context(), identity.UserID, eventID); err != nil {
			logger.Error("join event", "error", err, "event_id", eventID, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]bool{"joined": true})
	}
}

// Ensure strconv is used.
var _ = strconv.Itoa
