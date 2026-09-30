package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
)

// ── P1-A3.1: Admin Growth — Campaigns Sub-Domain (10 routes) ────────────────
// All routes require admin session + appropriate permissions.
// Contracts derived from NestJS apps/api/src/growth/growth-campaigns-admin.repository.ts
// list, detail, audienceEstimate, create, patch, schedule, activate, end, archive, duplicate.

// adminGrowthCampaignsListHandler implements GET /api/admin/growth/campaigns.
func adminGrowthCampaignsListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		q := r.URL.Query().Get("q")
		statusFilter := r.URL.Query().Get("status")
		channelFilter := r.URL.Query().Get("channel")
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
		if channelFilter != "" {
			whereParts = append(whereParts, fmt.Sprintf("channel = $%d", argIdx))
			args = append(args, channelFilter)
			argIdx++
		}
		if q != "" {
			pattern := "%" + q + "%"
			whereParts = append(whereParts, fmt.Sprintf(
				"(name ILIKE $%[1]d OR description ILIKE $%[1]d)", argIdx))
			args = append(args, pattern)
			argIdx++
		}
		whereClause := ""
		if len(whereParts) > 0 {
			whereClause = "WHERE " + strings.Join(whereParts, " AND ")
		}

		countQuery := "SELECT COUNT(*) FROM growth.campaign " + whereClause
		var total int
		if err := db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
			logger.Error("count growth campaigns", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		dataQuery := fmt.Sprintf(`
			SELECT id, name, status, channel, schedule_start, schedule_end, created_at, updated_at
			FROM growth.campaign %s
			ORDER BY updated_at DESC LIMIT $%d OFFSET $%d`,
			whereClause, argIdx, argIdx+1)
		args = append(args, pageSize, offset)
		rows, err := db.Query(ctx, dataQuery, args...)
		if err != nil {
			logger.Error("list growth campaigns", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type CampaignSummary struct {
			ID            string  `json:"id"`
			Name          string  `json:"name"`
			Status        string  `json:"status"`
			Channel       string  `json:"channel"`
			ScheduleStart *string `json:"scheduleStart,omitempty"`
			ScheduleEnd   *string `json:"scheduleEnd,omitempty"`
			CreatedAt     string  `json:"createdAt"`
			UpdatedAt     string  `json:"updatedAt"`
		}
		var items []CampaignSummary
		for rows.Next() {
			var cs CampaignSummary
			var createdAt, updatedAt time.Time
			var schedStart, schedEnd *time.Time
			if err := rows.Scan(&cs.ID, &cs.Name, &cs.Status, &cs.Channel,
				&schedStart, &schedEnd, &createdAt, &updatedAt); err == nil {
				cs.CreatedAt = createdAt.UTC().Format(time.RFC3339)
				cs.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
				if schedStart != nil {
					s := schedStart.UTC().Format(time.RFC3339)
					cs.ScheduleStart = &s
				}
				if schedEnd != nil {
					s := schedEnd.UTC().Format(time.RFC3339)
					cs.ScheduleEnd = &s
				}
				items = append(items, cs)
			}
		}
		if items == nil {
			items = []CampaignSummary{}
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"items":    items,
			"page":     page,
			"pageSize": pageSize,
			"total":    total,
		})
	}
}

