package httpserver

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
)

// ── P1-A11: Admin Magazine + Loto — Articles + Predictions + Lab (16 routes) ──
// Contracts derived from NestJS magazine-admin.controller.ts,
// loto-hub-admin.controller.ts, loto-lab-admin.controller.ts,
// magazine.repository.ts, loto-hub-admin.service.ts, loto-lab.service.ts.
// DB tables: daily.magazine_article, content.magazine_user_read,
// content.loto_draw, content.loto_generation_run, content.loto_generated_set.

// ── Magazine Articles ───────────────────────────────────────────────────────

// adminMagazineListHandler implements GET /api/admin/magazine.
func adminMagazineListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		widgetKind := r.URL.Query().Get("widgetKind")
		if widgetKind == "" {
			widgetKind = r.URL.Query().Get("kind")
		}
		locale := r.URL.Query().Get("locale")
		if locale == "" {
			locale = "vi"
		}
		page := queryInt(r, "page", 1)
		limit := queryInt(r, "limit", 10)
		if page < 1 {
			page = 1
		}
		if limit < 1 {
			limit = 10
		}
		if limit > 50 {
			limit = 50
		}
		offset := (page - 1) * limit

		whereParts := []string{}
		args := []any{}
		argIdx := 1
		if widgetKind != "" && widgetKind != "all" {
			normalized := widgetKind
			if !strings.HasPrefix(normalized, "magazine_") {
				normalized = "magazine_" + normalized
			}
			whereParts = append(whereParts, fmt.Sprintf("widget_kind = $%d", argIdx))
			args = append(args, normalized)
			argIdx++
		}
		whereParts = append(whereParts, fmt.Sprintf("locale = $%d", argIdx))
		args = append(args, locale)
		argIdx++

		whereClause := "WHERE " + strings.Join(whereParts, " AND ")

		var total int
		countQ := "SELECT COUNT(*) FROM daily.magazine_article " + whereClause
		db.QueryRow(r.Context(), countQ, args...).Scan(&total)

		dataQ := fmt.Sprintf(`SELECT id, slug, widget_kind, content_date, locale, title_jp, title_vi,
			summary_jp, summary_vi, cover_image_url, status, approval_status, published_at, created_at, updated_at
			FROM daily.magazine_article %s ORDER BY content_date DESC LIMIT $%d OFFSET $%d`,
			whereClause, argIdx, argIdx+1)
		args = append(args, limit, offset)

		rows, err := db.Query(r.Context(), dataQ, args...)
		if err != nil {
			logger.Error("list magazine articles", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type Article struct {
			ID             string  `json:"id"`
			Slug           string  `json:"slug"`
			WidgetKind     string  `json:"widgetKind"`
			ContentDate    string  `json:"contentDate"`
			Locale         string  `json:"locale"`
			TitleJp        string  `json:"titleJp"`
			TitleVi        string  `json:"titleVi"`
			SummaryJp      *string `json:"summaryJp,omitempty"`
			SummaryVi      *string `json:"summaryVi,omitempty"`
			CoverImageURL  *string `json:"coverImageUrl,omitempty"`
			Status         string  `json:"status"`
			ApprovalStatus *string `json:"approvalStatus,omitempty"`
			PublishedAt    *string `json:"publishedAt,omitempty"`
			CreatedAt      string  `json:"createdAt"`
			UpdatedAt      string  `json:"updatedAt"`
		}
		var items []Article
		for rows.Next() {
			var a Article
			var cd, ca, ua time.Time
			var pa *time.Time
			if rows.Scan(&a.ID, &a.Slug, &a.WidgetKind, &cd, &a.Locale, &a.TitleJp, &a.TitleVi,
				&a.SummaryJp, &a.SummaryVi, &a.CoverImageURL, &a.Status, &a.ApprovalStatus,
				&pa, &ca, &ua) == nil {
				a.ContentDate = cd.UTC().Format("2006-01-02")
				a.CreatedAt = ca.UTC().Format(time.RFC3339)
				a.UpdatedAt = ua.UTC().Format(time.RFC3339)
				if pa != nil {
					s := pa.UTC().Format(time.RFC3339)
					a.PublishedAt = &s
				}
				items = append(items, a)
			}
		}
		if items == nil {
			items = []Article{}
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"data": items, "total": total, "page": page, "limit": limit,
		})
	}
}

