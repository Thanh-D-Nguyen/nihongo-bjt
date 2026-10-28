package httpserver

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"math"
	"mime"
	"net"
	"net/http"
	"net/netip"
	"net/url"
	"path/filepath"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"gocloud.dev/blob"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/flashcarddeck"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/realtime"
)

// ── Analytics ───────────────────────────────────────────────────────────────

// postAnalyticsEventsHandler implements POST /api/analytics/events.
// Public route — ingests analytics events.
func postAnalyticsEventsHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		type event struct {
			EventName string         `json:"eventName"`
			Source    string         `json:"source"`
			Payload   map[string]any `json:"payload"`
		}
		w.Header().Set("Content-Type", "application/json")
		decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20))
		var body json.RawMessage
		if err := decoder.Decode(&body); err != nil {
			writeJSONError(w, "invalid event payload", http.StatusBadRequest)
			return
		}
		var trailing any
		if err := decoder.Decode(&trailing); err != io.EOF {
			writeJSONError(w, "invalid event payload", http.StatusBadRequest)
			return
		}

		var events []event
		if len(body) > 0 && body[0] == '[' {
			if err := json.Unmarshal(body, &events); err != nil || len(events) == 0 || len(events) > 100 {
				writeJSONError(w, "invalid event payload", http.StatusBadRequest)
				return
			}
		} else {
			var single event
			if err := json.Unmarshal(body, &single); err != nil {
				writeJSONError(w, "invalid event payload", http.StatusBadRequest)
				return
			}
			events = []event{single}
		}
		for _, evt := range events {
			if strings.TrimSpace(evt.EventName) == "" || len(evt.EventName) > 120 || strings.TrimSpace(evt.Source) == "" || len(evt.Source) > 64 || evt.Payload == nil {
				writeJSONError(w, "invalid event payload", http.StatusBadRequest)
				return
			}
		}

		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin analytics event ingestion", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer func() { _ = tx.Rollback(r.Context()) }()
		for _, evt := range events {
			payloadJSON, err := json.Marshal(evt.Payload)
			if err != nil {
				writeJSONError(w, "invalid event payload", http.StatusBadRequest)
				return
			}
			const insertQ = `INSERT INTO analytics.analytics_event (event_name, source, payload, created_at) VALUES ($1, $2, $3, NOW())`
			if _, err := tx.Exec(r.Context(), insertQ, strings.TrimSpace(evt.EventName), strings.TrimSpace(evt.Source), payloadJSON); err != nil {
				logger.Error("ingest analytics event", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
		}
		if err := tx.Commit(r.Context()); err != nil {
			logger.Error("commit analytics event ingestion", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]bool{"accepted": true})
	}
}

// getAnalyticsLearnerHandler implements GET /api/analytics/learner.
// Authenticated learner route.
func getAnalyticsLearnerHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		userID := identity.UserID
		dayCount := 7
		if rawDays := r.URL.Query().Get("days"); rawDays != "" {
			parsed, err := strconv.Atoi(rawDays)
			if err != nil || parsed < 1 || parsed > 365 {
				writeJSONError(w, "days must be between 1 and 365", http.StatusBadRequest)
				return
			}
			dayCount = parsed
		}
		// Return aggregated learner analytics
		type DailyStats struct {
			Date       string `json:"date"`
			Minutes    int    `json:"minutes"`
			XPEarned   int    `json:"xpEarned"`
			LessonsCnt int    `json:"lessonsCount"`
		}
		const q = `SELECT date_trunc('day', started_at)::date as day,
			COALESCE(SUM(duration_minutes), 0) as minutes,
			COALESCE(SUM(xp_earned), 0) as xp,
			COUNT(*) as lessons
			FROM learning.study_session
			WHERE user_id = $1 AND started_at >= NOW() - ($2::int * INTERVAL '1 day')
			GROUP BY day ORDER BY day ASC`
		rows, err := db.Query(r.Context(), q, userID, dayCount)
		if err != nil {
			logger.Error("get learner analytics", "error", err)
			writeJSONError(w, "unable to load learner analytics", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		stats := make([]DailyStats, 0)
		for rows.Next() {
			var s DailyStats
			var day time.Time
			if err := rows.Scan(&day, &s.Minutes, &s.XPEarned, &s.LessonsCnt); err != nil {
				logger.Error("scan learner analytics", "error", err)
				writeJSONError(w, "unable to load learner analytics", http.StatusInternalServerError)
				return
			}
			s.Date = day.Format("2006-01-02")
			stats = append(stats, s)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate learner analytics", "error", err)
			writeJSONError(w, "unable to load learner analytics", http.StatusInternalServerError)
			return
		}

		// Compute totals expected by frontend LearnerAnalytics interface
		var completedBjtSessions int
		var bjtCorrect, bjtQuestions int
		var bjtAccuracyPct float64
		var reviewCount int
		var streakDays int

		var completedExercises, exerciseCorrect, exerciseAnswers int
		var exerciseAccuracy float64
		err = db.QueryRow(r.Context(), `SELECT
			(SELECT COUNT(*) FROM assessment.quiz_session WHERE user_id = $1 AND status = 'completed'),
			(SELECT COALESCE(SUM(correct_count), 0) FROM assessment.quiz_session WHERE user_id = $1 AND status = 'completed'),
			(SELECT COALESCE(SUM(total_questions), 0) FROM assessment.quiz_session WHERE user_id = $1 AND status = 'completed'),
			(SELECT COALESCE(100.0 * SUM(correct_count) / NULLIF(SUM(total_questions), 0), 0) FROM assessment.quiz_session WHERE user_id = $1 AND status = 'completed'),
			(SELECT COUNT(*) FROM learning.review_event WHERE user_id = $1),
			(SELECT COALESCE(MAX(us.current_streak), 0) FROM gamification.user_streak us
			 JOIN gamification.streak_config sc ON sc.id = us.streak_config_id AND sc.enabled
			 JOIN profile.user_profile p ON p.id = us.user_id
			 LEFT JOIN pg_timezone_names tz ON tz.name = p.timezone
			 WHERE us.user_id = $1 AND us.last_activity_date >= (NOW() AT TIME ZONE COALESCE(tz.name, 'UTC'))::date - 1),
			COUNT(*), COALESCE(SUM(correct_count), 0), COALESCE(SUM(total_questions), 0),
			COALESCE(100.0 * SUM(correct_count) / NULLIF(SUM(total_questions), 0), 0)
			FROM exercise.exercise_session WHERE user_id = $1 AND status = 'completed'`, userID).
			Scan(&completedBjtSessions, &bjtCorrect, &bjtQuestions, &bjtAccuracyPct, &reviewCount, &streakDays, &completedExercises, &exerciseCorrect, &exerciseAnswers, &exerciseAccuracy)
		if err != nil {
			logger.Error("get learner progress totals", "error", err)
			writeJSONError(w, "unable to load learner analytics", http.StatusInternalServerError)
			return
		}
		totalQuestions := bjtQuestions + exerciseAnswers
		if totalQuestions > 0 {
			bjtAccuracyPct = math.Round((100.0*float64(bjtCorrect+exerciseCorrect)/float64(totalQuestions))*10) / 10
		}
		exerciseAccuracy = math.Round(exerciseAccuracy*10) / 10

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"dailyStats": stats,
			"userId":     userID,
			"insight":    "",
			"totals": map[string]interface{}{
				"bjtAccuracyPct":            bjtAccuracyPct,
				"completedBjtSessions":      completedBjtSessions,
				"completedSessions":         completedBjtSessions + completedExercises,
				"completedExerciseSessions": completedExercises,
				"exerciseAnswerCount":       exerciseAnswers,
				"exerciseAccuracyPct":       exerciseAccuracy,
				"reviewCount":               reviewCount,
				"streakDays":                streakDays,
			},
		})
	}
}

// getAnalyticsHandler implements GET /api/analytics.
// Authenticated learner route — general analytics summary.
func getAnalyticsHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return getAnalyticsLearnerHandler(db, logger) // reuse
}