// adminGrowthCampaignsDetailHandler implements GET /api/admin/growth/campaigns/{id}.
func adminGrowthCampaignsDetailHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := extractPathParam(r.URL.Path, "campaigns", 1)
		if id == "" {
			writeJSONError(w, "campaign id required", http.StatusBadRequest)
			return
		}
		ctx := r.Context()

		type AuditEntry struct {
			ID         string          `json:"id"`
			Action     string          `json:"action"`
			ActorID    string          `json:"actorId"`
			ActorName  *string         `json:"actorName,omitempty"`
			ActorEmail *string         `json:"actorEmail,omitempty"`
			Reason     string          `json:"reason"`
			After      json.RawMessage `json:"after,omitempty"`
			Before     json.RawMessage `json:"before,omitempty"`
			CreatedAt  string          `json:"createdAt"`
		}
		type CampaignDetail struct {
			ID             string          `json:"id"`
			Name           string          `json:"name"`
			Description    *string         `json:"description,omitempty"`
			Status         string          `json:"status"`
			Channel        string          `json:"channel"`
			Audience       json.RawMessage `json:"audience,omitempty"`
			ContentBody    *string         `json:"contentBody,omitempty"`
			CTA            json.RawMessage `json:"cta,omitempty"`
			TrackingUTM    json.RawMessage `json:"trackingUtm,omitempty"`
			ScheduleStart  *string         `json:"scheduleStart,omitempty"`
			ScheduleEnd    *string         `json:"scheduleEnd,omitempty"`
			CreatedByID    *string         `json:"createdById,omitempty"`
			UpdatedByID    *string         `json:"updatedById,omitempty"`
			CreatedAt      string          `json:"createdAt"`
			UpdatedAt      string          `json:"updatedAt"`
			EthicsWarnings []string        `json:"ethicsWarnings"`
			Audit          []AuditEntry    `json:"audit"`
		}

		var cd CampaignDetail
		var createdAt, updatedAt time.Time
		var schedStart, schedEnd *time.Time
		var audienceBytes, ctaBytes, utmBytes []byte
		err := db.QueryRow(ctx, `
			SELECT id, name, description, status, channel, audience, content_body,
			       cta, tracking_utm, schedule_start, schedule_end,
			       created_by_id, updated_by_id, created_at, updated_at
			FROM growth.campaign WHERE id = $1`, id).Scan(
			&cd.ID, &cd.Name, &cd.Description, &cd.Status, &cd.Channel,
			&audienceBytes, &cd.ContentBody, &ctaBytes, &utmBytes,
			&schedStart, &schedEnd, &cd.CreatedByID, &cd.UpdatedByID,
			&createdAt, &updatedAt)
		if err != nil {
			writeJSONError(w, "campaign not found", http.StatusNotFound)
			return
		}
		cd.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		cd.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
		if schedStart != nil {
			s := schedStart.UTC().Format(time.RFC3339)
			cd.ScheduleStart = &s
		}
		if schedEnd != nil {
			s := schedEnd.UTC().Format(time.RFC3339)
			cd.ScheduleEnd = &s
		}
		if audienceBytes != nil {
			cd.Audience = audienceBytes
		} else {
			cd.Audience = json.RawMessage("{}")
		}
		if ctaBytes != nil {
			cd.CTA = ctaBytes
		} else {
			cd.CTA = json.RawMessage("{}")
		}
		if utmBytes != nil {
			cd.TrackingUTM = utmBytes
		} else {
			cd.TrackingUTM = json.RawMessage("{}")
		}

		// Ethics warnings (matches NestJS detectEthicsWarnings)
		text := cd.Name + "\n"
		if cd.Description != nil {
			text += *cd.Description + "\n"
		}
		if cd.ContentBody != nil {
			text += *cd.ContentBody
		}
		cd.EthicsWarnings = detectEthicsWarnings(text)

		// Audit trail
		aRows, err := db.Query(ctx, `
			SELECT a.id, a.action, a.actor_id, act.display_name, act.email,
			       a.reason, a.after, a.before, a.created_at
			FROM admin.admin_audit_log a
			LEFT JOIN admin.admin_actor act ON act.id = a.actor_id
			WHERE a.target_id = $1 AND a.target_type = 'growth.campaign'
			ORDER BY a.created_at DESC LIMIT 20`, id)
		if err == nil {
			for aRows.Next() {
				var ae AuditEntry
				var ts time.Time
				if err := aRows.Scan(&ae.ID, &ae.Action, &ae.ActorID, &ae.ActorName,
					&ae.ActorEmail, &ae.Reason, &ae.After, &ae.Before, &ts); err == nil {
					ae.CreatedAt = ts.UTC().Format(time.RFC3339)
					cd.Audit = append(cd.Audit, ae)
				}
			}
			aRows.Close()
		}
		if cd.Audit == nil {
			cd.Audit = []AuditEntry{}
		}
		writeJSON(w, http.StatusOK, cd)
	}
}

// adminGrowthCampaignsAudienceEstimateHandler implements GET /api/admin/growth/campaigns/audience-estimate.
func adminGrowthCampaignsAudienceEstimateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		locale := r.URL.Query().Get("locale")
		level := r.URL.Query().Get("level")

		whereParts := []string{"status = 'active'"}
		args := []any{}
		argIdx := 1
		if locale != "" {
			whereParts = append(whereParts, fmt.Sprintf("ui_locale = $%d", argIdx))
			args = append(args, locale)
			argIdx++
		}
		if level != "" {
			whereParts = append(whereParts, fmt.Sprintf("target_bjt_band = $%d", argIdx))
			args = append(args, level)
			argIdx++
		}
		whereClause := "WHERE " + strings.Join(whereParts, " AND ")
		query := "SELECT COUNT(*) FROM profile.user_profile " + whereClause
		var total int
		if err := db.QueryRow(ctx, query, args...).Scan(&total); err != nil {
			logger.Error("audience estimate", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		filters := map[string]any{}
		if locale != "" {
			filters["locale"] = locale
		}
		if level != "" {
			filters["level"] = level
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"total":   total,
			"filters": filters,
		})
	}
}