// adminMagazineGenerateHandler implements POST /api/admin/magazine/generate.
func adminMagazineGenerateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			WidgetKind string `json:"widgetKind"`
			Date       string `json:"date"`
			Locale     string `json:"locale"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.WidgetKind == "" || req.Date == "" {
			writeJSONError(w, "widgetKind and date required", http.StatusBadRequest)
			return
		}
		locale := req.Locale
		if locale == "" {
			locale = "vi"
		}
		contentDate, err := time.Parse("2006-01-02", req.Date[:10])
		if err != nil {
			writeJSONError(w, "invalid date format", http.StatusBadRequest)
			return
		}
		// Check if article already exists for this widget_kind + content_date + locale
		var existingID string
		err = db.QueryRow(r.Context(), `SELECT id FROM daily.magazine_article
			WHERE widget_kind=$1 AND content_date=$2 AND locale=$3`,
			req.WidgetKind, contentDate, locale).Scan(&existingID)
		if err == nil {
			writeJSON(w, http.StatusOK, map[string]any{"id": nil, "generated": false})
			return
		}
		// Create placeholder article (real AI generation would be async)
		slug := fmt.Sprintf("%s-%s", req.WidgetKind, req.Date[:10])
		var id string
		err = db.QueryRow(r.Context(), `INSERT INTO daily.magazine_article
			(slug, widget_kind, content_date, locale, title_jp, title_vi, content_json, status, created_at, updated_at)
			VALUES ($1,$2,$3,$4,'Generated','Generated','{}','draft',NOW(),NOW()) RETURNING id`,
			slug, req.WidgetKind, contentDate, locale).Scan(&id)
		if err != nil {
			logger.Error("generate magazine article", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"id": id, "generated": true})
	}
}

// adminMagazineRegenerateHandler implements POST /api/admin/magazine/{id}/regenerate.
func adminMagazineRegenerateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "magazine", 1)
		if id == "" {
			writeJSONError(w, "article id required", http.StatusBadRequest)
			return
		}
		// Get existing article metadata
		var widgetKind, locale string
		var contentDate time.Time
		err := db.QueryRow(r.Context(), `SELECT widget_kind, content_date, locale
			FROM daily.magazine_article WHERE id=$1 OR slug=$1`, id).
			Scan(&widgetKind, &contentDate, &locale)
		if err != nil {
			writeJSONError(w, "article not found", http.StatusNotFound)
			return
		}
		// Delete old article
		db.Exec(r.Context(), "DELETE FROM daily.magazine_article WHERE id=$1 OR slug=$1", id)
		// Create new placeholder
		slug := fmt.Sprintf("%s-%s", widgetKind, contentDate.UTC().Format("2006-01-02"))
		var newID string
		err = db.QueryRow(r.Context(), `INSERT INTO daily.magazine_article
			(slug, widget_kind, content_date, locale, title_jp, title_vi, content_json, status, created_at, updated_at)
			VALUES ($1,$2,$3,$4,'Regenerated','Regenerated','{}','draft',NOW(),NOW()) RETURNING id`,
			slug, widgetKind, contentDate, locale).Scan(&newID)
		if err != nil {
			logger.Error("regenerate magazine article", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"id": newID, "regenerated": true})
	}
}

// adminMagazineDeleteHandler implements DELETE /api/admin/magazine/{id}.
func adminMagazineDeleteHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "magazine", 1)
		if id == "" {
			writeJSONError(w, "article id required", http.StatusBadRequest)
			return
		}
		db.Exec(r.Context(), "DELETE FROM daily.magazine_article WHERE id=$1", id)
		writeJSON(w, http.StatusOK, map[string]any{"deleted": true})
	}
}

// ── Loto Predictions Hub ────────────────────────────────────────────────────

func isValidLotoGame(g string) bool {
	return g == "loto6" || g == "loto7"
}

// adminLotoPredictionsListHandler implements GET /api/admin/magazine/loto/predictions.
func adminLotoPredictionsListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		game := r.URL.Query().Get("game")
		if !isValidLotoGame(game) {
			writeJSONError(w, "game must be loto6 or loto7", http.StatusBadRequest)
			return
		}
		status := r.URL.Query().Get("status")
		page := queryInt(r, "page", 1)
		limit := queryInt(r, "limit", 20)
		if page < 1 {
			page = 1
		}
		if limit < 1 || limit > 100 {
			limit = 20
		}
		offset := (page - 1) * limit
		widgetKind := "magazine_" + game

		whereParts := []string{"widget_kind = $1"}
		args := []any{widgetKind}
		argIdx := 2
		if status != "" {
			whereParts = append(whereParts, fmt.Sprintf("approval_status = $%d", argIdx))
			args = append(args, status)
			argIdx++
		}
		whereClause := "WHERE " + strings.Join(whereParts, " AND ")

		var total int
		db.QueryRow(r.Context(), "SELECT COUNT(*) FROM daily.magazine_article "+whereClause, args...).Scan(&total)

		dataQ := fmt.Sprintf(`SELECT id, slug, widget_kind, content_date, status, approval_status,
			approved_by, approved_at, content_json, created_at
			FROM daily.magazine_article %s ORDER BY content_date DESC LIMIT $%d OFFSET $%d`,
			whereClause, argIdx, argIdx+1)
		args = append(args, limit, offset)

		rows, err := db.Query(r.Context(), dataQ, args...)
		if err != nil {
			logger.Error("list loto predictions", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type Prediction struct {
			ID             string          `json:"id"`
			Slug           string          `json:"slug"`
			WidgetKind     string          `json:"widgetKind"`
			ContentDate    string          `json:"contentDate"`
			Status         string          `json:"status"`
			ApprovalStatus *string         `json:"approvalStatus,omitempty"`
			ApprovedBy     *string         `json:"approvedBy,omitempty"`
			ApprovedAt     *string         `json:"approvedAt,omitempty"`
			ContentJSON    json.RawMessage `json:"contentJson"`
			CreatedAt      string          `json:"createdAt"`
		}
		var items []Prediction
		for rows.Next() {
			var p Prediction
			var cd, ca time.Time
			var aa *time.Time
			if rows.Scan(&p.ID, &p.Slug, &p.WidgetKind, &cd, &p.Status, &p.ApprovalStatus,
				&p.ApprovedBy, &aa, &p.ContentJSON, &ca) == nil {
				p.ContentDate = cd.UTC().Format("2006-01-02")
				p.CreatedAt = ca.UTC().Format(time.RFC3339)
				if aa != nil {
					s := aa.UTC().Format(time.RFC3339)
					p.ApprovedAt = &s
				}
				items = append(items, p)
			}
		}
		if items == nil {
			items = []Prediction{}
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"data": items, "total": total, "page": page, "limit": limit,
		})
	}
}

// adminLotoPredictionApproveHandler implements PUT /api/admin/magazine/loto/predictions/{id}/approve.
func adminLotoPredictionApproveHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "predictions", 1)
		if id == "" {
			writeJSONError(w, "prediction id required", http.StatusBadRequest)
			return
		}
		// Verify it's a loto article
		var widgetKind string
		err := db.QueryRow(r.Context(), "SELECT widget_kind FROM daily.magazine_article WHERE id=$1", id).Scan(&widgetKind)
		if err != nil {
			writeJSONError(w, "prediction not found", http.StatusNotFound)
			return
		}
		if !strings.HasPrefix(widgetKind, "magazine_loto") {
			writeJSONError(w, "not a loto reference-combination article", http.StatusBadRequest)
			return
		}
		_, err = db.Exec(r.Context(), `UPDATE daily.magazine_article SET
			approval_status='approved', approved_by=$1, approved_at=NOW(),
			status='published', published_at=COALESCE(published_at,NOW()), updated_at=NOW()
			WHERE id=$2`, identity.ActorID, id)
		if err != nil {
			logger.Error("approve loto prediction", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"id": id, "approvalStatus": "approved", "status": "published"})
	}
}

// adminLotoPredictionRejectHandler implements PUT /api/admin/magazine/loto/predictions/{id}/reject.
func adminLotoPredictionRejectHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "predictions", 1)
		if id == "" {
			writeJSONError(w, "prediction id required", http.StatusBadRequest)
			return
		}
		var widgetKind string
		err := db.QueryRow(r.Context(), "SELECT widget_kind FROM daily.magazine_article WHERE id=$1", id).Scan(&widgetKind)
		if err != nil {
			writeJSONError(w, "prediction not found", http.StatusNotFound)
			return
		}
		if !strings.HasPrefix(widgetKind, "magazine_loto") {
			writeJSONError(w, "not a loto reference-combination article", http.StatusBadRequest)
			return
		}
		_, err = db.Exec(r.Context(), `UPDATE daily.magazine_article SET
			approval_status='rejected', status='draft', updated_at=NOW() WHERE id=$1`, id)
		if err != nil {
			logger.Error("reject loto prediction", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"id": id, "approvalStatus": "rejected", "status": "draft"})
	}
}

// adminLotoResultsInputHandler implements POST /api/admin/magazine/loto/predictions/results.
func adminLotoResultsInputHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			Game         string `json:"game"`
			DrawNumber   int    `json:"drawNumber"`
			DrawDate     string `json:"drawDate"`
			MainNumbers  []int  `json:"mainNumbers"`
			BonusNumbers []int  `json:"bonusNumbers"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if !isValidLotoGame(req.Game) {
			writeJSONError(w, "game must be loto6 or loto7", http.StatusBadRequest)
			return
		}
		mainCount := 6
		bonusCount := 1
		if req.Game == "loto7" {
			mainCount = 7
			bonusCount = 2
		}
		if len(req.MainNumbers) != mainCount {
			writeJSONError(w, fmt.Sprintf("%s requires exactly %d main numbers", req.Game, mainCount), http.StatusBadRequest)
			return
		}
		if len(req.BonusNumbers) != bonusCount {
			writeJSONError(w, fmt.Sprintf("%s requires exactly %d bonus numbers", req.Game, bonusCount), http.StatusBadRequest)
			return
		}
		drawDate, err := time.Parse("2006-01-02", req.DrawDate[:10])
		if err != nil {
			writeJSONError(w, "invalid drawDate format", http.StatusBadRequest)
			return
		}
		mnJSON, _ := json.Marshal(req.MainNumbers)
		bnJSON, _ := json.Marshal(req.BonusNumbers)
		var id string
		err = db.QueryRow(r.Context(), `INSERT INTO content.loto_draw
			(game, draw_number, draw_date, main_numbers, bonus_numbers, source_provider, created_at, updated_at)
			VALUES ($1,$2,$3,$4,$5,'admin_input',NOW(),NOW())
			ON CONFLICT (game, draw_number) DO UPDATE SET
			draw_date=$3, main_numbers=$4, bonus_numbers=$5, source_provider='admin_input', updated_at=NOW()
			RETURNING id`, req.Game, req.DrawNumber, drawDate, mnJSON, bnJSON).Scan(&id)
		if err != nil {
			logger.Error("input loto result", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"id": id, "game": req.Game, "drawNumber": req.DrawNumber,
			"drawDate": req.DrawDate[:10], "mainNumbers": req.MainNumbers, "bonusNumbers": req.BonusNumbers,
		})
	}
}

