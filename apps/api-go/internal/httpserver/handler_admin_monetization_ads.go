package httpserver

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
)

// ── P1-A5.4: Admin Monetization — Ads Sub-Domain (13 routes) ────────────────
// All routes require admin session + appropriate permissions.
// Contracts derived from NestJS apps/api/src/monetization/ads/ads-admin.service.ts
// overview, placements list/create/patch, campaigns list/create/patch,
// providers list/patch, rules list/create, performance, audit.

// adminMonetizationAdsOverviewHandler implements GET /api/admin/monetization/ads/overview.
func adminMonetizationAdsOverviewHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		windowDays := queryInt(r, "windowDays", 7)
		if windowDays < 1 || windowDays > 90 {
			windowDays = 7
		}

		type Overview struct {
			EnabledPlacements int `json:"enabledPlacements"`
			ActiveCampaigns   int `json:"activeCampaigns"`
			ProvidersEnabled  int `json:"providersEnabled"`
			PolicyWarnings    int `json:"policyWarnings"`
			Impressions       int `json:"impressions7d"`
			Clicks            int `json:"clicks7d"`
			Blocked           int `json:"blocked7d"`
			CTR               float64 `json:"ctr"`
		}

		var ov Overview
		db.QueryRow(ctx, "SELECT COUNT(*) FROM monetization.ad_placement WHERE active = true").Scan(&ov.EnabledPlacements)
		db.QueryRow(ctx, `SELECT COUNT(*) FROM monetization.ad_campaign
			WHERE status = 'active'
			AND (start_at IS NULL OR start_at <= NOW())
			AND (end_at IS NULL OR end_at >= NOW())`).Scan(&ov.ActiveCampaigns)
		db.QueryRow(ctx, "SELECT COUNT(*) FROM monetization.ad_provider_config WHERE enabled = true").Scan(&ov.ProvidersEnabled)
		db.QueryRow(ctx, "SELECT COUNT(*) FROM monetization.ad_campaign WHERE policy_status IN ('warning','rejected')").Scan(&ov.PolicyWarnings)

		// Impressions/clicks/blocked in window
		since := time.Now().UTC().AddDate(0, 0, -windowDays).Format(time.RFC3339)
		db.QueryRow(ctx, "SELECT COUNT(*) FROM monetization.ad_impression WHERE created_at >= $1 AND kind NOT IN ('click','dismiss','blocked')", since).Scan(&ov.Impressions)
		db.QueryRow(ctx, "SELECT COUNT(*) FROM monetization.ad_impression WHERE created_at >= $1 AND kind IN ('click','dismiss')", since).Scan(&ov.Clicks)
		db.QueryRow(ctx, "SELECT COUNT(*) FROM monetization.ad_impression WHERE created_at >= $1 AND kind = 'blocked'", since).Scan(&ov.Blocked)
		if ov.Impressions > 0 {
			ov.CTR = float64(ov.Clicks) / float64(ov.Impressions)
		}

		writeJSON(w, http.StatusOK, ov)
	}
}

