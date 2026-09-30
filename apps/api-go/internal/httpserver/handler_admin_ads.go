package httpserver

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
)

// ── P1-A10: Admin Ads — Overview + Placements + Campaigns + Providers + Rules + Performance + Audit (13 routes) ──
// Contracts derived from NestJS ads-admin.controller.ts and ads-admin.service.ts.
// DB tables: monetization.ad_placement, monetization.ad_campaign, monetization.ad_provider_config,
// monetization.ad_safety_rule, monetization.ad_impression, admin.admin_audit_log.

// ── Overview ────────────────────────────────────────────────────────────────

// adminAdsOverviewHandler implements GET /api/admin/ads/overview.
func adminAdsOverviewHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		days := queryInt(r, "days", 7)
		if days < 1 {
			days = 7
		}
		if days > 90 {
			days = 90
		}

		interval := fmt.Sprintf("%d days", days)

		var enabledPlacements, activeCampaigns, providersEnabled, policyWarnings int
		db.QueryRow(r.Context(), "SELECT COUNT(*) FROM monetization.ad_placement WHERE active = true").Scan(&enabledPlacements)
		db.QueryRow(r.Context(), `SELECT COUNT(*) FROM monetization.ad_campaign
			WHERE status = 'active' AND (start_at IS NULL OR start_at <= NOW()) AND (end_at IS NULL OR end_at >= NOW())`).Scan(&activeCampaigns)
		db.QueryRow(r.Context(), "SELECT COUNT(*) FROM monetization.ad_provider_config WHERE enabled = true").Scan(&providersEnabled)
		db.QueryRow(r.Context(), `SELECT COUNT(*) FROM monetization.ad_campaign WHERE policy_status IN ('warning','rejected')`).Scan(&policyWarnings)

		// Current window impressions
		rows, _ := db.Query(r.Context(), `SELECT kind, placement_id, decision_key, created_at
			FROM monetization.ad_impression WHERE created_at >= NOW() - $1::interval`, interval)
		type Imp struct {
			Kind        string
			PlacementID string
			DecisionKey *string
			CreatedAt   time.Time
		}
		var imps []Imp
		if rows != nil {
			for rows.Next() {
				var i Imp
				if rows.Scan(&i.Kind, &i.PlacementID, &i.DecisionKey, &i.CreatedAt) == nil {
					imps = append(imps, i)
				}
			}
			rows.Close()
		}

		isClick := func(k string) bool { return k == "click" || k == "dismiss" }
		isBlocked := func(k string) bool { return k == "blocked" }
		isImpression := func(k string) bool { return !isClick(k) && !isBlocked(k) }

		impressions7d, clicks7d, blocked7d := 0, 0, 0
		blockedByReason := map[string]int{}
		byPlacement := map[string]struct{ impressions, clicks int }{}
		dayBuckets := map[string]struct{ impressions, clicks int }{}

		for _, i := range imps {
			if isImpression(i.Kind) {
				impressions7d++
			} else if isClick(i.Kind) {
				clicks7d++
			} else if isBlocked(i.Kind) {
				blocked7d++
				if i.DecisionKey != nil {
					blockedByReason[*i.DecisionKey]++
				}
			}
			bp := byPlacement[i.PlacementID]
			if isImpression(i.Kind) {
				bp.impressions++
			} else if isClick(i.Kind) {
				bp.clicks++
			}
			byPlacement[i.PlacementID] = bp

			dayKey := i.CreatedAt.UTC().Format("2006-01-02")
			db := dayBuckets[dayKey]
			if isImpression(i.Kind) {
				db.impressions++
			} else if isClick(i.Kind) {
				db.clicks++
			}
			dayBuckets[dayKey] = db
		}

		ctr := 0.0
		if impressions7d > 0 {
			ctr = float64(clicks7d) / float64(impressions7d)
		}

		// Chart trend
		chartTrend := []map[string]any{}
		for day, v := range dayBuckets {
			chartTrend = append(chartTrend, map[string]any{"day": day, "impressions": v.impressions, "clicks": v.clicks})
		}

		// CTR by placement
		plRows, _ := db.Query(r.Context(), "SELECT id, code FROM monetization.ad_placement")
		placementCodes := map[string]string{}
		if plRows != nil {
			for plRows.Next() {
				var id, code string
				if plRows.Scan(&id, &code) == nil {
					placementCodes[id] = code
				}
			}
			plRows.Close()
		}
		chartCtrByPlacement := []map[string]any{}
		for pid, stats := range byPlacement {
			code := placementCodes[pid]
			if code == "" {
				code = pid
			}
			pctr := 0.0
			if stats.impressions > 0 {
				pctr = float64(stats.clicks) / float64(stats.impressions)
			}
			chartCtrByPlacement = append(chartCtrByPlacement, map[string]any{
				"code": code, "impressions": stats.impressions, "clicks": stats.clicks, "ctr": pctr,
			})
		}

		// Blocked by reason
		bbr := []map[string]any{}
		for reason, count := range blockedByReason {
			bbr = append(bbr, map[string]any{"reason": reason, "count": count})
		}

		// Tasks
		disabledProviders := []map[string]any{}
		dpRows, _ := db.Query(r.Context(), "SELECT key, type, status FROM monetization.ad_provider_config WHERE enabled = false")
		if dpRows != nil {
			for dpRows.Next() {
				var key, typ, status string
				if dpRows.Scan(&key, &typ, &status) == nil {
					disabledProviders = append(disabledProviders, map[string]any{"key": key, "type": typ, "status": status})
				}
			}
			dpRows.Close()
		}

		campaignsEndingSoon := []map[string]any{}
		esRows, _ := db.Query(r.Context(), `SELECT id, name, end_at FROM monetization.ad_campaign
			WHERE status = 'active' AND end_at > NOW() AND end_at < NOW() + INTERVAL '7 days' LIMIT 20`)
		if esRows != nil {
			for esRows.Next() {
				var id, name string
				var ea time.Time
				if esRows.Scan(&id, &name, &ea) == nil {
					campaignsEndingSoon = append(campaignsEndingSoon, map[string]any{"id": id, "name": name, "endAt": ea.UTC().Format(time.RFC3339)})
				}
			}
			esRows.Close()
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"overview": map[string]any{
				"enabledPlacements":    enabledPlacements,
				"activeCampaigns":      activeCampaigns,
				"providersEnabled":     providersEnabled,
				"policyWarnings":       policyWarnings,
				"impressions7d":        impressions7d,
				"clicks7d":             clicks7d,
				"blocked7d":            blocked7d,
				"ctr":                  ctr,
				"chartTrend":           chartTrend,
				"chartCtrByPlacement":  chartCtrByPlacement,
				"blockedByReason":      bbr,
				"revenue":              map[string]any{"available": false, "messageKey": "revenue_provider_not_connected"},
			},
			"tasks": map[string]any{
				"disabledProviders":         disabledProviders,
				"campaignsEndingSoon":       campaignsEndingSoon,
				"placementsWithoutProvider": []string{},
				"policyWarnings":            []map[string]any{},
			},
			"windowDays": days,
		})
	}
}

