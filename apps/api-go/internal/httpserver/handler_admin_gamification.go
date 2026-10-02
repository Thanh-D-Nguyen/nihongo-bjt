package httpserver

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"math"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
)

// ── P1-A9: Admin Gamification — Streaks + Achievements + Tiers + Leaderboards + Pets (23 routes) ──
// Contracts derived from NestJS gamification-admin.controller.ts,
// gamification.repository.ts, and companion-pet.service.ts.
// DB tables: gamification.streak_config, gamification.achievement_definition,
// gamification.achievement_tier, gamification.leaderboard_config,
// gamification.companion_pet.

// ── Streak Config ───────────────────────────────────────────────────────────

// adminStreakConfigsListHandler implements GET /api/admin/gamification/streaks.
func adminStreakConfigsListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := db.Query(r.Context(), `SELECT id, name, activity_type, min_actions_per_day,
			freezes_allowed, enabled, created_by, updated_by, created_at, updated_at
			FROM gamification.streak_config ORDER BY created_at ASC`)
		if err != nil {
			logger.Error("list streak configs", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		type Config struct {
			ID               string  `json:"id"`
			Name             string  `json:"name"`
			ActivityType     string  `json:"activityType"`
			MinActionsPerDay int     `json:"minActionsPerDay"`
			FreezesAllowed   int     `json:"freezesAllowed"`
			Enabled          bool    `json:"enabled"`
			CreatedBy        *string `json:"createdBy,omitempty"`
			UpdatedBy        *string `json:"updatedBy,omitempty"`
			CreatedAt        string  `json:"createdAt"`
			UpdatedAt        string  `json:"updatedAt"`
		}
		var items []Config
		for rows.Next() {
			var c Config
			var ca, ua time.Time
			if rows.Scan(&c.ID, &c.Name, &c.ActivityType, &c.MinActionsPerDay,
				&c.FreezesAllowed, &c.Enabled, &c.CreatedBy, &c.UpdatedBy, &ca, &ua) == nil {
				c.CreatedAt = ca.UTC().Format(time.RFC3339)
				c.UpdatedAt = ua.UTC().Format(time.RFC3339)
				items = append(items, c)
			}
		}
		if items == nil {
			items = []Config{}
		}
		writeJSON(w, http.StatusOK, items)
	}
}

// adminStreakConfigCreateHandler implements POST /api/admin/gamification/streaks.
func adminStreakConfigCreateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			Name             string `json:"name"`
			ActivityType     string `json:"activityType"`
			MinActionsPerDay int    `json:"minActionsPerDay"`
			FreezesAllowed   int    `json:"freezesAllowed"`
			Enabled          bool   `json:"enabled"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.Name == "" || req.ActivityType == "" {
			writeJSONError(w, "name and activityType required", http.StatusBadRequest)
			return
		}
		var id string
		err := db.QueryRow(r.Context(), `INSERT INTO gamification.streak_config
			(name, activity_type, min_actions_per_day, freezes_allowed, enabled, created_by, updated_by, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $6, NOW(), NOW()) RETURNING id`,
			req.Name, req.ActivityType, req.MinActionsPerDay, req.FreezesAllowed, req.Enabled, identity.ActorID).Scan(&id)
		if err != nil {
			logger.Error("create streak config", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusCreated, map[string]any{"id": id, "name": req.Name})
	}
}

// adminStreakConfigUpdateHandler implements PUT /api/admin/gamification/streaks/{id}.
func adminStreakConfigUpdateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "streaks", 1)
		if id == "" {
			writeJSONError(w, "streak config id required", http.StatusBadRequest)
			return
		}
		var req struct {
			Name             string `json:"name"`
			ActivityType     string `json:"activityType"`
			MinActionsPerDay int    `json:"minActionsPerDay"`
			FreezesAllowed   int    `json:"freezesAllowed"`
			Enabled          bool   `json:"enabled"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		_, err := db.Exec(r.Context(), `UPDATE gamification.streak_config SET
			name=$1, activity_type=$2, min_actions_per_day=$3, freezes_allowed=$4,
			enabled=$5, updated_by=$6, updated_at=NOW() WHERE id=$7`,
			req.Name, req.ActivityType, req.MinActionsPerDay, req.FreezesAllowed,
			req.Enabled, identity.ActorID, id)
		if err != nil {
			logger.Error("update streak config", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"id": id, "updated": true})
	}
}

