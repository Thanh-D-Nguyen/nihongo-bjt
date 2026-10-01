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
			whereParts = append(whereParts, fmt.Sprintf("(original_name ILIKE $%[1]d OR object_key ILIKE $%[1]d)", argIdx))
			args = append(args, pattern)
			argIdx++
		}

		whereClause := ""
		if len(whereParts) > 0 {
			whereClause = "WHERE " + strings.Join(whereParts, " AND ")
		}

		var total int
		db.QueryRow(r.Context(), "SELECT COUNT(*) FROM media.asset "+whereClause, args...).Scan(&total)

		dataQ := fmt.Sprintf(`SELECT id, object_key, original_name, mime_type, size_bytes, rights_status, license,
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
			ID           string          `json:"id"`
			ObjectKey    string          `json:"objectKey"`
			OriginalName string          `json:"originalName"`
			MimeType     string          `json:"mimeType"`
			SizeBytes    int64           `json:"sizeBytes"`
			RightsStatus *string         `json:"rightsStatus,omitempty"`
			License      *string         `json:"license,omitempty"`
			SourceURL    *string         `json:"sourceUrl,omitempty"`
			Provenance   json.RawMessage `json:"provenance,omitempty"`
			Accessibility json.RawMessage `json:"accessibility,omitempty"`
			Status       string          `json:"status"`
			CreatedAt    string          `json:"createdAt"`
			UpdatedAt    string          `json:"updatedAt"`
		}

		var items []Asset
		for rows.Next() {
			var a Asset
			var ca, ua time.Time
			if rows.Scan(&a.ID, &a.ObjectKey, &a.OriginalName, &a.MimeType, &a.SizeBytes,
				&a.RightsStatus, &a.License, &a.SourceURL, &a.Provenance, &a.Accessibility,
				&a.Status, &ca, &ua) == nil {
				a.CreatedAt = ca.UTC().Format(time.RFC3339)
				a.UpdatedAt = ua.UTC().Format(time.RFC3339)
				items = append(items, a)
			}
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
		if id == "" {
			writeJSONError(w, "media id required", http.StatusBadRequest)
			return
		}

		type Asset struct {
			ID            string          `json:"id"`
			ObjectKey     string          `json:"objectKey"`
			OriginalName  string          `json:"originalName"`
			MimeType      string          `json:"mimeType"`
			SizeBytes     int64           `json:"sizeBytes"`
			RightsStatus  *string         `json:"rightsStatus,omitempty"`
			License       *string         `json:"license,omitempty"`
			SourceURL     *string         `json:"sourceUrl,omitempty"`
			Provenance    json.RawMessage `json:"provenance,omitempty"`
			Accessibility json.RawMessage `json:"accessibility,omitempty"`
			Status        string          `json:"status"`
			CreatedAt     string          `json:"createdAt"`
			UpdatedAt     string          `json:"updatedAt"`
			Audit         []json.RawMessage `json:"audit"`
		}

		var a Asset
		var ca, ua time.Time
		err := db.QueryRow(r.Context(), `SELECT id, object_key, original_name, mime_type, size_bytes, rights_status, license,
			source_url, provenance, accessibility, status, created_at, updated_at
			FROM media.asset WHERE id=$1`, id).
			Scan(&a.ID, &a.ObjectKey, &a.OriginalName, &a.MimeType, &a.SizeBytes,
				&a.RightsStatus, &a.License, &a.SourceURL, &a.Provenance, &a.Accessibility,
				&a.Status, &ca, &ua)
		if err != nil {
			writeJSONError(w, "media asset not found", http.StatusNotFound)
			return
		}
		a.CreatedAt = ca.UTC().Format(time.RFC3339)
		a.UpdatedAt = ua.UTC().Format(time.RFC3339)

		a.Audit = []json.RawMessage{}
		auditRows, _ := db.Query(r.Context(), `SELECT id, action, actor_id, reason, before, after, created_at
			FROM ops.admin_audit_log WHERE target_id=$1 AND target_type='media.asset'
			ORDER BY created_at DESC LIMIT 30`, id)
		if auditRows != nil {
			for auditRows.Next() {
				var aid, action, actorID string
				var reason *string
				var before, after json.RawMessage
				var aca time.Time
				if auditRows.Scan(&aid, &action, &actorID, &reason, &before, &after, &aca) == nil {
					entry, _ := json.Marshal(map[string]any{
						"id": aid, "action": action, "actorId": actorID,
						"reason": reason, "before": before, "after": after,
						"createdAt": aca.UTC().Format(time.RFC3339),
					})
					a.Audit = append(a.Audit, entry)
				}
			}
			auditRows.Close()
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
		if id == "" {
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

		// Get before state
		var beforeJSON json.RawMessage
		db.QueryRow(r.Context(), `SELECT row_to_json(t) FROM (SELECT license, rights_status, source_url, provenance, accessibility FROM media.asset WHERE id=$1) t`, id).Scan(&beforeJSON)
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
			setClauses = append(setClauses, "rights_status = $"+itoa(argIdx))
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

		if _, err := db.Exec(r.Context(), query, args...); err != nil {
			logger.Error("patch media metadata", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		afterJSON, _ := json.Marshal(req)
		db.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, before, after, created_at)
			VALUES ('media.metadata.updated',$1,$2,'media.asset',$3,$4,$5,NOW())`,
			identity.ActorID, id, req.Reason, beforeJSON, afterJSON)

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
		if id == "" {
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

		var beforeStatus string
		err := db.QueryRow(r.Context(), "SELECT status FROM media.asset WHERE id=$1", id).Scan(&beforeStatus)
		if err != nil {
			writeJSONError(w, "media asset not found", http.StatusNotFound)
			return
		}

		_, err = db.Exec(r.Context(), "UPDATE media.asset SET status='deleted', updated_at=NOW() WHERE id=$1", id)
		if err != nil {
			logger.Error("soft delete media", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		beforeJSON, _ := json.Marshal(map[string]any{"status": beforeStatus})
		afterJSON, _ := json.Marshal(map[string]any{"status": "deleted"})
		db.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, before, after, created_at)
			VALUES ('media.soft_deleted',$1,$2,'media.asset',$3,$4,$5,NOW())`,
			identity.ActorID, id, req.Reason, beforeJSON, afterJSON)

		writeJSON(w, http.StatusOK, map[string]any{"id": id, "status": "deleted"})
	}
}

// ── Companion Admin ─────────────────────────────────────────────────────────

// adminCompanionConfigHandler implements GET /api/admin/companion/config.
func adminCompanionConfigHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var tipCount int
		db.QueryRow(r.Context(), "SELECT COUNT(*) FROM content.companion_tip").Scan(&tipCount)

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
		catRows, _ := db.Query(r.Context(), "SELECT DISTINCT category FROM content.companion_tip ORDER BY category")
		categories := []string{}
		if catRows != nil {
			for catRows.Next() {
				var c string
				if catRows.Scan(&c) == nil {
					categories = append(categories, c)
				}
			}
			catRows.Close()
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"currentRiveAsset":     "18912-35694-lil-guy.riv",
			"availableRiveAssets":  riveAssets,
			"proactiveTipIntervalMs": 45000,
			"sleepTimeoutMs":       120000,
			"tipCount":             tipCount,
			"tipCategories":        categories,
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
			if rows.Scan(&t.ID, &t.Category, &t.ContentJa, &t.ContentVi, &t.ExampleJa, &t.ExampleVi,
				&t.JLPTLevel, &t.Active, &t.SortOrder, &ca, &ua) == nil {
				t.CreatedAt = ca.UTC().Format(time.RFC3339)
				t.UpdatedAt = ua.UTC().Format(time.RFC3339)
				items = append(items, t)
			}
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

		var id string
		err := db.QueryRow(r.Context(), `INSERT INTO content.companion_tip
			(category, content_ja, content_vi, example_ja, example_vi, jlpt_level, active, sort_order, created_at, updated_at)
			VALUES ($1,$2,$3,$4,$5,$6,true,$7,NOW(),NOW()) RETURNING id`,
			req.Category, req.ContentJa, req.ContentVi, req.ExampleJa, req.ExampleVi, req.JLPTLevel, sortOrder).Scan(&id)
		if err != nil {
			logger.Error("create companion tip", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		afterJSON, _ := json.Marshal(map[string]any{"id": id, "category": req.Category})
		db.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('companion.tip.created',$1,$2,'companion_tip','create',$3,NOW())`,
			identity.ActorID, id, afterJSON)

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

		if _, err := db.Exec(r.Context(), query, args...); err != nil {
			logger.Error("patch companion tip", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		afterJSON, _ := json.Marshal(req)
		db.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('companion.tip.updated',$1,$2,'companion_tip','patch',$3,NOW())`,
			identity.ActorID, id, afterJSON)

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

		var exists bool
		db.QueryRow(r.Context(), "SELECT EXISTS(SELECT 1 FROM content.companion_tip WHERE id=$1)", id).Scan(&exists)
		if !exists {
			writeJSONError(w, "tip not found", http.StatusNotFound)
			return
		}

		db.Exec(r.Context(), "DELETE FROM content.companion_tip WHERE id=$1", id)

		beforeJSON, _ := json.Marshal(map[string]any{"id": id})
		db.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, before, created_at)
			VALUES ('companion.tip.deleted',$1,$2,'companion_tip','delete',$3,NOW())`,
			identity.ActorID, id, beforeJSON)

		writeJSON(w, http.StatusOK, map[string]any{"deleted": true})
	}
}

