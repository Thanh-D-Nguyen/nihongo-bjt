package httpserver

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
)

// ── Monetization ────────────────────────────────────────────────────────────

// listMonetizationPlansHandler implements GET /api/learner/monetization/plans.
// Public route — returns available subscription plans.
func listMonetizationPlansHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		const q = `SELECT id, name, price_monthly, currency, features, tier
			FROM monetization.subscription_plan
			WHERE active = true
			ORDER BY sort_order ASC, created_at ASC`
		rows, err := db.Query(r.Context(), q)
		if err != nil {
			logger.Error("list monetization plans", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type Plan struct {
			ID           string   `json:"id"`
			Name         string   `json:"name"`
			PriceMonthly int      `json:"priceMonthly"`
			Currency     string   `json:"currency"`
			Features     []string `json:"features"`
			Tier         string   `json:"tier"`
		}
		var plans []Plan
		for rows.Next() {
			var p Plan
			var featuresJSON []byte
			if err := rows.Scan(&p.ID, &p.Name, &p.PriceMonthly, &p.Currency, &featuresJSON, &p.Tier); err != nil {
				logger.Error("scan monetization plan", "error", err)
				continue
			}
			if len(featuresJSON) > 0 {
				_ = json.Unmarshal(featuresJSON, &p.Features)
			}
			if p.Features == nil {
				p.Features = []string{}
			}
			plans = append(plans, p)
		}
		if plans == nil {
			plans = []Plan{}
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(plans)
	}
}

// checkoutMonetizationHandler implements POST /api/learner/monetization/checkout.
// Authenticated learner route with CSRF protection.
func checkoutMonetizationHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			PlanID string `json:"planId"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.PlanID == "" {
			writeJSONError(w, "planId required", http.StatusBadRequest)
			return
		}
		// Create pending checkout session
		const insertQ = `INSERT INTO monetization.checkout_session (user_id, plan_id, status, created_at)
			VALUES ($1, $2, 'pending', NOW())
			RETURNING id`
		var sessionID string
		if err := db.QueryRow(r.Context(), insertQ, identity.UserID, req.PlanID).Scan(&sessionID); err != nil {
			logger.Error("create checkout session", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"sessionId": sessionID,
			"status":    "pending",
		})
	}
}

// getSubscriptionHandler implements GET /api/learner/monetization/subscription.
// Authenticated learner route.
func getSubscriptionHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		userID := r.URL.Query().Get("userId")
		if userID == "" {
			userID = identity.UserID
		}
		type Subscription struct {
			ID        string  `json:"id"`
			PlanID    string  `json:"planId"`
			Status    string  `json:"status"`
			ExpiresAt *string `json:"expiresAt,omitempty"`
		}
		const q = `SELECT id, plan_id, status, expires_at
			FROM monetization.user_subscription
			WHERE user_id = $1
			ORDER BY created_at DESC LIMIT 1`
		var sub Subscription
		var expiresAt *string
		if err := db.QueryRow(r.Context(), q, userID).Scan(&sub.ID, &sub.PlanID, &sub.Status, &expiresAt); err != nil {
			// No subscription found — return empty object
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"subscription": nil})
			return
		}
		sub.ExpiresAt = expiresAt
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"subscription": sub})
	}
}

// cancelSubscriptionHandler implements POST /api/learner/monetization/subscription/cancel.
// Authenticated learner route with CSRF protection.
func cancelSubscriptionHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		const updateQ = `UPDATE monetization.user_subscription
			SET status = 'cancelled', updated_at = NOW()
			WHERE user_id = $1 AND status = 'active'`
		if _, err := db.Exec(r.Context(), updateQ, identity.UserID); err != nil {
			logger.Error("cancel subscription", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]bool{"cancelled": true})
	}
}

// ── Reading Assist ──────────────────────────────────────────────────────────

// analyzeReadingAssistHandler implements POST /api/reading-assist/analyze.
// Authenticated learner route with CSRF protection.
func analyzeReadingAssistHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			Text          string `json:"text"`
			ExamContext   bool   `json:"examContext"`
			QuizSessionID string `json:"quizSessionId"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.Text == "" {
			writeJSONError(w, "text required", http.StatusBadRequest)
			return
		}
		// Store analysis record
		const insertQ = `INSERT INTO study.reading_assist_analysis (user_id, text_hash, exam_context, quiz_session_id, created_at)
			VALUES ($1, md5($2), $3, $4, NOW())
			ON CONFLICT DO NOTHING`
		if _, err := db.Exec(r.Context(), insertQ, identity.UserID, req.Text, req.ExamContext, req.QuizSessionID); err != nil {
			logger.Error("record reading assist analysis", "error", err)
			// Non-fatal: continue with response
		}
		// Return tokenized result placeholder (real tokenizer would be in a separate service)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"tokens":      []interface{}{},
			"examContext": req.ExamContext,
		})
	}
}