// adminStreakConfigDeleteHandler implements DELETE /api/admin/gamification/streaks/{id}.
func adminStreakConfigDeleteHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "streaks", 1)
		if id == "" {
			writeJSONError(w, "streak config id required", http.StatusBadRequest)
			return
		}
		db.Exec(r.Context(), "DELETE FROM gamification.streak_config WHERE id=$1", id)
		writeJSON(w, http.StatusOK, map[string]any{"deleted": true, "id": id})
	}
}

// ── Achievement Definitions ─────────────────────────────────────────────────

// adminAchievementsListHandler implements GET /api/admin/gamification/achievements.
func adminAchievementsListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := db.Query(r.Context(), `SELECT id, slug, name_key, description_key, category,
			metric_key, icon_url, display_order, enabled, created_by, updated_by, created_at, updated_at
			FROM gamification.achievement_definition ORDER BY category ASC, display_order ASC`)
		if err != nil {
			logger.Error("list achievements", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		type Tier struct {
			ID          string  `json:"id"`
			Tier        string  `json:"tier"`
			Threshold   int     `json:"threshold"`
			RewardType  *string `json:"rewardType,omitempty"`
			RewardValue *string `json:"rewardValue,omitempty"`
			IconURL     *string `json:"iconUrl,omitempty"`
			NameKey     *string `json:"nameKey,omitempty"`
		}
		type Achievement struct {
			ID             string  `json:"id"`
			Slug           string  `json:"slug"`
			NameKey        string  `json:"nameKey"`
			DescriptionKey string  `json:"descriptionKey"`
			Category       string  `json:"category"`
			MetricKey      string  `json:"metricKey"`
			IconURL        *string `json:"iconUrl,omitempty"`
			DisplayOrder   int     `json:"displayOrder"`
			Enabled        bool    `json:"enabled"`
			CreatedAt      string  `json:"createdAt"`
			UpdatedAt      string  `json:"updatedAt"`
			Tiers          []Tier  `json:"tiers"`
		}
		var items []Achievement
		for rows.Next() {
			var a Achievement
			var ca, ua time.Time
			if rows.Scan(&a.ID, &a.Slug, &a.NameKey, &a.DescriptionKey, &a.Category,
				&a.MetricKey, &a.IconURL, &a.DisplayOrder, &a.Enabled, nil, nil, &ca, &ua) == nil {
				a.CreatedAt = ca.UTC().Format(time.RFC3339)
				a.UpdatedAt = ua.UTC().Format(time.RFC3339)
				a.Tiers = []Tier{}
				items = append(items, a)
			}
		}
		if items == nil {
			items = []Achievement{}
		}
		// Load tiers for each achievement
		for i := range items {
			tRows, _ := db.Query(r.Context(), `SELECT id, tier, threshold, reward_type, reward_value, icon_url, name_key
				FROM gamification.achievement_tier WHERE achievement_id=$1 ORDER BY threshold ASC`, items[i].ID)
			if tRows != nil {
				for tRows.Next() {
					var t Tier
					if tRows.Scan(&t.ID, &t.Tier, &t.Threshold, &t.RewardType, &t.RewardValue, &t.IconURL, &t.NameKey) == nil {
						items[i].Tiers = append(items[i].Tiers, t)
					}
				}
				tRows.Close()
			}
		}
		writeJSON(w, http.StatusOK, items)
	}
}