// ── Privacy Admin ───────────────────────────────────────────────────────────

// adminPrivacyRequestsListHandler implements GET /api/admin/privacy/requests.
func adminPrivacyRequestsListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		limit := queryInt(r, "limit", 50)
		offset := queryInt(r, "offset", 0)
		kind := r.URL.Query().Get("kind")
		status := r.URL.Query().Get("status")

		if limit < 1 || limit > 200 {
			limit = 50
		}
		if offset < 0 {
			offset = 0
		}

		whereParts := []string{}
		args := []any{}
		argIdx := 1

		if kind != "" {
			whereParts = append(whereParts, fmt.Sprintf("kind = $%d", argIdx))
			args = append(args, kind)
			argIdx++
		}
		if status != "" {
			whereParts = append(whereParts, fmt.Sprintf("status = $%d", argIdx))
			args = append(args, status)
			argIdx++
		}

		whereClause := ""
		if len(whereParts) > 0 {
			whereClause = "WHERE " + strings.Join(whereParts, " AND ")
		}

		var total int
		db.QueryRow(r.Context(), "SELECT COUNT(*) FROM privacy.request "+whereClause, args...).Scan(&total)

		dataQ := fmt.Sprintf(`SELECT id, user_id, kind, status, reason, result_payload, last_error,
			created_at, updated_at, completed_at
			FROM privacy.request %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
			whereClause, argIdx, argIdx+1)
		args = append(args, limit, offset)

		rows, err := db.Query(r.Context(), dataQ, args...)
		if err != nil {
			logger.Error("list privacy requests", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type Request struct {
			ID            string          `json:"id"`
			UserID        string          `json:"userId"`
			Kind          string          `json:"kind"`
			Status        string          `json:"status"`
			Reason        *string         `json:"reason,omitempty"`
			ResultPayload json.RawMessage `json:"resultPayload,omitempty"`
			LastError     *string         `json:"lastError,omitempty"`
			CreatedAt     string          `json:"createdAt"`
			UpdatedAt     string          `json:"updatedAt"`
			CompletedAt   *string         `json:"completedAt,omitempty"`
		}

		var items []Request
		for rows.Next() {
			var pr Request
			var ca, ua time.Time
			var cat *time.Time
			if rows.Scan(&pr.ID, &pr.UserID, &pr.Kind, &pr.Status, &pr.Reason, &pr.ResultPayload,
				&pr.LastError, &ca, &ua, &cat) == nil {
				pr.CreatedAt = ca.UTC().Format(time.RFC3339)
				pr.UpdatedAt = ua.UTC().Format(time.RFC3339)
				if cat != nil {
					s := cat.UTC().Format(time.RFC3339)
					pr.CompletedAt = &s
				}
				items = append(items, pr)
			}
		}
		if items == nil {
			items = []Request{}
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"items": items, "total": total, "limit": limit, "offset": offset,
		})
	}
}

// adminPrivacyRequestDetailHandler implements GET /api/admin/privacy/requests/{id}.
func adminPrivacyRequestDetailHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := extractPathParam(r.URL.Path, "requests", 1)
		if id == "" {
			writeJSONError(w, "request id required", http.StatusBadRequest)
			return
		}

		type Request struct {
			ID            string            `json:"id"`
			UserID        string            `json:"userId"`
			Kind          string            `json:"kind"`
			Status        string            `json:"status"`
			Reason        *string           `json:"reason,omitempty"`
			ResultPayload json.RawMessage   `json:"resultPayload,omitempty"`
			LastError     *string           `json:"lastError,omitempty"`
			CreatedAt     string            `json:"createdAt"`
			UpdatedAt     string            `json:"updatedAt"`
			CompletedAt   *string           `json:"completedAt,omitempty"`
			Audit         []json.RawMessage `json:"audit"`
		}

		var pr Request
		var ca, ua time.Time
		var cat *time.Time
		err := db.QueryRow(r.Context(), `SELECT id, user_id, kind, status, reason, result_payload, last_error,
			created_at, updated_at, completed_at
			FROM privacy.request WHERE id=$1`, id).
			Scan(&pr.ID, &pr.UserID, &pr.Kind, &pr.Status, &pr.Reason, &pr.ResultPayload,
				&pr.LastError, &ca, &ua, &cat)
		if err != nil {
			writeJSONError(w, "privacy request not found", http.StatusNotFound)
			return
		}
		pr.CreatedAt = ca.UTC().Format(time.RFC3339)
		pr.UpdatedAt = ua.UTC().Format(time.RFC3339)
		if cat != nil {
			s := cat.UTC().Format(time.RFC3339)
			pr.CompletedAt = &s
		}

		pr.Audit = []json.RawMessage{}
		auditRows, _ := db.Query(r.Context(), `SELECT id, action, actor_id, reason, before, after, created_at
			FROM ops.admin_audit_log WHERE target_id=$1 AND target_type='privacy.request'
			ORDER BY created_at DESC LIMIT 30`, id)
		if auditRows != nil {
			for auditRows.Next() {
				var aid, action, actorID string
				var reason *string
				var before, after json.RawMessage
				var aca time.Time
				if auditRows.Scan(&aid, &action, &actorID, &reason, &before, &after, &aca) == nil {
					entry, _ := json.Marshal(map[string]any{
						"id": aid, "action": action, "actorId": actorID,
						"reason": reason, "before": before, "after": after,
						"createdAt": aca.UTC().Format(time.RFC3339),
					})
					pr.Audit = append(pr.Audit, entry)
				}
			}
			auditRows.Close()
		}

		writeJSON(w, http.StatusOK, pr)
	}
}

// adminPrivacyRequestAcknowledgeHandler implements PATCH /api/admin/privacy/requests/{id}/acknowledge.
func adminPrivacyRequestAcknowledgeHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		id := extractPathParam(r.URL.Path, "requests", 1)
		if id == "" {
			writeJSONError(w, "request id required", http.StatusBadRequest)
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

		var beforeStatus string
		err := db.QueryRow(r.Context(), "SELECT status FROM privacy.request WHERE id=$1", id).Scan(&beforeStatus)
		if err != nil {
			writeJSONError(w, "privacy request not found", http.StatusNotFound)
			return
		}
		if beforeStatus != "pending" {
			writeJSONError(w, "only pending requests can be acknowledged", http.StatusBadRequest)
			return
		}

		_, err = db.Exec(r.Context(), "UPDATE privacy.request SET status='processing', updated_at=NOW() WHERE id=$1", id)
		if err != nil {
			logger.Error("acknowledge privacy request", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		beforeJSON, _ := json.Marshal(map[string]any{"status": beforeStatus})
		afterJSON, _ := json.Marshal(map[string]any{"status": "processing"})
		db.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, before, after, created_at)
			VALUES ('privacy.request.acknowledged',$1,$2,'privacy.request',$3,$4,$5,NOW())`,
			identity.ActorID, id, req.Reason, beforeJSON, afterJSON)

		writeJSON(w, http.StatusOK, map[string]any{"id": id, "status": "processing"})
	}
}

