package httpserver

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
)

// ── Story Arcs ──────────────────────────────────────────────────────────────

// listStoryArcsHandler implements GET /api/story/arcs.
func listStoryArcsHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		const q = `SELECT id, slug, title_ja, title_vi, rank_code_entry, status, display_order
			FROM career.mission_arc WHERE status = 'published'
			ORDER BY display_order ASC, created_at ASC`
		rows, err := db.Query(r.Context(), q)
		if err != nil {
			logger.Error("list story arcs", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type Arc struct {
			ID            string `json:"id"`
			Slug          string `json:"slug"`
			TitleJa       string `json:"titleJa"`
			TitleVi       string `json:"titleVi"`
			RankCodeEntry string `json:"rankCodeEntry"`
			Status        string `json:"status"`
			DisplayOrder  int    `json:"displayOrder"`
		}
		var arcs []Arc
		for rows.Next() {
			var a Arc
			if err := rows.Scan(&a.ID, &a.Slug, &a.TitleJa, &a.TitleVi, &a.RankCodeEntry, &a.Status, &a.DisplayOrder); err != nil {
				continue
			}
			arcs = append(arcs, a)
		}
		if arcs == nil {
			arcs = []Arc{}
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(arcs)
	}
}

// getStoryArcDetailHandler implements GET /api/story/arcs/{slug}.
func getStoryArcDetailHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		slug := extractPathParam(r.URL.Path, "arcs", 1)
		if slug == "" {
			writeJSONError(w, "arc slug required", http.StatusBadRequest)
			return
		}

		type Chapter struct {
			ID      string `json:"id"`
			Slug    string `json:"slug"`
			TitleJa string `json:"titleJa"`
			TitleVi string `json:"titleVi"`
		}
		type ArcDetail struct {
			ID            string          `json:"id"`
			Slug          string          `json:"slug"`
			TitleJa       string          `json:"titleJa"`
			TitleVi       string          `json:"titleVi"`
			RankCodeEntry string          `json:"rankCodeEntry"`
			StoryPayload  json.RawMessage `json:"storyPayload"`
			Status        string          `json:"status"`
			Chapters      []Chapter       `json:"chapters"`
		}

		var ad ArcDetail
		const q = `SELECT id, slug, title_ja, title_vi, rank_code_entry, story_payload, status
			FROM career.mission_arc WHERE slug = $1 AND status = 'published'`
		if err := db.QueryRow(r.Context(), q, slug).Scan(&ad.ID, &ad.Slug, &ad.TitleJa, &ad.TitleVi,
			&ad.RankCodeEntry, &ad.StoryPayload, &ad.Status); err != nil {
			writeJSONError(w, "arc not found", http.StatusNotFound)
			return
		}

		const chQ = `SELECT id, slug, title_ja, title_vi FROM career.mission_chapter
			WHERE arc_id = $1 ORDER BY display_order ASC`
		cRows, err := db.Query(r.Context(), chQ, ad.ID)
		if err == nil {
			for cRows.Next() {
				var ch Chapter
				if err := cRows.Scan(&ch.ID, &ch.Slug, &ch.TitleJa, &ch.TitleVi); err == nil {
					ad.Chapters = append(ad.Chapters, ch)
				}
			}
			cRows.Close()
		}
		if ad.Chapters == nil {
			ad.Chapters = []Chapter{}
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(ad)
	}
}

// ── Content Lexemes ─────────────────────────────────────────────────────────