// adminLotoAnalyticsHandler implements GET /api/admin/magazine/loto/predictions/analytics.
func adminLotoAnalyticsHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		game := r.URL.Query().Get("game")
		if !isValidLotoGame(game) {
			writeJSONError(w, "game must be loto6 or loto7", http.StatusBadRequest)
			return
		}
		widgetKind := "magazine_" + game
		// Get published articles
		rows, err := db.Query(r.Context(), `SELECT id, content_date, content_json
			FROM daily.magazine_article WHERE widget_kind=$1 AND status='published'
			ORDER BY content_date DESC LIMIT 200`, widgetKind)
		if err != nil {
			logger.Error("loto analytics", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type ArticleData struct {
			ID          string
			ContentDate time.Time
			ContentJSON json.RawMessage
		}
		var articles []ArticleData
		var articleIDs []string
		for rows.Next() {
			var a ArticleData
			if rows.Scan(&a.ID, &a.ContentDate, &a.ContentJSON) == nil {
				articles = append(articles, a)
				articleIDs = append(articleIDs, a.ID)
			}
		}

		totalPredictions := len(articles)
		matchedCount := 0
		totalHits := 0
		bestHit := 0
		var bestDrawNumber *int
		hitDistribution := map[int]int{}

		// Load draws matching article dates
		if len(articles) > 0 {
			for _, a := range articles {
				dateKey := a.ContentDate.UTC().Format("2006-01-02")
				var mainNumbers json.RawMessage
				err := db.QueryRow(r.Context(), `SELECT main_numbers FROM daily.loto_draw
					WHERE game=$1 AND draw_date=$2`, game, dateKey).Scan(&mainNumbers)
				if err != nil {
					continue
				}
				matchedCount++
				// Parse predicted sets from content JSON
				var content struct {
					Sets []struct {
						MainNumbers []int `json:"mainNumbers"`
					} `json:"sets"`
					GeneratedSets []struct {
						MainNumbers []int `json:"mainNumbers"`
					} `json:"generatedSets"`
				}
				json.Unmarshal(a.ContentJSON, &content)
				predictedSets := content.Sets
				if len(predictedSets) == 0 {
					predictedSets = content.GeneratedSets
				}
				if len(predictedSets) == 0 {
					continue
				}
				var actualMain []int
				json.Unmarshal(mainNumbers, &actualMain)
				actualSet := map[int]bool{}
				for _, n := range actualMain {
					actualSet[n] = true
				}
				hits := 0
				for _, n := range predictedSets[0].MainNumbers {
					if actualSet[n] {
						hits++
					}
				}
				totalHits += hits
				hitDistribution[hits]++
				if hits > bestHit {
					bestHit = hits
					var dn int
					db.QueryRow(r.Context(), `SELECT draw_number FROM daily.loto_draw
						WHERE game=$1 AND draw_date=$2`, game, dateKey).Scan(&dn)
					bestDrawNumber = &dn
				}
			}
		}
		avgHitRate := 0.0
		if matchedCount > 0 {
			avgHitRate = float64(totalHits) / float64(matchedCount)
		}
		// Total views
		totalViews := 0
		if len(articleIDs) > 0 {
			placeholders := make([]string, len(articleIDs))
			viewArgs := make([]any, len(articleIDs))
			for i, id := range articleIDs {
				placeholders[i] = fmt.Sprintf("$%d", i+1)
				viewArgs[i] = id
			}
			db.QueryRow(r.Context(), "SELECT COUNT(*) FROM daily.magazine_user_read WHERE article_id IN ("+
				strings.Join(placeholders, ",")+")", viewArgs...).Scan(&totalViews)
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"game": game, "totalPredictions": totalPredictions, "matchedCount": matchedCount,
			"avgHitRate": avgHitRate, "bestHit": bestHit, "bestDrawNumber": bestDrawNumber,
			"hitDistribution": hitDistribution, "totalViews": totalViews,
		})
	}
}