// adminGrowthCampaignsCreateHandler implements POST /api/admin/growth/campaigns.
func adminGrowthCampaignsCreateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			Name           string          `json:"name"`
			Description    *string         `json:"description,omitempty"`
			Channel        string          `json:"channel"`
			Audience       json.RawMessage `json:"audience,omitempty"`
			ContentBody    *string         `json:"contentBody,omitempty"`
			CTA            json.RawMessage `json:"cta,omitempty"`
			TrackingUTM    json.RawMessage `json:"trackingUtm,omitempty"`
			ScheduleStart  *string         `json:"scheduleStart,omitempty"`
			ScheduleEnd    *string         `json:"scheduleEnd,omitempty"`
			Reason         string          `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.Name == "" || req.Channel == "" {
			writeJSONError(w, "name and channel are required", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		audienceJSON := req.Audience
		if audienceJSON == nil {
			audienceJSON = json.RawMessage("{}")
		}
		ctaJSON := req.CTA
		if ctaJSON == nil {
			ctaJSON = json.RawMessage("{}")
		}
		utmJSON := req.TrackingUTM
		if utmJSON == nil {
			utmJSON = json.RawMessage("{}")
		}

		var createdID string
		err := db.QueryRow(ctx, `
			INSERT INTO growth.campaign (name, description, channel, audience, content_body,
			                             cta, tracking_utm, schedule_start, schedule_end,
			                             status, created_by_id, updated_by_id, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'draft', $10, $10, NOW(), NOW())
			RETURNING id`,
			req.Name, req.Description, req.Channel, audienceJSON, req.ContentBody,
			ctaJSON, utmJSON, req.ScheduleStart, req.ScheduleEnd,
			identity.ActorID).Scan(&createdID)
		if err != nil {
			logger.Error("create growth campaign", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		// Write audit
		afterJSON, _ := json.Marshal(map[string]any{
			"name": req.Name, "description": req.Description, "channel": req.Channel,
			"audience": req.Audience, "contentBody": req.ContentBody,
			"cta": req.CTA, "trackingUtm": req.TrackingUTM,
			"scheduleStart": req.ScheduleStart, "scheduleEnd": req.ScheduleEnd,
			"status": "draft",
		})
		db.Exec(ctx, `INSERT INTO admin.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('admin.growth.campaign.created', $1, $2, 'growth.campaign', $3, $4, NOW())`,
			identity.ActorID, createdID, req.Reason, afterJSON)

		// Return detail view
		r.URL.Path = "/api/admin/growth/campaigns/" + createdID
		detailHandler := adminGrowthCampaignsDetailHandler(db, logger)
		detailHandler(w, r)
	}
}

// adminGrowthCampaignsPatchHandler implements PATCH /api/admin/growth/campaigns/{id}.
func adminGrowthCampaignsPatchHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
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
			Name          *string         `json:"name,omitempty"`
			Description   *string         `json:"description,omitempty"`
			Channel       *string         `json:"channel,omitempty"`
			Audience      json.RawMessage `json:"audience,omitempty"`
			ContentBody   *string         `json:"contentBody,omitempty"`
			CTA           json.RawMessage `json:"cta,omitempty"`
			TrackingUTM   json.RawMessage `json:"trackingUtm,omitempty"`
			ScheduleStart *string         `json:"scheduleStart,omitempty"`
			ScheduleEnd   *string         `json:"scheduleEnd,omitempty"`
			Reason        string          `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		ctx := r.Context()

		// Fetch before state
		var exists bool
		db.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM growth.campaign WHERE id = $1)", id).Scan(&exists)
		if !exists {
			writeJSONError(w, "campaign not found", http.StatusNotFound)
			return
		}

		// Build dynamic UPDATE
		setClauses := []string{}
		args := []any{}
		argIdx := 1
		if req.Name != nil {
			setClauses = append(setClauses, "name = $"+itoa(argIdx))
			args = append(args, *req.Name)
			argIdx++
		}
		if req.Description != nil {
			setClauses = append(setClauses, "description = $"+itoa(argIdx))
			args = append(args, *req.Description)
			argIdx++
		}
		if req.Channel != nil {
			setClauses = append(setClauses, "channel = $"+itoa(argIdx))
			args = append(args, *req.Channel)
			argIdx++
		}
		if req.Audience != nil {
			setClauses = append(setClauses, "audience = $"+itoa(argIdx))
			args = append(args, req.Audience)
			argIdx++
		}
		if req.ContentBody != nil {
			setClauses = append(setClauses, "content_body = $"+itoa(argIdx))
			args = append(args, *req.ContentBody)
			argIdx++
		}
		if req.CTA != nil {
			setClauses = append(setClauses, "cta = $"+itoa(argIdx))
			args = append(args, req.CTA)
			argIdx++
		}
		if req.TrackingUTM != nil {
			setClauses = append(setClauses, "tracking_utm = $"+itoa(argIdx))
			args = append(args, req.TrackingUTM)
			argIdx++
		}
		if req.ScheduleStart != nil {
			setClauses = append(setClauses, "schedule_start = $"+itoa(argIdx))
			args = append(args, *req.ScheduleStart)
			argIdx++
		}
		if req.ScheduleEnd != nil {
			setClauses = append(setClauses, "schedule_end = $"+itoa(argIdx))
			args = append(args, *req.ScheduleEnd)
			argIdx++
		}
		if len(setClauses) == 0 {
			writeJSONError(w, "at least one field to update is required", http.StatusBadRequest)
			return
		}
		setClauses = append(setClauses, "updated_by_id = $"+itoa(argIdx))
		args = append(args, identity.ActorID)
		argIdx++
		setClauses = append(setClauses, "updated_at = NOW()")

		query := "UPDATE growth.campaign SET " + joinStrings(setClauses, ", ") +
			" WHERE id = $" + itoa(argIdx)
		args = append(args, id)
		if _, err := db.Exec(ctx, query, args...); err != nil {
			logger.Error("patch growth campaign", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		// Write audit
		afterJSON, _ := json.Marshal(map[string]any{"updated": true, "fields": setClauses})
		beforeJSON, _ := json.Marshal(map[string]any{"id": id})
		db.Exec(ctx, `INSERT INTO admin.admin_audit_log (action, actor_id, target_id, target_type, reason, after, before, created_at)
			VALUES ('admin.growth.campaign.updated', $1, $2, 'growth.campaign', $3, $4, $5, NOW())`,
			identity.ActorID, id, req.Reason, afterJSON, beforeJSON)

		// Return detail view
		detailHandler := adminGrowthCampaignsDetailHandler(db, logger)
		detailHandler(w, r)
	}
}