// listLexemesHandler implements GET /api/content/lexemes.
func listLexemesHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		limit := 50
		offset := 0
		q := r.URL.Query().Get("q")
		jlpt := r.URL.Query().Get("jlptLevel")

		type Lexeme struct {
			ID             string  `json:"id"`
			Headword       string  `json:"headword"`
			Reading        *string `json:"reading,omitempty"`
			KanjiMeaningVi *string `json:"kanjiMeaningVi,omitempty"`
			JLPTLevel      *string `json:"jlptLevel,omitempty"`
			ShortMeaningVi *string `json:"shortMeaningVi,omitempty"`
		}

		var query string
		var args []interface{}
		if q != "" && jlpt != "" {
			query = `SELECT id, headword, reading, kanji_meaning_vi, jlpt_level, short_meaning_vi
				FROM content.lexeme WHERE status = 'active' AND (headword ILIKE $1 OR reading ILIKE $1) AND jlpt_level = $2
				ORDER BY headword ASC LIMIT $3 OFFSET $4`
			args = []interface{}{"%" + q + "%", jlpt, limit, offset}
		} else if q != "" {
			query = `SELECT id, headword, reading, kanji_meaning_vi, jlpt_level, short_meaning_vi
				FROM content.lexeme WHERE status = 'active' AND (headword ILIKE $1 OR reading ILIKE $1)
				ORDER BY headword ASC LIMIT $2 OFFSET $3`
			args = []interface{}{"%" + q + "%", limit, offset}
		} else if jlpt != "" {
			query = `SELECT id, headword, reading, kanji_meaning_vi, jlpt_level, short_meaning_vi
				FROM content.lexeme WHERE status = 'active' AND jlpt_level = $1
				ORDER BY headword ASC LIMIT $2 OFFSET $3`
			args = []interface{}{jlpt, limit, offset}
		} else {
			query = `SELECT id, headword, reading, kanji_meaning_vi, jlpt_level, short_meaning_vi
				FROM content.lexeme WHERE status = 'active'
				ORDER BY headword ASC LIMIT $1 OFFSET $2`
			args = []interface{}{limit, offset}
		}

		rows, err := db.Query(r.Context(), query, args...)
		if err != nil {
			logger.Error("list lexemes", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		var lexemes []Lexeme
		for rows.Next() {
			var l Lexeme
			if err := rows.Scan(&l.ID, &l.Headword, &l.Reading, &l.KanjiMeaningVi, &l.JLPTLevel, &l.ShortMeaningVi); err != nil {
				continue
			}
			lexemes = append(lexemes, l)
		}
		if lexemes == nil {
			lexemes = []Lexeme{}
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(lexemes)
	}
}

// getLexemeDetailHandler implements GET /api/content/lexemes/{id}.
func getLexemeDetailHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := extractPathParam(r.URL.Path, "lexemes", 1)
		if id == "" {
			writeJSONError(w, "lexeme id required", http.StatusBadRequest)
			return
		}

		type Sense struct {
			GlossVi string  `json:"glossVi"`
			PosTag  *string `json:"posTag,omitempty"`
			Note    *string `json:"note,omitempty"`
		}
		type LexemeDetail struct {
			ID             string          `json:"id"`
			Headword       string          `json:"headword"`
			Reading        *string         `json:"reading,omitempty"`
			KanjiMeaningVi *string         `json:"kanjiMeaningVi,omitempty"`
			JLPTLevel      *string         `json:"jlptLevel,omitempty"`
			ShortMeaningVi *string         `json:"shortMeaningVi,omitempty"`
			Pronunciation  json.RawMessage `json:"pronunciation,omitempty"`
			Senses         []Sense         `json:"senses"`
		}

		var ld LexemeDetail
		const q = `SELECT id, headword, reading, kanji_meaning_vi, jlpt_level, short_meaning_vi, pronunciation
			FROM content.lexeme WHERE id = $1 AND status = 'active'`
		if err := db.QueryRow(r.Context(), q, id).Scan(&ld.ID, &ld.Headword, &ld.Reading,
			&ld.KanjiMeaningVi, &ld.JLPTLevel, &ld.ShortMeaningVi, &ld.Pronunciation); err != nil {
			writeJSONError(w, "lexeme not found", http.StatusNotFound)
			return
		}

		const senseQ = `SELECT gloss_vi, pos_tag, note FROM content.lexeme_sense
			WHERE lexeme_id = $1 ORDER BY position ASC LIMIT 20`
		sRows, err := db.Query(r.Context(), senseQ, id)
		if err == nil {
			for sRows.Next() {
				var s Sense
				if err := sRows.Scan(&s.GlossVi, &s.PosTag, &s.Note); err == nil {
					ld.Senses = append(ld.Senses, s)
				}
			}
			sRows.Close()
		}
		if ld.Senses == nil {
			ld.Senses = []Sense{}
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(ld)
	}
}

