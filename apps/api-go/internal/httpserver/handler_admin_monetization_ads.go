package httpserver

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/authz"
)

// ── P1-A5.4: Admin Monetization — Ads Sub-Domain (13 routes) ────────────────
// All routes require admin session + appropriate permissions.
// Contracts derived from NestJS apps/api/src/monetization/ads/ads-admin.service.ts
// overview, placements list/create/patch, campaigns list/create/patch,
// providers list/patch, rules list/create, performance, audit.

// adminMonetizationAdsOverviewHandler implements GET /api/admin/monetization/ads/overview.
func adminMonetizationAdsPermissionGuard(db *pgxpool.Pool, permissions []string, next http.HandlerFunc) http.HandlerFunc {
	return authz.RequireAnyPermission(authz.NewStore(db), permissions)(next).ServeHTTP
}

func isValidAdPolicyStatus(value string) bool {
	switch value {
	case "pending", "ok", "warning", "rejected":
		return true
	default:
		return false
	}
}

func decodeAdsRequest(r *http.Request, dst any) error {
	decoder := json.NewDecoder(r.Body)
	if err := decoder.Decode(dst); err != nil {
		return err
	}
	var extra any
	if err := decoder.Decode(&extra); err != io.EOF {
		return fmt.Errorf("request must contain one JSON value")
	}
	return nil
}

func isAdsJSONObject(raw json.RawMessage) bool {
	var object map[string]json.RawMessage
	return json.Unmarshal(raw, &object) == nil && object != nil
}

func adminMonetizationAdsOverviewHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return adminMonetizationAdsPermissionGuard(db, []string{"admin.monetization.read", "ads.placement.view", "ads.campaign.view", "ads.provider.view", "ads.performance.view"}, func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		windowDays := queryInt(r, "windowDays", 7)
		if windowDays < 1 || windowDays > 90 {
			windowDays = 7
		}

		type Overview struct {
			EnabledPlacements int     `json:"enabledPlacements"`
			ActiveCampaigns   int     `json:"activeCampaigns"`
			ProvidersEnabled  int     `json:"providersEnabled"`
			PolicyWarnings    int     `json:"policyWarnings"`
			Impressions       int     `json:"impressions7d"`
			Clicks            int     `json:"clicks7d"`
			Blocked           int     `json:"blocked7d"`
			CTR               float64 `json:"ctr"`
		}

		var ov Overview
		if err := db.QueryRow(ctx, "SELECT COUNT(*) FROM monetization.ad_placement WHERE active = true").Scan(&ov.EnabledPlacements); err != nil {
			logger.Error("count enabled ad placements", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := db.QueryRow(ctx, `SELECT COUNT(*) FROM monetization.ad_campaign
			WHERE status = 'active'
			AND (start_at IS NULL OR start_at <= NOW())
			AND (end_at IS NULL OR end_at >= NOW())`).Scan(&ov.ActiveCampaigns); err != nil {
			logger.Error("count active ad campaigns", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := db.QueryRow(ctx, "SELECT COUNT(*) FROM monetization.ad_provider_config WHERE enabled = true").Scan(&ov.ProvidersEnabled); err != nil {
			logger.Error("count enabled ad providers", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := db.QueryRow(ctx, "SELECT COUNT(*) FROM monetization.ad_campaign WHERE policy_status IN ('warning','rejected')").Scan(&ov.PolicyWarnings); err != nil {
			logger.Error("count ad policy warnings", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		// Impressions/clicks/blocked in window
		since := time.Now().UTC().AddDate(0, 0, -windowDays)
		for _, metric := range []struct {
			query string
			value *int
		}{
			{"SELECT COUNT(*) FROM monetization.ad_impression WHERE created_at >= $1 AND kind NOT IN ('click','dismiss','blocked')", &ov.Impressions},
			{"SELECT COUNT(*) FROM monetization.ad_impression WHERE created_at >= $1 AND kind IN ('click','dismiss')", &ov.Clicks},
			{"SELECT COUNT(*) FROM monetization.ad_impression WHERE created_at >= $1 AND kind = 'blocked'", &ov.Blocked},
		} {
			if err := db.QueryRow(ctx, metric.query, since).Scan(metric.value); err != nil {
				logger.Error("count ad performance events", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
		}
		if ov.Impressions > 0 {
			ov.CTR = float64(ov.Clicks) / float64(ov.Impressions)
		}

		writeJSON(w, http.StatusOK, ov)
	})
}

// adminMonetizationAdsPlacementsListHandler implements GET /api/admin/monetization/ads/placements.
func adminMonetizationAdsPlacementsListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return adminMonetizationAdsPermissionGuard(db, []string{"admin.monetization.read", "ads.placement.view"}, func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		rows, err := db.Query(ctx, `
			SELECT id, code, label_key, active, config, created_at, updated_at
			FROM monetization.ad_placement
			ORDER BY code ASC`)
		if err != nil {
			logger.Error("list ad placements", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type Placement struct {
			ID        string          `json:"id"`
			Code      string          `json:"code"`
			Name      *string         `json:"name,omitempty"`
			Active    bool            `json:"active"`
			Config    json.RawMessage `json:"config,omitempty"`
			CreatedAt string          `json:"createdAt"`
			UpdatedAt string          `json:"updatedAt"`
		}
		var items []Placement
		for rows.Next() {
			var p Placement
			var createdAt, updatedAt time.Time
			var configBytes []byte
			if err := rows.Scan(&p.ID, &p.Code, &p.Name, &p.Active, &configBytes, &createdAt, &updatedAt); err != nil {
				logger.Error("scan ad placement", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			p.CreatedAt = createdAt.UTC().Format(time.RFC3339)
			p.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
			p.Config = configBytes
			items = append(items, p)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate ad placements", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if items == nil {
			items = []Placement{}
		}
		writeJSON(w, http.StatusOK, items)
	})
}

// adminMonetizationAdsPlacementsCreateHandler implements POST /api/admin/monetization/ads/placements.
func adminMonetizationAdsPlacementsCreateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return adminMonetizationAdsPermissionGuard(db, []string{"admin.monetization.write", "ads.placement.manage"}, func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			Code     string          `json:"code"`
			Name     *string         `json:"name,omitempty"`
			LabelKey *string         `json:"labelKey,omitempty"`
			Active   *bool           `json:"active,omitempty"`
			Config   json.RawMessage `json:"config,omitempty"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		req.Code = strings.TrimSpace(req.Code)
		if req.Code == "" || len(req.Code) > 64 {
			writeJSONError(w, "code is required", http.StatusBadRequest)
			return
		}
		active := true
		if req.Active != nil {
			active = *req.Active
		}
		configJSON := req.Config
		if configJSON == nil {
			configJSON = json.RawMessage("{}")
		}
		ctx := r.Context()
		tx, err := db.Begin(ctx)
		if err != nil {
			logger.Error("begin create ad placement", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(ctx)
		var createdID string
		labelKey := req.LabelKey
		if labelKey == nil {
			labelKey = req.Name
		}
		err = tx.QueryRow(ctx, `
			INSERT INTO monetization.ad_placement (code, label_key, active, config, created_at, updated_at)
			VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING id`,
			req.Code, labelKey, active, configJSON).Scan(&createdID)
		if err != nil {
			logger.Error("create ad placement", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		afterJSON, _ := json.Marshal(map[string]any{"code": req.Code, "active": active})
		if _, err := tx.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('admin.ads.placement.created', $1, $2, 'monetization.ad_placement', $3, $4, NOW())`,
			identity.ActorID, createdID, "ad placement created", afterJSON); err != nil {
			logger.Error("audit ad placement creation", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			logger.Error("commit ad placement creation", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusCreated, map[string]any{"id": createdID, "code": req.Code, "active": active})
	})
}

// adminMonetizationAdsPlacementsPatchHandler implements PATCH /api/admin/monetization/ads/placements/{id}.
func adminMonetizationAdsPlacementsPatchHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return adminMonetizationAdsPermissionGuard(db, []string{"admin.monetization.write", "ads.placement.manage"}, func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "placements", 1)
		if id == "" {
			writeJSONError(w, "placement id required", http.StatusBadRequest)
			return
		}
		if !isValidUUID(id) {
			writeJSONError(w, "invalid placement id", http.StatusBadRequest)
			return
		}
		var req struct {
			Active   *bool           `json:"active,omitempty"`
			Config   json.RawMessage `json:"config,omitempty"`
			Name     *string         `json:"name,omitempty"`
			LabelKey *string         `json:"labelKey,omitempty"`
		}
		if err := decodeAdsRequest(r, &req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		labelKey := req.LabelKey
		if labelKey == nil {
			labelKey = req.Name
		}
		if labelKey != nil {
			trimmed := strings.TrimSpace(*labelKey)
			if trimmed == "" || len(trimmed) > 160 {
				writeJSONError(w, "invalid labelKey", http.StatusBadRequest)
				return
			}
			labelKey = &trimmed
		}
		if req.Config != nil && !isAdsJSONObject(req.Config) {
			writeJSONError(w, "config must be an object", http.StatusBadRequest)
			return
		}
		if req.Active == nil && req.Config == nil && labelKey == nil {
			writeJSONError(w, "at least one field to update is required", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		tx, err := db.Begin(ctx)
		if err != nil {
			logger.Error("begin patch ad placement", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(ctx)
		setClauses, args := []string{}, []any{}
		argIdx := 1
		if req.Active != nil {
			setClauses = append(setClauses, "active = $"+itoa(argIdx))
			args = append(args, *req.Active)
			argIdx++
		}
		if req.Config != nil {
			setClauses = append(setClauses, "config = $"+itoa(argIdx))
			args = append(args, req.Config)
			argIdx++
		}
		if labelKey != nil {
			setClauses = append(setClauses, "label_key = $"+itoa(argIdx))
			args = append(args, *labelKey)
			argIdx++
		}
		setClauses = append(setClauses, "updated_at = NOW()")
		query := "UPDATE monetization.ad_placement SET " + joinStrings(setClauses, ", ") +
			" WHERE id = $" + itoa(argIdx) + " RETURNING id"
		args = append(args, id)
		var updatedID string
		if err := tx.QueryRow(ctx, query, args...).Scan(&updatedID); errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "placement not found", http.StatusNotFound)
			return
		} else if err != nil {
			logger.Error("patch ad placement", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		afterJSON, _ := json.Marshal(map[string]any{"updated": true})
		beforeJSON, _ := json.Marshal(map[string]any{"id": id})
		if _, err := tx.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, before, created_at)
			VALUES ('admin.ads.placement.updated', $1, $2, 'monetization.ad_placement', $3, $4, $5, NOW())`,
			identity.ActorID, id, "ad placement updated", afterJSON, beforeJSON); err != nil {
			logger.Error("audit ad placement update", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			logger.Error("commit ad placement update", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"id": id, "updated": true})
	})
}

// adminMonetizationAdsCampaignsListHandler implements GET /api/admin/monetization/ads/campaigns.
func adminMonetizationAdsCampaignsListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return adminMonetizationAdsPermissionGuard(db, []string{"admin.monetization.read", "ads.campaign.view"}, func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		statusFilter := r.URL.Query().Get("status")
		page := queryInt(r, "page", 1)
		pageSize := queryInt(r, "pageSize", 20)
		if page < 1 {
			page = 1
		}
		if pageSize < 1 || pageSize > 100 {
			pageSize = 20
		}
		offset := (page - 1) * pageSize

		whereParts := []string{}
		args := []any{}
		argIdx := 1
		if statusFilter != "" {
			whereParts = append(whereParts, fmt.Sprintf("status = $%d", argIdx))
			args = append(args, statusFilter)
			argIdx++
		}
		whereClause := ""
		if len(whereParts) > 0 {
			whereClause = "WHERE " + strings.Join(whereParts, " AND ")
		}

		countQuery := "SELECT COUNT(*) FROM monetization.ad_campaign " + whereClause
		var total int
		if err := db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
			logger.Error("count ad campaigns", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		dataQuery := fmt.Sprintf(`
			SELECT id, name, status, provider_key, placement_codes, start_at, end_at,
				priority, creative_type, destination_url, target_locale, target_plan_slug,
				max_impressions, policy_status, created_at, updated_at
			FROM monetization.ad_campaign %s
			ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
			whereClause, argIdx, argIdx+1)
		args = append(args, pageSize, offset)
		rows, err := db.Query(ctx, dataQuery, args...)
		if err != nil {
			logger.Error("list ad campaigns", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type Campaign struct {
			ID             string          `json:"id"`
			Name           string          `json:"name"`
			Status         string          `json:"status"`
			ProviderKey    string          `json:"providerKey"`
			PlacementCodes json.RawMessage `json:"placementCodes"`
			StartAt        *string         `json:"startAt,omitempty"`
			EndAt          *string         `json:"endAt,omitempty"`
			Priority       int             `json:"priority"`
			CreativeType   string          `json:"creativeType"`
			DestinationURL *string         `json:"destinationUrl,omitempty"`
			TargetLocale   *string         `json:"targetLocale,omitempty"`
			TargetPlanSlug *string         `json:"targetPlanSlug,omitempty"`
			MaxImpressions *int            `json:"maxImpressions,omitempty"`
			PolicyStatus   string          `json:"policyStatus"`
			CreatedAt      string          `json:"createdAt"`
			UpdatedAt      string          `json:"updatedAt"`
		}
		var items []Campaign
		for rows.Next() {
			var c Campaign
			var startAt, endAt *time.Time
			var createdAt, updatedAt time.Time
			if err := rows.Scan(&c.ID, &c.Name, &c.Status, &c.ProviderKey, &c.PlacementCodes,
				&startAt, &endAt, &c.Priority, &c.CreativeType, &c.DestinationURL, &c.TargetLocale,
				&c.TargetPlanSlug, &c.MaxImpressions, &c.PolicyStatus, &createdAt, &updatedAt); err != nil {
				logger.Error("scan ad campaign", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			if c.PlacementCodes == nil {
				c.PlacementCodes = json.RawMessage("[]")
			}
			if startAt != nil {
				s := startAt.UTC().Format(time.RFC3339)
				c.StartAt = &s
			}
			if endAt != nil {
				s := endAt.UTC().Format(time.RFC3339)
				c.EndAt = &s
			}
			c.CreatedAt = createdAt.UTC().Format(time.RFC3339)
			c.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
			items = append(items, c)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate ad campaigns", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if items == nil {
			items = []Campaign{}
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"items":    items,
			"page":     page,
			"pageSize": pageSize,
			"total":    total,
		})
	})
}

// adminMonetizationAdsCampaignsCreateHandler implements POST /api/admin/monetization/ads/campaigns.
func adminMonetizationAdsCampaignsCreateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return adminMonetizationAdsPermissionGuard(db, []string{"admin.monetization.write", "ads.campaign.manage"}, func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			Name           string   `json:"name"`
			Status         *string  `json:"status,omitempty"`
			ProviderKey    string   `json:"providerKey"`
			PlacementCodes []string `json:"placementCodes,omitempty"`
			StartAt        *string  `json:"startAt,omitempty"`
			EndAt          *string  `json:"endAt,omitempty"`
			Priority       *int     `json:"priority,omitempty"`
			CreativeType   *string  `json:"creativeType,omitempty"`
			DestinationURL *string  `json:"destinationUrl,omitempty"`
			TargetLocale   *string  `json:"targetLocale,omitempty"`
			TargetPlanSlug *string  `json:"targetPlanSlug,omitempty"`
			MaxImpressions *int     `json:"maxImpressions,omitempty"`
			PolicyStatus   *string  `json:"policyStatus,omitempty"`
			Reason         string   `json:"reason,omitempty"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		req.Name = strings.TrimSpace(req.Name)
		req.ProviderKey = strings.TrimSpace(req.ProviderKey)
		if req.Name == "" || req.ProviderKey == "" {
			writeJSONError(w, "name and providerKey are required", http.StatusBadRequest)
			return
		}
		if len(req.Name) > 200 || len(req.ProviderKey) > 64 || (req.MaxImpressions != nil && *req.MaxImpressions < 0) {
			writeJSONError(w, "invalid campaign fields", http.StatusBadRequest)
			return
		}
		status := "draft"
		if req.Status != nil {
			status = strings.TrimSpace(*req.Status)
			if status == "" {
				writeJSONError(w, "status cannot be empty", http.StatusBadRequest)
				return
			}
		}
		priority, creativeType, policyStatus := 0, "placeholder", "pending"
		if req.Priority != nil {
			priority = *req.Priority
		}
		if req.CreativeType != nil {
			creativeType = strings.TrimSpace(*req.CreativeType)
			if creativeType == "" {
				writeJSONError(w, "creativeType cannot be empty", http.StatusBadRequest)
				return
			}
		}
		if req.PolicyStatus != nil {
			policyStatus = strings.TrimSpace(*req.PolicyStatus)
			if !isValidAdPolicyStatus(policyStatus) {
				writeJSONError(w, "invalid policyStatus", http.StatusBadRequest)
				return
			}
		}
		parseDate := func(value *string) (*time.Time, error) {
			if value == nil {
				return nil, nil
			}
			parsed, err := time.Parse(time.RFC3339Nano, *value)
			if err != nil {
				return nil, err
			}
			return &parsed, nil
		}
		startAt, err := parseDate(req.StartAt)
		if err != nil {
			writeJSONError(w, "invalid startAt", http.StatusBadRequest)
			return
		}
		endAt, err := parseDate(req.EndAt)
		if err != nil || (startAt != nil && endAt != nil && !endAt.After(*startAt)) {
			writeJSONError(w, "invalid endAt", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		tx, err := db.Begin(ctx)
		if err != nil {
			logger.Error("begin create ad campaign", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(ctx)
		var createdID string
		if req.PlacementCodes == nil {
			req.PlacementCodes = []string{}
		}
		placementCodesJSON, err := json.Marshal(req.PlacementCodes)
		if err != nil {
			writeJSONError(w, "invalid placementCodes", http.StatusBadRequest)
			return
		}
		err = tx.QueryRow(ctx, `
			INSERT INTO monetization.ad_campaign (name, status, policy_status, provider_key, placement_codes,
				start_at, end_at, creative_type, priority, destination_url, target_locale, target_plan_slug,
				max_impressions, created_at, updated_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW(),NOW()) RETURNING id`,
			req.Name, status, policyStatus, req.ProviderKey, placementCodesJSON,
			startAt, endAt, creativeType, priority, req.DestinationURL, req.TargetLocale,
			req.TargetPlanSlug, req.MaxImpressions).Scan(&createdID)
		if err != nil {
			logger.Error("create ad campaign", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		afterJSON, _ := json.Marshal(map[string]any{"name": req.Name, "status": status})
		if _, err := tx.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('admin.ads.campaign.created', $1, $2, 'monetization.ad_campaign', $3, $4, NOW())`,
			identity.ActorID, createdID, req.Reason, afterJSON); err != nil {
			logger.Error("audit ad campaign creation", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			logger.Error("commit ad campaign creation", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusCreated, map[string]any{"id": createdID, "name": req.Name, "status": status})
	})
}

// adminMonetizationAdsCampaignsPatchHandler implements PATCH /api/admin/monetization/ads/campaigns/{id}.
func adminMonetizationAdsCampaignsPatchHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return adminMonetizationAdsPermissionGuard(db, []string{"admin.monetization.write", "ads.campaign.manage"}, func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "campaigns", 1)
		if id == "" {
			writeJSONError(w, "campaign id required", http.StatusBadRequest)
			return
		}
		if !isValidUUID(id) {
			writeJSONError(w, "invalid campaign id", http.StatusBadRequest)
			return
		}
		var req struct {
			Status         *string   `json:"status,omitempty"`
			PolicyStatus   *string   `json:"policyStatus,omitempty"`
			Name           *string   `json:"name,omitempty"`
			ProviderKey    *string   `json:"providerKey,omitempty"`
			PlacementCodes *[]string `json:"placementCodes,omitempty"`
			StartAt        *string   `json:"startAt,omitempty"`
			EndAt          *string   `json:"endAt,omitempty"`
			Priority       *int      `json:"priority,omitempty"`
			CreativeType   *string   `json:"creativeType,omitempty"`
			DestinationURL *string   `json:"destinationUrl,omitempty"`
			TargetLocale   *string   `json:"targetLocale,omitempty"`
			TargetPlanSlug *string   `json:"targetPlanSlug,omitempty"`
			MaxImpressions *int      `json:"maxImpressions,omitempty"`
			Reason         string    `json:"reason,omitempty"`
		}
		body, err := io.ReadAll(r.Body)
		if err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		var fields map[string]json.RawMessage
		if err := json.Unmarshal(body, &fields); err != nil || json.Unmarshal(body, &req) != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		fieldSet := func(name string) bool { _, ok := fields[name]; return ok }
		if req.Name != nil {
			trimmed := strings.TrimSpace(*req.Name)
			if trimmed == "" || len(trimmed) > 200 {
				writeJSONError(w, "invalid name", http.StatusBadRequest)
				return
			}
			req.Name = &trimmed
		}
		if req.Status != nil && strings.TrimSpace(*req.Status) == "" {
			writeJSONError(w, "status fields cannot be empty", http.StatusBadRequest)
			return
		}
		if req.PolicyStatus != nil && !isValidAdPolicyStatus(strings.TrimSpace(*req.PolicyStatus)) {
			writeJSONError(w, "invalid policyStatus", http.StatusBadRequest)
			return
		}
		if req.ProviderKey != nil {
			trimmed := strings.TrimSpace(*req.ProviderKey)
			if trimmed == "" || len(trimmed) > 64 {
				writeJSONError(w, "invalid providerKey", http.StatusBadRequest)
				return
			}
			req.ProviderKey = &trimmed
		}
		if req.MaxImpressions != nil && *req.MaxImpressions < 0 {
			writeJSONError(w, "invalid maxImpressions", http.StatusBadRequest)
			return
		}
		parseDate := func(value *string) (*time.Time, error) {
			if value == nil {
				return nil, nil
			}
			parsed, err := time.Parse(time.RFC3339Nano, *value)
			if err != nil {
				return nil, err
			}
			return &parsed, nil
		}
		startAt, err := parseDate(req.StartAt)
		if err != nil {
			writeJSONError(w, "invalid startAt", http.StatusBadRequest)
			return
		}
		endAt, err := parseDate(req.EndAt)
		if err != nil || (startAt != nil && endAt != nil && !endAt.After(*startAt)) {
			writeJSONError(w, "invalid endAt", http.StatusBadRequest)
			return
		}
		if req.CreativeType != nil && strings.TrimSpace(*req.CreativeType) == "" {
			writeJSONError(w, "invalid creativeType", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		tx, err := db.Begin(ctx)
		if err != nil {
			logger.Error("begin patch ad campaign", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(ctx)
		var currentStartAt, currentEndAt *time.Time
		if err := tx.QueryRow(ctx, "SELECT start_at, end_at FROM monetization.ad_campaign WHERE id::text = $1 FOR UPDATE", id).Scan(&currentStartAt, &currentEndAt); err != nil {
			if err == pgx.ErrNoRows {
				writeJSONError(w, "campaign not found", http.StatusNotFound)
				return
			}
			logger.Error("check ad campaign", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		effectiveStartAt, effectiveEndAt := currentStartAt, currentEndAt
		if fieldSet("startAt") {
			effectiveStartAt = startAt
		}
		if fieldSet("endAt") {
			effectiveEndAt = endAt
		}
		if effectiveStartAt != nil && effectiveEndAt != nil && !effectiveEndAt.After(*effectiveStartAt) {
			writeJSONError(w, "invalid endAt", http.StatusBadRequest)
			return
		}
		setClauses := []string{}
		args := []any{}
		argIdx := 1
		if req.Status != nil {
			setClauses = append(setClauses, "status = $"+itoa(argIdx))
			args = append(args, *req.Status)
			argIdx++
		}
		if req.PolicyStatus != nil {
			setClauses = append(setClauses, "policy_status = $"+itoa(argIdx))
			args = append(args, *req.PolicyStatus)
			argIdx++
		}
		if req.Name != nil {
			setClauses = append(setClauses, "name = $"+itoa(argIdx))
			args = append(args, *req.Name)
			argIdx++
		}
		if fieldSet("startAt") {
			setClauses = append(setClauses, "start_at = $"+itoa(argIdx))
			args = append(args, startAt)
			argIdx++
		}
		if fieldSet("endAt") {
			setClauses = append(setClauses, "end_at = $"+itoa(argIdx))
			args = append(args, endAt)
			argIdx++
		}
		if req.ProviderKey != nil {
			setClauses = append(setClauses, "provider_key = $"+itoa(argIdx))
			args = append(args, *req.ProviderKey)
			argIdx++
		}
		if req.PlacementCodes != nil {
			codes, err := json.Marshal(*req.PlacementCodes)
			if err != nil {
				writeJSONError(w, "invalid placementCodes", http.StatusBadRequest)
				return
			}
			setClauses = append(setClauses, "placement_codes = $"+itoa(argIdx))
			args = append(args, codes)
			argIdx++
		}
		if req.Priority != nil {
			setClauses = append(setClauses, "priority = $"+itoa(argIdx))
			args = append(args, *req.Priority)
			argIdx++
		}
		if req.CreativeType != nil {
			setClauses = append(setClauses, "creative_type = $"+itoa(argIdx))
			args = append(args, strings.TrimSpace(*req.CreativeType))
			argIdx++
		}
		for _, field := range []struct {
			name   string
			column string
			value  *string
		}{
			{"destinationUrl", "destination_url", req.DestinationURL},
			{"targetLocale", "target_locale", req.TargetLocale},
			{"targetPlanSlug", "target_plan_slug", req.TargetPlanSlug},
		} {
			if fieldSet(field.name) {
				setClauses = append(setClauses, field.column+" = $"+itoa(argIdx))
				if field.value == nil {
					args = append(args, nil)
				} else {
					args = append(args, *field.value)
				}
				argIdx++
			}
		}
		if fieldSet("maxImpressions") {
			setClauses = append(setClauses, "max_impressions = $"+itoa(argIdx))
			if req.MaxImpressions == nil {
				args = append(args, nil)
			} else {
				args = append(args, *req.MaxImpressions)
			}
			argIdx++
		}
		if len(setClauses) == 0 {
			writeJSONError(w, "at least one field to update is required", http.StatusBadRequest)
			return
		}
		setClauses = append(setClauses, "updated_at = NOW()")
		query := "UPDATE monetization.ad_campaign SET " + joinStrings(setClauses, ", ") +
			" WHERE id = $" + itoa(argIdx)
		args = append(args, id)
		if _, err := tx.Exec(ctx, query, args...); err != nil {
			logger.Error("patch ad campaign", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		afterJSON, _ := json.Marshal(map[string]any{"updated": true})
		beforeJSON, _ := json.Marshal(map[string]any{"id": id})
		if _, err := tx.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, before, created_at)
			VALUES ('admin.ads.campaign.updated', $1, $2, 'monetization.ad_campaign', $3, $4, $5, NOW())`,
			identity.ActorID, id, req.Reason, afterJSON, beforeJSON); err != nil {
			logger.Error("audit ad campaign update", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			logger.Error("commit ad campaign update", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"id": id, "updated": true})
	})
}

// adminMonetizationAdsProvidersListHandler implements GET /api/admin/monetization/ads/providers.
func adminMonetizationAdsProvidersListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return adminMonetizationAdsPermissionGuard(db, []string{"admin.monetization.read", "ads.provider.view"}, func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		rows, err := db.Query(ctx, `
			SELECT id, key, type, enabled, status, config, last_sync_at, created_at, updated_at
			FROM monetization.ad_provider_config
			ORDER BY key ASC`)
		if err != nil {
			logger.Error("list ad providers", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type Provider struct {
			ID         string          `json:"id"`
			Key        string          `json:"key"`
			Type       string          `json:"type"`
			Enabled    bool            `json:"enabled"`
			Status     string          `json:"status"`
			Config     json.RawMessage `json:"config"`
			LastSyncAt *string         `json:"lastSyncAt,omitempty"`
			CreatedAt  string          `json:"createdAt"`
			UpdatedAt  string          `json:"updatedAt"`
		}
		var items []Provider
		for rows.Next() {
			var p Provider
			var lastSyncAt *time.Time
			var createdAt, updatedAt time.Time
			if err := rows.Scan(&p.ID, &p.Key, &p.Type, &p.Enabled, &p.Status, &p.Config, &lastSyncAt, &createdAt, &updatedAt); err != nil {
				logger.Error("scan ad provider", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			if lastSyncAt != nil {
				formatted := lastSyncAt.UTC().Format(time.RFC3339)
				p.LastSyncAt = &formatted
			}
			p.CreatedAt = createdAt.UTC().Format(time.RFC3339)
			p.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
			items = append(items, p)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate ad providers", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if items == nil {
			items = []Provider{}
		}
		writeJSON(w, http.StatusOK, items)
	})
}

// adminMonetizationAdsProvidersPatchHandler implements PATCH /api/admin/monetization/ads/providers/{key}.
func adminMonetizationAdsProvidersPatchHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return adminMonetizationAdsPermissionGuard(db, []string{"admin.monetization.write", "ads.provider.manage"}, func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		key := extractPathParam(r.URL.Path, "providers", 1)
		if key == "" {
			writeJSONError(w, "provider key required", http.StatusBadRequest)
			return
		}
		var req struct {
			Enabled    *bool           `json:"enabled,omitempty"`
			Status     *string         `json:"status,omitempty"`
			Config     json.RawMessage `json:"config,omitempty"`
			LastSyncAt json.RawMessage `json:"lastSyncAt,omitempty"`
			Reason     string          `json:"reason,omitempty"`
		}
		if err := decodeAdsRequest(r, &req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.Status != nil {
			*req.Status = strings.TrimSpace(*req.Status)
			if !isValidAdPolicyStatus(*req.Status) {
				writeJSONError(w, "invalid status", http.StatusBadRequest)
				return
			}
		}
		if req.Config != nil && !isAdsJSONObject(req.Config) {
			writeJSONError(w, "config must be an object", http.StatusBadRequest)
			return
		}
		var lastSyncAt any
		if req.LastSyncAt != nil {
			if string(req.LastSyncAt) != "null" {
				var value string
				if err := json.Unmarshal(req.LastSyncAt, &value); err != nil {
					writeJSONError(w, "invalid lastSyncAt", http.StatusBadRequest)
					return
				}
				parsed, err := time.Parse(time.RFC3339, value)
				if err != nil {
					writeJSONError(w, "invalid lastSyncAt", http.StatusBadRequest)
					return
				}
				lastSyncAt = parsed
			}
		}
		if req.Enabled == nil && req.Status == nil && req.Config == nil && req.LastSyncAt == nil {
			writeJSONError(w, "at least one field to update is required", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		tx, err := db.Begin(ctx)
		if err != nil {
			logger.Error("begin patch ad provider", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(ctx)
		setClauses, args := []string{}, []any{}
		argIdx := 1
		if req.Enabled != nil {
			setClauses = append(setClauses, "enabled = $"+itoa(argIdx))
			args = append(args, *req.Enabled)
			argIdx++
		}
		if req.Status != nil {
			setClauses = append(setClauses, "status = $"+itoa(argIdx))
			args = append(args, *req.Status)
			argIdx++
		}
		if req.Config != nil {
			setClauses = append(setClauses, "config = $"+itoa(argIdx))
			args = append(args, req.Config)
			argIdx++
		}
		if req.LastSyncAt != nil {
			setClauses = append(setClauses, "last_sync_at = $"+itoa(argIdx))
			args = append(args, lastSyncAt)
			argIdx++
		}
		setClauses = append(setClauses, "updated_at = NOW()")
		query := "UPDATE monetization.ad_provider_config SET " + joinStrings(setClauses, ", ") +
			" WHERE key = $" + itoa(argIdx) + " RETURNING key"
		args = append(args, key)
		var updatedKey string
		if err := tx.QueryRow(ctx, query, args...).Scan(&updatedKey); errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "provider not found", http.StatusNotFound)
			return
		} else if err != nil {
			logger.Error("patch ad provider", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		afterJSON, _ := json.Marshal(map[string]any{"updated": true})
		beforeJSON, _ := json.Marshal(map[string]any{"key": key})
		if _, err := tx.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, before, created_at)
			VALUES ('admin.ads.provider.updated', $1, $2, 'monetization.ad_provider_config', $3, $4, $5, NOW())`,
			identity.ActorID, key, req.Reason, afterJSON, beforeJSON); err != nil {
			logger.Error("audit ad provider update", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			logger.Error("commit ad provider update", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"key": key, "updated": true})
	})
}

// adminMonetizationAdsRulesListHandler implements GET /api/admin/monetization/ads/rules.
func adminMonetizationAdsRulesListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return adminMonetizationAdsPermissionGuard(db, []string{"admin.monetization.read", "ads.rules.manage"}, func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		rows, err := db.Query(ctx, `
			SELECT id, rule_key, enabled, config, updated_at
			FROM monetization.ad_safety_rule
			ORDER BY updated_at DESC`)
		if err != nil {
			logger.Error("list ad safety rules", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type Rule struct {
			ID        string `json:"id"`
			Name      string `json:"name"`
			RuleType  string `json:"ruleType"`
			Condition string `json:"condition"`
			Action    string `json:"action"`
			Priority  int    `json:"priority"`
			Active    bool   `json:"active"`
			UpdatedAt string `json:"updatedAt"`
		}
		var items []Rule
		for rows.Next() {
			var rl Rule
			var enabled bool
			var config json.RawMessage
			var updatedAt time.Time
			if err := rows.Scan(&rl.ID, &rl.Name, &enabled, &config, &updatedAt); err != nil {
				logger.Error("scan ad safety rule", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			var fields struct {
				RuleType  string `json:"ruleType"`
				Condition string `json:"condition"`
				Action    string `json:"action"`
				Priority  int    `json:"priority"`
			}
			if err := json.Unmarshal(config, &fields); err != nil {
				logger.Error("decode ad safety rule config", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			rl.RuleType, rl.Condition, rl.Action, rl.Priority = fields.RuleType, fields.Condition, fields.Action, fields.Priority
			rl.Active = enabled
			rl.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
			items = append(items, rl)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate ad safety rules", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if items == nil {
			items = []Rule{}
		}
		writeJSON(w, http.StatusOK, items)
	})
}

// adminMonetizationAdsRulesCreateHandler implements POST /api/admin/monetization/ads/rules.
func adminMonetizationAdsRulesCreateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return adminMonetizationAdsPermissionGuard(db, []string{"admin.monetization.write", "ads.rules.manage"}, func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			Name      string `json:"name"`
			RuleType  string `json:"ruleType"`
			Condition string `json:"condition"`
			Action    string `json:"action"`
			Priority  *int   `json:"priority,omitempty"`
			Reason    string `json:"reason,omitempty"`
		}
		if err := decodeAdsRequest(r, &req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		req.Name = strings.TrimSpace(req.Name)
		req.RuleType = strings.TrimSpace(req.RuleType)
		req.Condition = strings.TrimSpace(req.Condition)
		req.Action = strings.TrimSpace(req.Action)
		req.Reason = strings.TrimSpace(req.Reason)
		if req.Name == "" || len(req.Name) > 120 || req.RuleType == "" || req.Condition == "" || req.Action == "" || (req.Priority != nil && *req.Priority < 0) {
			writeJSONError(w, "invalid safety rule", http.StatusBadRequest)
			return
		}
		ruleConfig := map[string]any{
			"ruleType":  req.RuleType,
			"condition": req.Condition,
			"action":    req.Action,
		}
		if req.Priority != nil {
			ruleConfig["priority"] = *req.Priority
		}
		configJSON, _ := json.Marshal(ruleConfig)
		ctx := r.Context()
		tx, err := db.Begin(ctx)
		if err != nil {
			logger.Error("begin create ad safety rule", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(ctx)
		var createdID string
		err = tx.QueryRow(ctx, `
			INSERT INTO monetization.ad_safety_rule (rule_key, enabled, config, updated_at)
			VALUES ($1, true, $2, NOW()) RETURNING id`,
			req.Name, configJSON).Scan(&createdID)
		if err != nil {
			logger.Error("create ad safety rule", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		afterJSON, _ := json.Marshal(map[string]any{"name": req.Name, "ruleType": req.RuleType})
		if _, err := tx.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('admin.ads.rule.created', $1, $2, 'monetization.ad_safety_rule', $3, $4, NOW())`,
			identity.ActorID, createdID, req.Reason, afterJSON); err != nil {
			logger.Error("audit ad safety rule creation", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			logger.Error("commit ad safety rule creation", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusCreated, map[string]any{"id": createdID, "name": req.Name})
	})
}

// adminMonetizationAdsPerformanceHandler implements GET /api/admin/monetization/ads/performance.
func adminMonetizationAdsPerformanceHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return adminMonetizationAdsPermissionGuard(db, []string{"admin.monetization.read", "ads.performance.view"}, func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		windowDays := queryInt(r, "windowDays", 7)
		if windowDays < 1 || windowDays > 90 {
			windowDays = 7
		}
		since := time.Now().UTC().AddDate(0, 0, -windowDays)

		type Totals struct {
			Impressions int     `json:"impressions"`
			Clicks      int     `json:"clicks"`
			Blocked     int     `json:"blocked"`
			CTR         float64 `json:"ctr"`
		}
		type Performance struct {
			WindowDays int    `json:"windowDays"`
			Totals     Totals `json:"totals"`
		}

		var p Performance
		p.WindowDays = windowDays
		for _, metric := range []struct {
			query string
			value *int
		}{
			{"SELECT COUNT(*) FROM monetization.ad_impression WHERE created_at >= $1 AND kind NOT IN ('click','dismiss','blocked')", &p.Totals.Impressions},
			{"SELECT COUNT(*) FROM monetization.ad_impression WHERE created_at >= $1 AND kind IN ('click','dismiss')", &p.Totals.Clicks},
			{"SELECT COUNT(*) FROM monetization.ad_impression WHERE created_at >= $1 AND kind = 'blocked'", &p.Totals.Blocked},
		} {
			if err := db.QueryRow(ctx, metric.query, since).Scan(metric.value); err != nil {
				logger.Error("count ad performance events", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
		}
		if p.Totals.Impressions > 0 {
			p.Totals.CTR = float64(p.Totals.Clicks) / float64(p.Totals.Impressions)
		}

		writeJSON(w, http.StatusOK, p)
	})
}

// adminMonetizationAdsAuditHandler implements GET /api/admin/monetization/ads/audit.
func adminMonetizationAdsAuditHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return adminMonetizationAdsPermissionGuard(db, []string{"admin.monetization.read", "ads.audit.view", "viewer.audit"}, func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		take := queryInt(r, "take", 50)
		if take < 1 || take > 200 {
			take = 50
		}

		type AuditItem struct {
			ID         string  `json:"id"`
			Action     string  `json:"action"`
			ActorID    *string `json:"actorId,omitempty"`
			TargetID   *string `json:"targetId,omitempty"`
			TargetType *string `json:"targetType,omitempty"`
			At         string  `json:"at"`
		}

		rows, err := db.Query(ctx, `
			SELECT id, action, actor_id, target_id, target_type, created_at
			FROM ops.admin_audit_log
			WHERE action ILIKE 'admin.ads.%'
			ORDER BY created_at DESC LIMIT $1`, take)
		if err != nil {
			logger.Error("list ads audit", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		var items []AuditItem
		for rows.Next() {
			var ai AuditItem
			var ts time.Time
			if err := rows.Scan(&ai.ID, &ai.Action, &ai.ActorID, &ai.TargetID, &ai.TargetType, &ts); err != nil {
				logger.Error("scan Ads audit row", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			ai.At = ts.UTC().Format(time.RFC3339)
			items = append(items, ai)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate Ads audit rows", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if items == nil {
			items = []AuditItem{}
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": items})
	})
}

// Ensure fmt is used.
var _ = fmt.Sprintf