// getWeeklyReportLatestHandler returns the latest persisted report for the authenticated learner.
func getWeeklyReportLatestHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	type weeklyReport struct {
		TotalReviews     int      `json:"totalReviews"`
		AccuracyPct      float64  `json:"accuracyPct"`
		StreakDays       int      `json:"streakDays"`
		QuizSessions     int      `json:"quizSessions"`
		NewCardsLearned  int      `json:"newCardsLearned"`
		WeakSkills       []string `json:"weakSkills"`
		PrevWeekReviews  *int     `json:"prevWeekReviews"`
		PrevWeekAccuracy *float64 `json:"prevWeekAccuracy"`
		WeekStart        string   `json:"weekStart"`
		WeekEnd          string   `json:"weekEnd"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		var report weeklyReport
		report.WeakSkills = make([]string, 0)
		err := db.QueryRow(r.Context(), `
			SELECT total_reviews, accuracy_pct, streak_days, quiz_sessions, new_cards_learned,
			       COALESCE(weak_skills, '{}'::text[]), prev_week_reviews, prev_week_accuracy,
			       to_char(week_start, 'YYYY-MM-DD'), to_char(week_end, 'YYYY-MM-DD')
			FROM analytics.weekly_report
			WHERE user_id = $1
			ORDER BY week_start DESC, created_at DESC
			LIMIT 1`, identity.UserID).Scan(
			&report.TotalReviews, &report.AccuracyPct, &report.StreakDays, &report.QuizSessions,
			&report.NewCardsLearned, &report.WeakSkills, &report.PrevWeekReviews,
			&report.PrevWeekAccuracy, &report.WeekStart, &report.WeekEnd,
		)
		if errors.Is(err, pgx.ErrNoRows) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("null\n"))
			return
		}
		if err != nil {
			logger.Error("get latest weekly report", "error", err)
			writeJSONError(w, "unable to load weekly report", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(report)
	}
}

// getAnalyticsHeatmapHandler implements GET /api/analytics/heatmap.
// Authenticated learner route.
func getAnalyticsHeatmapHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		userID := identity.UserID
		days := r.URL.Query().Get("days")
		dayCount := 365
		if days != "" {
			parsed, err := strconv.Atoi(days)
			if err != nil || parsed < 1 || parsed > 365 {
				writeJSONError(w, "days must be between 1 and 365", http.StatusBadRequest)
				return
			}
			dayCount = parsed
		}
		type HeatmapDay struct {
			Date         string `json:"date"`
			Reviews      int    `json:"reviews"`
			Quizzes      int    `json:"quizzes"`
			FocusMinutes int    `json:"focusMinutes"`
			Total        int    `json:"total"`
			Level        int    `json:"level"`
		}
		type response struct {
			Days            []HeatmapDay `json:"days"`
			TotalDaysActive int          `json:"totalDaysActive"`
			LongestStreak   int          `json:"longestStreak"`
			CurrentStreak   int          `json:"currentStreak"`
		}
		const q = `WITH activity AS (
			SELECT started_at::date AS day,
				COALESCE(SUM(reviews_done), 0)::int AS reviews,
				COALESCE(SUM(quizzes_done), 0)::int AS quizzes,
				COALESCE(SUM(CASE WHEN mode = 'focus' THEN duration_minutes ELSE 0 END), 0)::int AS focus_minutes
			FROM learning.study_session
			WHERE user_id = $1
				AND started_at >= CURRENT_DATE - ($2::int - 1)
				AND started_at < CURRENT_DATE + INTERVAL '1 day'
			GROUP BY started_at::date
		)
		SELECT calendar.day::date, COALESCE(activity.reviews, 0), COALESCE(activity.quizzes, 0), COALESCE(activity.focus_minutes, 0)
		FROM generate_series(
			CURRENT_DATE::timestamp - (($2::int - 1) * INTERVAL '1 day'),
			CURRENT_DATE::timestamp,
			INTERVAL '1 day'
		) AS calendar(day)
		LEFT JOIN activity ON activity.day = calendar.day::date
		ORDER BY calendar.day`
		rows, err := db.Query(r.Context(), q, userID, dayCount)
		if err != nil {
			logger.Error("get heatmap", "error", err)
			writeJSONError(w, "unable to load heatmap", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		result := response{Days: make([]HeatmapDay, 0, dayCount)}
		for rows.Next() {
			var h HeatmapDay
			var day time.Time
			if err := rows.Scan(&day, &h.Reviews, &h.Quizzes, &h.FocusMinutes); err != nil {
				logger.Error("scan heatmap", "error", err)
				writeJSONError(w, "unable to load heatmap", http.StatusInternalServerError)
				return
			}
			h.Date = day.Format("2006-01-02")
			h.Total = h.Reviews + h.Quizzes + h.FocusMinutes
			switch {
			case h.Total >= 60:
				h.Level = 4
			case h.Total >= 30:
				h.Level = 3
			case h.Total >= 15:
				h.Level = 2
			case h.Total > 0:
				h.Level = 1
			}
			result.Days = append(result.Days, h)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate heatmap", "error", err)
			writeJSONError(w, "unable to load heatmap", http.StatusInternalServerError)
			return
		}
		for _, day := range result.Days {
			if day.Total > 0 {
				result.TotalDaysActive++
			}
		}
		streak := 0
		for i := len(result.Days) - 1; i >= 0; i-- {
			if result.Days[i].Total == 0 {
				break
			}
			streak++
		}
		result.CurrentStreak = streak
		streak = 0
		for _, day := range result.Days {
			if day.Total == 0 {
				streak = 0
				continue
			}
			streak++
			if streak > result.LongestStreak {
				result.LongestStreak = streak
			}
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(result)
	}
}

// ── Auth Link ───────────────────────────────────────────────────────────────

// postAuthLinkExchangeHandler implements POST /api/auth/link/exchange.
// Authenticated learner route with CSRF protection.
func postAuthLinkExchangeHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			Provider string `json:"provider"`
			Code     string `json:"code"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		// Record link exchange attempt
		const insertQ = `INSERT INTO auth.link_exchange (user_id, provider, code, status, created_at)
			VALUES ($1, $2, $3, 'pending', NOW()) RETURNING id`
		var exchangeID string
		if err := db.QueryRow(r.Context(), insertQ, identity.UserID, req.Provider, req.Code).Scan(&exchangeID); err != nil {
			logger.Error("auth link exchange", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]string{"exchangeId": exchangeID, "status": "pending"})
	}
}

// ── Battle ──────────────────────────────────────────────────────────────────

// getBattleBotsHandler implements GET /api/battle/bots.
// Public route — returns available battle bots.
func getBattleBotsHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		const q = `SELECT bot_key, name, avatar_fallback, difficulty, persona,
			accuracy_pct, min_delay_ms, max_delay_ms, vocabulary_level,
			style_token, rive_src, rive_artboard, rive_state_machine
			FROM learning.battle_bot WHERE status = 'active' ORDER BY name, bot_key`
		rows, err := db.Query(r.Context(), q)
		if err != nil {
			logger.Error("list battle bots", "error", err)
			writeJSONError(w, "unable to load battle bots", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		type Rive struct {
			Artboard     string  `json:"artboard"`
			Src          *string `json:"src"`
			StateMachine string  `json:"stateMachine"`
		}
		type Bot struct {
			AccuracyPct     int     `json:"accuracyPct"`
			AvatarFallback  string  `json:"avatarFallback"`
			BotKey          string  `json:"botKey"`
			Difficulty      string  `json:"difficulty"`
			Label           string  `json:"label"`
			MaxDelayMs      int     `json:"maxDelayMs"`
			MinDelayMs      int     `json:"minDelayMs"`
			Persona         *string `json:"persona"`
			Rive            Rive    `json:"rive"`
			StyleToken      string  `json:"styleToken"`
			VocabularyLevel string  `json:"vocabularyLevel"`
		}
		var bots []Bot
		for rows.Next() {
			var b Bot
			if err := rows.Scan(&b.BotKey, &b.Label, &b.AvatarFallback, &b.Difficulty, &b.Persona,
				&b.AccuracyPct, &b.MinDelayMs, &b.MaxDelayMs, &b.VocabularyLevel,
				&b.StyleToken, &b.Rive.Src, &b.Rive.Artboard, &b.Rive.StateMachine); err != nil {
				logger.Error("scan battle bot", "error", err)
				writeJSONError(w, "unable to load battle bots", http.StatusInternalServerError)
				return
			}
			switch b.BotKey {
			case "bot_j1":
				b.Label = "battle.bots.j1"
			case "bot_j2":
				b.Label = "battle.bots.j2"
			case "bot_j3":
				b.Label = "battle.bots.j3"
			case "bot_j4":
				b.Label = "battle.bots.j4"
			}
			bots = append(bots, b)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate battle bots", "error", err)
			writeJSONError(w, "unable to load battle bots", http.StatusInternalServerError)
			return
		}
		if bots == nil {
			bots = []Bot{}
		}
		writeJSON(w, http.StatusOK, bots)
	}
}

