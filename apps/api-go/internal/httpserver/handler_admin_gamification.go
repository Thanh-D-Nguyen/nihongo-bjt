package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"math"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
)

// ── P1-A9: Admin Gamification — Streaks + Achievements + Tiers + Leaderboards + Pets (23 routes) ──
// Contracts derived from NestJS gamification-admin.controller.ts,
// gamification.repository.ts, and companion-pet.service.ts.
// DB tables: gamification.streak_config, gamification.achievement_definition,
// gamification.achievement_tier, gamification.leaderboard_config,
// gamification.companion_pet.

type adminAchievementDefinitionInput struct {
	Slug           string  `json:"slug"`
	NameKey        string  `json:"nameKey"`
	DescriptionKey string  `json:"descriptionKey"`
	Category       string  `json:"category"`
	MetricKey      string  `json:"metricKey"`
	IconURL        *string `json:"iconUrl"`
	DisplayOrder   int     `json:"displayOrder"`
	Enabled        *bool   `json:"enabled"`
}

type adminAchievementTierInput struct {
	Tier        string  `json:"tier"`
	Threshold   int     `json:"threshold"`
	RewardType  *string `json:"rewardType"`
	RewardValue *string `json:"rewardValue"`
	IconURL     *string `json:"iconUrl"`
	NameKey     *string `json:"nameKey"`
}