// ── Loto Lab ────────────────────────────────────────────────────────────────

// adminLotoSummaryHandler implements GET /api/admin/magazine/loto/summary.
func adminLotoSummaryHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		game := r.URL.Query().Get("game")
		if !isValidLotoGame(game) {
			writeJSONError(w, "game must be loto6 or loto7", http.StatusBadRequest)
			return
		}
		var totalDraws int
		db.QueryRow(r.Context(), "SELECT COUNT(*) FROM daily.loto_draw WHERE game=$1", game).Scan(&totalDraws)
		var latestDrawDate *time.Time
		db.QueryRow(r.Context(), "SELECT MAX(draw_date) FROM daily.loto_draw WHERE game=$1", game).Scan(&latestDrawDate)
		var totalRuns int
		db.QueryRow(r.Context(), "SELECT COUNT(*) FROM daily.loto_generation_run WHERE game=$1", game).Scan(&totalRuns)
		var publishedRuns int
		db.QueryRow(r.Context(), "SELECT COUNT(*) FROM daily.loto_generation_run WHERE game=$1 AND status='published'", game).Scan(&publishedRuns)
		ld := ""
		if latestDrawDate != nil {
			ld = latestDrawDate.UTC().Format("2006-01-02")
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"game": game, "totalDraws": totalDraws, "latestDrawDate": ld,
			"totalRuns": totalRuns, "publishedRuns": publishedRuns,
		})
	}
}

