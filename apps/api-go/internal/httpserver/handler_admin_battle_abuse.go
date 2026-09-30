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

// ── P1-A4.1: Admin Battle — Abuse Reports Sub-Domain (4 routes) ─────────────
// All routes require admin session + appropriate permissions.
// Contracts derived from NestJS apps/api/src/battle/battle-abuse-admin.repository.ts
// list, detail, resolve, escalate.

// adminBattleAbuseListHandler implements GET /api/admin/battle/abuse.
func adminBattleAbuseListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		statusFilter := r.URL.Query().Get("status")
		severityFilter := r.URL.Query().Get("severity")
		kindFilter := r.URL.Query().Get("kind")
		reporterID := r.URL.Query().Get("reporterId")
		subjectID := r.URL.Query().Get("subjectId")
		fromStr := r.URL.Query().Get("from")
		toStr := r.URL.Query().Get("to")
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
		if severityFilter != "" {
			whereParts = append(whereParts, fmt.Sprintf("severity = $%d", argIdx))
			args = append(args, severityFilter)
			argIdx++
		}
		if kindFilter != "" {
			whereParts = append(whereParts, fmt.Sprintf("kind = $%d", argIdx))
			args = append(args, kindFilter)
			argIdx++
		}
		if reporterID != "" {
			whereParts = append(whereParts, fmt.Sprintf("reporter_id = $%d", argIdx))
			args = append(args, reporterID)
			argIdx++
		}
		if subjectID != "" {
			whereParts = append(whereParts, fmt.Sprintf("subject_id = $%d", argIdx))
			args = append(args, subjectID)
			argIdx++
		}
		if fromStr != "" {
			whereParts = append(whereParts, fmt.Sprintf("created_at >= $%d", argIdx))
			args = append(args, fromStr)
			argIdx++
		}
		if toStr != "" {
			whereParts = append(whereParts, fmt.Sprintf("created_at <= $%d", argIdx))
			args = append(args, toStr)
			argIdx++
		}

		whereClause := ""
		if len(whereParts) > 0 {
			whereClause = "WHERE " + strings.Join(whereParts, " AND ")
		}

		countQuery := "SELECT COUNT(*) FROM learning.battle_abuse_report " + whereClause
		var total int
		if err := db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
			logger.Error("count battle abuse reports", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		dataQuery := fmt.Sprintf(`
			SELECT id, reporter_id, subject_id, match_id, severity, kind, status,
			       action_taken, resolved_at, escalated_at, created_at, updated_at
			FROM learning.battle_abuse_report %s
			ORDER BY severity DESC, created_at DESC LIMIT $%d OFFSET $%d`,
			whereClause, argIdx, argIdx+1)
		args = append(args, pageSize, offset)

		rows, err := db.Query(ctx, dataQuery, args...)
		if err != nil {
			logger.Error("list battle abuse reports", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type AbuseSummary struct {
			ID          string  `json:"id"`
			ReporterID  string  `json:"reporterId"`
			SubjectID   string  `json:"subjectId"`
			MatchID     *string `json:"matchId,omitempty"`
			Severity    string  `json:"severity"`
			Kind        string  `json:"kind"`
			Status      string  `json:"status"`
			ActionTaken *string `json:"actionTaken,omitempty"`
			ResolvedAt  *string `json:"resolvedAt,omitempty"`
			EscalatedAt *string `json:"escalatedAt,omitempty"`
			CreatedAt   string  `json:"createdAt"`
			UpdatedAt   string  `json:"updatedAt"`
		}

		var items []AbuseSummary
		for rows.Next() {
			var a AbuseSummary
			var createdAt, updatedAt time.Time
			var resolvedAt, escalatedAt *time.Time
			if err := rows.Scan(&a.ID, &a.ReporterID, &a.SubjectID, &a.MatchID,
				&a.Severity, &a.Kind, &a.Status, &a.ActionTaken,
				&resolvedAt, &escalatedAt, &createdAt, &updatedAt); err == nil {
				a.CreatedAt = createdAt.UTC().Format(time.RFC3339)
				a.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
				if resolvedAt != nil {
					s := resolvedAt.UTC().Format(time.RFC3339)
					a.ResolvedAt = &s
				}
				if escalatedAt != nil {
					s := escalatedAt.UTC().Format(time.RFC3339)
					a.EscalatedAt = &s
				}
				items = append(items, a)
			}
		}
		if items == nil {
			items = []AbuseSummary{}
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"items":    items,
			"page":     page,
			"pageSize": pageSize,
			"total":    total,
		})
	}
}

