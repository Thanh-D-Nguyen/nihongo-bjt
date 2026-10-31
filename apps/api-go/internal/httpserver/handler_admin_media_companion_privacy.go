package httpserver

import (
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
)

// ── P1-A15: Admin Media + Companion + Privacy (16 routes) ───────────────────
// Contracts derived from NestJS media-admin.controller.ts,
// companion-admin.controller.ts, privacy-admin.controller.ts.
// DB tables: media.asset, content.companion_tip, privacy.request,
// ops.admin_audit_log.

// ── Media Admin ─────────────────────────────────────────────────────────────

// adminMediaListHandler implements GET /api/admin/media.
func adminMediaListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		limit := queryInt(r, "limit", 50)
		offset := queryInt(r, "offset", 0)
		rightsStatus := r.URL.Query().Get("rightsStatus")
		mimeType := r.URL.Query().Get("mimeType")
		status := r.URL.Query().Get("status")
		q := r.URL.Query().Get("q")

		if limit < 1 || limit > 200 {
			limit = 50
		}
		if offset < 0 {
			offset = 0
		}

		whereParts := []string{}
		args := []any{}
		argIdx := 1

		if rightsStatus != "" {
			whereParts = append(whereParts, fmt.Sprintf("rights_status = $%d", argIdx))
			args = append(args, rightsStatus)
			argIdx++
		}
		if mimeType != "" {
			whereParts = append(whereParts, fmt.Sprintf("mime_type = $%d", argIdx))
			args = append(args, mimeType)
			argIdx++
		}
		if status != "" {
			whereParts = append(whereParts, fmt.Sprintf("status = $%d", argIdx))
			args = append(args, status)
			argIdx++
		}
		if q != "" {
			pattern := "%" + q + "%"
			whereParts = append(whereParts, fmt.Sprintf("(source_url ILIKE $%[1]d OR object_key ILIKE $%[1]d)", argIdx))
			args = append(args, pattern)
			argIdx++
		}

		whereClause := ""
		if len(whereParts) > 0 {
			whereClause = "WHERE " + strings.Join(whereParts, " AND ")
		}

		var total int
		if err := db.QueryRow(r.Context(), "SELECT COUNT(*) FROM media.asset "+whereClause, args...).Scan(&total); err != nil {
			logger.Error("count media assets admin", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		dataQ := fmt.Sprintf(`SELECT id, object_key, mime_type, byte_size, rights_status, license,
			source_url, provenance, accessibility, status, created_at, updated_at
			FROM media.asset %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
			whereClause, argIdx, argIdx+1)
		args = append(args, limit, offset)

		rows, err := db.Query(r.Context(), dataQ, args...)
		if err != nil {
			logger.Error("list media assets admin", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type Asset struct {
			ID            string          `json:"id"`
			ObjectKey     string          `json:"objectKey"`
			MimeType      string          `json:"mimeType"`
			SizeBytes     *int64          `json:"byteSize"`
			RightsStatus  *string         `json:"rightsStatus,omitempty"`
			License       *string         `json:"license,omitempty"`
			SourceURL     *string         `json:"sourceUrl"`
			Provenance    json.RawMessage `json:"provenance,omitempty"`
			Accessibility json.RawMessage `json:"accessibility,omitempty"`
			Status        string          `json:"status"`
			CreatedAt     string          `json:"createdAt"`
			UpdatedAt     string          `json:"updatedAt"`
		}

		var items []Asset
		for rows.Next() {
			var a Asset
			var ca, ua time.Time
			if err := rows.Scan(&a.ID, &a.ObjectKey, &a.MimeType, &a.SizeBytes,
				&a.RightsStatus, &a.License, &a.SourceURL, &a.Provenance, &a.Accessibility,
				&a.Status, &ca, &ua); err != nil {
				logger.Error("scan media asset admin", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			a.CreatedAt = ca.UTC().Format(time.RFC3339)
			a.UpdatedAt = ua.UTC().Format(time.RFC3339)
			items = append(items, a)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate media assets admin", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if items == nil {
			items = []Asset{}
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"items": items, "total": total, "limit": limit, "offset": offset,
		})
	}
}

// adminMediaDetailHandler implements GET /api/admin/media/{id}.
func adminMediaDetailHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := extractPathParam(r.URL.Path, "media", 1)
		if !isValidUUID(id) {
			writeJSONError(w, "media id required", http.StatusBadRequest)
			return
		}

		type Asset struct {
			ID            string            `json:"id"`
			ObjectKey     string            `json:"objectKey"`
			MimeType      string            `json:"mimeType"`
			SizeBytes     *int64            `json:"byteSize"`
			RightsStatus  *string           `json:"rightsStatus,omitempty"`
			License       *string           `json:"license,omitempty"`
			SourceURL     *string           `json:"sourceUrl"`
			Provenance    json.RawMessage   `json:"provenance,omitempty"`
			Accessibility json.RawMessage   `json:"accessibility,omitempty"`
			Status        string            `json:"status"`
			CreatedAt     string            `json:"createdAt"`
			UpdatedAt     string            `json:"updatedAt"`
			Audit         []json.RawMessage `json:"audit"`
		}

		var a Asset
		var ca, ua time.Time
		err := db.QueryRow(r.Context(), `SELECT id, object_key, mime_type, byte_size, rights_status, license,
			source_url, provenance, accessibility, status, created_at, updated_at
			FROM media.asset WHERE id=$1`, id).
			Scan(&a.ID, &a.ObjectKey, &a.MimeType, &a.SizeBytes,
				&a.RightsStatus, &a.License, &a.SourceURL, &a.Provenance, &a.Accessibility,
				&a.Status, &ca, &ua)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "media asset not found", http.StatusNotFound)
			return
		} else if err != nil {
			logger.Error("read admin media asset", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		a.CreatedAt = ca.UTC().Format(time.RFC3339)
		a.UpdatedAt = ua.UTC().Format(time.RFC3339)

		a.Audit = []json.RawMessage{}
		auditRows, err := db.Query(r.Context(), `SELECT id, action, actor_id, reason, before, after, created_at
			FROM ops.admin_audit_log WHERE target_id=$1 AND target_type='media.asset'
			ORDER BY created_at DESC LIMIT 30`, id)
		if err != nil {
			logger.Error("read media asset audit", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer auditRows.Close()
		for auditRows.Next() {
			var aid, action, actorID string
			var reason *string
			var before, after json.RawMessage
			var aca time.Time
			if err := auditRows.Scan(&aid, &action, &actorID, &reason, &before, &after, &aca); err != nil {
				logger.Error("scan media asset audit", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			entry, err := json.Marshal(map[string]any{
				"id": aid, "action": action, "actorId": actorID,
				"reason": reason, "before": before, "after": after,
				"createdAt": aca.UTC().Format(time.RFC3339),
			})
			if err != nil {
				logger.Error("encode media asset audit", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			a.Audit = append(a.Audit, entry)
		}
		if err := auditRows.Err(); err != nil {
			logger.Error("iterate media asset audit", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		writeJSON(w, http.StatusOK, a)
	}
}

// adminMediaMetadataPatchHandler implements PATCH /api/admin/media/{id}/metadata.
func adminMediaMetadataPatchHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		id := extractPathParam(r.URL.Path, "media", 1)
		if !isValidUUID(id) {
			writeJSONError(w, "media id required", http.StatusBadRequest)
			return
		}

		var req struct {
			License       *string         `json:"license"`
			RightsStatus  *string         `json:"rightsStatus"`
			SourceURL     *string         `json:"sourceUrl"`
			Provenance    json.RawMessage `json:"provenance"`
			Accessibility json.RawMessage `json:"accessibility"`
			Reason        string          `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if len(req.Reason) < 3 {
			writeJSONError(w, "reason must be at least 3 characters", http.StatusBadRequest)
			return
		}

		ctx := r.Context()
		tx, err := db.Begin(ctx)
		if err != nil {
			logger.Error("begin media metadata update", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(ctx)
		// Get before state
		var beforeJSON json.RawMessage
		err = tx.QueryRow(ctx, `SELECT row_to_json(t) FROM (SELECT license, rights_status, source_url, provenance, accessibility, status FROM media.asset WHERE id=$1 FOR UPDATE) t`, id).Scan(&beforeJSON)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "media asset not found", http.StatusNotFound)
			return
		} else if err != nil {
			logger.Error("read media metadata before update", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if beforeJSON == nil {
			writeJSONError(w, "media asset not found", http.StatusNotFound)
			return
		}

		setClauses := []string{}
		args := []any{}
		argIdx := 1

		if req.License != nil {
			setClauses = append(setClauses, "license = $"+itoa(argIdx))
			args = append(args, *req.License)
			argIdx++
		}
		if req.RightsStatus != nil {
			setClauses = append(setClauses, "rights_status = $"+itoa(argIdx)+"::text")
			setClauses = append(setClauses, `status = CASE
				WHEN object_key LIKE 'image-selection/%' AND mime_type LIKE 'image/%'
				 AND ((provider IN ('pixabay','pexels','wikimedia') AND provenance->>'delivery' = 'rehosted')
				   OR (provider = 'unsplash' AND provenance->>'delivery' = 'hotlink')) THEN CASE
					WHEN status IN ('pending_review','blocked') AND $`+itoa(argIdx)+`::text = 'cleared' THEN 'active'
					WHEN status = 'active' AND $`+itoa(argIdx)+`::text <> 'cleared' THEN 'blocked'
					WHEN status = 'pending_review' AND $`+itoa(argIdx)+`::text NOT IN ('cleared','pending_review') THEN 'blocked'
					ELSE status END
				ELSE status END`)
			args = append(args, *req.RightsStatus)
			argIdx++
		}
		if req.SourceURL != nil {
			setClauses = append(setClauses, "source_url = $"+itoa(argIdx))
			args = append(args, *req.SourceURL)
			argIdx++
		}
		if len(req.Provenance) > 0 {
			setClauses = append(setClauses, "provenance = $"+itoa(argIdx))
			args = append(args, req.Provenance)
			argIdx++
		}
		if len(req.Accessibility) > 0 {
			setClauses = append(setClauses, "accessibility = $"+itoa(argIdx))
			args = append(args, req.Accessibility)
			argIdx++
		}

		if len(setClauses) == 0 {
			writeJSONError(w, "at least one field to update is required", http.StatusBadRequest)
			return
		}
		setClauses = append(setClauses, "updated_at = NOW()")

		query := "UPDATE media.asset SET " + joinStrings(setClauses, ", ") + " WHERE id = $" + itoa(argIdx)
		args = append(args, id)

		if _, err := tx.Exec(ctx, query, args...); err != nil {
			logger.Error("patch media metadata", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		var afterJSON json.RawMessage
		if err := tx.QueryRow(ctx, `SELECT row_to_json(t) FROM (SELECT license, rights_status, source_url, provenance, accessibility, status FROM media.asset WHERE id=$1) t`, id).Scan(&afterJSON); err != nil {
			logger.Error("read media metadata after update", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := writeAdminAuditWithReason(ctx, tx, identity.ActorID, "media.metadata.updated", "media.asset", id, req.Reason, beforeJSON, afterJSON); err != nil {
			logger.Error("audit media metadata update", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			logger.Error("commit media metadata update", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{"id": id, "updated": true})
	}
}

// adminMediaSoftDeleteHandler implements DELETE /api/admin/media/{id}.
func adminMediaSoftDeleteHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		id := extractPathParam(r.URL.Path, "media", 1)
		if !isValidUUID(id) {
			writeJSONError(w, "media id required", http.StatusBadRequest)
			return
		}

		var req struct {
			Reason string `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if len(req.Reason) < 3 {
			writeJSONError(w, "reason must be at least 3 characters", http.StatusBadRequest)
			return
		}

		ctx := r.Context()
		tx, err := db.Begin(ctx)
		if err != nil {
			logger.Error("begin media soft delete", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(ctx)
		var beforeStatus string
		err = tx.QueryRow(ctx, "SELECT status FROM media.asset WHERE id=$1 FOR UPDATE", id).Scan(&beforeStatus)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "media asset not found", http.StatusNotFound)
			return
		} else if err != nil {
			logger.Error("read media asset before delete", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		_, err = tx.Exec(ctx, "UPDATE media.asset SET status='deleted', updated_at=NOW() WHERE id=$1", id)
		if err != nil {
			logger.Error("soft delete media", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		if err := writeAdminAuditWithReason(ctx, tx, identity.ActorID, "media.soft_deleted", "media.asset", id, req.Reason, map[string]any{"status": beforeStatus}, map[string]any{"status": "deleted"}); err != nil {
			logger.Error("audit media soft delete", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			logger.Error("commit media soft delete", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{"id": id, "status": "deleted"})
	}
}

// ── Companion Admin ─────────────────────────────────────────────────────────

// adminCompanionConfigHandler implements GET /api/admin/companion/config.
func adminCompanionConfigHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var tipCount int
		if err := db.QueryRow(r.Context(), "SELECT COUNT(*) FROM content.companion_tip").Scan(&tipCount); err != nil {
			logger.Error("count companion tips", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		type RiveAsset struct {
			File  string `json:"file"`
			Label string `json:"label"`
		}
		riveAssets := []RiveAsset{
			{File: "18912-35694-lil-guy.riv", Label: "Lil Guy (default companion)"},
			{File: "20538-38646-cheeky-chops.riv", Label: "Cheeky Chops"},
			{File: "23764-44433-character-customization-ui.riv", Label: "Character Customization"},
			{File: "24876-46460-interactive-bunny-character.riv", Label: "Bunny Character"},
			{File: "cat-with-butterfly.riv", Label: "Cat with Butterfly"},
		}

		// Get distinct categories
		catRows, err := db.Query(r.Context(), "SELECT DISTINCT category FROM content.companion_tip ORDER BY category")
		if err != nil {
			logger.Error("list companion tip categories", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer catRows.Close()
		categories := []string{}
		for catRows.Next() {
			var c string
			if err := catRows.Scan(&c); err != nil {
				logger.Error("scan companion tip category", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			categories = append(categories, c)
		}
		if err := catRows.Err(); err != nil {
			logger.Error("iterate companion tip categories", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"currentRiveAsset":       "18912-35694-lil-guy.riv",
			"availableRiveAssets":    riveAssets,
			"proactiveTipIntervalMs": 45000,
			"sleepTimeoutMs":         120000,
			"tipCount":               tipCount,
			"tipCategories":          categories,
		})
	}
}

// adminCompanionTipsListHandler implements GET /api/admin/companion/tips.
func adminCompanionTipsListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := db.Query(r.Context(), `SELECT id, category, content_ja, content_vi, example_ja, example_vi,
			jlpt_level, active, sort_order, created_at, updated_at
			FROM content.companion_tip ORDER BY sort_order ASC, created_at ASC`)
		if err != nil {
			logger.Error("list companion tips", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type Tip struct {
			ID        string  `json:"id"`
			Category  string  `json:"category"`
			ContentJa string  `json:"contentJa"`
			ContentVi string  `json:"contentVi"`
			ExampleJa *string `json:"exampleJa,omitempty"`
			ExampleVi *string `json:"exampleVi,omitempty"`
			JLPTLevel *string `json:"jlptLevel,omitempty"`
			Active    bool    `json:"active"`
			SortOrder int     `json:"sortOrder"`
			CreatedAt string  `json:"createdAt"`
			UpdatedAt string  `json:"updatedAt"`
		}

		var items []Tip
		for rows.Next() {
			var t Tip
			var ca, ua time.Time
			if err := rows.Scan(&t.ID, &t.Category, &t.ContentJa, &t.ContentVi, &t.ExampleJa, &t.ExampleVi,
				&t.JLPTLevel, &t.Active, &t.SortOrder, &ca, &ua); err != nil {
				logger.Error("scan companion tip", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			t.CreatedAt = ca.UTC().Format(time.RFC3339)
			t.UpdatedAt = ua.UTC().Format(time.RFC3339)
			items = append(items, t)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate companion tips", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if items == nil {
			items = []Tip{}
		}
		writeJSON(w, http.StatusOK, items)
	}
}

// adminCompanionTipCreateHandler implements POST /api/admin/companion/tips.
func adminCompanionTipCreateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		var req struct {
			Category  string  `json:"category"`
			ContentJa string  `json:"contentJa"`
			ContentVi string  `json:"contentVi"`
			ExampleJa *string `json:"exampleJa"`
			ExampleVi *string `json:"exampleVi"`
			JLPTLevel *string `json:"jlptLevel"`
			SortOrder *int    `json:"sortOrder"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}

		validCategories := map[string]bool{
			"grammar": true, "vocab": true, "keigo": true, "culture": true, "business": true,
		}
		if !validCategories[req.Category] {
			writeJSONError(w, "invalid category; must be grammar, vocab, keigo, culture, or business", http.StatusBadRequest)
			return
		}
		if req.ContentJa == "" || req.ContentVi == "" {
			writeJSONError(w, "contentJa and contentVi required", http.StatusBadRequest)
			return
		}

		sortOrder := 0
		if req.SortOrder != nil {
			sortOrder = *req.SortOrder
		}

		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin companion tip create", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(r.Context())

		var id string
		err = tx.QueryRow(r.Context(), `INSERT INTO content.companion_tip
			(category, content_ja, content_vi, example_ja, example_vi, jlpt_level, active, sort_order, created_at, updated_at)
			VALUES ($1,$2,$3,$4,$5,$6,true,$7,NOW(),NOW()) RETURNING id`,
			req.Category, req.ContentJa, req.ContentVi, req.ExampleJa, req.ExampleVi, req.JLPTLevel, sortOrder).Scan(&id)
		if err != nil {
			logger.Error("create companion tip", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		afterJSON, err := json.Marshal(map[string]any{"id": id, "category": req.Category})
		if err != nil {
			logger.Error("encode companion tip audit", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if _, err := tx.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('companion.tip.created',$1,$2,'companion_tip','create',$3,NOW())`,
			identity.ActorID, id, afterJSON); err != nil {
			logger.Error("audit companion tip create", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			logger.Error("commit companion tip create", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		writeJSON(w, http.StatusCreated, map[string]any{"id": id})
	}
}

// adminCompanionTipPatchHandler implements PATCH /api/admin/companion/tips/{id}.
func adminCompanionTipPatchHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		id := extractPathParam(r.URL.Path, "tips", 1)
		if id == "" {
			writeJSONError(w, "tip id required", http.StatusBadRequest)
			return
		}
		if _, err := uuid.Parse(id); err != nil {
			writeJSONError(w, "invalid tip id", http.StatusBadRequest)
			return
		}

		var req map[string]any
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}

		if cat, ok := req["category"]; ok {
			validCategories := map[string]bool{
				"grammar": true, "vocab": true, "keigo": true, "culture": true, "business": true,
			}
			if cs, ok := cat.(string); !ok || !validCategories[cs] {
				writeJSONError(w, "invalid category", http.StatusBadRequest)
				return
			}
		}

		setClauses := []string{}
		args := []any{}
		argIdx := 1
		fieldMap := map[string]string{
			"category": "category", "contentJa": "content_ja", "contentVi": "content_vi",
			"exampleJa": "example_ja", "exampleVi": "example_vi", "jlptLevel": "jlpt_level",
			"active": "active", "sortOrder": "sort_order",
		}
		for k, col := range fieldMap {
			if v, ok := req[k]; ok {
				setClauses = append(setClauses, col+" = $"+itoa(argIdx))
				args = append(args, v)
				argIdx++
			}
		}

		if len(setClauses) == 0 {
			writeJSONError(w, "at least one field to update is required", http.StatusBadRequest)
			return
		}
		setClauses = append(setClauses, "updated_at = NOW()")

		query := "UPDATE content.companion_tip SET " + joinStrings(setClauses, ", ") + " WHERE id = $" + itoa(argIdx)
		args = append(args, id)

		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin companion tip update", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(r.Context())
		result, err := tx.Exec(r.Context(), query, args...)
		if err != nil {
			logger.Error("patch companion tip", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if result.RowsAffected() == 0 {
			writeJSONError(w, "tip not found", http.StatusNotFound)
			return
		}

		afterJSON, err := json.Marshal(req)
		if err != nil {
			logger.Error("encode companion tip audit", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if _, err := tx.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('companion.tip.updated',$1,$2,'companion_tip','patch',$3,NOW())`,
			identity.ActorID, id, afterJSON); err != nil {
			logger.Error("audit companion tip update", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			logger.Error("commit companion tip update", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{"id": id, "updated": true})
	}
}

// adminCompanionTipDeleteHandler implements DELETE /api/admin/companion/tips/{id}.
func adminCompanionTipDeleteHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		id := extractPathParam(r.URL.Path, "tips", 1)
		if id == "" {
			writeJSONError(w, "tip id required", http.StatusBadRequest)
			return
		}
		if _, err := uuid.Parse(id); err != nil {
			writeJSONError(w, "invalid tip id", http.StatusBadRequest)
			return
		}

		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin companion tip delete", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(r.Context())
		result, err := tx.Exec(r.Context(), "DELETE FROM content.companion_tip WHERE id=$1", id)
		if err != nil {
			logger.Error("delete companion tip", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if result.RowsAffected() == 0 {
			writeJSONError(w, "tip not found", http.StatusNotFound)
			return
		}

		beforeJSON, err := json.Marshal(map[string]any{"id": id})
		if err != nil {
			logger.Error("encode companion tip delete audit", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if _, err := tx.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, before, created_at)
			VALUES ('companion.tip.deleted',$1,$2,'companion_tip','delete',$3,NOW())`,
			identity.ActorID, id, beforeJSON); err != nil {
			logger.Error("audit companion tip delete", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			logger.Error("commit companion tip delete", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{"deleted": true})
	}
}