// getBattleChatRecentHandler implements GET /api/battle/chat/recent.
// Authenticated learner route.
func getBattleChatRecentHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		limit := queryInt(r, "limit", 40)
		if limit < 1 {
			limit = 40
		} else if limit > 100 {
			limit = 100
		}
		roomKey := strings.TrimSpace(r.URL.Query().Get("roomKey"))
		if roomKey == "" {
			roomKey = "global"
		}
		if len(roomKey) > 64 {
			writeJSONError(w, "invalid room key", http.StatusBadRequest)
			return
		}
		const q = `SELECT m.id, m.room_key, m.user_id, m.display_name, m.message, m.kind, m.created_at
			FROM learning.battle_chat_message m
			WHERE m.room_key = $1 AND m.moderation_state = 'visible'
			AND ($1 = 'global' OR EXISTS (
				SELECT 1 FROM learning.battle_session bs
				WHERE bs.id = m.session_id AND bs.room_code = m.room_key
				AND (bs.user_id = $2::uuid OR bs.opponent_user_id = $2::uuid)
			))
			ORDER BY m.created_at DESC LIMIT $3`
		rows, err := db.Query(r.Context(), q, roomKey, identity.UserID, limit)
		if err != nil {
			logger.Error("battle chat recent", "error", err)
			writeJSONError(w, "unable to load battle chat", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		type Msg struct {
			CreatedAt   string  `json:"createdAt"`
			DisplayName *string `json:"displayName"`
			ID          string  `json:"id"`
			Kind        string  `json:"kind"`
			Message     string  `json:"message"`
			RoomKey     string  `json:"roomKey"`
			UserID      string  `json:"userId"`
		}
		var msgs []Msg
		for rows.Next() {
			var m Msg
			var createdAt time.Time
			if err := rows.Scan(&m.ID, &m.RoomKey, &m.UserID, &m.DisplayName, &m.Message, &m.Kind, &createdAt); err != nil {
				logger.Error("scan battle chat recent", "error", err)
				writeJSONError(w, "unable to load battle chat", http.StatusInternalServerError)
				return
			}
			m.CreatedAt = createdAt.UTC().Format(time.RFC3339)
			msgs = append(msgs, m)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate battle chat recent", "error", err)
			writeJSONError(w, "unable to load battle chat", http.StatusInternalServerError)
			return
		}
		if msgs == nil {
			msgs = []Msg{}
		}
		writeJSON(w, http.StatusOK, msgs)
	}
}