// ── Content Grammar ─────────────────────────────────────────────────────────

// listGrammarHandler implements GET /api/content/grammar.
func listGrammarHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		limit := 50
		offset := 0
		q := r.URL.Query().Get("q")
		jlpt := r.URL.Query().Get("jlptLevel")

		type Grammar struct {
			ID        string  `json:"id"`
			Pattern   string  `json:"pattern"`
			MeaningVi string  `json:"meaningVi"`
			JLPTLevel *string `json:"jlptLevel,omitempty"`
			Category  *string `json:"category,omitempty"`
		}

		var query string
		var args []interface{}
		if q != "" && jlpt != "" {
			query = `SELECT id, pattern, meaning_vi, jlpt_level, category
				FROM content.grammar_point WHERE status = 'active' AND (pattern ILIKE $1 OR meaning_vi ILIKE $1) AND jlpt_level = $2
				ORDER BY pattern ASC LIMIT $3 OFFSET $4`
			args = []interface{}{"%" + q + "%", jlpt, limit, offset}
		} else if q != "" {
			query = `SELECT id, pattern, meaning_vi, jlpt_level, category
				FROM content.grammar_point WHERE status = 'active' AND (pattern ILIKE $1 OR meaning_vi ILIKE $1)
				ORDER BY pattern ASC LIMIT $2 OFFSET $3`
			args = []interface{}{"%" + q + "%", limit, offset}
		} else if jlpt != "" {
			query = `SELECT id, pattern, meaning_vi, jlpt_level, category
				FROM content.grammar_point WHERE status = 'active' AND jlpt_level = $1
				ORDER BY pattern ASC LIMIT $2 OFFSET $3`
			args = []interface{}{jlpt, limit, offset}
		} else {
			query = `SELECT id, pattern, meaning_vi, jlpt_level, category
				FROM content.grammar_point WHERE status = 'active'
				ORDER BY pattern ASC LIMIT $1 OFFSET $2`
			args = []interface{}{limit, offset}
		}

		rows, err := db.Query(r.Context(), query, args...)
		if err != nil {
			logger.Error("list grammar", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		var items []Grammar
		for rows.Next() {
			var g Grammar
			if err := rows.Scan(&g.ID, &g.Pattern, &g.MeaningVi, &g.JLPTLevel, &g.Category); err != nil {
				continue
			}
			items = append(items, g)
		}
		if items == nil {
			items = []Grammar{}
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(items)
	}
}

// getGrammarDetailHandler implements GET /api/content/grammar/{id}.
func getGrammarDetailHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := extractPathParam(r.URL.Path, "grammar", 1)
		if id == "" {
			writeJSONError(w, "grammar id required", http.StatusBadRequest)
			return
		}

		type Detail struct {
			Position    int     `json:"position"`
			MeaningVi   *string `json:"meaningVi,omitempty"`
			Explanation *string `json:"explanation,omitempty"`
			Note        *string `json:"note,omitempty"`
			Synopsis    *string `json:"synopsis,omitempty"`
		}
		type GrammarDetail struct {
			ID        string   `json:"id"`
			Pattern   string   `json:"pattern"`
			MeaningVi string   `json:"meaningVi"`
			JLPTLevel *string  `json:"jlptLevel,omitempty"`
			Category  *string  `json:"category,omitempty"`
			Details   []Detail `json:"details"`
		}

		var gd GrammarDetail
		const q = `SELECT id, pattern, meaning_vi, jlpt_level, category
			FROM content.grammar_point WHERE id = $1 AND status = 'active'`
		if err := db.QueryRow(r.Context(), q, id).Scan(&gd.ID, &gd.Pattern, &gd.MeaningVi, &gd.JLPTLevel, &gd.Category); err != nil {
			writeJSONError(w, "grammar not found", http.StatusNotFound)
			return
		}

		const detQ = `SELECT position, meaning_vi, explanation, note, synopsis
			FROM content.grammar_point_detail WHERE grammar_point_id = $1 ORDER BY position ASC`
		dRows, err := db.Query(r.Context(), detQ, id)
		if err == nil {
			for dRows.Next() {
				var d Detail
				if err := dRows.Scan(&d.Position, &d.MeaningVi, &d.Explanation, &d.Note, &d.Synopsis); err == nil {
					gd.Details = append(gd.Details, d)
				}
			}
			dRows.Close()
		}
		if gd.Details == nil {
			gd.Details = []Detail{}
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(gd)
	}
}

