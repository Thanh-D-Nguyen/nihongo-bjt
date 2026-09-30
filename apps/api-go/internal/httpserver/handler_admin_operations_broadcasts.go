package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
)

// ── P1-A1.2: Admin Operations — Broadcasts Sub-Domain (7 routes) ────────────
// All routes require admin session + appropriate permissions.
// Contracts derived from NestJS apps/api/src/operations/operations.service.ts
// broadcastSnapshot, listBroadcasts, getBroadcastDetail, estimateBroadcastAudience,
// createBroadcast, updateBroadcast, transitionBroadcast.

// adminOpsBroadcastsListHandler implements GET /api/admin/operations/broadcasts.
// Returns paginated broadcast list reconstructed from audit log events.
func adminOpsBroadcastsListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		statusFilter := r.URL.Query().Get("status")
		channelFilter := r.URL.Query().Get("channel")
		limit := queryInt(r, "limit", 100)
		offset := queryInt(r, "offset", 0)

		// Find unique broadcast IDs from audit log
		rows, err := db.Query(ctx, `
			SELECT DISTINCT target_id, MIN(created_at) as first_event
			FROM admin.admin_audit_log
			WHERE target_type = 'ops.broadcast'
			GROUP BY target_id
			ORDER BY first_event DESC
		`)
		if err != nil {
			logger.Error("list broadcasts", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		var broadcastIDs []string
		for rows.Next() {
			var id string
			var firstEvent time.Time
			if err := rows.Scan(&id, &firstEvent); err == nil {
				broadcastIDs = append(broadcastIDs, id)
			}
		}

		type Broadcast struct {
			ID        string    `json:"id"`
			Status    string    `json:"status"`
			Title     *string   `json:"title,omitempty"`
			Body      *string   `json:"body,omitempty"`
			Channel   *string   `json:"channel,omitempty"`
			CreatedAt string    `json:"createdAt"`
			UpdatedAt string    `json:"updatedAt"`
		}

		var allBroadcasts []Broadcast
		for _, bid := range broadcastIDs {
			snap, err := loadBroadcastSnapshot(ctx, db, bid)
			if err != nil || snap == nil {
				continue
			}
			if statusFilter != "" && snap.Status != statusFilter {
				continue
			}
			if channelFilter != "" && (snap.Channel == nil || *snap.Channel != channelFilter) {
				continue
			}
			allBroadcasts = append(allBroadcasts, Broadcast{
				ID:        snap.ID,
				Status:    snap.Status,
				Title:     snap.Title,
				Body:      snap.Body,
				Channel:   snap.Channel,
				CreatedAt: snap.CreatedAt.UTC().Format(time.RFC3339),
				UpdatedAt: snap.UpdatedAt.UTC().Format(time.RFC3339),
			})
		}

		total := len(allBroadcasts)
		end := offset + limit
		if end > total {
			end = total
		}
		items := allBroadcasts[offset:end]
		if items == nil {
			items = []Broadcast{}
		}

		writeJSON(w, http.StatusOK, map[string]any{"items": items, "total": total})
	}
}

// adminOpsBroadcastsGetHandler implements GET /api/admin/operations/broadcasts/{id}.
func adminOpsBroadcastsGetHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := extractPathParam(r.URL.Path, "broadcasts", 1)
		if id == "" {
			writeJSONError(w, "broadcast id required", http.StatusBadRequest)
			return
		}

		snap, err := loadBroadcastSnapshot(r.Context(), db, id)
		if err != nil || snap == nil {
			writeJSONError(w, "broadcast not found", http.StatusNotFound)
			return
		}

		resp := map[string]any{
			"id":        snap.ID,
			"status":    snap.Status,
			"title":     snap.Title,
			"body":      snap.Body,
			"channel":   snap.Channel,
			"audience":  snap.Audience,
			"scheduledAt": snap.ScheduledAt,
			"createdAt": snap.CreatedAt.UTC().Format(time.RFC3339),
			"updatedAt": snap.UpdatedAt.UTC().Format(time.RFC3339),
		}
		writeJSON(w, http.StatusOK, resp)
	}
}