// adminMonetizationAdsPlacementsListHandler implements GET /api/admin/monetization/ads/placements.
func adminMonetizationAdsPlacementsListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		rows, err := db.Query(ctx, `
			SELECT id, code, name, active, config, created_at, updated_at
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
			if err := rows.Scan(&p.ID, &p.Code, &p.Name, &p.Active, &configBytes, &createdAt, &updatedAt); err == nil {
				p.CreatedAt = createdAt.UTC().Format(time.RFC3339)
				p.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
				if configBytes != nil {
					p.Config = configBytes
				}
				items = append(items, p)
			}
		}
		if items == nil {
			items = []Placement{}
		}
		writeJSON(w, http.StatusOK, items)
	}
}

// adminMonetizationAdsPlacementsCreateHandler implements POST /api/admin/monetization/ads/placements.
func adminMonetizationAdsPlacementsCreateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			Code   string          `json:"code"`
			Name   *string         `json:"name,omitempty"`
			Active *bool           `json:"active,omitempty"`
			Config json.RawMessage `json:"config,omitempty"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.Code == "" {
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
		var createdID string
		err := db.QueryRow(ctx, `
			INSERT INTO monetization.ad_placement (code, name, active, config, created_at, updated_at)
			VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING id`,
			req.Code, req.Name, active, configJSON).Scan(&createdID)
		if err != nil {
			logger.Error("create ad placement", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		afterJSON, _ := json.Marshal(map[string]any{"code": req.Code, "active": active})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('admin.ads.placement.created', $1, $2, 'monetization.ad_placement', $3, $4, NOW())`,
			identity.ActorID, createdID, "ad placement created", afterJSON)
		writeJSON(w, http.StatusCreated, map[string]any{"id": createdID, "code": req.Code})
	}
}

// adminMonetizationAdsPlacementsPatchHandler implements PATCH /api/admin/monetization/ads/placements/{id}.
func adminMonetizationAdsPlacementsPatchHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
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
		var req struct {
			Active *bool           `json:"active,omitempty"`
			Config json.RawMessage `json:"config,omitempty"`
			Name   *string         `json:"name,omitempty"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		var exists bool
		db.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM monetization.ad_placement WHERE id = $1)", id).Scan(&exists)
		if !exists {
			writeJSONError(w, "placement not found", http.StatusNotFound)
			return
		}
		setClauses := []string{}
		args := []any{}
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
		if req.Name != nil {
			setClauses = append(setClauses, "name = $"+itoa(argIdx))
			args = append(args, *req.Name)
			argIdx++
		}
		if len(setClauses) == 0 {
			writeJSONError(w, "at least one field to update is required", http.StatusBadRequest)
			return
		}
		setClauses = append(setClauses, "updated_at = NOW()")
		query := "UPDATE monetization.ad_placement SET " + joinStrings(setClauses, ", ") +
			" WHERE id = $" + itoa(argIdx)
		args = append(args, id)
		if _, err := db.Exec(ctx, query, args...); err != nil {
			logger.Error("patch ad placement", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		afterJSON, _ := json.Marshal(map[string]any{"updated": true})
		beforeJSON, _ := json.Marshal(map[string]any{"id": id})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, before, created_at)
			VALUES ('admin.ads.placement.updated', $1, $2, 'monetization.ad_placement', $3, $4, $5, NOW())`,
			identity.ActorID, id, "ad placement updated", afterJSON, beforeJSON)
		writeJSON(w, http.StatusOK, map[string]any{"id": id, "updated": true})
	}
}

// adminMonetizationAdsCampaignsListHandler implements GET /api/admin/monetization/ads/campaigns.
func adminMonetizationAdsCampaignsListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
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
			SELECT id, name, status, policy_status, provider_key, placement_id,
				start_at, end_at, config, created_at, updated_at
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
			ID           string          `json:"id"`
			Name         string          `json:"name"`
			Status       string          `json:"status"`
			PolicyStatus *string         `json:"policyStatus,omitempty"`
			ProviderKey  *string         `json:"providerKey,omitempty"`
			PlacementID  *string         `json:"placementId,omitempty"`
			StartAt      *string         `json:"startAt,omitempty"`
			EndAt        *string         `json:"endAt,omitempty"`
			Config       json.RawMessage `json:"config,omitempty"`
			CreatedAt    string          `json:"createdAt"`
			UpdatedAt    string          `json:"updatedAt"`
		}
		var items []Campaign
		for rows.Next() {
			var c Campaign
			var createdAt, updatedAt time.Time
			var startAt, endAt *time.Time
			var configBytes []byte
			if err := rows.Scan(&c.ID, &c.Name, &c.Status, &c.PolicyStatus, &c.ProviderKey,
				&c.PlacementID, &startAt, &endAt, &configBytes, &createdAt, &updatedAt); err == nil {
				c.CreatedAt = createdAt.UTC().Format(time.RFC3339)
				c.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
				if startAt != nil {
					s := startAt.UTC().Format(time.RFC3339)
					c.StartAt = &s
				}
				if endAt != nil {
					s := endAt.UTC().Format(time.RFC3339)
					c.EndAt = &s
				}
				if configBytes != nil {
					c.Config = configBytes
				}
				items = append(items, c)
			}
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
	}
}

// adminMonetizationAdsCampaignsCreateHandler implements POST /api/admin/monetization/ads/campaigns.
func adminMonetizationAdsCampaignsCreateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			Name         string          `json:"name"`
			ProviderKey  *string         `json:"providerKey,omitempty"`
			PlacementID  *string         `json:"placementId,omitempty"`
			StartAt      *string         `json:"startAt,omitempty"`
			EndAt        *string         `json:"endAt,omitempty"`
			Config       json.RawMessage `json:"config,omitempty"`
			PolicyStatus *string         `json:"policyStatus,omitempty"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.Name == "" {
			writeJSONError(w, "name is required", http.StatusBadRequest)
			return
		}
		configJSON := req.Config
		if configJSON == nil {
			configJSON = json.RawMessage("{}")
		}
		policyStatus := "pending"
		if req.PolicyStatus != nil {
			policyStatus = *req.PolicyStatus
		}
		ctx := r.Context()
		var createdID string
		err := db.QueryRow(ctx, `
			INSERT INTO monetization.ad_campaign (name, status, policy_status, provider_key, placement_id,
				start_at, end_at, config, created_at, updated_at)
			VALUES ($1, 'active', $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING id`,
			req.Name, policyStatus, req.ProviderKey, req.PlacementID,
			req.StartAt, req.EndAt, configJSON).Scan(&createdID)
		if err != nil {
			logger.Error("create ad campaign", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		afterJSON, _ := json.Marshal(map[string]any{"name": req.Name, "status": "active"})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('admin.ads.campaign.created', $1, $2, 'monetization.ad_campaign', $3, $4, NOW())`,
			identity.ActorID, createdID, "ad campaign created", afterJSON)
		writeJSON(w, http.StatusCreated, map[string]any{"id": createdID, "name": req.Name})
	}
}

// adminMonetizationAdsCampaignsPatchHandler implements PATCH /api/admin/monetization/ads/campaigns/{id}.
func adminMonetizationAdsCampaignsPatchHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
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
		var req struct {
			Status       *string         `json:"status,omitempty"`
			PolicyStatus *string         `json:"policyStatus,omitempty"`
			Name         *string         `json:"name,omitempty"`
			StartAt      *string         `json:"startAt,omitempty"`
			EndAt        *string         `json:"endAt,omitempty"`
			Config       json.RawMessage `json:"config,omitempty"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		var exists bool
		db.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM monetization.ad_campaign WHERE id = $1)", id).Scan(&exists)
		if !exists {
			writeJSONError(w, "campaign not found", http.StatusNotFound)
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
		if req.StartAt != nil {
			setClauses = append(setClauses, "start_at = $"+itoa(argIdx))
			args = append(args, *req.StartAt)
			argIdx++
		}
		if req.EndAt != nil {
			setClauses = append(setClauses, "end_at = $"+itoa(argIdx))
			args = append(args, *req.EndAt)
			argIdx++
		}
		if req.Config != nil {
			setClauses = append(setClauses, "config = $"+itoa(argIdx))
			args = append(args, req.Config)
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
		if _, err := db.Exec(ctx, query, args...); err != nil {
			logger.Error("patch ad campaign", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		afterJSON, _ := json.Marshal(map[string]any{"updated": true})
		beforeJSON, _ := json.Marshal(map[string]any{"id": id})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, before, created_at)
			VALUES ('admin.ads.campaign.updated', $1, $2, 'monetization.ad_campaign', $3, $4, $5, NOW())`,
			identity.ActorID, id, "ad campaign updated", afterJSON, beforeJSON)
		writeJSON(w, http.StatusOK, map[string]any{"id": id, "updated": true})
	}
}

// adminMonetizationAdsProvidersListHandler implements GET /api/admin/monetization/ads/providers.
func adminMonetizationAdsProvidersListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		rows, err := db.Query(ctx, `
			SELECT key, name, enabled, config, created_at, updated_at
			FROM monetization.ad_provider_config
			ORDER BY key ASC`)
		if err != nil {
			logger.Error("list ad providers", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type Provider struct {
			Key       string          `json:"key"`
			Name      *string         `json:"name,omitempty"`
			Enabled   bool            `json:"enabled"`
			Config    json.RawMessage `json:"config,omitempty"`
			CreatedAt string          `json:"createdAt"`
			UpdatedAt string          `json:"updatedAt"`
		}
		var items []Provider
		for rows.Next() {
			var p Provider
			var createdAt, updatedAt time.Time
			var configBytes []byte
			if err := rows.Scan(&p.Key, &p.Name, &p.Enabled, &configBytes, &createdAt, &updatedAt); err == nil {
				p.CreatedAt = createdAt.UTC().Format(time.RFC3339)
				p.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
				if configBytes != nil {
					p.Config = configBytes
				}
				items = append(items, p)
			}
		}
		if items == nil {
			items = []Provider{}
		}
		writeJSON(w, http.StatusOK, items)
	}
}

// adminMonetizationAdsProvidersPatchHandler implements PATCH /api/admin/monetization/ads/providers/{key}.
func adminMonetizationAdsProvidersPatchHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
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
		var req struct {
			Enabled *bool           `json:"enabled,omitempty"`
			Config  json.RawMessage `json:"config,omitempty"`
			Name    *string         `json:"name,omitempty"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		var exists bool
		db.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM monetization.ad_provider_config WHERE key = $1)", key).Scan(&exists)
		if !exists {
			writeJSONError(w, "provider not found", http.StatusNotFound)
			return
		}
		setClauses := []string{}
		args := []any{}
		argIdx := 1
		if req.Enabled != nil {
			setClauses = append(setClauses, "enabled = $"+itoa(argIdx))
			args = append(args, *req.Enabled)
			argIdx++
		}
		if req.Config != nil {
			setClauses = append(setClauses, "config = $"+itoa(argIdx))
			args = append(args, req.Config)
			argIdx++
		}
		if req.Name != nil {
			setClauses = append(setClauses, "name = $"+itoa(argIdx))
			args = append(args, *req.Name)
			argIdx++
		}
		if len(setClauses) == 0 {
			writeJSONError(w, "at least one field to update is required", http.StatusBadRequest)
			return
		}
		setClauses = append(setClauses, "updated_at = NOW()")
		query := "UPDATE monetization.ad_provider_config SET " + joinStrings(setClauses, ", ") +
			" WHERE key = $" + itoa(argIdx)
		args = append(args, key)
		if _, err := db.Exec(ctx, query, args...); err != nil {
			logger.Error("patch ad provider", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		afterJSON, _ := json.Marshal(map[string]any{"updated": true})
		beforeJSON, _ := json.Marshal(map[string]any{"key": key})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, before, created_at)
			VALUES ('admin.ads.provider.updated', $1, $2, 'monetization.ad_provider_config', $3, $4, $5, NOW())`,
			identity.ActorID, key, "ad provider updated", afterJSON, beforeJSON)
		writeJSON(w, http.StatusOK, map[string]any{"key": key, "updated": true})
	}
}

// adminMonetizationAdsRulesListHandler implements GET /api/admin/monetization/ads/rules.
func adminMonetizationAdsRulesListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		rows, err := db.Query(ctx, `
			SELECT id, name, rule_type, condition, action, priority, active, created_at, updated_at
			FROM monetization.ad_safety_rule
			ORDER BY priority ASC, created_at ASC`)
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
			CreatedAt string `json:"createdAt"`
			UpdatedAt string `json:"updatedAt"`
		}
		var items []Rule
		for rows.Next() {
			var rl Rule
			var createdAt, updatedAt time.Time
			if err := rows.Scan(&rl.ID, &rl.Name, &rl.RuleType, &rl.Condition, &rl.Action,
				&rl.Priority, &rl.Active, &createdAt, &updatedAt); err == nil {
				rl.CreatedAt = createdAt.UTC().Format(time.RFC3339)
				rl.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
				items = append(items, rl)
			}
		}
		if items == nil {
			items = []Rule{}
		}
		writeJSON(w, http.StatusOK, items)
	}
}

// adminMonetizationAdsRulesCreateHandler implements POST /api/admin/monetization/ads/rules.
func adminMonetizationAdsRulesCreateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
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
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.Name == "" || req.RuleType == "" || req.Condition == "" || req.Action == "" {
			writeJSONError(w, "name, ruleType, condition, and action are required", http.StatusBadRequest)
			return
		}
		priority := 100
		if req.Priority != nil {
			priority = *req.Priority
		}
		ctx := r.Context()
		var createdID string
		err := db.QueryRow(ctx, `
			INSERT INTO monetization.ad_safety_rule (name, rule_type, condition, action, priority, active, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW()) RETURNING id`,
			req.Name, req.RuleType, req.Condition, req.Action, priority).Scan(&createdID)
		if err != nil {
			logger.Error("create ad safety rule", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		afterJSON, _ := json.Marshal(map[string]any{"name": req.Name, "ruleType": req.RuleType})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('admin.ads.rule.created', $1, $2, 'monetization.ad_safety_rule', $3, $4, NOW())`,
			identity.ActorID, createdID, "ad safety rule created", afterJSON)
		writeJSON(w, http.StatusCreated, map[string]any{"id": createdID, "name": req.Name})
	}
}

// adminMonetizationAdsPerformanceHandler implements GET /api/admin/monetization/ads/performance.
func adminMonetizationAdsPerformanceHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		windowDays := queryInt(r, "windowDays", 7)
		if windowDays < 1 || windowDays > 90 {
			windowDays = 7
		}
		since := time.Now().UTC().AddDate(0, 0, -windowDays).Format(time.RFC3339)

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
		db.QueryRow(ctx, "SELECT COUNT(*) FROM monetization.ad_impression WHERE created_at >= $1 AND kind NOT IN ('click','dismiss','blocked')", since).Scan(&p.Totals.Impressions)
		db.QueryRow(ctx, "SELECT COUNT(*) FROM monetization.ad_impression WHERE created_at >= $1 AND kind IN ('click','dismiss')", since).Scan(&p.Totals.Clicks)
		db.QueryRow(ctx, "SELECT COUNT(*) FROM monetization.ad_impression WHERE created_at >= $1 AND kind = 'blocked'", since).Scan(&p.Totals.Blocked)
		if p.Totals.Impressions > 0 {
			p.Totals.CTR = float64(p.Totals.Clicks) / float64(p.Totals.Impressions)
		}

		writeJSON(w, http.StatusOK, p)
	}
}

// adminMonetizationAdsAuditHandler implements GET /api/admin/monetization/ads/audit.
func adminMonetizationAdsAuditHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		take := queryInt(r, "take", 50)
		if take < 1 || take > 200 {
			take = 50
		}

		type AuditItem struct {
			ID        string  `json:"id"`
			Action    string  `json:"action"`
			ActorID   *string `json:"actorId,omitempty"`
			TargetID  *string `json:"targetId,omitempty"`
			TargetType *string `json:"targetType,omitempty"`
			At        string  `json:"at"`
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
			if err := rows.Scan(&ai.ID, &ai.Action, &ai.ActorID, &ai.TargetID, &ai.TargetType, &ts); err == nil {
				ai.At = ts.UTC().Format(time.RFC3339)
				items = append(items, ai)
			}
		}
		if items == nil {
			items = []AuditItem{}
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": items})
	}
}

// Ensure fmt is used.
var _ = fmt.Sprintf