// ── Gamification: Study Goal ────────────────────────────────────────────────

// getStudyGoalHandler implements GET /api/gamification/study-goal.
func getStudyGoalHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		const q = `SELECT target_minutes FROM gamification.daily_study_goal WHERE user_id = $1`
		var targetMinutes int
		if err := db.QueryRow(r.Context(), q, identity.UserID).Scan(&targetMinutes); err != nil {
			targetMinutes = 15 // default
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]int{"targetMinutes": targetMinutes})
	}
}

// setStudyGoalHandler implements POST /api/gamification/study-goal.
func setStudyGoalHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			TargetMinutes int `json:"targetMinutes"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.TargetMinutes <= 0 {
			req.TargetMinutes = 15
		}
		const upsertQ = `INSERT INTO gamification.daily_study_goal (user_id, target_minutes, created_at, updated_at)
			VALUES ($1, $2, NOW(), NOW())
			ON CONFLICT (user_id) DO UPDATE SET target_minutes = $2, updated_at = NOW()`
		if _, err := db.Exec(r.Context(), upsertQ, identity.UserID, req.TargetMinutes); err != nil {
			logger.Error("set study goal", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]int{"targetMinutes": req.TargetMinutes})
	}
}

// ── Gamification: Login Bonus ───────────────────────────────────────────────

// getLoginBonusHandler implements GET /api/gamification/login-bonus.
func getLoginBonusHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		const q = `SELECT chain_day, last_claim_date, chain_start_date
			FROM gamification.login_bonus_chain WHERE user_id = $1`
		var chainDay int
		var lastClaimDate *time.Time
		var chainStartDate time.Time
		if err := db.QueryRow(r.Context(), q, identity.UserID).Scan(&chainDay, &lastClaimDate, &chainStartDate); err != nil {
			chainDay = 0
		}
		canClaim := true
		if lastClaimDate != nil {
			today := time.Now().Format("2006-01-02")
			if lastClaimDate.Format("2006-01-02") == today {
				canClaim = false
			}
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"chainDay":  chainDay,
			"canClaim":  canClaim,
			"startDate": chainStartDate.Format("2006-01-02"),
		})
	}
}

// claimLoginBonusHandler implements POST /api/gamification/login-bonus/claim.
func claimLoginBonusHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		today := time.Now().Format("2006-01-02")

		// Upsert chain
		const chainQ = `INSERT INTO gamification.login_bonus_chain (user_id, chain_day, last_claim_date, chain_start_date, created_at, updated_at)
			VALUES ($1, 1, $2::date, $2::date, NOW(), NOW())
			ON CONFLICT (user_id) DO UPDATE SET
			chain_day = CASE WHEN login_bonus_chain.last_claim_date = $2::date THEN login_bonus_chain.chain_day
				WHEN login_bonus_chain.last_claim_date >= ($2::date - INTERVAL '1 day') THEN login_bonus_chain.chain_day + 1
				ELSE 1 END,
			last_claim_date = $2::date,
			chain_start_date = CASE WHEN login_bonus_chain.last_claim_date >= ($2::date - INTERVAL '1 day') THEN login_bonus_chain.chain_start_date ELSE $2::date END,
			updated_at = NOW()`
		if _, err := db.Exec(r.Context(), chainQ, identity.UserID, today); err != nil {
			logger.Error("claim login bonus chain", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		// Get current chain day
		var chainDay int
		_ = db.QueryRow(r.Context(), `SELECT chain_day FROM gamification.login_bonus_chain WHERE user_id = $1`, identity.UserID).Scan(&chainDay)

		// Record claim
		rewardType := "xp"
		rewardValue := "10"
		const claimQ = `INSERT INTO gamification.login_bonus_claim (user_id, chain_day, reward_type, reward_value, claimed_at)
			VALUES ($1, $2, $3, $4, NOW())`
		if _, err := db.Exec(r.Context(), claimQ, identity.UserID, chainDay, rewardType, rewardValue); err != nil {
			logger.Error("record login bonus claim", "error", err)
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"claimed":     true,
			"chainDay":    chainDay,
			"rewardType":  rewardType,
			"rewardValue": rewardValue,
		})
	}
}

// ── Gamification: Mystery Box ───────────────────────────────────────────────

// mysteryBoxStatusHandler implements GET /api/gamification/mystery-box/status.
func mysteryBoxStatusHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		today := time.Now().Format("2006-01-02")
		const q = `SELECT mr.name_vi, mr.reward_type, mr.rarity, mr.icon_emoji
			FROM gamification.mystery_box_claim mbc
			JOIN gamification.mystery_box_reward mr ON mr.id = mbc.reward_id
			WHERE mbc.user_id = $1 AND mbc.claim_date = $2::date`
		var nameVi, rewardType, rarity, iconEmoji string
		if err := db.QueryRow(r.Context(), q, identity.UserID, today).Scan(&nameVi, &rewardType, &rarity, &iconEmoji); err != nil {
			// Not yet opened today
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"opened": false})
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"opened":     true,
			"nameVi":     nameVi,
			"rewardType": rewardType,
			"rarity":     rarity,
			"iconEmoji":  iconEmoji,
		})
	}
}

// openMysteryBoxHandler implements POST /api/gamification/mystery-box/open.
func openMysteryBoxHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		today := time.Now().Format("2006-01-02")

		// Check already opened
		const checkQ = `SELECT 1 FROM gamification.mystery_box_claim WHERE user_id = $1 AND claim_date = $2::date`
		var exists int
		if err := db.QueryRow(r.Context(), checkQ, identity.UserID, today).Scan(&exists); err == nil {
			writeJSONError(w, "already opened today", http.StatusConflict)
			return
		}

		// Pick random reward by weight
		const rewardQ = `SELECT id, name_vi, reward_type, reward_value, rarity, icon_emoji
			FROM gamification.mystery_box_reward WHERE active = true ORDER BY RANDOM() LIMIT 1`
		var rewardID, nameVi, rewardType, rarity, iconEmoji string
		var rewardValue int
		if err := db.QueryRow(r.Context(), rewardQ).Scan(&rewardID, &nameVi, &rewardType, &rewardValue, &rarity, &iconEmoji); err != nil {
			logger.Error("pick mystery box reward", "error", err)
			writeJSONError(w, "no rewards available", http.StatusInternalServerError)
			return
		}

		// Record claim
		const insertQ = `INSERT INTO gamification.mystery_box_claim (user_id, reward_id, claimed_at, claim_date)
			VALUES ($1, $2, NOW(), $3::date)`
		if _, err := db.Exec(r.Context(), insertQ, identity.UserID, rewardID, today); err != nil {
			logger.Error("record mystery box claim", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"opened":      true,
			"nameVi":      nameVi,
			"rewardType":  rewardType,
			"rewardValue": rewardValue,
			"rarity":      rarity,
			"iconEmoji":   iconEmoji,
		})
	}
}

// ── Share ───────────────────────────────────────────────────────────────────

// createShareHandler implements POST /api/learner/share.
func createShareHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			TemplateSlug   string          `json:"templateSlug"`
			SummaryPayload json.RawMessage `json:"summaryPayload"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}

		// Look up template
		var templateID string
		if req.TemplateSlug != "" {
			_ = db.QueryRow(r.Context(), `SELECT id FROM growth.share_template WHERE slug = $1 AND active = true`, req.TemplateSlug).Scan(&templateID)
		}

		// Generate token
		token := generateShareToken()
		const insertQ = `INSERT INTO growth.share_item (user_id, template_id, public_token, kind, summary_payload, created_at)
			VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id`
		var itemID string
		kind := req.TemplateSlug
		if kind == "" {
			kind = "custom"
		}
		if err := db.QueryRow(r.Context(), insertQ, identity.UserID, nullString(templateID), token, kind, req.SummaryPayload).Scan(&itemID); err != nil {
			logger.Error("create share", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"id":          itemID,
			"publicToken": token,
		})
	}
}

