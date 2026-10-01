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

// ── P1-A4.4: Admin Battle — Leaderboard + Matches + System Parameters (6 routes) ─
// All routes require admin session + appropriate permissions.
// Contracts derived from NestJS:
//   - battle-leaderboard-admin.repository.ts (list with window-based ranking)
//   - battle-matches-admin.repository.ts (list, detail, abort, rerun)
//   - battle-admin.controller.ts (system-parameters)

// adminBattleLeaderboardListHandler implements GET /api/admin/battle/leaderboard.
func adminBattleLeaderboardListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		window := r.URL.Query().Get("window")
		if window == "" {
			window = "all"
		}
		page := queryInt(r, "page", 1)
		pageSize := queryInt(r, "pageSize", 20)
		if page < 1 {
			page = 1
		}
		if pageSize < 1 || pageSize > 100 {
			pageSize = 20
		}
		offset := (page - 1) * pageSize

		// Build window filter
		sinceClause := ""
		var sinceArg *string
		argIdx := 1
		args := []any{}
		if window != "all" {
			now := time.Now().UTC()
			var since time.Time
			switch window {
			case "7d":
				since = now.AddDate(0, 0, -7)
			case "30d":
				since = now.AddDate(0, 0, -30)
			case "90d":
				since = now.AddDate(0, 0, -90)
			case "season":
				// Season = current quarter
				q := (int(now.Month()) - 1) / 3
				since = time.Date(now.Year(), time.Month(q*3+1), 1, 0, 0, 0, 0, time.UTC)
			default:
				window = "all"
			}
			if window != "all" {
				s := since.Format(time.RFC3339)
				sinceArg = &s
				sinceClause = fmt.Sprintf("AND started_at >= $%d", argIdx)
				args = append(args, s)
				argIdx++
			}
		}

		rankingsQuery := fmt.Sprintf(`
WITH participant_sessions AS (
    SELECT user_id AS pid, user_score AS my_score, opponent_score AS their_score
    FROM learning.battle_session
    WHERE status = 'completed' AND mode = 'bot' %s
    UNION ALL
    SELECT user_id, user_score, opponent_score
    FROM learning.battle_session
    WHERE status = 'completed' AND mode = 'pvp' %s
    UNION ALL
    SELECT opponent_user_id, opponent_score, user_score
    FROM learning.battle_session
    WHERE status = 'completed' AND mode = 'pvp' AND opponent_user_id IS NOT NULL %s
)
SELECT
    pid AS "userId",
    COUNT(*) FILTER (WHERE my_score > their_score) AS wins,
    COUNT(*) FILTER (WHERE my_score < their_score) AS losses,
    COUNT(*)::bigint AS "totalMatches",
    ROUND(AVG(my_score)::numeric, 1)::float AS "avgScore"
FROM participant_sessions
WHERE pid IS NOT NULL
GROUP BY pid
HAVING COUNT(*) >= 1
ORDER BY COUNT(*) FILTER (WHERE my_score > their_score) DESC, AVG(my_score) DESC
LIMIT $%d OFFSET $%d`,
			sinceClause, sinceClause, sinceClause, argIdx, argIdx+1)
		args = append(args, pageSize, offset)

		rows, err := db.Query(ctx, rankingsQuery, args...)
		if err != nil {
			logger.Error("list battle leaderboard", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type Ranking struct {
			UserID       string  `json:"userId"`
			Rank         int     `json:"rank"`
			Wins         int     `json:"wins"`
			Losses       int     `json:"losses"`
			TotalMatches int     `json:"totalMatches"`
			AvgScore     float64 `json:"avgScore"`
			WinRate      float64 `json:"winRate"`
		}
		var items []Ranking
		idx := 0
		for rows.Next() {
			var r Ranking
			if err := rows.Scan(&r.UserID, &r.Wins, &r.Losses, &r.TotalMatches, &r.AvgScore); err == nil {
				r.Rank = offset + idx + 1
				if r.TotalMatches > 0 {
					r.WinRate = float64(r.Wins) / float64(r.TotalMatches) * 100
				}
				items = append(items, r)
				idx++
			}
		}
		if items == nil {
			items = []Ranking{}
		}

		// Total participants count
		totalQuery := fmt.Sprintf(`
WITH participant_sessions AS (
    SELECT user_id AS pid FROM learning.battle_session WHERE status = 'completed' AND mode = 'bot' %s
    UNION ALL
    SELECT user_id FROM learning.battle_session WHERE status = 'completed' AND mode = 'pvp' %s
    UNION ALL
    SELECT opponent_user_id FROM learning.battle_session WHERE status = 'completed' AND mode = 'pvp' AND opponent_user_id IS NOT NULL %s
)
SELECT COUNT(*) FROM (SELECT pid FROM participant_sessions WHERE pid IS NOT NULL GROUP BY pid HAVING COUNT(*) >= 1) sub`,
			sinceClause, sinceClause, sinceClause)
		var total int
		countArgs := []any{}
		if sinceArg != nil {
			countArgs = append(countArgs, *sinceArg)
		}
		db.QueryRow(ctx, totalQuery, countArgs...).Scan(&total)

		// Summary stats
		summaryQuery := fmt.Sprintf(`
SELECT
    (SELECT COUNT(DISTINCT user_id) FROM learning.battle_session WHERE status = 'completed' %s) AS participants,
    (SELECT COUNT(*) FROM learning.battle_session WHERE status = 'completed' %s) AS completed_matches`,
			sinceClause, sinceClause)
		var participants, completedMatches int
		db.QueryRow(ctx, summaryQuery, countArgs...).Scan(&participants, &completedMatches)

		type Summary struct {
			Window           string  `json:"window"`
			Since            *string `json:"since,omitempty"`
			TotalParticipants int     `json:"totalParticipants"`
			CompletedMatches  int     `json:"completedMatches"`
		}
		summary := Summary{
			Window:           window,
			Since:            sinceArg,
			TotalParticipants: participants,
			CompletedMatches:  completedMatches,
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"items":    items,
			"page":     page,
			"pageSize": pageSize,
			"total":    total,
			"summary":  summary,
		})
	}
}

