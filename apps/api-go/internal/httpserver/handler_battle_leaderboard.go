package httpserver

import (
	"database/sql"
	"log/slog"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
)

type battleLeaderboardRow struct {
	AvgScore     float64 `json:"avgScore"`
	DisplayName  string  `json:"displayName"`
	IsYou        bool    `json:"isYou"`
	Losses       int64   `json:"losses"`
	Rank         int64   `json:"rank"`
	TotalMatches int64   `json:"totalMatches"`
	WinRate      float64 `json:"winRate"`
	Wins         int64   `json:"wins"`
}

// getBattleLeaderboardHandler returns public display names and aggregate results only.
func getBattleLeaderboardHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		window := r.URL.Query().Get("window")
		var windowDays any
		switch window {
		case "30d":
			windowDays = 30
		case "90d":
			windowDays = 90
		default:
			window = "all"
		}
		page := queryInt(r, "page", 1)
		pageSize := queryInt(r, "pageSize", 15)
		if page < 1 {
			page = 1
		}
		if pageSize < 1 || pageSize > 100 {
			pageSize = 15
		}
		offset := (page - 1) * pageSize
		var since *string
		if days, ok := windowDays.(int); ok {
			value := time.Now().UTC().AddDate(0, 0, -days).Format(time.RFC3339)
			since = &value
		}

		const query = `WITH participants AS (
			SELECT bs.id AS session_id, bs.user_id, bs.user_score AS my_score,
				bs.opponent_score AS their_score, bs.started_at
			FROM learning.battle_session bs
			WHERE bs.status = 'completed' AND bs.mode = 'bot'
			UNION ALL
			SELECT bs.id, bs.user_id, bs.user_score, bs.opponent_score, bs.started_at
			FROM learning.battle_session bs
			WHERE bs.status = 'completed' AND bs.mode = 'pvp'
			UNION ALL
			SELECT bs.id, bs.opponent_user_id, bs.opponent_score, bs.user_score, bs.started_at
			FROM learning.battle_session bs
			WHERE bs.status = 'completed' AND bs.mode = 'pvp' AND bs.opponent_user_id IS NOT NULL
			), filtered AS (
				SELECT * FROM participants
				WHERE ($1::int IS NULL OR started_at >= NOW() - ($1::int * INTERVAL '1 day'))
			), aggregates AS (
			SELECT p.user_id,
				COALESCE(NULLIF(BTRIM(up.display_name), ''), 'Learner') AS display_name,
				COUNT(*) FILTER (WHERE p.my_score > p.their_score) AS wins,
				COUNT(*) FILTER (WHERE p.my_score < p.their_score) AS losses,
				COUNT(*) AS total_matches,
				ROUND(AVG(p.my_score)::numeric, 1)::float AS avg_score,
				ROUND((COUNT(*) FILTER (WHERE p.my_score > p.their_score)::numeric / NULLIF(COUNT(*), 0)) * 100, 1)::float AS win_rate
				FROM filtered p
				LEFT JOIN profile.user_profile up ON up.id = p.user_id
				GROUP BY p.user_id, up.display_name
		), ranked AS (
			SELECT ROW_NUMBER() OVER (ORDER BY wins DESC, avg_score DESC, user_id) AS rank,
				user_id, display_name, wins, losses, total_matches, avg_score, win_rate
				FROM aggregates
			), metadata AS (
				SELECT (SELECT COUNT(*) FROM aggregates)::bigint AS total,
					COUNT(DISTINCT user_id)::bigint AS total_participants,
					COUNT(DISTINCT session_id)::bigint AS completed_matches
				FROM filtered
			), selected AS (
				SELECT rank, user_id, display_name, wins, losses, total_matches, avg_score, win_rate,
					(user_id = $2::uuid) AS is_you
				FROM ranked
				WHERE (rank >= $3 AND rank <= $4) OR user_id = $2::uuid
			)
			SELECT selected.rank, selected.user_id::text, selected.display_name, selected.wins,
				selected.losses, selected.total_matches, selected.avg_score, selected.win_rate,
				selected.is_you, metadata.total, metadata.total_participants, metadata.completed_matches
			FROM metadata LEFT JOIN selected ON TRUE
			ORDER BY selected.rank`
		rows, err := db.Query(r.Context(), query, windowDays, identity.UserID, offset+1, offset+pageSize)
		if err != nil {
			logger.Error("load learner battle leaderboard", "error", err)
			writeJSONError(w, "unable to load battle leaderboard", http.StatusInternalServerError)
			return
		}
		items := make([]battleLeaderboardRow, 0, pageSize)
		var viewerRank *battleLeaderboardRow
		var total, totalParticipants, completedMatches int64
		for rows.Next() {
			var rank sql.NullInt64
			var userID, displayName sql.NullString
			var wins, losses, totalMatches sql.NullInt64
			var avgScore, winRate sql.NullFloat64
			var isYou sql.NullBool
			if err := rows.Scan(&rank, &userID, &displayName, &wins, &losses, &totalMatches, &avgScore, &winRate, &isYou, &total, &totalParticipants, &completedMatches); err != nil {
				rows.Close()
				logger.Error("scan learner battle leaderboard", "error", err)
				writeJSONError(w, "unable to load battle leaderboard", http.StatusInternalServerError)
				return
			}
			if !rank.Valid {
				continue
			}
			item := battleLeaderboardRow{
				Rank: rank.Int64, DisplayName: displayName.String, Wins: wins.Int64,
				Losses: losses.Int64, TotalMatches: totalMatches.Int64,
				AvgScore: avgScore.Float64, WinRate: winRate.Float64, IsYou: isYou.Bool,
			}
			if item.IsYou {
				copy := item
				viewerRank = &copy
			}
			items = append(items, item)
		}
		if err := rows.Err(); err != nil {
			rows.Close()
			logger.Error("iterate learner battle leaderboard", "error", err)
			writeJSONError(w, "unable to load battle leaderboard", http.StatusInternalServerError)
			return
		}
		rows.Close()

		writeJSON(w, http.StatusOK, map[string]any{
			"items": items, "page": page, "pageSize": pageSize, "total": total,
			"summary":    map[string]any{"completedMatches": completedMatches, "since": since, "totalParticipants": totalParticipants, "window": window},
			"viewerRank": viewerRank,
		})
	}
}
