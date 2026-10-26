package httpserver

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
)

// dailyRadarHomeHandler returns published Daily Radar content for anonymous users.
// Old NestJS contract: PUBLIC (@PublicRoute) — GET /api/daily-radar/home?locale=vi
func dailyRadarHomeHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSONError(w, "daily radar is unavailable", http.StatusServiceUnavailable)
			return
		}
		type module struct {
			Category     string  `json:"category"`
			DisclaimerJa *string `json:"disclaimerJa"`
			DisclaimerVi *string `json:"disclaimerVi"`
			ModuleKey    string  `json:"moduleKey"`
			TitleJa      string  `json:"titleJa"`
			TitleVi      string  `json:"titleVi"`
			IsEnabled    bool    `json:"isEnabled,omitempty"`
			VisualTheme  *string `json:"visualTheme,omitempty"`
		}
		type card struct {
			BadgeTextVi            *string         `json:"badgeTextVi"`
			Category               string          `json:"category"`
			CTALabelJa             *string         `json:"ctaLabelJa"`
			CTALabelVi             string          `json:"ctaLabelVi"`
			DescriptionVi          string          `json:"descriptionVi"`
			EstimatedMinutes       *int            `json:"estimatedMinutes"`
			ID                     string          `json:"id"`
			IsPinned               bool            `json:"isPinned"`
			IsSpotlight            bool            `json:"isSpotlight"`
			LevelLabel             *string         `json:"levelLabel"`
			Module                 module          `json:"module"`
			Metadata               json.RawMessage `json:"metadata"`
			ModuleType             string          `json:"moduleType"`
			Priority               int             `json:"priority"`
			RecommendationReasonVi *string         `json:"recommendationReasonVi"`
			Slug                   string          `json:"slug"`
			TargetRoute            *string         `json:"targetRoute"`
			TitleJa                *string         `json:"titleJa"`
			TitleVi                string          `json:"titleVi"`
			VisualTheme            *string         `json:"visualTheme"`
			JapaneseText           *string         `json:"japaneseText,omitempty"`
			ReadingText            *string         `json:"readingText,omitempty"`
			BodyMd                 *string         `json:"bodyMd,omitempty"`
			IconKey                *string         `json:"iconKey,omitempty"`
			TargetEntityID         *string         `json:"targetEntityId,omitempty"`
		}
		modules := make([]module, 0)
		moduleRows, err := db.Query(r.Context(), `SELECT category, disclaimer_ja, disclaimer_vi, module_key,
			title_ja, title_vi, is_enabled, visual_theme
			FROM daily.daily_radar_module_config
			WHERE status='published' AND is_enabled
			ORDER BY default_priority DESC, module_key ASC`)
		if err != nil {
			logger.Error("list published Daily Radar modules", "error", err)
			writeJSONError(w, "daily radar is unavailable", http.StatusInternalServerError)
			return
		}
		for moduleRows.Next() {
			var item module
			if err := moduleRows.Scan(&item.Category, &item.DisclaimerJa, &item.DisclaimerVi, &item.ModuleKey,
				&item.TitleJa, &item.TitleVi, &item.IsEnabled, &item.VisualTheme); err != nil {
				moduleRows.Close()
				logger.Error("scan published Daily Radar module", "error", err)
				writeJSONError(w, "daily radar is unavailable", http.StatusInternalServerError)
				return
			}
			modules = append(modules, item)
		}
		if err := moduleRows.Err(); err != nil {
			moduleRows.Close()
			logger.Error("iterate published Daily Radar modules", "error", err)
			writeJSONError(w, "daily radar is unavailable", http.StatusInternalServerError)
			return
		}
		moduleRows.Close()

		cards := make([]card, 0)
		rows, err := db.Query(r.Context(), `SELECT c.id::text, c.badge_text_vi, c.category, c.cta_label_ja, c.cta_label_vi,
			c.description_vi, c.estimated_minutes, c.is_pinned, c.is_spotlight, c.level_label,
			m.category, m.disclaimer_ja, m.disclaimer_vi, m.module_key, m.title_ja, m.title_vi,
			m.is_enabled, m.visual_theme, c.metadata, c.module_type, c.priority, c.recommendation_reason_vi,
			c.slug, c.target_route, c.title_ja, c.title_vi, c.visual_theme, d.japanese_text, d.reading_text,
			d.body_md, c.icon_key, c.target_entity_id
			FROM daily.daily_radar_card c
			JOIN daily.daily_radar_module_config m ON m.id=c.module_config_id
			LEFT JOIN daily.daily_content_item d ON c.module_type='daily_widget'
				AND d.id::text=c.target_entity_id AND d.status='published'
				AND d.locale=$1
			WHERE c.status='published' AND m.status='published' AND m.is_enabled
				AND (c.starts_at IS NULL OR c.starts_at<=NOW())
				AND (c.ends_at IS NULL OR c.ends_at>=NOW())
			ORDER BY c.is_pinned DESC, c.priority DESC, c.updated_at DESC, c.id ASC`, r.URL.Query().Get("locale"))
		if err != nil {
			logger.Error("list published Daily Radar cards", "error", err)
			writeJSONError(w, "daily radar is unavailable", http.StatusInternalServerError)
			return
		}
		categories := make([]string, 0)
		seenCategories := make(map[string]struct{})
		seenCards := make(map[[3]string]struct{})
		for rows.Next() {
			var item card
			if err := rows.Scan(&item.ID, &item.BadgeTextVi, &item.Category, &item.CTALabelJa, &item.CTALabelVi,
				&item.DescriptionVi, &item.EstimatedMinutes, &item.IsPinned, &item.IsSpotlight, &item.LevelLabel,
				&item.Module.Category, &item.Module.DisclaimerJa, &item.Module.DisclaimerVi, &item.Module.ModuleKey,
				&item.Module.TitleJa, &item.Module.TitleVi, &item.Module.IsEnabled, &item.Module.VisualTheme,
				&item.Metadata, &item.ModuleType, &item.Priority, &item.RecommendationReasonVi, &item.Slug,
				&item.TargetRoute, &item.TitleJa, &item.TitleVi, &item.VisualTheme, &item.JapaneseText,
				&item.ReadingText, &item.BodyMd, &item.IconKey, &item.TargetEntityID); err != nil {
				rows.Close()
				logger.Error("scan published Daily Radar card", "error", err)
				writeJSONError(w, "daily radar is unavailable", http.StatusInternalServerError)
				return
			}
			key := dailyRadarContentKey(item.Module.ModuleKey, item.TitleVi, item.TargetRoute)
			if _, exists := seenCards[key]; exists {
				continue
			}
			seenCards[key] = struct{}{}
			cards = append(cards, item)
			if _, exists := seenCategories[item.Category]; !exists {
				seenCategories[item.Category] = struct{}{}
				categories = append(categories, item.Category)
			}
		}
		if err := rows.Err(); err != nil {
			rows.Close()
			logger.Error("iterate published Daily Radar cards", "error", err)
			writeJSONError(w, "daily radar is unavailable", http.StatusInternalServerError)
			return
		}
		rows.Close()
		var spotlight *card
		for i := range cards {
			if cards[i].IsSpotlight {
				spotlight = &cards[i]
				break
			}
		}
		writeJSON(w, http.StatusOK, map[string]any{"modules": modules, "cards": cards, "categories": categories, "spotlight": spotlight})
	}
}