// adminBattleSystemParametersHandler implements GET /api/admin/battle/system-parameters.
func adminBattleSystemParametersHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		// Aggregate system-level battle parameters from various sources
		type SystemParams struct {
			ActiveBots        int `json:"activeBots"`
			ActiveConfigs     int `json:"activeConfigs"`
			PendingAbuseReports int `json:"pendingAbuseReports"`
			InProgressMatches int `json:"inProgressMatches"`
			CompletedToday    int `json:"completedToday"`
		}
		var p SystemParams
		db.QueryRow(ctx, "SELECT COUNT(*) FROM learning.battle_bot WHERE status = 'active'").Scan(&p.ActiveBots)
		db.QueryRow(ctx, "SELECT COUNT(*) FROM learning.battle_config WHERE status = 'published'").Scan(&p.ActiveConfigs)
		db.QueryRow(ctx, "SELECT COUNT(*) FROM learning.battle_abuse_report WHERE status = 'pending'").Scan(&p.PendingAbuseReports)
		db.QueryRow(ctx, "SELECT COUNT(*) FROM learning.battle_session WHERE status = 'in_progress'").Scan(&p.InProgressMatches)
		todayStart := time.Now().UTC().Truncate(24 * time.Hour).Format(time.RFC3339)
		db.QueryRow(ctx, "SELECT COUNT(*) FROM learning.battle_session WHERE status = 'completed' AND completed_at >= $1", todayStart).Scan(&p.CompletedToday)

		writeJSON(w, http.StatusOK, p)
	}
}