// ── Placements ──────────────────────────────────────────────────────────────

// adminAdsPlacementsListHandler implements GET /api/admin/ads/placements.
func adminAdsPlacementsListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := db.Query(r.Context(), `SELECT id, code, label_key, active, config, created_at, updated_at
			FROM monetization.ad_placement ORDER BY code ASC`)
		if err != nil {
			logger.Error("list ad placements", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type Placement struct {
			ID        string          `json:"id"`
			Code      string          `json:"code"`
			LabelKey  *string         `json:"labelKey,omitempty"`
			Active    bool            `json:"active"`
			Config    json.RawMessage `json:"config"`
			CreatedAt string          `json:"createdAt"`
			UpdatedAt string          `json:"updatedAt"`
		}
		var items []Placement
		for rows.Next() {
			var p Placement
			var ca, ua time.Time
			if rows.Scan(&p.ID, &p.Code, &p.LabelKey, &p.Active, &p.Config, &ca, &ua) == nil {
				p.CreatedAt = ca.UTC().Format(time.RFC3339)
				p.UpdatedAt = ua.UTC().Format(time.RFC3339)
				items = append(items, p)
			}
		}
		if items == nil {
			items = []Placement{}
		}
		writeJSON(w, http.StatusOK, items)
	}
}

// adminAdsPlacementCreateHandler implements POST /api/admin/ads/placements.
func adminAdsPlacementCreateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			Code     string          `json:"code"`
			LabelKey *string         `json:"labelKey"`
			Active   *bool           `json:"active"`
			Config   json.RawMessage `json:"config"`
			Reason   string          `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.Code == "" {
			writeJSONError(w, "code required", http.StatusBadRequest)
			return
		}
		active := true
		if req.Active != nil {
			active = *req.Active
		}
		config := req.Config
		if len(config) == 0 {
			config = []byte("{}")
		}

		ctx := r.Context()
		var exists bool
		db.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM monetization.ad_placement WHERE code=$1)", req.Code).Scan(&exists)
		if exists {
			writeJSONError(w, "placement code already exists", http.StatusConflict)
			return
		}

		var id string
		err := db.QueryRow(ctx, `INSERT INTO monetization.ad_placement (code, label_key, active, config, created_at, updated_at)
			VALUES ($1,$2,$3,$4,NOW(),NOW()) RETURNING id`,
			req.Code, req.LabelKey, active, config).Scan(&id)
		if err != nil {
			logger.Error("create ad placement", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		afterJSON, _ := json.Marshal(map[string]any{"id": id, "code": req.Code})
		db.Exec(ctx, `INSERT INTO admin.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('ads.placement.create',$1,$2,'ad_placement',$3,$4,NOW())`,
			identity.ActorID, id, req.Reason, afterJSON)

		writeJSON(w, http.StatusCreated, map[string]any{"id": id, "code": req.Code, "active": active})
	}
}

// adminAdsPlacementPatchHandler implements PATCH /api/admin/ads/placements/{id}.
func adminAdsPlacementPatchHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
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
		var req map[string]any
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}

		ctx := r.Context()
		setClauses := []string{}
		args := []any{}
		argIdx := 1
		fieldMap := map[string]string{
			"code": "code", "labelKey": "label_key", "active": "active",
		}
		for k, col := range fieldMap {
			if v, ok := req[k]; ok {
				setClauses = append(setClauses, col+" = $"+itoa(argIdx))
				args = append(args, v)
				argIdx++
			}
		}
		if cfg, ok := req["config"]; ok {
			cfgJSON, _ := json.Marshal(cfg)
			setClauses = append(setClauses, "config = $"+itoa(argIdx))
			args = append(args, cfgJSON)
			argIdx++
		}
		if len(setClauses) == 0 {
			writeJSONError(w, "at least one field to update is required", http.StatusBadRequest)
			return
		}
		setClauses = append(setClauses, "updated_at = NOW()")
		query := "UPDATE monetization.ad_placement SET " + joinStrings(setClauses, ", ") + " WHERE id = $" + itoa(argIdx)
		args = append(args, id)
		if _, err := db.Exec(ctx, query, args...); err != nil {
			logger.Error("patch ad placement", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		reason, _ := req["reason"].(string)
		afterJSON, _ := json.Marshal(req)
		db.Exec(ctx, `INSERT INTO admin.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('ads.placement.update',$1,$2,'ad_placement',$3,$4,NOW())`,
			identity.ActorID, id, reason, afterJSON)

		writeJSON(w, http.StatusOK, map[string]any{"id": id, "updated": true})
	}
}

// ── Campaigns ───────────────────────────────────────────────────────────────

// adminAdsCampaignsListHandler implements GET /api/admin/ads/campaigns.
func adminAdsCampaignsListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := db.Query(r.Context(), `SELECT id, name, status, provider_key, placement_codes,
			start_at, end_at, priority, creative_type, destination_url, target_locale,
			target_plan_slug, max_impressions, policy_status, created_at, updated_at
			FROM monetization.ad_campaign ORDER BY priority DESC, updated_at DESC`)
		if err != nil {
			logger.Error("list ad campaigns", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type Campaign struct {
			ID              string          `json:"id"`
			Name            string          `json:"name"`
			Status          string          `json:"status"`
			ProviderKey     string          `json:"providerKey"`
			PlacementCodes  json.RawMessage `json:"placementCodes"`
			StartAt         *string         `json:"startAt,omitempty"`
			EndAt           *string         `json:"endAt,omitempty"`
			Priority        int             `json:"priority"`
			CreativeType    *string         `json:"creativeType,omitempty"`
			DestinationURL  *string         `json:"destinationUrl,omitempty"`
			TargetLocale    *string         `json:"targetLocale,omitempty"`
			TargetPlanSlug  *string         `json:"targetPlanSlug,omitempty"`
			MaxImpressions  *int            `json:"maxImpressions,omitempty"`
			PolicyStatus    *string         `json:"policyStatus,omitempty"`
			CreatedAt       string          `json:"createdAt"`
			UpdatedAt       string          `json:"updatedAt"`
		}
		var items []Campaign
		for rows.Next() {
			var c Campaign
			var sa, ea *time.Time
			var ca, ua time.Time
			if rows.Scan(&c.ID, &c.Name, &c.Status, &c.ProviderKey, &c.PlacementCodes,
				&sa, &ea, &c.Priority, &c.CreativeType, &c.DestinationURL, &c.TargetLocale,
				&c.TargetPlanSlug, &c.MaxImpressions, &c.PolicyStatus, &ca, &ua) == nil {
				if sa != nil {
					s := sa.UTC().Format(time.RFC3339)
					c.StartAt = &s
				}
				if ea != nil {
					s := ea.UTC().Format(time.RFC3339)
					c.EndAt = &s
				}
				c.CreatedAt = ca.UTC().Format(time.RFC3339)
				c.UpdatedAt = ua.UTC().Format(time.RFC3339)
				items = append(items, c)
			}
		}
		if items == nil {
			items = []Campaign{}
		}
		writeJSON(w, http.StatusOK, items)
	}
}

// adminAdsCampaignCreateHandler implements POST /api/admin/ads/campaigns.
func adminAdsCampaignCreateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			Name            string   `json:"name"`
			Status          *string  `json:"status"`
			ProviderKey     string   `json:"providerKey"`
			PlacementCodes  []string `json:"placementCodes"`
			StartAt         *string  `json:"startAt"`
			EndAt           *string  `json:"endAt"`
			Priority        *int     `json:"priority"`
			CreativeType    *string  `json:"creativeType"`
			DestinationURL  *string  `json:"destinationUrl"`
			TargetLocale    *string  `json:"targetLocale"`
			TargetPlanSlug  *string  `json:"targetPlanSlug"`
			MaxImpressions  *int     `json:"maxImpressions"`
			PolicyStatus    *string  `json:"policyStatus"`
			Reason          string   `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.Name == "" || req.ProviderKey == "" {
			writeJSONError(w, "name and providerKey required", http.StatusBadRequest)
			return
		}

		status := "draft"
		if req.Status != nil {
			status = *req.Status
		}
		priority := 0
		if req.Priority != nil {
			priority = *req.Priority
		}
		creativeType := "placeholder"
		if req.CreativeType != nil {
			creativeType = *req.CreativeType
		}
		policyStatus := "pending"
		if req.PolicyStatus != nil {
			policyStatus = *req.PolicyStatus
		}

		pcJSON, _ := json.Marshal(req.PlacementCodes)

		var startAt, endAt *time.Time
		if req.StartAt != nil {
			t, err := time.Parse(time.RFC3339, *req.StartAt)
			if err == nil {
				startAt = &t
			}
		}
		if req.EndAt != nil {
			t, err := time.Parse(time.RFC3339, *req.EndAt)
			if err == nil {
				endAt = &t
			}
		}

		ctx := r.Context()
		var id string
		err := db.QueryRow(ctx, `INSERT INTO monetization.ad_campaign
			(name, status, provider_key, placement_codes, start_at, end_at, priority,
			 creative_type, destination_url, target_locale, target_plan_slug, max_impressions,
			 policy_status, created_at, updated_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW(),NOW()) RETURNING id`,
			req.Name, status, req.ProviderKey, pcJSON, startAt, endAt, priority,
			creativeType, req.DestinationURL, req.TargetLocale, req.TargetPlanSlug,
			req.MaxImpressions, policyStatus).Scan(&id)
		if err != nil {
			logger.Error("create ad campaign", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		afterJSON, _ := json.Marshal(map[string]any{"id": id, "name": req.Name})
		db.Exec(ctx, `INSERT INTO admin.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('ads.campaign.create',$1,$2,'ad_campaign',$3,$4,NOW())`,
			identity.ActorID, id, req.Reason, afterJSON)

		writeJSON(w, http.StatusCreated, map[string]any{"id": id, "name": req.Name, "status": status})
	}
}

