package httpserver

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
)

// ── P1-A3.4: Admin Growth — Referrals Sub-Domain (3 routes) ────────────────
// All routes require admin session + appropriate permissions.
// Contracts derived from NestJS apps/api/src/growth/growth-referrals-admin.repository.ts
// list, detail, revoke.

const (
	referralAbuseWindowMs  = 60 * 60 * 1000 // 1 hour
	referralAbuseThreshold = 10
)

// adminGrowthReferralsListHandler implements GET /api/admin/growth/referrals.
func adminGrowthReferralsListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		q := r.URL.Query().Get("q")
		flaggedOnly := r.URL.Query().Get("flagged") == "true"
		page := queryInt(r, "page", 1)
		pageSize := queryInt(r, "pageSize", 20)
		if page < 1 {
			page = 1
		}
		if pageSize < 1 || pageSize > 100 {
			pageSize = 20
		}
		offset := (page - 1) * pageSize

		// Build base query for referral codes with user info
		whereParts := []string{}
		args := []any{}
		argIdx := 1
		if q != "" {
			pattern := "%" + q + "%"
			whereParts = append(whereParts, "rc.code ILIKE $"+itoa(argIdx))
			args = append(args, pattern)
			argIdx++
		}
		whereClause := ""
		if len(whereParts) > 0 {
			whereClause = "WHERE " + joinStrings(whereParts, " AND ")
		}

		countQuery := "SELECT COUNT(*) FROM growth.referral_code rc " + whereClause
		var total int
		if err := db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
			logger.Error("count referrals", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		dataQuery := `SELECT rc.id, rc.code, rc.user_id, u.display_name, u.email, rc.created_at
			FROM growth.referral_code rc
			LEFT JOIN profile.user_profile u ON u.id = rc.user_id ` +
			whereClause + ` ORDER BY rc.created_at DESC LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
		args = append(args, pageSize, offset)
		rows, err := db.Query(ctx, dataQuery, args...)
		if err != nil {
			logger.Error("list referrals", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type ReferralSummary struct {
			ID     string `json:"id"`
			Code   string `json:"code"`
			UserID string `json:"userId"`
			User   struct {
				ID          string  `json:"id"`
				Email       *string `json:"email"`
				DisplayName string  `json:"displayName"`
			} `json:"user"`
			EventsLastHour int    `json:"eventsLastHour"`
			AbuseFlag      bool   `json:"abuseFlag"`
			CreatedAt      string `json:"createdAt"`
		}

		var items []ReferralSummary
		var codes []string
		for rows.Next() {
			var rs ReferralSummary
			var createdAt time.Time
			if err := rows.Scan(&rs.ID, &rs.Code, &rs.UserID, &rs.User.DisplayName, &rs.User.Email, &createdAt); err == nil {
				rs.User.ID = rs.UserID
				rs.CreatedAt = createdAt.UTC().Format(time.RFC3339)
				items = append(items, rs)
				codes = append(codes, rs.Code)
			}
		}

		// Enrich with abuse detection: count events in last hour per code
		if len(codes) > 0 {
			since := time.Now().UTC().Add(-time.Duration(referralAbuseWindowMs) * time.Millisecond)
			placeholders := make([]string, len(codes))
			eventArgs := []any{since}
			for i, c := range codes {
				placeholders[i] = "$" + itoa(i+2)
				eventArgs = append(eventArgs, c)
			}
			eventQuery := `SELECT code, COUNT(*) as cnt FROM growth.referral_event
				WHERE created_at >= $1 AND code IN (` + joinStrings(placeholders, ",") + `)
				GROUP BY code`
			eRows, eErr := db.Query(ctx, eventQuery, eventArgs...)
			if eErr == nil {
				countMap := map[string]int{}
				for eRows.Next() {
					var code string
					var cnt int
					if eRows.Scan(&code, &cnt) == nil {
						countMap[code] = cnt
					}
				}
				eRows.Close()
				for i := range items {
					recent := countMap[items[i].Code]
					items[i].EventsLastHour = recent
					items[i].AbuseFlag = recent >= referralAbuseThreshold
				}
			}
		}

		// Filter flagged if requested
		if flaggedOnly {
			filtered := []ReferralSummary{}
			for _, item := range items {
				if item.AbuseFlag {
					filtered = append(filtered, item)
				}
			}
			items = filtered
			total = len(filtered)
		}

		if items == nil {
			items = []ReferralSummary{}
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"items":    items,
			"page":     page,
			"pageSize": pageSize,
			"total":    total,
		})
	}
}

// adminGrowthReferralsDetailHandler implements GET /api/admin/growth/referrals/{id}.
func adminGrowthReferralsDetailHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := extractPathParam(r.URL.Path, "referrals", 1)
		if id == "" {
			writeJSONError(w, "referral id required", http.StatusBadRequest)
			return
		}
		ctx := r.Context()

		type AuditEntry struct {
			ID     string `json:"id"`
			Action string `json:"action"`
			Actor  *struct {
				ID          string `json:"id"`
				DisplayName string `json:"displayName"`
				Email       string `json:"email"`
			} `json:"actor"`
			Reason    *string `json:"reason"`
			CreatedAt string  `json:"createdAt"`
		}

		type EventEntry struct {
			ID             string          `json:"id"`
			Kind           string          `json:"kind"`
			Code           string          `json:"code"`
			Payload        json.RawMessage `json:"payload"`
			ReferrerUserID string          `json:"referrerUserId"`
			ReferredUserID *string         `json:"referredUserId"`
			CreatedAt      string          `json:"createdAt"`
		}

		type ReferralDetail struct {
			ID     string `json:"id"`
			Code   string `json:"code"`
			UserID string `json:"userId"`
			User   struct {
				ID          string  `json:"id"`
				Email       *string `json:"email"`
				DisplayName string  `json:"displayName"`
			} `json:"user"`
			CreatedAt      string       `json:"createdAt"`
			EventsLastHour int          `json:"eventsLastHour"`
			AbuseFlag      bool         `json:"abuseFlag"`
			Events         []EventEntry `json:"events"`
			Audit          []AuditEntry `json:"audit"`
		}

		var rd ReferralDetail
		var createdAt time.Time
		err := db.QueryRow(ctx, `
			SELECT rc.id, rc.code, rc.user_id, u.display_name, u.email, rc.created_at
			FROM growth.referral_code rc
			LEFT JOIN profile.user_profile u ON u.id = rc.user_id
			WHERE rc.id = $1`, id).Scan(&rd.ID, &rd.Code, &rd.UserID, &rd.User.DisplayName, &rd.User.Email, &createdAt)
		if err != nil {
			writeJSONError(w, "referral not found", http.StatusNotFound)
			return
		}
		rd.User.ID = rd.UserID
		rd.CreatedAt = createdAt.UTC().Format(time.RFC3339)

		// Events (last 50)
		eRows, err := db.Query(ctx, `
			SELECT id, kind, code, payload, referrer_user_id, referred_user_id, created_at
			FROM growth.referral_event
			WHERE code = $1
			ORDER BY created_at DESC LIMIT 50`, rd.Code)
		if err == nil {
			for eRows.Next() {
				var ev EventEntry
				var ts time.Time
				if eRows.Scan(&ev.ID, &ev.Kind, &ev.Code, &ev.Payload, &ev.ReferrerUserID, &ev.ReferredUserID, &ts) == nil {
					ev.CreatedAt = ts.UTC().Format(time.RFC3339)
					rd.Events = append(rd.Events, ev)
				}
			}
			eRows.Close()
		}
		if rd.Events == nil {
			rd.Events = []EventEntry{}
		}

		// Abuse flag
		since := time.Now().UTC().Add(-time.Duration(referralAbuseWindowMs) * time.Millisecond)
		var eventsLastHour int
		db.QueryRow(ctx, `SELECT COUNT(*) FROM growth.referral_event WHERE code = $1 AND created_at >= $2`,
			rd.Code, since).Scan(&eventsLastHour)
		rd.EventsLastHour = eventsLastHour
		rd.AbuseFlag = eventsLastHour >= referralAbuseThreshold

		// Audit trail
		aRows, err := db.Query(ctx, `
			SELECT a.id, a.action, act.id, act.display_name, act.email,
				a.reason, a.created_at
			FROM ops.admin_audit_log a
			LEFT JOIN authz.admin_actor act ON act.id = a.actor_id
			WHERE a.target_id = $1 AND a.target_type = 'growth.referral_code'
			ORDER BY a.created_at DESC LIMIT 20`, id)
		if err == nil {
			for aRows.Next() {
				var ae AuditEntry
				ae.Actor = &struct {
					ID          string `json:"id"`
					DisplayName string `json:"displayName"`
					Email       string `json:"email"`
				}{}
				var ts time.Time
				if aRows.Scan(&ae.ID, &ae.Action, &ae.Actor.ID, &ae.Actor.DisplayName,
					&ae.Actor.Email, &ae.Reason, &ts) == nil {
					ae.CreatedAt = ts.UTC().Format(time.RFC3339)
					rd.Audit = append(rd.Audit, ae)
				}
			}
			aRows.Close()
		}
		if rd.Audit == nil {
			rd.Audit = []AuditEntry{}
		}

		writeJSON(w, http.StatusOK, rd)
	}
}

// adminGrowthReferralsRevokeHandler implements POST /api/admin/growth/referrals/{id}/revoke.
func adminGrowthReferralsRevokeHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "referrals", 1)
		if id == "" {
			writeJSONError(w, "referral id required", http.StatusBadRequest)
			return
		}
		var req struct {
			Reason string `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || len(strings.TrimSpace(req.Reason)) < 3 {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}

		ctx := r.Context()
		tx, err := db.BeginTx(ctx, pgx.TxOptions{})
		if err != nil {
			logger.Error("begin referral revoke", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(ctx)

		// Fetch before state
		var beforeCode, beforeUserID string
		err = tx.QueryRow(ctx, "SELECT code, user_id FROM growth.referral_code WHERE id = $1 FOR UPDATE", id).
			Scan(&beforeCode, &beforeUserID)
		if err != nil {
			writeJSONError(w, "referral not found", http.StatusNotFound)
			return
		}

		// Delete the referral code
		if _, err := tx.Exec(ctx, "DELETE FROM growth.referral_code WHERE id = $1", id); err != nil {
			logger.Error("revoke referral", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		// Write audit
		beforeJSON, _ := json.Marshal(map[string]any{"code": beforeCode, "userId": beforeUserID})
		if err := writeAdminAuditWithReason(ctx, tx, identity.ActorID, "admin.growth.referral_code.revoked", "growth.referral_code", id, req.Reason, json.RawMessage(beforeJSON), nil); err != nil {
			logger.Error("audit referral revoke", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			logger.Error("commit referral revoke", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{"id": id, "revoked": true})
	}
}

// Ensure imports are used.
var _ = context.Background
var _ = pgx.ErrNoRows
