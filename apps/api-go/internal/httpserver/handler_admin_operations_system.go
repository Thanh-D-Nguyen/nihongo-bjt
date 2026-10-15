package httpserver

import (
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
)

// writeJSON writes a JSON response with the given status code.
func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// ── P1-A1.1: Admin Operations — System Sub-Domain (11 routes) ───────────────
// Routes require an admin session; reads use viewer.audit or iam.manage and writes use iam.manage, except release metadata, which is session-scoped.
// Contracts derived from NestJS apps/api/src/operations/operations.service.ts.

// adminOpsSystemHealthHandler implements GET /api/admin/operations/system/health.
// Returns aggregated health checks: database, feature_flags, dead_letters, import_pipeline.
func adminOpsSystemHealthHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !requireOperationsPermission(w, r, db, logger, "iam.manage", "viewer.audit") {
			return
		}
		ctx := r.Context()

		// Check database connectivity
		dbHealthy := true
		if _, err := db.Exec(ctx, "SELECT 1"); err != nil {
			logger.Error("check database health", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		// Aggregate counts in parallel-safe sequential queries
		var featureFlagsTotal int
		var killSwitchesEnabled int
		var deadLettersOpen int
		var importErrors24h int

		for _, check := range []struct {
			query string
			dest  *int
			name  string
		}{
			{"SELECT COUNT(*) FROM ops.feature_flag", &featureFlagsTotal, "count feature flags"},
			{"SELECT COUNT(*) FROM ops.feature_flag WHERE enabled = true AND kill_switch = true", &killSwitchesEnabled, "count kill switches"},
			{"SELECT COUNT(*) FROM ops.dead_letter_entry WHERE status IN ('open', 'failed')", &deadLettersOpen, "count dead letters"},
			{"SELECT COUNT(*) FROM content.content_import_error WHERE created_at >= NOW() - INTERVAL '24 hours'", &importErrors24h, "count import errors"},
		} {
			if err := db.QueryRow(ctx, check.query).Scan(check.dest); err != nil {
				logger.Error(check.name, "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
		}

		type Check struct {
			Name   string `json:"name"`
			Status string `json:"status"`
		}
		checks := []Check{
			{Name: "database", Status: boolToStatus(dbHealthy)},
			{Name: "feature_flags", Status: ternaryStatus(featureFlagsTotal > 0, "healthy", "degraded")},
			{Name: "dead_letters", Status: ternaryStatus(deadLettersOpen == 0, "healthy", "degraded")},
			{Name: "import_pipeline", Status: ternaryStatus(importErrors24h <= 20, "healthy", "degraded")},
		}

		overallStatus := "healthy"
		for _, c := range checks {
			if c.Status != "healthy" {
				overallStatus = "degraded"
				break
			}
		}

		resp := map[string]any{
			"checks":              checks,
			"dbStatus":            boolToStatus(dbHealthy),
			"deadLettersOpen":     deadLettersOpen,
			"featureFlagsTotal":   featureFlagsTotal,
			"generatedAt":         time.Now().UTC().Format(time.RFC3339),
			"importErrors24h":     importErrors24h,
			"killSwitchesEnabled": killSwitchesEnabled,
			"status":              overallStatus,
		}
		writeJSON(w, http.StatusOK, resp)
	}
}

// adminOpsQueueHealthHandler implements GET /api/admin/operations/system/queue-health.
// Returns dead-letter breakdown by status and open import errors.
func adminOpsQueueHealthHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !requireOperationsPermission(w, r, db, logger, "iam.manage", "viewer.audit") {
			return
		}
		ctx := r.Context()

		var openDL, failedDL, resolvedDL, discardedDL int
		rows, err := db.Query(ctx, "SELECT status, COUNT(*) FROM ops.dead_letter_entry GROUP BY status")
		if err != nil {
			logger.Error("group dead letters", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		for rows.Next() {
			var status string
			var count int
			if err := rows.Scan(&status, &count); err != nil {
				logger.Error("scan dead letter counts", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			switch status {
			case "open":
				openDL = count
			case "failed":
				failedDL = count
			case "resolved":
				resolvedDL = count
			case "discarded":
				discardedDL = count
			}
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate dead letter counts", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		var importErrorsOpen int
		if err := db.QueryRow(ctx, "SELECT COUNT(*) FROM content.content_import_error WHERE created_at >= NOW() - INTERVAL '24 hours' AND severity IN ('critical', 'high')").Scan(&importErrorsOpen); err != nil {
			logger.Error("count import errors open", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		queueRows, err := db.Query(ctx, `SELECT substring(key from 7 for char_length(key) - 13), enabled
			FROM ops.feature_flag WHERE key LIKE 'queue.%.paused' ORDER BY key`)
		if err != nil {
			logger.Error("list queue pause states", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer queueRows.Close()
		type Queue struct {
			Name   string `json:"name"`
			Paused bool   `json:"paused"`
		}
		queues := []Queue{}
		for queueRows.Next() {
			var queue Queue
			if err := queueRows.Scan(&queue.Name, &queue.Paused); err != nil {
				logger.Error("scan queue pause state", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			queues = append(queues, queue)
		}
		if err := queueRows.Err(); err != nil {
			logger.Error("iterate queue pause states", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		stalledJobs := openDL + failedDL
		status := "healthy"
		if stalledJobs > 0 {
			status = "degraded"
		}

		resp := map[string]any{
			"queues":               queues,
			"deadLetters":          map[string]int{"total": openDL + failedDL},
			"discardedDeadLetters": discardedDL,
			"failedDeadLetters":    failedDL,
			"generatedAt":          time.Now().UTC().Format(time.RFC3339),
			"importErrorsOpen":     importErrorsOpen,
			"openDeadLetters":      openDL,
			"resolvedDeadLetters":  resolvedDL,
			"stalledJobs":          stalledJobs,
			"status":               status,
		}
		writeJSON(w, http.StatusOK, resp)
	}
}

// adminOpsSearchSyncHandler implements GET /api/admin/operations/system/search-sync.
// Returns search projection sync status and latest rebuild metadata.
func adminOpsSearchSyncHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !requireOperationsPermission(w, r, db, logger, "iam.manage", "viewer.audit") {
			return
		}
		ctx := r.Context()

		// Latest rebuild from admin_audit_log
		var lastRebuildAt *string
		var lastRebuildBy *string
		var indexedDocuments *int
		var rebuildCreatedAt *time.Time
		var rebuildID *string
		var actorID *string
		var afterJSON []byte

		err := db.QueryRow(ctx, `
			SELECT id, created_at, actor_id, after
			FROM ops.admin_audit_log
			WHERE action = 'ops.search.rebuild'
			ORDER BY created_at DESC LIMIT 1
		`).Scan(&rebuildID, &rebuildCreatedAt, &actorID, &afterJSON)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			logger.Error("load latest search rebuild", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err == nil && rebuildCreatedAt != nil {
			ts := rebuildCreatedAt.UTC().Format(time.RFC3339)
			lastRebuildAt = &ts
			lastRebuildBy = actorID
			// Extract indexed count from after JSON
			var afterMap map[string]any
			if json.Unmarshal(afterJSON, &afterMap) == nil {
				if idx, ok := afterMap["indexed"]; ok {
					if v, ok := idx.(float64); ok {
						iv := int(v)
						indexedDocuments = &iv
					}
				}
			}
		}

		// Content projection counts
		var lexemeCount, kanjiCount, grammarCount, exampleCount int
		for _, count := range []struct {
			query string
			dest  *int
		}{{"SELECT COUNT(*) FROM content.lexeme WHERE status = 'active'", &lexemeCount}, {"SELECT COUNT(*) FROM content.kanji WHERE status = 'active'", &kanjiCount}, {"SELECT COUNT(*) FROM content.grammar_point WHERE status = 'active'", &grammarCount}, {"SELECT COUNT(*) FROM content.example_sentence WHERE status = 'active'", &exampleCount}} {
			if err := db.QueryRow(ctx, count.query).Scan(count.dest); err != nil {
				logger.Error("count search projection", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
		}

		contentProjectionTotal := lexemeCount + kanjiCount + grammarCount + exampleCount

		status := "degraded"
		if rebuildCreatedAt != nil {
			hoursSince := time.Since(*rebuildCreatedAt).Hours()
			if hoursSince <= 24 {
				status = "healthy"
			}
		}

		resp := map[string]any{
			"contentProjectionTotal": contentProjectionTotal,
			"generatedAt":            time.Now().UTC().Format(time.RFC3339),
			"indexedDocuments":       indexedDocuments,
			"lastRebuildAt":          lastRebuildAt,
			"lastRebuildBy":          lastRebuildBy,
			"totalDocs":              contentProjectionTotal,
			"byType":                 map[string]int{"lexeme": lexemeCount, "kanji": kanjiCount, "grammar": grammarCount, "example": exampleCount},
			"ageMs":                  nil,
			"status":                 status,
		}
		if rebuildCreatedAt != nil && rebuildID != nil {
			resp["ageMs"] = time.Since(*rebuildCreatedAt).Milliseconds()
			resp["lastJob"] = map[string]any{"id": *rebuildID, "createdAt": rebuildCreatedAt.UTC().Format(time.RFC3339), "status": status}
		} else {
			resp["lastJob"] = nil
		}
		writeJSON(w, http.StatusOK, resp)
	}
}

// adminOpsReleaseHandler implements GET /api/admin/operations/system/release.
// Returns release/build metadata from environment variables.
func adminOpsReleaseHandler(logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		version := envOr("APP_VERSION", envOr("npm_package_version", envOr("VERCEL_GIT_COMMIT_TAG", "unknown")))
		commitSha := envOr("VERCEL_GIT_COMMIT_SHA", envOr("GIT_COMMIT_SHA", "unknown"))
		nodeVersion := runtime.Version()
		env := envOr("NODE_ENV", "development")

		resp := map[string]any{
			"commitSha":     commitSha,
			"environment":   env,
			"generatedAt":   time.Now().UTC().Format(time.RFC3339),
			"nodeVersion":   nodeVersion,
			"startedAt":     time.Now().UTC().Format(time.RFC3339), // Go doesn't track process start like Node
			"status":        "healthy",
			"uptimeSeconds": 0, // Not applicable in same way; placeholder
			"version":       version,
		}
		writeJSON(w, http.StatusOK, resp)
	}
}

// adminOpsQueueActionsHandler implements GET /api/admin/operations/system/queue-health/actions.
// Returns recent queue control audit events.
func adminOpsQueueActionsHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !requireOperationsPermission(w, r, db, logger, "iam.manage", "viewer.audit") {
			return
		}
		ctx := r.Context()
		queueName := r.URL.Query().Get("queueName")
		limit, ok := operationsSystemLimit(r)
		if !ok {
			writeJSONError(w, "invalid limit", http.StatusBadRequest)
			return
		}

		query := `
			SELECT a.id, a.action, a.actor_id, a.target_id, COALESCE(a.reason, ''), a.created_at,
			       COALESCE(act.display_name, '') as actor_name, COALESCE(act.email, '') as actor_email
			FROM ops.admin_audit_log a
			LEFT JOIN authz.admin_actor act ON act.id = a.actor_id
			WHERE a.target_type = 'ops.queue'`
		args := []any{}
		argIdx := 1
		if queueName != "" {
			query += fmt.Sprintf(" AND a.target_id = $%d", argIdx)
			args = append(args, queueName)
			argIdx++
		}
		query += fmt.Sprintf(" ORDER BY a.created_at DESC LIMIT $%d", argIdx)
		args = append(args, limit)

		rows, err := db.Query(ctx, query, args...)
		if err != nil {
			logger.Error("list queue actions", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type Action struct {
			ID     string `json:"id"`
			Action string `json:"action"`
			Actor  *struct {
				ID          string `json:"id"`
				DisplayName string `json:"displayName"`
				Email       string `json:"email"`
			} `json:"actor"`
			TargetID  string `json:"targetId"`
			Reason    string `json:"reason"`
			CreatedAt string `json:"createdAt"`
		}
		var actions []Action
		for rows.Next() {
			var a Action
			var createdAt time.Time
			var actorID, actorName, actorEmail string
			if err := rows.Scan(&a.ID, &a.Action, &actorID, &a.TargetID, &a.Reason, &createdAt, &actorName, &actorEmail); err != nil {
				logger.Error("scan queue action", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			a.Actor = &struct {
				ID          string `json:"id"`
				DisplayName string `json:"displayName"`
				Email       string `json:"email"`
			}{ID: actorID, DisplayName: actorName, Email: actorEmail}
			a.CreatedAt = createdAt.UTC().Format(time.RFC3339)
			actions = append(actions, a)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate queue actions", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if actions == nil {
			actions = []Action{}
		}
		writeJSON(w, http.StatusOK, actions)
	}
}

// adminOpsQueuePauseHandler implements POST /api/admin/operations/system/queue-health/pause.
// Sets queue.<name>.paused feature flag to true and records audit.
func adminOpsQueuePauseHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		handleQueueTransition(db, logger, w, r, "pause")
	}
}

// adminOpsQueueResumeHandler implements POST /api/admin/operations/system/queue-health/resume.
// Sets queue.<name>.paused feature flag to false and records audit.
func adminOpsQueueResumeHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		handleQueueTransition(db, logger, w, r, "resume")
	}
}

// adminOpsQueueDrainHandler implements POST /api/admin/operations/system/queue-health/drain.
// Records drain request audit (requires confirmation === queueName). Audit-only; workers observe flag.
func adminOpsQueueDrainHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		handleQueueTransition(db, logger, w, r, "drain")
	}
}

// adminOpsReleaseHistoryHandler implements GET /api/admin/operations/system/release/history.
// Returns recent release management audit events.
func adminOpsReleaseHistoryHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !requireOperationsPermission(w, r, db, logger, "iam.manage", "viewer.audit") {
			return
		}
		ctx := r.Context()
		limit, ok := operationsSystemLimit(r)
		if !ok {
			writeJSONError(w, "invalid limit", http.StatusBadRequest)
			return
		}

		rows, err := db.Query(ctx, `
			SELECT a.id, a.action, a.actor_id, a.target_id, COALESCE(a.reason, ''), a.after, a.created_at,
			       COALESCE(act.display_name, '') as actor_name, COALESCE(act.email, '') as actor_email
			FROM ops.admin_audit_log a
			LEFT JOIN authz.admin_actor act ON act.id = a.actor_id
			WHERE a.target_type = 'ops.release'
			ORDER BY a.created_at DESC LIMIT $1
		`, limit)
		if err != nil {
			logger.Error("list release history", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type Event struct {
			ID     string `json:"id"`
			Action string `json:"action"`
			Actor  *struct {
				ID          string `json:"id"`
				DisplayName string `json:"displayName"`
				Email       string `json:"email"`
			} `json:"actor"`
			TargetID  string          `json:"targetId"`
			Reason    string          `json:"reason"`
			After     json.RawMessage `json:"after,omitempty"`
			CreatedAt string          `json:"createdAt"`
		}
		var events []Event
		for rows.Next() {
			var e Event
			var createdAt time.Time
			var actorID, actorName, actorEmail string
			if err := rows.Scan(&e.ID, &e.Action, &actorID, &e.TargetID, &e.Reason, &e.After, &createdAt, &actorName, &actorEmail); err != nil {
				logger.Error("scan release history", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			e.Actor = &struct {
				ID          string `json:"id"`
				DisplayName string `json:"displayName"`
				Email       string `json:"email"`
			}{ID: actorID, DisplayName: actorName, Email: actorEmail}
			e.CreatedAt = createdAt.UTC().Format(time.RFC3339)
			events = append(events, e)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate release history", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if events == nil {
			events = []Event{}
		}
		writeJSON(w, http.StatusOK, events)
	}
}

// adminOpsReleaseMarkKnownGoodHandler implements POST /api/admin/operations/system/release/mark-known-good.
// Records known-good release audit (requires confirmation === version).
func adminOpsReleaseMarkKnownGoodHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !requireOperationsPermission(w, r, db, logger, "iam.manage") {
			return
		}
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		var req struct {
			Version      string `json:"version"`
			Reason       string `json:"reason"`
			Confirmation string `json:"confirmation"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if !validReleaseInput(req.Version, req.Reason) {
			writeJSONError(w, "version and reason are required", http.StatusBadRequest)
			return
		}
		if req.Confirmation != req.Version {
			writeJSON(w, http.StatusBadRequest, map[string]any{
				"code":    "typed_confirmation_required",
				"message": "mark-known-good requires confirmation field === version.",
			})
			return
		}

		afterJSON, _ := json.Marshal(map[string]any{
			"version":   req.Version,
			"knownGood": true,
		})
		_, err := db.Exec(r.Context(), `
			INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('ops.release.mark_known_good', $1, $2, 'ops.release', $3, $4, NOW())
		`, identity.ActorID, req.Version, req.Reason, afterJSON)
		if err != nil {
			logger.Error("mark release known good", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"version": req.Version, "status": "known_good"})
	}
}

// adminOpsReleasePrepareRollbackHandler implements POST /api/admin/operations/system/release/prepare-rollback.
// Records rollback preparation audit (requires confirmation === targetVersion).
func adminOpsReleasePrepareRollbackHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !requireOperationsPermission(w, r, db, logger, "iam.manage") {
			return
		}
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		var req struct {
			TargetVersion string `json:"targetVersion"`
			Reason        string `json:"reason"`
			Confirmation  string `json:"confirmation"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if !validReleaseInput(req.TargetVersion, req.Reason) {
			writeJSONError(w, "targetVersion and reason are required", http.StatusBadRequest)
			return
		}
		if req.Confirmation != req.TargetVersion {
			writeJSON(w, http.StatusBadRequest, map[string]any{
				"code":    "typed_confirmation_required",
				"message": "prepare-rollback requires confirmation field === targetVersion.",
			})
			return
		}

		currentVersion := envOr("APP_VERSION", envOr("npm_package_version", "unknown"))
		afterJSON, _ := json.Marshal(map[string]any{
			"currentVersion": currentVersion,
			"requestedAt":    time.Now().UTC().Format(time.RFC3339),
			"targetVersion":  req.TargetVersion,
		})
		_, err := db.Exec(r.Context(), `
			INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('ops.release.prepare_rollback', $1, $2, 'ops.release', $3, $4, NOW())
		`, identity.ActorID, req.TargetVersion, req.Reason, afterJSON)
		if err != nil {
			logger.Error("prepare rollback", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"targetVersion": req.TargetVersion, "status": "rollback_prepared"})
	}
}

// ── Helpers ─────────────────────────────────────────────────────────────────

func handleQueueTransition(db *pgxpool.Pool, logger *slog.Logger, w http.ResponseWriter, r *http.Request, action string) {
	if !requireOperationsPermission(w, r, db, logger, "iam.manage") {
		return
	}
	identity, ok := authn.GetAdminIdentity(r.Context())
	if !ok {
		writeJSONError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		QueueName    string `json:"queueName"`
		Reason       string `json:"reason"`
		Confirmation string `json:"confirmation,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if !validQueueInput(req.QueueName, req.Reason) {
		writeJSONError(w, "valid queueName and reason are required", http.StatusBadRequest)
		return
	}

	// Drain requires typed confirmation
	if action == "drain" && req.Confirmation != req.QueueName {
		writeJSON(w, http.StatusBadRequest, map[string]any{
			"code":    "typed_confirmation_required",
			"message": "Drain queue requires confirmation field === queueName.",
		})
		return
	}

	flagKey := "queue." + req.QueueName + ".paused"

	if action != "drain" {
		enabled := action == "pause"
		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin queue transition", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(r.Context())
		_, err = tx.Exec(r.Context(), `
			INSERT INTO ops.feature_flag (key, enabled, kill_switch, description, scope, rules, created_at, updated_at)
			VALUES ($1, $2, false, $3, 'ops', '{}', NOW(), NOW())
			ON CONFLICT (key) DO UPDATE SET enabled = $2, updated_at = NOW()
		`, flagKey, enabled, "Queue "+req.QueueName+" pause state (auto-managed by ops queue-health)")
		if err != nil {
			logger.Error("upsert queue flag", "error", err, "key", flagKey)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		// Record audit
		afterJSON, _ := json.Marshal(map[string]any{"key": flagKey, "enabled": enabled})
		_, err = tx.Exec(r.Context(), `
			INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ($1, $2, $3, 'ops.queue', $4, $5, NOW())
		`, "ops.queue."+action, identity.ActorID, req.QueueName, req.Reason, afterJSON)
		if err != nil {
			logger.Error("audit queue transition", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			logger.Error("commit queue transition", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"queueName": req.QueueName, "paused": enabled, "action": action})
	} else {
		// Drain: audit only
		afterJSON, _ := json.Marshal(map[string]any{"status": "drain_requested"})
		_, err := db.Exec(r.Context(), `
			INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('ops.queue.drain', $1, $2, 'ops.queue', $3, $4, NOW())
		`, identity.ActorID, req.QueueName, req.Reason, afterJSON)
		if err != nil {
			logger.Error("audit queue drain", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"queueName": req.QueueName, "action": action, "status": "drain_requested"})
	}
}

func operationsSystemLimit(r *http.Request) (int, bool) {
	raw := r.URL.Query().Get("limit")
	if raw == "" {
		return 50, true
	}
	if strings.TrimSpace(raw) != raw {
		return 0, false
	}
	limit, err := strconv.Atoi(raw)
	return limit, err == nil && limit >= 1 && limit <= 100
}

func validQueueInput(queueName, reason string) bool {
	if len(queueName) == 0 || len(queueName) > 64 || len(strings.TrimSpace(reason)) < 3 || len(reason) > 500 {
		return false
	}
	for _, r := range queueName {
		if !(r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' || r == '_' || r == '-') {
			return false
		}
	}
	return true
}

func validReleaseInput(version, reason string) bool {
	return len(strings.TrimSpace(version)) > 0 && len(version) <= 128 && len(strings.TrimSpace(reason)) >= 3 && len(reason) <= 500
}

func boolToStatus(b bool) string {
	if b {
		return "healthy"
	}
	return "down"
}

func ternaryStatus(cond bool, ifTrue, ifFalse string) string {
	if cond {
		return ifTrue
	}
	return ifFalse
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func queryInt(r *http.Request, key string, defaultVal int) int {
	s := r.URL.Query().Get(key)
	if s == "" {
		return defaultVal
	}
	n := 0
	for _, c := range s {
		if c >= '0' && c <= '9' {
			n = n*10 + int(c-'0')
		} else {
			break
		}
	}
	if n <= 0 {
		return defaultVal
	}
	return n
}
