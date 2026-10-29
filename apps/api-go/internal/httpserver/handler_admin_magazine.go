package httpserver

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/loto"
)

// ── P1-A11: Admin Magazine + Loto — Articles + Predictions + Lab (16 routes) ──
// Contracts derived from NestJS magazine-admin.controller.ts,
// loto-hub-admin.controller.ts, loto-lab-admin.controller.ts,
// magazine.repository.ts, loto-hub-admin.service.ts, loto-lab.service.ts.
// DB tables: daily.magazine_article, daily.magazine_user_read, daily.loto_draw,
// daily.loto_generation_run, daily.loto_generated_set.

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
		identity, ok := authn.GetAdminIdentity(r.Context())
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
		switch req.WidgetKind {
		case "magazine_vocab", "magazine_weather", "magazine_horoscope", "magazine_loto6", "magazine_loto7", "magazine_bjt_phrase":
		default:
			writeJSONError(w, "unsupported widgetKind", http.StatusBadRequest)
			return
		}
		if req.Date == "" {
			writeJSONError(w, "date required", http.StatusBadRequest)
			return
		}
		if len(req.Date) < len("2006-01-02") {
			writeJSONError(w, "invalid date format", http.StatusBadRequest)
			return
		}
		locale := req.Locale
		if locale == "" {
			locale = "vi"
		}
		if locale != "vi" && locale != "en" && locale != "ja" {
			writeJSONError(w, "unsupported locale", http.StatusBadRequest)
			return
		}
		dateKey := req.Date[:10]
		contentDate, err := time.Parse("2006-01-02", dateKey)
		if err != nil {
			writeJSONError(w, "invalid date format", http.StatusBadRequest)
			return
		}
		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin magazine generation", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer func() { _ = tx.Rollback(context.Background()) }()
		// Create placeholder article (real AI generation would be async)
		slug := fmt.Sprintf("%s-%s-%s", dateKey, strings.TrimPrefix(req.WidgetKind, "magazine_"), locale)
		var id string
		err = tx.QueryRow(r.Context(), `INSERT INTO daily.magazine_article
			(slug, widget_kind, content_date, locale, title_jp, title_vi, content_json, status, created_at, updated_at)
			VALUES ($1,$2,$3,$4,'Generated','Generated','{}','draft',NOW(),NOW())
			ON CONFLICT (widget_kind, content_date, locale) DO NOTHING RETURNING id`,
			slug, req.WidgetKind, contentDate, locale).Scan(&id)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSON(w, http.StatusOK, map[string]any{"id": nil, "generated": false})
			return
		}
		if err != nil {
			logger.Error("generate magazine article", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		after, _ := json.Marshal(map[string]string{"id": id, "widgetKind": req.WidgetKind, "contentDate": dateKey, "locale": locale, "status": "draft"})
		if _, err = tx.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('magazine.article.generated',$1,$2,'daily.magazine_article','generated_draft',$3,NOW())`, identity.ActorID, id, after); err != nil {
			logger.Error("audit magazine generation", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err = tx.Commit(r.Context()); err != nil {
			logger.Error("commit magazine generation", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"id": id, "generated": true})
	}
}

// adminMagazineRegenerateHandler implements POST /api/admin/magazine/{id}/regenerate.
func adminMagazineRegenerateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "magazine", 1)
		if id == "" {
			writeJSONError(w, "article id required", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		tx, err := db.Begin(ctx)
		if err != nil {
			logger.Error("begin magazine regeneration", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(ctx)
		var articleID string
		err = tx.QueryRow(ctx, `UPDATE daily.magazine_article SET status='draft', approval_status='pending',
			approved_by=NULL, approved_at=NULL, published_at=NULL, updated_at=NOW()
			WHERE id::text=$1 OR slug=$1 RETURNING id::text`, id).Scan(&articleID)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "article not found", http.StatusNotFound)
			return
		}
		if err != nil {
			logger.Error("reset magazine article for regeneration", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := writeAdminAuditWithReason(ctx, tx, identity.ActorID, "admin.magazine.article.regenerated", "daily.magazine_article", articleID, "Reset article for regeneration", nil, map[string]any{"status": "draft"}); err != nil {
			logger.Error("audit magazine regeneration", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			logger.Error("commit magazine regeneration", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"id": articleID, "regenerated": true})
	}
}

// adminMagazineDeleteHandler implements DELETE /api/admin/magazine/{id}.
func adminMagazineDeleteHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "magazine", 1)
		if !isValidUUID(id) {
			writeJSONError(w, "article id required", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		tx, err := db.Begin(ctx)
		if err != nil {
			logger.Error("begin magazine article delete", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(ctx)
		var before json.RawMessage
		if err := tx.QueryRow(ctx, `SELECT to_jsonb(a) FROM daily.magazine_article a WHERE id=$1 FOR UPDATE`, id).Scan(&before); errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "article not found", http.StatusNotFound)
			return
		} else if err != nil {
			logger.Error("load magazine article for delete", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if _, err := tx.Exec(ctx, "DELETE FROM daily.magazine_article WHERE id=$1", id); err != nil {
			logger.Error("delete magazine article", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := writeAdminAuditWithReason(ctx, tx, identity.ActorID, "admin.magazine.article.deleted", "daily.magazine_article", id, "Admin deleted magazine article", before, map[string]any{"deleted": true}); err != nil {
			logger.Error("audit magazine article delete", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			logger.Error("commit magazine article delete", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"deleted": true})
	}
}

// ── Loto Predictions Hub ────────────────────────────────────────────────────

func isValidLotoGame(g string) bool {
	return g == "loto6" || g == "loto7"
}

func parseLotoDate(value string) (time.Time, error) {
	if parsed, err := time.Parse("2006-01-02", value); err == nil {
		return parsed, nil
	}
	if len(value) > 10 {
		if _, err := time.Parse(time.RFC3339Nano, value); err == nil {
			return time.Parse("2006-01-02", value[:10])
		}
	}
	return time.Time{}, fmt.Errorf("invalid date")
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
		if err := db.QueryRow(r.Context(), "SELECT COUNT(*) FROM daily.magazine_article "+whereClause, args...).Scan(&total); err != nil {
			logger.Error("count loto predictions", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

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
			if err := rows.Scan(&p.ID, &p.Slug, &p.WidgetKind, &cd, &p.Status, &p.ApprovalStatus,
				&p.ApprovedBy, &aa, &p.ContentJSON, &ca); err != nil {
				logger.Error("scan loto prediction", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			p.ContentDate = cd.UTC().Format("2006-01-02")
			p.CreatedAt = ca.UTC().Format(time.RFC3339)
			if aa != nil {
				s := aa.UTC().Format(time.RFC3339)
				p.ApprovedAt = &s
			}
			items = append(items, p)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate loto predictions", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
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
		ctx := r.Context()
		tx, err := db.Begin(ctx)
		if err != nil {
			logger.Error("begin loto approval", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(ctx)
		var widgetKind string
		err = tx.QueryRow(ctx, "SELECT widget_kind FROM daily.magazine_article WHERE id=$1 FOR UPDATE", id).Scan(&widgetKind)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "prediction not found", http.StatusNotFound)
			return
		}
		if err != nil {
			logger.Error("load loto prediction for approval", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if widgetKind != "magazine_loto6" && widgetKind != "magazine_loto7" {
			writeJSONError(w, "not a loto reference-combination article", http.StatusBadRequest)
			return
		}
		before := map[string]string{"widgetKind": widgetKind}
		if _, err = tx.Exec(ctx, `UPDATE daily.magazine_article SET
			approval_status='approved', approved_by=$1, approved_at=NOW(),
			status='published', published_at=COALESCE(published_at,NOW()), updated_at=NOW()
			WHERE id=$2`, identity.ActorID, id); err != nil {
			logger.Error("approve loto prediction", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if _, err = tx.Exec(ctx, `UPDATE daily.loto_generation_run SET status='published', updated_at=NOW()
			WHERE status='rejected' AND id::text = (SELECT content_json->>'runId' FROM daily.magazine_article WHERE id=$1)`, id); err != nil {
			logger.Error("restore approved loto run", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := writeAdminAuditWithReason(ctx, tx, identity.ActorID, "admin.magazine.loto.prediction.approved", "daily.magazine_article", id, "Approve loto prediction", before, map[string]string{"approvalStatus": "approved", "status": "published"}); err != nil {
			logger.Error("audit loto approval", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			logger.Error("commit loto approval", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		loto.InvalidateCaches()
		writeJSON(w, http.StatusOK, map[string]any{"id": id, "approvalStatus": "approved", "status": "published"})
	}
}

// adminLotoPredictionRejectHandler implements PUT /api/admin/magazine/loto/predictions/{id}/reject.
func adminLotoPredictionRejectHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
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
		ctx := r.Context()
		tx, err := db.Begin(ctx)
		if err != nil {
			logger.Error("begin loto rejection", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(ctx)
		var widgetKind string
		err = tx.QueryRow(ctx, "SELECT widget_kind FROM daily.magazine_article WHERE id=$1 FOR UPDATE", id).Scan(&widgetKind)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "prediction not found", http.StatusNotFound)
			return
		}
		if err != nil {
			logger.Error("load loto prediction for rejection", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if widgetKind != "magazine_loto6" && widgetKind != "magazine_loto7" {
			writeJSONError(w, "not a loto reference-combination article", http.StatusBadRequest)
			return
		}
		if _, err = tx.Exec(ctx, `UPDATE daily.magazine_article SET
			approval_status='rejected', status='draft', approved_by=NULL, approved_at=NULL, published_at=NULL, updated_at=NOW() WHERE id=$1`, id); err != nil {
			logger.Error("reject loto prediction", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		// The learner hub reads runs, not articles: demote the run so a rejected set disappears everywhere
		// (and the autopilot does not republish it).
		if _, err = tx.Exec(ctx, `UPDATE daily.loto_generation_run SET status='rejected', updated_at=NOW()
			WHERE status='published' AND id::text = (SELECT content_json->>'runId' FROM daily.magazine_article WHERE id=$1)`, id); err != nil {
			logger.Error("demote rejected loto run", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := writeAdminAuditWithReason(ctx, tx, identity.ActorID, "admin.magazine.loto.prediction.rejected", "daily.magazine_article", id, "Reject loto prediction", map[string]string{"widgetKind": widgetKind}, map[string]string{"approvalStatus": "rejected", "status": "draft"}); err != nil {
			logger.Error("audit loto rejection", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			logger.Error("commit loto rejection", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		loto.InvalidateCaches()
		writeJSON(w, http.StatusOK, map[string]any{"id": id, "approvalStatus": "rejected", "status": "draft"})
	}
}

// adminLotoResultsInputHandler implements POST /api/admin/magazine/loto/predictions/results.
func adminLotoResultsInputHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
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
		maxNumber := 43
		if req.Game == "loto7" {
			mainCount = 7
			bonusCount = 2
			maxNumber = 37
		}
		if req.DrawNumber < 1 {
			writeJSONError(w, "drawNumber must be positive", http.StatusBadRequest)
			return
		}
		if len(req.MainNumbers) != mainCount {
			writeJSONError(w, fmt.Sprintf("%s requires exactly %d main numbers", req.Game, mainCount), http.StatusBadRequest)
			return
		}
		if len(req.BonusNumbers) != bonusCount {
			writeJSONError(w, fmt.Sprintf("%s requires exactly %d bonus numbers", req.Game, bonusCount), http.StatusBadRequest)
			return
		}
		seen := make(map[int]bool, mainCount+bonusCount)
		for _, n := range append(append([]int(nil), req.MainNumbers...), req.BonusNumbers...) {
			if n < 1 || n > maxNumber || seen[n] {
				writeJSONError(w, "draw numbers must be unique and within the game's range", http.StatusBadRequest)
				return
			}
			seen[n] = true
		}
		drawDate, err := parseLotoDate(strings.TrimSpace(req.DrawDate))
		if err != nil {
			writeJSONError(w, "invalid drawDate format", http.StatusBadRequest)
			return
		}
		dateKey := drawDate.Format("2006-01-02")
		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin loto result transaction", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer func() { _ = tx.Rollback(context.Background()) }()
		var id string
		err = tx.QueryRow(r.Context(), `INSERT INTO daily.loto_draw
			(game, draw_number, draw_date, main_numbers, bonus_numbers, source_provider, created_at, updated_at)
			VALUES ($1,$2,$3,$4,$5,'admin_input',NOW(),NOW())
			ON CONFLICT (game, draw_number) DO UPDATE SET
			draw_date=$3, main_numbers=$4, bonus_numbers=$5, source_provider='admin_input', updated_at=NOW()
			RETURNING id::text`, req.Game, req.DrawNumber, drawDate, req.MainNumbers, req.BonusNumbers).Scan(&id)
		if err != nil {
			logger.Error("input loto result", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if _, err := tx.Exec(r.Context(), `INSERT INTO ops.admin_audit_log
			(action, actor_id, target_id, target_type, after, created_at)
			VALUES ('loto.result.input',$1,$2,'daily.loto_draw',jsonb_build_object('game',$3::text,'drawNumber',$4::int),NOW())`, identity.ActorID, id, req.Game, req.DrawNumber); err != nil {
			logger.Error("audit loto result input", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			logger.Error("commit loto result", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"id": id, "game": req.Game, "drawNumber": req.DrawNumber,
			"drawDate": dateKey, "mainNumbers": req.MainNumbers, "bonusNumbers": req.BonusNumbers,
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
			if err := rows.Scan(&a.ID, &a.ContentDate, &a.ContentJSON); err != nil {
				logger.Error("scan loto analytics article", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			articles = append(articles, a)
			articleIDs = append(articleIDs, a.ID)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate loto analytics articles", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
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
				var mainNumbers []int
				err := db.QueryRow(r.Context(), `SELECT main_numbers FROM daily.loto_draw
					WHERE game=$1 AND draw_date=$2`, game, dateKey).Scan(&mainNumbers)
				if errors.Is(err, pgx.ErrNoRows) {
					continue
				}
				if err != nil {
					logger.Error("load loto analytics draw", "error", err)
					writeJSONError(w, "internal error", http.StatusInternalServerError)
					return
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
				if err := json.Unmarshal(a.ContentJSON, &content); err != nil {
					logger.Error("decode loto prediction analytics", "error", err)
					writeJSONError(w, "internal error", http.StatusInternalServerError)
					return
				}
				predictedSets := content.Sets
				if len(predictedSets) == 0 {
					predictedSets = content.GeneratedSets
				}
				if len(predictedSets) == 0 {
					continue
				}
				actualSet := map[int]bool{}
				for _, n := range mainNumbers {
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
					if err := db.QueryRow(r.Context(), `SELECT draw_number FROM daily.loto_draw
						WHERE game=$1 AND draw_date=$2`, game, dateKey).Scan(&dn); err != nil {
						logger.Error("load best loto draw number", "error", err)
						writeJSONError(w, "internal error", http.StatusInternalServerError)
						return
					}
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
			if err := db.QueryRow(r.Context(), "SELECT COUNT(*) FROM daily.magazine_user_read WHERE article_id IN ("+
				strings.Join(placeholders, ",")+")", viewArgs...).Scan(&totalViews); err != nil {
				logger.Error("count loto analytics views", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
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
		if err := db.QueryRow(r.Context(), "SELECT COUNT(*) FROM daily.loto_draw WHERE game=$1", game).Scan(&totalDraws); err != nil {
			logger.Error("count loto summary draws", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		var latestDrawDate *time.Time
		if err := db.QueryRow(r.Context(), "SELECT MAX(draw_date) FROM daily.loto_draw WHERE game=$1", game).Scan(&latestDrawDate); err != nil {
			logger.Error("load latest loto summary draw", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		var totalRuns int
		if err := db.QueryRow(r.Context(), "SELECT COUNT(*) FROM daily.loto_generation_run WHERE game=$1", game).Scan(&totalRuns); err != nil {
			logger.Error("count loto summary runs", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		var publishedRuns int
		if err := db.QueryRow(r.Context(), "SELECT COUNT(*) FROM daily.loto_generation_run WHERE game=$1 AND status='published'", game).Scan(&publishedRuns); err != nil {
			logger.Error("count published loto summary runs", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
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
		identity, ok := authn.GetAdminIdentity(r.Context())
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
		if !isValidLotoGame(req.Game) {
			writeJSONError(w, "game must be loto6 or loto7", http.StatusBadRequest)
			return
		}
		mainCount, maxNumber := 6, 43
		if req.Game == "loto7" {
			mainCount, maxNumber = 7, 37
		}
		bonusCount := 1
		if req.Game == "loto7" {
			bonusCount = 2
		}
		validRows := make([]struct {
			drawNum     int
			drawDate    time.Time
			main, bonus []int
		}, 0, len(records))
		for idx, row := range records {
			if idx == 0 && len(row) > 0 && strings.EqualFold(strings.TrimSpace(row[0]), "drawNumber") {
				continue
			}
			if len(row) < 2+mainCount+bonusCount {
				writeJSONError(w, "CSV row has too few columns", http.StatusBadRequest)
				return
			}
			drawNum, err := strconv.Atoi(strings.TrimSpace(row[0]))
			if err != nil || drawNum < 1 {
				writeJSONError(w, "CSV contains an invalid draw number", http.StatusBadRequest)
				return
			}
			dt, err := parseLotoDate(strings.TrimSpace(row[1]))
			if err != nil {
				writeJSONError(w, "CSV contains an invalid draw date", http.StatusBadRequest)
				return
			}
			numbers := make([]int, mainCount+bonusCount)
			seen := make(map[int]bool, len(numbers))
			for i := range numbers {
				n, err := strconv.Atoi(strings.TrimSpace(row[2+i]))
				if err != nil || n < 1 || n > maxNumber || seen[n] {
					writeJSONError(w, "CSV contains invalid or duplicate draw numbers", http.StatusBadRequest)
					return
				}
				numbers[i], seen[n] = n, true
			}
			for _, extra := range row[2+len(numbers):] {
				if strings.TrimSpace(extra) != "" {
					writeJSONError(w, "CSV row has unexpected columns", http.StatusBadRequest)
					return
				}
			}
			validRows = append(validRows, struct {
				drawNum     int
				drawDate    time.Time
				main, bonus []int
			}{
				drawNum: drawNum, drawDate: dt, main: numbers[:mainCount], bonus: numbers[mainCount:],
			})
		}
		if len(validRows) == 0 {
			writeJSONError(w, "CSV must contain at least one draw", http.StatusBadRequest)
			return
		}
		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin loto CSV import", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer func() { _ = tx.Rollback(context.Background()) }()
		created, updated := 0, 0
		firstDrawID := ""
		for _, row := range validRows {
			var inserted bool
			var drawID string
			err := tx.QueryRow(r.Context(), `INSERT INTO daily.loto_draw
				(game, draw_number, draw_date, main_numbers, bonus_numbers, source_provider, imported_at, created_at, updated_at)
				VALUES ($1,$2,$3,$4,$5,'csv_import',NOW(),NOW(),NOW())
				ON CONFLICT (game, draw_number) DO UPDATE SET draw_date=$3, main_numbers=$4, bonus_numbers=$5,
					source_provider='csv_import', imported_at=NOW(), updated_at=NOW()
				RETURNING id::text, (xmax = 0)`, req.Game, row.drawNum, row.drawDate, row.main, row.bonus).Scan(&drawID, &inserted)
			if err != nil {
				logger.Error("import loto CSV row", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			if firstDrawID == "" {
				firstDrawID = drawID
			}
			if inserted {
				created++
			} else {
				updated++
			}
		}
		if _, err := tx.Exec(r.Context(), `INSERT INTO ops.admin_audit_log
			(action, actor_id, target_id, target_type, after, created_at)
			VALUES ('loto.csv.import',$1,$2,'daily.loto_draw',jsonb_build_object('game',$3::text,'created',$4::int,'updated',$5::int),NOW())`,
			identity.ActorID, firstDrawID, req.Game, created, updated); err != nil {
			logger.Error("audit loto CSV import", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			logger.Error("commit loto CSV import", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"created": created, "updated": updated, "total": created + updated})
	}
}

// adminLotoSyncHandler implements POST /api/admin/magazine/loto/sync. With a
// configured result source it imports the latest draws immediately; without one
// (staging/tests) it only records the request, as before.
func adminLotoSyncHandler(db *pgxpool.Pool, logger *slog.Logger, source loto.ResultSource) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
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
		game, valid := loto.ParseGame(req.Game)
		if !valid {
			writeJSONError(w, "game must be loto6 or loto7", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		if source == nil {
			tx, err := db.Begin(ctx)
			if err != nil {
				logger.Error("begin loto sync request", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			defer tx.Rollback(ctx)
			if err := writeAdminAuditWithReason(ctx, tx, identity.ActorID, "admin.magazine.loto.sync.requested", "daily.loto_draw", req.Game, "Request loto source sync", nil, map[string]string{"game": req.Game, "status": "sync_requested"}); err != nil {
				logger.Error("audit loto sync request", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			if err := tx.Commit(ctx); err != nil {
				logger.Error("commit loto sync request", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{
				"game": req.Game, "status": "sync_requested",
				"message": "No result source is configured in this environment; the request was recorded only",
			})
			return
		}
		syncCtx, cancel := context.WithTimeout(ctx, 25*time.Second)
		defer cancel()
		tx, err := db.Begin(syncCtx)
		if err != nil {
			logger.Error("begin loto sync", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(context.WithoutCancel(syncCtx))
		// Import and audit commit together (the nested draw upsert uses a savepoint).
		svc := &loto.Service{DB: tx, Logger: logger, Source: source}
		result, err := svc.SyncGame(syncCtx, game)
		if err != nil {
			logger.Error("loto admin sync", "game", game, "error", err)
			if errors.Is(err, loto.ErrSourceUnavailable) || errors.Is(err, loto.ErrSourceNotAllowed) {
				writeJSONError(w, "result source unavailable", http.StatusBadGateway)
				return
			}
			if errors.Is(err, loto.ErrInvalidInput) || errors.Is(err, loto.ErrInvalidDate) {
				writeJSONError(w, "result source returned invalid data", http.StatusBadGateway)
				return
			}
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := writeAdminAuditWithReason(syncCtx, tx, identity.ActorID, "admin.magazine.loto.sync.completed", "daily.loto_draw", req.Game, "Sync loto results from source", nil, result); err != nil {
			logger.Error("audit loto sync", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(syncCtx); err != nil {
			logger.Error("commit loto sync", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		loto.InvalidateCaches()
		writeJSON(w, http.StatusOK, map[string]any{
			"game": req.Game, "status": "synced", "created": result.Created, "updated": result.Updated,
			"processed": result.Processed, "total": result.Total, "url": result.URL, "sourceProvider": result.SourceProvider,
			"officialVerificationUrl": result.OfficialVerificationURL,
		})
	}
}

// adminLotoAutopilotHandler implements POST /api/admin/magazine/loto/autopilot:
// one on-demand autopilot tick (sync, publish the next reference set, backtests).
func adminLotoAutopilotHandler(db *pgxpool.Pool, logger *slog.Logger, source loto.ResultSource) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
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
		game, valid := loto.ParseGame(req.Game)
		if !valid {
			writeJSONError(w, "game must be loto6 or loto7", http.StatusBadRequest)
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 25*time.Second)
		defer cancel()
		svc := &loto.Service{DB: db, Logger: logger, Source: source}
		result, err := svc.RunAutopilot(ctx, game)
		if err != nil {
			logger.Error("loto admin autopilot", "game", game, "error", err)
			writeJSONError(w, "autopilot failed", http.StatusInternalServerError)
			return
		}
		if auditErr := auditLotoAutopilot(r.Context(), db, identity.ActorID, game, result); auditErr != nil {
			logger.Error("audit loto autopilot", "game", game, "error", auditErr)
		}
		writeJSON(w, http.StatusOK, result)
	}
}

// auditLotoAutopilot records every manual autopilot tick, not only publications.
func auditLotoAutopilot(ctx context.Context, db *pgxpool.Pool, actorID string, game loto.Game, result loto.AutopilotResult) error {
	tx, err := db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	target := result.RunID
	if target == "" {
		target = string(game)
	}
	if err := writeAdminAuditWithReason(ctx, tx, actorID, "admin.magazine.loto.autopilot.run", "daily.loto_generation_run", target, "Run loto autopilot", nil, result); err != nil {
		return err
	}
	return tx.Commit(ctx)
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
			Game            string             `json:"game"`
			TargetDrawDate  string             `json:"targetDrawDate"`
			SetCount        int                `json:"setCount"`
			Seed            string             `json:"seed"`
			Weights         map[string]float64 `json:"weights"`
			WeatherText     string             `json:"weatherText"`
			DreamText       string             `json:"dreamText"`
			LuckyText       string             `json:"luckyText"`
			PinnedNumbers   []int              `json:"pinnedNumbers"`
			ExcludedNumbers []int              `json:"excludedNumbers"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		game, valid := loto.ParseGame(req.Game)
		if !valid {
			writeJSONError(w, "game must be loto6 or loto7", http.StatusBadRequest)
			return
		}
		if req.SetCount < 1 {
			req.SetCount = 3
		}
		if req.SetCount > 5 {
			writeJSONError(w, "setCount must not exceed 5", http.StatusBadRequest)
			return
		}
		if len(req.Seed) > 128 {
			writeJSONError(w, "seed must not exceed 128 characters", http.StatusBadRequest)
			return
		}
		targetKey := time.Now().UTC().Format("2006-01-02")
		if req.TargetDrawDate != "" {
			t, err := parseLotoDate(strings.TrimSpace(req.TargetDrawDate))
			if err != nil {
				writeJSONError(w, "invalid targetDrawDate format", http.StatusBadRequest)
				return
			}
			targetKey = t.Format("2006-01-02")
		}
		seed := req.Seed
		if seed == "" {
			seed = fmt.Sprintf("admin-%s-%d", game, time.Now().UnixNano())
		}
		ctx := r.Context()
		tx, err := db.Begin(ctx)
		if err != nil {
			logger.Error("begin loto generation", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer func() { _ = tx.Rollback(context.Background()) }()
		svc := &loto.Service{DB: db, Logger: logger}
		run, err := svc.GenerateRun(ctx, tx, loto.GenerateRequest{
			Game: game, TargetDateKey: targetKey, SetCount: req.SetCount, Seed: seed, Weights: req.Weights,
			WeatherText: req.WeatherText, DreamText: req.DreamText, LuckyText: req.LuckyText,
			Pinned: req.PinnedNumbers, Excluded: req.ExcludedNumbers, AdminID: identity.ActorID,
		})
		if err != nil {
			if errors.Is(err, loto.ErrInvalidInput) || errors.Is(err, loto.ErrInvalidDate) {
				writeJSONError(w, err.Error(), http.StatusBadRequest)
				return
			}
			logger.Error("create loto generation run", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if _, err := tx.Exec(ctx, `INSERT INTO ops.admin_audit_log
			(action, actor_id, target_id, target_type, after, created_at)
			VALUES ('loto.generation.created',$1,$2,'daily.loto_generation_run',jsonb_build_object('game',$3::text,'setCount',$4::int),NOW())`,
			identity.ActorID, run.ID, string(game), len(run.Sets)); err != nil {
			logger.Error("audit loto generation", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			logger.Error("commit loto generation", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		type setOut struct {
			ID           string  `json:"id"`
			Rank         int     `json:"rank"`
			MainNumbers  []int   `json:"mainNumbers"`
			BonusNumbers []int   `json:"bonusNumbers"`
			Score        float64 `json:"score"`
		}
		sets := make([]setOut, 0, len(run.Sets))
		for _, set := range run.Sets {
			sets = append(sets, setOut{ID: set.ID, Rank: set.Rank, MainNumbers: set.Main, BonusNumbers: nonNilIntSlice(set.Bonus), Score: set.Score})
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"id": run.ID, "game": string(game), "targetDrawDate": targetKey, "status": "generated",
			"seed": seed, "japaneseSentence": run.Sentence, "sets": sets,
		})
	}
}

func nonNilIntSlice(values []int) []int {
	if values == nil {
		return []int{}
	}
	return values
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
		ctx := r.Context()
		tx, err := db.Begin(ctx)
		if err != nil {
			logger.Error("begin loto publish", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(ctx)
		published, err := loto.PublishRun(ctx, tx, req.RunID, req.SetIDs, identity.ActorID, time.Now().UTC())
		switch {
		case errors.Is(err, loto.ErrRunNotFound):
			writeJSONError(w, "generation run not found", http.StatusNotFound)
			return
		case errors.Is(err, loto.ErrDuplicateSet):
			writeJSONError(w, "duplicate setId", http.StatusBadRequest)
			return
		case errors.Is(err, loto.ErrSetNotInRun):
			writeJSONError(w, "generated set not found for run", http.StatusBadRequest)
			return
		case err != nil:
			logger.Error("publish loto to magazine", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := writeAdminAuditWithReason(ctx, tx, identity.ActorID, "admin.magazine.loto.published", "daily.magazine_article", published.ArticleID, "Publish loto generated sets", nil, map[string]any{"runId": req.RunID, "selectedSets": len(req.SetIDs), "status": "published"}); err != nil {
			logger.Error("audit loto publish", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			logger.Error("commit loto publish", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		loto.InvalidateCaches()
		writeJSON(w, http.StatusOK, map[string]any{
			"articleId": published.ArticleID, "slug": published.Slug, "status": "published",
			"publishedAt": published.PublishedAt.UTC().Format(time.RFC3339), "selectedSets": published.SelectedSets,
		})
	}
}