// dailyHomeHandler returns a public daily hub payload and personalizes due reviews for signed-in learners.
// Old NestJS contract: OPTIONAL_AUTH (@KeycloakAuthOptional) — GET /api/daily/home?locale=vi&timeZone=...
// Anonymous users receive public content only; no personalization.
// The frontend TodayPlanHub expects { today, dueReviews, greeting } and calls
// today.split("-"), so we must return a valid ISO date string to avoid hydration crashes.
func dailyHomeHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		dueReviews := 0
		if identity, ok := authn.GetLearnerIdentity(r.Context()); ok {
			if db == nil {
				writeJSONError(w, "daily home is unavailable", http.StatusServiceUnavailable)
				return
			}
			err := db.QueryRow(r.Context(), `SELECT COUNT(*)
				FROM learning.user_flashcard uf
				JOIN learning.flashcard_variant fv ON fv.id = uf.card_id
				WHERE uf.user_id = $1 AND uf.due_at <= NOW() AND fv.status = 'active'
				  AND EXISTS (
					SELECT 1 FROM learning.deck_card dc
					JOIN learning.deck d ON d.id = dc.deck_id
					WHERE dc.card_id = uf.card_id AND d.status = 'active'
					  AND (d.owner_user_id = $1 OR d.visibility = 'public')
				  )`, identity.UserID).Scan(&dueReviews)
			if err != nil {
				logger.Error("count daily home due reviews", "error", err, "user_id", identity.UserID)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
		}
		zone := r.URL.Query().Get("timeZone")
		if zone == "" {
			zone = "Asia/Tokyo"
		}
		location, err := time.LoadLocation(zone)
		if err != nil {
			writeJSONError(w, "invalid time zone", http.StatusBadRequest)
			return
		}
		now := time.Now().In(location)
		japanese := "こんばんは"
		var reading *string
		if now.Hour() >= 5 && now.Hour() < 11 {
			japanese = "おはようございます"
		} else if now.Hour() >= 11 && now.Hour() < 18 {
			japanese = "お疲れさまです"
			kana := "おつかれさまです"
			reading = &kana
		}
		today := now.Format("2006-01-02")
		resp := map[string]any{
			"today":       today,
			"dueReviews":  dueReviews,
			"greeting":    map[string]any{"japanese": japanese, "reading": reading},
			"widgets":     []struct{}{},
			"items":       []struct{}{},
			"weeklyStats": nil,
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		if err := json.NewEncoder(w).Encode(resp); err != nil {
			logger.Error("failed to encode daily/home response", "error", err)
		}
	}
}