// adminOpsBroadcastsEstimateHandler implements PATCH /api/admin/operations/broadcasts/audience/estimate.
func adminOpsBroadcastsEstimateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Locale  []string `json:"locale"`
			Plan    []string `json:"plan"`
			Level   []string `json:"level"`
			Country []string `json:"country"`
			UserIDs []string `json:"userIds"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}

		if len(req.UserIDs) > 0 {
			writeJSON(w, http.StatusOK, map[string]any{
				"estimatedRecipients": len(req.UserIDs),
				"exact":               true,
				"source":              "explicit_user_ids",
			})
			return
		}

		// Count users matching locale filter
		var total int
		query := "SELECT COUNT(*) FROM learner.user_profile"
		args := []any{}
		argIdx := 1
		if len(req.Locale) > 0 {
			query += fmt.Sprintf(" WHERE ui_locale = ANY($%d)", argIdx)
			args = append(args, req.Locale)
			argIdx++
		}
		if err := db.QueryRow(r.Context(), query, args...).Scan(&total); err != nil {
			logger.Error("estimate audience", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		note := ""
		if len(req.Plan) > 0 || len(req.Level) > 0 || len(req.Country) > 0 {
			note = "plan/level/country filters not yet enforced server-side (partial_schema_pending)"
		}

		resp := map[string]any{
			"estimatedRecipients": total,
			"exact":               false,
			"source":              "userProfile_locale_filter",
		}
		if note != "" {
			resp["note"] = note
		}
		writeJSON(w, http.StatusOK, resp)
	}
}

// adminOpsBroadcastsCreateHandler implements POST /api/admin/operations/broadcasts.
func adminOpsBroadcastsCreateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		var req struct {
			Title      string         `json:"title"`
			Body       string         `json:"body"`
			Channel    string         `json:"channel"`
			Audience   map[string]any `json:"audience"`
			ScheduledAt *string       `json:"scheduledAt,omitempty"`
			Reason     string         `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.Title == "" || req.Body == "" || req.Channel == "" || req.Reason == "" {
			writeJSONError(w, "title, body, channel, and reason are required", http.StatusBadRequest)
			return
		}

		// Generate UUID for broadcast ID
		var targetID string
		if err := db.QueryRow(r.Context(), "SELECT gen_random_uuid()::text").Scan(&targetID); err != nil {
			logger.Error("generate broadcast id", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		afterJSON, _ := json.Marshal(map[string]any{
			"title":       req.Title,
			"body":        req.Body,
			"channel":     req.Channel,
			"audience":    req.Audience,
			"scheduledAt": req.ScheduledAt,
		})

		_, err := db.Exec(r.Context(), `
			INSERT INTO admin.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('ops.broadcast.created', $1, $2, 'ops.broadcast', $3, $4, NOW())
		`, identity.ActorID, targetID, req.Reason, afterJSON)
		if err != nil {
			logger.Error("create broadcast", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"id":             targetID,
			"status":         "draft",
			"createdAuditId": "", // Not easily retrievable without RETURNING
		})
	}
}