// adminAchievementDetailHandler implements GET /api/admin/gamification/achievements/{id}.
func adminAchievementDetailHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := extractPathParam(r.URL.Path, "achievements", 1)
		if id == "" {
			writeJSONError(w, "achievement id required", http.StatusBadRequest)
			return
		}
		type Tier struct {
			ID          string  `json:"id"`
			Tier        string  `json:"tier"`
			Threshold   int     `json:"threshold"`
			RewardType  *string `json:"rewardType,omitempty"`
			RewardValue *string `json:"rewardValue,omitempty"`
			IconURL     *string `json:"iconUrl,omitempty"`
			NameKey     *string `json:"nameKey,omitempty"`
		}
		type Detail struct {
			ID             string  `json:"id"`
			Slug           string  `json:"slug"`
			NameKey        string  `json:"nameKey"`
			DescriptionKey string  `json:"descriptionKey"`
			Category       string  `json:"category"`
			MetricKey      string  `json:"metricKey"`
			IconURL        *string `json:"iconUrl,omitempty"`
			DisplayOrder   int     `json:"displayOrder"`
			Enabled        bool    `json:"enabled"`
			CreatedAt      string  `json:"createdAt"`
			UpdatedAt      string  `json:"updatedAt"`
			Tiers          []Tier  `json:"tiers"`
		}
		var d Detail
		var ca, ua time.Time
		err := db.QueryRow(r.Context(), `SELECT id, slug, name_key, description_key, category,
			metric_key, icon_url, display_order, enabled, created_at, updated_at
			FROM gamification.achievement_definition WHERE id=$1`, id).
			Scan(&d.ID, &d.Slug, &d.NameKey, &d.DescriptionKey, &d.Category,
				&d.MetricKey, &d.IconURL, &d.DisplayOrder, &d.Enabled, &ca, &ua)
		if err != nil {
			writeJSONError(w, "achievement not found", http.StatusNotFound)
			return
		}
		d.CreatedAt = ca.UTC().Format(time.RFC3339)
		d.UpdatedAt = ua.UTC().Format(time.RFC3339)
		d.Tiers = []Tier{}
		tRows, _ := db.Query(r.Context(), `SELECT id, tier, threshold, reward_type, reward_value, icon_url, name_key
			FROM gamification.achievement_tier WHERE achievement_id=$1 ORDER BY threshold ASC`, id)
		if tRows != nil {
			for tRows.Next() {
				var t Tier
				if tRows.Scan(&t.ID, &t.Tier, &t.Threshold, &t.RewardType, &t.RewardValue, &t.IconURL, &t.NameKey) == nil {
					d.Tiers = append(d.Tiers, t)
				}
			}
			tRows.Close()
		}
		writeJSON(w, http.StatusOK, d)
	}
}

// adminAchievementCreateHandler implements POST /api/admin/gamification/achievements.
func adminAchievementCreateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			Slug           string  `json:"slug"`
			NameKey        string  `json:"nameKey"`
			DescriptionKey string  `json:"descriptionKey"`
			Category       string  `json:"category"`
			MetricKey      string  `json:"metricKey"`
			IconURL        *string `json:"iconUrl"`
			DisplayOrder   int     `json:"displayOrder"`
			Enabled        bool    `json:"enabled"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.Slug == "" || req.NameKey == "" {
			writeJSONError(w, "slug and nameKey required", http.StatusBadRequest)
			return
		}
		var id string
		err := db.QueryRow(r.Context(), `INSERT INTO gamification.achievement_definition
			(slug, name_key, description_key, category, metric_key, icon_url, display_order, enabled, created_by, updated_by, created_at, updated_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,NOW(),NOW()) RETURNING id`,
			req.Slug, req.NameKey, req.DescriptionKey, req.Category, req.MetricKey,
			req.IconURL, req.DisplayOrder, req.Enabled, identity.ActorID).Scan(&id)
		if err != nil {
			logger.Error("create achievement", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusCreated, map[string]any{"id": id, "slug": req.Slug})
	}
}

// adminAchievementUpdateHandler implements PUT /api/admin/gamification/achievements/{id}.
func adminAchievementUpdateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "achievements", 1)
		if id == "" {
			writeJSONError(w, "achievement id required", http.StatusBadRequest)
			return
		}
		var req struct {
			Slug           string  `json:"slug"`
			NameKey        string  `json:"nameKey"`
			DescriptionKey string  `json:"descriptionKey"`
			Category       string  `json:"category"`
			MetricKey      string  `json:"metricKey"`
			IconURL        *string `json:"iconUrl"`
			DisplayOrder   int     `json:"displayOrder"`
			Enabled        bool    `json:"enabled"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		_, err := db.Exec(r.Context(), `UPDATE gamification.achievement_definition SET
			slug=$1, name_key=$2, description_key=$3, category=$4, metric_key=$5,
			icon_url=$6, display_order=$7, enabled=$8, updated_by=$9, updated_at=NOW() WHERE id=$10`,
			req.Slug, req.NameKey, req.DescriptionKey, req.Category, req.MetricKey,
			req.IconURL, req.DisplayOrder, req.Enabled, identity.ActorID, id)
		if err != nil {
			logger.Error("update achievement", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"id": id, "updated": true})
	}
}