// adminAdsCampaignPatchHandler implements PATCH /api/admin/ads/campaigns/{id}.
func adminAdsCampaignPatchHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
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
		var req map[string]any
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}

		ctx := r.Context()
		setClauses := []string{}
		args := []any{}
		argIdx := 1
		fieldMap := map[string]string{
			"name": "name", "status": "status", "providerKey": "provider_key",
			"priority": "priority", "creativeType": "creative_type",
			"destinationUrl": "destination_url", "targetLocale": "target_locale",
			"targetPlanSlug": "target_plan_slug", "maxImpressions": "max_impressions",
			"policyStatus": "policy_status",
		}
		for k, col := range fieldMap {
			if v, ok := req[k]; ok {
				setClauses = append(setClauses, col+" = $"+itoa(argIdx))
				args = append(args, v)
				argIdx++
			}
		}
		if pc, ok := req["placementCodes"]; ok {
			pcJSON, _ := json.Marshal(pc)
			setClauses = append(setClauses, "placement_codes = $"+itoa(argIdx))
			args = append(args, pcJSON)
			argIdx++
		}
		if sa, ok := req["startAt"]; ok {
			if sa == nil {
				setClauses = append(setClauses, "start_at = NULL")
			} else if s, ok := sa.(string); ok {
				t, err := time.Parse(time.RFC3339, s)
				if err == nil {
					setClauses = append(setClauses, "start_at = $"+itoa(argIdx))
					args = append(args, t)
					argIdx++
				}
			}
		}
		if ea, ok := req["endAt"]; ok {
			if ea == nil {
				setClauses = append(setClauses, "end_at = NULL")
			} else if s, ok := ea.(string); ok {
				t, err := time.Parse(time.RFC3339, s)
				if err == nil {
					setClauses = append(setClauses, "end_at = $"+itoa(argIdx))
					args = append(args, t)
					argIdx++
				}
			}
		}
		if len(setClauses) == 0 {
			writeJSONError(w, "at least one field to update is required", http.StatusBadRequest)
			return
		}
		setClauses = append(setClauses, "updated_at = NOW()")
		query := "UPDATE monetization.ad_campaign SET " + joinStrings(setClauses, ", ") + " WHERE id = $" + itoa(argIdx)
		args = append(args, id)
		if _, err := db.Exec(ctx, query, args...); err != nil {
			logger.Error("patch ad campaign", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		reason, _ := req["reason"].(string)
		afterJSON, _ := json.Marshal(req)
		db.Exec(ctx, `INSERT INTO admin.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('ads.campaign.update',$1,$2,'ad_campaign',$3,$4,NOW())`,
			identity.ActorID, id, reason, afterJSON)

		writeJSON(w, http.StatusOK, map[string]any{"id": id, "updated": true})
	}
}