// getReadingAssistPreferencesHandler implements GET /api/reading-assist/preferences.
// Authenticated learner route.
func getReadingAssistPreferencesHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		userID := r.URL.Query().Get("userId")
		if userID == "" {
			userID = identity.UserID
		}
		type Preferences struct {
			FuriganaMode string `json:"furiganaMode"`
			FontSize     int    `json:"fontSize"`
			LineHeight   float64 `json:"lineHeight"`
		}
		const q = `SELECT furigana_mode, font_size, line_height
			FROM study.reading_assist_preference
			WHERE user_id = $1`
		var prefs Preferences
		if err := db.QueryRow(r.Context(), q, userID).Scan(&prefs.FuriganaMode, &prefs.FontSize, &prefs.LineHeight); err != nil {
			// Return defaults
			prefs = Preferences{FuriganaMode: "auto", FontSize: 16, LineHeight: 1.6}
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(prefs)
	}
}

// putReadingAssistPreferencesHandler implements PUT /api/reading-assist/preferences.
// Authenticated learner route with CSRF protection.
func putReadingAssistPreferencesHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			FuriganaMode string  `json:"furiganaMode"`
			FontSize     int     `json:"fontSize"`
			LineHeight   float64 `json:"lineHeight"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		const upsertQ = `INSERT INTO study.reading_assist_preference (user_id, furigana_mode, font_size, line_height, updated_at)
			VALUES ($1, $2, $3, $4, NOW())
			ON CONFLICT (user_id) DO UPDATE SET
				furigana_mode = EXCLUDED.furigana_mode,
				font_size = EXCLUDED.font_size,
				line_height = EXCLUDED.line_height,
				updated_at = NOW()`
		if _, err := db.Exec(r.Context(), upsertQ, identity.UserID, req.FuriganaMode, req.FontSize, req.LineHeight); err != nil {
			logger.Error("update reading assist preferences", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]bool{"updated": true})
	}
}

// postReadingAssistAnalyticsHandler implements POST /api/reading-assist/analytics.
// Authenticated learner route with CSRF protection.
func postReadingAssistAnalyticsHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
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
		payloadJSON, _ := json.Marshal(req)
		const insertQ = `INSERT INTO study.reading_assist_analytic (user_id, payload, created_at)
			VALUES ($1, $2, NOW())`
		if _, err := db.Exec(r.Context(), insertQ, identity.UserID, payloadJSON); err != nil {
			logger.Error("record reading assist analytics", "error", err)
			// Non-fatal
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]bool{"recorded": true})
	}
}

// postReadingAssistReadingsHandler implements POST /api/reading-assist/readings.
// Authenticated learner route with CSRF protection.
func postReadingAssistReadingsHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			Text string `json:"text"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.Text == "" {
			writeJSONError(w, "text required", http.StatusBadRequest)
			return
		}
		// Return readings placeholder (real reading extraction would be in a separate service)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"readings": []interface{}{},
		})
	}
}
