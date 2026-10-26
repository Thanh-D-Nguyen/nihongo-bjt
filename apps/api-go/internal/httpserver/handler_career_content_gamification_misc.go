package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
)

// ── Story Arcs ──────────────────────────────────────────────────────────────

// listStoryArcsHandler implements GET /api/story/arcs.
func listStoryArcsHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		const q = `SELECT id, slug, title_ja, title_vi, rank_code_entry, status, display_order, story_payload,
				COALESCE((SELECT array_agg(c.id::text ORDER BY c.display_order, c.slug) FROM career.mission_chapter c WHERE c.arc_id = career.mission_arc.id), '{}')
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
			ID            string   `json:"id"`
			Slug          string   `json:"slug"`
			TitleJa       string   `json:"titleJa"`
			TitleVi       string   `json:"titleVi"`
			RankCodeEntry string   `json:"rankCodeEntry"`
			Status        string   `json:"status"`
			DisplayOrder  int      `json:"displayOrder"`
			ChapterIDs    []string `json:"chapterIds"`
			storyCatalogue
		}
		var arcs []Arc
		for rows.Next() {
			var a Arc
			var payload json.RawMessage
			if err := rows.Scan(&a.ID, &a.Slug, &a.TitleJa, &a.TitleVi, &a.RankCodeEntry, &a.Status, &a.DisplayOrder, &payload, &a.ChapterIDs); err != nil {
				logger.Error("scan story arc", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			a.storyCatalogue = parseStoryCatalogue(payload)
			arcs = append(arcs, a)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate story arcs", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
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
			ID               string `json:"id"`
			Slug             string `json:"slug"`
			TitleJa          string `json:"titleJa"`
			TitleVi          string `json:"titleVi"`
			DisplayOrder     int    `json:"displayOrder"`
			IsBoss           bool   `json:"isBoss"`
			EstimatedMinutes int    `json:"estimatedMinutes"`
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
			if errors.Is(err, pgx.ErrNoRows) {
				writeJSONError(w, "arc not found", http.StatusNotFound)
				return
			}
			logger.Error("get story arc", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		const chQ = `SELECT id, slug, title_ja, title_vi, display_order, is_boss, briefing_payload
			FROM career.mission_chapter WHERE arc_id = $1 ORDER BY display_order ASC`
		cRows, err := db.Query(r.Context(), chQ, ad.ID)
		if err != nil {
			logger.Error("list story arc chapters", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer cRows.Close()
		for cRows.Next() {
			var ch Chapter
			var briefing json.RawMessage
			if err := cRows.Scan(&ch.ID, &ch.Slug, &ch.TitleJa, &ch.TitleVi, &ch.DisplayOrder, &ch.IsBoss, &briefing); err != nil {
				logger.Error("scan story arc chapter", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			ch.EstimatedMinutes = parseStoryBriefing(briefing).EstimatedMinutes
			ad.Chapters = append(ad.Chapters, ch)
		}
		if err := cRows.Err(); err != nil {
			logger.Error("iterate story arc chapters", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
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
		if raw := r.URL.Query().Get("limit"); raw != "" {
			parsed, err := strconv.Atoi(raw)
			if err != nil || parsed < 1 || parsed > 100 {
				writeJSONError(w, "limit must be an integer between 1 and 100", http.StatusBadRequest)
				return
			}
			limit = parsed
		}
		if raw := r.URL.Query().Get("offset"); raw != "" {
			parsed, err := strconv.Atoi(raw)
			if err != nil || parsed < 0 {
				writeJSONError(w, "offset must be a nonnegative integer", http.StatusBadRequest)
				return
			}
			offset = parsed
		}
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

		lexemes := make([]Lexeme, 0, limit)
		batchSize := max(50, limit)
		rawOffset := 0
		// Offset counts usable entries; raw batches keep reads bounded across rejected imports.
		for {
			var query string
			var args []interface{}
			if q != "" && jlpt != "" {
				query = `SELECT id, headword, reading, kanji_meaning_vi, jlpt_level, short_meaning_vi
					FROM content.lexeme WHERE status = 'active' AND (headword ILIKE $1 OR reading ILIKE $1) AND jlpt_level = $2
					ORDER BY headword ASC, id ASC LIMIT $3 OFFSET $4`
				args = []interface{}{"%" + q + "%", jlpt, batchSize, rawOffset}
			} else if q != "" {
				query = `SELECT id, headword, reading, kanji_meaning_vi, jlpt_level, short_meaning_vi
					FROM content.lexeme WHERE status = 'active' AND (headword ILIKE $1 OR reading ILIKE $1)
					ORDER BY headword ASC, id ASC LIMIT $2 OFFSET $3`
				args = []interface{}{"%" + q + "%", batchSize, rawOffset}
			} else if jlpt != "" {
				query = `SELECT id, headword, reading, kanji_meaning_vi, jlpt_level, short_meaning_vi
					FROM content.lexeme WHERE status = 'active' AND jlpt_level = $1
					ORDER BY headword ASC, id ASC LIMIT $2 OFFSET $3`
				args = []interface{}{jlpt, batchSize, rawOffset}
			} else {
				query = `SELECT id, headword, reading, kanji_meaning_vi, jlpt_level, short_meaning_vi
					FROM content.lexeme WHERE status = 'active'
					ORDER BY headword ASC, id ASC LIMIT $1 OFFSET $2`
				args = []interface{}{batchSize, rawOffset}
			}

			rows, err := db.Query(r.Context(), query, args...)
			if err != nil {
				logger.Error("list lexemes", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			scanned := 0
			for rows.Next() {
				scanned++
				var l Lexeme
				if err := rows.Scan(&l.ID, &l.Headword, &l.Reading, &l.KanjiMeaningVi, &l.JLPTLevel, &l.ShortMeaningVi); err != nil {
					rows.Close()
					logger.Error("scan lexeme", "error", err)
					writeJSONError(w, "internal error", http.StatusInternalServerError)
					return
				}
				if !dictionaryGlossUsable(l.Headword, l.ShortMeaningVi) || !dictionaryGlossUsable(l.Headword, l.KanjiMeaningVi) {
					continue
				}
				if offset > 0 {
					offset--
					continue
				}
				lexemes = append(lexemes, l)
				if len(lexemes) == limit {
					break
				}
			}
			rows.Close()
			if err := rows.Err(); err != nil {
				logger.Error("iterate lexemes", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			if len(lexemes) == limit || scanned < batchSize {
				break
			}
			rawOffset += scanned
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

		type ExampleSentence struct {
			ID            string  `json:"id"`
			JapaneseText  string  `json:"japaneseText"`
			Reading       *string `json:"reading"`
			TranslationVi *string `json:"translationVi"`
		}
		type ExampleLink struct {
			ExampleSentence *ExampleSentence `json:"exampleSentence"`
		}
		type Sense struct {
			ID           string        `json:"id"`
			Position     int           `json:"position"`
			MeaningVi    string        `json:"meaningVi"`
			PartOfSpeech *string       `json:"partOfSpeech"`
			ExampleLinks []ExampleLink `json:"exampleLinks"`
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

		if !dictionaryGlossUsable(ld.Headword, ld.ShortMeaningVi) {
			ld.ShortMeaningVi = nil
		}
		if !dictionaryGlossUsable(ld.Headword, ld.KanjiMeaningVi) {
			ld.KanjiMeaningVi = nil
		}

		const senseQ = `SELECT id::text, position, meaning_vi, part_of_speech FROM content.lexeme_sense
			WHERE lexeme_id = $1 ORDER BY position ASC LIMIT 20`
		sRows, err := db.Query(r.Context(), senseQ, id)
		if err != nil {
			logger.Error("list lexeme senses", "lexeme_id", id, "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer sRows.Close()
		for sRows.Next() {
			var s Sense
			if err := sRows.Scan(&s.ID, &s.Position, &s.MeaningVi, &s.PartOfSpeech); err != nil {
				logger.Error("scan lexeme sense", "lexeme_id", id, "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			if dictionaryGlossUsable(ld.Headword, &s.MeaningVi) {
				ld.Senses = append(ld.Senses, s)
			}
		}
		if err := sRows.Err(); err != nil {
			logger.Error("iterate lexeme senses", "lexeme_id", id, "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		sRows.Close()
		for i := range ld.Senses {
			s := &ld.Senses[i]
			const exampleQ = `SELECT es.id::text, es.japanese_text, es.reading, es.translation_vi
				FROM content.lexeme_sense_example lse
				JOIN content.example_sentence es ON es.id = lse.example_sentence_id AND es.status = 'active'
				WHERE lse.sense_id = $1 ORDER BY lse.created_at ASC LIMIT 20`
			eRows, err := db.Query(r.Context(), exampleQ, s.ID)
			if err != nil {
				logger.Error("list lexeme sense examples", "sense_id", s.ID, "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			for eRows.Next() {
				var example ExampleSentence
				if err := eRows.Scan(&example.ID, &example.JapaneseText, &example.Reading, &example.TranslationVi); err != nil {
					eRows.Close()
					logger.Error("scan lexeme sense example", "sense_id", s.ID, "error", err)
					writeJSONError(w, "internal error", http.StatusInternalServerError)
					return
				}
				s.ExampleLinks = append(s.ExampleLinks, ExampleLink{ExampleSentence: &example})
			}
			if err := eRows.Err(); err != nil {
				eRows.Close()
				logger.Error("iterate lexeme sense examples", "sense_id", s.ID, "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			eRows.Close()
			if s.ExampleLinks == nil {
				s.ExampleLinks = []ExampleLink{}
			}
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
		err := db.QueryRow(r.Context(), q, identity.UserID).Scan(&targetMinutes)
		isSet := err == nil
		if errors.Is(err, pgx.ErrNoRows) {
			targetMinutes = 15 // default
		} else if err != nil {
			logger.Error("get study goal", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]any{"targetMinutes": targetMinutes, "isSet": isSet})
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

type loginBonusReward struct {
	Day         int    `json:"day"`
	Type        string `json:"type"`
	Value       string `json:"value"`
	Label       string `json:"label"`
	Claimed     bool   `json:"claimed"`
	Current     bool   `json:"current"`
	IsBigReward bool   `json:"isBigReward"`
}

var dailyLoginRewards = [...]struct {
	typeName string
	value    string
	label    string
}{
	{"xp", "10", "+10 XP"}, {"xp", "15", "+15 XP"}, {"xp", "20", "+20 XP"},
	{"xp", "20", "+20 XP"}, {"xp", "25", "+25 XP"}, {"xp", "30", "+30 XP"},
	{"xp", "50", "+50 XP"},
}

func tokyoDayBounds(now time.Time) (time.Time, time.Time, string) {
	tokyo := time.FixedZone("Asia/Tokyo", 9*60*60)
	local := now.In(tokyo)
	start := time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, tokyo)
	return start, start.AddDate(0, 0, 1), start.Format("2006-01-02")
}

func loginBonusSchedule(claimedDays map[int]bool, currentDay int) []loginBonusReward {
	rewards := make([]loginBonusReward, 7)
	for i := range rewards {
		day := i + 1
		daily := dailyLoginRewards[i]
		rewards[i] = loginBonusReward{Day: day, Type: daily.typeName, Value: daily.value, Label: daily.label,
			Claimed: claimedDays[day], Current: day == currentDay, IsBigReward: day == len(dailyLoginRewards)}
	}
	return rewards
}

func applyConfiguredXPReward(ctx context.Context, tx pgx.Tx, userID string, value int) error {
	if value < 0 {
		return errors.New("negative XP reward")
	}
	_, err := tx.Exec(ctx, `INSERT INTO career.user_career_state
		(user_id,current_rank_code,rank_xp,jp_work_name,company_theme,hire_date,streak_days,updated_at)
		VALUES($1,'R1',$2,'','',CURRENT_DATE,0,NOW())
		ON CONFLICT(user_id) DO UPDATE SET rank_xp=career.user_career_state.rank_xp+EXCLUDED.rank_xp,updated_at=NOW()`, userID, value)
	return err
}

// getLoginBonusHandler implements GET /api/gamification/login-bonus.
func getLoginBonusHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		dayStart, _, today := tokyoDayBounds(time.Now())
		const q = `SELECT chain_day, last_claim_date, chain_start_date FROM gamification.login_bonus_chain WHERE user_id = $1`
		var chainDay int
		var lastClaimDate *time.Time
		var chainStartDate time.Time
		err := db.QueryRow(r.Context(), q, identity.UserID).Scan(&chainDay, &lastClaimDate, &chainStartDate)
		if errors.Is(err, pgx.ErrNoRows) {
			chainStartDate = dayStart
		} else if err != nil {
			logger.Error("get login bonus chain", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		canClaim := lastClaimDate == nil || lastClaimDate.Format("2006-01-02") != today
		currentDay := 1
		if lastClaimDate != nil {
			switch {
			case lastClaimDate.Format("2006-01-02") == today:
				currentDay = (chainDay-1)%7 + 1
			case lastClaimDate.AddDate(0, 0, 1).Format("2006-01-02") == today:
				currentDay = chainDay%7 + 1
				if chainDay >= 7 {
					chainStartDate = dayStart
				}
			default:
				chainStartDate = dayStart
			}
		}
		claimedDays := make(map[int]bool)
		periodStart := time.Date(chainStartDate.Year(), chainStartDate.Month(), chainStartDate.Day(), 0, 0, 0, 0, dayStart.Location())
		periodEnd := periodStart.AddDate(0, 0, 7)
		rows, err := db.Query(r.Context(), `SELECT chain_day FROM gamification.login_bonus_claim
			WHERE user_id=$1 AND claimed_at >= $2 AND claimed_at < $3`, identity.UserID, periodStart, periodEnd)
		if err != nil {
			logger.Error("get login bonus claims", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		for rows.Next() {
			var day int
			if err := rows.Scan(&day); err != nil {
				rows.Close()
				logger.Error("scan login bonus claims", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			claimedDays[day] = true
		}
		if err := rows.Err(); err != nil {
			rows.Close()
			logger.Error("read login bonus claims", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		rows.Close()
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"chainDay": currentDay, "canClaim": canClaim,
			"startDate": chainStartDate.Format("2006-01-02"),
			"rewards":   loginBonusSchedule(claimedDays, currentDay),
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
		_, _, today := tokyoDayBounds(time.Now())
		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin login bonus claim", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(r.Context())

		// Upsert chain
		const chainQ = `INSERT INTO gamification.login_bonus_chain (user_id, chain_day, last_claim_date, chain_start_date, created_at, updated_at)
			VALUES ($1, 1, $2::date, $2::date, NOW(), NOW())
			ON CONFLICT (user_id) DO UPDATE SET
			chain_day = CASE WHEN login_bonus_chain.last_claim_date = ($2::date - INTERVAL '1 day')
				THEN CASE WHEN login_bonus_chain.chain_day >= 7 THEN 1 ELSE login_bonus_chain.chain_day + 1 END
				ELSE 1 END,
			last_claim_date = $2::date,
			chain_start_date = CASE WHEN login_bonus_chain.last_claim_date = ($2::date - INTERVAL '1 day') AND login_bonus_chain.chain_day < 7
				THEN login_bonus_chain.chain_start_date ELSE $2::date END,
			updated_at = NOW()
			WHERE login_bonus_chain.last_claim_date IS DISTINCT FROM $2::date
			RETURNING chain_day`
		var chainDay int
		err = tx.QueryRow(r.Context(), chainQ, identity.UserID, today).Scan(&chainDay)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "already claimed today", http.StatusConflict)
			return
		}
		if err != nil {
			logger.Error("claim login bonus chain", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		reward := dailyLoginRewards[chainDay-1]
		const claimQ = `INSERT INTO gamification.login_bonus_claim (user_id, chain_day, reward_type, reward_value, claimed_at)
			VALUES ($1, $2, $3, $4, NOW()) RETURNING id`
		var claimID string
		if err := tx.QueryRow(r.Context(), claimQ, identity.UserID, chainDay, reward.typeName, reward.value).Scan(&claimID); err != nil {
			logger.Error("record login bonus claim", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		rewardValue, err := strconv.Atoi(reward.value)
		if err != nil {
			logger.Error("parse login bonus reward", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := applyConfiguredXPReward(r.Context(), tx, identity.UserID, rewardValue); err != nil {
			logger.Error("apply login bonus reward", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			logger.Error("commit login bonus claim", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"claimed": true, "chainDay": chainDay,
			"reward": map[string]string{"type": reward.typeName, "value": reward.value, "label": reward.label}})
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
		dayStart, _, today := tokyoDayBounds(time.Now())
		var todayReward map[string]interface{}
		var slug, nameVi, rewardType, rarity, iconEmoji string
		var rewardValue int
		var description *string
		err := db.QueryRow(r.Context(), `SELECT mr.slug, mr.name_vi, mr.reward_type, mr.reward_value,
			mr.rarity, mr.icon_emoji, mr.description FROM gamification.mystery_box_claim mbc
			JOIN gamification.mystery_box_reward mr ON mr.id=mbc.reward_id
			WHERE mbc.user_id=$1 AND mbc.claim_date=$2::date`, identity.UserID, today).Scan(
			&slug, &nameVi, &rewardType, &rewardValue, &rarity, &iconEmoji, &description)
		if errors.Is(err, pgx.ErrNoRows) {
			err = nil
		} else if err != nil {
			logger.Error("get mystery box claim", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		} else {
			todayReward = map[string]interface{}{"slug": slug, "nameVi": nameVi, "rewardType": rewardType,
				"rewardValue": rewardValue, "rarity": rarity, "iconEmoji": iconEmoji, "description": description}
		}
		goalComplete, err := dailyStudyGoalComplete(r.Context(), db, identity.UserID, dayStart)
		if err != nil {
			logger.Error("get mystery box study goal", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"opened": todayReward != nil,
			"canOpen": goalComplete && todayReward == nil, "goalComplete": goalComplete, "todayReward": todayReward})
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
		dayStart, _, today := tokyoDayBounds(time.Now())
		goalComplete, err := dailyStudyGoalComplete(r.Context(), db, identity.UserID, dayStart)
		if err != nil {
			logger.Error("check mystery box study goal", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if !goalComplete {
			writeJSONError(w, "daily study goal not complete", http.StatusForbidden)
			return
		}
		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin mystery box claim", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(r.Context())

		const rewardQ = `SELECT id, slug, name_vi, reward_type, reward_value, rarity, icon_emoji, description
			FROM gamification.mystery_box_reward WHERE active = true AND weight > 0 AND reward_type='xp'
			ORDER BY -LN(1.0 - RANDOM()) / weight LIMIT 1`
		var rewardID, slug, nameVi, rewardType, rarity, iconEmoji string
		var rewardValue int
		var description *string
		if err := tx.QueryRow(r.Context(), rewardQ).Scan(&rewardID, &slug, &nameVi, &rewardType, &rewardValue, &rarity, &iconEmoji, &description); err != nil {
			logger.Error("pick mystery box reward", "error", err)
			writeJSONError(w, "no rewards available", http.StatusInternalServerError)
			return
		}
		const insertQ = `INSERT INTO gamification.mystery_box_claim (user_id, reward_id, claimed_at, claim_date)
			VALUES ($1, $2, NOW(), $3::date) ON CONFLICT (user_id, claim_date) DO NOTHING RETURNING id`
		var claimID string
		if err := tx.QueryRow(r.Context(), insertQ, identity.UserID, rewardID, today).Scan(&claimID); errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "already opened today", http.StatusConflict)
			return
		} else if err != nil {
			logger.Error("record mystery box claim", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := applyConfiguredXPReward(r.Context(), tx, identity.UserID, rewardValue); err != nil {
			logger.Error("apply mystery box reward", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			logger.Error("commit mystery box claim", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"opened": true,
			"reward": map[string]interface{}{"slug": slug, "nameVi": nameVi, "rewardType": rewardType,
				"rewardValue": rewardValue, "rarity": rarity, "iconEmoji": iconEmoji, "description": description}})
	}
}

func dailyStudyGoalComplete(ctx context.Context, db *pgxpool.Pool, userID string, dayStart time.Time) (bool, error) {
	var complete bool
	err := db.QueryRow(ctx, `SELECT COUNT(task.id)>0 AND COALESCE(BOOL_AND(task.done_count>=task.target_count),false)
		FROM gamification.daily_study_plan plan LEFT JOIN gamification.daily_study_task task ON task.plan_id=plan.id
		WHERE plan.user_id=$1 AND plan.plan_date=$2::date`, userID, dayStart.Format("2006-01-02")).Scan(&complete)
	return complete, err
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
			Kind         string          `json:"kind"`
			TemplateSlug string          `json:"templateSlug"`
			Payload      json.RawMessage `json:"payload"`
			UserID       string          `json:"userId"` // accepted for compatibility; never used as identity
		}
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16<<10)).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		req.Kind = strings.TrimSpace(req.Kind)
		kind, validKind := canonicalLearnerShareKind(req.Kind)
		payload := strings.TrimSpace(string(req.Payload))
		if !validKind || !json.Valid(req.Payload) || len(req.Payload) > 16<<10 || !strings.HasPrefix(payload, "{") {
			writeJSONError(w, "invalid share payload", http.StatusBadRequest)
			return
		}
		var optedIn bool
		if err := db.QueryRow(r.Context(), `SELECT share_postcard_opt_in FROM profile.user_profile WHERE id=$1 AND status='active'`, identity.UserID).Scan(&optedIn); err != nil {
			logger.Error("read share consent", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if !optedIn {
			writeJSONError(w, "share postcard consent required", http.StatusForbidden)
			return
		}
		var templateID string
		if req.TemplateSlug != "" {
			if err := db.QueryRow(r.Context(), `SELECT id FROM growth.share_template WHERE slug=$1 AND kind=$2 AND active=true`, req.TemplateSlug, kind).Scan(&templateID); err != nil {
				if err == pgx.ErrNoRows {
					writeJSONError(w, "share template not found", http.StatusNotFound)
				} else {
					logger.Error("lookup share template", "error", err)
					writeJSONError(w, "internal error", http.StatusInternalServerError)
				}
				return
			}
		} else if err := db.QueryRow(r.Context(), `SELECT id FROM growth.share_template WHERE kind=$1 AND active=true ORDER BY version DESC,slug LIMIT 1`, kind).Scan(&templateID); err != nil && err != pgx.ErrNoRows {
			logger.Error("lookup share template", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		token := generateShareToken()
		const insertQ = `INSERT INTO growth.share_item (user_id, template_id, public_token, kind, summary_payload, created_at)
			VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id`
		var itemID string
		if err := db.QueryRow(r.Context(), insertQ, identity.UserID, nullString(templateID), token, kind, req.Payload).Scan(&itemID); err != nil {
			logger.Error("create share", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusCreated, map[string]string{
			"id": itemID, "publicToken": token,
			"shareUrl":  "/vi/share/" + token,
			"imagePath": "/api/public/shares/" + token + "/image",
		})
	}
}

// shareTemplatesHandler implements GET /api/learner/share/templates.
func shareTemplatesHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		kind := r.URL.Query().Get("kind")
		if kind != "" {
			var ok bool
			kind, ok = canonicalLearnerShareKind(kind)
			if !ok {
				writeJSONError(w, "invalid share kind", http.StatusBadRequest)
				return
			}
		}
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
				logger.Error("scan share template", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			templates = append(templates, t)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate share templates", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
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
		query := r.URL.Query()
		templateID, kind := query.Get("templateId"), query.Get("kind")
		headline, sub := strings.TrimSpace(query.Get("headline")), strings.TrimSpace(query.Get("sub"))
		canonicalKind, validKind := canonicalLearnerShareKind(kind)
		if _, err := uuid.Parse(templateID); err != nil || !validKind || !validSharePreviewText(headline) || !validSharePreviewText(sub) {
			writeJSONError(w, "invalid preview input", http.StatusBadRequest)
			return
		}
		var templateKind string
		var configBytes []byte
		if err := db.QueryRow(r.Context(), `SELECT kind,config FROM growth.share_template WHERE id=$1 AND kind=$2 AND active=true`, templateID, canonicalKind).Scan(&templateKind, &configBytes); err != nil {
			if err == pgx.ErrNoRows {
				writeJSONError(w, "share template not found", http.StatusNotFound)
			} else {
				logger.Error("load share preview template", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
			}
			return
		}
		if !validSharePreviewKind(templateKind) {
			writeJSONError(w, "unsupported share template kind", http.StatusBadRequest)
			return
		}
		var config adminGrowthSharePreviewConfig
		if err := json.Unmarshal(configBytes, &config); err != nil {
			logger.Error("decode share preview template config", "error", err, "template_id", templateID)
			writeJSONError(w, "invalid share template config", http.StatusInternalServerError)
			return
		}
		for _, color := range []string{config.BrandBg, config.BrandBgEnd, config.BrandFg, config.BrandAccent} {
			if color != "" && !sharePreviewHexColor.MatchString(color) {
				writeJSONError(w, "invalid share template colors", http.StatusInternalServerError)
				return
			}
		}
		if !sharePreviewBadge.MatchString(config.BadgeKey) {
			writeJSONError(w, "invalid share template badge", http.StatusInternalServerError)
			return
		}
		if config.Pattern != "" {
			if _, ok := sharePreviewPatterns[config.Pattern]; !ok {
				writeJSONError(w, "invalid share template pattern", http.StatusInternalServerError)
				return
			}
		}
		svg := renderSharePreviewSVG(adminGrowthSharePreviewRequest{Headline: headline, Sub: sub, Kind: templateKind, Config: config})
		w.Header().Set("Content-Type", "image/svg+xml; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(svg))
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
		var req json.RawMessage = json.RawMessage(`{}`)
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16<<10)).Decode(&req); err != nil && !errors.Is(err, io.EOF) {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if len(req) > 16<<10 || !json.Valid(req) || !strings.HasPrefix(strings.TrimSpace(string(req)), "{") {
			writeJSONError(w, "invalid share payload", http.StatusBadRequest)
			return
		}
		var optedIn bool
		if err := db.QueryRow(r.Context(), `SELECT share_postcard_opt_in FROM profile.user_profile WHERE id=$1 AND status='active'`, identity.UserID).Scan(&optedIn); err != nil {
			logger.Error("read pet share consent", "error", err, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if !optedIn {
			writeJSONError(w, "share postcard consent required", http.StatusForbidden)
			return
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
		writeJSON(w, http.StatusCreated, map[string]string{
			"id": itemID, "publicToken": token,
			"shareUrl":  "/vi/share/" + token,
			"imagePath": "/api/public/shares/" + token + "/image",
		})
	}
}

func canonicalLearnerShareKind(kind string) (string, bool) {
	switch kind {
	case "battle":
		kind = "battle_win"
	case "achievement":
		kind = "postcard_achievement"
	case "streak":
		kind = "postcard_streak"
	case "level_up":
		kind = "postcard_level_up"
	}
	for _, allowed := range growthPostcardKinds {
		if kind == allowed {
			return kind, true
		}
	}
	return "", false
}

// ── Magazine / Loto ─────────────────────────────────────────────────────────

// listMagazineHandler implements GET /api/magazine.
func listMagazineHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		filter := r.URL.Query().Get("kind")
		if filter == "" {
			filter = r.URL.Query().Get("widgetKind")
		}
		var widgetKinds []string
		switch filter {
		case "", "all":
		case "vocab":
			widgetKinds = []string{"magazine_vocab"}
		case "weather":
			widgetKinds = []string{"magazine_weather"}
		case "horoscope":
			widgetKinds = []string{"magazine_horoscope"}
		case "loto":
			widgetKinds = []string{"magazine_loto", "magazine_loto6", "magazine_loto7"}
		case "bjt_phrase":
			widgetKinds = []string{"magazine_bjt_phrase"}
		default:
			widgetKinds = []string{filter}
		}
		page := magazineListQueryInt(r.URL.Query().Get("page"), 1, 1_000_000)
		limit := magazineListQueryInt(r.URL.Query().Get("limit"), 20, 100)

		countQuery := `SELECT COUNT(*) FROM daily.magazine_article WHERE status='published'`
		listQuery := `SELECT a.id, a.slug, a.widget_kind, a.title_jp, a.title_vi, a.summary_vi, a.cover_image_url,
			a.content_date::text, a.published_at, a.jlpt_level,
			COALESCE((SELECT jsonb_agg(jsonb_build_object('word', v.word_jp, 'reading', v.reading, 'meaning', v.meaning_vi)
				ORDER BY v.display_order, v.id) FROM daily.magazine_vocab_item v WHERE v.article_id=a.id), '[]'::jsonb)
			FROM daily.magazine_article a WHERE a.status='published'
			ORDER BY a.content_date DESC, a.published_at DESC NULLS LAST, a.id LIMIT $1 OFFSET $2`
		countArgs := []any{}
		listArgs := []any{limit, 0}
		if len(widgetKinds) > 0 {
			countQuery += ` AND widget_kind=ANY($1::text[])`
			listQuery = strings.Replace(listQuery, "WHERE a.status='published'", "WHERE a.status='published' AND a.widget_kind=ANY($3::text[])", 1)
			countArgs = append(countArgs, widgetKinds)
			listArgs = append(listArgs, widgetKinds)
		}
		var total int
		if err := db.QueryRow(r.Context(), countQuery, countArgs...).Scan(&total); err != nil {
			logger.Error("count magazine articles", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		totalPages := (total + limit - 1) / limit
		if totalPages == 0 {
			page = 1
		} else if page > totalPages {
			page = totalPages
		}
		offset := (page - 1) * limit
		listArgs[1] = offset
		rows, err := db.Query(r.Context(), listQuery, listArgs...)
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
			SummaryVi   *string `json:"summaryVi"`
			CoverImage  *string `json:"coverImageUrl,omitempty"`
			PublishDate string  `json:"publishDate"`
			PublishedAt *string `json:"publishedAt,omitempty"`
			JLPTLevel   *string `json:"jlptLevel,omitempty"`
			VocabWords  []struct {
				Word    string `json:"word"`
				Reading string `json:"reading"`
				Meaning string `json:"meaning"`
			} `json:"vocabWords"`
		}
		var articles []Article
		for rows.Next() {
			var a Article
			var pubAt *time.Time
			var rawVocab []byte
			if err := rows.Scan(&a.ID, &a.Slug, &a.WidgetKind, &a.TitleJp, &a.TitleVi, &a.SummaryVi, &a.CoverImage, &a.PublishDate, &pubAt, &a.JLPTLevel, &rawVocab); err != nil {
				logger.Error("scan magazine article", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			if pubAt != nil {
				s := pubAt.Format(time.RFC3339)
				a.PublishedAt = &s
			}
			if err := json.Unmarshal(rawVocab, &a.VocabWords); err != nil {
				logger.Error("decode magazine vocabulary preview", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			if a.VocabWords == nil {
				a.VocabWords = []struct {
					Word    string `json:"word"`
					Reading string `json:"reading"`
					Meaning string `json:"meaning"`
				}{}
			}
			articles = append(articles, a)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate magazine articles", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if articles == nil {
			articles = []Article{}
		}
		writeJSON(w, http.StatusOK, map[string]any{"data": articles, "total": total, "page": page, "limit": limit})
	}
}

func magazineListQueryInt(raw string, fallback, maximum int) int {
	value, err := strconv.Atoi(raw)
	if err != nil || value < 1 {
		return fallback
	}
	if value > maximum {
		return maximum
	}
	return value
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
				logger.Error("scan magazine today article", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			articles = append(articles, a)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate magazine today articles", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
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
		type VocabItem struct {
			ID        string  `json:"id"`
			WordJp    string  `json:"wordJp"`
			Reading   string  `json:"reading"`
			MeaningVi string  `json:"meaningVi"`
			JLPTLevel *string `json:"jlptLevel,omitempty"`
			ExampleJp *string `json:"exampleJp,omitempty"`
			ExampleVi *string `json:"exampleVi,omitempty"`
		}
		type QuizOption struct {
			Label     string `json:"label"`
			IsCorrect bool   `json:"isCorrect"`
		}
		type QuizItem struct {
			QuestionJp    string       `json:"questionJp"`
			QuestionVi    *string      `json:"questionVi,omitempty"`
			Options       []QuizOption `json:"options"`
			ExplanationJp *string      `json:"explanationJp,omitempty"`
			ExplanationVi *string      `json:"explanationVi,omitempty"`
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
			VocabItems  []VocabItem     `json:"vocabItems"`
			Quizzes     []QuizItem      `json:"quizzes"`
		}
		var a Article
		var pubAt *time.Time
		const q = `SELECT id, slug, widget_kind, title_jp, title_vi, summary_jp, summary_vi,
			cover_image_url, content_json, jlpt_level, published_at
			FROM daily.magazine_article WHERE slug = $1 AND status = 'published'`
		if err := db.QueryRow(r.Context(), q, slug).Scan(&a.ID, &a.Slug, &a.WidgetKind, &a.TitleJp, &a.TitleVi,
			&a.SummaryJp, &a.SummaryVi, &a.CoverImage, &a.ContentJSON, &a.JLPTLevel, &pubAt); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				writeJSONError(w, "article not found", http.StatusNotFound)
				return
			}
			logger.Error("get magazine article", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if pubAt != nil {
			s := pubAt.Format(time.RFC3339)
			a.PublishedAt = &s
		}
		a.VocabItems = []VocabItem{}
		vocabRows, err := db.Query(r.Context(), `SELECT id::text, word_jp, reading, meaning_vi, jlpt_level, sentence_jp, sentence_vi
			FROM daily.magazine_vocab_item WHERE article_id=$1 ORDER BY display_order, id`, a.ID)
		if err != nil {
			logger.Error("get magazine vocabulary", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		for vocabRows.Next() {
			var item VocabItem
			if err := vocabRows.Scan(&item.ID, &item.WordJp, &item.Reading, &item.MeaningVi, &item.JLPTLevel, &item.ExampleJp, &item.ExampleVi); err != nil {
				vocabRows.Close()
				logger.Error("scan magazine vocabulary", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			a.VocabItems = append(a.VocabItems, item)
		}
		if err := vocabRows.Err(); err != nil {
			vocabRows.Close()
			logger.Error("iterate magazine vocabulary", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		vocabRows.Close()
		a.Quizzes = []QuizItem{}
		quizRows, err := db.Query(r.Context(), `SELECT question_jp, question_vi, options, correct_answer, explanation_jp, explanation_vi
			FROM daily.magazine_quiz WHERE article_id=$1 ORDER BY display_order, id`, a.ID)
		if err != nil {
			logger.Error("get magazine quiz", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		for quizRows.Next() {
			var item QuizItem
			var rawOptions []byte
			var answer string
			if err := quizRows.Scan(&item.QuestionJp, &item.QuestionVi, &rawOptions, &answer, &item.ExplanationJp, &item.ExplanationVi); err != nil {
				quizRows.Close()
				logger.Error("scan magazine quiz", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			var options []string
			if err := json.Unmarshal(rawOptions, &options); err != nil {
				quizRows.Close()
				logger.Error("decode magazine quiz options", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			item.Options = make([]QuizOption, 0, len(options))
			for _, option := range options {
				item.Options = append(item.Options, QuizOption{Label: option, IsCorrect: option == answer})
			}
			a.Quizzes = append(a.Quizzes, item)
		}
		if err := quizRows.Err(); err != nil {
			quizRows.Close()
			logger.Error("iterate magazine quiz", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		quizRows.Close()
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
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var input struct {
			QuizScore *int `json:"quizScore"`
			QuizTotal *int `json:"quizTotal"`
		}
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1024)).Decode(&input); err != nil || input.QuizScore == nil || input.QuizTotal == nil || *input.QuizTotal < 1 || *input.QuizScore < 0 || *input.QuizScore > *input.QuizTotal {
			writeJSONError(w, "invalid quiz result", http.StatusBadRequest)
			return
		}
		const insertQ = `INSERT INTO daily.magazine_user_read (user_id, article_id, read_at, quiz_score, quiz_total)
			SELECT $1, id, NOW(), $3, $4 FROM daily.magazine_article WHERE slug=$2 AND status='published'
			ON CONFLICT (user_id, article_id) DO UPDATE SET read_at=NOW(), quiz_score=EXCLUDED.quiz_score, quiz_total=EXCLUDED.quiz_total`
		tag, err := db.Exec(r.Context(), insertQ, identity.UserID, slug, *input.QuizScore, *input.QuizTotal)
		if err != nil {
			logger.Error("mark magazine read", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if tag.RowsAffected() == 0 {
			writeJSONError(w, "article not found", http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]any{"read": true, "quizScore": *input.QuizScore, "quizTotal": *input.QuizTotal})
	}
}

// lotoFeedHandler implements GET /api/magazine/loto/feed.
func lotoFeedHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		game := r.URL.Query().Get("game")
		if game == "" {
			game = "loto6"
		}
		if !isValidLotoGame(game) {
			writeJSONError(w, "game must be loto6 or loto7", http.StatusBadRequest)
			return
		}
		page := queryInt(r, "page", 1)
		limit := queryInt(r, "limit", 10)
		if page < 1 {
			page = 1
		}
		if limit < 1 {
			limit = 10
		}
		if limit > 50 {
			limit = 50
		}
		var total int
		if err := db.QueryRow(r.Context(), `SELECT COUNT(*) FROM daily.loto_draw WHERE game = $1`, game).Scan(&total); err != nil {
			logger.Error("loto feed count", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if total > 0 {
			lastPage := (total + limit - 1) / limit
			if page > lastPage {
				page = lastPage
			}
		}
		const q = `SELECT id, game, draw_number, draw_date, main_numbers, bonus_numbers
			FROM daily.loto_draw WHERE game = $1 ORDER BY draw_date DESC LIMIT $2 OFFSET $3`
		rows, err := db.Query(r.Context(), q, game, limit, (page-1)*limit)
		if err != nil {
			logger.Error("loto feed", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type Draw struct {
			ID           string           `json:"id"`
			Game         string           `json:"game"`
			DrawNumber   int              `json:"drawNumber"`
			DrawDate     string           `json:"drawDate"`
			MainNumbers  []int            `json:"mainNumbers"`
			BonusNumbers []int            `json:"bonusNumbers"`
			Sets         []map[string]any `json:"sets"`
			Result       map[string]any   `json:"result"`
			HitCount     int              `json:"hitCount"`
			BonusHit     bool             `json:"bonusHit"`
			JPSentence   any              `json:"jpSentence"`
		}
		var draws []Draw
		for rows.Next() {
			var d Draw
			var drawDate time.Time
			if err := rows.Scan(&d.ID, &d.Game, &d.DrawNumber, &drawDate, &d.MainNumbers, &d.BonusNumbers); err != nil {
				logger.Error("loto feed scan", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			d.DrawDate = drawDate.Format("2006-01-02")
			d.Sets = []map[string]any{}
			if d.MainNumbers == nil {
				d.MainNumbers = []int{}
			}
			if d.BonusNumbers == nil {
				d.BonusNumbers = []int{}
			}
			d.Result = map[string]any{"mainNumbers": d.MainNumbers, "bonusNumbers": d.BonusNumbers}
			predictionRows, err := db.Query(r.Context(), `SELECT gs.main_numbers, gs.bonus_numbers, gs.score, gr.japanese_sentence_json
				FROM daily.loto_generation_run gr
				JOIN daily.loto_generated_set gs ON gs.run_id=gr.id
				WHERE gr.game=$1 AND gr.target_draw_date=$2 AND gr.status='published' AND gs.selected_for_magazine=true
				ORDER BY gs.rank`, game, drawDate)
			if err != nil {
				logger.Error("loto feed published predictions", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			for predictionRows.Next() {
				var main, bonus []int
				var score float64
				var sentenceJSON []byte
				if err := predictionRows.Scan(&main, &bonus, &score, &sentenceJSON); err != nil {
					predictionRows.Close()
					logger.Error("loto feed prediction scan", "error", err)
					writeJSONError(w, "internal error", http.StatusInternalServerError)
					return
				}
				if main == nil {
					main = []int{}
				}
				if bonus == nil {
					bonus = []int{}
				}
				d.Sets = append(d.Sets, map[string]any{"mainNumbers": main, "bonusNumbers": bonus, "score": score})
				if len(d.Sets) == 1 {
					actual := make(map[int]bool, len(d.MainNumbers))
					for _, n := range d.MainNumbers {
						actual[n] = true
					}
					for _, n := range main {
						if actual[n] {
							d.HitCount++
						}
					}
					for _, n := range bonus {
						for _, actualBonus := range d.BonusNumbers {
							if n == actualBonus {
								d.BonusHit = true
							}
						}
					}
				}
				if len(sentenceJSON) > 0 && json.Valid(sentenceJSON) && string(sentenceJSON) != "null" {
					_ = json.Unmarshal(sentenceJSON, &d.JPSentence)
				}
			}
			if err := predictionRows.Err(); err != nil {
				predictionRows.Close()
				logger.Error("loto feed prediction rows", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			predictionRows.Close()
			draws = append(draws, d)
		}
		if err := rows.Err(); err != nil {
			logger.Error("loto feed rows", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if draws == nil {
			draws = []Draw{}
		}
		writeJSON(w, http.StatusOK, map[string]any{"data": draws, "total": total, "page": page, "limit": limit})
	}
}

// lotoNextDrawHandler implements GET /api/magazine/loto/next-draw.
func lotoNextDrawHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		game := r.URL.Query().Get("game")
		if game == "" {
			game = "loto6"
		}
		if !isValidLotoGame(game) {
			writeJSONError(w, "game must be loto6 or loto7", http.StatusBadRequest)
			return
		}
		const q = `SELECT id, target_draw_date, japanese_sentence_json FROM daily.loto_generation_run
			WHERE game = $1 AND status = 'published' AND target_draw_date > CURRENT_DATE
			AND EXISTS (SELECT 1 FROM daily.loto_generated_set gs WHERE gs.run_id = daily.loto_generation_run.id AND gs.selected_for_magazine = true)
			ORDER BY target_draw_date ASC, created_at DESC LIMIT 1`
		var id string
		var drawDate time.Time
		var sentenceJSON []byte
		if err := db.QueryRow(r.Context(), q, game).Scan(&id, &drawDate, &sentenceJSON); err != nil {
			if !errors.Is(err, pgx.ErrNoRows) {
				logger.Error("loto next draw", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"nextDraw": nil})
			return
		}
		setRows, err := db.Query(r.Context(), `SELECT main_numbers, bonus_numbers, score FROM daily.loto_generated_set WHERE run_id=$1 AND selected_for_magazine=true ORDER BY rank LIMIT 3`, id)
		if err != nil {
			logger.Error("loto next draw sets", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer setRows.Close()
		sets := make([]map[string]any, 0, 3)
		for setRows.Next() {
			var mainNumbers, bonusNumbers []int
			var score float64
			if err := setRows.Scan(&mainNumbers, &bonusNumbers, &score); err != nil {
				logger.Error("loto next draw set scan", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			sets = append(sets, map[string]any{"mainNumbers": mainNumbers, "bonusNumbers": bonusNumbers, "score": score})
		}
		if err := setRows.Err(); err != nil {
			logger.Error("loto next draw sets", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		var sentence any
		if len(sentenceJSON) > 0 && json.Valid(sentenceJSON) && string(sentenceJSON) != "null" {
			_ = json.Unmarshal(sentenceJSON, &sentence)
		}
		now := time.Now().UTC()
		today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
		daysUntil := int(drawDate.UTC().Sub(today).Hours() / 24)
		writeJSON(w, http.StatusOK, map[string]any{"nextDraw": map[string]any{
			"id": id, "game": game, "drawNumber": nil, "drawDate": drawDate.Format("2006-01-02"),
			"sets": sets, "jpSentence": sentence, "vocabItems": []any{}, "confidence": nil, "daysUntil": daysUntil,
		}})
	}
}

// lotoStatsHandler implements GET /api/magazine/loto/stats.
func lotoStatsHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		game := r.URL.Query().Get("game")
		if game == "" {
			game = "loto6"
		}
		if !isValidLotoGame(game) {
			writeJSONError(w, "game must be loto6 or loto7", http.StatusBadRequest)
			return
		}
		const q = `SELECT COUNT(*), MAX(draw_date), MIN(draw_date) FROM daily.loto_draw WHERE game = $1`
		var total int
		var maxDate, minDate *time.Time
		if err := db.QueryRow(r.Context(), q, game).Scan(&total, &maxDate, &minDate); err != nil {
			logger.Error("loto stats", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
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