// ── Providers ───────────────────────────────────────────────────────────────

// adminAdsProvidersListHandler implements GET /api/admin/ads/providers.
func adminAdsProvidersListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := db.Query(r.Context(), `SELECT id, key, type, enabled, status, config, last_sync_at, created_at, updated_at
			FROM monetization.ad_provider_config ORDER BY key ASC`)
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
			var lsa *time.Time
			var ca, ua time.Time
			if rows.Scan(&p.ID, &p.Key, &p.Type, &p.Enabled, &p.Status, &p.Config, &lsa, &ca, &ua) == nil {
				if lsa != nil {
					s := lsa.UTC().Format(time.RFC3339)
					p.LastSyncAt = &s
				}
				p.CreatedAt = ca.UTC().Format(time.RFC3339)
				p.UpdatedAt = ua.UTC().Format(time.RFC3339)
				items = append(items, p)
			}
		}
		if items == nil {
			items = []Provider{}
		}
		writeJSON(w, http.StatusOK, items)
	}
}

// adminAdsProviderPatchHandler implements PATCH /api/admin/ads/providers/{key}.
func adminAdsProviderPatchHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
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
		var req map[string]any
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}

		ctx := r.Context()
		// Upsert pattern: get existing type for upsert
		var existingType string
		err := db.QueryRow(ctx, "SELECT type FROM monetization.ad_provider_config WHERE key=$1", key).Scan(&existingType)
		isNew := err != nil

		setClauses := []string{}
		args := []any{}
		argIdx := 1
		if v, ok := req["enabled"]; ok {
			setClauses = append(setClauses, "enabled = $"+itoa(argIdx))
			args = append(args, v)
			argIdx++
		}
		if v, ok := req["status"]; ok {
			setClauses = append(setClauses, "status = $"+itoa(argIdx))
			args = append(args, v)
			argIdx++
		}
		if v, ok := req["config"]; ok {
			cfgJSON, _ := json.Marshal(v)
			setClauses = append(setClauses, "config = $"+itoa(argIdx))
			args = append(args, cfgJSON)
			argIdx++
		}
		if v, ok := req["lastSyncAt"]; ok {
			if v == nil {
				setClauses = append(setClauses, "last_sync_at = NULL")
			} else if s, ok := v.(string); ok {
				t, err := time.Parse(time.RFC3339, s)
				if err == nil {
					setClauses = append(setClauses, "last_sync_at = $"+itoa(argIdx))
					args = append(args, t)
					argIdx++
				}
			}
		}
		setClauses = append(setClauses, "updated_at = NOW()")

		var id string
		if isNew {
			// Insert new provider
			typ := "custom"
			if v, ok := req["type"].(string); ok {
				typ = v
			}
			err = db.QueryRow(ctx, `INSERT INTO monetization.ad_provider_config (key, type, enabled, status, config, updated_at)
				VALUES ($1,$2,COALESCE($3,true),COALESCE($4,'ok'),COALESCE($5,'{}'::jsonb),NOW())
				ON CONFLICT (key) DO UPDATE SET enabled=COALESCE($3,monetization.ad_provider_config.enabled),
				status=COALESCE($4,monetization.ad_provider_config.status),
				config=COALESCE($5,monetization.ad_provider_config.config),
				updated_at=NOW() RETURNING id`,
				key, typ, req["enabled"], req["status"], func() []byte {
					if c, ok := req["config"]; ok {
						b, _ := json.Marshal(c)
						return b
					}
					return nil
				}()).Scan(&id)
		} else {
			if len(setClauses) == 0 {
				writeJSONError(w, "at least one field to update is required", http.StatusBadRequest)
				return
			}
			query := "UPDATE monetization.ad_provider_config SET " + joinStrings(setClauses, ", ") + " WHERE key = $" + itoa(argIdx)
			args = append(args, key)
			_, err = db.Exec(ctx, query, args...)
			db.QueryRow(ctx, "SELECT id FROM monetization.ad_provider_config WHERE key=$1", key).Scan(&id)
		}
		if err != nil {
			logger.Error("patch ad provider", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		reason, _ := req["reason"].(string)
		afterJSON, _ := json.Marshal(req)
		db.Exec(ctx, `INSERT INTO admin.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('ads.provider.update',$1,$2,'ad_provider_config',$3,$4,NOW())`,
			identity.ActorID, id, reason, afterJSON)

		writeJSON(w, http.StatusOK, map[string]any{"key": key, "updated": true})
	}
}