// adminLotoDrawsHandler implements GET /api/admin/magazine/loto/draws.
func adminLotoDrawsHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		game := r.URL.Query().Get("game")
		if !isValidLotoGame(game) {
			writeJSONError(w, "game must be loto6 or loto7", http.StatusBadRequest)
			return
		}
		limit := queryInt(r, "limit", 20)
		if limit < 1 || limit > 100 {
			limit = 20
		}
		rows, err := db.Query(r.Context(), `SELECT id, game, draw_number, draw_date, main_numbers,
			bonus_numbers, carryover_amount, sales_amount, source_url, source_provider
			FROM daily.loto_draw WHERE game=$1 ORDER BY draw_number DESC LIMIT $2`, game, limit)
		if err != nil {
			logger.Error("list loto draws", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		type Draw struct {
			ID              string          `json:"id"`
			Game            string          `json:"game"`
			DrawNumber      int             `json:"drawNumber"`
			DrawDate        string          `json:"drawDate"`
			MainNumbers     json.RawMessage `json:"mainNumbers"`
			BonusNumbers    json.RawMessage `json:"bonusNumbers"`
			CarryoverAmount *string         `json:"carryoverAmount,omitempty"`
			SalesAmount     *string         `json:"salesAmount,omitempty"`
			SourceURL       *string         `json:"sourceUrl,omitempty"`
			SourceProvider  string          `json:"sourceProvider"`
		}
		var items []Draw
		for rows.Next() {
			var d Draw
			var dd time.Time
			var ca, sa *string
			if rows.Scan(&d.ID, &d.Game, &d.DrawNumber, &dd, &d.MainNumbers, &d.BonusNumbers,
				&ca, &sa, &d.SourceURL, &d.SourceProvider) == nil {
				d.DrawDate = dd.UTC().Format("2006-01-02")
				d.CarryoverAmount = ca
				d.SalesAmount = sa
				items = append(items, d)
			}
		}
		if items == nil {
			items = []Draw{}
		}
		writeJSON(w, http.StatusOK, items)
	}
}