// postBattleChatHandler persists a learner's global lobby message and broadcasts it to the lobby.
func postBattleChatHandler(db *pgxpool.Pool, battle *realtime.BattleHandler, logger *slog.Logger) http.HandlerFunc {
	type message struct {
		CreatedAt   string  `json:"createdAt"`
		DisplayName *string `json:"displayName"`
		ID          string  `json:"id"`
		Kind        string  `json:"kind"`
		Message     string  `json:"message"`
		RoomKey     string  `json:"roomKey"`
		UserID      string  `json:"userId"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var body struct {
			Message string `json:"message"`
		}
		decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096))
		if err := decoder.Decode(&body); err != nil {
			writeJSONError(w, "invalid message", http.StatusBadRequest)
			return
		}
		var trailing any
		if err := decoder.Decode(&trailing); err != io.EOF {
			writeJSONError(w, "invalid message", http.StatusBadRequest)
			return
		}
		body.Message = strings.TrimSpace(body.Message)
		if body.Message == "" || utf8.RuneCountInString(body.Message) > 500 {
			writeJSONError(w, "message must contain 1 to 500 characters", http.StatusBadRequest)
			return
		}
		if battle != nil && !battle.CheckAndRecordChatRate(identity.UserID) {
			const rateQ = `INSERT INTO analytics.analytics_event (event_name, user_id, source, payload)
				VALUES ('battle_chat_rate_limited', $1, 'api', '{"roomKey":"global","transport":"http"}'::jsonb)`
			if _, err := db.Exec(r.Context(), rateQ, identity.UserID); err != nil {
				logger.Warn("record battle chat rate-limit event", "error", err)
			}
			writeJSONError(w, "Chat rate limit exceeded. Please wait before sending more messages.", http.StatusTooManyRequests)
			return
		}
		var saved message
		var createdAt time.Time
		const q = `INSERT INTO learning.battle_chat_message (room_key, user_id, display_name, message, kind, moderation_state)
			SELECT 'global', p.id::text, p.display_name, $2, 'chat', 'visible'
			FROM profile.user_profile p WHERE p.id = $1::uuid
			RETURNING id::text, room_key, user_id, display_name, message, kind, created_at`
		if err := db.QueryRow(r.Context(), q, identity.UserID, body.Message).Scan(
			&saved.ID, &saved.RoomKey, &saved.UserID, &saved.DisplayName, &saved.Message, &saved.Kind, &createdAt,
		); err != nil {
			logger.Error("persist battle lobby message", "error", err)
			writeJSONError(w, "unable to send message", http.StatusInternalServerError)
			return
		}
		saved.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		if battle != nil {
			battle.BroadcastLobbyMessage(realtime.LobbyMessage{
				CreatedAt:   saved.CreatedAt,
				DisplayName: saved.DisplayName,
				ID:          saved.ID,
				Kind:        saved.Kind,
				Message:     saved.Message,
				RoomKey:     saved.RoomKey,
				UserID:      saved.UserID,
			})
		}
		writeJSON(w, http.StatusCreated, saved)
	}
}

// getBattlePlayerStatsHandler implements GET /api/battle/player-stats?userId=<uuid>.
// Authenticated learner route returning aggregate battle stats for a player.
func getBattlePlayerStatsHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if _, ok := authn.GetLearnerIdentity(r.Context()); !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		targetUserID := strings.TrimSpace(r.URL.Query().Get("userId"))
		if targetUserID == "" || !isValidUUID(targetUserID) {
			writeJSONError(w, "userId must be a valid UUID", http.StatusBadRequest)
			return
		}
		const q = `WITH participants AS (
			SELECT bs.user_score AS my_score, bs.opponent_score AS their_score
			FROM learning.battle_session bs
			WHERE bs.status = 'completed' AND bs.user_id = $1::uuid
			UNION ALL
			SELECT bs.opponent_score AS my_score, bs.user_score AS their_score
			FROM learning.battle_session bs
			WHERE bs.status = 'completed' AND bs.mode = 'pvp' AND bs.opponent_user_id = $1::uuid
		)
		SELECT
			COUNT(*)::int AS completed_matches,
			COUNT(*) FILTER (WHERE my_score > their_score)::int AS wins,
			COUNT(*) FILTER (WHERE my_score < their_score)::int AS losses,
			COUNT(*) FILTER (WHERE my_score = their_score)::int AS draws
		FROM participants`
		var completedMatches, wins, losses, draws int
		if err := db.QueryRow(r.Context(), q, targetUserID).Scan(&completedMatches, &wins, &losses, &draws); err != nil {
			logger.Error("query battle player stats", "error", err, "target_user_id", targetUserID)
			writeJSONError(w, "unable to load player stats", http.StatusInternalServerError)
			return
		}
		winRatePct := 0.0
		if completedMatches > 0 {
			winRatePct = math.Round((float64(wins)/float64(completedMatches))*1000) / 10
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"completedMatches": completedMatches,
			"draws":            draws,
			"losses":           losses,
			"winRatePct":       winRatePct,
			"wins":             wins,
		})
	}
}

// getBattleConfigsAvailableHandler implements GET /api/battle/configs/available.
// Public route.
func getBattleConfigsAvailableHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		const q = `SELECT id, name, description, level, question_pool_key, question_count,
			time_per_question_sec, max_participants, bot_difficulties, scoring_rules,
			schedule_start, schedule_end, published_at,
			COALESCE(NULLIF(scoring_rules->>'gameType', ''), 'custom'),
			(schedule_start IS NULL OR schedule_start <= NOW()) AND (schedule_end IS NULL OR schedule_end > NOW()),
		COALESCE(schedule_start > NOW(), false)
			FROM learning.battle_config WHERE status = 'published'
			AND (schedule_end IS NULL OR schedule_end > NOW())
			ORDER BY schedule_start NULLS FIRST, name, id`
		rows, err := db.Query(r.Context(), q)
		if err != nil {
			logger.Error("battle configs", "error", err)
			writeJSONError(w, "unable to load battle configs", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		type Config struct {
			BotDifficulties    []string        `json:"botDifficulties"`
			Description        *string         `json:"description"`
			GameType           string          `json:"gameType"`
			ID                 string          `json:"id"`
			IsActive           bool            `json:"isActive"`
			IsUpcoming         bool            `json:"isUpcoming"`
			Level              string          `json:"level"`
			MaxParticipants    int             `json:"maxParticipants"`
			Name               string          `json:"name"`
			PublishedAt        *string         `json:"publishedAt"`
			QuestionCount      int             `json:"questionCount"`
			QuestionPoolKey    string          `json:"questionPoolKey"`
			ScheduleEnd        *string         `json:"scheduleEnd"`
			ScheduleStart      *string         `json:"scheduleStart"`
			ScoringRules       json.RawMessage `json:"scoringRules"`
			TimePerQuestionSec int             `json:"timePerQuestionSec"`
		}
		var configs []Config
		for rows.Next() {
			var c Config
			var scheduleStart, scheduleEnd, publishedAt *time.Time
			var botDifficulties []string
			if err := rows.Scan(&c.ID, &c.Name, &c.Description, &c.Level, &c.QuestionPoolKey,
				&c.QuestionCount, &c.TimePerQuestionSec, &c.MaxParticipants, &botDifficulties,
				&c.ScoringRules, &scheduleStart, &scheduleEnd, &publishedAt, &c.GameType, &c.IsActive, &c.IsUpcoming); err != nil {
				logger.Error("scan battle config", "error", err)
				writeJSONError(w, "unable to load battle configs", http.StatusInternalServerError)
				return
			}
			c.BotDifficulties = botDifficulties
			if c.BotDifficulties == nil {
				c.BotDifficulties = []string{}
			}
			if scheduleStart != nil {
				value := scheduleStart.UTC().Format(time.RFC3339)
				c.ScheduleStart = &value
			}
			if scheduleEnd != nil {
				value := scheduleEnd.UTC().Format(time.RFC3339)
				c.ScheduleEnd = &value
			}
			if publishedAt != nil {
				value := publishedAt.UTC().Format(time.RFC3339)
				c.PublishedAt = &value
			}
			configs = append(configs, c)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate battle configs", "error", err)
			writeJSONError(w, "unable to load battle configs", http.StatusInternalServerError)
			return
		}
		if configs == nil {
			configs = []Config{}
		}
		writeJSON(w, http.StatusOK, configs)
	}
}

// ── Companion ───────────────────────────────────────────────────────────────

// getCompanionHintHandler implements GET /api/companion/hint.
// Authenticated learner route.
func getCompanionHintHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		days := r.URL.Query().Get("days")
		if days == "" {
			days = "7"
		}
		dayCount, err := strconv.Atoi(days)
		if err != nil || dayCount < 1 || dayCount > 365 {
			writeJSONError(w, "invalid days parameter", http.StatusBadRequest)
			return
		}
		// Generate contextual hint based on recent activity
		type Hint struct {
			Text     string `json:"text"`
			Category string `json:"category"`
		}
		hints := []Hint{
			{Text: "Keep up your daily streak! You're doing great.", Category: "motivation"},
		}
		// Check recent activity for personalized hints
		const q = `SELECT COUNT(*) FROM learning.study_session WHERE user_id = $1 AND started_at >= NOW() - ($2 * INTERVAL '1 day')`
		var sessionCount int
		if err := db.QueryRow(r.Context(), q, identity.UserID, dayCount).Scan(&sessionCount); err != nil {
			logger.Error("load companion activity", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if sessionCount > 0 {
			hints = append(hints, Hint{Text: "You've been consistent lately. Try a harder level!", Category: "progression"})
		}
		primary := map[string]any{"action": "daily_hub", "hrefSuffix": "/daily", "score": 1,
			"reasons": []any{map[string]any{"code": "DAILY_HUB", "params": map[string]any{}}}}
		if sessionCount > 0 {
			primary = map[string]any{"action": "bjt_quiz", "hrefSuffix": "/quiz", "score": 1,
				"reasons": []any{map[string]any{"code": "QUIZ_GENERAL", "params": map[string]any{}}}}
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"hints": hints, "algorithmVersion": "2026-02-02a", "computedAt": time.Now().UTC().Format(time.RFC3339),
			"primary": primary, "alternatives": []any{},
		})
	}
}

// ── Exercises ───────────────────────────────────────────────────────────────

// getExerciseSessionsHistoryHandler implements GET /api/exercises/sessions/history.
// Authenticated learner route.
func getExerciseSessionsHistoryHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		limit := 20
		const q = `SELECT id::text, exercise_type, status, score, total_questions, completed_at
			FROM exercise.exercise_session WHERE user_id = $1
			ORDER BY COALESCE(completed_at, started_at) DESC LIMIT $2`
		rows, err := db.Query(r.Context(), q, identity.UserID, limit)
		if err != nil {
			logger.Error("exercise sessions history", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		type Session struct {
			ID             string  `json:"id"`
			ExerciseType   string  `json:"exerciseType"`
			Status         string  `json:"status"`
			Score          int     `json:"score"`
			TotalQuestions int     `json:"totalQuestions"`
			CompletedAt    *string `json:"completedAt,omitempty"`
		}
		var sessions []Session
		for rows.Next() {
			var s Session
			var completedAt *time.Time
			if err := rows.Scan(&s.ID, &s.ExerciseType, &s.Status, &s.Score, &s.TotalQuestions, &completedAt); err != nil {
				logger.Error("scan exercise session history", "error", err, "user_id", identity.UserID)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			if completedAt != nil {
				formatted := completedAt.Format(time.RFC3339)
				s.CompletedAt = &formatted
			}
			sessions = append(sessions, s)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate exercise session history", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if sessions == nil {
			sessions = []Session{}
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(sessions)
	}
}

// getExercisesDailyProgressHandler implements GET /api/exercises/daily-progress.
// Authenticated learner route.
func getExercisesDailyProgressHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var timezone string
		var goal int
		if err := db.QueryRow(r.Context(), `SELECT timezone, daily_goal_exercises FROM profile.user_profile WHERE id = $1`, identity.UserID).Scan(&timezone, &goal); err != nil {
			logger.Error("exercise daily progress profile", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		location, err := time.LoadLocation(timezone)
		if err != nil {
			if logger != nil {
				logger.Warn("invalid learner timezone for daily progress; using UTC", "user_id", identity.UserID, "timezone", timezone)
			}
			location = time.UTC
		}
		now := time.Now().In(location)
		dayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, location)
		dayEnd := dayStart.AddDate(0, 0, 1)
		const q = `SELECT COALESCE(SUM(score), 0), COUNT(*), COALESCE(SUM(total_questions), 0)
			FROM exercise.exercise_session
			WHERE user_id = $1 AND completed_at >= $2 AND completed_at < $3`
		var totalScore, sessionCount, totalQuestions int
		if err := db.QueryRow(r.Context(), q, identity.UserID, dayStart, dayEnd).Scan(&totalScore, &sessionCount, &totalQuestions); err != nil {
			logger.Error("exercise daily progress", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if goal <= 0 {
			goal = 10
		}
		progress := min(float64(totalQuestions)/float64(goal), 1)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(struct {
			Date           string  `json:"date"`
			TotalScore     int     `json:"totalScore"`
			SessionCount   int     `json:"sessionCount"`
			TotalQuestions int     `json:"totalQuestions"`
			Completed      int     `json:"completed"`
			Goal           int     `json:"goal"`
			Progress       float64 `json:"progress"`
			IsComplete     bool    `json:"isComplete"`
		}{
			Date: now.Format("2006-01-02"), TotalScore: totalScore, SessionCount: sessionCount,
			TotalQuestions: totalQuestions, Completed: totalQuestions, Goal: goal,
			Progress: progress, IsComplete: totalQuestions >= goal,
		})
	}
}

// getExercisesReviewDueHandler implements GET /api/exercises/review/due.
// Authenticated learner route.
func getExercisesReviewDueHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		const q = `SELECT id, exercise_id, due_at, priority FROM study.review_queue
			WHERE user_id = $1 AND due_at <= NOW() AND completed = false ORDER BY priority DESC, due_at ASC LIMIT 50`
		rows, err := db.Query(r.Context(), q, identity.UserID)
		if err != nil {
			logger.Error("review due", "error", err)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_ = json.NewEncoder(w).Encode([]interface{}{})
			return
		}
		defer rows.Close()
		type ReviewItem struct {
			ID         string `json:"id"`
			ExerciseID string `json:"exerciseId"`
			DueAt      string `json:"dueAt"`
			Priority   int    `json:"priority"`
		}
		var items []ReviewItem
		for rows.Next() {
			var ri ReviewItem
			var dueAt time.Time
			if err := rows.Scan(&ri.ID, &ri.ExerciseID, &dueAt, &ri.Priority); err == nil {
				ri.DueAt = dueAt.Format(time.RFC3339)
				items = append(items, ri)
			}
		}
		if items == nil {
			items = []ReviewItem{}
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(items)
	}
}

// postExercisesReviewHandler implements POST /api/exercises/review/{exerciseId}.
// Authenticated learner route with CSRF protection.
func postExercisesReviewHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		var exerciseID string
		for i, p := range parts {
			if p == "review" && i+1 < len(parts) {
				exerciseID = parts[i+1]
				break
			}
		}
		if exerciseID == "" {
			writeJSONError(w, "exercise id required", http.StatusBadRequest)
			return
		}
		var req struct {
			Correct bool `json:"correct"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		// Mark review as completed
		const updateQ = `UPDATE study.review_queue SET completed = true, completed_at = NOW(), correct = $3
			WHERE user_id = $1 AND exercise_id = $2 AND completed = false`
		if _, err := db.Exec(r.Context(), updateQ, identity.UserID, exerciseID, req.Correct); err != nil {
			logger.Error("submit exercise review", "error", err)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]bool{"submitted": true})
	}
}

