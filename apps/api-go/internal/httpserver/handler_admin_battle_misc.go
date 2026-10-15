package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
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
			Window            string  `json:"window"`
			Since             *string `json:"since,omitempty"`
			TotalParticipants int     `json:"totalParticipants"`
			CompletedMatches  int     `json:"completedMatches"`
		}
		summary := Summary{
			Window:            window,
			Since:             sinceArg,
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
			ActiveBots          int `json:"activeBots"`
			ActiveConfigs       int `json:"activeConfigs"`
			PendingAbuseReports int `json:"pendingAbuseReports"`
			InProgressMatches   int `json:"inProgressMatches"`
			CompletedToday      int `json:"completedToday"`
		}
		var p SystemParams
		todayStart := time.Now().UTC().Truncate(24 * time.Hour).Format(time.RFC3339)
		for _, query := range []struct {
			name  string
			sql   string
			args  []any
			count *int
		}{
			{"active battle bots", "SELECT COUNT(*) FROM learning.battle_bot WHERE status = 'active'", nil, &p.ActiveBots},
			{"published battle configs", "SELECT COUNT(*) FROM learning.battle_config WHERE status = 'published'", nil, &p.ActiveConfigs},
			{"pending battle abuse reports", "SELECT COUNT(*) FROM learning.battle_abuse_report WHERE status = 'pending'", nil, &p.PendingAbuseReports},
			{"in-progress battle matches", "SELECT COUNT(*) FROM learning.battle_session WHERE status = 'in_progress'", nil, &p.InProgressMatches},
			{"completed battle matches today", "SELECT COUNT(*) FROM learning.battle_session WHERE status = 'completed' AND completed_at >= $1", []any{todayStart}, &p.CompletedToday},
		} {
			if err := db.QueryRow(ctx, query.sql, query.args...).Scan(query.count); err != nil {
				logger.Error("load Admin battle system parameter", "aggregate", query.name, "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
		}

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
			whereParts = append(whereParts, fmt.Sprintf("bs.status = $%d", argIdx))
			args = append(args, statusFilter)
			argIdx++
		}
		if modeFilter != "" {
			whereParts = append(whereParts, fmt.Sprintf("bs.mode = $%d", argIdx))
			args = append(args, modeFilter)
			argIdx++
		}
		if userID != "" {
			whereParts = append(whereParts, fmt.Sprintf("(bs.user_id = $%d OR bs.opponent_user_id = $%d)", argIdx, argIdx))
			args = append(args, userID)
			argIdx++
		}
		whereClause := ""
		if len(whereParts) > 0 {
			whereClause = "WHERE " + strings.Join(whereParts, " AND ")
		}

		countQuery := "SELECT COUNT(*) FROM learning.battle_session bs " + whereClause
		var total int
		if err := db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
			logger.Error("count battle matches", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		dataQuery := fmt.Sprintf(`
SELECT bs.id, bs.user_id, bs.opponent_user_id, bs.bot_key, bs.mode, bs.status, bs.room_code,
       bs.max_rounds, bs.current_round_index, bs.fairness_seed, bs.user_score, bs.opponent_score,
       bs.abandoned_reason, bs.started_at, bs.completed_at,
       (SELECT COUNT(*)::int FROM learning.battle_round br WHERE br.session_id = bs.id) AS round_count
FROM learning.battle_session bs %s
ORDER BY bs.started_at DESC LIMIT $%d OFFSET $%d`,
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
			ID                string  `json:"id"`
			UserID            string  `json:"userId"`
			OpponentUserID    *string `json:"opponentUserId,omitempty"`
			BotKey            *string `json:"botKey,omitempty"`
			Mode              string  `json:"mode"`
			Status            string  `json:"status"`
			RoomCode          string  `json:"roomCode"`
			MaxRounds         int     `json:"maxRounds"`
			CurrentRoundIndex int     `json:"currentRoundIndex"`
			Count             struct {
				Rounds int `json:"rounds"`
			} `json:"_count"`
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
			var startedAt time.Time
			var completedAt *time.Time
			var fairnessSeed string
			var roundCount int
			if err := rows.Scan(&m.ID, &m.UserID, &m.OpponentUserID, &m.BotKey,
				&m.Mode, &m.Status, &m.RoomCode, &m.MaxRounds, &m.CurrentRoundIndex, &fairnessSeed,
				&m.UserScore, &m.OpponentScore, &m.AbandonedReason,
				&startedAt, &completedAt, &roundCount); err != nil {
				logger.Error("scan battle match", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			m.Count.Rounds = roundCount
			startedAtText := startedAt.UTC().Format(time.RFC3339)
			m.CreatedAt = startedAtText
			m.StartedAt = &startedAtText
			if completedAt != nil {
				completedAtText := completedAt.UTC().Format(time.RFC3339)
				m.CompletedAt = &completedAtText
			}
			items = append(items, m)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate battle matches", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
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

		type AuditActor struct {
			ID          string `json:"id"`
			DisplayName string `json:"displayName"`
			Email       string `json:"email"`
		}
		type AuditEntry struct {
			ID        string          `json:"id"`
			Action    string          `json:"action"`
			Actor     *AuditActor     `json:"actor"`
			Reason    *string         `json:"reason"`
			After     json.RawMessage `json:"after"`
			Before    json.RawMessage `json:"before"`
			CreatedAt string          `json:"createdAt"`
		}
		type BattleRound struct {
			ID              string  `json:"id"`
			RoundIndex      int     `json:"roundIndex"`
			QuestionID      string  `json:"questionId"`
			UserOptionKey   *string `json:"userOptionKey"`
			UserCorrect     *bool   `json:"userCorrect"`
			UserResponseMs  *int    `json:"userResponseMs"`
			BotOptionKey    *string `json:"botOptionKey"`
			BotCorrect      *bool   `json:"botCorrect"`
			BotResponseMs   *int    `json:"botResponseMs"`
			DecidedAtString *string `json:"decidedAt"`
		}
		type MatchDetail struct {
			ID                string  `json:"id"`
			UserID            string  `json:"userId"`
			OpponentUserID    *string `json:"opponentUserId,omitempty"`
			BotKey            *string `json:"botKey,omitempty"`
			Mode              string  `json:"mode"`
			Status            string  `json:"status"`
			RoomCode          string  `json:"roomCode"`
			MaxRounds         int     `json:"maxRounds"`
			CurrentRoundIndex int     `json:"currentRoundIndex"`
			FairnessSeed      *string `json:"fairnessSeed,omitempty"`
			UserScore         *int    `json:"userScore,omitempty"`
			OpponentScore     *int    `json:"opponentScore,omitempty"`
			AbandonedReason   *string `json:"abandonedReason,omitempty"`
			StartedAt         *string `json:"startedAt"`
			CompletedAt       *string `json:"completedAt"`
			Count             struct {
				Rounds int `json:"rounds"`
			} `json:"_count"`
			Rounds []BattleRound `json:"rounds"`
			Audit  []AuditEntry  `json:"audit"`
		}
		md := MatchDetail{Rounds: []BattleRound{}, Audit: []AuditEntry{}}
		var startedAt, completedAt *time.Time
		err := db.QueryRow(ctx, `
SELECT id, user_id, opponent_user_id, bot_key, mode, status, room_code,
       max_rounds, current_round_index, fairness_seed, user_score, opponent_score,
       abandoned_reason, started_at, completed_at
FROM learning.battle_session WHERE id = $1`, id).Scan(
			&md.ID, &md.UserID, &md.OpponentUserID, &md.BotKey,
			&md.Mode, &md.Status, &md.RoomCode, &md.MaxRounds, &md.CurrentRoundIndex, &md.FairnessSeed,
			&md.UserScore, &md.OpponentScore, &md.AbandonedReason,
			&startedAt, &completedAt)
		if err != nil {
			writeJSONError(w, "match not found", http.StatusNotFound)
			return
		}
		if startedAt != nil {
			s := startedAt.UTC().Format(time.RFC3339)
			md.StartedAt = &s
		}
		if completedAt != nil {
			s := completedAt.UTC().Format(time.RFC3339)
			md.CompletedAt = &s
		}
		roundRows, err := db.Query(ctx, `
SELECT id, round_index, question_id, user_option_key, user_correct, user_response_ms,
       bot_option_key, bot_correct, bot_response_ms, decided_at
FROM learning.battle_round WHERE session_id = $1 ORDER BY round_index ASC`, id)
		if err != nil {
			logger.Error("list battle match rounds", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		for roundRows.Next() {
			var round BattleRound
			var decidedAt *time.Time
			if err := roundRows.Scan(&round.ID, &round.RoundIndex, &round.QuestionID,
				&round.UserOptionKey, &round.UserCorrect, &round.UserResponseMs,
				&round.BotOptionKey, &round.BotCorrect, &round.BotResponseMs, &decidedAt); err != nil {
				roundRows.Close()
				logger.Error("scan battle match round", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			if decidedAt != nil {
				decidedAtString := decidedAt.UTC().Format(time.RFC3339)
				round.DecidedAtString = &decidedAtString
			}
			md.Rounds = append(md.Rounds, round)
		}
		if err := roundRows.Err(); err != nil {
			roundRows.Close()
			logger.Error("iterate battle match rounds", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		roundRows.Close()
		md.Count.Rounds = len(md.Rounds)

		// Audit trail
		aRows, err := db.Query(ctx, `
SELECT a.id, a.action, a.actor_id, act.display_name, act.email,
       a.reason, a.after, a.before, a.created_at
FROM ops.admin_audit_log a
LEFT JOIN authz.admin_actor act ON act.id = a.actor_id
WHERE a.target_id = $1 AND a.target_type = 'learning.battle_session'
ORDER BY a.created_at DESC LIMIT 20`, id)
		if err != nil {
			logger.Error("list battle match audit", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		for aRows.Next() {
			var ae AuditEntry
			var actorID string
			var actorName, actorEmail *string
			var ts time.Time
			if err := aRows.Scan(&ae.ID, &ae.Action, &actorID, &actorName,
				&actorEmail, &ae.Reason, &ae.After, &ae.Before, &ts); err != nil {
				aRows.Close()
				logger.Error("scan battle match audit", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			actor := &AuditActor{ID: actorID}
			if actorName != nil {
				actor.DisplayName = *actorName
			}
			if actorEmail != nil {
				actor.Email = *actorEmail
			}
			ae.Actor = actor
			ae.CreatedAt = ts.UTC().Format(time.RFC3339)
			md.Audit = append(md.Audit, ae)
		}
		if err := aRows.Err(); err != nil {
			aRows.Close()
			logger.Error("iterate battle match audit", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		aRows.Close()
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
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || strings.TrimSpace(req.Reason) == "" {
			writeJSONError(w, "valid reason required", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		tx, err := db.Begin(ctx)
		if err != nil {
			logger.Error("begin abort battle match", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(context.Background())
		var beforeStatus, beforeAbandonedReason *string
		err = tx.QueryRow(ctx, "SELECT status, abandoned_reason FROM learning.battle_session WHERE id = $1 FOR UPDATE", id).
			Scan(&beforeStatus, &beforeAbandonedReason)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				writeJSONError(w, "match not found", http.StatusNotFound)
			} else {
				logger.Error("load battle match for abort", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
			}
			return
		}
		if beforeStatus == nil || *beforeStatus != "in_progress" {
			writeJSONError(w, "only in_progress matches can be aborted", http.StatusBadRequest)
			return
		}

		if _, err := tx.Exec(ctx, `UPDATE learning.battle_session
SET status = 'abandoned', abandoned_reason = 'admin_abort', completed_at = NOW()
WHERE id = $1`, id); err != nil {
			logger.Error("persist aborted battle match", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		afterJSON, _ := json.Marshal(map[string]any{"status": "abandoned", "abandonedReason": "admin_abort"})
		beforeJSON, _ := json.Marshal(map[string]any{"status": beforeStatus, "abandonedReason": beforeAbandonedReason})
		if _, err := tx.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, before, created_at)
VALUES ('admin.battle.match.aborted', $1, $2, 'learning.battle_session', $3, $4, $5, NOW())`,
			identity.ActorID, id, strings.TrimSpace(req.Reason), afterJSON, beforeJSON); err != nil {
			logger.Error("audit aborted battle match", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			logger.Error("commit aborted battle match", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

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
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || strings.TrimSpace(req.Reason) == "" {
			writeJSONError(w, "valid reason required", http.StatusBadRequest)
			return
		}
		ctx := r.Context()
		tx, err := db.Begin(ctx)
		if err != nil {
			logger.Error("begin rerun battle match", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(context.Background())

		type Source struct {
			UserID    string
			BotKey    *string
			Mode      string
			RoomCode  string
			MaxRounds int
			Status    string
		}
		var src Source
		err = tx.QueryRow(ctx, `
SELECT user_id, bot_key, mode, room_code, max_rounds, status
FROM learning.battle_session WHERE id = $1 FOR UPDATE`, id).Scan(
			&src.UserID, &src.BotKey, &src.Mode, &src.RoomCode, &src.MaxRounds, &src.Status)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				writeJSONError(w, "match not found", http.StatusNotFound)
			} else {
				logger.Error("load source battle match for rerun", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
			}
			return
		}
		if src.Status == "in_progress" {
			writeJSONError(w, "cannot rerun in_progress match", http.StatusBadRequest)
			return
		}

		fairnessSeed := fmt.Sprintf("%x-%x", time.Now().UnixMilli(), time.Now().UnixNano()%100000000)
		newRoomPrefix := src.RoomCode
		if len(newRoomPrefix) > 6 {
			newRoomPrefix = newRoomPrefix[:6]
		}
		newRoomCode := fmt.Sprintf("%s-r%08x", newRoomPrefix, uint32(time.Now().UnixNano()))

		var createdID string
		err = tx.QueryRow(ctx, `
INSERT INTO learning.battle_session (user_id, bot_key, mode, room_code, max_rounds, fairness_seed)
VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
			src.UserID, src.BotKey, src.Mode, newRoomCode, src.MaxRounds, fairnessSeed).Scan(&createdID)
		if err != nil {
			logger.Error("rerun battle match", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		afterJSON, _ := json.Marshal(map[string]any{"newId": createdID, "roomCode": newRoomCode, "sourceId": id})
		if _, err := tx.Exec(ctx, `INSERT INTO ops.admin_audit_log (action, actor_id, target_id, target_type, reason, after, created_at)
VALUES ('admin.battle.match.rerun', $1, $2, 'learning.battle_session', $3, $4, NOW())`,
			identity.ActorID, id, strings.TrimSpace(req.Reason), afterJSON); err != nil {
			logger.Error("audit rerun battle match", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(ctx); err != nil {
			logger.Error("commit rerun battle match", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		// Return detail of the NEW match
		r.URL.Path = "/api/admin/battle/matches/" + createdID
		detailHandler := adminBattleMatchesDetailHandler(db, logger)
		detailHandler(w, r)
	}
}

// Ensure imports are used.
var _ = fmt.Sprintf