// adminPrivacyRequestFulfillHandler implements POST /api/admin/privacy/requests/{id}/fulfill.
func adminPrivacyRequestFulfillHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		id := extractPathParam(r.URL.Path, "requests", 1)
		if id == "" {
			writeJSONError(w, "request id required", http.StatusBadRequest)
			return
		}

		var req struct {
			Reason      string  `json:"reason"`
			DownloadURL *string `json:"downloadUrl"`
			Notes       *string `json:"notes"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if len(req.Reason) < 3 {
			writeJSONError(w, "reason must be at least 3 characters", http.StatusBadRequest)
			return
		}

		resultPayload, _ := json.Marshal(map[string]any{
			"downloadUrl": req.DownloadURL, "notes": req.Notes,
		})

		_, err := db.Exec(r.Context(), `UPDATE privacy.request SET
			status='completed', result_payload=$1, completed_at=NOW(), updated_at=NOW() WHERE id=$2`,
			resultPayload, id)
		if err != nil {
			logger.Error("fulfill privacy request", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		afterJSON, _ := json.Marshal(map[string]any{"status": "completed", "reason": req.Reason})
		db.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('privacy.request.fulfilled',$1,$2,'privacy.request',$3,$4,NOW())`,
			identity.ActorID, id, req.Reason, afterJSON)

		writeJSON(w, http.StatusOK, map[string]any{"id": id, "status": "completed"})
	}
}

