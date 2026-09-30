package httpserver

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
)

// listDailyRadarModulesHandler implements GET /api/daily-radar/modules.
// Public route — no authentication required.
func listDailyRadarModulesHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		const q = `SELECT id, key, title, description, icon, sort_order, status
FROM content.daily_radar_module
WHERE status = 'published'
ORDER BY sort_order ASC, created_at ASC`
		rows, err := db.Query(r.Context(), q)
		if err != nil {
			logger.Error("list daily radar modules", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type Module struct {
			ID          string  `json:"id"`
			Key         string  `json:"key"`
			Title       string  `json:"title"`
			Description *string `json:"description,omitempty"`
			Icon        *string `json:"icon,omitempty"`
			SortOrder   int     `json:"sortOrder"`
			Status      string  `json:"status"`
		}
		var modules []Module
		for rows.Next() {
			var m Module
			if err := rows.Scan(&m.ID, &m.Key, &m.Title, &m.Description, &m.Icon, &m.SortOrder, &m.Status); err != nil {
				logger.Error("scan daily radar module", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			modules = append(modules, m)
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

		type Card struct {
			ID          string  `json:"id"`
			Slug        string  `json:"slug"`
			Title       string  `json:"title"`
			Summary     *string `json:"summary,omitempty"`
			Category    string  `json:"category"`
			ModuleKey   *string `json:"moduleKey,omitempty"`
			ImageURL    *string `json:"imageUrl,omitempty"`
			PublishedAt *string `json:"publishedAt,omitempty"`
		}

		var q string
		var args []interface{}
		if moduleKey != "" {
			q = `SELECT id, slug, title, summary, category, module_key, image_url, published_at
FROM content.daily_radar_card
WHERE status = 'published' AND module_key = $1
ORDER BY published_at DESC LIMIT $2`
			args = []interface{}{moduleKey, limit}
		} else if category != "" {
			q = `SELECT id, slug, title, summary, category, module_key, image_url, published_at
FROM content.daily_radar_card
WHERE status = 'published' AND category = $1
ORDER BY published_at DESC LIMIT $2`
			args = []interface{}{category, limit}
		} else {
			q = `SELECT id, slug, title, summary, category, module_key, image_url, published_at
FROM content.daily_radar_card
WHERE status = 'published'
ORDER BY published_at DESC LIMIT $1`
			args = []interface{}{limit}
		}

		rows, err := db.Query(r.Context(), q, args...)
		if err != nil {
			logger.Error("list daily radar cards", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		var cards []Card
		for rows.Next() {
			var c Card
			if err := rows.Scan(&c.ID, &c.Slug, &c.Title, &c.Summary, &c.Category, &c.ModuleKey, &c.ImageURL, &c.PublishedAt); err != nil {
				logger.Error("scan daily radar card", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			cards = append(cards, c)
		}
		if cards == nil {
			cards = []Card{}
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

		type Card struct {
			ID          string  `json:"id"`
			Slug        string  `json:"slug"`
			Title       string  `json:"title"`
			Summary     *string `json:"summary,omitempty"`
			Body        *string `json:"body,omitempty"`
			Category    string  `json:"category"`
			ModuleKey   *string `json:"moduleKey,omitempty"`
			ImageURL    *string `json:"imageUrl,omitempty"`
			PublishedAt *string `json:"publishedAt,omitempty"`
		}

		const q = `SELECT id, slug, title, summary, body, category, module_key, image_url, published_at
FROM content.daily_radar_card
WHERE slug = $1 AND status = 'published'`
		var c Card
		err := db.QueryRow(r.Context(), q, slug).Scan(&c.ID, &c.Slug, &c.Title, &c.Summary, &c.Body, &c.Category, &c.ModuleKey, &c.ImageURL, &c.PublishedAt)
		if err != nil {
			writeJSONError(w, "card not found", http.StatusNotFound)
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

		// Persist dismissal for authenticated user
		const insertQ = `INSERT INTO content.announcement_dismissal (announcement_id, user_id, dismissed_at)
VALUES ($1, $2, NOW())
ON CONFLICT (announcement_id, user_id) DO NOTHING`
		if _, err := db.Exec(r.Context(), insertQ, annID, userID); err != nil {
			logger.Error("dismiss announcement", "error", err, "announcement_id", annID, "user_id", userID)
			// Non-fatal: still return dismissed=true
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]bool{"dismissed": true, "persisted": true})
	}
}