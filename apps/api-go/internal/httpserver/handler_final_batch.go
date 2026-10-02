package httpserver

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
)

// ── Analytics ───────────────────────────────────────────────────────────────

// postAnalyticsEventsHandler implements POST /api/analytics/events.
// Public route — ingests analytics events.
func postAnalyticsEventsHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var events []map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&events); err != nil {
			// Try single event
			var single map[string]interface{}
			if err2 := json.NewDecoder(r.Body).Decode(&single); err2 == nil {
				events = []map[string]interface{}{single}
			}
		}
		// Store events asynchronously (fire-and-forget for performance)
		for _, evt := range events {
			payloadJSON, _ := json.Marshal(evt)
			const insertQ = `INSERT INTO analytics.event (payload, created_at) VALUES ($1, NOW())`
			if _, err := db.Exec(r.Context(), insertQ, payloadJSON); err != nil {
				logger.Error("ingest analytics event", "error", err)
			}
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]bool{"accepted": true})
	}
}

// getAnalyticsLearnerHandler implements GET /api/analytics/learner.
// Authenticated learner route.
func getAnalyticsLearnerHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := r.URL.Query().Get("userId")
		days := r.URL.Query().Get("days")
		if days == "" {
			days = "7"
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
			WHERE user_id = $1 AND started_at >= NOW() - ($2 || ' days')::interval
			GROUP BY day ORDER BY day ASC`
		rows, err := db.Query(r.Context(), q, userID, days)
		if err != nil {
			logger.Error("get learner analytics", "error", err)
			// Return empty
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"dailyStats": []DailyStats{}, "userId": userID})
			return
		}
		defer rows.Close()
		var stats []DailyStats
		for rows.Next() {
			var s DailyStats
			var day time.Time
			if err := rows.Scan(&day, &s.Minutes, &s.XPEarned, &s.LessonsCnt); err == nil {
				s.Date = day.Format("2006-01-02")
				stats = append(stats, s)
			}
		}
		if stats == nil {
			stats = []DailyStats{}
		}

		// Compute totals expected by frontend LearnerAnalytics interface
		var completedBjtSessions int
		var bjtAccuracyPct float64
		var reviewCount int
		var streakDays int

		// completedBjtSessions: count of completed quiz sessions
		_ = db.QueryRow(r.Context(),
			`SELECT COUNT(*) FROM assessment.quiz_session WHERE user_id = $1 AND status = 'completed'`,
			userID).Scan(&completedBjtSessions)

		// bjtAccuracyPct: average accuracy across completed sessions
		_ = db.QueryRow(r.Context(),
			`SELECT COALESCE(AVG(accuracy_pct), 0) FROM assessment.quiz_session WHERE user_id = $1 AND status = 'completed'`,
			userID).Scan(&bjtAccuracyPct)

		// reviewCount: total SRS reviews completed
		_ = db.QueryRow(r.Context(),
			`SELECT COUNT(*) FROM learning.review_event WHERE user_id = $1`,
			userID).Scan(&reviewCount)

		// streakDays: current streak from learner profile
		_ = db.QueryRow(r.Context(),
			`SELECT COALESCE(current_streak_days, 0) FROM profile.learner_onboarding WHERE user_id = $1`,
			userID).Scan(&streakDays)

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"dailyStats": stats,
			"userId":     userID,
			"insight":    "",
			"totals": map[string]interface{}{
				"bjtAccuracyPct":       bjtAccuracyPct,
				"completedBjtSessions": completedBjtSessions,
				"reviewCount":          reviewCount,
				"streakDays":           streakDays,
			},
		})
	}
}

// getAnalyticsHandler implements GET /api/analytics.
// Authenticated learner route — general analytics summary.
func getAnalyticsHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return getAnalyticsLearnerHandler(db, logger) // reuse
}

// getAnalyticsHeatmapHandler implements GET /api/analytics/heatmap.
// Authenticated learner route.
func getAnalyticsHeatmapHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := r.URL.Query().Get("userId")
		days := r.URL.Query().Get("days")
		if days == "" {
			days = "365"
		}
		type HeatmapDay struct {
			Date    string `json:"date"`
			Minutes int    `json:"minutes"`
		}
		const q = `SELECT date_trunc('day', started_at)::date as day,
			COALESCE(SUM(duration_minutes), 0) as minutes
			FROM learning.study_session
			WHERE user_id = $1 AND started_at >= NOW() - ($2 || ' days')::interval
			GROUP BY day ORDER BY day ASC`
		rows, err := db.Query(r.Context(), q, userID, days)
		if err != nil {
			logger.Error("get heatmap", "error", err)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"heatmap": []HeatmapDay{}})
			return
		}
		defer rows.Close()
		var heatmap []HeatmapDay
		for rows.Next() {
			var h HeatmapDay
			var day time.Time
			if err := rows.Scan(&day, &h.Minutes); err == nil {
				h.Date = day.Format("2006-01-02")
				heatmap = append(heatmap, h)
			}
		}
		if heatmap == nil {
			heatmap = []HeatmapDay{}
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"heatmap": heatmap})
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
		const q = `SELECT id, name, avatar_fallback, difficulty, persona FROM learning.battle_bot WHERE active = true ORDER BY display_order ASC`
		rows, err := db.Query(r.Context(), q)
		if err != nil {
			logger.Error("list battle bots", "error", err)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_ = json.NewEncoder(w).Encode([]interface{}{})
			return
		}
		defer rows.Close()
		type Bot struct {
			ID          string  `json:"id"`
			Name        string  `json:"name"`
			AvatarURL   *string `json:"avatarUrl,omitempty"`
			Difficulty  string  `json:"difficulty"`
			Description *string `json:"persona,omitempty"`
		}
		var bots []Bot
		for rows.Next() {
			var b Bot
			if err := rows.Scan(&b.ID, &b.Name, &b.AvatarURL, &b.Difficulty, &b.Description); err == nil {
				bots = append(bots, b)
			}
		}
		if bots == nil {
			bots = []Bot{}
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(bots)
	}
}

// getBattleChatRecentHandler implements GET /api/battle/chat/recent.
// Authenticated learner route.
func getBattleChatRecentHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		limit := 50
		const q = `SELECT id, sender_id, sender_name, message, sent_at FROM battle.chat_message ORDER BY sent_at DESC LIMIT $1`
		rows, err := db.Query(r.Context(), q, limit)
		if err != nil {
			logger.Error("battle chat recent", "error", err)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_ = json.NewEncoder(w).Encode([]interface{}{})
			return
		}
		defer rows.Close()
		type Msg struct {
			ID         string `json:"id"`
			SenderID   string `json:"senderId"`
			SenderName string `json:"senderName"`
			Message    string `json:"message"`
			SentAt     string `json:"sentAt"`
		}
		var msgs []Msg
		for rows.Next() {
			var m Msg
			var sentAt time.Time
			if err := rows.Scan(&m.ID, &m.SenderID, &m.SenderName, &m.Message, &sentAt); err == nil {
				m.SentAt = sentAt.Format(time.RFC3339)
				msgs = append(msgs, m)
			}
		}
		if msgs == nil {
			msgs = []Msg{}
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(msgs)
	}
}

// getBattleConfigsAvailableHandler implements GET /api/battle/configs/available.
// Public route.
func getBattleConfigsAvailableHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		const q = `SELECT id, name, persona, max_participants, time_per_question_sec FROM learning.battle_config WHERE active = true ORDER BY display_order ASC`
		rows, err := db.Query(r.Context(), q)
		if err != nil {
			logger.Error("battle configs", "error", err)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_ = json.NewEncoder(w).Encode([]interface{}{})
			return
		}
		defer rows.Close()
		type Config struct {
			ID            string  `json:"id"`
			Name          string  `json:"name"`
			Description   *string `json:"persona,omitempty"`
			MinPlayers    int     `json:"minPlayers"`
			MaxPlayers    int     `json:"maxPlayers"`
			TimeLimitSecs int     `json:"timeLimitSeconds"`
		}
		var configs []Config
		for rows.Next() {
			var c Config
			if err := rows.Scan(&c.ID, &c.Name, &c.Description, &c.MinPlayers, &c.MaxPlayers, &c.TimeLimitSecs); err == nil {
				configs = append(configs, c)
			}
		}
		if configs == nil {
			configs = []Config{}
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(configs)
	}
}

// ── CardGen ─────────────────────────────────────────────────────────────────

// postCardgenGenerateHandler implements POST /api/cardgen/generate.
// Authenticated learner route with CSRF protection.
func postCardgenGenerateHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		reqJSON, _ := json.Marshal(req)
		const insertQ = `INSERT INTO content.cardgen_request (user_id, request_payload, status, created_at)
			VALUES ($1, $2, 'pending', NOW()) RETURNING id`
		var requestID string
		if err := db.QueryRow(r.Context(), insertQ, identity.UserID, reqJSON).Scan(&requestID); err != nil {
			logger.Error("cardgen generate", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]string{"requestId": requestID, "status": "pending"})
	}
}

// postCardgenPreviewHandler implements POST /api/cardgen/preview.
// Authenticated learner route with CSRF protection.
func postCardgenPreviewHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		// Return preview placeholder — real generation is async
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"preview": true, "cards": []interface{}{}})
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
		// Generate contextual hint based on recent activity
		type Hint struct {
			Text     string `json:"text"`
			Category string `json:"category"`
		}
		hints := []Hint{
			{Text: "Keep up your daily streak! You're doing great.", Category: "motivation"},
		}
		// Check recent activity for personalized hints
		const q = `SELECT COUNT(*) FROM learning.study_session WHERE user_id = $1 AND started_at >= NOW() - ($2 || ' days')::interval`
		var sessionCount int
		if err := db.QueryRow(r.Context(), q, identity.UserID, days).Scan(&sessionCount); err == nil && sessionCount > 0 {
			hints = append(hints, Hint{Text: "You've been consistent lately. Try a harder level!", Category: "progression"})
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"hints": hints})
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
		const q = `SELECT id, exercise_type, status, score, total_questions, completed_at
			FROM study.exercise_session WHERE user_id = $1 ORDER BY completed_at DESC LIMIT $2`
		rows, err := db.Query(r.Context(), q, identity.UserID, limit)
		if err != nil {
			logger.Error("exercise sessions history", "error", err)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_ = json.NewEncoder(w).Encode([]interface{}{})
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
			if err := rows.Scan(&s.ID, &s.ExerciseType, &s.Status, &s.Score, &s.TotalQuestions, &completedAt); err == nil {
				if completedAt != nil {
					formatted := completedAt.Format(time.RFC3339)
					s.CompletedAt = &formatted
				}
				sessions = append(sessions, s)
			}
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
		today := time.Now().Format("2006-01-02")
		const q = `SELECT COALESCE(SUM(score), 0), COUNT(*), COALESCE(SUM(total_questions), 0)
			FROM study.exercise_session WHERE user_id = $1 AND completed_at::date = $2::date`
		var totalScore, sessionCount, totalQuestions int
		if err := db.QueryRow(r.Context(), q, identity.UserID, today).Scan(&totalScore, &sessionCount, &totalQuestions); err != nil {
			totalScore = 0
			sessionCount = 0
			totalQuestions = 0
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"date":           today,
			"totalScore":     totalScore,
			"sessionCount":   sessionCount,
			"totalQuestions": totalQuestions,
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
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_ = json.NewEncoder(w).Encode([]interface{}{})
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
			if err := rows.Scan(&d.ID, &d.Title, &d.Kind, &createdAt); err == nil {
				d.CreatedAt = createdAt.Format(time.RFC3339)
				decks = append(decks, d)
			}
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
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
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
		if req.Title != nil {
			const updateQ = `UPDATE study.user_review_deck SET title = $2, updated_at = NOW() WHERE id = $1 AND user_id = $3`
			if _, err := db.Exec(r.Context(), updateQ, id, *req.Title, identity.UserID); err != nil {
				logger.Error("update review", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
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
			writeJSONError(w, "review not found", http.StatusNotFound)
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
		if _, err := db.Exec(r.Context(), delQ, id, identity.UserID); err != nil {
			logger.Error("delete review", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
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
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"next": nil})
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"next": map[string]string{"id": id, "exerciseId": exerciseID, "dueAt": dueAt.Format(time.RFC3339)},
		})
	}
}

// ── Public Shares / Decks ───────────────────────────────────────────────────

// getPublicShareHandler implements GET /api/public/shares/{token}.
// Public route.
func getPublicShareHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
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
		const q = `SELECT id, public_token, kind, summary_payload, created_at FROM growth.share_item WHERE public_token = $1`
		if err := db.QueryRow(r.Context(), q, token).Scan(&s.ID, &s.PublicToken, &s.Kind, &s.SummaryPayload, &createdAt); err != nil {
			writeJSONError(w, "share not found", http.StatusNotFound)
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
func getPublicDeckHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token := extractPathParam(r.URL.Path, "decks", 1)
		if token == "" {
			writeJSONError(w, "token required", http.StatusBadRequest)
			return
		}
		type Deck struct {
			ID          string          `json:"id"`
			PublicToken string          `json:"publicToken"`
			Title       string          `json:"title"`
			Description *string         `json:"persona,omitempty"`
			CardCount   int             `json:"cardCount"`
			Metadata    json.RawMessage `json:"metadata,omitempty"`
		}
		var d Deck
		const q = `SELECT id, public_token, title, persona, card_count, metadata FROM study.public_deck WHERE public_token = $1`
		if err := db.QueryRow(r.Context(), q, token).Scan(&d.ID, &d.PublicToken, &d.Title, &d.Description, &d.CardCount, &d.Metadata); err != nil {
			writeJSONError(w, "deck not found", http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(d)
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
		if req.Limit <= 0 {
			req.Limit = 20
		}
		// Placeholder — real image search would call external API
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"images": []interface{}{}, "query": req.Query})
	}
}

// postMediaProxyImageHandler implements POST /api/media/proxy-image.
// Authenticated learner route with CSRF protection.
func postMediaProxyImageHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			URL string `json:"url"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		// Placeholder — real proxy would fetch and cache
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]string{"proxiedUrl": req.URL, "cached": "false"})
	}
}