// adminPrivacyRequestRejectHandler implements POST /api/admin/privacy/requests/{id}/reject.
func adminPrivacyRequestRejectHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		id := extractPathParam(r.URL.Path, "requests", 1)
		if id == "" {
			writeJSONError(w, "request id required", http.StatusBadRequest)
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

		_, err := db.Exec(r.Context(), `UPDATE privacy.request SET
			status='failed', last_error=$1, updated_at=NOW() WHERE id=$2`,
			req.Reason, id)
		if err != nil {
			logger.Error("reject privacy request", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		afterJSON, _ := json.Marshal(map[string]any{"status": "failed", "reason": req.Reason})
		db.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('privacy.request.rejected',$1,$2,'privacy.request',$3,$4,NOW())`,
			identity.ActorID, id, req.Reason, afterJSON)

		writeJSON(w, http.StatusOK, map[string]any{"id": id, "status": "failed"})
	}
}

// adminPrivacyErasureConfirmHandler implements POST /api/admin/privacy/requests/{id}/erasure-confirm.
func adminPrivacyErasureConfirmHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		id := extractPathParam(r.URL.Path, "requests", 1)
		if id == "" {
			writeJSONError(w, "request id required", http.StatusBadRequest)
			return
		}

		var req struct {
			Reason            string `json:"reason"`
			ConfirmationToken string `json:"confirmationToken"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if len(req.Reason) < 3 {
			writeJSONError(w, "reason must be at least 3 characters", http.StatusBadRequest)
			return
		}
		if req.ConfirmationToken != id {
			writeJSONError(w, "confirmationToken must match request id", http.StatusBadRequest)
			return
		}

		var kind, status string
		err := db.QueryRow(r.Context(), "SELECT kind, status FROM privacy.request WHERE id=$1", id).
			Scan(&kind, &status)
		if err != nil {
			writeJSONError(w, "privacy request not found", http.StatusNotFound)
			return
		}
		if kind != "delete" {
			writeJSONError(w, "only erasure (delete) requests can be confirmed", http.StatusBadRequest)
			return
		}

		_, err = db.Exec(r.Context(), `UPDATE privacy.request SET
			status='completed', completed_at=NOW(), updated_at=NOW() WHERE id=$1`, id)
		if err != nil {
			logger.Error("confirm erasure", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		afterJSON, _ := json.Marshal(map[string]any{"status": "completed", "kind": "delete", "irreversible": true})
		db.Exec(r.Context(), `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('privacy.erasure.confirmed',$1,$2,'privacy.request',$3,$4,NOW())`,
			identity.ActorID, id, req.Reason, afterJSON)

		writeJSON(w, http.StatusOK, map[string]any{"id": id, "status": "completed", "irreversible": true})
	}
}