// ── Review (generic) ────────────────────────────────────────────────────────

// listReviewHandler implements GET /api/review.
// Authenticated learner route.
func listReviewHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		const q = `SELECT id, title, kind, created_at FROM study.user_review_deck WHERE user_id = $1 ORDER BY created_at DESC`
		rows, err := db.Query(r.Context(), q, identity.UserID)
		if err != nil {
			logger.Error("list reviews", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		type Deck struct {
			ID        string `json:"id"`
			Title     string `json:"title"`
			Kind      string `json:"kind"`
			CreatedAt string `json:"createdAt"`
		}
		var decks []Deck
		for rows.Next() {
			var d Deck
			var createdAt time.Time
			if err := rows.Scan(&d.ID, &d.Title, &d.Kind, &createdAt); err != nil {
				logger.Error("scan review", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			d.CreatedAt = createdAt.Format(time.RFC3339)
			decks = append(decks, d)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate reviews", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if decks == nil {
			decks = []Deck{}
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(decks)
	}
}

// createReviewHandler implements POST /api/review.
// Authenticated learner route with CSRF protection.
func createReviewHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			Title string `json:"title"`
			Kind  string `json:"kind"`
		}
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16<<10)).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		req.Title = strings.TrimSpace(req.Title)
		req.Kind = strings.TrimSpace(req.Kind)
		if req.Title == "" || len([]rune(req.Title)) > 200 || req.Kind == "" || len(req.Kind) > 64 {
			writeJSONError(w, "valid title and kind are required", http.StatusBadRequest)
			return
		}
		const insertQ = `INSERT INTO study.user_review_deck (user_id, title, kind, created_at) VALUES ($1, $2, $3, NOW()) RETURNING id`
		var deckID string
		if err := db.QueryRow(r.Context(), insertQ, identity.UserID, req.Title, req.Kind).Scan(&deckID); err != nil {
			logger.Error("create review deck", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]string{"id": deckID})
	}
}

// updateReviewHandler implements PATCH /api/review/{id}.
// Authenticated learner route with CSRF protection.
func updateReviewHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "review", 1)
		if id == "" {
			writeJSONError(w, "review id required", http.StatusBadRequest)
			return
		}
		var req struct {
			Title *string `json:"title"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.Title == nil || strings.TrimSpace(*req.Title) == "" || len([]rune(strings.TrimSpace(*req.Title))) > 200 {
			writeJSONError(w, "valid title is required", http.StatusBadRequest)
			return
		}
		const updateQ = `UPDATE study.user_review_deck SET title = $2, updated_at = NOW() WHERE id = $1 AND user_id = $3`
		result, err := db.Exec(r.Context(), updateQ, id, strings.TrimSpace(*req.Title), identity.UserID)
		if err != nil {
			logger.Error("update review", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if result.RowsAffected() == 0 {
			writeJSONError(w, "review not found", http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]bool{"updated": true})
	}
}

// getReviewDetailHandler implements GET /api/review/{id}.
// Authenticated learner route.
func getReviewDetailHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "review", 1)
		if id == "" {
			writeJSONError(w, "review id required", http.StatusBadRequest)
			return
		}
		type Deck struct {
			ID        string `json:"id"`
			Title     string `json:"title"`
			Kind      string `json:"kind"`
			CreatedAt string `json:"createdAt"`
		}
		var d Deck
		var createdAt time.Time
		const q = `SELECT id, title, kind, created_at FROM study.user_review_deck WHERE id = $1 AND user_id = $2`
		if err := db.QueryRow(r.Context(), q, id, identity.UserID).Scan(&d.ID, &d.Title, &d.Kind, &createdAt); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				writeJSONError(w, "review not found", http.StatusNotFound)
				return
			}
			logger.Error("get review", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		d.CreatedAt = createdAt.Format(time.RFC3339)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(d)
	}
}

// deleteReviewHandler implements DELETE /api/review/{id}.
// Authenticated learner route with CSRF protection.
func deleteReviewHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := extractPathParam(r.URL.Path, "review", 1)
		if id == "" {
			writeJSONError(w, "review id required", http.StatusBadRequest)
			return
		}
		const delQ = `DELETE FROM study.user_review_deck WHERE id = $1 AND user_id = $2`
		result, err := db.Exec(r.Context(), delQ, id, identity.UserID)
		if err != nil {
			logger.Error("delete review", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if result.RowsAffected() == 0 {
			writeJSONError(w, "review not found", http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]bool{"deleted": true})
	}
}

// getReviewNextHandler implements GET /api/review/next.
// Authenticated learner route.
func getReviewNextHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		const q = `SELECT id, exercise_id, due_at FROM study.review_queue
			WHERE user_id = $1 AND completed = false ORDER BY due_at ASC LIMIT 1`
		var id, exerciseID string
		var dueAt time.Time
		if err := db.QueryRow(r.Context(), q, identity.UserID).Scan(&id, &exerciseID, &dueAt); err != nil {
			if !errors.Is(err, pgx.ErrNoRows) {
				logger.Error("get next review", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_ = json.NewEncoder(w).Encode([]interface{}{})
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode([]map[string]string{{"id": id, "exerciseId": exerciseID, "dueAt": dueAt.Format(time.RFC3339)}})
	}
}

// ── Public Shares / Decks ───────────────────────────────────────────────────

// getPublicShareHandler implements GET /api/public/shares/{token}.
// Public route.
func getPublicShareHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		token := extractPathParam(r.URL.Path, "shares", 1)
		if token == "" {
			writeJSONError(w, "token required", http.StatusBadRequest)
			return
		}
		type Share struct {
			ID             string          `json:"id"`
			PublicToken    string          `json:"publicToken"`
			Kind           string          `json:"kind"`
			SummaryPayload json.RawMessage `json:"summaryPayload"`
			CreatedAt      string          `json:"createdAt"`
		}
		var s Share
		var createdAt time.Time
		const q = `SELECT id, public_token, kind, summary_payload, created_at FROM growth.share_item WHERE public_token = $1 AND (expires_at IS NULL OR expires_at > NOW())`
		if err := db.QueryRow(r.Context(), q, token).Scan(&s.ID, &s.PublicToken, &s.Kind, &s.SummaryPayload, &createdAt); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				writeJSONError(w, "share not found", http.StatusNotFound)
				return
			}
			logger.Error("get public share", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		s.CreatedAt = createdAt.Format(time.RFC3339)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(s)
	}
}

// getPublicDeckHandler implements GET /api/public/decks/{token}.
// Public route.
func getPublicDeckHandler(store *flashcarddeck.Store, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		token := extractPathParam(r.URL.Path, "decks", 1)
		if token == "" {
			writeJSONError(w, "token required", http.StatusBadRequest)
			return
		}
		preview, err := store.GetSharedDeckPreview(r.Context(), token)
		if errors.Is(err, flashcarddeck.ErrNotFound) {
			writeJSONError(w, "deck not found", http.StatusNotFound)
			return
		}
		if err != nil {
			logger.Error("get shared deck preview", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(preview)
	}
}

// ── Media ───────────────────────────────────────────────────────────────────

// postMediaSearchImagesHandler implements POST /api/media/search-images.
// Authenticated learner route with CSRF protection.
func postMediaSearchImagesHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			Query string `json:"query"`
			Limit int    `json:"limit"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		req.Query = strings.TrimSpace(req.Query)
		if len([]rune(req.Query)) < 2 {
			writeJSONError(w, "query must contain at least 2 characters", http.StatusBadRequest)
			return
		}
		logger.Warn("media image search unavailable: Go API provider integration and credentials are missing")
		writeJSONError(w, "image search unavailable: Go API provider integration is missing; configure UNSPLASH_ACCESS_KEY or PIXABAY_API_KEY", http.StatusServiceUnavailable)
	}
}

type mediaProxyResolver interface {
	LookupIPAddr(context.Context, string) ([]net.IPAddr, error)
}