// adminGrowthCampaignsTransitionHandler implements POST /api/admin/growth/campaigns/{id}/{action}.
// Handles: schedule, activate, end, archive state transitions.
func adminGrowthCampaignsTransitionHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		// Extract id and action from path: .../campaigns/{id}/{action}
		parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		var id, action string
		for i, p := range parts {
			if p == "campaigns" && i+2 < len(parts) {
				id = parts[i+1]
				action = parts[i+2]
				break
			}
		}
		if id == "" || action == "" {
			writeJSONError(w, "campaign id and action required", http.StatusBadRequest)
			return
		}

		var nextStatus string
		switch action {
		case "schedule":
			nextStatus = "scheduled"
		case "activate":
			nextStatus = "active"
		case "end":
			nextStatus = "ended"
		case "archive":
			nextStatus = "archived"
		default:
			writeJSONError(w, "invalid transition action", http.StatusBadRequest)
			return
		}

		var req struct {
			Reason string `json:"reason"`
		}
		json.NewDecoder(r.Body).Decode(&req)
		ctx := r.Context()

		var currentStatus string
		err := db.QueryRow(ctx, "SELECT status FROM growth.campaign WHERE id = $1", id).Scan(&currentStatus)
		if err != nil {
			writeJSONError(w, "campaign not found", http.StatusNotFound)
			return
		}

		noop := currentStatus == nextStatus
		if !noop {
			db.Exec(ctx, "UPDATE growth.campaign SET status = $1, updated_by_id = $2, updated_at = NOW() WHERE id = $3",
				nextStatus, identity.ActorID, id)
		}

		afterJSON, _ := json.Marshal(map[string]any{"status": nextStatus, "noop": noop})
		beforeJSON, _ := json.Marshal(map[string]any{"status": currentStatus})
		auditAction := "admin.growth.campaign." + nextStatus
		db.Exec(ctx, `INSERT INTO admin.admin_audit_log (action, actor_id, target_id, target_type, reason, after, before, created_at)
			VALUES ($1, $2, $3, 'growth.campaign', $4, $5, $6, NOW())`,
			auditAction, identity.ActorID, id, req.Reason, afterJSON, beforeJSON)

		// Return detail view
		detailHandler := adminGrowthCampaignsDetailHandler(db, logger)
		detailHandler(w, r)
	}
}