// adminBattleMatchesListHandler implements GET /api/admin/battle/matches.
func adminBattleMatchesListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		statusFilter := r.URL.Query().Get("status")
		modeFilter := r.URL.Query().Get("mode")
		userID := r.URL.Query().Get("userId")
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
		if modeFilter != "" {
			whereParts = append(whereParts, fmt.Sprintf("mode = $%d", argIdx))
			args = append(args, modeFilter)
			argIdx++
		}
		if userID != "" {
			whereParts = append(whereParts, fmt.Sprintf("(user_id = $%d OR opponent_user_id = $%d)", argIdx, argIdx))
			args = append(args, userID)
			argIdx++
		}
		whereClause := ""
		if len(whereParts) > 0 {
			whereClause = "WHERE " + strings.Join(whereParts, " AND ")
		}

		countQuery := "SELECT COUNT(*) FROM learning.battle_session " + whereClause
		var total int
		if err := db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
			logger.Error("count battle matches", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		dataQuery := fmt.Sprintf(`
SELECT id, user_id, opponent_user_id, bot_key, mode, status, room_code,
       max_rounds, fairness_seed, user_score, opponent_score,
       abandoned_reason, started_at, completed_at, created_at, updated_at
FROM learning.battle_session %s
ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
			whereClause, argIdx, argIdx+1)
		args = append(args, pageSize, offset)
		rows, err := db.Query(ctx, dataQuery, args...)
		if err != nil {
			logger.Error("list battle matches", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type MatchSummary struct {
			ID              string  `json:"id"`
			UserID          string  `json:"userId"`
			OpponentUserID  *string `json:"opponentUserId,omitempty"`
			BotKey          *string `json:"botKey,omitempty"`
			Mode            string  `json:"mode"`
			Status          string  `json:"status"`
			RoomCode        string  `json:"roomCode"`
			MaxRounds       int     `json:"maxRounds"`
			UserScore       *int    `json:"userScore,omitempty"`
			OpponentScore   *int    `json:"opponentScore,omitempty"`
			AbandonedReason *string `json:"abandonedReason,omitempty"`
			StartedAt       *string `json:"startedAt,omitempty"`
			CompletedAt     *string `json:"completedAt,omitempty"`
			CreatedAt       string  `json:"createdAt"`
		}
		var items []MatchSummary
		for rows.Next() {
			var m MatchSummary
			var createdAt time.Time
			var startedAt, completedAt *time.Time
			var fairnessSeed string
			if err := rows.Scan(&m.ID, &m.UserID, &m.OpponentUserID, &m.BotKey,
				&m.Mode, &m.Status, &m.RoomCode, &m.MaxRounds, &fairnessSeed,
				&m.UserScore, &m.OpponentScore, &m.AbandonedReason,
				&startedAt, &completedAt, &createdAt); err == nil {
				m.CreatedAt = createdAt.UTC().Format(time.RFC3339)
				if startedAt != nil {
					s := startedAt.UTC().Format(time.RFC3339)
					m.StartedAt = &s
				}
				if completedAt != nil {
					s := completedAt.UTC().Format(time.RFC3339)
					m.CompletedAt = &s
				}
				items = append(items, m)
			}
		}
		if items == nil {
			items = []MatchSummary{}
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"items":    items,
			"page":     page,
			"pageSize": pageSize,
			"total":    total,
		})
	}
}

// adminBattleMatchesDetailHandler implements GET /api/admin/battle/matches/{id}.
func adminBattleMatchesDetailHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := extractPathParam(r.URL.Path, "matches", 1)
		if id == "" {
			writeJSONError(w, "match id required", http.StatusBadRequest)
			return
		}
		ctx := r.Context()

		type AuditEntry struct {
			ID        string          `json:"id"`
			Action    string          `json:"action"`
			ActorID   string          `json:"actorId"`
			ActorName *string         `json:"actorName,omitempty"`
			ActorEmail *string        `json:"actorEmail,omitempty"`
			Reason    string          `json:"reason"`
			After     json.RawMessage `json:"after,omitempty"`
			Before    json.RawMessage `json:"before,omitempty"`
			CreatedAt string          `json:"createdAt"`
		}
		type MatchDetail struct {
			ID              string          `json:"id"`
			UserID          string          `json:"userId"`
			OpponentUserID  *string         `json:"opponentUserId,omitempty"`
			BotKey          *string         `json:"botKey,omitempty"`
			Mode            string          `json:"mode"`
			Status          string          `json:"status"`
			RoomCode        string          `json:"roomCode"`
			MaxRounds       int             `json:"maxRounds"`
			FairnessSeed    *string         `json:"fairnessSeed,omitempty"`
			UserScore       *int            `json:"userScore,omitempty"`
			OpponentScore   *int            `json:"opponentScore,omitempty"`
			AbandonedReason *string         `json:"abandonedReason,omitempty"`
			StartedAt       *string         `json:"startedAt,omitempty"`
			CompletedAt     *string         `json:"completedAt,omitempty"`
			CreatedAt       string          `json:"createdAt"`
			UpdatedAt       string          `json:"updatedAt"`
			Audit           []AuditEntry    `json:"audit"`
		}
		var md MatchDetail
		var createdAt, updatedAt time.Time
		var startedAt, completedAt *time.Time
		err := db.QueryRow(ctx, `
SELECT id, user_id, opponent_user_id, bot_key, mode, status, room_code,
       max_rounds, fairness_seed, user_score, opponent_score,
       abandoned_reason, started_at, completed_at, created_at, updated_at
FROM learning.battle_session WHERE id = $1`, id).Scan(
			&md.ID, &md.UserID, &md.OpponentUserID, &md.BotKey,
			&md.Mode, &md.Status, &md.RoomCode, &md.MaxRounds, &md.FairnessSeed,
			&md.UserScore, &md.OpponentScore, &md.AbandonedReason,
			&startedAt, &completedAt, &createdAt, &updatedAt)
		if err != nil {
			writeJSONError(w, "match not found", http.StatusNotFound)
			return
		}
		md.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		md.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
		if startedAt != nil {
			s := startedAt.UTC().Format(time.RFC3339)
			md.StartedAt = &s
		}
		if completedAt != nil {
			s := completedAt.UTC().Format(time.RFC3339)
			md.CompletedAt = &s
		}

		// Audit trail
		aRows, err := db.Query(ctx, `
SELECT a.id, a.action, a.actor_id, act.display_name, act.email,
       a.reason, a.after, a.before, a.created_at
FROM ops.admin_audit_log a
LEFT JOIN authz.admin_actor act ON act.id = a.actor_id
WHERE a.target_id = $1 AND a.target_type = 'learning.battle_session'
ORDER BY a.created_at DESC LIMIT 20`, id)
		if err == nil {
			for aRows.Next() {
				var ae AuditEntry
				var ts time.Time
				if err := aRows.Scan(&ae.ID, &ae.Action, &ae.ActorID, &ae.ActorName,
					&ae.ActorEmail, &ae.Reason, &ae.After, &ae.Before, &ts); err == nil {
					ae.CreatedAt = ts.UTC().Format(time.RFC3339)
					md.Audit = append(md.Audit, ae)
				}
			}
			aRows.Close()
		}
		if md.Audit == nil {
			md.Audit = []AuditEntry{}
		}
		writeJSON(w, http.StatusOK, md)
	}
}

// adminBattleMatchesAbortHandler implements POST /api/admin/battle/matches/{id}/abort.
func adminBattleMatchesAbortHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "matches", 1)
		if id == "" {
			writeJSONError(w, "match id required", http.StatusBadRequest)
			return
		}
		var req struct {
			Reason string `json:"reason"`
		}
		json.NewDecoder(r.Body).Decode(&req)
		ctx := r.Context()

		var beforeStatus, beforeAbandonedReason *string
		err := db.QueryRow(ctx, "SELECT status, abandoned_reason FROM learning.battle_session WHERE id = $1", id).
			Scan(&beforeStatus, &beforeAbandonedReason)
		if err != nil {
			writeJSONError(w, "match not found", http.StatusNotFound)
			return
		}
		if beforeStatus == nil || *beforeStatus != "in_progress" {
			writeJSONError(w, "only in_progress matches can be aborted", http.StatusBadRequest)
			return
		}

		db.Exec(ctx, `UPDATE learning.battle_session
SET status = 'abandoned', abandoned_reason = 'admin_abort', completed_at = NOW(), updated_at = NOW()
WHERE id = $1`, id)

		afterJSON, _ := json.Marshal(map[string]any{"status": "abandoned", "abandonedReason": "admin_abort"})
		beforeJSON, _ := json.Marshal(map[string]any{"status": beforeStatus, "abandonedReason": beforeAbandonedReason})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, before, created_at)
VALUES ('admin.battle.match.aborted', $1, $2, 'learning.battle_session', $3, $4, $5, NOW())`,
			identity.ActorID, id, req.Reason, afterJSON, beforeJSON)

		detailHandler := adminBattleMatchesDetailHandler(db, logger)
		detailHandler(w, r)
	}
}