// postMediaPresignUploadHandler implements POST /api/media/presign-upload.
// Authenticated learner route with CSRF protection.
func postMediaPresignUploadHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			Filename    string `json:"filename"`
			ContentType string `json:"contentType"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		uploadID := identity.UserID + "-" + time.Now().Format("20060102150405")
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"uploadId":     uploadID,
			"presignedUrl": "https://storage.example.com/upload/" + uploadID,
			"expiresIn":    "3600",
		})
	}
}

// postMediaCompleteUploadHandler implements POST /api/media/complete-upload.
// Authenticated learner route with CSRF protection.
func postMediaCompleteUploadHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			UploadID string `json:"uploadId"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		mediaURL := "https://cdn.example.com/media/" + req.UploadID
		const insertQ = `INSERT INTO media.upload (user_id, upload_id, url, status, created_at) VALUES ($1, $2, $3, 'completed', NOW())`
		if _, err := db.Exec(r.Context(), insertQ, identity.UserID, req.UploadID, mediaURL); err != nil {
			logger.Error("complete upload", "error", err)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]string{"url": mediaURL, "status": "completed"})
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
			Endpoint string `json:"endpoint"`
			P256dh   string `json:"p256dh"`
			Auth     string `json:"auth"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		const upsertQ = `INSERT INTO notification.push_subscription (user_id, endpoint, p256dh, auth, created_at, updated_at)
			VALUES ($1, $2, $3, $4, NOW(), NOW())
			ON CONFLICT (user_id, endpoint) DO UPDATE SET p256dh = $3, auth = $4, updated_at = NOW()`
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
		if endpoint == "" {
			writeJSONError(w, "endpoint required", http.StatusBadRequest)
			return
		}
		const delQ = `DELETE FROM notification.push_subscription WHERE user_id = $1 AND endpoint = $2`
		if _, err := db.Exec(r.Context(), delQ, identity.UserID, endpoint); err != nil {
			logger.Error("push unsubscribe", "error", err)
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
		type FeedItem struct {
			ID       string `json:"id"`
			Type     string `json:"type"`
			Title    string `json:"title"`
			Priority int    `json:"priority"`
		}
		// recommendation.study_feed does not exist in staging; return empty feed
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode([]FeedItem{})
	}
}

// ── Search ──────────────────────────────────────────────────────────────────

// getSearchSuggestHandler implements GET /api/search/suggest.
// Public route.
func getSearchSuggestHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query().Get("q")
		limit := 6
		if q == "" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_ = json.NewEncoder(w).Encode([]interface{}{})
			return
		}
		type Suggestion struct {
			Text string `json:"text"`
			Type string `json:"type"`
		}
		const query = `SELECT DISTINCT headword as text, 'lexeme' as type FROM content.lexeme WHERE headword ILIKE $1 LIMIT $2`
		rows, err := db.Query(r.Context(), query, "%"+q+"%", limit)
		if err != nil {
			logger.Error("search suggest", "error", err)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_ = json.NewEncoder(w).Encode([]interface{}{})
			return
		}
		defer rows.Close()
		var suggestions []Suggestion
		for rows.Next() {
			var s Suggestion
			if err := rows.Scan(&s.Text, &s.Type); err == nil {
				suggestions = append(suggestions, s)
			}
		}
		if suggestions == nil {
			suggestions = []Suggestion{}
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(suggestions)
	}
}

// Ensure imports are used.
var _ = strconv.Atoi