var blockedMediaProxyPrefixes = []netip.Prefix{
	netip.MustParsePrefix("0.0.0.0/8"), netip.MustParsePrefix("10.0.0.0/8"), netip.MustParsePrefix("100.64.0.0/10"),
	netip.MustParsePrefix("127.0.0.0/8"), netip.MustParsePrefix("169.254.0.0/16"), netip.MustParsePrefix("172.16.0.0/12"),
	netip.MustParsePrefix("192.0.0.0/24"), netip.MustParsePrefix("192.0.2.0/24"), netip.MustParsePrefix("192.88.99.0/24"),
	netip.MustParsePrefix("192.168.0.0/16"), netip.MustParsePrefix("198.18.0.0/15"), netip.MustParsePrefix("198.51.100.0/24"),
	netip.MustParsePrefix("203.0.113.0/24"), netip.MustParsePrefix("224.0.0.0/4"), netip.MustParsePrefix("240.0.0.0/4"),
	netip.MustParsePrefix("64:ff9b::/96"), netip.MustParsePrefix("64:ff9b:1::/48"), netip.MustParsePrefix("100::/64"),
	netip.MustParsePrefix("2001::/23"), netip.MustParsePrefix("2001:db8::/32"), netip.MustParsePrefix("2002::/16"),
	netip.MustParsePrefix("3fff::/20"),
}

func isPublicMediaProxyIP(ip net.IP) bool {
	addr, ok := netip.AddrFromSlice(ip)
	if !ok {
		return false
	}
	addr = addr.Unmap()
	if !addr.IsGlobalUnicast() || addr.IsPrivate() || addr.IsLoopback() || addr.IsLinkLocalUnicast() || addr.IsLinkLocalMulticast() || addr.IsMulticast() || addr.IsUnspecified() {
		return false
	}
	if addr.Is6() && !netip.MustParsePrefix("2000::/3").Contains(addr) {
		return false
	}
	for _, prefix := range blockedMediaProxyPrefixes {
		if prefix.Contains(addr) {
			return false
		}
	}
	return true
}

// postMediaProxyImageHandler implements POST /api/media/proxy-image.
// Authenticated learner route with CSRF protection.
func postMediaProxyImageHandler(db *pgxpool.Pool, bucket *blob.Bucket, logger *slog.Logger) http.HandlerFunc {
	return postMediaProxyImageHandlerWithResolver(db, bucket, logger, net.DefaultResolver, nil)
}