// adminAchievementDeleteHandler implements DELETE /api/admin/gamification/achievements/{id}.
func adminAchievementDeleteHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "achievements", 1)
		if id == "" {
			writeJSONError(w, "achievement id required", http.StatusBadRequest)
			return
		}
		// Delete tiers first (cascade may not be configured)
		db.Exec(r.Context(), "DELETE FROM gamification.achievement_tier WHERE achievement_id=$1", id)
		db.Exec(r.Context(), "DELETE FROM gamification.achievement_definition WHERE id=$1", id)
		writeJSON(w, http.StatusOK, map[string]any{"deleted": true, "id": id})
	}
}

// ── Achievement Tiers ───────────────────────────────────────────────────────

// adminAchievementTiersListHandler implements GET /api/admin/gamification/achievements/{achievementId}/tiers.
func adminAchievementTiersListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		achievementID := extractPathParam(r.URL.Path, "achievements", 1)
		if achievementID == "" {
			writeJSONError(w, "achievement id required", http.StatusBadRequest)
			return
		}
		rows, err := db.Query(r.Context(), `SELECT id, tier, threshold, reward_type, reward_value, icon_url, name_key
			FROM gamification.achievement_tier WHERE achievement_id=$1 ORDER BY threshold ASC`, achievementID)
		if err != nil {
			logger.Error("list achievement tiers", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		type Tier struct {
			ID          string  `json:"id"`
			Tier        string  `json:"tier"`
			Threshold   int     `json:"threshold"`
			RewardType  *string `json:"rewardType,omitempty"`
			RewardValue *string `json:"rewardValue,omitempty"`
			IconURL     *string `json:"iconUrl,omitempty"`
			NameKey     *string `json:"nameKey,omitempty"`
		}
		var items []Tier
		for rows.Next() {
			var t Tier
			if rows.Scan(&t.ID, &t.Tier, &t.Threshold, &t.RewardType, &t.RewardValue, &t.IconURL, &t.NameKey) == nil {
				items = append(items, t)
			}
		}
		if items == nil {
			items = []Tier{}
		}
		writeJSON(w, http.StatusOK, items)
	}
}

// adminAchievementTierCreateHandler implements POST /api/admin/gamification/achievements/{achievementId}/tiers.
func adminAchievementTierCreateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		achievementID := extractPathParam(r.URL.Path, "achievements", 1)
		if achievementID == "" {
			writeJSONError(w, "achievement id required", http.StatusBadRequest)
			return
		}
		var req struct {
			Tier        string  `json:"tier"`
			Threshold   int     `json:"threshold"`
			RewardType  *string `json:"rewardType"`
			RewardValue *string `json:"rewardValue"`
			IconURL     *string `json:"iconUrl"`
			NameKey     *string `json:"nameKey"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		var id string
		err := db.QueryRow(r.Context(), `INSERT INTO gamification.achievement_tier
			(achievement_id, tier, threshold, reward_type, reward_value, icon_url, name_key)
			VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
			achievementID, req.Tier, req.Threshold, req.RewardType, req.RewardValue, req.IconURL, req.NameKey).Scan(&id)
		if err != nil {
			logger.Error("create achievement tier", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusCreated, map[string]any{"id": id, "tier": req.Tier})
	}
}