// adminOpsBroadcastsUpdateHandler implements PATCH /api/admin/operations/broadcasts/{id}.
func adminOpsBroadcastsUpdateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		id := extractPathParam(r.URL.Path, "broadcasts", 1)
		if id == "" {
			writeJSONError(w, "broadcast id required", http.StatusBadRequest)
			return
		}

		snap, err := loadBroadcastSnapshot(r.Context(), db, id)
		if err != nil || snap == nil {
			writeJSONError(w, "broadcast not found", http.StatusNotFound)
			return
		}
		if snap.Status == "sent" || snap.Status == "cancelled" {
			writeJSONError(w, "broadcast is no longer editable", http.StatusBadRequest)
			return
		}

		var req struct {
			Title       *string        `json:"title,omitempty"`
			Body        *string        `json:"body,omitempty"`
			Channel     *string        `json:"channel,omitempty"`
			Audience    map[string]any `json:"audience,omitempty"`
			ScheduledAt *string        `json:"scheduledAt,omitempty"`
			Reason      string         `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.Reason == "" {
			writeJSONError(w, "reason is required", http.StatusBadRequest)
			return
		}

		afterMap := map[string]any{}
		if req.Title != nil {
			afterMap["title"] = *req.Title
		}
		if req.Body != nil {
			afterMap["body"] = *req.Body
		}
		if req.Channel != nil {
			afterMap["channel"] = *req.Channel
		}
		if req.Audience != nil {
			afterMap["audience"] = req.Audience
		}
		if req.ScheduledAt != nil {
			afterMap["scheduledAt"] = *req.ScheduledAt
		}
		afterJSON, _ := json.Marshal(afterMap)

		beforeJSON, _ := json.Marshal(map[string]any{"snapshot": snap})

		_, err = db.Exec(r.Context(), `
			INSERT INTO admin.admin_audit_log (action, actor_id, target_id, target_type, reason, after, before, created_at)
			VALUES ('ops.broadcast.updated', $1, $2, 'ops.broadcast', $3, $4, $5, NOW())
		`, identity.ActorID, id, req.Reason, afterJSON, beforeJSON)
		if err != nil {
			logger.Error("update broadcast", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{"id": id, "ok": true})
	}
}

// adminOpsBroadcastsScheduleHandler implements PATCH /api/admin/operations/broadcasts/{id}/schedule.
func adminOpsBroadcastsScheduleHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		handleBroadcastTransition(db, logger, w, r, "scheduled")
	}
}

// adminOpsBroadcastsCancelHandler implements PATCH /api/admin/operations/broadcasts/{id}/cancel.
func adminOpsBroadcastsCancelHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		handleBroadcastTransition(db, logger, w, r, "cancelled")
	}
}

// ── Helpers ─────────────────────────────────────────────────────────────────

type broadcastSnapshot struct {
	ID          string
	Status      string
	Title       *string
	Body        *string
	Channel     *string
	Audience    map[string]any
	ScheduledAt *string
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

func loadBroadcastSnapshot(ctx context.Context, db *pgxpool.Pool, targetID string) (*broadcastSnapshot, error) {
	rows, err := db.Query(ctx, `
		SELECT action, after, created_at
		FROM admin.admin_audit_log
		WHERE target_id = $1 AND target_type = 'ops.broadcast'
		ORDER BY created_at ASC
	`, targetID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []struct {
		Action    string
		After     json.RawMessage
		CreatedAt time.Time
	}
	for rows.Next() {
		var e struct {
			Action    string
			After     json.RawMessage
			CreatedAt time.Time
		}
		if err := rows.Scan(&e.Action, &e.After, &e.CreatedAt); err != nil {
			continue
		}
		events = append(events, e)
	}
	if len(events) == 0 {
		return nil, nil
	}

	latestState := events[len(events)-1]
	status := "draft"
	switch {
	case latestState.Action == "ops.broadcast.scheduled" || (len(latestState.Action) >= 10 && latestState.Action[len(latestState.Action)-10:] == ".scheduled"):
		status = "scheduled"
	case latestState.Action == "ops.broadcast.sent" || (len(latestState.Action) >= 5 && latestState.Action[len(latestState.Action)-5:] == ".sent"):
		status = "sent"
	case latestState.Action == "ops.broadcast.cancelled" || (len(latestState.Action) >= 10 && latestState.Action[len(latestState.Action)-10:] == ".cancelled"):
		status = "cancelled"
	}

	payload := map[string]any{}
	for _, e := range events {
		if e.Action == "ops.broadcast.created" || e.Action == "ops.broadcast.updated" {
			var p map[string]any
			if json.Unmarshal(e.After, &p) == nil {
				for k, v := range p {
					payload[k] = v
				}
			}
		}
	}

	snap := &broadcastSnapshot{
		ID:        targetID,
		Status:    status,
		CreatedAt: events[0].CreatedAt,
		UpdatedAt: latestState.CreatedAt,
	}

	if v, ok := payload["title"].(string); ok {
		snap.Title = &v
	}
	if v, ok := payload["body"].(string); ok {
		snap.Body = &v
	}
	if v, ok := payload["channel"].(string); ok {
		snap.Channel = &v
	}
	if v, ok := payload["audience"].(map[string]any); ok {
		snap.Audience = v
	}
	if v, ok := payload["scheduledAt"].(*string); ok {
		snap.ScheduledAt = v
	} else if v, ok := payload["scheduledAt"].(string); ok && v != "" {
		snap.ScheduledAt = &v
	}

	return snap, nil
}

func handleBroadcastTransition(db *pgxpool.Pool, logger *slog.Logger, w http.ResponseWriter, r *http.Request, to string) {
	identity, ok := authn.GetAdminIdentity(r.Context())
	if !ok {
		writeJSONError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	id := extractPathParam(r.URL.Path, "broadcasts", 1)
	if id == "" {
		writeJSONError(w, "broadcast id required", http.StatusBadRequest)
		return
	}

	snap, err := loadBroadcastSnapshot(r.Context(), db, id)
	if err != nil || snap == nil {
		writeJSONError(w, "broadcast not found", http.StatusNotFound)
		return
	}

	if to == "scheduled" && snap.Status != "draft" {
		writeJSONError(w, "only draft broadcasts can be scheduled", http.StatusBadRequest)
		return
	}
	if to == "cancelled" && snap.Status != "draft" && snap.Status != "scheduled" {
		writeJSONError(w, "broadcast is no longer cancellable", http.StatusBadRequest)
		return
	}

	var req struct {
		Reason string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.Reason == "" {
		writeJSONError(w, "reason is required", http.StatusBadRequest)
		return
	}

	afterJSON, _ := json.Marshal(map[string]any{"status": to})
	beforeJSON, _ := json.Marshal(map[string]any{"status": snap.Status})

	_, err = db.Exec(r.Context(), `
		INSERT INTO admin.admin_audit_log (action, actor_id, target_id, target_type, reason, after, before, created_at)
		VALUES ($1, $2, $3, 'ops.broadcast', $4, $5, $6, NOW())
	`, "ops.broadcast."+to, identity.ActorID, id, req.Reason, afterJSON, beforeJSON)
	if err != nil {
		logger.Error("transition broadcast", "error", err, "to", to)
		writeJSONError(w, "internal error", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"id": id, "status": to})
}