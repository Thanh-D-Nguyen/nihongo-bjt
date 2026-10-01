package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
)

// ── P1-A1.6: Admin Operations — Security Sub-Domain (4 routes) ──────────────
// All routes require admin session + appropriate permissions.
// Contracts derived from NestJS apps/api/src/operations/operations.service.ts
// listSecurityEvents, getSecurityEventDetail, resolveSecurityEvent.

// securityEventTypes defines the stable event taxonomy matching the NestJS constant.
var securityEventTypes = []string{
	"failed_login",
	"permission_denied",
	"suspicious_request",
	"rate_limit_exceeded",
	"privilege_escalation_attempt",
}

// inferSecurityEventType maps an audit log action string to a stable event type.
func inferSecurityEventType(action string) string {
	lower := strings.ToLower(action)
	for _, t := range securityEventTypes {
		dotted := strings.ReplaceAll(t, "_", ".")
		if strings.Contains(lower, dotted) || strings.Contains(lower, t) {
			return t
		}
	}
	return "other"
}

// inferSecuritySeverity derives severity from the after JSON or action keywords.
func inferSecuritySeverity(afterJSON json.RawMessage, action string) string {
	if len(afterJSON) > 0 {
		var m map[string]any
		if json.Unmarshal(afterJSON, &m) == nil {
			if sev, ok := m["severity"].(string); ok && sev != "" {
				return sev
			}
		}
	}
	lower := strings.ToLower(action)
	if strings.Contains(lower, "privilege_escalation") {
		return "critical"
	}
	if strings.Contains(lower, "rate_limit") || strings.Contains(lower, "permission_denied") {
		return "high"
	}
	if strings.Contains(lower, "suspicious") {
		return "medium"
	}
	return "low"
}

// securityEventBaseWhere returns the SQL WHERE clause fragment that matches the
// NestJS securityEventBaseWhere() OR conditions on admin_audit_log.
func securityEventBaseWhere() string {
	return `(
		target_type = 'ops.security_event'
		OR action ILIKE '%login.failed%'
		OR action ILIKE '%auth.failed%'
		OR action ILIKE '%permission_denied%'
		OR action ILIKE '%rbac.deny%'
		OR action ILIKE '%suspicious%'
		OR action ILIKE '%rate_limit%'
		OR action ILIKE '%privilege_escalation%'
		OR action ILIKE '%rbac.escalate%'
		OR action ILIKE '%security.%'
	)`
}

// securityActionFilterWhere returns an additional AND clause for a specific event type filter.
func securityActionFilterWhere(eventType string) string {
	switch eventType {
	case "failed_login":
		return `AND (action ILIKE '%login.failed%' OR action ILIKE '%auth.failed%')`
	case "permission_denied":
		return `AND (action ILIKE '%permission_denied%' OR action ILIKE '%rbac.deny%')`
	case "suspicious_request":
		return `AND action ILIKE '%suspicious%'`
	case "rate_limit_exceeded":
		return `AND action ILIKE '%rate_limit%'`
	case "privilege_escalation_attempt":
		return `AND (action ILIKE '%privilege_escalation%' OR action ILIKE '%rbac.escalate%')`
	default:
		return ""
	}
}

// adminOpsSecurityOverviewHandler implements GET /api/admin/operations/security.
// Returns aggregated security event counts by type and severity.
func adminOpsSecurityOverviewHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()

		baseWhere := securityEventBaseWhere()

		// Count total security events
		var total int
		db.QueryRow(ctx, "SELECT COUNT(*) FROM ops.admin_audit_log WHERE "+baseWhere).Scan(&total)

		// Count by inferred severity
		rows, err := db.Query(ctx, `
			SELECT action, after FROM ops.admin_audit_log WHERE `+baseWhere)
		if err != nil {
			logger.Error("security overview query", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		severityCounts := map[string]int{"critical": 0, "high": 0, "medium": 0, "low": 0}
		typeCounts := map[string]int{}
		for _, t := range securityEventTypes {
			typeCounts[t] = 0
		}
		typeCounts["other"] = 0

		for rows.Next() {
			var action string
			var afterJSON json.RawMessage
			if err := rows.Scan(&action, &afterJSON); err != nil {
				continue
			}
			sev := inferSecuritySeverity(afterJSON, action)
			severityCounts[sev]++
			et := inferSecurityEventType(action)
			typeCounts[et]++
		}

		resp := map[string]any{
			"generatedAt":    time.Now().UTC().Format(time.RFC3339),
			"total":          total,
			"bySeverity":     severityCounts,
			"byType":         typeCounts,
		}
		writeJSON(w, http.StatusOK, resp)
	}
}