func decodeAdminAchievementDefinition(r *http.Request, input *adminAchievementDefinitionInput) error {
	var raw json.RawMessage
	if err := json.NewDecoder(r.Body).Decode(&raw); err != nil {
		return err
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(raw, &fields); err != nil {
		return err
	}
	for _, field := range []string{"displayOrder", "enabled"} {
		if value, ok := fields[field]; ok && strings.TrimSpace(string(value)) == "null" {
			return fmt.Errorf("%s cannot be null", field)
		}
	}
	return json.Unmarshal(raw, input)
}

func normalizeOptionalAdminString(value *string, max int) bool {
	if value == nil {
		return true
	}
	*value = strings.TrimSpace(*value)
	return utf8.RuneCountInString(*value) <= max
}

func normalizeAdminAchievementDefinition(input *adminAchievementDefinitionInput) bool {
	input.Slug = strings.TrimSpace(input.Slug)
	input.NameKey = strings.TrimSpace(input.NameKey)
	input.DescriptionKey = strings.TrimSpace(input.DescriptionKey)
	input.MetricKey = strings.TrimSpace(input.MetricKey)
	if n := len(input.Slug); n == 0 || n > 128 {
		return false
	}
	for _, r := range input.Slug {
		if !((r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '_' || r == '-') {
			return false
		}
	}
	if utf8.RuneCountInString(input.NameKey) == 0 || utf8.RuneCountInString(input.NameKey) > 255 ||
		utf8.RuneCountInString(input.DescriptionKey) == 0 || utf8.RuneCountInString(input.DescriptionKey) > 255 ||
		utf8.RuneCountInString(input.MetricKey) == 0 || utf8.RuneCountInString(input.MetricKey) > 64 || input.DisplayOrder < 0 {
		return false
	}
	switch input.Category {
	case "learning", "social", "streak", "mastery", "battle":
	default:
		return false
	}
	if !normalizeOptionalAdminString(input.IconURL, 2048) {
		return false
	}
	if input.Enabled == nil {
		enabled := true
		input.Enabled = &enabled
	}
	return true
}

func normalizeAdminAchievementTier(input *adminAchievementTierInput) bool {
	if input.Threshold < 1 {
		return false
	}
	switch input.Tier {
	case "bronze", "silver", "gold", "platinum":
	default:
		return false
	}
	return normalizeOptionalAdminString(input.RewardType, 32) &&
		normalizeOptionalAdminString(input.RewardValue, 255) &&
		normalizeOptionalAdminString(input.IconURL, 2048) &&
		normalizeOptionalAdminString(input.NameKey, 255)
}

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
			if err := rows.Scan(&c.ID, &c.Name, &c.ActivityType, &c.MinActionsPerDay,
				&c.FreezesAllowed, &c.Enabled, &c.CreatedBy, &c.UpdatedBy, &ca, &ua); err != nil {
				logger.Error("scan streak config", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			c.CreatedAt = ca.UTC().Format(time.RFC3339)
			c.UpdatedAt = ua.UTC().Format(time.RFC3339)
			items = append(items, c)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate streak configs", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
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
		req.Name = strings.TrimSpace(req.Name)
		if !validAdminStreakConfig(req.Name, req.ActivityType, req.MinActionsPerDay, req.FreezesAllowed) {
			writeJSONError(w, "invalid streak configuration", http.StatusBadRequest)
			return
		}
		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin create streak config", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(r.Context())
		var id string
		err = tx.QueryRow(r.Context(), `INSERT INTO gamification.streak_config
			(name, activity_type, min_actions_per_day, freezes_allowed, enabled, created_by, updated_by, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $6, NOW(), NOW()) RETURNING id`,
			req.Name, req.ActivityType, req.MinActionsPerDay, req.FreezesAllowed, req.Enabled, identity.ActorID).Scan(&id)
		if err != nil {
			logger.Error("create streak config", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		after, _ := json.Marshal(req)
		if _, err := tx.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, after, created_at)
			VALUES ('admin.gamification.streak.created',$1,$2,'gamification.streak_config',$3,NOW())`, identity.ActorID, id, after); err != nil {
			logger.Error("audit create streak config", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			logger.Error("commit create streak config", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusCreated, map[string]any{"id": id, "name": req.Name})
	}
}

func validStreakActivityType(value string) bool {
	switch value {
	case "review", "exercise", "quiz", "battle", "any":
		return true
	default:
		return false
	}
}

func validAdminStreakConfig(name, activityType string, minActionsPerDay, freezesAllowed int) bool {
	return utf8.RuneCountInString(name) > 0 && utf8.RuneCountInString(name) <= 128 &&
		validStreakActivityType(activityType) && minActionsPerDay >= 1 && minActionsPerDay <= 100 &&
		freezesAllowed >= 0 && freezesAllowed <= 10
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
		if !isValidUUID(id) {
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
		req.Name = strings.TrimSpace(req.Name)
		if !validAdminStreakConfig(req.Name, req.ActivityType, req.MinActionsPerDay, req.FreezesAllowed) {
			writeJSONError(w, "invalid streak configuration", http.StatusBadRequest)
			return
		}
		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin update streak config", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(r.Context())
		var before json.RawMessage
		err = tx.QueryRow(r.Context(), `SELECT jsonb_build_object('name',name,'activityType',activity_type,'minActionsPerDay',min_actions_per_day,'freezesAllowed',freezes_allowed,'enabled',enabled)
			FROM gamification.streak_config WHERE id=$1 FOR UPDATE`, id).Scan(&before)
		if err == pgx.ErrNoRows {
			writeJSONError(w, "streak config not found", http.StatusNotFound)
			return
		}
		if err != nil {
			logger.Error("read streak config before update", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		_, err = tx.Exec(r.Context(), `UPDATE gamification.streak_config SET
			name=$1, activity_type=$2, min_actions_per_day=$3, freezes_allowed=$4,
			enabled=$5, updated_by=$6, updated_at=NOW() WHERE id=$7`,
			req.Name, req.ActivityType, req.MinActionsPerDay, req.FreezesAllowed,
			req.Enabled, identity.ActorID, id)
		if err != nil {
			logger.Error("update streak config", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		after, _ := json.Marshal(req)
		if _, err := tx.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, before, after, created_at)
			VALUES ('admin.gamification.streak.updated',$1,$2,'gamification.streak_config',$3,$4,NOW())`, identity.ActorID, id, before, after); err != nil {
			logger.Error("audit update streak config", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			logger.Error("commit update streak config", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"id": id, "updated": true})
	}
}

// adminStreakConfigDeleteHandler implements DELETE /api/admin/gamification/streaks/{id}.
func adminStreakConfigDeleteHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "streaks", 1)
		if !isValidUUID(id) {
			writeJSONError(w, "streak config id required", http.StatusBadRequest)
			return
		}
		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin delete streak config", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(r.Context())
		var before json.RawMessage
		if err := tx.QueryRow(r.Context(), `SELECT jsonb_build_object('name',name,'activityType',activity_type,'minActionsPerDay',min_actions_per_day,'freezesAllowed',freezes_allowed,'enabled',enabled)
			FROM gamification.streak_config WHERE id=$1 FOR UPDATE`, id).Scan(&before); err == pgx.ErrNoRows {
			writeJSONError(w, "streak config not found", http.StatusNotFound)
			return
		} else if err != nil {
			logger.Error("read streak config before delete", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if _, err := tx.Exec(r.Context(), "DELETE FROM gamification.streak_config WHERE id=$1", id); err != nil {
			logger.Error("delete streak config", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if _, err := tx.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, before, created_at)
			VALUES ('admin.gamification.streak.deleted',$1,$2,'gamification.streak_config',$3,NOW())`, identity.ActorID, id, before); err != nil {
			logger.Error("audit delete streak config", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			logger.Error("commit delete streak config", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"deleted": true, "id": id})
	}
}

// ── Achievement Definitions ─────────────────────────────────────────────────

// adminAchievementsListHandler implements GET /api/admin/gamification/achievements.
func adminAchievementsListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := db.Query(r.Context(), `SELECT id, slug, name_key, description_key, category,
			metric_key, icon_url, display_order, enabled, created_at, updated_at
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
			if err := rows.Scan(&a.ID, &a.Slug, &a.NameKey, &a.DescriptionKey, &a.Category,
				&a.MetricKey, &a.IconURL, &a.DisplayOrder, &a.Enabled, &ca, &ua); err != nil {
				logger.Error("scan achievements", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			a.CreatedAt = ca.UTC().Format(time.RFC3339)
			a.UpdatedAt = ua.UTC().Format(time.RFC3339)
			a.Tiers = []Tier{}
			items = append(items, a)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate achievements", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if items == nil {
			items = []Achievement{}
		}
		// Load tiers for each achievement
		for i := range items {
			tRows, err := db.Query(r.Context(), `SELECT id, tier, threshold, reward_type, reward_value, icon_url, name_key
				FROM gamification.achievement_tier WHERE achievement_id=$1 ORDER BY threshold ASC`, items[i].ID)
			if err != nil {
				logger.Error("list achievement tiers", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			for tRows.Next() {
				var t Tier
				if err := tRows.Scan(&t.ID, &t.Tier, &t.Threshold, &t.RewardType, &t.RewardValue, &t.IconURL, &t.NameKey); err != nil {
					tRows.Close()
					logger.Error("scan achievement tiers", "error", err)
					writeJSONError(w, "internal error", http.StatusInternalServerError)
					return
				}
				items[i].Tiers = append(items[i].Tiers, t)
			}
			if err := tRows.Err(); err != nil {
				tRows.Close()
				logger.Error("iterate achievement tiers", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			tRows.Close()
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
		if err == pgx.ErrNoRows {
			writeJSONError(w, "achievement not found", http.StatusNotFound)
			return
		}
		if err != nil {
			logger.Error("read achievement detail", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		d.CreatedAt = ca.UTC().Format(time.RFC3339)
		d.UpdatedAt = ua.UTC().Format(time.RFC3339)
		d.Tiers = []Tier{}
		tRows, err := db.Query(r.Context(), `SELECT id, tier, threshold, reward_type, reward_value, icon_url, name_key
			FROM gamification.achievement_tier WHERE achievement_id=$1 ORDER BY threshold ASC`, id)
		if err != nil {
			logger.Error("list achievement detail tiers", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tRows.Close()
		for tRows.Next() {
			var t Tier
			if err := tRows.Scan(&t.ID, &t.Tier, &t.Threshold, &t.RewardType, &t.RewardValue, &t.IconURL, &t.NameKey); err != nil {
				logger.Error("scan achievement detail tier", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			d.Tiers = append(d.Tiers, t)
		}
		if err := tRows.Err(); err != nil {
			logger.Error("iterate achievement detail tiers", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
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
		var req adminAchievementDefinitionInput
		if err := decodeAdminAchievementDefinition(r, &req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if !normalizeAdminAchievementDefinition(&req) {
			writeJSONError(w, "invalid achievement definition", http.StatusBadRequest)
			return
		}
		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin create achievement", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(r.Context())
		var id string
		err = tx.QueryRow(r.Context(), `INSERT INTO gamification.achievement_definition
			(slug, name_key, description_key, category, metric_key, icon_url, display_order, enabled, created_by, updated_by, created_at, updated_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,NOW(),NOW()) RETURNING id`,
			req.Slug, req.NameKey, req.DescriptionKey, req.Category, req.MetricKey,
			req.IconURL, req.DisplayOrder, *req.Enabled, identity.ActorID).Scan(&id)
		if err != nil {
			logger.Error("create achievement", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if _, err := tx.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, after, created_at)
			VALUES ('admin.gamification.achievement.created',$1,$2,'gamification.achievement_definition',
			jsonb_build_object('slug',$3::text,'nameKey',$4::text,'category',$5::text,'metricKey',$6::text),NOW())`, identity.ActorID, id, req.Slug, req.NameKey, req.Category, req.MetricKey); err != nil {
			logger.Error("audit create achievement", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			logger.Error("commit create achievement", "error", err)
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
		var req adminAchievementDefinitionInput
		if err := decodeAdminAchievementDefinition(r, &req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if !normalizeAdminAchievementDefinition(&req) {
			writeJSONError(w, "invalid achievement definition", http.StatusBadRequest)
			return
		}
		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin update achievement", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(r.Context())
		var updatedID string
		err = tx.QueryRow(r.Context(), `UPDATE gamification.achievement_definition SET
			slug=$1, name_key=$2, description_key=$3, category=$4, metric_key=$5,
			icon_url=$6, display_order=$7, enabled=$8, updated_by=$9, updated_at=NOW() WHERE id=$10 RETURNING id`,
			req.Slug, req.NameKey, req.DescriptionKey, req.Category, req.MetricKey,
			req.IconURL, req.DisplayOrder, *req.Enabled, identity.ActorID, id).Scan(&updatedID)
		if err == pgx.ErrNoRows {
			writeJSONError(w, "achievement not found", http.StatusNotFound)
			return
		}
		if err != nil {
			logger.Error("update achievement", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if _, err := tx.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, after, created_at)
			VALUES ('admin.gamification.achievement.updated',$1,$2,'gamification.achievement_definition',
			jsonb_build_object('slug',$3::text,'nameKey',$4::text,'descriptionKey',$5::text,'category',$6::text,'metricKey',$7::text,'enabled',$8::boolean),NOW())`,
			identity.ActorID, updatedID, req.Slug, req.NameKey, req.DescriptionKey, req.Category, req.MetricKey, *req.Enabled); err != nil {
			logger.Error("audit update achievement", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			logger.Error("commit update achievement", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"id": id, "updated": true})
	}
}

// adminAchievementDeleteHandler implements DELETE /api/admin/gamification/achievements/{id}.
func adminAchievementDeleteHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
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
		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin delete achievement", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(r.Context())
		var slug, nameKey, descriptionKey string
		if err := tx.QueryRow(r.Context(), `SELECT slug,name_key,description_key FROM gamification.achievement_definition WHERE id=$1 FOR UPDATE`, id).Scan(&slug, &nameKey, &descriptionKey); err == pgx.ErrNoRows {
			writeJSONError(w, "achievement not found", http.StatusNotFound)
			return
		} else if err != nil {
			logger.Error("read achievement before delete", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if _, err := tx.Exec(r.Context(), "DELETE FROM gamification.achievement_tier WHERE achievement_id=$1", id); err != nil {
			logger.Error("delete achievement tiers", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if _, err := tx.Exec(r.Context(), "DELETE FROM gamification.achievement_definition WHERE id=$1", id); err != nil {
			logger.Error("delete achievement", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if _, err := tx.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, before, created_at)
			VALUES ('admin.gamification.achievement.deleted',$1,$2,'gamification.achievement_definition',
			jsonb_build_object('slug',$3::text,'nameKey',$4::text,'descriptionKey',$5::text),NOW())`, identity.ActorID, id, slug, nameKey, descriptionKey); err != nil {
			logger.Error("audit delete achievement", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			logger.Error("commit delete achievement", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
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
		var exists bool
		if err := db.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM gamification.achievement_definition WHERE id=$1)`, achievementID).Scan(&exists); err != nil {
			logger.Error("check achievement before listing tiers", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if !exists {
			writeJSONError(w, "achievement not found", http.StatusNotFound)
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
			if err := rows.Scan(&t.ID, &t.Tier, &t.Threshold, &t.RewardType, &t.RewardValue, &t.IconURL, &t.NameKey); err != nil {
				logger.Error("scan achievement tiers", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			items = append(items, t)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate achievement tiers", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
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
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		achievementID := extractPathParam(r.URL.Path, "achievements", 1)
		if achievementID == "" {
			writeJSONError(w, "achievement id required", http.StatusBadRequest)
			return
		}
		var req adminAchievementTierInput
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if !normalizeAdminAchievementTier(&req) {
			writeJSONError(w, "invalid achievement tier", http.StatusBadRequest)
			return
		}
		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin create achievement tier", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(r.Context())
		var exists bool
		if err := tx.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM gamification.achievement_definition WHERE id=$1)`, achievementID).Scan(&exists); err != nil {
			logger.Error("check achievement before tier create", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if !exists {
			writeJSONError(w, "achievement not found", http.StatusNotFound)
			return
		}
		var id string
		err = tx.QueryRow(r.Context(), `INSERT INTO gamification.achievement_tier
			(achievement_id, tier, threshold, reward_type, reward_value, icon_url, name_key)
			VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
			achievementID, req.Tier, req.Threshold, req.RewardType, req.RewardValue, req.IconURL, req.NameKey).Scan(&id)
		if err != nil {
			logger.Error("create achievement tier", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if _, err := tx.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, after, created_at)
			VALUES ('admin.gamification.achievement_tier.created',$1,$2,'gamification.achievement_tier',
			jsonb_build_object('achievementId',$3::text,'tier',$4::text,'threshold',$5::int,'rewardType',$6::text,'rewardValue',$7::text,'nameKey',$8::text),NOW())`,
			identity.ActorID, id, achievementID, req.Tier, req.Threshold, req.RewardType, req.RewardValue, req.NameKey); err != nil {
			logger.Error("audit create achievement tier", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			logger.Error("commit create achievement tier", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusCreated, map[string]any{"id": id, "tier": req.Tier})
	}
}

// adminAchievementTierUpdateHandler implements PUT /api/admin/gamification/achievements/tiers/{id}.
func adminAchievementTierUpdateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "tiers", 1)
		if id == "" {
			writeJSONError(w, "tier id required", http.StatusBadRequest)
			return
		}
		var req adminAchievementTierInput
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if !normalizeAdminAchievementTier(&req) {
			writeJSONError(w, "invalid achievement tier", http.StatusBadRequest)
			return
		}
		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin update achievement tier", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(r.Context())
		var achievementID string
		err = tx.QueryRow(r.Context(), `UPDATE gamification.achievement_tier SET
			tier=$1, threshold=$2, reward_type=$3, reward_value=$4, icon_url=$5, name_key=$6 WHERE id=$7
			RETURNING achievement_id`, req.Tier, req.Threshold, req.RewardType, req.RewardValue, req.IconURL, req.NameKey, id).Scan(&achievementID)
		if err == pgx.ErrNoRows {
			writeJSONError(w, "achievement tier not found", http.StatusNotFound)
			return
		}
		if err != nil {
			logger.Error("update achievement tier", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if _, err := tx.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, after, created_at)
			VALUES ('admin.gamification.achievement_tier.updated',$1,$2,'gamification.achievement_tier',
			jsonb_build_object('achievementId',$3::text,'tier',$4::text,'threshold',$5::int,'rewardType',$6::text,'rewardValue',$7::text,'nameKey',$8::text),NOW())`,
			identity.ActorID, id, achievementID, req.Tier, req.Threshold, req.RewardType, req.RewardValue, req.NameKey); err != nil {
			logger.Error("audit update achievement tier", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			logger.Error("commit update achievement tier", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"id": id, "updated": true})
	}
}

// adminAchievementTierDeleteHandler implements DELETE /api/admin/gamification/achievements/tiers/{id}.
func adminAchievementTierDeleteHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "tiers", 1)
		if id == "" {
			writeJSONError(w, "tier id required", http.StatusBadRequest)
			return
		}
		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin delete achievement tier", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(r.Context())
		var achievementID, tier string
		var threshold int
		if err := tx.QueryRow(r.Context(), `DELETE FROM gamification.achievement_tier WHERE id=$1 RETURNING achievement_id, tier, threshold`, id).Scan(&achievementID, &tier, &threshold); err == pgx.ErrNoRows {
			writeJSONError(w, "achievement tier not found", http.StatusNotFound)
			return
		} else if err != nil {
			logger.Error("delete achievement tier", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if _, err := tx.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, before, created_at)
			VALUES ('admin.gamification.achievement_tier.deleted',$1,$2,'gamification.achievement_tier',
			jsonb_build_object('achievementId',$3::text,'tier',$4::text,'threshold',$5::int),NOW())`, identity.ActorID, id, achievementID, tier, threshold); err != nil {
			logger.Error("audit delete achievement tier", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			logger.Error("commit delete achievement tier", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"deleted": true, "id": id})
	}
}

// ── Leaderboard Config ──────────────────────────────────────────────────────

type adminLeaderboardInput struct {
	Name       string  `json:"name"`
	NameKey    *string `json:"nameKey"`
	MetricType string  `json:"metricType"`
	Period     string  `json:"period"`
	MaxEntries int     `json:"maxEntries"`
	Enabled    bool    `json:"enabled"`
}

func normalizeAdminLeaderboardInput(input *adminLeaderboardInput) bool {
	input.Name = strings.TrimSpace(input.Name)
	input.MetricType = strings.TrimSpace(input.MetricType)
	input.Period = strings.TrimSpace(input.Period)
	if input.NameKey != nil {
		value := strings.TrimSpace(*input.NameKey)
		input.NameKey = &value
	}
	if utf8.RuneCountInString(input.Name) == 0 || utf8.RuneCountInString(input.Name) > 128 ||
		!normalizeOptionalAdminString(input.NameKey, 255) ||
		utf8.RuneCountInString(input.MetricType) == 0 || utf8.RuneCountInString(input.MetricType) > 32 ||
		input.MaxEntries < 1 || input.MaxEntries > 1<<31-1 {
		return false
	}
	switch input.Period {
	case "daily", "weekly", "monthly", "all_time":
		return true
	default:
		return false
	}
}

func writeAdminLeaderboardAudit(ctx context.Context, tx pgx.Tx, actorID, action, targetID string, before, after any) error {
	beforeJSON, err := json.Marshal(before)
	if err != nil {
		return err
	}
	afterJSON, err := json.Marshal(after)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `INSERT INTO ops.admin_audit_log
		(action, actor_id, target_id, target_type, before, after, created_at)
		VALUES ($1,$2,$3,'gamification.leaderboard_config',NULLIF($4,'null')::jsonb,NULLIF($5,'null')::jsonb,NOW())`,
		action, actorID, targetID, string(beforeJSON), string(afterJSON))
	return err
}

// adminLeaderboardsListHandler implements GET /api/admin/gamification/leaderboards.
func adminLeaderboardsListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := db.Query(r.Context(), `SELECT id, name, name_key, metric_type, period,
			max_entries, enabled, created_at, updated_at
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
			if err := rows.Scan(&c.ID, &c.Name, &c.NameKey, &c.MetricType, &c.Period,
				&c.MaxEntries, &c.Enabled, &ca, &ua); err != nil {
				logger.Error("scan leaderboard", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			c.CreatedAt = ca.UTC().Format(time.RFC3339)
			c.UpdatedAt = ua.UTC().Format(time.RFC3339)
			items = append(items, c)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate leaderboards", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
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
		var req adminLeaderboardInput
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if !normalizeAdminLeaderboardInput(&req) {
			writeJSONError(w, "invalid leaderboard configuration", http.StatusBadRequest)
			return
		}
		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin create leaderboard", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(r.Context())
		var id string
		err = tx.QueryRow(r.Context(), `INSERT INTO gamification.leaderboard_config
			(name, name_key, metric_type, period, max_entries, enabled, created_by, updated_by, created_at, updated_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$7,NOW(),NOW()) RETURNING id`,
			req.Name, req.NameKey, req.MetricType, req.Period, req.MaxEntries, req.Enabled, identity.ActorID).Scan(&id)
		if err != nil {
			logger.Error("create leaderboard", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		after := map[string]any{"id": id, "name": req.Name, "nameKey": req.NameKey, "metricType": req.MetricType, "period": req.Period, "maxEntries": req.MaxEntries, "enabled": req.Enabled}
		if err := writeAdminLeaderboardAudit(r.Context(), tx, identity.ActorID, "admin.gamification.leaderboard.created", id, nil, after); err != nil {
			logger.Error("audit create leaderboard", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			logger.Error("commit create leaderboard", "error", err)
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
		var req adminLeaderboardInput
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if !normalizeAdminLeaderboardInput(&req) {
			writeJSONError(w, "invalid leaderboard configuration", http.StatusBadRequest)
			return
		}
		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin update leaderboard", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(r.Context())
		var before adminLeaderboardInput
		err = tx.QueryRow(r.Context(), `SELECT name,name_key,metric_type,period,max_entries,enabled
			FROM gamification.leaderboard_config WHERE id=$1 FOR UPDATE`, id).
			Scan(&before.Name, &before.NameKey, &before.MetricType, &before.Period, &before.MaxEntries, &before.Enabled)
		if err == pgx.ErrNoRows {
			writeJSONError(w, "leaderboard not found", http.StatusNotFound)
			return
		}
		if err != nil {
			logger.Error("load leaderboard for update", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		_, err = tx.Exec(r.Context(), `UPDATE gamification.leaderboard_config SET
			name=$1, name_key=$2, metric_type=$3, period=$4, max_entries=$5,
			enabled=$6, updated_by=$7, updated_at=NOW() WHERE id=$8`,
			req.Name, req.NameKey, req.MetricType, req.Period, req.MaxEntries,
			req.Enabled, identity.ActorID, id)
		if err != nil {
			logger.Error("update leaderboard", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		after := map[string]any{"name": req.Name, "nameKey": req.NameKey, "metricType": req.MetricType, "period": req.Period, "maxEntries": req.MaxEntries, "enabled": req.Enabled}
		if err := writeAdminLeaderboardAudit(r.Context(), tx, identity.ActorID, "admin.gamification.leaderboard.updated", id, before, after); err != nil {
			logger.Error("audit update leaderboard", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			logger.Error("commit update leaderboard", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"id": id, "updated": true})
	}
}

// adminLeaderboardDeleteHandler implements DELETE /api/admin/gamification/leaderboards/{id}.
func adminLeaderboardDeleteHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
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
		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin delete leaderboard", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(r.Context())
		// FK inserts take a key-share lock on this row, so serialize them before checking history.
		var before adminLeaderboardInput
		err = tx.QueryRow(r.Context(), `SELECT name,name_key,metric_type,period,max_entries,enabled
			FROM gamification.leaderboard_config WHERE id=$1 FOR UPDATE`, id).
			Scan(&before.Name, &before.NameKey, &before.MetricType, &before.Period, &before.MaxEntries, &before.Enabled)
		if err == pgx.ErrNoRows {
			writeJSONError(w, "leaderboard not found", http.StatusNotFound)
			return
		}
		if err != nil {
			logger.Error("lock leaderboard for delete", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		var hasEntries bool
		if err := tx.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM gamification.leaderboard_entry WHERE leaderboard_id=$1)`, id).Scan(&hasEntries); err != nil {
			logger.Error("check leaderboard history", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if hasEntries {
			writeJSONError(w, "leaderboard has historical entries", http.StatusConflict)
			return
		}
		_, err = tx.Exec(r.Context(), `DELETE FROM gamification.leaderboard_config WHERE id=$1`, id)
		if err != nil {
			logger.Error("delete leaderboard", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := writeAdminLeaderboardAudit(r.Context(), tx, identity.ActorID, "admin.gamification.leaderboard.deleted", id, before, map[string]bool{"deleted": true}); err != nil {
			logger.Error("audit delete leaderboard", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			logger.Error("commit delete leaderboard", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
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
		if stage != "" && !isValidPetStage(stage) {
			writeJSONError(w, "invalid pet stage", http.StatusBadRequest)
			return
		}
		whereParts := []string{}
		args := []any{}
		argIdx := 1
		if stage != "" {
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
			if err := rows.Scan(&p.ID, &p.UserID, &p.Name, &p.Stage, &p.XP, &p.Happiness, &p.Mood,
				&p.CostumeSlug, &p.TotalFeedings, &lfa, &ea, &ca, &ua); err != nil {
				logger.Error("scan pet", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
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
			items = append(items, p)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate pets", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
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
		if err := db.QueryRow(r.Context(), "SELECT COUNT(*) FROM gamification.companion_pet").Scan(&total); err != nil {
			logger.Error("count pets", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		stageRows, err := db.Query(r.Context(), "SELECT stage, COUNT(*) FROM gamification.companion_pet GROUP BY stage")
		if err != nil {
			logger.Error("count pets by stage", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer stageRows.Close()
		byStage := []map[string]any{}
		for stageRows.Next() {
			var stage string
			var count int
			if err := stageRows.Scan(&stage, &count); err != nil {
				logger.Error("scan pets by stage", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			byStage = append(byStage, map[string]any{"stage": stage, "count": count})
		}
		if err := stageRows.Err(); err != nil {
			logger.Error("iterate pets by stage", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		var avgHappiness, avgXP *float64
		if err := db.QueryRow(r.Context(), "SELECT AVG(happiness), AVG(xp) FROM gamification.companion_pet").Scan(&avgHappiness, &avgXP); err != nil {
			logger.Error("average pet stats", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
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
		if !isValidUUID(id) {
			writeJSONError(w, "invalid pet id", http.StatusBadRequest)
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
		if err == pgx.ErrNoRows {
			writeJSONError(w, "pet not found", http.StatusNotFound)
			return
		}
		if err != nil {
			logger.Error("get pet detail", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
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

func writeAdminPetAudit(ctx context.Context, tx pgx.Tx, actorID, action, petID string, before, after any) error {
	beforeJSON, err := json.Marshal(before)
	if err != nil {
		return err
	}
	afterJSON, err := json.Marshal(after)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `INSERT INTO ops.admin_audit_log
		(action,actor_id,target_id,target_type,before,after,created_at)
		VALUES ($1,$2,$3,'gamification.companion_pet',$4::jsonb,$5::jsonb,NOW())`,
		action, actorID, petID, string(beforeJSON), string(afterJSON))
	return err
}

// adminPetUpdateHandler implements PUT /api/admin/gamification/pets/{id}.
func adminPetUpdateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "pets", 1)
		if !isValidUUID(id) {
			writeJSONError(w, "invalid pet id", http.StatusBadRequest)
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
		if (req.Stage != nil && !isValidPetStage(*req.Stage)) ||
			(req.XP != nil && (*req.XP < 0 || *req.XP > int(^uint32(0)>>1))) ||
			(req.Happiness != nil && (*req.Happiness < 0 || *req.Happiness > 100)) {
			writeJSONError(w, "invalid pet fields", http.StatusBadRequest)
			return
		}
		if req.Name != nil {
			cleanName := strings.TrimSpace(*req.Name)
			if utf8.RuneCountInString(cleanName) == 0 || utf8.RuneCountInString(cleanName) > 30 {
				writeJSONError(w, "invalid pet name", http.StatusBadRequest)
				return
			}
			req.Name = &cleanName
		}
		if req.Stage == nil && req.XP == nil && req.Happiness == nil && req.Name == nil {
			writeJSONError(w, "at least one field to update is required", http.StatusBadRequest)
			return
		}
		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin update pet", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(r.Context())
		var before struct {
			Name      string `json:"name"`
			Stage     string `json:"stage"`
			XP        int    `json:"xp"`
			Happiness int    `json:"happiness"`
			Mood      string `json:"mood"`
		}
		err = tx.QueryRow(r.Context(), `SELECT name,stage,xp,happiness,mood
			FROM gamification.companion_pet WHERE id=$1 FOR UPDATE`, id).
			Scan(&before.Name, &before.Stage, &before.XP, &before.Happiness, &before.Mood)
		if err == pgx.ErrNoRows {
			writeJSONError(w, "pet not found", http.StatusNotFound)
			return
		}
		if err != nil {
			logger.Error("load pet for update", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		setClauses := []string{}
		args := []any{}
		argIdx := 1
		if req.Stage != nil {
			setClauses = append(setClauses, fmt.Sprintf("stage = $%d", argIdx))
			args = append(args, *req.Stage)
			argIdx++
		}
		if req.XP != nil {
			setClauses = append(setClauses, fmt.Sprintf("xp = $%d", argIdx))
			args = append(args, *req.XP)
			argIdx++
		}
		if req.Happiness != nil {
			setClauses = append(setClauses, fmt.Sprintf("happiness = $%d", argIdx))
			args = append(args, *req.Happiness)
			argIdx++
			setClauses = append(setClauses, fmt.Sprintf("mood = $%d", argIdx))
			args = append(args, getMoodFromHappiness(*req.Happiness))
			argIdx++
		}
		if req.Name != nil {
			setClauses = append(setClauses, fmt.Sprintf("name = $%d", argIdx))
			args = append(args, *req.Name)
			argIdx++
		}
		setClauses = append(setClauses, "updated_at = NOW()")
		query := "UPDATE gamification.companion_pet SET " + strings.Join(setClauses, ", ") + fmt.Sprintf(" WHERE id = $%d", argIdx)
		args = append(args, id)
		result, err := tx.Exec(r.Context(), query, args...)
		if err != nil {
			logger.Error("update pet", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if result.RowsAffected() == 0 {
			writeJSONError(w, "pet not found", http.StatusNotFound)
			return
		}
		after := map[string]any{"name": before.Name, "stage": before.Stage, "xp": before.XP, "happiness": before.Happiness, "mood": before.Mood}
		if req.Name != nil {
			after["name"] = *req.Name
		}
		if req.Stage != nil {
			after["stage"] = *req.Stage
		}
		if req.XP != nil {
			after["xp"] = *req.XP
		}
		if req.Happiness != nil {
			after["happiness"] = *req.Happiness
			after["mood"] = getMoodFromHappiness(*req.Happiness)
		}
		if err := writeAdminPetAudit(r.Context(), tx, identity.ActorID, "admin.gamification.pet.updated", id, before, after); err != nil {
			logger.Error("audit pet update", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			logger.Error("commit pet update", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"id": id, "updated": true})
	}
}

// adminPetResetHandler implements POST /api/admin/gamification/pets/{id}/reset.
func adminPetResetHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "pets", 1)
		if !isValidUUID(id) {
			writeJSONError(w, "invalid pet id", http.StatusBadRequest)
			return
		}
		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin reset pet", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(r.Context())
		var before struct {
			Stage         string  `json:"stage"`
			XP            int     `json:"xp"`
			Happiness     int     `json:"happiness"`
			Mood          string  `json:"mood"`
			TotalFeedings int     `json:"totalFeedings"`
			LastFedAt     *string `json:"lastFedAt"`
			EvolvedAt     *string `json:"evolvedAt"`
			CostumeSlug   *string `json:"costumeSlug"`
		}
		err = tx.QueryRow(r.Context(), `SELECT stage,xp,happiness,mood,total_feedings,
			last_fed_at::text,evolved_at::text,costume_slug FROM gamification.companion_pet WHERE id=$1 FOR UPDATE`, id).
			Scan(&before.Stage, &before.XP, &before.Happiness, &before.Mood, &before.TotalFeedings,
				&before.LastFedAt, &before.EvolvedAt, &before.CostumeSlug)
		if err == pgx.ErrNoRows {
			writeJSONError(w, "pet not found", http.StatusNotFound)
			return
		}
		if err != nil {
			logger.Error("load pet for reset", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		result, err := tx.Exec(r.Context(), `UPDATE gamification.companion_pet SET
			stage='egg', xp=0, happiness=100, mood='happy', total_feedings=0,
			last_fed_at=NULL, evolved_at=NULL, costume_slug=NULL, updated_at=NOW()
			WHERE id=$1`, id)
		if err != nil {
			logger.Error("reset pet", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if result.RowsAffected() == 0 {
			writeJSONError(w, "pet not found", http.StatusNotFound)
			return
		}
		after := map[string]any{"stage": "egg", "xp": 0, "happiness": 100, "mood": "happy", "totalFeedings": 0, "lastFedAt": nil, "evolvedAt": nil, "costumeSlug": nil}
		if err := writeAdminPetAudit(r.Context(), tx, identity.ActorID, "admin.gamification.pet.reset", id, before, after); err != nil {
			logger.Error("audit pet reset", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			logger.Error("commit pet reset", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"id": id, "reset": true})
	}
}