// adminAchievementTierUpdateHandler implements PUT /api/admin/gamification/achievements/tiers/{id}.
func adminAchievementTierUpdateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "tiers", 1)
		if id == "" {
			writeJSONError(w, "tier id required", http.StatusBadRequest)
			return
		}
		var req struct {
			Tier        string  `json:"tier"`
			Threshold   int     `json:"threshold"`
			RewardType  *string `json:"rewardType"`
			RewardValue *string `json:"rewardValue"`
			IconURL     *string `json:"iconUrl"`
			NameKey     *string `json:"nameKey"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		_, err := db.Exec(r.Context(), `UPDATE gamification.achievement_tier SET
			tier=$1, threshold=$2, reward_type=$3, reward_value=$4, icon_url=$5, name_key=$6 WHERE id=$7`,
			req.Tier, req.Threshold, req.RewardType, req.RewardValue, req.IconURL, req.NameKey, id)
		if err != nil {
			logger.Error("update achievement tier", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"id": id, "updated": true})
	}
}

// adminAchievementTierDeleteHandler implements DELETE /api/admin/gamification/achievements/tiers/{id}.
func adminAchievementTierDeleteHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "tiers", 1)
		if id == "" {
			writeJSONError(w, "tier id required", http.StatusBadRequest)
			return
		}
		db.Exec(r.Context(), "DELETE FROM gamification.achievement_tier WHERE id=$1", id)
		writeJSON(w, http.StatusOK, map[string]any{"deleted": true, "id": id})
	}
}

// ── Leaderboard Config ──────────────────────────────────────────────────────

// adminLeaderboardsListHandler implements GET /api/admin/gamification/leaderboards.
func adminLeaderboardsListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := db.Query(r.Context(), `SELECT id, name, name_key, metric_type, period,
			max_entries, enabled, created_by, updated_by, created_at, updated_at
			FROM gamification.leaderboard_config ORDER BY period ASC, metric_type ASC`)
		if err != nil {
			logger.Error("list leaderboards", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		type Config struct {
			ID         string  `json:"id"`
			Name       string  `json:"name"`
			NameKey    *string `json:"nameKey,omitempty"`
			MetricType string  `json:"metricType"`
			Period     string  `json:"period"`
			MaxEntries int     `json:"maxEntries"`
			Enabled    bool    `json:"enabled"`
			CreatedAt  string  `json:"createdAt"`
			UpdatedAt  string  `json:"updatedAt"`
		}
		var items []Config
		for rows.Next() {
			var c Config
			var ca, ua time.Time
			if rows.Scan(&c.ID, &c.Name, &c.NameKey, &c.MetricType, &c.Period,
				&c.MaxEntries, &c.Enabled, nil, nil, &ca, &ua) == nil {
				c.CreatedAt = ca.UTC().Format(time.RFC3339)
				c.UpdatedAt = ua.UTC().Format(time.RFC3339)
				items = append(items, c)
			}
		}
		if items == nil {
			items = []Config{}
		}
		writeJSON(w, http.StatusOK, items)
	}
}

// adminLeaderboardCreateHandler implements POST /api/admin/gamification/leaderboards.
func adminLeaderboardCreateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			Name       string  `json:"name"`
			NameKey    *string `json:"nameKey"`
			MetricType string  `json:"metricType"`
			Period     string  `json:"period"`
			MaxEntries int     `json:"maxEntries"`
			Enabled    bool    `json:"enabled"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.Name == "" || req.MetricType == "" || req.Period == "" {
			writeJSONError(w, "name, metricType, and period required", http.StatusBadRequest)
			return
		}
		var id string
		err := db.QueryRow(r.Context(), `INSERT INTO gamification.leaderboard_config
			(name, name_key, metric_type, period, max_entries, enabled, created_by, updated_by, created_at, updated_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$7,NOW(),NOW()) RETURNING id`,
			req.Name, req.NameKey, req.MetricType, req.Period, req.MaxEntries, req.Enabled, identity.ActorID).Scan(&id)
		if err != nil {
			logger.Error("create leaderboard", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusCreated, map[string]any{"id": id, "name": req.Name})
	}
}