// adminBattleAbuseDetailHandler implements GET /api/admin/battle/abuse/{id}.
func adminBattleAbuseDetailHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := extractPathParam(r.URL.Path, "abuse", 1)
		if id == "" {
			writeJSONError(w, "abuse report id required", http.StatusBadRequest)
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
		type PriorReport struct {
			ID          string  `json:"id"`
			Status      string  `json:"status"`
			Severity    string  `json:"severity"`
			Kind        string  `json:"kind"`
			ActionTaken *string `json:"actionTaken,omitempty"`
			CreatedAt   string  `json:"createdAt"`
		}
		type AbuseDetail struct {
			ID                  string          `json:"id"`
			ReporterID          string          `json:"reporterId"`
			SubjectID           string          `json:"subjectId"`
			MatchID             *string         `json:"matchId,omitempty"`
			Severity            string          `json:"severity"`
			Kind                string          `json:"kind"`
			Status              string          `json:"status"`
			ActionTaken         *string         `json:"actionTaken,omitempty"`
			ResolutionNotes     *string         `json:"resolutionNotes,omitempty"`
			ResolvedAt          *string         `json:"resolvedAt,omitempty"`
			ResolvedByID        *string         `json:"resolvedById,omitempty"`
			EscalatedAt         *string         `json:"escalatedAt,omitempty"`
			CreatedAt           string          `json:"createdAt"`
			UpdatedAt           string          `json:"updatedAt"`
			PriorAgainstSubject []PriorReport   `json:"priorAgainstSubject"`
			Audit               []AuditEntry    `json:"audit"`
		}

		var ad AbuseDetail
		var createdAt, updatedAt time.Time
		var resolvedAt, escalatedAt *time.Time
		err := db.QueryRow(ctx, `
			SELECT id, reporter_id, subject_id, match_id, severity, kind, status,
			       action_taken, resolution_notes, resolved_at, resolved_by_id,
			       escalated_at, created_at, updated_at
			FROM learning.battle_abuse_report WHERE id = $1`, id).Scan(
			&ad.ID, &ad.ReporterID, &ad.SubjectID, &ad.MatchID,
			&ad.Severity, &ad.Kind, &ad.Status, &ad.ActionTaken,
			&ad.ResolutionNotes, &resolvedAt, &ad.ResolvedByID,
			&escalatedAt, &createdAt, &updatedAt)
		if err != nil {
			writeJSONError(w, "abuse report not found", http.StatusNotFound)
			return
		}
		ad.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		ad.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
		if resolvedAt != nil {
			s := resolvedAt.UTC().Format(time.RFC3339)
			ad.ResolvedAt = &s
		}
		if escalatedAt != nil {
			s := escalatedAt.UTC().Format(time.RFC3339)
			ad.EscalatedAt = &s
		}

		// Prior reports against same subject
		pRows, err := db.Query(ctx, `
			SELECT id, status, severity, kind, action_taken, created_at
			FROM learning.battle_abuse_report
			WHERE subject_id = $1 AND id != $2
			ORDER BY created_at DESC LIMIT 25`, ad.SubjectID, id)
		if err == nil {
			for pRows.Next() {
				var pr PriorReport
				var ts time.Time
				if pRows.Scan(&pr.ID, &pr.Status, &pr.Severity, &pr.Kind, &pr.ActionTaken, &ts) == nil {
					pr.CreatedAt = ts.UTC().Format(time.RFC3339)
					ad.PriorAgainstSubject = append(ad.PriorAgainstSubject, pr)
				}
			}
			pRows.Close()
		}
		if ad.PriorAgainstSubject == nil {
			ad.PriorAgainstSubject = []PriorReport{}
		}

		// Audit trail
		aRows, err := db.Query(ctx, `
			SELECT a.id, a.action, a.actor_id, act.display_name, act.email,
			       a.reason, a.after, a.before, a.created_at
			FROM admin.admin_audit_log a
			LEFT JOIN admin.admin_actor act ON act.id = a.actor_id
			WHERE a.target_id = $1 AND a.target_type = 'learning.battle_abuse_report'
			ORDER BY a.created_at DESC LIMIT 20`, id)
		if err == nil {
			for aRows.Next() {
				var ae AuditEntry
				var ts time.Time
				if aRows.Scan(&ae.ID, &ae.Action, &ae.ActorID, &ae.ActorName,
					&ae.ActorEmail, &ae.Reason, &ae.After, &ae.Before, &ts) == nil {
					ae.CreatedAt = ts.UTC().Format(time.RFC3339)
					ad.Audit = append(ad.Audit, ae)
				}
			}
			aRows.Close()
		}
		if ad.Audit == nil {
			ad.Audit = []AuditEntry{}
		}

		writeJSON(w, http.StatusOK, ad)
	}
}

