package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
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

		countQuery := "SELECT COUNT(*) FROM growth.growth_campaign " + whereClause
		var total int
		if err := db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
			logger.Error("count growth campaigns", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if page > 1 && page-1 > int(^uint(0)>>1)/pageSize {
			writeJSON(w, http.StatusOK, map[string]any{"items": []any{}, "page": page, "pageSize": pageSize, "total": total})
			return
		}
		offset := (page - 1) * pageSize

		dataQuery := fmt.Sprintf(`
			SELECT id, name, status, channel, schedule_start, schedule_end, created_at, updated_at
			FROM growth.growth_campaign %s
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
			} else {
				logger.Error("scan growth campaigns", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate growth campaigns", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
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

type adminGrowthCampaignAuditEntry struct {
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

type adminGrowthCampaignDetail struct {
	ID             string                          `json:"id"`
	Name           string                          `json:"name"`
	Description    *string                         `json:"description,omitempty"`
	Status         string                          `json:"status"`
	Channel        string                          `json:"channel"`
	Audience       json.RawMessage                 `json:"audience,omitempty"`
	ContentBody    *string                         `json:"contentBody,omitempty"`
	CTA            json.RawMessage                 `json:"cta,omitempty"`
	TrackingUTM    json.RawMessage                 `json:"trackingUtm,omitempty"`
	ScheduleStart  *string                         `json:"scheduleStart,omitempty"`
	ScheduleEnd    *string                         `json:"scheduleEnd,omitempty"`
	CreatedByID    *string                         `json:"createdById,omitempty"`
	UpdatedByID    *string                         `json:"updatedById,omitempty"`
	CreatedAt      string                          `json:"createdAt"`
	UpdatedAt      string                          `json:"updatedAt"`
	EthicsWarnings []string                        `json:"ethicsWarnings"`
	Audit          []adminGrowthCampaignAuditEntry `json:"audit"`
}

type adminGrowthCampaignQueryer interface {
	Query(context.Context, string, ...any) (pgx.Rows, error)
	QueryRow(context.Context, string, ...any) pgx.Row
}

func loadAdminGrowthCampaignDetail(ctx context.Context, db adminGrowthCampaignQueryer, id string) (adminGrowthCampaignDetail, error) {
	var cd adminGrowthCampaignDetail
	var createdAt, updatedAt time.Time
	var schedStart, schedEnd *time.Time
	var audienceBytes, ctaBytes, utmBytes []byte
	err := db.QueryRow(ctx, `
		SELECT id, name, description, status, channel, audience, content_body,
		       cta, tracking_utm, schedule_start, schedule_end,
		       created_by_id, updated_by_id, created_at, updated_at
		FROM growth.growth_campaign WHERE id = $1`, id).Scan(
		&cd.ID, &cd.Name, &cd.Description, &cd.Status, &cd.Channel,
		&audienceBytes, &cd.ContentBody, &ctaBytes, &utmBytes,
		&schedStart, &schedEnd, &cd.CreatedByID, &cd.UpdatedByID,
		&createdAt, &updatedAt)
	if err != nil {
		return cd, err
	}
	cd.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	cd.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	if schedStart != nil {
		value := schedStart.UTC().Format(time.RFC3339)
		cd.ScheduleStart = &value
	}
	if schedEnd != nil {
		value := schedEnd.UTC().Format(time.RFC3339)
		cd.ScheduleEnd = &value
	}
	cd.Audience = json.RawMessage(audienceBytes)
	if len(cd.Audience) == 0 || string(cd.Audience) == "null" {
		cd.Audience = json.RawMessage("{}")
	}
	cd.CTA = json.RawMessage(ctaBytes)
	if len(cd.CTA) == 0 || string(cd.CTA) == "null" {
		cd.CTA = json.RawMessage("{}")
	}
	cd.TrackingUTM = json.RawMessage(utmBytes)
	if len(cd.TrackingUTM) == 0 || string(cd.TrackingUTM) == "null" {
		cd.TrackingUTM = json.RawMessage("{}")
	}
	text := cd.Name + "\n"
	if cd.Description != nil {
		text += *cd.Description + "\n"
	}
	if cd.ContentBody != nil {
		text += *cd.ContentBody
	}
	cd.EthicsWarnings = detectEthicsWarnings(text)

	rows, err := db.Query(ctx, `
		SELECT a.id, a.action, a.actor_id, act.display_name, act.email,
		       a.reason, a.after, a.before, a.created_at
		FROM ops.admin_audit_log a
		LEFT JOIN authz.admin_actor act ON act.id = a.actor_id
		WHERE a.target_id = $1 AND a.target_type = 'growth.growth_campaign'
		ORDER BY a.created_at DESC LIMIT 20`, id)
	if err != nil {
		return cd, fmt.Errorf("query campaign audit: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var entry adminGrowthCampaignAuditEntry
		var ts time.Time
		if err := rows.Scan(&entry.ID, &entry.Action, &entry.ActorID, &entry.ActorName,
			&entry.ActorEmail, &entry.Reason, &entry.After, &entry.Before, &ts); err != nil {
			return cd, fmt.Errorf("scan campaign audit: %w", err)
		}
		entry.CreatedAt = ts.UTC().Format(time.RFC3339)
		cd.Audit = append(cd.Audit, entry)
	}
	if err := rows.Err(); err != nil {
		return cd, fmt.Errorf("iterate campaign audit: %w", err)
	}
	if cd.Audit == nil {
		cd.Audit = []adminGrowthCampaignAuditEntry{}
	}
	return cd, nil
}

// adminGrowthCampaignsDetailHandler implements GET /api/admin/growth/campaigns/{id}.
func adminGrowthCampaignsDetailHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := extractPathParam(r.URL.Path, "campaigns", 1)
		if id == "" {
			writeJSONError(w, "campaign id required", http.StatusBadRequest)
			return
		}
		if !isValidUUID(id) {
			writeJSONError(w, "invalid campaign id", http.StatusBadRequest)
			return
		}
		cd, err := loadAdminGrowthCampaignDetail(r.Context(), db, id)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "campaign not found", http.StatusNotFound)
			return
		}
		if err != nil {
			logger.Error("load growth campaign detail", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, cd)
	}
}

func validGrowthCampaignReason(reason string) bool {
	length := len([]rune(strings.TrimSpace(reason)))
	return length >= 3 && length <= 500
}

func parseGrowthCampaignSchedule(value *string) (*time.Time, error) {
	if value == nil {
		return nil, nil
	}
	parsed, err := time.Parse(time.RFC3339, strings.TrimSpace(*value))
	if err != nil {
		return nil, fmt.Errorf("schedule dates must use RFC3339")
	}
	return &parsed, nil
}

func parseGrowthCampaignSchedulePatch(value json.RawMessage) (*time.Time, error) {
	if len(value) == 0 || string(value) == "null" {
		return nil, nil
	}
	var text string
	if err := json.Unmarshal(value, &text); err != nil {
		return nil, fmt.Errorf("schedule dates must be RFC3339 strings or null")
	}
	return parseGrowthCampaignSchedule(&text)
}

func parseCampaignTime(value *string) *time.Time {
	if value == nil {
		return nil
	}
	parsed, err := time.Parse(time.RFC3339, *value)
	if err != nil {
		return nil
	}
	return &parsed
}

func validGrowthCampaignObject(raw json.RawMessage, allowedFields ...string) bool {
	var fields map[string]json.RawMessage
	if len(raw) == 0 || json.Unmarshal(raw, &fields) != nil || fields == nil {
		return false
	}
	maxLength := map[string]int{
		"locale": 16, "plan": 64, "level": 32, "country": 8,
		"label": 120, "url": 2000, "source": 64, "medium": 64,
		"campaign": 120, "term": 120, "content": 120,
	}
	allowed := make(map[string]struct{}, len(allowedFields))
	for _, field := range allowedFields {
		allowed[field] = struct{}{}
	}
	for key, value := range fields {
		if _, ok := allowed[key]; !ok {
			return false
		}
		var text string
		if err := json.Unmarshal(value, &text); err != nil || len([]rune(text)) > maxLength[key] {
			return false
		}
		if key == "url" && text != "" {
			parsed, err := url.ParseRequestURI(text)
			if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" {
				return false
			}
		}
	}
	return true
}

func growthCampaignSnapshot(c adminGrowthCampaignDetail) map[string]any {
	return map[string]any{
		"id": c.ID, "name": c.Name, "description": c.Description, "status": c.Status,
		"channel": c.Channel, "audience": c.Audience, "contentBody": c.ContentBody,
		"cta": c.CTA, "trackingUtm": c.TrackingUTM,
		"scheduleStart": c.ScheduleStart, "scheduleEnd": c.ScheduleEnd,
	}
}

func recordGrowthCampaignAudit(ctx context.Context, tx pgx.Tx, actorID, campaignID, action, reason string, before, after any) (adminGrowthCampaignAuditEntry, error) {
	beforeJSON, err := json.Marshal(before)
	if err != nil {
		return adminGrowthCampaignAuditEntry{}, fmt.Errorf("encode campaign audit before image: %w", err)
	}
	afterJSON, err := json.Marshal(after)
	if err != nil {
		return adminGrowthCampaignAuditEntry{}, fmt.Errorf("encode campaign audit after image: %w", err)
	}
	var entry adminGrowthCampaignAuditEntry
	var createdAt time.Time
	err = tx.QueryRow(ctx, `INSERT INTO ops.admin_audit_log
		(action, actor_id, target_id, target_type, reason, after, before, created_at)
		VALUES ($1,$2,$3,'growth.growth_campaign',$4,$5,$6,NOW()) RETURNING id, created_at`,
		action, actorID, campaignID, strings.TrimSpace(reason), afterJSON, beforeJSON).Scan(&entry.ID, &createdAt)
	if err != nil {
		return adminGrowthCampaignAuditEntry{}, fmt.Errorf("insert campaign audit: %w", err)
	}
	if err := tx.QueryRow(ctx, `SELECT display_name,email FROM authz.admin_actor WHERE id=$1`, actorID).Scan(&entry.ActorName, &entry.ActorEmail); err != nil {
		return adminGrowthCampaignAuditEntry{}, fmt.Errorf("read campaign audit actor: %w", err)
	}
	entry.Action = action
	entry.ActorID = actorID
	entry.Reason = strings.TrimSpace(reason)
	entry.Before = beforeJSON
	entry.After = afterJSON
	entry.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	return entry, nil
}

func writeAdminAuditWithReason(ctx context.Context, tx pgx.Tx, actorID, action, targetType, targetID, reason string, before, after any) error {
	beforeJSON, err := json.Marshal(before)
	if err != nil {
		return fmt.Errorf("encode audit before state: %w", err)
	}
	afterJSON, err := json.Marshal(after)
	if err != nil {
		return fmt.Errorf("encode audit after state: %w", err)
	}
	if _, err := tx.Exec(ctx, `INSERT INTO ops.admin_audit_log (action,actor_id,target_type,target_id,reason,before,after,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())`, action, actorID, targetType, targetID, strings.TrimSpace(reason), beforeJSON, afterJSON); err != nil {
		return fmt.Errorf("write admin audit: %w", err)
	}
	return nil
}

// adminGrowthCampaignsAudienceEstimateHandler implements GET /api/admin/growth/campaigns/audience-estimate.
func adminGrowthCampaignsAudienceEstimateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		locale := strings.TrimSpace(r.URL.Query().Get("locale"))
		level := strings.TrimSpace(r.URL.Query().Get("level"))
		plan := strings.TrimSpace(r.URL.Query().Get("plan"))
		country := strings.TrimSpace(r.URL.Query().Get("country"))
		if len(locale) > 16 || len(level) > 32 || len(plan) > 64 || len(country) > 8 {
			writeJSONError(w, "audience filter is too long", http.StatusBadRequest)
			return
		}
		if country != "" {
			writeJSONError(w, "country audience estimates are unavailable because learner profiles have no country field", http.StatusBadRequest)
			return
		}

		whereParts := []string{"up.status = 'active'"}
		args := []any{}
		argIdx := 1
		if locale != "" {
			whereParts = append(whereParts, fmt.Sprintf("up.ui_locale = $%d", argIdx))
			args = append(args, locale)
			argIdx++
		}
		if level != "" {
			whereParts = append(whereParts, fmt.Sprintf("up.target_bjt_band = $%d", argIdx))
			args = append(args, level)
			argIdx++
		}
		if plan != "" {
			whereParts = append(whereParts, fmt.Sprintf(`COALESCE((
				SELECT p.slug FROM monetization.user_subscription us
				JOIN monetization.plan p ON p.id = us.plan_id
				WHERE us.user_id = up.id AND us.status IN ('active', 'trialing') AND p.status = 'active'
				AND (us.current_period_start IS NULL OR us.current_period_start <= NOW())
				AND (us.current_period_end IS NULL OR us.current_period_end > NOW())
				AND (us.status <> 'trialing' OR us.trial_end IS NULL OR us.trial_end > NOW())
				ORDER BY us.created_at DESC LIMIT 1
			), 'free') = $%d`, argIdx))
			args = append(args, plan)
			argIdx++
		}
		whereClause := "WHERE " + strings.Join(whereParts, " AND ")
		query := "SELECT COUNT(*) FROM profile.user_profile up " + whereClause
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
		if plan != "" {
			filters["plan"] = plan
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
			Name          string          `json:"name"`
			Description   *string         `json:"description,omitempty"`
			Channel       string          `json:"channel"`
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
		req.Name = strings.TrimSpace(req.Name)
		req.Channel = strings.TrimSpace(req.Channel)
		req.Reason = strings.TrimSpace(req.Reason)
		if len([]rune(req.Name)) < 2 || len([]rune(req.Name)) > 200 || req.Reason == "" || len([]rune(req.Reason)) < 3 || len([]rune(req.Reason)) > 500 {
			writeJSONError(w, "valid name and reason are required", http.StatusBadRequest)
			return
		}
		switch req.Channel {
		case "email", "push", "in_app":
		default:
			writeJSONError(w, "invalid campaign channel", http.StatusBadRequest)
			return
		}
		var scheduleStart, scheduleEnd *time.Time
		for _, item := range []struct {
			value  *string
			target **time.Time
		}{{req.ScheduleStart, &scheduleStart}, {req.ScheduleEnd, &scheduleEnd}} {
			if item.value == nil || strings.TrimSpace(*item.value) == "" {
				continue
			}
			parsed, err := time.Parse(time.RFC3339, strings.TrimSpace(*item.value))
			if err != nil {
				writeJSONError(w, "schedule dates must use RFC3339", http.StatusBadRequest)
				return
			}
			*item.target = &parsed
		}
		if scheduleStart != nil && scheduleEnd != nil && !scheduleEnd.After(*scheduleStart) {
			writeJSONError(w, "scheduleEnd must follow scheduleStart", http.StatusBadRequest)
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

		tx, err := db.Begin(ctx)
		if err != nil {
			logger.Error("begin create growth campaign", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(ctx)
		var createdID string
		var createdAt, updatedAt time.Time
		err = tx.QueryRow(ctx, `
			INSERT INTO growth.growth_campaign (name, description, channel, audience, content_body,
			                             cta, tracking_utm, schedule_start, schedule_end,
			                             status, created_by_id, updated_by_id, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'draft', $10, $10, NOW(), NOW())
			RETURNING id, created_at, updated_at`,
			req.Name, req.Description, req.Channel, audienceJSON, req.ContentBody,
			ctaJSON, utmJSON, scheduleStart, scheduleEnd,
			identity.ActorID).Scan(&createdID, &createdAt, &updatedAt)
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
		var auditID string
		var auditCreatedAt time.Time
		if err := tx.QueryRow(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('admin.growth.campaign.created', $1, $2, 'growth.growth_campaign', $3, $4, NOW()) RETURNING id, created_at`,
			identity.ActorID, createdID, req.Reason, afterJSON).Scan(&auditID, &auditCreatedAt); err != nil {
			logger.Error("audit create growth campaign", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		var actorName, actorEmail *string
		if err := tx.QueryRow(ctx, `SELECT display_name,email FROM authz.admin_actor WHERE id=$1`, identity.ActorID).Scan(&actorName, &actorEmail); err != nil {
			logger.Error("read growth campaign actor", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		var startText, endText *string
		if scheduleStart != nil {
			value := scheduleStart.UTC().Format(time.RFC3339)
			startText = &value
		}
		if scheduleEnd != nil {
			value := scheduleEnd.UTC().Format(time.RFC3339)
			endText = &value
		}
		actorID := identity.ActorID
		ethicsText := req.Name
		if req.Description != nil {
			ethicsText += "\n" + *req.Description
		}
		if req.ContentBody != nil {
			ethicsText += "\n" + *req.ContentBody
		}
		created := adminGrowthCampaignDetail{
			ID: createdID, Name: req.Name, Description: req.Description, Status: "draft", Channel: req.Channel,
			Audience: audienceJSON, ContentBody: req.ContentBody, CTA: ctaJSON, TrackingUTM: utmJSON,
			ScheduleStart: startText, ScheduleEnd: endText, CreatedByID: &actorID, UpdatedByID: &actorID,
			CreatedAt: createdAt.UTC().Format(time.RFC3339), UpdatedAt: updatedAt.UTC().Format(time.RFC3339),
			EthicsWarnings: detectEthicsWarnings(ethicsText),
			Audit: []adminGrowthCampaignAuditEntry{{
				ID: auditID, Action: "admin.growth.campaign.created", ActorID: actorID, ActorName: actorName,
				ActorEmail: actorEmail, Reason: req.Reason, After: afterJSON, CreatedAt: auditCreatedAt.UTC().Format(time.RFC3339),
			}},
		}
		if err := tx.Commit(ctx); err != nil {
			logger.Error("commit create growth campaign", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		writeJSON(w, http.StatusCreated, created)
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
		if id == "" || !isValidUUID(id) {
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
			ScheduleStart json.RawMessage `json:"scheduleStart,omitempty"`
			ScheduleEnd   json.RawMessage `json:"scheduleEnd,omitempty"`
			Reason        string          `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		req.Reason = strings.TrimSpace(req.Reason)
		if !validGrowthCampaignReason(req.Reason) {
			writeJSONError(w, "valid audit reason is required", http.StatusBadRequest)
			return
		}
		if req.Name != nil {
			*req.Name = strings.TrimSpace(*req.Name)
			if len([]rune(*req.Name)) < 2 || len([]rune(*req.Name)) > 200 {
				writeJSONError(w, "invalid campaign name", http.StatusBadRequest)
				return
			}
		}
		if req.Description != nil && len([]rune(*req.Description)) > 2000 {
			writeJSONError(w, "campaign description is too long", http.StatusBadRequest)
			return
		}
		if req.Channel != nil {
			*req.Channel = strings.TrimSpace(*req.Channel)
			if *req.Channel != "email" && *req.Channel != "push" && *req.Channel != "in_app" {
				writeJSONError(w, "invalid campaign channel", http.StatusBadRequest)
				return
			}
		}
		if req.ContentBody != nil && len([]rune(*req.ContentBody)) > 20000 {
			writeJSONError(w, "campaign content is too long", http.StatusBadRequest)
			return
		}
		if (req.Audience != nil && !validGrowthCampaignObject(req.Audience, "locale", "plan", "level", "country")) ||
			(req.CTA != nil && !validGrowthCampaignObject(req.CTA, "label", "url")) ||
			(req.TrackingUTM != nil && !validGrowthCampaignObject(req.TrackingUTM, "source", "medium", "campaign", "term", "content")) {
			writeJSONError(w, "invalid campaign JSON fields", http.StatusBadRequest)
			return
		}
		start, err := parseGrowthCampaignSchedulePatch(req.ScheduleStart)
		if err != nil {
			writeJSONError(w, err.Error(), http.StatusBadRequest)
			return
		}
		end, err := parseGrowthCampaignSchedulePatch(req.ScheduleEnd)
		if err != nil {
			writeJSONError(w, err.Error(), http.StatusBadRequest)
			return
		}
		if req.Name == nil && req.Description == nil && req.Channel == nil && req.Audience == nil && req.ContentBody == nil &&
			req.CTA == nil && req.TrackingUTM == nil && len(req.ScheduleStart) == 0 && len(req.ScheduleEnd) == 0 {
			writeJSONError(w, "at least one field to update is required", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		tx, err := db.Begin(ctx)
		if err != nil {
			logger.Error("begin patch growth campaign", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(ctx)
		var lockedID string
		if err := tx.QueryRow(ctx, `SELECT id FROM growth.growth_campaign WHERE id=$1 FOR UPDATE`, id).Scan(&lockedID); errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "campaign not found", http.StatusNotFound)
			return
		} else if err != nil {
			logger.Error("lock growth campaign for patch", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		before, err := loadAdminGrowthCampaignDetail(ctx, tx, id)
		if err != nil {
			logger.Error("read growth campaign before patch", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		currentStart, currentEnd := parseCampaignTime(before.ScheduleStart), parseCampaignTime(before.ScheduleEnd)
		if len(req.ScheduleStart) > 0 {
			currentStart = start
		}
		if len(req.ScheduleEnd) > 0 {
			currentEnd = end
		}
		if currentStart != nil && currentEnd != nil && !currentEnd.After(*currentStart) {
			writeJSONError(w, "scheduleEnd must follow scheduleStart", http.StatusBadRequest)
			return
		}
		setClauses := []string{}
		args := []any{}
		argIdx := 1
		add := func(column string, value any) {
			setClauses = append(setClauses, column+" = $"+itoa(argIdx))
			args = append(args, value)
			argIdx++
		}
		if req.Name != nil {
			add("name", *req.Name)
		}
		if req.Description != nil {
			add("description", *req.Description)
		}
		if req.Channel != nil {
			add("channel", *req.Channel)
		}
		if req.Audience != nil {
			add("audience", req.Audience)
		}
		if req.ContentBody != nil {
			add("content_body", *req.ContentBody)
		}
		if req.CTA != nil {
			add("cta", req.CTA)
		}
		if req.TrackingUTM != nil {
			add("tracking_utm", req.TrackingUTM)
		}
		if len(req.ScheduleStart) > 0 {
			add("schedule_start", start)
		}
		if len(req.ScheduleEnd) > 0 {
			add("schedule_end", end)
		}
		add("updated_by_id", identity.ActorID)
		setClauses = append(setClauses, "updated_at = NOW()")
		query := "UPDATE growth.growth_campaign SET " + joinStrings(setClauses, ", ") + " WHERE id = $" + itoa(argIdx)
		args = append(args, id)
		result, err := tx.Exec(ctx, query, args...)
		if err != nil {
			logger.Error("patch growth campaign", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if result.RowsAffected() != 1 {
			writeJSONError(w, "campaign not found", http.StatusNotFound)
			return
		}
		after, err := loadAdminGrowthCampaignDetail(ctx, tx, id)
		if err != nil {
			logger.Error("read growth campaign after patch", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		entry, err := recordGrowthCampaignAudit(ctx, tx, identity.ActorID, id, "admin.growth.campaign.updated", req.Reason, growthCampaignSnapshot(before), growthCampaignSnapshot(after))
		if err != nil {
			logger.Error("audit patch growth campaign", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		after.Audit = append([]adminGrowthCampaignAuditEntry{entry}, after.Audit...)
		if err := tx.Commit(ctx); err != nil {
			logger.Error("commit patch growth campaign", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, after)
	}
}

// adminGrowthCampaignsTransitionHandler implements POST /api/admin/growth/campaigns/{id}/{action}.
// Handles: schedule, activate, end, archive state transitions.
func validateGrowthCampaignTransition(current, next string, start, end *time.Time, now time.Time) error {
	if current == next {
		return nil
	}
	switch next {
	case "scheduled":
		if current != "draft" {
			return fmt.Errorf("only draft campaigns can be scheduled")
		}
		if start == nil || end == nil {
			return fmt.Errorf("schedule start and end are required")
		}
		if !start.After(now) {
			return fmt.Errorf("schedule start must be in the future")
		}
		if !end.After(*start) {
			return fmt.Errorf("schedule end must follow its start")
		}
	case "active":
		if current != "draft" && current != "scheduled" {
			return fmt.Errorf("only draft or scheduled campaigns can be activated")
		}
	case "ended":
		if current != "active" {
			return fmt.Errorf("only active campaigns can be ended")
		}
	case "archived":
		if current == "archived" {
			return nil
		}
	default:
		return fmt.Errorf("invalid campaign transition")
	}
	return nil
}

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
		if !isValidUUID(id) {
			writeJSONError(w, "invalid campaign id", http.StatusBadRequest)
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
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		req.Reason = strings.TrimSpace(req.Reason)
		if !validGrowthCampaignReason(req.Reason) {
			writeJSONError(w, "valid audit reason is required", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		tx, err := db.Begin(ctx)
		if err != nil {
			logger.Error("begin growth campaign transition", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(ctx)
		var lockedID string
		err = tx.QueryRow(ctx, `SELECT id FROM growth.growth_campaign WHERE id=$1 FOR UPDATE`, id).Scan(&lockedID)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "campaign not found", http.StatusNotFound)
			return
		}
		if err != nil {
			logger.Error("lock campaign for transition", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		before, err := loadAdminGrowthCampaignDetail(ctx, tx, id)
		if err != nil {
			logger.Error("read campaign before transition", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		noop := before.Status == nextStatus
		if err := validateGrowthCampaignTransition(before.Status, nextStatus,
			parseCampaignTime(before.ScheduleStart), parseCampaignTime(before.ScheduleEnd), time.Now()); err != nil {
			writeJSONError(w, err.Error(), http.StatusBadRequest)
			return
		}
		if !noop {
			result, err := tx.Exec(ctx, "UPDATE growth.growth_campaign SET status=$1,updated_by_id=$2,updated_at=NOW() WHERE id=$3", nextStatus, identity.ActorID, id)
			if err != nil {
				logger.Error("update growth campaign status", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			if result.RowsAffected() != 1 {
				writeJSONError(w, "campaign not found", http.StatusNotFound)
				return
			}
		}
		auditAction := "admin.growth.campaign." + nextStatus
		after, err := loadAdminGrowthCampaignDetail(ctx, tx, id)
		if err != nil {
			logger.Error("read campaign after transition", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		entry, err := recordGrowthCampaignAudit(ctx, tx, identity.ActorID, id, auditAction, req.Reason,
			map[string]any{"campaign": growthCampaignSnapshot(before)},
			map[string]any{"campaign": growthCampaignSnapshot(after), "noop": noop})
		if err != nil {
			logger.Error("audit growth campaign transition", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		after.Audit = append([]adminGrowthCampaignAuditEntry{entry}, after.Audit...)
		if err := tx.Commit(ctx); err != nil {
			logger.Error("commit growth campaign transition", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, after)
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
		if id == "" || !isValidUUID(id) {
			writeJSONError(w, "campaign id required", http.StatusBadRequest)
			return
		}
		var req struct {
			Reason string `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		req.Reason = strings.TrimSpace(req.Reason)
		if !validGrowthCampaignReason(req.Reason) {
			writeJSONError(w, "valid audit reason is required", http.StatusBadRequest)
			return
		}
		ctx := r.Context()

		type Source struct {
			Name        string          `json:"name"`
			Description *string         `json:"description,omitempty"`
			Channel     string          `json:"channel"`
			Audience    json.RawMessage `json:"audience,omitempty"`
			ContentBody *string         `json:"contentBody,omitempty"`
			CTA         json.RawMessage `json:"cta,omitempty"`
			TrackingUTM json.RawMessage `json:"trackingUtm,omitempty"`
		}
		var src Source
		var audienceBytes, ctaBytes, utmBytes []byte
		tx, err := db.Begin(ctx)
		if err != nil {
			logger.Error("begin duplicate growth campaign", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(ctx)
		err = tx.QueryRow(ctx, `
			SELECT name, description, channel, audience, content_body, cta, tracking_utm
			FROM growth.growth_campaign WHERE id = $1 FOR UPDATE`, id).Scan(
			&src.Name, &src.Description, &src.Channel, &audienceBytes,
			&src.ContentBody, &ctaBytes, &utmBytes)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "campaign not found", http.StatusNotFound)
			return
		}
		if err != nil {
			logger.Error("read source growth campaign", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
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
		err = tx.QueryRow(ctx, `
			INSERT INTO growth.growth_campaign (name, description, channel, audience, content_body,
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

		before := map[string]any{"sourceId": id, "name": src.Name, "channel": src.Channel,
			"audience": src.Audience, "description": src.Description, "contentBody": src.ContentBody,
			"cta": src.CTA, "trackingUtm": src.TrackingUTM}
		afterSnapshot := map[string]any{"id": newID, "sourceId": id, "name": newName, "status": "draft", "channel": src.Channel}
		if _, err := recordGrowthCampaignAudit(ctx, tx, identity.ActorID, newID, "admin.growth.campaign.duplicated", req.Reason, before, afterSnapshot); err != nil {
			logger.Error("audit duplicate growth campaign", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		created, err := loadAdminGrowthCampaignDetail(ctx, tx, newID)
		if err != nil {
			logger.Error("read duplicated growth campaign", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			logger.Error("commit duplicate growth campaign", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, created)
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