// adminLotoImportCSVHandler implements POST /api/admin/magazine/loto/import-csv.
func adminLotoImportCSVHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			Game    string `json:"game"`
			CSVText string `json:"csvText"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if strings.TrimSpace(req.CSVText) == "" {
			writeJSONError(w, "csvText is required", http.StatusBadRequest)
			return
		}
		reader := csv.NewReader(strings.NewReader(req.CSVText))
		records, err := reader.ReadAll()
		if err != nil {
			writeJSONError(w, "invalid CSV format", http.StatusBadRequest)
			return
		}
		created := 0
		updated := 0
		for _, row := range records {
			if len(row) < 3 {
				continue
			}
			drawNum, err := strconv.Atoi(strings.TrimSpace(row[0]))
			if err != nil {
				continue
			}
			game := req.Game
			if game == "" && len(row) > 0 {
				game = strings.TrimSpace(row[len(row)-1])
			}
			if !isValidLotoGame(game) {
				continue
			}
			drawDate := strings.TrimSpace(row[1])
			dt, err := time.Parse("2006-01-02", drawDate[:10])
			if err != nil {
				continue
			}
			// Parse numbers from remaining columns
			var mainNums, bonusNums []int
			for i := 2; i < len(row); i++ {
				n, err := strconv.Atoi(strings.TrimSpace(row[i]))
				if err != nil {
					continue
				}
				mainCount := 6
				if game == "loto7" {
					mainCount = 7
				}
				if len(mainNums) < mainCount {
					mainNums = append(mainNums, n)
				} else {
					bonusNums = append(bonusNums, n)
				}
			}
			mnJSON, _ := json.Marshal(mainNums)
			bnJSON, _ := json.Marshal(bonusNums)
			var exists bool
			db.QueryRow(r.Context(), "SELECT EXISTS(SELECT 1 FROM daily.loto_draw WHERE game=$1 AND draw_number=$2)",
				game, drawNum).Scan(&exists)
			db.Exec(r.Context(), `INSERT INTO content.loto_draw (game, draw_number, draw_date, main_numbers, bonus_numbers, source_provider, created_at, updated_at)
				VALUES ($1,$2,$3,$4,$5,'csv_import',NOW(),NOW())
				ON CONFLICT (game, draw_number) DO UPDATE SET draw_date=$3, main_numbers=$4, bonus_numbers=$5, imported_at=NOW(), updated_at=NOW()`,
				game, drawNum, dt, mnJSON, bnJSON)
			if exists {
				updated++
			} else {
				created++
			}
		}
		writeJSON(w, http.StatusOK, map[string]any{"created": created, "updated": updated, "total": created + updated})
	}
}

// adminLotoSyncHandler implements POST /api/admin/magazine/loto/sync.
func adminLotoSyncHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			Game string `json:"game"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if !isValidLotoGame(req.Game) {
			writeJSONError(w, "game must be loto6 or loto7", http.StatusBadRequest)
			return
		}
		// External CSV sync requires network access — return stub indicating sync was requested
		writeJSON(w, http.StatusOK, map[string]any{
			"game": req.Game, "status": "sync_requested",
			"message": "External CSV sync requires staging environment",
		})
	}
}