// adminLeaderboardUpdateHandler implements PUT /api/admin/gamification/leaderboards/{id}.
func adminLeaderboardUpdateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "leaderboards", 1)
		if id == "" {
			writeJSONError(w, "leaderboard id required", http.StatusBadRequest)
			return
		}
		var req struct {
			Name       string  `json:"name"`
			NameKey    *string `json:"nameKey"`
			MetricType string  `json:"metricType"`
			Period     string  `json:"period"`
			MaxEntries int     `json:"maxEntries"`
			Enabled    bool    `json:"enabled"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		_, err := db.Exec(r.Context(), `UPDATE gamification.leaderboard_config SET
			name=$1, name_key=$2, metric_type=$3, period=$4, max_entries=$5,
			enabled=$6, updated_by=$7, updated_at=NOW() WHERE id=$8`,
			req.Name, req.NameKey, req.MetricType, req.Period, req.MaxEntries,
			req.Enabled, identity.ActorID, id)
		if err != nil {
			logger.Error("update leaderboard", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"id": id, "updated": true})
	}
}

// adminLeaderboardDeleteHandler implements DELETE /api/admin/gamification/leaderboards/{id}.
func adminLeaderboardDeleteHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "leaderboards", 1)
		if id == "" {
			writeJSONError(w, "leaderboard id required", http.StatusBadRequest)
			return
		}
		db.Exec(r.Context(), "DELETE FROM gamification.leaderboard_config WHERE id=$1", id)
		writeJSON(w, http.StatusOK, map[string]any{"deleted": true, "id": id})
	}
}

// ── Companion Pets ──────────────────────────────────────────────────────────

var petStages = []string{"egg", "baby", "teen", "adult", "master"}

func isValidPetStage(s string) bool {
	for _, v := range petStages {
		if v == s {
			return true
		}
	}
	return false
}

func getMoodFromHappiness(h int) string {
	if h >= 80 {
		return "happy"
	}
	if h >= 50 {
		return "neutral"
	}
	if h >= 20 {
		return "sad"
	}
	return "sick"
}

// adminPetsListHandler implements GET /api/admin/gamification/pets.
func adminPetsListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		stage := r.URL.Query().Get("stage")
		search := r.URL.Query().Get("search")
		whereParts := []string{}
		args := []any{}
		argIdx := 1
		if stage != "" && isValidPetStage(stage) {
			whereParts = append(whereParts, fmt.Sprintf("stage = $%d", argIdx))
			args = append(args, stage)
			argIdx++
		}
		if search != "" {
			pattern := "%" + search + "%"
			whereParts = append(whereParts, fmt.Sprintf("(name ILIKE $%[1]d OR user_id::text ILIKE $%[1]d)", argIdx))
			args = append(args, pattern)
			argIdx++
		}
		whereClause := ""
		if len(whereParts) > 0 {
			whereClause = "WHERE " + strings.Join(whereParts, " AND ")
		}
		query := fmt.Sprintf(`SELECT id, user_id, name, stage, xp, happiness, mood, costume_slug,
			total_feedings, last_fed_at, evolved_at, created_at, updated_at
			FROM gamification.companion_pet %s ORDER BY xp DESC LIMIT 200`, whereClause)
		rows, err := db.Query(r.Context(), query, args...)
		if err != nil {
			logger.Error("list pets", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		type Pet struct {
			ID            string  `json:"id"`
			UserID        string  `json:"userId"`
			Name          *string `json:"name,omitempty"`
			Stage         string  `json:"stage"`
			XP            int     `json:"xp"`
			Happiness     int     `json:"happiness"`
			Mood          string  `json:"mood"`
			CostumeSlug   *string `json:"costumeSlug,omitempty"`
			TotalFeedings int     `json:"totalFeedings"`
			LastFedAt     *string `json:"lastFedAt,omitempty"`
			EvolvedAt     *string `json:"evolvedAt,omitempty"`
			CreatedAt     string  `json:"createdAt"`
			UpdatedAt     string  `json:"updatedAt"`
		}
		var items []Pet
		for rows.Next() {
			var p Pet
			var lfa, ea, ca, ua *time.Time
			if rows.Scan(&p.ID, &p.UserID, &p.Name, &p.Stage, &p.XP, &p.Happiness, &p.Mood,
				&p.CostumeSlug, &p.TotalFeedings, &lfa, &ea, &ca, &ua) == nil {
				if lfa != nil {
					s := lfa.UTC().Format(time.RFC3339)
					p.LastFedAt = &s
				}
				if ea != nil {
					s := ea.UTC().Format(time.RFC3339)
					p.EvolvedAt = &s
				}
				if ca != nil {
					p.CreatedAt = ca.UTC().Format(time.RFC3339)
				}
				if ua != nil {
					p.UpdatedAt = ua.UTC().Format(time.RFC3339)
				}
				items = append(items, p)
			}
		}
		if items == nil {
			items = []Pet{}
		}
		writeJSON(w, http.StatusOK, items)
	}
}

// adminPetsStatsHandler implements GET /api/admin/gamification/pets/stats.
func adminPetsStatsHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var total int
		db.QueryRow(r.Context(), "SELECT COUNT(*) FROM gamification.companion_pet").Scan(&total)
		stageRows, _ := db.Query(r.Context(), "SELECT stage, COUNT(*) FROM gamification.companion_pet GROUP BY stage")
		byStage := []map[string]any{}
		if stageRows != nil {
			for stageRows.Next() {
				var stage string
				var count int
				if stageRows.Scan(&stage, &count) == nil {
					byStage = append(byStage, map[string]any{"stage": stage, "count": count})
				}
			}
			stageRows.Close()
		}
		var avgHappiness, avgXP *float64
		db.QueryRow(r.Context(), "SELECT AVG(happiness), AVG(xp) FROM gamification.companion_pet").Scan(&avgHappiness, &avgXP)
		ah := 0
		ax := 0
		if avgHappiness != nil {
			ah = int(math.Round(*avgHappiness))
		}
		if avgXP != nil {
			ax = int(math.Round(*avgXP))
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"total":        total,
			"byStage":      byStage,
			"avgHappiness": ah,
			"avgXp":        ax,
		})
	}
}

// adminPetDetailHandler implements GET /api/admin/gamification/pets/{id}.
func adminPetDetailHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := extractPathParam(r.URL.Path, "pets", 1)
		if id == "" {
			writeJSONError(w, "pet id required", http.StatusBadRequest)
			return
		}
		type Pet struct {
			ID            string  `json:"id"`
			UserID        string  `json:"userId"`
			Name          *string `json:"name,omitempty"`
			Stage         string  `json:"stage"`
			XP            int     `json:"xp"`
			Happiness     int     `json:"happiness"`
			Mood          string  `json:"mood"`
			CostumeSlug   *string `json:"costumeSlug,omitempty"`
			TotalFeedings int     `json:"totalFeedings"`
			LastFedAt     *string `json:"lastFedAt,omitempty"`
			EvolvedAt     *string `json:"evolvedAt,omitempty"`
			CreatedAt     string  `json:"createdAt"`
			UpdatedAt     string  `json:"updatedAt"`
		}
		var p Pet
		var lfa, ea, ca, ua *time.Time
		err := db.QueryRow(r.Context(), `SELECT id, user_id, name, stage, xp, happiness, mood, costume_slug,
			total_feedings, last_fed_at, evolved_at, created_at, updated_at
			FROM gamification.companion_pet WHERE id=$1`, id).
			Scan(&p.ID, &p.UserID, &p.Name, &p.Stage, &p.XP, &p.Happiness, &p.Mood,
				&p.CostumeSlug, &p.TotalFeedings, &lfa, &ea, &ca, &ua)
		if err != nil {
			writeJSONError(w, "pet not found", http.StatusNotFound)
			return
		}
		if lfa != nil {
			s := lfa.UTC().Format(time.RFC3339)
			p.LastFedAt = &s
		}
		if ea != nil {
			s := ea.UTC().Format(time.RFC3339)
			p.EvolvedAt = &s
		}
		if ca != nil {
			p.CreatedAt = ca.UTC().Format(time.RFC3339)
		}
		if ua != nil {
			p.UpdatedAt = ua.UTC().Format(time.RFC3339)
		}
		writeJSON(w, http.StatusOK, p)
	}
}

// adminPetUpdateHandler implements PUT /api/admin/gamification/pets/{id}.
func adminPetUpdateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "pets", 1)
		if id == "" {
			writeJSONError(w, "pet id required", http.StatusBadRequest)
			return
		}
		var req struct {
			Stage     *string `json:"stage"`
			XP        *int    `json:"xp"`
			Happiness *int    `json:"happiness"`
			Name      *string `json:"name"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		setClauses := []string{}
		args := []any{}
		argIdx := 1
		if req.Stage != nil && isValidPetStage(*req.Stage) {
			setClauses = append(setClauses, fmt.Sprintf("stage = $%d", argIdx))
			args = append(args, *req.Stage)
			argIdx++
		}
		if req.XP != nil && *req.XP >= 0 {
			setClauses = append(setClauses, fmt.Sprintf("xp = $%d", argIdx))
			args = append(args, *req.XP)
			argIdx++
		}
		if req.Happiness != nil && *req.Happiness >= 0 && *req.Happiness <= 100 {
			setClauses = append(setClauses, fmt.Sprintf("happiness = $%d", argIdx))
			args = append(args, *req.Happiness)
			argIdx++
			setClauses = append(setClauses, fmt.Sprintf("mood = $%d", argIdx))
			args = append(args, getMoodFromHappiness(*req.Happiness))
			argIdx++
		}
		if req.Name != nil {
			cleanName := strings.TrimSpace(*req.Name)
			if len(cleanName) > 30 {
				cleanName = cleanName[:30]
			}
			if cleanName != "" {
				setClauses = append(setClauses, fmt.Sprintf("name = $%d", argIdx))
				args = append(args, cleanName)
				argIdx++
			}
		}
		if len(setClauses) == 0 {
			writeJSONError(w, "at least one field to update is required", http.StatusBadRequest)
			return
		}
		setClauses = append(setClauses, "updated_at = NOW()")
		query := "UPDATE gamification.companion_pet SET " + strings.Join(setClauses, ", ") + fmt.Sprintf(" WHERE id = $%d", argIdx)
		args = append(args, id)
		if _, err := db.Exec(r.Context(), query, args...); err != nil {
			logger.Error("update pet", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"id": id, "updated": true})
	}
}

// adminPetResetHandler implements POST /api/admin/gamification/pets/{id}/reset.
func adminPetResetHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "pets", 1)
		if id == "" {
			writeJSONError(w, "pet id required", http.StatusBadRequest)
			return
		}
		_, err := db.Exec(r.Context(), `UPDATE gamification.companion_pet SET
			stage='egg', xp=0, happiness=100, mood='happy', total_feedings=0,
			last_fed_at=NULL, evolved_at=NULL, costume_slug=NULL, updated_at=NOW()
			WHERE id=$1`, id)
		if err != nil {
			logger.Error("reset pet", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"id": id, "reset": true})
	}
}