// shareTemplatesHandler implements GET /api/learner/share/templates.
func shareTemplatesHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		kind := r.URL.Query().Get("kind")
		var query string
		var args []interface{}
		if kind != "" {
			query = `SELECT id, slug, kind, version, config FROM growth.share_template WHERE active = true AND kind = $1 ORDER BY slug ASC`
			args = []interface{}{kind}
		} else {
			query = `SELECT id, slug, kind, version, config FROM growth.share_template WHERE active = true ORDER BY slug ASC`
		}
		rows, err := db.Query(r.Context(), query, args...)
		if err != nil {
			logger.Error("list share templates", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type Template struct {
			ID      string          `json:"id"`
			Slug    string          `json:"slug"`
			Kind    string          `json:"kind"`
			Version int             `json:"version"`
			Config  json.RawMessage `json:"config"`
		}
		var templates []Template
		for rows.Next() {
			var t Template
			if err := rows.Scan(&t.ID, &t.Slug, &t.Kind, &t.Version, &t.Config); err != nil {
				continue
			}
			templates = append(templates, t)
		}
		if templates == nil {
			templates = []Template{}
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(templates)
	}
}

// sharePreviewHandler implements GET /api/learner/share/preview.
func sharePreviewHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Return preview data based on query params — simplified
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"preview": true,
			"params":  r.URL.Query(),
		})
	}
}