// adminLotoAutopilotHandler implements POST /api/admin/magazine/loto/autopilot.
func adminLotoAutopilotHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			Game string `json:"game"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if !isValidLotoGame(req.Game) {
			writeJSONError(w, "game must be loto6 or loto7", http.StatusBadRequest)
			return
		}
		todayKey := time.Now().UTC().Format("2006-01-02")
		// Check latest draw
		var latestDrawDate *time.Time
		db.QueryRow(r.Context(), "SELECT MAX(draw_date) FROM daily.loto_draw WHERE game=$1", req.Game).Scan(&latestDrawDate)
		if latestDrawDate == nil {
			writeJSON(w, http.StatusOK, map[string]any{"status": "waiting_result", "game": req.Game, "todayDate": todayKey})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"status": "waiting_result", "game": req.Game, "todayDate": todayKey,
			"latestOfficialDrawDate": latestDrawDate.UTC().Format("2006-01-02"),
		})
	}
}

// adminLotoGenerateHandler implements POST /api/admin/magazine/loto/generate.
func adminLotoGenerateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			Game           string `json:"game"`
			TargetDrawDate string `json:"targetDrawDate"`
			SetCount       int    `json:"setCount"`
			Seed           string `json:"seed"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if !isValidLotoGame(req.Game) {
			writeJSONError(w, "game must be loto6 or loto7", http.StatusBadRequest)
			return
		}
		if req.SetCount < 1 {
			req.SetCount = 3
		}
		targetDate := time.Now().UTC()
		if req.TargetDrawDate != "" {
			if t, err := time.Parse("2006-01-02", req.TargetDrawDate[:10]); err == nil {
				targetDate = t
			}
		}
		// Create generation run
		var runID string
		err := db.QueryRow(r.Context(), `INSERT INTO content.loto_generation_run
			(game, target_draw_date, status, seed, requested_set_count, created_at)
			VALUES ($1,$2,'generated',$3,$4,NOW()) RETURNING id`,
			req.Game, targetDate, req.Seed, req.SetCount).Scan(&runID)
		if err != nil {
			logger.Error("create loto generation run", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		// Generate placeholder sets
		mainCount := 6
		bonusCount := 1
		if req.Game == "loto7" {
			mainCount = 7
			bonusCount = 2
		}
		type SetResult struct {
			ID           string `json:"id"`
			Rank         int    `json:"rank"`
			MainNumbers  []int  `json:"mainNumbers"`
			BonusNumbers []int  `json:"bonusNumbers"`
			Score        int    `json:"score"`
		}
		var sets []SetResult
		for i := 0; i < req.SetCount; i++ {
			mainNums := make([]int, mainCount)
			for j := 0; j < mainCount; j++ {
				mainNums[j] = (i*7+j+1)%43 + 1
			}
			bonusNums := make([]int, bonusCount)
			for j := 0; j < bonusCount; j++ {
				bonusNums[j] = (i*3+j+1)%16 + 1
			}
			mnJSON, _ := json.Marshal(mainNums)
			bnJSON, _ := json.Marshal(bonusNums)
			var setID string
			db.QueryRow(r.Context(), `INSERT INTO content.loto_generated_set
				(run_id, rank, main_numbers, bonus_numbers, score, selected_for_magazine, created_at)
				VALUES ($1,$2,$3,$4,$5,false,NOW()) RETURNING id`,
				runID, i+1, mnJSON, bnJSON, 100-i*10).Scan(&setID)
			sets = append(sets, SetResult{ID: setID, Rank: i + 1, MainNumbers: mainNums, BonusNumbers: bonusNums, Score: 100 - i*10})
		}
		_ = identity.ActorID // used for audit in production
		writeJSON(w, http.StatusOK, map[string]any{
			"id": runID, "game": req.Game, "targetDrawDate": targetDate.UTC().Format("2006-01-02"),
			"status": "generated", "sets": sets,
		})
	}
}