func postMediaProxyImageHandlerWithResolver(db *pgxpool.Pool, bucket *blob.Bucket, logger *slog.Logger, resolver mediaProxyResolver, testTransport http.RoundTripper) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			URL     string `json:"url"`
			Source  string `json:"source"`
			AltText string `json:"altText"`
		}
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8<<10)).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		target, err := url.ParseRequestURI(strings.TrimSpace(req.URL))
		if err != nil || target.Opaque != "" || !strings.EqualFold(target.Scheme, "https") || target.Hostname() == "" || target.User != nil || len(req.URL) > 4096 || len(req.Source) > 64 || len([]rune(req.AltText)) > 500 {
			writeJSONError(w, "invalid image URL", http.StatusBadRequest)
			return
		}
		host := strings.TrimSuffix(strings.ToLower(target.Hostname()), ".")
		if net.ParseIP(host) != nil || !strings.Contains(host, ".") || strings.HasSuffix(host, ".localhost") || strings.HasSuffix(host, ".local") || strings.HasSuffix(host, ".internal") || strings.HasSuffix(host, ".home.arpa") || (target.Port() != "" && target.Port() != "443") {
			writeJSONError(w, "invalid image URL", http.StatusBadRequest)
			return
		}
		if db == nil || bucket == nil {
			writeJSONError(w, "media storage unavailable", http.StatusServiceUnavailable)
			return
		}
		fetchCtx, cancelFetch := context.WithTimeout(r.Context(), 12*time.Second)
		defer cancelFetch()
		ips, err := resolver.LookupIPAddr(fetchCtx, host)
		if err != nil || len(ips) == 0 {
			writeJSONError(w, "image source unavailable", http.StatusServiceUnavailable)
			return
		}
		for _, candidate := range ips {
			if !isPublicMediaProxyIP(candidate.IP) {
				writeJSONError(w, "image host is not publicly routable", http.StatusForbidden)
				return
			}
		}
		port := target.Port()
		if port == "" {
			port = "443"
		}
		transport := testTransport
		var productionTransport *http.Transport
		if transport == nil {
			productionTransport = &http.Transport{Proxy: nil, DisableKeepAlives: true, TLSHandshakeTimeout: 5 * time.Second, ResponseHeaderTimeout: 8 * time.Second}
			productionTransport.DialContext = func(ctx context.Context, network, _ string) (net.Conn, error) {
				var lastErr error
				for _, candidate := range ips {
					conn, dialErr := (&net.Dialer{Timeout: 5 * time.Second}).DialContext(ctx, network, net.JoinHostPort(candidate.IP.String(), port))
					if dialErr == nil {
						return conn, nil
					}
					lastErr = dialErr
				}
				return nil, lastErr
			}
			transport = productionTransport
		}
		client := &http.Client{Transport: transport, Timeout: 12 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
		if productionTransport != nil {
			defer productionTransport.CloseIdleConnections()
		}
		upstreamRequest, err := http.NewRequestWithContext(fetchCtx, http.MethodGet, target.String(), nil)
		if err != nil {
			writeJSONError(w, "invalid image URL", http.StatusBadRequest)
			return
		}
		upstreamRequest.Header.Set("Accept", "image/png,image/jpeg,image/gif,image/webp")
		response, err := client.Do(upstreamRequest)
		if err != nil {
			logger.Warn("fetch proxied image failed", "host", host, "error", err)
			writeJSONError(w, "unable to fetch image", http.StatusBadGateway)
			return
		}
		defer response.Body.Close()
		if response.StatusCode < 200 || response.StatusCode >= 300 {
			writeJSONError(w, "image source returned an unsuccessful response", http.StatusBadGateway)
			return
		}
		if response.ContentLength > localPresignedUploadMaxBytes {
			writeJSONError(w, "image too large", http.StatusRequestEntityTooLarge)
			return
		}
		content, err := io.ReadAll(io.LimitReader(response.Body, localPresignedUploadMaxBytes+1))
		if err != nil || len(content) == 0 {
			writeJSONError(w, "unable to read image", http.StatusBadGateway)
			return
		}
		if len(content) > localPresignedUploadMaxBytes {
			writeJSONError(w, "image too large", http.StatusRequestEntityTooLarge)
			return
		}
		declaredType, _, parseErr := mime.ParseMediaType(response.Header.Get("Content-Type"))
		sniffedType := http.DetectContentType(content[:min(len(content), 512)])
		if parseErr != nil || !isSupportedUploadImage(declaredType) || declaredType != sniffedType {
			writeJSONError(w, "unsupported or mismatched image content type", http.StatusUnsupportedMediaType)
			return
		}
		safeSourceURL := "https://" + host
		provenance, _ := json.Marshal(map[string]any{"source": strings.TrimSpace(req.Source), "sourceHost": host, "sourceType": "external_proxy", "proxiedBy": identity.UserID, "proxiedAt": time.Now().UTC().Format(time.RFC3339)})
		accessibility, _ := json.Marshal(map[string]string{"altText": strings.TrimSpace(req.AltText)})
		tx, err := db.Begin(fetchCtx)
		if err != nil {
			logger.Error("begin proxied media asset", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(r.Context())
		var assetID string
		err = tx.QueryRow(fetchCtx, `INSERT INTO media.asset (owner_user_id, object_key, mime_type, byte_size, provider, source_url, provenance, accessibility, rights_status, status, updated_at) VALUES ($1, gen_random_uuid()::text, $2, $3, 'external_proxy', $4, $5::jsonb, $6::jsonb, 'pending_review', 'pending_review', now()) RETURNING id`, identity.UserID, declaredType, len(content), safeSourceURL, provenance, accessibility).Scan(&assetID)
		if err == nil {
			_, err = tx.Exec(fetchCtx, `UPDATE media.asset SET object_key=$1 WHERE id=$1`, assetID)
		}
		if err != nil {
			logger.Error("create proxied media asset", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := bucket.WriteAll(fetchCtx, assetID, content, nil); err != nil {
			_ = bucket.Delete(context.Background(), assetID)
			logger.Error("store proxied media image", "error", err, "asset_id", assetID)
			writeJSONError(w, "media storage failed", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(fetchCtx); err != nil {
			// Keep the blob on an ambiguous commit result; deleting it can break a committed row.
			logger.Error("commit proxied media asset", "error", err, "asset_id", assetID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(map[string]string{"assetId": assetID})
	}
}

// postMediaPresignUploadHandler implements POST /api/media/presign-upload.
// Authenticated learner route with CSRF protection.
func postMediaPresignUploadHandler(db *pgxpool.Pool, bucket *blob.Bucket, rateLimiter *authn.RateLimiter, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			Filename    string `json:"fileName"`
			ContentType string `json:"mimeType"`
		}
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16<<10)).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		filename := filepath.Base(strings.TrimSpace(strings.ReplaceAll(req.Filename, "\\", "/")))
		contentType, _, parseErr := mime.ParseMediaType(req.ContentType)
		if filename == "." || filename == "" || len(filename) > 255 || parseErr != nil || !isSupportedUploadImage(contentType) {
			writeJSONError(w, "valid image filename and supported image MIME type are required", http.StatusBadRequest)
			return
		}
		if db == nil || bucket == nil || rateLimiter == nil {
			writeJSONError(w, "service unavailable", http.StatusServiceUnavailable)
			return
		}
		if allowed, err := rateLimiter.Allow("ip:media-presign:" + requestClientIP(r)); err != nil || !allowed {
			writeJSONError(w, "too many requests", http.StatusTooManyRequests)
			return
		}
		secretBytes := make([]byte, 32)
		if _, err := rand.Read(secretBytes); err != nil {
			logger.Error("generate media upload signature", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		signature := base64.RawURLEncoding.EncodeToString(secretBytes)
		signatureHash := sha256.Sum256([]byte(signature))
		expiresAt := time.Now().Add(15 * time.Minute).Unix()
		provenance, _ := json.Marshal(map[string]any{
			"originalFilename":    filename,
			"uploadExpiresAt":     expiresAt,
			"uploadSignatureHash": hex.EncodeToString(signatureHash[:]),
		})
		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin media presign transaction", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(r.Context())
		var assetID string
		err = tx.QueryRow(r.Context(), `
			INSERT INTO media.asset (owner_user_id, object_key, mime_type, status, provenance, updated_at)
			VALUES ($1, gen_random_uuid()::text, $2, 'pending_upload', $3::jsonb, now()) RETURNING id`,
			identity.UserID, contentType, provenance).Scan(&assetID)
		if err == nil {
			_, err = tx.Exec(r.Context(), `UPDATE media.asset SET object_key=$1 WHERE id=$1`, assetID)
		}
		if err != nil {
			logger.Error("create pending media asset", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			logger.Error("commit media presign", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"assetId":     assetID,
			"uploadUrl":   "/api/media/upload/" + assetID,
			"uploadToken": signature,
			"expiresAt":   time.Unix(expiresAt, 0).UTC(),
		})
	}
}

// postMediaCompleteUploadHandler implements POST /api/media/complete-upload.
// Authenticated learner route with CSRF protection.
func postMediaCompleteUploadHandler(db *pgxpool.Pool, bucket *blob.Bucket, rateLimiter *authn.RateLimiter, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			AssetID  string `json:"assetId"`
			ByteSize int64  `json:"byteSize"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if !isValidUUID(req.AssetID) || req.ByteSize < 1 || req.ByteSize > localPresignedUploadMaxBytes {
			writeJSONError(w, "valid assetId and byteSize are required", http.StatusBadRequest)
			return
		}
		if db == nil || bucket == nil {
			writeJSONError(w, "service unavailable", http.StatusServiceUnavailable)
			return
		}
		if rateLimiter == nil {
			writeJSONError(w, "service unavailable", http.StatusServiceUnavailable)
			return
		}
		if allowed, err := rateLimiter.Allow("ip:media-complete:" + requestClientIP(r)); err != nil || !allowed {
			writeJSONError(w, "too many requests", http.StatusTooManyRequests)
			return
		}
		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin media completion transaction", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(r.Context())
		var ownerID, objectKey, contentType, status string
		var byteSize *int64
		var provenance []byte
		err = tx.QueryRow(r.Context(), `SELECT owner_user_id::text, object_key, mime_type, byte_size, status, provenance FROM media.asset WHERE id=$1 FOR UPDATE`, req.AssetID).
			Scan(&ownerID, &objectKey, &contentType, &byteSize, &status, &provenance)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "upload not found", http.StatusNotFound)
			return
		}
		if err != nil {
			logger.Error("load media completion", "error", err, "asset_id", req.AssetID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if ownerID != identity.UserID {
			writeJSONError(w, "upload not found", http.StatusNotFound)
			return
		}
		var signed localUploadProvenance
		if err := json.Unmarshal(provenance, &signed); err != nil {
			logger.Error("decode media upload provenance", "error", err, "asset_id", req.AssetID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if status != "uploaded" || signed.UploadExpiresAt <= time.Now().Unix() {
			writeJSONError(w, "upload missing or expired", http.StatusConflict)
			return
		}
		attrs, err := bucket.Attributes(r.Context(), objectKey)
		if err != nil {
			writeJSONError(w, "uploaded blob not found", http.StatusConflict)
			return
		}
		if byteSize == nil || *byteSize != req.ByteSize || attrs.Size != req.ByteSize || attrs.ContentType != contentType {
			writeJSONError(w, "uploaded blob metadata mismatch", http.StatusBadRequest)
			return
		}
		_, err = tx.Exec(r.Context(), `UPDATE media.asset SET status='active', original_filename=$1, provenance=provenance-'uploadSignatureHash'-'uploadExpiresAt', updated_at=now() WHERE id=$2 AND owner_user_id=$3`, signed.OriginalFilename, req.AssetID, identity.UserID)
		if err != nil {
			logger.Error("activate completed media upload", "error", err, "asset_id", req.AssetID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			logger.Error("commit media completion", "error", err, "asset_id", req.AssetID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"url": "/api/media/" + req.AssetID + "/stream", "status": "completed"})
	}
}

const localPresignedUploadMaxBytes = 10 << 20

type localUploadProvenance struct {
	OriginalFilename    string `json:"originalFilename"`
	UploadExpiresAt     int64  `json:"uploadExpiresAt"`
	UploadSignatureHash string `json:"uploadSignatureHash"`
}

func isSupportedUploadImage(contentType string) bool {
	switch contentType {
	case "image/png", "image/jpeg", "image/gif", "image/webp":
		return true
	default:
		return false
	}
}

func putPresignedMediaUploadHandler(db *pgxpool.Pool, bucket *blob.Bucket, rateLimiter *authn.RateLimiter, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := chi.URLParam(r, "id")
		signature := r.Header.Get("X-Media-Upload-Token")
		if !isValidUUID(id) || signature == "" {
			writeJSONError(w, "invalid upload token", http.StatusForbidden)
			return
		}
		if r.ContentLength > localPresignedUploadMaxBytes {
			writeJSONError(w, "file too large", http.StatusRequestEntityTooLarge)
			return
		}
		content, err := io.ReadAll(http.MaxBytesReader(w, r.Body, localPresignedUploadMaxBytes))
		if err != nil {
			writeJSONError(w, "file too large or unreadable", http.StatusRequestEntityTooLarge)
			return
		}
		if len(content) == 0 {
			writeJSONError(w, "empty upload", http.StatusBadRequest)
			return
		}
		declaredType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
		if err != nil || !isSupportedUploadImage(declaredType) || http.DetectContentType(content[:min(len(content), 512)]) != declaredType {
			writeJSONError(w, "image content type mismatch", http.StatusBadRequest)
			return
		}
		if db == nil || bucket == nil || rateLimiter == nil {
			writeJSONError(w, "service unavailable", http.StatusServiceUnavailable)
			return
		}
		if allowed, err := rateLimiter.Allow("ip:media-put:" + requestClientIP(r)); err != nil || !allowed {
			writeJSONError(w, "too many requests", http.StatusTooManyRequests)
			return
		}
		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin local media upload", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(r.Context())
		var ownerID, objectKey, contentType, status string
		var provenance []byte
		err = tx.QueryRow(r.Context(), `SELECT owner_user_id::text, object_key, mime_type, status, provenance FROM media.asset WHERE id=$1 FOR UPDATE`, id).
			Scan(&ownerID, &objectKey, &contentType, &status, &provenance)
		if errors.Is(err, pgx.ErrNoRows) || ownerID != identity.UserID {
			writeJSONError(w, "upload not found", http.StatusNotFound)
			return
		}
		if err != nil {
			logger.Error("load local media upload", "error", err, "asset_id", id)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		var signed localUploadProvenance
		if err := json.Unmarshal(provenance, &signed); err != nil {
			writeJSONError(w, "invalid upload state", http.StatusConflict)
			return
		}
		providedHash := sha256.Sum256([]byte(signature))
		storedHash, _ := hex.DecodeString(signed.UploadSignatureHash)
		if status != "pending_upload" || contentType != declaredType || signed.UploadExpiresAt <= time.Now().Unix() || len(storedHash) != len(providedHash) || subtle.ConstantTimeCompare(storedHash, providedHash[:]) != 1 {
			writeJSONError(w, "invalid or expired upload signature", http.StatusForbidden)
			return
		}
		writer, err := bucket.NewWriter(r.Context(), objectKey, &blob.WriterOptions{ContentType: contentType})
		if err != nil {
			logger.Error("open local media upload writer", "error", err, "asset_id", id)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if _, err := writer.Write(content); err != nil {
			_ = writer.Close()
			_ = bucket.Delete(r.Context(), objectKey)
			logger.Error("write local media upload", "error", err, "asset_id", id)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := writer.Close(); err != nil {
			_ = bucket.Delete(r.Context(), objectKey)
			logger.Error("close local media upload", "error", err, "asset_id", id)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		_, err = tx.Exec(r.Context(), `UPDATE media.asset SET byte_size=$1, status='uploaded', updated_at=now() WHERE id=$2 AND status='pending_upload'`, len(content), id)
		if err != nil {
			_ = bucket.Delete(r.Context(), objectKey)
			logger.Error("save local media upload state", "error", err, "asset_id", id)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			_ = bucket.Delete(r.Context(), objectKey)
			logger.Error("commit local media upload", "error", err, "asset_id", id)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusCreated)
	}
}

// ── Ads ─────────────────────────────────────────────────────────────────────

// postAdsImpressionHandler implements POST /api/ads/impression.
// Public route.
func postAdsImpressionHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req map[string]interface{}
		_ = json.NewDecoder(r.Body).Decode(&req)
		payloadJSON, _ := json.Marshal(req)
		const insertQ = `INSERT INTO ads.impression (payload, created_at) VALUES ($1, NOW())`
		if _, err := db.Exec(r.Context(), insertQ, payloadJSON); err != nil {
			logger.Error("record ad impression", "error", err)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]bool{"recorded": true})
	}
}

// postAdsClickHandler implements POST /api/ads/click.
// Public route.
func postAdsClickHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req map[string]interface{}
		_ = json.NewDecoder(r.Body).Decode(&req)
		payloadJSON, _ := json.Marshal(req)
		const insertQ = `INSERT INTO ads.click (payload, created_at) VALUES ($1, NOW())`
		if _, err := db.Exec(r.Context(), insertQ, payloadJSON); err != nil {
			logger.Error("record ad click", "error", err)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]bool{"recorded": true})
	}
}

// ── Push Notifications ──────────────────────────────────────────────────────

// postPushSubscribeHandler implements POST /api/notifications/push/subscribe.
// Authenticated learner route with CSRF protection.
func postPushSubscribeHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			Endpoint     string `json:"endpoint"`
			P256dh       string `json:"p256dh"`
			Auth         string `json:"auth"`
			Subscription struct {
				Endpoint string `json:"endpoint"`
				Keys     struct {
					P256dh string `json:"p256dh"`
					Auth   string `json:"auth"`
				} `json:"keys"`
			} `json:"subscription"`
		}
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16<<10)).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.Subscription.Endpoint != "" {
			req.Endpoint, req.P256dh, req.Auth = req.Subscription.Endpoint, req.Subscription.Keys.P256dh, req.Subscription.Keys.Auth
		}
		req.Endpoint = strings.TrimSpace(req.Endpoint)
		endpointURL, endpointErr := url.ParseRequestURI(req.Endpoint)
		if endpointErr != nil || endpointURL.Scheme != "https" || endpointURL.Hostname() == "" || endpointURL.User != nil || len(req.Endpoint) > 2048 || strings.TrimSpace(req.P256dh) == "" || strings.TrimSpace(req.Auth) == "" || len(req.P256dh) > 255 || len(req.Auth) > 255 {
			writeJSONError(w, "valid push endpoint and keys are required", http.StatusBadRequest)
			return
		}
		const upsertQ = `INSERT INTO ops.push_subscription (user_id, endpoint, p256dh, auth)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (user_id, endpoint) DO UPDATE SET p256dh = $3, auth = $4`
		if _, err := db.Exec(r.Context(), upsertQ, identity.UserID, req.Endpoint, req.P256dh, req.Auth); err != nil {
			logger.Error("push subscribe", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]bool{"subscribed": true})
	}
}

// deletePushSubscribeHandler implements DELETE /api/notifications/push/subscribe.
// Authenticated learner route with CSRF protection.
func deletePushSubscribeHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		endpoint := r.URL.Query().Get("endpoint")
		if endpoint == "" && r.Body != nil {
			var req struct {
				Endpoint string `json:"endpoint"`
			}
			if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16<<10)).Decode(&req); err != nil {
				writeJSONError(w, "invalid request body", http.StatusBadRequest)
				return
			}
			endpoint = strings.TrimSpace(req.Endpoint)
		}
		if endpoint == "" {
			writeJSONError(w, "endpoint required", http.StatusBadRequest)
			return
		}
		const delQ = `DELETE FROM ops.push_subscription WHERE user_id = $1 AND endpoint = $2`
		if _, err := db.Exec(r.Context(), delQ, identity.UserID, endpoint); err != nil {
			logger.Error("push unsubscribe", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]bool{"unsubscribed": true})
	}
}

// ── Recommendation ──────────────────────────────────────────────────────────

// getStudyFeedHandler implements GET /api/recommendation/study-feed.
// Authenticated learner route.
func getStudyFeedHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		started := time.Now()
		limit := 8
		if values, present := r.URL.Query()["limit"]; present {
			if len(values) != 1 {
				writeJSONError(w, "invalid limit", http.StatusBadRequest)
				return
			}
			parsed, err := strconv.Atoi(values[0])
			if err != nil || parsed < 1 || parsed > 100 {
				writeJSONError(w, "invalid limit", http.StatusBadRequest)
				return
			}
			limit = parsed
		}
		type FeedItem struct {
			ID       string            `json:"id"`
			Type     string            `json:"type"`
			Title    string            `json:"title"`
			Score    float64           `json:"score"`
			Source   string            `json:"source"`
			Metadata map[string]string `json:"metadata"`
		}
		// Legacy lessons use active as their public status and may lack published_at.
		const q = `SELECT id::text, title_vi, slug, level_code, COUNT(*) OVER ()
			FROM curriculum.bjt_lesson
			WHERE status IN ('active', 'published')
				AND (published_at IS NULL OR published_at <= NOW())
			ORDER BY level_code, sort_order, id
			LIMIT $1`
		rows, err := db.Query(r.Context(), q, limit)
		if err != nil {
			logger.Error("query study feed", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		items := make([]FeedItem, 0, limit)
		totalSourced := 0
		for rows.Next() {
			item := FeedItem{Type: "lesson", Score: 1, Source: "PublishedLessons"}
			var slug, levelCode string
			if err := rows.Scan(&item.ID, &item.Title, &slug, &levelCode, &totalSourced); err != nil {
				logger.Error("scan study feed", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			item.Metadata = map[string]string{"slug": slug, "levelCode": levelCode}
			items = append(items, item)
		}
		if err := rows.Err(); err != nil {
			logger.Error("read study feed", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"items": items,
			"meta": map[string]interface{}{
				"pipeline":      "published-lessons",
				"totalSourced":  totalSourced,
				"totalReturned": len(items),
				"executionMs":   float64(time.Since(started).Microseconds()) / 1000,
			},
		})
	}
}

// ── Search ──────────────────────────────────────────────────────────────────

// getSearchSuggestHandler implements GET /api/search/suggest.
// Public route.
func getSearchSuggestHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		q := strings.TrimSpace(r.URL.Query().Get("q"))
		limit := 6
		if rawLimit := r.URL.Query().Get("limit"); rawLimit != "" {
			parsed, err := strconv.Atoi(rawLimit)
			if err != nil || parsed < 1 || parsed > 20 {
				writeJSONError(w, "limit must be between 1 and 20", http.StatusBadRequest)
				return
			}
			limit = parsed
		}
		if q == "" {
			writeJSON(w, http.StatusOK, []interface{}{})
			return
		}
		type Suggestion struct {
			ID      string  `json:"id"`
			Kind    string  `json:"kind"`
			Reading *string `json:"reading"`
			Title   string  `json:"title"`
		}
		const query = `SELECT id::text, 'lexeme'::text, reading, headword FROM content.lexeme WHERE status IN ('active','published') AND (headword ILIKE $1 OR reading ILIKE $1) ORDER BY headword, id LIMIT $2`
		rows, err := db.Query(r.Context(), query, "%"+q+"%", limit)
		if err != nil {
			logger.Error("search suggest", "error", err)
			writeJSONError(w, "search suggest failed", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		var suggestions []Suggestion
		for rows.Next() {
			var s Suggestion
			if err := rows.Scan(&s.ID, &s.Kind, &s.Reading, &s.Title); err != nil {
				logger.Error("scan search suggest", "error", err)
				writeJSONError(w, "search suggest failed", http.StatusInternalServerError)
				return
			}
			suggestions = append(suggestions, s)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate search suggest", "error", err)
			writeJSONError(w, "search suggest failed", http.StatusInternalServerError)
			return
		}
		if suggestions == nil {
			suggestions = []Suggestion{}
		}
		writeJSON(w, http.StatusOK, suggestions)
	}
}

// Ensure imports are used.
var _ = strconv.Atoi
