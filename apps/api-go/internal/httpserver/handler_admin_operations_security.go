package httpserver

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
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

type SecurityActor struct {
	ID          string  `json:"id"`
	DisplayName *string `json:"displayName"`
	Email       *string `json:"email"`
}

type SecurityResolution struct {
	State  string  `json:"state"`
	Reason *string `json:"reason"`
	At     *string `json:"at"`
}

// inferSecurityEventType maps an audit log action string to a stable event type.
func inferSecurityEventType(action string) string {
	lower := strings.ToLower(action)
	if strings.Contains(lower, "login.failed") || strings.Contains(lower, "auth.failed") {
		return "failed_login"
	}
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
	if strings.Contains(lower, "rate_limit") || strings.Contains(lower, "permission_denied") || strings.Contains(lower, "rbac.deny") {
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
	) AND NOT (target_type = 'ops.security_event' AND action IN ('ops.security.resolved', 'ops.security.false_positive'))`
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
		if !requireOperationsPermission(w, r, db, logger, "iam.manage", "viewer.audit") {
			return
		}
		ctx := r.Context()

		baseWhere := securityEventBaseWhere()

		// Count total security events
		var total int
		if err := db.QueryRow(ctx, "SELECT COUNT(*) FROM ops.admin_audit_log WHERE "+baseWhere).Scan(&total); err != nil {
			logger.Error("security overview count", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

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
				logger.Error("scan security overview row", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			sev := inferSecuritySeverity(afterJSON, action)
			severityCounts[sev]++
			et := inferSecurityEventType(action)
			typeCounts[et]++
		}
		if err := rows.Err(); err != nil {
			logger.Error("security overview iterate", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		resp := map[string]any{
			"generatedAt": time.Now().UTC().Format(time.RFC3339),
			"total":       total,
			"bySeverity":  severityCounts,
			"byType":      typeCounts,
		}
		writeJSON(w, http.StatusOK, resp)
	}
}

// adminOpsSecurityEventsListHandler implements GET /api/admin/operations/security/events.
// Returns paginated, annotated security events from admin_audit_log.
func adminOpsSecurityEventsListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !requireOperationsPermission(w, r, db, logger, "iam.manage", "viewer.audit") {
			return
		}
		ctx := r.Context()
		typeFilter := r.URL.Query().Get("type")
		severityFilter := r.URL.Query().Get("severity")
		actorID := r.URL.Query().Get("actorId")
		dateFrom := r.URL.Query().Get("from")
		if dateFrom == "" {
			dateFrom = r.URL.Query().Get("dateFrom")
		}
		dateTo := r.URL.Query().Get("to")
		if dateTo == "" {
			dateTo = r.URL.Query().Get("dateTo")
		}
		limit := queryInt(r, "limit", 100)
		offset := queryInt(r, "offset", 0)
		if limit < 1 || limit > 200 || offset < 0 {
			writeJSONError(w, "invalid pagination", http.StatusBadRequest)
			return
		}
		if actorID != "" && !isValidUUID(actorID) {
			writeJSONError(w, "invalid actor id", http.StatusBadRequest)
			return
		}
		if typeFilter != "" && typeFilter != "other" && securityActionFilterWhere(typeFilter) == "" {
			writeJSONError(w, "invalid event type", http.StatusBadRequest)
			return
		}
		if severityFilter != "" && severityFilter != "low" && severityFilter != "medium" && severityFilter != "high" && severityFilter != "critical" {
			writeJSONError(w, "invalid severity", http.StatusBadRequest)
			return
		}

		whereParts := []string{securityEventBaseWhere()}
		args := []any{}
		argIdx := 1

		if actorID != "" {
			whereParts = append(whereParts, fmt.Sprintf("AND a.actor_id = $%d", argIdx))
			args = append(args, actorID)
			argIdx++
		}
		if dateFrom != "" {
			from, err := time.Parse("2006-01-02", dateFrom)
			if err != nil {
				writeJSONError(w, "invalid from date", http.StatusBadRequest)
				return
			}
			whereParts = append(whereParts, fmt.Sprintf("AND a.created_at >= $%d", argIdx))
			args = append(args, from)
			argIdx++
		}
		if dateTo != "" {
			to, err := time.Parse("2006-01-02", dateTo)
			if err != nil {
				writeJSONError(w, "invalid to date", http.StatusBadRequest)
				return
			}
			whereParts = append(whereParts, fmt.Sprintf("AND a.created_at < $%d", argIdx))
			args = append(args, to.AddDate(0, 0, 1))
			argIdx++
		}
		if dateFrom != "" && dateTo != "" {
			from, _ := time.Parse("2006-01-02", dateFrom)
			to, _ := time.Parse("2006-01-02", dateTo)
			if from.After(to) {
				writeJSONError(w, "from date must not be after to date", http.StatusBadRequest)
				return
			}
		}
		if typeFilter != "" {
			extra := securityActionFilterWhere(typeFilter)
			if extra != "" {
				whereParts = append(whereParts, extra)
			} else {
				whereParts = append(whereParts, `AND action NOT ILIKE '%login.failed%' AND action NOT ILIKE '%auth.failed%' AND action NOT ILIKE '%permission_denied%' AND action NOT ILIKE '%rbac.deny%' AND action NOT ILIKE '%suspicious%' AND action NOT ILIKE '%rate_limit%' AND action NOT ILIKE '%privilege_escalation%' AND action NOT ILIKE '%rbac.escalate%'`)
			}
		}
		if severityFilter != "" {
			severityExpr := `COALESCE(NULLIF(a.after->>'severity',''), CASE WHEN a.action ILIKE '%privilege_escalation%' THEN 'critical' WHEN a.action ILIKE '%rate_limit%' OR a.action ILIKE '%permission_denied%' OR a.action ILIKE '%rbac.deny%' THEN 'high' WHEN a.action ILIKE '%suspicious%' THEN 'medium' ELSE 'low' END)`
			whereParts = append(whereParts, fmt.Sprintf("AND %s = $%d", severityExpr, argIdx))
			args = append(args, severityFilter)
			argIdx++
		}

		whereSQL := strings.Join(whereParts, " ")

		// Count
		countQuery := "SELECT COUNT(*) FROM ops.admin_audit_log a WHERE " + whereSQL
		var rawTotal int
		if err := db.QueryRow(ctx, countQuery, args...).Scan(&rawTotal); err != nil {
			logger.Error("count security events", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		// Fetch
		dataQuery := `SELECT a.id, a.action, a.actor_id, a.target_id, a.target_type, a.reason,
			a.after, a.before, a.created_at,
			act.display_name, act.email, resolution.state, resolution.reason, resolution.created_at
			FROM ops.admin_audit_log a
			LEFT JOIN authz.admin_actor act ON act.id = a.actor_id
			LEFT JOIN LATERAL (
				SELECT split_part(r.action, 'ops.security.', 2) AS state, r.reason, r.created_at
				FROM ops.admin_audit_log r
				WHERE r.target_id = a.id::text AND r.target_type = 'ops.security_event'
					AND r.action IN ('ops.security.resolved', 'ops.security.false_positive')
				ORDER BY r.created_at DESC, r.id DESC LIMIT 1
			) resolution ON true
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
			ID         string              `json:"id"`
			Action     string              `json:"action"`
			Actor      *SecurityActor      `json:"actor"`
			TargetID   *string             `json:"targetId,omitempty"`
			TargetType *string             `json:"targetType,omitempty"`
			Reason     *string             `json:"reason,omitempty"`
			After      json.RawMessage     `json:"after,omitempty"`
			Before     json.RawMessage     `json:"before,omitempty"`
			CreatedAt  string              `json:"createdAt"`
			Type       string              `json:"type"`
			Severity   string              `json:"severity"`
			Resolution *SecurityResolution `json:"resolution"`
		}

		var allItems []Event
		for rows.Next() {
			var e Event
			var ts time.Time
			var actorID, actorName, actorEmail *string
			var resolutionState, resolutionReason *string
			var resolutionAt *time.Time
			if err := rows.Scan(&e.ID, &e.Action, &actorID, &e.TargetID, &e.TargetType,
				&e.Reason, &e.After, &e.Before, &ts, &actorName, &actorEmail,
				&resolutionState, &resolutionReason, &resolutionAt); err != nil {
				logger.Error("scan security event", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			if actorID != nil {
				e.Actor = &SecurityActor{ID: *actorID, DisplayName: actorName, Email: actorEmail}
			}
			e.CreatedAt = ts.UTC().Format(time.RFC3339)
			e.Type = inferSecurityEventType(e.Action)
			e.Severity = inferSecuritySeverity(e.After, e.Action)
			if resolutionState != nil {
				at := resolutionAt.UTC().Format(time.RFC3339)
				e.Resolution = &SecurityResolution{State: *resolutionState, Reason: resolutionReason, At: &at}
			}

			allItems = append(allItems, e)
		}

		if err := rows.Err(); err != nil {
			logger.Error("iterate security events", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		if allItems == nil {
			allItems = []Event{}
		}

		writeJSON(w, http.StatusOK, map[string]any{"items": allItems, "total": rawTotal})
	}
}

// adminOpsSecurityEventGetHandler implements GET /api/admin/operations/security/events/{id}.
func adminOpsSecurityEventGetHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !requireOperationsPermission(w, r, db, logger, "iam.manage", "viewer.audit") {
			return
		}
		id := extractPathParam(r.URL.Path, "events", 1)
		if !isValidUUID(id) {
			writeJSONError(w, "invalid event id", http.StatusBadRequest)
			return
		}

		type Event struct {
			ID         string              `json:"id"`
			Action     string              `json:"action"`
			Actor      *SecurityActor      `json:"actor"`
			TargetID   *string             `json:"targetId,omitempty"`
			TargetType *string             `json:"targetType,omitempty"`
			Reason     *string             `json:"reason,omitempty"`
			After      json.RawMessage     `json:"after,omitempty"`
			Before     json.RawMessage     `json:"before,omitempty"`
			CreatedAt  string              `json:"createdAt"`
			Type       string              `json:"type"`
			Severity   string              `json:"severity"`
			Resolution *SecurityResolution `json:"resolution"`
		}

		var e Event
		var ts time.Time
		var actorID, actorName, actorEmail *string
		err := db.QueryRow(r.Context(), `
			SELECT a.id, a.action, a.actor_id, a.target_id, a.target_type, a.reason,
				a.after, a.before, a.created_at,
				act.display_name, act.email
			FROM ops.admin_audit_log a
			LEFT JOIN authz.admin_actor act ON act.id = a.actor_id
			WHERE a.id = $1 AND `+securityEventBaseWhere(), id).Scan(
			&e.ID, &e.Action, &actorID, &e.TargetID, &e.TargetType,
			&e.Reason, &e.After, &e.Before, &ts, &actorName, &actorEmail)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				writeJSONError(w, "security event not found", http.StatusNotFound)
			} else {
				logger.Error("get security event", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
			}
			return
		}
		if actorID != nil {
			e.Actor = &SecurityActor{ID: *actorID, DisplayName: actorName, Email: actorEmail}
		}
		e.CreatedAt = ts.UTC().Format(time.RFC3339)
		e.Type = inferSecurityEventType(e.Action)
		e.Severity = inferSecuritySeverity(e.After, e.Action)

		// Fetch resolution audits
		auditRows, aErr := db.Query(r.Context(), `
			SELECT a.id, a.action, a.actor_id, a.reason, a.after, a.created_at,
				COALESCE(act.display_name, '') as actor_name, COALESCE(act.email, '') as actor_email
			FROM ops.admin_audit_log a
			LEFT JOIN authz.admin_actor act ON act.id = a.actor_id
			WHERE a.target_id = $1 AND a.target_type = 'ops.security_event'
				AND a.action IN ('ops.security.resolved', 'ops.security.false_positive')
			ORDER BY a.created_at DESC LIMIT 50`, id)

		type AuditEntry struct {
			ID        string          `json:"id"`
			Action    string          `json:"action"`
			Actor     *SecurityActor  `json:"actor"`
			Reason    *string         `json:"reason,omitempty"`
			After     json.RawMessage `json:"after,omitempty"`
			CreatedAt string          `json:"createdAt"`
		}
		if aErr != nil {
			logger.Error("list security resolution audits", "error", aErr)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer auditRows.Close()
		resolutionAudits := []AuditEntry{}
		for auditRows.Next() {
			var ae AuditEntry
			var ats time.Time
			var auditActorID, auditActorName, auditActorEmail *string
			if err := auditRows.Scan(&ae.ID, &ae.Action, &auditActorID, &ae.Reason,
				&ae.After, &ats, &auditActorName, &auditActorEmail); err != nil {
				logger.Error("scan security resolution audit", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			ae.CreatedAt = ats.UTC().Format(time.RFC3339)
			if auditActorID != nil {
				ae.Actor = &SecurityActor{ID: *auditActorID, DisplayName: auditActorName, Email: auditActorEmail}
			}
			resolutionAudits = append(resolutionAudits, ae)
		}
		if err := auditRows.Err(); err != nil {
			logger.Error("iterate security resolution audits", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if len(resolutionAudits) > 0 {
			var state string
			if strings.HasPrefix(resolutionAudits[0].Action, "ops.security.") {
				state = strings.TrimPrefix(resolutionAudits[0].Action, "ops.security.")
			}
			at := resolutionAudits[0].CreatedAt
			e.Resolution = &SecurityResolution{State: state, Reason: resolutionAudits[0].Reason, At: &at}
		}

		resp := map[string]any{
			"id":          e.ID,
			"action":      e.Action,
			"actor":       e.Actor,
			"targetId":    e.TargetID,
			"targetType":  e.TargetType,
			"reason":      e.Reason,
			"after":       e.After,
			"before":      e.Before,
			"createdAt":   e.CreatedAt,
			"type":        e.Type,
			"severity":    e.Severity,
			"resolution":  e.Resolution,
			"resolutions": resolutionAudits,
		}
		writeJSON(w, http.StatusOK, resp)
	}
}

// adminOpsSecurityEventResolveHandler implements PATCH /api/admin/operations/security/events/{id}/resolve.
func adminOpsSecurityEventResolveHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !requireOperationsPermission(w, r, db, logger, "iam.manage") {
			return
		}
		identity, _ := authn.GetAdminIdentity(r.Context())

		id := extractPathParam(r.URL.Path, "events", 1)
		if !isValidUUID(id) {
			writeJSONError(w, "invalid event id", http.StatusBadRequest)
			return
		}

		var req struct {
			Resolution string `json:"resolution"` // "resolved" or "false_positive"
			Reason     string `json:"reason"`
		}
		decoder := json.NewDecoder(io.LimitReader(r.Body, 16*1024))
		decoder.DisallowUnknownFields()
		if err := decoder.Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.Resolution != "resolved" && req.Resolution != "false_positive" {
			writeJSONError(w, "resolution must be 'resolved' or 'false_positive'", http.StatusBadRequest)
			return
		}
		req.Reason = strings.TrimSpace(req.Reason)
		if len(req.Reason) < 3 || len(req.Reason) > 500 {
			writeJSONError(w, "reason is required", http.StatusBadRequest)
			return
		}

		// Verify original event exists
		var originalAction string
		err := db.QueryRow(r.Context(), "SELECT action FROM ops.admin_audit_log WHERE id = $1 AND "+securityEventBaseWhere(), id).Scan(&originalAction)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				writeJSONError(w, "security event not found", http.StatusNotFound)
			} else {
				logger.Error("find security event for resolution", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
			}
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