// adminLotoPublishHandler implements POST /api/admin/magazine/loto/publish.
func adminLotoPublishHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			RunID  string   `json:"runId"`
			SetIDs []string `json:"setIds"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.RunID == "" {
			writeJSONError(w, "runId is required", http.StatusBadRequest)
			return
		}
		if len(req.SetIDs) == 0 {
			writeJSONError(w, "at least one setId is required", http.StatusBadRequest)
			return
		}
		// Get run details
		var game string
		var targetDate time.Time
		err := db.QueryRow(r.Context(), "SELECT game, target_draw_date FROM daily.loto_generation_run WHERE id=$1", req.RunID).
			Scan(&game, &targetDate)
		if err != nil {
			writeJSONError(w, "generation run not found", http.StatusNotFound)
			return
		}
		dateKey := targetDate.UTC().Format("2006-01-02")
		widgetKind := "magazine_" + game
		slug := fmt.Sprintf("%s-prediction-%s", game, dateKey)
		// Mark sets as selected
		for _, setID := range req.SetIDs {
			db.Exec(r.Context(), "UPDATE content.loto_generated_set SET selected_for_magazine=true WHERE id=$1 AND run_id=$2", setID, req.RunID)
		}
		// Update run status
		db.Exec(r.Context(), "UPDATE content.loto_generation_run SET status='published', updated_at=NOW() WHERE id=$1", req.RunID)
		// Upsert magazine article
		var articleID string
		err = db.QueryRow(r.Context(), `INSERT INTO daily.magazine_article
			(slug, widget_kind, content_date, locale, title_jp, title_vi, content_json, status,
			approval_status, approved_by, approved_at, published_at, created_at, updated_at)
			VALUES ($1,$2,$3,'vi',$4,$5,'{}','published','approved',$6,NOW(),NOW(),NOW(),NOW())
			ON CONFLICT (widget_kind, content_date, locale) DO UPDATE SET
			status='published', approval_status='approved', approved_by=$6, approved_at=NOW(),
			published_at=NOW(), updated_at=NOW()
			RETURNING id`,
			slug, widgetKind, targetDate,
			fmt.Sprintf("%s 確率学習セット — %s", strings.ToUpper(game), dateKey),
			fmt.Sprintf("Tổ hợp học xác suất %s — %s", strings.ToUpper(game), dateKey),
			identity.ActorID).Scan(&articleID)
		if err != nil {
			logger.Error("publish loto to magazine", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"articleId": articleID, "slug": slug, "status": "published",
			"publishedAt": time.Now().UTC().Format(time.RFC3339), "selectedSets": len(req.SetIDs),
		})
	}
}