// adminOpsSecurityEventsListHandler implements GET /api/admin/operations/security/events.
// Returns paginated, annotated security events from admin_audit_log.
func adminOpsSecurityEventsListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		typeFilter := r.URL.Query().Get("type")
		severityFilter := r.URL.Query().Get("severity")
		actorID := r.URL.Query().Get("actorId")
		dateFrom := r.URL.Query().Get("dateFrom")
		dateTo := r.URL.Query().Get("dateTo")
		limit := queryInt(r, "limit", 100)
		offset := queryInt(r, "offset", 0)

		whereParts := []string{securityEventBaseWhere()}
		args := []any{}
		argIdx := 1

		if actorID != "" {
			whereParts = append(whereParts, fmt.Sprintf("a.actor_id = $%d", argIdx))
			args = append(args, actorID)
			argIdx++
		}
		if dateFrom != "" {
			whereParts = append(whereParts, fmt.Sprintf("a.created_at >= $%d", argIdx))
			args = append(args, dateFrom)
			argIdx++
		}
		if dateTo != "" {
			whereParts = append(whereParts, fmt.Sprintf("a.created_at <= $%d", argIdx))
			args = append(args, dateTo)
			argIdx++
		}
		if typeFilter != "" {
			extra := securityActionFilterWhere(typeFilter)
			if extra != "" {
				whereParts = append(whereParts, extra)
			}
		}

		whereSQL := strings.Join(whereParts, " ")

		// Count
		countQuery := "SELECT COUNT(*) FROM ops.admin_audit_log a WHERE " + whereSQL
		var rawTotal int
		if err := db.QueryRow(ctx, countQuery, args...).Scan(&rawTotal); err != nil {
			logger.Error("count security events", "error", err)
		}

		// Fetch
		dataQuery := `SELECT a.id, a.action, a.actor_id, a.target_id, a.target_type, a.reason,
			a.after, a.before, a.created_at,
			COALESCE(act.display_name, '') as actor_name, COALESCE(act.email, '') as actor_email
			FROM ops.admin_audit_log a
			LEFT JOIN authz.admin_actor act ON act.id = a.actor_id
			WHERE ` + whereSQL + ` ORDER BY a.created_at DESC LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
		args = append(args, limit, offset)

		rows, err := db.Query(ctx, dataQuery, args...)
		if err != nil {
			logger.Error("list security events", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type Event struct {
			ID          string          `json:"id"`
			Action      string          `json:"action"`
			ActorID     string          `json:"actorId"`
			ActorName   string          `json:"actorName"`
			ActorEmail  string          `json:"actorEmail"`
			TargetID    *string         `json:"targetId,omitempty"`
			TargetType  *string         `json:"targetType,omitempty"`
			Reason      *string         `json:"reason,omitempty"`
			After       json.RawMessage `json:"after,omitempty"`
			Before      json.RawMessage `json:"before,omitempty"`
			CreatedAt   string          `json:"createdAt"`
			EventType   string          `json:"eventType"`
			Severity    string          `json:"severity"`
			Resolution  *string         `json:"resolution,omitempty"`
		}

		var allItems []Event
		for rows.Next() {
			var e Event
			var ts time.Time
			if err := rows.Scan(&e.ID, &e.Action, &e.ActorID, &e.TargetID, &e.TargetType,
				&e.Reason, &e.After, &e.Before, &ts, &e.ActorName, &e.ActorEmail); err != nil {
				continue
			}
			e.CreatedAt = ts.UTC().Format(time.RFC3339)
			e.EventType = inferSecurityEventType(e.Action)
			e.Severity = inferSecuritySeverity(e.After, e.Action)

			// Extract resolution from after JSON if present
			if len(e.After) > 0 {
				var m map[string]any
				if json.Unmarshal(e.After, &m) == nil {
					if res, ok := m["resolution"].(string); ok && res != "" {
						e.Resolution = &res
					}
				}
			}

			allItems = append(allItems, e)
		}

		// Post-filter by severity if requested (matches NestJS behavior)
		total := len(allItems)
		if severityFilter != "" {
			var filtered []Event
			for _, item := range allItems {
				if item.Severity == severityFilter {
					filtered = append(filtered, item)
				}
			}
			allItems = filtered
			total = len(allItems)
		}

		if allItems == nil {
			allItems = []Event{}
		}

		writeJSON(w, http.StatusOK, map[string]any{"items": allItems, "total": total})
	}
}

// adminOpsSecurityEventGetHandler implements GET /api/admin/operations/security/events/{id}.
func adminOpsSecurityEventGetHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := extractPathParam(r.URL.Path, "events", 1)
		if id == "" {
			writeJSONError(w, "event id required", http.StatusBadRequest)
			return
		}

		type Event struct {
			ID         string          `json:"id"`
			Action     string          `json:"action"`
			ActorID    string          `json:"actorId"`
			ActorName  string          `json:"actorName"`
			ActorEmail string          `json:"actorEmail"`
			TargetID   *string         `json:"targetId,omitempty"`
			TargetType *string         `json:"targetType,omitempty"`
			Reason     *string         `json:"reason,omitempty"`
			After      json.RawMessage `json:"after,omitempty"`
			Before     json.RawMessage `json:"before,omitempty"`
			CreatedAt  string          `json:"createdAt"`
			EventType  string          `json:"eventType"`
			Severity   string          `json:"severity"`
			Resolution *string         `json:"resolution,omitempty"`
		}

		var e Event
		var ts time.Time
		err := db.QueryRow(r.Context(), `
			SELECT a.id, a.action, a.actor_id, a.target_id, a.target_type, a.reason,
				a.after, a.before, a.created_at,
				COALESCE(act.display_name, ''), COALESCE(act.email, '')
			FROM ops.admin_audit_log a
			LEFT JOIN authz.admin_actor act ON act.id = a.actor_id
			WHERE a.id = $1`, id).Scan(
			&e.ID, &e.Action, &e.ActorID, &e.TargetID, &e.TargetType,
			&e.Reason, &e.After, &e.Before, &ts, &e.ActorName, &e.ActorEmail)
		if err != nil {
			writeJSONError(w, "security event not found", http.StatusNotFound)
			return
		}
		e.CreatedAt = ts.UTC().Format(time.RFC3339)
		e.EventType = inferSecurityEventType(e.Action)
		e.Severity = inferSecuritySeverity(e.After, e.Action)

		if len(e.After) > 0 {
			var m map[string]any
			if json.Unmarshal(e.After, &m) == nil {
				if res, ok := m["resolution"].(string); ok && res != "" {
					e.Resolution = &res
				}
			}
		}

		// Fetch resolution audits
		auditRows, aErr := db.Query(r.Context(), `
			SELECT a.id, a.action, a.actor_id, a.reason, a.after, a.created_at,
				COALESCE(act.display_name, '') as actor_name, COALESCE(act.email, '') as actor_email
			FROM ops.admin_audit_log a
			LEFT JOIN authz.admin_actor act ON act.id = a.actor_id
			WHERE a.target_id = $1 AND a.target_type = 'ops.security_event'
			ORDER BY a.created_at DESC LIMIT 50`, id)

		type AuditEntry struct {
			ID         string          `json:"id"`
			Action     string          `json:"action"`
			ActorID    string          `json:"actorId"`
			ActorName  string          `json:"actorName"`
			ActorEmail string          `json:"actorEmail"`
			Reason     *string         `json:"reason,omitempty"`
			After      json.RawMessage `json:"after,omitempty"`
			CreatedAt  string          `json:"createdAt"`
		}
		var resolutionAudits []AuditEntry
		if aErr == nil {
			defer auditRows.Close()
			for auditRows.Next() {
				var ae AuditEntry
				var ats time.Time
				if err := auditRows.Scan(&ae.ID, &ae.Action, &ae.ActorID, &ae.Reason,
					&ae.After, &ats, &ae.ActorName, &ae.ActorEmail); err == nil {
					ae.CreatedAt = ats.UTC().Format(time.RFC3339)
					resolutionAudits = append(resolutionAudits, ae)
				}
			}
		}
		if resolutionAudits == nil {
			resolutionAudits = []AuditEntry{}
		}

		resp := map[string]any{
			"id":               e.ID,
			"action":           e.Action,
			"actorId":          e.ActorID,
			"actorName":        e.ActorName,
			"actorEmail":       e.ActorEmail,
			"targetId":         e.TargetID,
			"targetType":       e.TargetType,
			"reason":           e.Reason,
			"after":            e.After,
			"before":           e.Before,
			"createdAt":        e.CreatedAt,
			"eventType":        e.EventType,
			"severity":         e.Severity,
			"resolution":       e.Resolution,
			"resolutionAudits": resolutionAudits,
		}
		writeJSON(w, http.StatusOK, resp)
	}
}

// adminOpsSecurityEventResolveHandler implements PATCH /api/admin/operations/security/events/{id}/resolve.
func adminOpsSecurityEventResolveHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		id := extractPathParam(r.URL.Path, "events", 1)
		if id == "" {
			writeJSONError(w, "event id required", http.StatusBadRequest)
			return
		}

		var req struct {
			Resolution string `json:"resolution"` // "resolved" or "false_positive"
			Reason     string `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.Resolution != "resolved" && req.Resolution != "false_positive" {
			writeJSONError(w, "resolution must be 'resolved' or 'false_positive'", http.StatusBadRequest)
			return
		}
		if req.Reason == "" {
			writeJSONError(w, "reason is required", http.StatusBadRequest)
			return
		}

		// Verify original event exists
		var originalAction string
		err := db.QueryRow(r.Context(), "SELECT action FROM ops.admin_audit_log WHERE id = $1", id).Scan(&originalAction)
		if err != nil {
			writeJSONError(w, "security event not found", http.StatusNotFound)
			return
		}

		// Create resolution audit entry
		afterJSON, _ := json.Marshal(map[string]any{"resolution": req.Resolution})
		beforeJSON, _ := json.Marshal(map[string]any{"originalAction": originalAction})

		_, err = db.Exec(r.Context(), `
			INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, before, created_at)
			VALUES ($1, $2, $3, 'ops.security_event', $4, $5, $6, NOW())`,
			"ops.security."+req.Resolution, identity.ActorID, id, req.Reason, afterJSON, beforeJSON)
		if err != nil {
			logger.Error("resolve security event", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{"id": id, "resolution": req.Resolution})
	}
}

// Ensure context import is used.
var _ = context.Background