// announcementsListHandler returns active public announcements for the learner strip.
func announcementsListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			writeJSONError(w, "announcements are unavailable", http.StatusServiceUnavailable)
			return
		}
		const query = `SELECT id, type, format, message, href, title_vi, title_en, title_ja,
			body_vi, body_en, body_ja, cta_label, cta_url, image_url, effect, bg_preset,
			allow_close_button, allow_click_outside, dismiss_delay, show_frequency
			FROM content.announcement
			WHERE active AND target IN ('all', 'free_only')
				AND (starts_at IS NULL OR starts_at <= NOW())
				AND (ends_at IS NULL OR ends_at >= NOW())
			ORDER BY priority DESC, sort_order ASC, created_at DESC, id ASC`
		rows, err := db.Query(r.Context(), query)
		if err != nil {
			logger.Error("list active announcements", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type announcement struct {
			ID                string  `json:"id"`
			Type              string  `json:"type"`
			Format            string  `json:"format"`
			Message           string  `json:"message"`
			Href              *string `json:"href"`
			TitleVi           *string `json:"titleVi"`
			TitleEn           *string `json:"titleEn"`
			TitleJa           *string `json:"titleJa"`
			BodyVi            *string `json:"bodyVi"`
			BodyEn            *string `json:"bodyEn"`
			BodyJa            *string `json:"bodyJa"`
			CTALabel          *string `json:"ctaLabel"`
			CTAURL            *string `json:"ctaUrl"`
			ImageURL          *string `json:"imageUrl"`
			Effect            string  `json:"effect"`
			BgPreset          string  `json:"bgPreset"`
			AllowCloseButton  bool    `json:"allowCloseButton"`
			AllowClickOutside bool    `json:"allowClickOutside"`
			DismissDelay      int     `json:"dismissDelay"`
			ShowFrequency     string  `json:"showFrequency"`
		}
		announcements := make([]announcement, 0)
		for rows.Next() {
			var item announcement
			if err := rows.Scan(&item.ID, &item.Type, &item.Format, &item.Message, &item.Href,
				&item.TitleVi, &item.TitleEn, &item.TitleJa, &item.BodyVi, &item.BodyEn,
				&item.BodyJa, &item.CTALabel, &item.CTAURL, &item.ImageURL, &item.Effect,
				&item.BgPreset, &item.AllowCloseButton, &item.AllowClickOutside,
				&item.DismissDelay, &item.ShowFrequency); err != nil {
				logger.Error("scan active announcement", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			announcements = append(announcements, item)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate active announcements", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(announcements); err != nil {
			logger.Error("encode announcements response", "error", err)
		}
	}
}

// adsDecisionHandler selects an active, policy-approved campaign for an active placement.
// Public viewers only receive campaigns that are not restricted to a learner plan.
func adsDecisionHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			PlacementCode string `json:"placementCode"`
			Locale        string `json:"locale"`
		}
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		req.PlacementCode = strings.TrimSpace(req.PlacementCode)
		req.Locale = strings.TrimSpace(req.Locale)
		if req.PlacementCode == "" || len(req.PlacementCode) > 64 || len(req.Locale) > 16 {
			writeJSONError(w, "valid placementCode and locale are required", http.StatusBadRequest)
			return
		}
		if db == nil {
			writeJSONError(w, "ad decisions are unavailable", http.StatusServiceUnavailable)
			return
		}
		var placementID string
		if err := db.QueryRow(r.Context(), `SELECT id FROM monetization.ad_placement WHERE code=$1 AND active`, req.PlacementCode).Scan(&placementID); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				writeJSONError(w, "active ad placement not found", http.StatusNotFound)
				return
			}
			logger.Error("resolve ad placement", "error", err)
			writeJSONError(w, "ad decisions are unavailable", http.StatusInternalServerError)
			return
		}

		type campaign struct {
			ID             string `json:"id"`
			Name           string `json:"name"`
			CreativeType   string `json:"creativeType"`
			DestinationURL string `json:"destinationUrl"`
		}
		var selected campaign
		var providerType string
		err := db.QueryRow(r.Context(), `SELECT c.id, c.name, c.creative_type, c.destination_url, provider.type
			FROM monetization.ad_campaign c
			JOIN monetization.ad_provider_config provider ON provider.key=c.provider_key AND provider.enabled
			WHERE c.status='active' AND c.policy_status='ok'
			AND c.placement_codes @> jsonb_build_array($1::text)
			AND (c.start_at IS NULL OR c.start_at <= NOW())
			AND (c.end_at IS NULL OR c.end_at >= NOW())
			AND (c.target_locale IS NULL OR c.target_locale=$2)
			AND c.target_plan_slug IS NULL
			AND c.creative_type <> 'placeholder' AND c.destination_url IS NOT NULL AND c.destination_url <> ''
			AND (c.destination_url LIKE 'https://%' OR c.destination_url LIKE 'http://%')
			AND (c.max_impressions IS NULL OR (
				SELECT count(*) FROM monetization.ad_impression event
				WHERE event.campaign_id=c.id AND event.kind NOT IN ('click','dismiss','blocked')
			) < c.max_impressions)
			ORDER BY c.priority DESC, c.created_at ASC, c.id ASC LIMIT 1`, req.PlacementCode, req.Locale).
			Scan(&selected.ID, &selected.Name, &selected.CreativeType, &selected.DestinationURL, &providerType)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			logger.Error("select ad campaign", "error", err, "placement_code", req.PlacementCode)
			writeJSONError(w, "ad decisions are unavailable", http.StatusInternalServerError)
			return
		}

		keyBytes := make([]byte, 24)
		if _, err := rand.Read(keyBytes); err != nil {
			logger.Error("generate ad decision key", "error", err)
			writeJSONError(w, "ad decisions are unavailable", http.StatusInternalServerError)
			return
		}
		decisionKey := "local:" + hex.EncodeToString(keyBytes[:12])
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSON(w, http.StatusOK, map[string]any{
				"eligible": false, "decisionKey": decisionKey, "reason": "no_eligible_campaign",
			})
			return
		}
		destination, parseErr := url.Parse(selected.DestinationURL)
		if parseErr != nil || (destination.Scheme != "http" && destination.Scheme != "https") || destination.Host == "" {
			logger.Error("invalid ad destination URL", "campaign_id", selected.ID)
			writeJSONError(w, "ad decisions are unavailable", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"eligible":      true,
			"campaignId":    selected.ID,
			"decisionKey":   decisionKey,
			"decisionToken": hex.EncodeToString(keyBytes[12:]),
			"payload": map[string]any{
				"campaign":     selected,
				"providerType": providerType,
			},
		})
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
func adsImpressionHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req adsImpressionRequest
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		req.PlacementCode = strings.TrimSpace(req.PlacementCode)
		if req.PlacementCode == "" || len(req.PlacementCode) > 64 {
			writeJSONError(w, "placementCode is required", http.StatusBadRequest)
			return
		}
		if req.DecisionKey != nil && len(*req.DecisionKey) > 120 {
			writeJSONError(w, "decisionKey is too long", http.StatusBadRequest)
			return
		}
		if db == nil {
			writeJSONError(w, "ad tracking is unavailable", http.StatusServiceUnavailable)
			return
		}

		var placementID string
		if err := db.QueryRow(r.Context(), `SELECT id FROM monetization.ad_placement WHERE code=$1 AND active`, req.PlacementCode).Scan(&placementID); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				writeJSONError(w, "active ad placement not found", http.StatusNotFound)
				return
			}
			logger.Error("failed to resolve ad placement", "error", err)
			writeJSONError(w, "ad tracking is unavailable", http.StatusInternalServerError)
			return
		}

		if req.CampaignID != nil {
			var campaignExists bool
			if err := db.QueryRow(r.Context(), `SELECT EXISTS (
				SELECT 1 FROM monetization.ad_campaign WHERE id=$1::uuid AND placement_codes ? $2
			)`, *req.CampaignID, req.PlacementCode).Scan(&campaignExists); err != nil {
				writeJSONError(w, "invalid campaignId", http.StatusBadRequest)
				return
			}
			if !campaignExists {
				writeJSONError(w, "campaign does not belong to placement", http.StatusBadRequest)
				return
			}
		}

		// Extract optional user ID from session
		var userID *string
		if identity, ok := authn.GetLearnerIdentity(r.Context()); ok {
			userID = &identity.UserID
		}

		var clientContext []byte
		if req.ClientContext != nil {
			var err error
			clientContext, err = json.Marshal(req.ClientContext)
			if err != nil {
				writeJSONError(w, "invalid clientContext", http.StatusBadRequest)
				return
			}
		}
		var campaignID any
		if req.CampaignID != nil {
			campaignID = *req.CampaignID
		}
		var decisionKey any
		if req.DecisionKey != nil {
			decisionKey = *req.DecisionKey
		}
		if _, err := db.Exec(r.Context(), `INSERT INTO monetization.ad_impression
			(user_id, placement_id, campaign_id, kind, decision_key, client_context)
			VALUES ($1, $2, $3, 'impression', $4, $5)`, userID, placementID, campaignID, decisionKey, clientContext); err != nil {
			logger.Error("failed to persist ad impression", "error", err, "placement_code", req.PlacementCode)
			writeJSONError(w, "failed to record ad impression", http.StatusInternalServerError)
			return
		}

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
func adsClickHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req adsClickRequest
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		req.PlacementCode = strings.TrimSpace(req.PlacementCode)
		if req.PlacementCode == "" || len(req.PlacementCode) > 64 {
			writeJSONError(w, "placementCode is required", http.StatusBadRequest)
			return
		}
		if req.DecisionKey != nil && len(*req.DecisionKey) > 120 {
			writeJSONError(w, "decisionKey is too long", http.StatusBadRequest)
			return
		}
		if db == nil {
			writeJSONError(w, "ad tracking is unavailable", http.StatusServiceUnavailable)
			return
		}

		var placementID string
		if err := db.QueryRow(r.Context(), `SELECT id FROM monetization.ad_placement WHERE code=$1 AND active`, req.PlacementCode).Scan(&placementID); err != nil {
			if err == pgx.ErrNoRows {
				writeJSONError(w, "active ad placement not found", http.StatusNotFound)
				return
			}
			logger.Error("failed to resolve ad placement", "error", err)
			writeJSONError(w, "ad tracking is unavailable", http.StatusInternalServerError)
			return
		}

		if req.CampaignID != nil {
			var campaignExists bool
			if err := db.QueryRow(r.Context(), `SELECT EXISTS (
				SELECT 1 FROM monetization.ad_campaign WHERE id=$1::uuid AND placement_codes ? $2
			)`, *req.CampaignID, req.PlacementCode).Scan(&campaignExists); err != nil {
				writeJSONError(w, "invalid campaignId", http.StatusBadRequest)
				return
			}
			if !campaignExists {
				writeJSONError(w, "campaign does not belong to placement", http.StatusBadRequest)
				return
			}
		}

		// Extract optional user ID from session
		var userID *string
		if identity, ok := authn.GetLearnerIdentity(r.Context()); ok {
			userID = &identity.UserID
		}

		var clientContext []byte
		if req.ClientContext != nil {
			var err error
			clientContext, err = json.Marshal(req.ClientContext)
			if err != nil {
				writeJSONError(w, "invalid clientContext", http.StatusBadRequest)
				return
			}
		}
		var campaignID any
		if req.CampaignID != nil {
			campaignID = *req.CampaignID
		}
		var decisionKey any
		if req.DecisionKey != nil {
			decisionKey = *req.DecisionKey
		}
		_, err := db.Exec(r.Context(), `INSERT INTO monetization.ad_impression
			(user_id, placement_id, campaign_id, kind, decision_key, client_context)
			VALUES ($1, $2, $3, 'click', $4, $5)`, userID, placementID, campaignID, decisionKey, clientContext)
		if err != nil {
			logger.Error("failed to persist ad click", "error", err, "placement_code", req.PlacementCode)
			writeJSONError(w, "failed to record ad click", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}