// adminBattleMatchesRerunHandler implements POST /api/admin/battle/matches/{id}/rerun.
func adminBattleMatchesRerunHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "matches", 1)
		if id == "" {
			writeJSONError(w, "match id required", http.StatusBadRequest)
			return
		}
		var req struct {
			Reason string `json:"reason"`
		}
		json.NewDecoder(r.Body).Decode(&req)
		ctx := r.Context()

		type Source struct {
			UserID         string
			BotKey         *string
			Mode           string
			RoomCode       string
			MaxRounds      int
			Status         string
		}
		var src Source
		err := db.QueryRow(ctx, `
SELECT user_id, bot_key, mode, room_code, max_rounds, status
FROM learning.battle_session WHERE id = $1`, id).Scan(
			&src.UserID, &src.BotKey, &src.Mode, &src.RoomCode, &src.MaxRounds, &src.Status)
		if err != nil {
			writeJSONError(w, "match not found", http.StatusNotFound)
			return
		}
		if src.Status == "in_progress" {
			writeJSONError(w, "cannot rerun in_progress match", http.StatusBadRequest)
			return
		}

		fairnessSeed := fmt.Sprintf("%x-%x", time.Now().UnixMilli(), time.Now().UnixNano()%100000000)
		newRoomCode := src.RoomCode
		if len(newRoomCode) > 10 {
			newRoomCode = newRoomCode[:10]
		}
		newRoomCode += fmt.Sprintf("-r%x", time.Now().UnixNano()%65536)

		var createdID string
		err = db.QueryRow(ctx, `
INSERT INTO learning.battle_session (user_id, bot_key, mode, room_code, max_rounds,
    fairness_seed, status, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, 'in_progress', NOW(), NOW()) RETURNING id`,
			src.UserID, src.BotKey, src.Mode, newRoomCode, src.MaxRounds, fairnessSeed).Scan(&createdID)
		if err != nil {
			logger.Error("rerun battle match", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		afterJSON, _ := json.Marshal(map[string]any{"newId": createdID, "roomCode": newRoomCode, "sourceId": id})
		db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
VALUES ('admin.battle.match.rerun', $1, $2, 'learning.battle_session', $3, $4, NOW())`,
			identity.ActorID, id, req.Reason, afterJSON)

		// Return detail of the NEW match
		r.URL.Path = "/api/admin/battle/matches/" + createdID
		detailHandler := adminBattleMatchesDetailHandler(db, logger)
		detailHandler(w, r)
	}
}

// Ensure imports are used.
var _ = fmt.Sprintf