// adminBattleAbuseResolveHandler implements POST /api/admin/battle/abuse/{id}/resolve.
func adminBattleAbuseResolveHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "abuse", 1)
		if id == "" {
			writeJSONError(w, "abuse report id required", http.StatusBadRequest)
			return
		}
		var req struct {
			Action string `json:"action"`
			Notes  string `json:"notes"`
			Reason string `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.Action != "dismissed" && req.Action != "warned" && req.Action != "banned" && req.Action != "other" {
			writeJSONError(w, "action must be dismissed, warned, banned, or other", http.StatusBadRequest)
			return
		}

		ctx := r.Context()

		// Fetch before state
		var beforeStatus, beforeActionTaken *string
		err := db.QueryRow(ctx, "SELECT status, action_taken FROM learning.battle_abuse_report WHERE id = $1", id).
			Scan(&beforeStatus, &beforeActionTaken)
		if err != nil {
			writeJSONError(w, "abuse report not found", http.StatusNotFound)
			return
		}
		if beforeStatus != nil && (*beforeStatus == "resolved" || *beforeStatus == "dismissed") {
			writeJSONError(w, "already resolved", http.StatusBadRequest)
			return
		}

		newStatus := "resolved"
		if req.Action == "dismissed" {
			newStatus = "dismissed"
		}

		db.Exec(ctx, `UPDATE learning.battle_abuse_report
			SET action_taken = $1, resolution_notes = $2, resolved_at = NOW(),
			    resolved_by_id = $3, status = $4, updated_at = NOW()
			WHERE id = $5`, req.Action, req.Notes, identity.ActorID, newStatus, id)

		afterJSON, _ := json.Marshal(map[string]any{"actionTaken": req.Action, "status": newStatus})
		beforeJSON, _ := json.Marshal(map[string]any{"actionTaken": beforeActionTaken, "status": beforeStatus})
		db.Exec(ctx, `INSERT INTO admin.admin_audit_log (action, actor_id, target_id, target_type, reason, after, before, created_at)
			VALUES ('admin.battle.abuse.resolved', $1, $2, 'learning.battle_abuse_report', $3, $4, $5, NOW())`,
			identity.ActorID, id, req.Reason, afterJSON, beforeJSON)

		// Return detail view
		detailHandler := adminBattleAbuseDetailHandler(db, logger)
		detailHandler(w, r)
	}
}

// adminBattleAbuseEscalateHandler implements POST /api/admin/battle/abuse/{id}/escalate.
func adminBattleAbuseEscalateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "abuse", 1)
		if id == "" {
			writeJSONError(w, "abuse report id required", http.StatusBadRequest)
			return
		}
		var req struct {
			Reason string `json:"reason"`
		}
		json.NewDecoder(r.Body).Decode(&req)

		ctx := r.Context()

		// Fetch before state
		var beforeStatus string
		err := db.QueryRow(ctx, "SELECT status FROM learning.battle_abuse_report WHERE id = $1", id).Scan(&beforeStatus)
		if err != nil {
			writeJSONError(w, "abuse report not found", http.StatusNotFound)
			return
		}
		if beforeStatus == "resolved" || beforeStatus == "dismissed" || beforeStatus == "escalated" {
			writeJSONError(w, "cannot escalate: already "+beforeStatus, http.StatusBadRequest)
			return
		}

		db.Exec(ctx, `UPDATE learning.battle_abuse_report
			SET escalated_at = NOW(), status = 'escalated', updated_at = NOW()
			WHERE id = $1`, id)

		afterJSON, _ := json.Marshal(map[string]any{"status": "escalated"})
		beforeJSON, _ := json.Marshal(map[string]any{"status": beforeStatus})
		db.Exec(ctx, `INSERT INTO admin.admin_audit_log (action, actor_id, target_id, target_type, reason, after, before, created_at)
			VALUES ('admin.battle.abuse.escalated', $1, $2, 'learning.battle_abuse_report', $3, $4, $5, NOW())`,
			identity.ActorID, id, req.Reason, afterJSON, beforeJSON)

		// Return detail view
		detailHandler := adminBattleAbuseDetailHandler(db, logger)
		detailHandler(w, r)
	}
}