// adminGrowthCampaignsDuplicateHandler implements POST /api/admin/growth/campaigns/{id}/duplicate.
func adminGrowthCampaignsDuplicateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
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
			Reason string `json:"reason"`
		}
		json.NewDecoder(r.Body).Decode(&req)
		ctx := r.Context()

		type Source struct {
			Name          string          `json:"name"`
			Description   *string         `json:"description,omitempty"`
			Channel       string          `json:"channel"`
			Audience      json.RawMessage `json:"audience,omitempty"`
			ContentBody   *string         `json:"contentBody,omitempty"`
			CTA           json.RawMessage `json:"cta,omitempty"`
			TrackingUTM   json.RawMessage `json:"trackingUtm,omitempty"`
		}
		var src Source
		var audienceBytes, ctaBytes, utmBytes []byte
		err := db.QueryRow(ctx, `
			SELECT name, description, channel, audience, content_body, cta, tracking_utm
			FROM growth.campaign WHERE id = $1`, id).Scan(
			&src.Name, &src.Description, &src.Channel, &audienceBytes,
			&src.ContentBody, &ctaBytes, &utmBytes)
		if err != nil {
			writeJSONError(w, "campaign not found", http.StatusNotFound)
			return
		}
		if audienceBytes != nil {
			src.Audience = audienceBytes
		} else {
			src.Audience = json.RawMessage("{}")
		}
		if ctaBytes != nil {
			src.CTA = ctaBytes
		} else {
			src.CTA = json.RawMessage("{}")
		}
		if utmBytes != nil {
			src.TrackingUTM = utmBytes
		} else {
			src.TrackingUTM = json.RawMessage("{}")
		}

		newName := suffixCopy(src.Name, " (copy)", 200)
		var newID string
		err = db.QueryRow(ctx, `
			INSERT INTO growth.campaign (name, description, channel, audience, content_body,
			                             cta, tracking_utm, status, created_by_id, updated_by_id, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', $8, $8, NOW(), NOW())
			RETURNING id`,
			newName, src.Description, src.Channel, src.Audience, src.ContentBody,
			src.CTA, src.TrackingUTM, identity.ActorID).Scan(&newID)
		if err != nil {
			logger.Error("duplicate growth campaign", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		afterJSON, _ := json.Marshal(map[string]any{"name": newName, "newId": newID, "sourceId": id})
		db.Exec(ctx, `INSERT INTO admin.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('admin.growth.campaign.duplicated', $1, $2, 'growth.campaign', $3, $4, NOW())`,
			identity.ActorID, newID, req.Reason, afterJSON)

		// Return detail view of new campaign
		r.URL.Path = "/api/admin/growth/campaigns/" + newID
		detailHandler := adminGrowthCampaignsDetailHandler(db, logger)
		detailHandler(w, r)
	}
}

// ── Growth Campaign Helpers ─────────────────────────────────────────────────

// detectEthicsWarnings checks text for risky dark-pattern phrases matching
// NestJS RISKY_PATTERNS in growth-campaigns-admin.repository.ts.
func detectEthicsWarnings(text string) []string {
	patterns := []struct {
		re     string
		source string
	}{
		{`(?i)\bshame\b`, `\bshame\b`},
		{`(?i)lose\s+your\s+streak`, `lose\s+your\s+streak`},
		{`(?i)streak\s+will\s+(end|expire)`, `streak\s+will\s+(end|expire)`},
		{`(?i)limited\s+time\s+offer\s+ending\s+in\s+\d+\s*(seconds?|minutes?)`, `limited\s+time\s+offer\s+ending\s+in\s+\d+\s*(seconds?|minutes?)`},
		{`(?i)act\s+now\s+or`, `act\s+now\s+or`},
		{`(?i)don't\s+miss\s+out`, `don't\s+miss\s+out`},
	}
	var out []string
	for _, p := range patterns {
		matched, _ := regexpMatch(p.re, text)
		if matched {
			out = append(out, p.source)
		}
	}
	if out == nil {
		out = []string{}
	}
	return out
}

// regexpMatch performs a case-insensitive regex match using the standard regexp package.
func regexpMatch(pattern, text string) (bool, error) {
	return regexp.MatchString(pattern, text)
}

// Ensure imports are used.
var _ = context.Background
var _ = pgx.ErrNoRows