package httpserver

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/search"
)

// ── P1-A1.9: Admin Operations — Search Rebuild Sub-Domain (2 routes) ────────
// All routes require admin session + appropriate permissions.
// Contracts derived from NestJS apps/api/src/operations/operations.service.ts
// rebuildSearchProjection (full), partial reindex (contentType-scoped).

// adminOpsSearchRebuildHandler implements PATCH /api/admin/operations/search-rebuild.
// Triggers a full search projection rebuild and records audit.
func adminOpsSearchRebuildHandler(db *pgxpool.Pool, searchClient *search.Client, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
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

		if searchClient == nil {
			writeJSONError(w, "search rebuild service unavailable", http.StatusServiceUnavailable)
			return
		}

		ctx := r.Context()

		// Trigger full rebuild via search client.
		err := searchClient.Reindex(ctx)
		if err != nil {
			logger.Error("search rebuild", "error", err)
			writeJSONError(w, "search rebuild failed", http.StatusInternalServerError)
			return
		}

		// Build summary response (actual rebuild is async/partial_schema_pending)
		summary := map[string]any{"status": "rebuild_requested", "partial_schema_pending": true}

		// Record audit
		afterJSON, _ := json.Marshal(summary)
		_, auditErr := db.Exec(ctx, `
			INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('ops.search.rebuild', $1, 'content_search', 'ops.search_index', $2, $3, NOW())`,
			identity.ActorID, req.Reason, afterJSON)
		if auditErr != nil {
			logger.Error("audit search rebuild", "error", auditErr)
		}

		writeJSON(w, http.StatusOK, summary)
	}
}

// adminOpsSearchRebuildPartialHandler implements POST /api/admin/operations/search-rebuild/partial.
// Triggers a contentType-scoped partial reindex. Currently delegates to full rebuild
// with audit attribution (partial_schema_pending until incremental indexer lands).
func adminOpsSearchRebuildPartialHandler(db *pgxpool.Pool, searchClient *search.Client, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		var req struct {
			ContentType string `json:"contentType"`
			Reason      string `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.ContentType == "" {
			writeJSONError(w, "contentType is required", http.StatusBadRequest)
			return
		}
		if req.Reason == "" {
			writeJSONError(w, "reason is required", http.StatusBadRequest)
			return
		}

		if searchClient == nil {
			writeJSONError(w, "search rebuild service unavailable", http.StatusServiceUnavailable)
			return
		}

		ctx := r.Context()

		// Delegate to full rebuild (NestJS does the same; partial_schema_pending).
		err := searchClient.Reindex(ctx)
		if err != nil {
			logger.Error("search partial rebuild", "error", err, "contentType", req.ContentType)
			writeJSONError(w, "search rebuild failed", http.StatusInternalServerError)
			return
		}

		// Build response with contentType attribution
		resp := map[string]any{
			"contentType":            req.ContentType,
			"status":                 "rebuild_requested",
			"partial_schema_pending": true,
		}

		// Record audit with contentType in targetId
		afterJSON, _ := json.Marshal(resp)
		targetID := "content_search:" + req.ContentType
		_, auditErr := db.Exec(ctx, `
			INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('ops.search.rebuild.partial', $1, $2, 'ops.search_index', $3, $4, NOW())`,
			identity.ActorID, targetID, req.Reason, afterJSON)
		if auditErr != nil {
			logger.Error("audit search partial rebuild", "error", auditErr)
		}

		writeJSON(w, http.StatusOK, resp)
	}
}

// Ensure context import is used.
var _ = context.Background
var _ = time.Now
