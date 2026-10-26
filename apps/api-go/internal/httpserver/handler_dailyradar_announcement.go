package httpserver

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
)

type publicDailyRadarModule struct {
	DisclaimerVi *string `json:"disclaimerVi,omitempty"`
	ModuleKey    string  `json:"moduleKey"`
	TitleJa      string  `json:"titleJa"`
	TitleVi      string  `json:"titleVi"`
}

type publicDailyRadarCard struct {
	ID                     string                 `json:"id"`
	Slug                   string                 `json:"slug"`
	TitleVi                string                 `json:"titleVi"`
	TitleJa                *string                `json:"titleJa"`
	DescriptionVi          string                 `json:"descriptionVi"`
	Category               string                 `json:"category"`
	Module                 publicDailyRadarModule `json:"module"`
	ImageURL               *string                `json:"imageUrl,omitempty"`
	PublishedAt            time.Time              `json:"publishedAt"`
	BadgeTextVi            *string                `json:"badgeTextVi"`
	CTALabelVi             string                 `json:"ctaLabelVi"`
	EstimatedMinutes       *int                   `json:"estimatedMinutes"`
	LevelLabel             *string                `json:"levelLabel"`
	Metadata               json.RawMessage        `json:"metadata"`
	ModuleType             string                 `json:"moduleType"`
	RecommendationReasonVi *string                `json:"recommendationReasonVi"`
	TargetRoute            *string                `json:"targetRoute"`
	VisualTheme            *string                `json:"visualTheme"`
	Title                  string                 `json:"title,omitempty"`
	Summary                *string                `json:"summary,omitempty"`
	Body                   *string                `json:"body,omitempty"`
	ModuleKey              string                 `json:"moduleKey,omitempty"`
}

// dailyRadarContentKey ignores import IDs/slugs but preserves different destinations.
func dailyRadarContentKey(moduleKey, title string, targetRoute *string) [3]string {
	key := [3]string{moduleKey, strings.Join(strings.Fields(title), " "), ""}
	if targetRoute != nil {
		key[2] = strings.TrimSpace(*targetRoute)
	}
	return key
}

