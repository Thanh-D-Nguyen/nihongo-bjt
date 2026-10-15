package httpserver

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"unicode"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
)

// ── Monetization ────────────────────────────────────────────────────────────

// listMonetizationPlansHandler implements GET /api/learner/monetization/plans.
// Public route — returns available subscription plans.
func listMonetizationPlansHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		const q = `SELECT p.id, p.slug, p.name_key, p.status, p.sort_order, p.config,
			COALESCE((SELECT json_agg(ed.key ORDER BY ed.key)
				FROM monetization.plan_entitlement pe
				JOIN monetization.entitlement_definition ed ON ed.id = pe.entitlement_id
				WHERE pe.plan_id = p.id), '[]'::json),
			COALESCE((SELECT json_agg(json_build_object('key', qp.key, 'limit', pq.limit_value, 'window', qp.window_code) ORDER BY qp.key)
				FROM monetization.plan_quota pq
				JOIN monetization.quota_policy qp ON qp.id = pq.quota_policy_id
				WHERE pq.plan_id = p.id), '[]'::json)
			FROM monetization.plan p
			WHERE p.status = 'active'
			ORDER BY p.sort_order ASC, p.created_at ASC`
		rows, err := db.Query(r.Context(), q)
		if err != nil {
			logger.Error("list monetization plans", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type Plan struct {
			ID           string          `json:"id"`
			Slug         string          `json:"slug"`
			NameKey      string          `json:"nameKey"`
			Status       string          `json:"status"`
			SortOrder    int             `json:"sortOrder"`
			Config       json.RawMessage `json:"config"`
			Entitlements json.RawMessage `json:"entitlements"`
			Quotas       json.RawMessage `json:"quotas"`
		}
		var plans []Plan
		for rows.Next() {
			var p Plan
			if err := rows.Scan(&p.ID, &p.Slug, &p.NameKey, &p.Status, &p.SortOrder, &p.Config, &p.Entitlements, &p.Quotas); err != nil {
				logger.Error("scan monetization plan", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			plans = append(plans, p)
		}
		if plans == nil {
			plans = []Plan{}
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate monetization plans", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
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
		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin monetization checkout", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(r.Context())
		var activePlanID string
		if err := tx.QueryRow(r.Context(), `SELECT id FROM monetization.plan WHERE id = $1 AND status = 'active'`, req.PlanID).Scan(&activePlanID); errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "active plan not found", http.StatusBadRequest)
			return
		} else if err != nil {
			logger.Error("validate monetization plan", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if _, err := tx.Exec(r.Context(), `SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))`, identity.UserID, req.PlanID); err != nil {
			logger.Error("lock monetization checkout", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		var subscriptionID string
		err = tx.QueryRow(r.Context(), `SELECT id FROM monetization.user_subscription
			WHERE user_id = $1 AND plan_id = $2 AND status = 'pending'
			ORDER BY created_at DESC LIMIT 1`, identity.UserID, req.PlanID).Scan(&subscriptionID)
		if errors.Is(err, pgx.ErrNoRows) {
			err = tx.QueryRow(r.Context(), `INSERT INTO monetization.user_subscription (user_id, plan_id, status, updated_at)
				VALUES ($1, $2, 'pending', NOW()) RETURNING id`, identity.UserID, req.PlanID).Scan(&subscriptionID)
			if err == nil {
				_, err = tx.Exec(r.Context(), `INSERT INTO monetization.subscription_event (subscription_id, kind, payload)
				VALUES ($1, 'checkout_started', '{}'::jsonb)`, subscriptionID)
			}
		}
		if err == nil {
			err = tx.Commit(r.Context())
		}
		if err != nil {
			logger.Error("create checkout intent", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"subscriptionId": subscriptionID,
			"status":         "pending",
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
		type Subscription struct {
			ID        string  `json:"id"`
			PlanID    string  `json:"planId"`
			Status    string  `json:"status"`
			ExpiresAt *string `json:"expiresAt,omitempty"`
		}
		const currentQ = `SELECT us.id, us.plan_id, us.status, us.current_period_end::text
			FROM monetization.user_subscription us
			JOIN monetization.plan p ON p.id = us.plan_id
			WHERE us.user_id = $1 AND us.status IN ('active', 'trialing') AND p.status = 'active'
				AND (us.current_period_start IS NULL OR us.current_period_start <= NOW())
				AND (us.current_period_end IS NULL OR us.current_period_end > NOW())
				AND (us.status <> 'trialing' OR us.trial_end IS NULL OR us.trial_end > NOW())
			ORDER BY us.created_at DESC LIMIT 1`
		const pendingQ = `SELECT id, plan_id, status, current_period_end::text
			FROM monetization.user_subscription
			WHERE user_id = $1 AND status = 'pending'
			ORDER BY created_at DESC LIMIT 1`
		readSubscription := func(q string) (*Subscription, error) {
			var sub Subscription
			if err := db.QueryRow(r.Context(), q, identity.UserID).Scan(&sub.ID, &sub.PlanID, &sub.Status, &sub.ExpiresAt); errors.Is(err, pgx.ErrNoRows) {
				return nil, nil
			} else if err != nil {
				return nil, err
			}
			return &sub, nil
		}
		sub, err := readSubscription(currentQ)
		if err != nil {
			logger.Error("get current learner subscription", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		pending, err := readSubscription(pendingQ)
		if err != nil {
			logger.Error("get pending learner subscription", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		summary, err := loadLearnerSubscriptionSummary(r.Context(), db, identity.UserID)
		if err != nil {
			logger.Error("load learner subscription summary", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		response := map[string]interface{}{"subscription": sub, "pendingSubscription": pending}
		summary.addTo(response)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(response)
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
		// Cancel at period end: the plan stays active until current_period_end, and the
		// settings page reads cancelAtPeriodEnd from the same subscription summary.
		const updateQ = `UPDATE monetization.user_subscription
			SET cancel_at_period_end = true, updated_at = NOW()
			WHERE user_id = $1 AND status IN ('active', 'trialing')`
		result, err := db.Exec(r.Context(), updateQ, identity.UserID)
		if err != nil {
			logger.Error("cancel subscription", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if result.RowsAffected() == 0 {
			writeJSONError(w, "no active subscription", http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]bool{"ok": true, "cancelAtPeriodEnd": true})
	}
}

// ── Reading Assist ──────────────────────────────────────────────────────────

type readingAssistLexeme struct {
	id, reading, meaning, partOfSpeech string
}

type readingAssistToken struct {
	Surface       string  `json:"surface"`
	Reading       string  `json:"reading"`
	ShortMeaning  *string `json:"shortMeaningVi"`
	BasicForm     string  `json:"basicForm"`
	PartOfSpeech  string  `json:"partOfSpeech"`
	LexemeID      *string `json:"lexemeId"`
	MeaningHidden bool    `json:"meaningHidden"`
	Index         int     `json:"index"`
	Start         int     `json:"start"`
	End           int     `json:"end"`
}

func tokenizeReadingAssist(ctx context.Context, db *pgxpool.Pool, text string, hideMeanings bool) ([]readingAssistToken, error) {
	runes := []rune(text)
	const maxWordRunes = 24
	candidates := make([]string, 0, len(runes)*4)
	seen := make(map[string]struct{}, len(runes)*4)
	maxWord := 0
	for i := range runes {
		for end := i + 1; end <= len(runes) && end <= i+maxWordRunes; end++ {
			candidate := string(runes[i:end])
			if _, ok := seen[candidate]; !ok {
				seen[candidate] = struct{}{}
				candidates = append(candidates, candidate)
			}
			if length := end - i; length > maxWord {
				maxWord = length
			}
		}
	}
	rows, err := db.Query(ctx, `SELECT l.id::text,l.headword,COALESCE(l.reading,''),
		COALESCE(NULLIF(l.short_meaning_vi,''),NULLIF(l.kanji_meaning_vi,''),NULLIF(s.meaning_vi,''),''),
		COALESCE(s.part_of_speech,'')
		FROM content.lexeme l
		LEFT JOIN LATERAL (SELECT part_of_speech,meaning_vi FROM content.lexeme_sense WHERE lexeme_id=l.id ORDER BY position LIMIT 1) s ON true
		WHERE l.status='active' AND l.headword=ANY($1::text[])`, candidates)
	if err != nil {
		return nil, err
	}
	lexemes := make(map[string]readingAssistLexeme)
	for rows.Next() {
		var word string
		var item readingAssistLexeme
		if err := rows.Scan(&item.id, &word, &item.reading, &item.meaning, &item.partOfSpeech); err != nil {
			rows.Close()
			return nil, err
		}
		lexemes[word] = item
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return nil, err
	}
	rows.Close()

	tokens := make([]readingAssistToken, 0, len(runes))
	utf16Offset := 0
	for pos := 0; pos < len(runes); {
		end := pos
		var item readingAssistLexeme
		for size := min(maxWord, len(runes)-pos); size > 0; size-- {
			if found, ok := lexemes[string(runes[pos:pos+size])]; ok {
				item, end = found, pos+size
				break
			}
		}
		if end == pos {
			end = pos + 1
		}
		surface := string(runes[pos:end])
		reading := item.reading
		if reading == "" && !containsKanji(runes[pos:end]) {
			reading = hiraganaReading(surface)
		}
		var id, meaning *string
		basicForm, partOfSpeech := surface, ""
		if item.id != "" {
			id = &item.id
			basicForm, partOfSpeech = surface, item.partOfSpeech
			if item.meaning != "" && !hideMeanings {
				meaning = &item.meaning
			}
		}
		start := utf16Offset
		for _, r := range runes[pos:end] {
			if r > 0xFFFF {
				utf16Offset += 2
			} else {
				utf16Offset++
			}
		}
		tokens = append(tokens, readingAssistToken{Surface: surface, Reading: reading, ShortMeaning: meaning,
			BasicForm: basicForm, PartOfSpeech: partOfSpeech, LexemeID: id, MeaningHidden: hideMeanings,
			Index: len(tokens), Start: start, End: utf16Offset})
		pos = end
	}
	return tokens, nil
}

func containsKanji(runes []rune) bool {
	for _, r := range runes {
		if unicode.Is(unicode.Han, r) {
			return true
		}
	}
	return false
}

func hiraganaReading(surface string) string {
	return strings.Map(func(r rune) rune {
		if r >= 0x30A1 && r <= 0x30F6 {
			return r - 0x60
		}
		return r
	}, surface)
}

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
			Text        string `json:"text"`
			ExamContext *struct {
				Kind string `json:"kind"`
				Mode string `json:"mode"`
			} `json:"examContext"`
			QuizSessionID string `json:"quizSessionId"`
		}
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16<<10)).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		normalized := strings.TrimSpace(req.Text)
		if normalized == "" || len([]rune(normalized)) > 2000 || (req.ExamContext != nil && (req.ExamContext.Kind != "bjt_quiz" || (req.ExamContext.Mode != "timed" && req.ExamContext.Mode != "practice"))) {
			writeJSONError(w, "valid text and examContext required", http.StatusBadRequest)
			return
		}
		kind := "analysis"
		hideMeanings := false
		if req.ExamContext != nil && req.ExamContext.Kind == "bjt_quiz" && req.ExamContext.Mode == "timed" {
			kind = "exam"
			hideMeanings = true
			if req.QuizSessionID != "" {
				sessionID, err := uuid.Parse(req.QuizSessionID)
				if err != nil {
					writeJSONError(w, "invalid quiz session id", http.StatusBadRequest)
					return
				}
				var status string
				if err := db.QueryRow(r.Context(), `SELECT status FROM assessment.quiz_session WHERE id=$1 AND user_id=$2`, sessionID, identity.UserID).Scan(&status); err != nil {
					if errors.Is(err, pgx.ErrNoRows) {
						writeJSONError(w, "quiz session not found", http.StatusNotFound)
					} else {
						logger.Error("verify reading assist quiz session", "error", err, "user_id", identity.UserID)
						writeJSONError(w, "internal error", http.StatusInternalServerError)
					}
					return
				}
				hideMeanings = status != "completed"
			}
		}
		contextStr := ""
		if req.QuizSessionID != "" {
			contextStr = "quiz:" + req.QuizSessionID
		}
		const insertQ = `INSERT INTO learning.reading_assist_report (user_id, kind, text_hash, context, created_at)
			VALUES ($1, $2, md5($3), $4, NOW())
			ON CONFLICT DO NOTHING`
		if _, err := db.Exec(r.Context(), insertQ, identity.UserID, kind, normalized, contextStr); err != nil {
			logger.Error("record reading assist analysis", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		tokens, err := tokenizeReadingAssist(r.Context(), db, normalized, hideMeanings)
		if err != nil {
			logger.Error("tokenize reading assist text", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		hash := sha256.Sum256([]byte(normalized))
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]any{"cached": false, "normalized": normalized, "textHash": hex.EncodeToString(hash[:]), "tokens": tokens})
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
		type Preferences struct {
			DisplayMode string `json:"displayMode"`
			ShowRomaji  bool   `json:"showRomaji"`
		}
		const q = `SELECT display_mode, show_romaji
			FROM profile.reading_user_preference
			WHERE user_id = $1`
		var prefs Preferences
		if err := db.QueryRow(r.Context(), q, identity.UserID).Scan(&prefs.DisplayMode, &prefs.ShowRomaji); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				prefs = Preferences{DisplayMode: "hover"}
			} else {
				logger.Error("get reading assist preferences", "error", err, "user_id", identity.UserID)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
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
			DisplayMode string `json:"displayMode"`
			ShowRomaji  *bool  `json:"showRomaji"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if !validReadingAssistDisplayMode(req.DisplayMode) || req.ShowRomaji == nil {
			writeJSONError(w, "valid displayMode and showRomaji required", http.StatusBadRequest)
			return
		}
		const upsertQ = `INSERT INTO profile.reading_user_preference (user_id, display_mode, show_romaji, created_at, updated_at)
			VALUES ($1, $2, $3, NOW(), NOW())
			ON CONFLICT (user_id) DO UPDATE SET
				display_mode = EXCLUDED.display_mode,
				show_romaji = EXCLUDED.show_romaji,
				updated_at = NOW()`
		if _, err := db.Exec(r.Context(), upsertQ, identity.UserID, req.DisplayMode, *req.ShowRomaji); err != nil {
			logger.Error("update reading assist preferences", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]bool{"updated": true})
	}
}

func validReadingAssistDisplayMode(mode string) bool {
	switch mode {
	case "off", "hover", "difficult", "full_furigana", "beginner":
		return true
	default:
		return false
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
		var req struct {
			EventName  string `json:"eventName"`
			TextHash   string `json:"textHash"`
			SessionID  string `json:"sessionId"`
			TokenIndex *int   `json:"tokenIndex"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.EventName == "" || len(req.EventName) > 64 || len(req.TextHash) > 64 || len(req.SessionID) > 135 || (req.TokenIndex != nil && *req.TokenIndex < 0) {
			writeJSONError(w, "invalid analytics event", http.StatusBadRequest)
			return
		}
		contextValue := req.EventName
		if req.SessionID != "" {
			contextValue += ":" + req.SessionID
		}
		const insertQ = `INSERT INTO learning.reading_assist_report (user_id, kind, text_hash, context, created_at)
			VALUES ($1, 'analytics', md5($2), $3, NOW())`
		if _, err := db.Exec(r.Context(), insertQ, identity.UserID, req.TextHash, contextValue); err != nil {
			logger.Error("record reading assist analytics", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
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
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16<<10)).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		text := strings.TrimSpace(req.Text)
		if text == "" || len([]rune(text)) > 2000 {
			writeJSONError(w, "valid text required", http.StatusBadRequest)
			return
		}
		tokens, err := tokenizeReadingAssist(r.Context(), db, text, true)
		if err != nil {
			logger.Error("extract reading assist reading", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		var reading strings.Builder
		for _, token := range tokens {
			if token.Reading == "" && containsKanji([]rune(token.Surface)) {
				writeJSONError(w, "reading unavailable for part of text", http.StatusUnprocessableEntity)
				return
			}
			reading.WriteString(token.Reading)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]string{"reading": reading.String()})
	}
}
