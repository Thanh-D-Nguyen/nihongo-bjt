package httpserver

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// listKanjiHandler implements GET /api/kanji.
// Public route — supports q, limit, offset query params.
func listKanjiHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query().Get("q")
		limit, offset := 50, 0
		if raw := r.URL.Query().Get("limit"); raw != "" {
			parsed, err := strconv.Atoi(raw)
			if err != nil || parsed < 1 {
				writeJSONError(w, "invalid limit parameter", http.StatusBadRequest)
				return
			}
			limit = min(parsed, 100)
		}
		if raw := r.URL.Query().Get("offset"); raw != "" {
			parsed, err := strconv.Atoi(raw)
			if err != nil || parsed < 0 {
				writeJSONError(w, "invalid offset parameter", http.StatusBadRequest)
				return
			}
			offset = parsed
		}

		type Kanji struct {
			ID          string  `json:"id"`
			Character   string  `json:"character"`
			MeaningVi   *string `json:"meaningVi,omitempty"`
			Onyomi      *string `json:"onyomi,omitempty"`
			Kunyomi     *string `json:"kunyomi,omitempty"`
			StrokeCount *int    `json:"strokeCount,omitempty"`
			Level       *int    `json:"level,omitempty"`
			Frequency   *int    `json:"frequency,omitempty"`
		}

		var query string
		var args []interface{}
		if q != "" {
			query = `SELECT id, character, meaning_vi, onyomi, kunyomi, stroke_count, level, frequency
				FROM content.kanji WHERE status = 'active' AND (character LIKE $1 OR meaning_vi ILIKE $1 OR onyomi ILIKE $1 OR kunyomi ILIKE $1)
				ORDER BY frequency ASC NULLS LAST LIMIT $2 OFFSET $3`
			args = []interface{}{"%" + q + "%", limit, offset}
		} else {
			query = `SELECT id, character, meaning_vi, onyomi, kunyomi, stroke_count, level, frequency
				FROM content.kanji WHERE status = 'active'
				ORDER BY frequency ASC NULLS LAST LIMIT $1 OFFSET $2`
			args = []interface{}{limit, offset}
		}

		rows, err := db.Query(r.Context(), query, args...)
		if err != nil {
			logger.Error("list kanji", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		var kanjis []Kanji
		for rows.Next() {
			var k Kanji
			if err := rows.Scan(&k.ID, &k.Character, &k.MeaningVi, &k.Onyomi, &k.Kunyomi, &k.StrokeCount, &k.Level, &k.Frequency); err != nil {
				logger.Error("scan kanji", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			kanjis = append(kanjis, k)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate kanji", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if kanjis == nil {
			kanjis = []Kanji{}
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(kanjis)
	}
}

// getKanjiDetailHandler implements GET /api/kanji/{id}.
// Public route — returns full kanji detail with examples.
func getKanjiDetailHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := extractPathParam(r.URL.Path, "kanji", 1)
		if id == "" {
			writeJSONError(w, "kanji id required", http.StatusBadRequest)
			return
		}
		if _, err := uuid.Parse(id); err != nil {
			writeJSONError(w, "invalid kanji id", http.StatusBadRequest)
			return
		}

		type Example struct {
			ID        string  `json:"id"`
			Word      string  `json:"word"`
			Reading   *string `json:"reading"`
			MeaningVi *string `json:"meaningVi"`
			HanViet   *string `json:"hanViet"`
		}
		type Component struct {
			ID        string  `json:"id"`
			Character string  `json:"character"`
			HanViet   *string `json:"hanViet"`
			Position  int     `json:"position"`
		}
		type KanjiDetail struct {
			ID            string      `json:"id"`
			Character     string      `json:"character"`
			MeaningVi     *string     `json:"meaningVi,omitempty"`
			Onyomi        *string     `json:"onyomi,omitempty"`
			Kunyomi       *string     `json:"kunyomi,omitempty"`
			StrokeCount   *int        `json:"strokeCount,omitempty"`
			Level         *int        `json:"level,omitempty"`
			Frequency     *int        `json:"frequency,omitempty"`
			Detail        *string     `json:"detail,omitempty"`
			Tip           *string     `json:"tip,omitempty"`
			ImagePath     *string     `json:"imagePath,omitempty"`
			StrokeSvgPath *string     `json:"strokeSvgPath,omitempty"`
			Examples      []Example   `json:"examples"`
			Components    []Component `json:"components"`
		}

		const q = `SELECT id, character, meaning_vi, onyomi, kunyomi, stroke_count, level, frequency, detail, tip, image_path, stroke_svg_path
			FROM content.kanji WHERE id = $1 AND status = 'active'`
		var kd KanjiDetail
		if err := db.QueryRow(r.Context(), q, id).Scan(&kd.ID, &kd.Character, &kd.MeaningVi, &kd.Onyomi, &kd.Kunyomi,
			&kd.StrokeCount, &kd.Level, &kd.Frequency, &kd.Detail, &kd.Tip, &kd.ImagePath, &kd.StrokeSvgPath); err != nil {
			if err == pgx.ErrNoRows {
				writeJSONError(w, "kanji not found", http.StatusNotFound)
			} else {
				logger.Error("get kanji", "kanji_id", id, "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
			}
			return
		}

		const exQ = `SELECT id::text, word, reading, meaning_vi, han_viet FROM content.kanji_example WHERE kanji_id = $1 ORDER BY position ASC LIMIT 20`
		eRows, err := db.Query(r.Context(), exQ, id)
		if err != nil {
			logger.Error("query kanji examples", "kanji_id", id, "error", err)
			writeJSONError(w, "unable to load kanji examples", http.StatusInternalServerError)
			return
		}
		defer eRows.Close()
		for eRows.Next() {
			var ex Example
			if err := eRows.Scan(&ex.ID, &ex.Word, &ex.Reading, &ex.MeaningVi, &ex.HanViet); err != nil {
				logger.Error("scan kanji example", "kanji_id", id, "error", err)
				writeJSONError(w, "unable to load kanji examples", http.StatusInternalServerError)
				return
			}
			kd.Examples = append(kd.Examples, ex)
		}
		if err := eRows.Err(); err != nil {
			logger.Error("iterate kanji examples", "kanji_id", id, "error", err)
			writeJSONError(w, "unable to load kanji examples", http.StatusInternalServerError)
			return
		}
		if kd.Examples == nil {
			kd.Examples = []Example{}
		}

		const componentQ = `SELECT id::text, character, han_viet, position FROM content.kanji_component WHERE kanji_id = $1 ORDER BY position ASC LIMIT 50`
		cRows, err := db.Query(r.Context(), componentQ, id)
		if err != nil {
			logger.Error("query kanji components", "kanji_id", id, "error", err)
			writeJSONError(w, "unable to load kanji components", http.StatusInternalServerError)
			return
		}
		defer cRows.Close()
		for cRows.Next() {
			var component Component
			if err := cRows.Scan(&component.ID, &component.Character, &component.HanViet, &component.Position); err != nil {
				logger.Error("scan kanji component", "kanji_id", id, "error", err)
				writeJSONError(w, "unable to load kanji components", http.StatusInternalServerError)
				return
			}
			kd.Components = append(kd.Components, component)
		}
		if err := cRows.Err(); err != nil {
			logger.Error("iterate kanji components", "kanji_id", id, "error", err)
			writeJSONError(w, "unable to load kanji components", http.StatusInternalServerError)
			return
		}
		if kd.Components == nil {
			kd.Components = []Component{}
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(kd)
	}
}

// getKanjiStrokeHandler implements GET /api/kanji/{id}/stroke.
// Public route — returns SVG stroke data.
func getKanjiStrokeHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := extractPathParam(r.URL.Path, "kanji", 1)
		if id == "" {
			writeJSONError(w, "kanji id required", http.StatusBadRequest)
			return
		}
		if _, err := uuid.Parse(id); err != nil {
			writeJSONError(w, "invalid kanji id", http.StatusBadRequest)
			return
		}

		const q = `SELECT stroke_svg_source, stroke_svg_path FROM content.kanji WHERE id = $1 AND status = 'active'`
		var svgSource, svgPath *string
		if err := db.QueryRow(r.Context(), q, id).Scan(&svgSource, &svgPath); err != nil {
			if err == pgx.ErrNoRows {
				writeJSONError(w, "kanji not found", http.StatusNotFound)
			} else {
				logger.Error("get kanji stroke", "kanji_id", id, "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
			}
			return
		}

		result := map[string]interface{}{
			"svgSource": svgSource,
			"svgPath":   svgPath,
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(result)
	}
}

// searchKanjiHandler implements GET /api/kanji/search.
// Public route — search by query param q.
func searchKanjiHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return listKanjiHandler(db, logger) // reuses same logic
}

// getKanjiWordsHandler implements GET /api/kanji/words/{id}.
// Public route — returns words containing this kanji.
func getKanjiWordsHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := extractPathParam(r.URL.Path, "words", 1)
		if id == "" {
			writeJSONError(w, "kanji id required", http.StatusBadRequest)
			return
		}
		if _, err := uuid.Parse(id); err != nil {
			writeJSONError(w, "invalid kanji id", http.StatusBadRequest)
			return
		}

		type Word struct {
			ID        string  `json:"id"`
			Text      string  `json:"text"`
			Reading   *string `json:"reading,omitempty"`
			MeaningVi *string `json:"meaningVi,omitempty"`
		}

		const q = `SELECT DISTINCT w.id::text, w.headword, w.reading, w.short_meaning_vi
			FROM content.lexeme w
			JOIN content.kanji k ON k.id = $1 AND k.status = 'active' AND position(k.character IN w.headword) > 0
			WHERE w.status = 'active'
			ORDER BY w.headword ASC LIMIT 50`
		rows, err := db.Query(r.Context(), q, id)
		if err != nil {
			logger.Error("get kanji words", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		var words []Word
		for rows.Next() {
			var word Word
			if err := rows.Scan(&word.ID, &word.Text, &word.Reading, &word.MeaningVi); err != nil {
				logger.Error("scan kanji word", "kanji_id", id, "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			words = append(words, word)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate kanji words", "kanji_id", id, "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if words == nil {
			words = []Word{}
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(words)
	}
}

// getKanjiByWordHandler implements GET /api/kanji/by-word/{wordId}.
// Public route — returns kanji in a word.
func getKanjiByWordHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		var wordID string
		for i, p := range parts {
			if p == "by-word" && i+1 < len(parts) {
				wordID = parts[i+1]
				break
			}
		}
		if wordID == "" {
			writeJSONError(w, "word id required", http.StatusBadRequest)
			return
		}
		if _, err := uuid.Parse(wordID); err != nil {
			writeJSONError(w, "invalid word id", http.StatusBadRequest)
			return
		}

		type KanjiSummary struct {
			ID        string  `json:"id"`
			Character string  `json:"character"`
			MeaningVi *string `json:"meaningVi,omitempty"`
		}

		const q = `SELECT k.id::text, k.character, k.meaning_vi
			FROM content.kanji k
			JOIN content.lexeme w ON w.id = $1 AND w.status = 'active' AND position(k.character IN w.headword) > 0
			WHERE k.status = 'active'
			ORDER BY k.character ASC`
		rows, err := db.Query(r.Context(), q, wordID)
		if err != nil {
			logger.Error("get kanji by word", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		var kanjis []KanjiSummary
		for rows.Next() {
			var k KanjiSummary
			if err := rows.Scan(&k.ID, &k.Character, &k.MeaningVi); err != nil {
				logger.Error("scan kanji by word", "word_id", wordID, "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			kanjis = append(kanjis, k)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate kanji by word", "word_id", wordID, "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if kanjis == nil {
			kanjis = []KanjiSummary{}
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(kanjis)
	}
}

// listContentKanjiHandler implements GET /api/content/kanji.
// Public route — paginated content kanji list.
func listContentKanjiHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return listKanjiHandler(db, logger) // same underlying data
}

// getContentKanjiDetailHandler implements GET /api/content/kanji/{id}.
// Public route — same as /api/kanji/{id}.
func getContentKanjiDetailHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return getKanjiDetailHandler(db, logger)
}