// listDailyRadarModulesHandler implements GET /api/daily-radar/modules.
// Public route — no authentication required.
func listDailyRadarModulesHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		const q = `SELECT module_key, title_vi, description_vi, disclaimer_vi, route_path, metadata
FROM daily.daily_radar_module_config
WHERE status = 'published' AND is_enabled = true
ORDER BY default_priority DESC, created_at ASC`
		rows, err := db.Query(r.Context(), q)
		if err != nil {
			logger.Error("list daily radar modules", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type Module struct {
			ModuleKey    string          `json:"moduleKey"`
			TitleVi      string          `json:"titleVi"`
			Description  string          `json:"descriptionVi"`
			DisclaimerVi *string         `json:"disclaimerVi"`
			RoutePath    *string         `json:"routePath"`
			Metadata     json.RawMessage `json:"metadata"`
		}
		var modules []Module
		for rows.Next() {
			var m Module
			if err := rows.Scan(&m.ModuleKey, &m.TitleVi, &m.Description, &m.DisclaimerVi, &m.RoutePath, &m.Metadata); err != nil {
				logger.Error("scan daily radar module", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			modules = append(modules, m)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate daily radar modules", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if modules == nil {
			modules = []Module{}
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(modules)
	}
}

// listDailyRadarCardsHandler implements GET /api/daily-radar/cards.
// Public route — supports moduleKey, category, limit query params.
func listDailyRadarCardsHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		moduleKey := r.URL.Query().Get("moduleKey")
		category := r.URL.Query().Get("category")
		limit := 48
		if rawLimit := r.URL.Query().Get("limit"); rawLimit != "" {
			if parsedLimit, err := strconv.Atoi(rawLimit); err == nil && parsedLimit > 0 && parsedLimit <= 100 {
				limit = parsedLimit
			}
		}
		var q string
		var args []interface{}
		if moduleKey != "" {
			q = `SELECT c.id, c.slug, c.title_vi, c.title_ja, c.description_vi, c.metadata->>'body',
	c.category, m.module_key, c.image_url, c.created_at, c.badge_text_vi, c.cta_label_vi, c.estimated_minutes,
	c.level_label, c.metadata, c.module_type, c.recommendation_reason_vi, c.target_route, c.visual_theme,
	m.title_vi, m.title_ja, m.disclaimer_vi
FROM daily.daily_radar_card c
JOIN daily.daily_radar_module_config m ON m.id = c.module_config_id`
			args = []interface{}{moduleKey, limit}
		} else if category != "" {
			q = `SELECT c.id, c.slug, c.title_vi, c.title_ja, c.description_vi, c.metadata->>'body',
	c.category, m.module_key, c.image_url, c.created_at, c.badge_text_vi, c.cta_label_vi, c.estimated_minutes,
	c.level_label, c.metadata, c.module_type, c.recommendation_reason_vi, c.target_route, c.visual_theme,
	m.title_vi, m.title_ja, m.disclaimer_vi
FROM daily.daily_radar_card c
JOIN daily.daily_radar_module_config m ON m.id = c.module_config_id`
			args = []interface{}{category, limit}
			q += ` WHERE c.status = 'published' AND m.status = 'published' AND m.is_enabled AND c.category = $1
ORDER BY c.priority DESC, c.updated_at DESC LIMIT $2`
		} else {
			q = `SELECT c.id, c.slug, c.title_vi, c.title_ja, c.description_vi, c.metadata->>'body',
	c.category, m.module_key, c.image_url, c.created_at, c.badge_text_vi, c.cta_label_vi, c.estimated_minutes,
	c.level_label, c.metadata, c.module_type, c.recommendation_reason_vi, c.target_route, c.visual_theme,
	m.title_vi, m.title_ja, m.disclaimer_vi
FROM daily.daily_radar_card c
JOIN daily.daily_radar_module_config m ON m.id = c.module_config_id`
			args = []interface{}{limit}
			q += ` WHERE c.status = 'published' AND m.status = 'published' AND m.is_enabled
ORDER BY c.is_pinned DESC, c.priority DESC, c.updated_at DESC LIMIT $1`
		}
		if moduleKey != "" {
			q += ` WHERE c.status = 'published' AND m.status = 'published' AND m.is_enabled AND m.module_key = $1
ORDER BY c.priority DESC, c.updated_at DESC LIMIT $2`
		}

		rows, err := db.Query(r.Context(), q, args...)
		if err != nil {
			logger.Error("list daily radar cards", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		var cards []publicDailyRadarCard
		seenCards := make(map[[3]string]struct{})
		for rows.Next() {
			var c publicDailyRadarCard
			if err := rows.Scan(&c.ID, &c.Slug, &c.TitleVi, &c.TitleJa, &c.DescriptionVi, &c.Body, &c.Category,
				&c.Module.ModuleKey, &c.ImageURL, &c.PublishedAt, &c.BadgeTextVi, &c.CTALabelVi, &c.EstimatedMinutes,
				&c.LevelLabel, &c.Metadata, &c.ModuleType, &c.RecommendationReasonVi, &c.TargetRoute, &c.VisualTheme,
				&c.Module.TitleVi, &c.Module.TitleJa, &c.Module.DisclaimerVi); err != nil {
				logger.Error("scan daily radar card", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			key := dailyRadarContentKey(c.Module.ModuleKey, c.TitleVi, c.TargetRoute)
			if _, exists := seenCards[key]; exists {
				continue
			}
			seenCards[key] = struct{}{}
			c.Title = c.TitleVi
			c.Summary = &c.DescriptionVi
			c.ModuleKey = c.Module.ModuleKey
			cards = append(cards, c)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate daily radar cards", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if cards == nil {
			cards = []publicDailyRadarCard{}
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(cards)
	}
}

// getDailyRadarCardBySlugHandler implements GET /api/daily-radar/cards/{slug}.
// Public route — returns full card content by slug.
func getDailyRadarCardBySlugHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Extract slug from path: .../cards/{slug}
		parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		var slug string
		for i, p := range parts {
			if p == "cards" && i+1 < len(parts) {
				slug = parts[i+1]
				break
			}
		}
		if slug == "" {
			writeJSONError(w, "slug required", http.StatusBadRequest)
			return
		}

		const q = `SELECT c.id, c.slug, c.title_vi, c.title_ja, c.description_vi, c.metadata->>'body',
	c.category, m.module_key, c.image_url, c.created_at, c.badge_text_vi, c.cta_label_vi, c.estimated_minutes,
	c.level_label, c.metadata, c.module_type, c.recommendation_reason_vi, c.target_route, c.visual_theme,
	m.title_vi, m.title_ja, m.disclaimer_vi
FROM daily.daily_radar_card c
JOIN daily.daily_radar_module_config m ON m.id = c.module_config_id
WHERE c.slug = $1 AND c.status = 'published' AND m.status = 'published' AND m.is_enabled`
		var c publicDailyRadarCard
		err := db.QueryRow(r.Context(), q, slug).Scan(&c.ID, &c.Slug, &c.TitleVi, &c.TitleJa, &c.DescriptionVi, &c.Body,
			&c.Category, &c.Module.ModuleKey, &c.ImageURL, &c.PublishedAt, &c.BadgeTextVi, &c.CTALabelVi, &c.EstimatedMinutes,
			&c.LevelLabel, &c.Metadata, &c.ModuleType, &c.RecommendationReasonVi, &c.TargetRoute, &c.VisualTheme,
			&c.Module.TitleVi, &c.Module.TitleJa, &c.Module.DisclaimerVi)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "card not found", http.StatusNotFound)
			return
		}
		c.Title = c.TitleVi
		c.Summary = &c.DescriptionVi
		c.ModuleKey = c.Module.ModuleKey
		if err != nil {
			logger.Error("get daily radar card", "error", err, "slug", slug)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(c)
	}
}

// dismissAnnouncementHandler implements POST /api/announcements/{id}/dismiss.
// Records dismissal for authenticated users; guests rely on localStorage.
func dismissAnnouncementHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Extract id from path: .../announcements/{id}/dismiss
		parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		var annID string
		for i, p := range parts {
			if p == "announcements" && i+1 < len(parts) {
				annID = parts[i+1]
				break
			}
		}
		if annID == "" {
			writeJSONError(w, "announcement id required", http.StatusBadRequest)
			return
		}

		// Check if user is authenticated (optional for this endpoint)
		userID := ""
		if identity, ok := authn.GetLearnerIdentity(r.Context()); ok {
			userID = identity.UserID
		}

		if userID == "" {
			// Guest — client handles via localStorage
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_ = json.NewEncoder(w).Encode(map[string]bool{"dismissed": true, "persisted": false})
			return
		}
		if db == nil {
			writeJSONError(w, "announcement dismissal is unavailable", http.StatusServiceUnavailable)
			return
		}

		// Persist dismissal for authenticated user
		const insertQ = `INSERT INTO content.announcement_dismissal (announcement_id, user_id, dismissed_at)
VALUES ($1, $2, NOW())
ON CONFLICT (announcement_id, user_id) DO NOTHING`
		if _, err := db.Exec(r.Context(), insertQ, annID, userID); err != nil {
			logger.Error("dismiss announcement", "error", err, "announcement_id", annID, "user_id", userID)
			writeJSONError(w, "announcement dismissal is unavailable", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]bool{"dismissed": true, "persisted": true})
	}
}