// createPetEvolutionShareHandler implements POST /api/learner/shares/pet-evolution.
func createPetEvolutionShareHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req json.RawMessage
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			req = json.RawMessage("{}")
		}
		token := generateShareToken()
		const insertQ = `INSERT INTO growth.share_item (user_id, public_token, kind, summary_payload, created_at)
			VALUES ($1, $2, 'pet-evolution', $3, NOW()) RETURNING id`
		var itemID string
		if err := db.QueryRow(r.Context(), insertQ, identity.UserID, token, req).Scan(&itemID); err != nil {
			logger.Error("create pet evolution share", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"id":          itemID,
			"publicToken": token,
		})
	}
}

// ── Magazine / Loto ─────────────────────────────────────────────────────────

// listMagazineHandler implements GET /api/magazine.
func listMagazineHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		limit := 20
		widgetKind := r.URL.Query().Get("widgetKind")
		var query string
		var args []interface{}
		if widgetKind != "" {
			query = `SELECT id, slug, widget_kind, title_jp, title_vi, cover_image_url, published_at, jlpt_level
				FROM daily.magazine_article WHERE status = 'published' AND widget_kind = $1
				ORDER BY published_at DESC LIMIT $2`
			args = []interface{}{widgetKind, limit}
		} else {
			query = `SELECT id, slug, widget_kind, title_jp, title_vi, cover_image_url, published_at, jlpt_level
				FROM daily.magazine_article WHERE status = 'published'
				ORDER BY published_at DESC LIMIT $1`
			args = []interface{}{limit}
		}
		rows, err := db.Query(r.Context(), query, args...)
		if err != nil {
			logger.Error("list magazine", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type Article struct {
			ID          string  `json:"id"`
			Slug        string  `json:"slug"`
			WidgetKind  string  `json:"widgetKind"`
			TitleJp     string  `json:"titleJp"`
			TitleVi     string  `json:"titleVi"`
			CoverImage  *string `json:"coverImageUrl,omitempty"`
			PublishedAt *string `json:"publishedAt,omitempty"`
			JLPTLevel   *string `json:"jlptLevel,omitempty"`
		}
		var articles []Article
		for rows.Next() {
			var a Article
			var pubAt *time.Time
			if err := rows.Scan(&a.ID, &a.Slug, &a.WidgetKind, &a.TitleJp, &a.TitleVi, &a.CoverImage, &pubAt, &a.JLPTLevel); err != nil {
				continue
			}
			if pubAt != nil {
				s := pubAt.Format(time.RFC3339)
				a.PublishedAt = &s
			}
			articles = append(articles, a)
		}
		if articles == nil {
			articles = []Article{}
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(articles)
	}
}

// getMagazineTodayHandler implements GET /api/magazine/today.
func getMagazineTodayHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		today := time.Now().Format("2006-01-02")
		const q = `SELECT id, slug, widget_kind, title_jp, title_vi, cover_image_url, published_at
			FROM daily.magazine_article WHERE status = 'published' AND content_date = $1::date
			ORDER BY published_at DESC LIMIT 5`
		rows, err := db.Query(r.Context(), q, today)
		if err != nil {
			logger.Error("magazine today", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type Article struct {
			ID         string  `json:"id"`
			Slug       string  `json:"slug"`
			WidgetKind string  `json:"widgetKind"`
			TitleJp    string  `json:"titleJp"`
			TitleVi    string  `json:"titleVi"`
			CoverImage *string `json:"coverImageUrl,omitempty"`
		}
		var articles []Article
		for rows.Next() {
			var a Article
			var pubAt *time.Time
			if err := rows.Scan(&a.ID, &a.Slug, &a.WidgetKind, &a.TitleJp, &a.TitleVi, &a.CoverImage, &pubAt); err != nil {
				continue
			}
			articles = append(articles, a)
		}
		if articles == nil {
			articles = []Article{}
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(articles)
	}
}

// getMagazineBySlugHandler implements GET /api/magazine/{slug}.
func getMagazineBySlugHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		slug := extractPathParam(r.URL.Path, "magazine", 1)
		if slug == "" {
			writeJSONError(w, "slug required", http.StatusBadRequest)
			return
		}
		type Article struct {
			ID          string          `json:"id"`
			Slug        string          `json:"slug"`
			WidgetKind  string          `json:"widgetKind"`
			TitleJp     string          `json:"titleJp"`
			TitleVi     string          `json:"titleVi"`
			SummaryJp   *string         `json:"summaryJp,omitempty"`
			SummaryVi   *string         `json:"summaryVi,omitempty"`
			CoverImage  *string         `json:"coverImageUrl,omitempty"`
			ContentJSON json.RawMessage `json:"contentJson"`
			JLPTLevel   *string         `json:"jlptLevel,omitempty"`
			PublishedAt *string         `json:"publishedAt,omitempty"`
		}
		var a Article
		var pubAt *time.Time
		const q = `SELECT id, slug, widget_kind, title_jp, title_vi, summary_jp, summary_vi,
			cover_image_url, content_json, jlpt_level, published_at
			FROM daily.magazine_article WHERE slug = $1 AND status = 'published'`
		if err := db.QueryRow(r.Context(), q, slug).Scan(&a.ID, &a.Slug, &a.WidgetKind, &a.TitleJp, &a.TitleVi,
			&a.SummaryJp, &a.SummaryVi, &a.CoverImage, &a.ContentJSON, &a.JLPTLevel, &pubAt); err != nil {
			writeJSONError(w, "article not found", http.StatusNotFound)
			return
		}
		if pubAt != nil {
			s := pubAt.Format(time.RFC3339)
			a.PublishedAt = &s
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(a)
	}
}

// markMagazineReadHandler implements POST /api/magazine/{slug}/read.
func markMagazineReadHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		slug := extractPathParam(r.URL.Path, "magazine", 1)
		if slug == "" {
			writeJSONError(w, "slug required", http.StatusBadRequest)
			return
		}
		// Optional auth — record if authenticated
		userID := ""
		if identity, ok := authn.GetLearnerIdentity(r.Context()); ok {
			userID = identity.UserID
		}
		if userID != "" {
			const insertQ = `INSERT INTO daily.magazine_read (user_id, article_slug, read_at)
				VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING`
			if _, err := db.Exec(r.Context(), insertQ, userID, slug); err != nil {
				logger.Error("mark magazine read", "error", err)
			}
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]bool{"read": true})
	}
}