// ── Safety Rules ────────────────────────────────────────────────────────────

// adminAdsRulesListHandler implements GET /api/admin/ads/rules.
func adminAdsRulesListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := db.Query(r.Context(), `SELECT id, rule_key, enabled, config, created_at, updated_at
			FROM monetization.ad_safety_rule ORDER BY rule_key ASC`)
		if err != nil {
			logger.Error("list ad safety rules", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type Rule struct {
			ID        string          `json:"id"`
			RuleKey   string          `json:"ruleKey"`
			Enabled   bool            `json:"enabled"`
			Config    json.RawMessage `json:"config"`
			CreatedAt string          `json:"createdAt"`
			UpdatedAt string          `json:"updatedAt"`
		}
		var items []Rule
		for rows.Next() {
			var rl Rule
			var ca, ua time.Time
			if rows.Scan(&rl.ID, &rl.RuleKey, &rl.Enabled, &rl.Config, &ca, &ua) == nil {
				rl.CreatedAt = ca.UTC().Format(time.RFC3339)
				rl.UpdatedAt = ua.UTC().Format(time.RFC3339)
				items = append(items, rl)
			}
		}
		if items == nil {
			items = []Rule{}
		}
		writeJSON(w, http.StatusOK, items)
	}
}

// adminAdsRuleUpsertHandler implements POST /api/admin/ads/rules.
func adminAdsRuleUpsertHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			RuleKey string          `json:"ruleKey"`
			Enabled *bool           `json:"enabled"`
			Config  json.RawMessage `json:"config"`
			Reason  string          `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.RuleKey == "" {
			writeJSONError(w, "ruleKey required", http.StatusBadRequest)
			return
		}

		enabled := true
		if req.Enabled != nil {
			enabled = *req.Enabled
		}
		config := req.Config
		if len(config) == 0 {
			config = []byte("{}")
		}

		ctx := r.Context()
		var id string
		err := db.QueryRow(ctx, `INSERT INTO monetization.ad_safety_rule (rule_key, enabled, config, created_at, updated_at)
			VALUES ($1,$2,$3,NOW(),NOW())
			ON CONFLICT (rule_key) DO UPDATE SET enabled=$2, config=$3, updated_at=NOW()
			RETURNING id`, req.RuleKey, enabled, config).Scan(&id)
		if err != nil {
			logger.Error("upsert ad safety rule", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		afterJSON, _ := json.Marshal(map[string]any{"id": id, "ruleKey": req.RuleKey, "enabled": enabled})
		db.Exec(ctx, `INSERT INTO admin.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('ads.safety_rule.upsert',$1,$2,'ad_safety_rule',$3,$4,NOW())`,
			identity.ActorID, id, req.Reason, afterJSON)

		writeJSON(w, http.StatusOK, map[string]any{"id": id, "ruleKey": req.RuleKey, "enabled": enabled})
	}
}

// ── Performance ─────────────────────────────────────────────────────────────

// adminAdsPerformanceHandler implements GET /api/admin/ads/performance.
func adminAdsPerformanceHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		days := queryInt(r, "days", 7)
		if days < 1 {
			days = 7
		}
		if days > 90 {
			days = 90
		}
		interval := fmt.Sprintf("%d days", days)

		rows, err := db.Query(r.Context(), `SELECT kind, placement_id, campaign_id, client_context, created_at
			FROM monetization.ad_impression WHERE created_at >= NOW() - $1::interval`, interval)
		if err != nil {
			logger.Error("ads performance", "error", err)
			writeJSON(w, http.StatusOK, map[string]any{})
			return
		}
		defer rows.Close()

		isClick := func(k string) bool { return k == "click" || k == "dismiss" }
		isBlocked := func(k string) bool { return k == "blocked" }
		isImpression := func(k string) bool { return !isClick(k) && !isBlocked(k) }

		// Get placement code map
		plRows, _ := db.Query(r.Context(), "SELECT id, code FROM monetization.ad_placement")
		placementCodes := map[string]string{}
		if plRows != nil {
			for plRows.Next() {
				var id, code string
				if plRows.Scan(&id, &code) == nil {
					placementCodes[id] = code
				}
			}
			plRows.Close()
		}

		byPlacement := map[string]struct{ impressions, clicks, blocked int }{}
		byCampaign := map[string]struct{ impressions, clicks, blocked int }{}
		byLocale := map[string]struct{ impressions, clicks int }{}
		byPlan := map[string]struct{ impressions, clicks int }{}
		byDevice := map[string]struct{ impressions, clicks int }{}

		for rows.Next() {
			var kind, placementID string
			var campaignID *string
			var clientCtx json.RawMessage
			var createdAt time.Time
			if rows.Scan(&kind, &placementID, &campaignID, &clientCtx, &createdAt) != nil {
				continue
			}

			pCode := placementCodes[placementID]
			if pCode == "" {
				pCode = placementID
			}
			bp := byPlacement[pCode]
			if isImpression(kind) {
				bp.impressions++
			} else if isClick(kind) {
				bp.clicks++
			} else if isBlocked(kind) {
				bp.blocked++
			}
			byPlacement[pCode] = bp

			if campaignID != nil {
				bc := byCampaign[*campaignID]
				if isImpression(kind) {
					bc.impressions++
				} else if isClick(kind) {
					bc.clicks++
				} else if isBlocked(kind) {
					bc.blocked++
				}
				byCampaign[*campaignID] = bc
			}

			// Parse client context
			var ctx struct {
				Device   *string `json:"device"`
				Locale   *string `json:"locale"`
				PlanSlug *string `json:"planSlug"`
			}
			if len(clientCtx) > 0 {
				json.Unmarshal(clientCtx, &ctx)
			}
			locale := "unknown"
			if ctx.Locale != nil {
				locale = *ctx.Locale
			}
			bl := byLocale[locale]
			if isImpression(kind) {
				bl.impressions++
			} else if isClick(kind) {
				bl.clicks++
			}
			byLocale[locale] = bl

			planKey := "unknown"
			if ctx.PlanSlug != nil {
				planKey = *ctx.PlanSlug
			}
			bpl := byPlan[planKey]
			if isImpression(kind) {
				bpl.impressions++
			} else if isClick(kind) {
				bpl.clicks++
			}
			byPlan[planKey] = bpl

			devKey := "unknown"
			if ctx.Device != nil {
				devKey = *ctx.Device
			}
			bd := byDevice[devKey]
			if isImpression(kind) {
				bd.impressions++
			} else if isClick(kind) {
				bd.clicks++
			}
			byDevice[devKey] = bd
		}

		toSlice := func(m map[string]struct{ impressions, clicks, blocked int }, keyName string) []map[string]any {
			result := []map[string]any{}
			for k, v := range m {
				ctr := 0.0
				if v.impressions > 0 {
					ctr = float64(v.clicks) / float64(v.impressions)
				}
				result = append(result, map[string]any{keyName: k, "impressions": v.impressions, "clicks": v.clicks, "blocked": v.blocked, "ctr": ctr})
			}
			return result
		}
		toSliceNoBlock := func(m map[string]struct{ impressions, clicks int }, keyName string) []map[string]any {
			result := []map[string]any{}
			for k, v := range m {
				ctr := 0.0
				if v.impressions > 0 {
					ctr = float64(v.clicks) / float64(v.impressions)
				}
				result = append(result, map[string]any{keyName: k, "impressions": v.impressions, "clicks": v.clicks, "ctr": ctr})
			}
			return result
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"byPlacement": toSlice(byPlacement, "code"),
			"byCampaign":  toSlice(byCampaign, "id"),
			"byLocale":    toSliceNoBlock(byLocale, "locale"),
			"byPlan":      toSliceNoBlock(byPlan, "planSlug"),
			"byDevice":    toSliceNoBlock(byDevice, "device"),
			"windowDays":  days,
		})
	}
}

// ── Audit ───────────────────────────────────────────────────────────────────

// adminAdsAuditHandler implements GET /api/admin/ads/audit.
func adminAdsAuditHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		limit := queryInt(r, "limit", 50)
		if limit < 1 {
			limit = 50
		}
		if limit > 200 {
			limit = 200
		}

		rows, err := db.Query(r.Context(), `SELECT id, action, actor_id, target_id, target_type, reason, before, after, created_at
			FROM admin.admin_audit_log
			WHERE target_type IN ('ad_placement','ad_campaign','ad_provider_config','ad_safety_rule')
			ORDER BY created_at DESC LIMIT $1`, limit)
		if err != nil {
			logger.Error("ads audit log", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type Entry struct {
			ID         string          `json:"id"`
			Action     string          `json:"action"`
			ActorID    string          `json:"actorId"`
			TargetID   *string         `json:"targetId,omitempty"`
			TargetType string          `json:"targetType"`
			Reason     *string         `json:"reason,omitempty"`
			Before     json.RawMessage `json:"before,omitempty"`
			After      json.RawMessage `json:"after,omitempty"`
			CreatedAt  string          `json:"createdAt"`
		}
		var items []Entry
		for rows.Next() {
			var e Entry
			var ca time.Time
			if rows.Scan(&e.ID, &e.Action, &e.ActorID, &e.TargetID, &e.TargetType, &e.Reason, &e.Before, &e.After, &ca) == nil {
				e.CreatedAt = ca.UTC().Format(time.RFC3339)
				items = append(items, e)
			}
		}
		if items == nil {
			items = []Entry{}
		}
		writeJSON(w, http.StatusOK, items)
	}
}