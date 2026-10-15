package httpserver

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/search"
)

// ── P1-A1.9: Admin Operations — Search Rebuild Sub-Domain (2 routes) ────────
// All routes require admin session + appropriate permissions.
// Contracts derived from NestJS apps/api/src/operations/operations.service.ts
// rebuildSearchProjection (full), partial reindex (contentType-scoped).

// adminOpsSearchRebuildHandler implements PATCH /api/admin/operations/search-rebuild.
func adminOpsSearchRebuildHandler(db *pgxpool.Pool, searchClient *search.Client, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !requireOperationsPermission(w, r, db, logger, "iam.manage") {
			return
		}
		identity, _ := authn.GetAdminIdentity(r.Context())
		var req struct {
			Reason string `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		req.Reason = strings.TrimSpace(req.Reason)
		if len([]rune(req.Reason)) < 3 {
			writeJSONError(w, "reason is required", http.StatusBadRequest)
			return
		}
		if searchClient == nil {
			writeJSONError(w, "search rebuild service unavailable", http.StatusServiceUnavailable)
			return
		}

		ctx := r.Context()
		documents, err := loadSearchDocuments(ctx, db, "")
		if err != nil {
			logger.Error("load search projection", "error", err)
			writeJSONError(w, "search projection unavailable", http.StatusInternalServerError)
			return
		}
		reindex, err := searchClient.ReindexDocuments(ctx, documents, "")
		if err != nil {
			logger.Error("search rebuild", "error", err)
			writeJSONError(w, "search rebuild failed", http.StatusBadGateway)
			return
		}
		result := map[string]any{"status": reindex.Status, "documentCount": reindex.DocumentCount, "taskUids": reindex.TaskUIDs}
		if err := recordSearchRebuildAudit(ctx, db, identity.ActorID, "ops.search.rebuild", "content_search", req.Reason, result); err != nil {
			logger.Error("audit search rebuild", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, result)
	}
}

// adminOpsSearchRebuildPartialHandler implements POST /api/admin/operations/search-rebuild/partial.
func adminOpsSearchRebuildPartialHandler(db *pgxpool.Pool, searchClient *search.Client, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !requireOperationsPermission(w, r, db, logger, "iam.manage") {
			return
		}
		identity, _ := authn.GetAdminIdentity(r.Context())
		var req struct {
			ContentType string `json:"contentType"`
			Reason      string `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		switch req.ContentType {
		case "lexeme", "kanji", "grammar", "example":
		default:
			writeJSONError(w, "unsupported contentType", http.StatusBadRequest)
			return
		}
		req.Reason = strings.TrimSpace(req.Reason)
		if len([]rune(req.Reason)) < 3 {
			writeJSONError(w, "reason is required", http.StatusBadRequest)
			return
		}
		if searchClient == nil {
			writeJSONError(w, "search rebuild service unavailable", http.StatusServiceUnavailable)
			return
		}

		ctx := r.Context()
		documents, err := loadSearchDocuments(ctx, db, req.ContentType)
		if err != nil {
			logger.Error("load partial search projection", "error", err, "contentType", req.ContentType)
			writeJSONError(w, "search projection unavailable", http.StatusInternalServerError)
			return
		}
		reindex, err := searchClient.ReindexDocuments(ctx, documents, req.ContentType)
		if err != nil {
			logger.Error("search partial rebuild", "error", err, "contentType", req.ContentType)
			writeJSONError(w, "search rebuild failed", http.StatusBadGateway)
			return
		}
		result := map[string]any{"contentType": req.ContentType, "status": reindex.Status, "documentCount": reindex.DocumentCount, "taskUids": reindex.TaskUIDs}
		targetID := "content_search:" + req.ContentType
		if err := recordSearchRebuildAudit(ctx, db, identity.ActorID, "ops.search.rebuild.partial", targetID, req.Reason, result); err != nil {
			logger.Error("audit search partial rebuild", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, result)
	}
}

func recordSearchRebuildAudit(ctx context.Context, db *pgxpool.Pool, actorID, action, targetID, reason string, result any) error {
	afterJSON, err := json.Marshal(result)
	if err != nil {
		return err
	}
	tx, err := db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if _, err := tx.Exec(ctx, `
		INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
		VALUES ($1, $2, $3, 'ops.search_index', $4, $5, NOW())`, action, actorID, targetID, reason, afterJSON); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