// lotoFeedHandler implements GET /api/magazine/loto/feed.
func lotoFeedHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		game := r.URL.Query().Get("game")
		if game == "" {
			game = "loto6"
		}
		const q = `SELECT id, game, draw_number, draw_date, main_numbers, bonus_numbers
			FROM daily.loto_draw WHERE game = $1 ORDER BY draw_date DESC LIMIT 10`
		rows, err := db.Query(r.Context(), q, game)
		if err != nil {
			logger.Error("loto feed", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type Draw struct {
			ID           string `json:"id"`
			Game         string `json:"game"`
			DrawNumber   int    `json:"drawNumber"`
			DrawDate     string `json:"drawDate"`
			MainNumbers  []int  `json:"mainNumbers"`
			BonusNumbers []int  `json:"bonusNumbers"`
		}
		var draws []Draw
		for rows.Next() {
			var d Draw
			var drawDate time.Time
			if err := rows.Scan(&d.ID, &d.Game, &d.DrawNumber, &drawDate, &d.MainNumbers, &d.BonusNumbers); err != nil {
				continue
			}
			d.DrawDate = drawDate.Format("2006-01-02")
			if d.MainNumbers == nil {
				d.MainNumbers = []int{}
			}
			if d.BonusNumbers == nil {
				d.BonusNumbers = []int{}
			}
			draws = append(draws, d)
		}
		if draws == nil {
			draws = []Draw{}
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(draws)
	}
}

// lotoNextDrawHandler implements GET /api/magazine/loto/next-draw.
func lotoNextDrawHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		game := r.URL.Query().Get("game")
		if game == "" {
			game = "loto6"
		}
		const q = `SELECT id, game, draw_number, draw_date FROM daily.loto_generation_run
			WHERE game = $1 AND status = 'generated' AND target_draw_date > CURRENT_DATE
			ORDER BY target_draw_date ASC LIMIT 1`
		var id, g string
		var drawNumber int
		var drawDate time.Time
		if err := db.QueryRow(r.Context(), q, game).Scan(&id, &g, &drawNumber, &drawDate); err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"nextDraw": nil})
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"nextDraw": map[string]interface{}{
				"id":         id,
				"game":       g,
				"drawNumber": drawNumber,
				"drawDate":   drawDate.Format("2006-01-02"),
			},
		})
	}
}

// lotoStatsHandler implements GET /api/magazine/loto/stats.
func lotoStatsHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		game := r.URL.Query().Get("game")
		if game == "" {
			game = "loto6"
		}
		const q = `SELECT COUNT(*), MAX(draw_date), MIN(draw_date) FROM daily.loto_draw WHERE game = $1`
		var total int
		var maxDate, minDate *time.Time
		if err := db.QueryRow(r.Context(), q, game).Scan(&total, &maxDate, &minDate); err != nil {
			total = 0
		}
		result := map[string]interface{}{
			"game":       game,
			"totalDraws": total,
		}
		if maxDate != nil {
			result["latestDraw"] = maxDate.Format("2006-01-02")
		}
		if minDate != nil {
			result["earliestDraw"] = minDate.Format("2006-01-02")
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(result)
	}
}

// ── Helpers ─────────────────────────────────────────────────────────────────

func generateShareToken() string {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, 16)
	for i := range b {
		b[i] = charset[time.Now().UnixNano()%int64(len(charset))]
	}
	return string(b)
}

func nullString(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

// Ensure imports are used.
var (
	_ = strings.Split
	_ = pgx.ErrNoRows
)
