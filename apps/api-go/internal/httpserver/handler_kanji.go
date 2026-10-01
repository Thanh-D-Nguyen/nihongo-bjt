package httpserver

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

// listKanjiHandler implements GET /api/kanji.
// Public route — supports q, limit, offset query params.
func listKanjiHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query().Get("q")
		limit := 50
		offset := 0

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
				FROM content.kanji WHERE status = 'active' AND (character LIKE $1 OR meaning_vi ILIKE $1)
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

		type Example struct {
			Vi        string  `json:"vi"`
			Ja        string  `json:"ja"`
			Romaji    *string `json:"romaji,omitempty"`
			SourceTag *string `json:"sourceTag,omitempty"`
		}
		type KanjiDetail struct {
			ID            string    `json:"id"`
			Character     string    `json:"character"`
			MeaningVi     *string   `json:"meaningVi,omitempty"`
			Onyomi        *string   `json:"onyomi,omitempty"`
			Kunyomi       *string   `json:"kunyomi,omitempty"`
			StrokeCount   *int      `json:"strokeCount,omitempty"`
			Level         *int      `json:"level,omitempty"`
			Frequency     *int      `json:"frequency,omitempty"`
			Detail        *string   `json:"detail,omitempty"`
			Tip           *string   `json:"tip,omitempty"`
			ImagePath     *string   `json:"imagePath,omitempty"`
			StrokeSvgPath *string   `json:"strokeSvgPath,omitempty"`
			Examples      []Example `json:"examples"`
		}

		const q = `SELECT id, character, meaning_vi, onyomi, kunyomi, stroke_count, level, frequency, detail, tip, image_path, stroke_svg_path
			FROM content.kanji WHERE id = $1 AND status = 'active'`
		var kd KanjiDetail
		if err := db.QueryRow(r.Context(), q, id).Scan(&kd.ID, &kd.Character, &kd.MeaningVi, &kd.Onyomi, &kd.Kunyomi,
			&kd.StrokeCount, &kd.Level, &kd.Frequency, &kd.Detail, &kd.Tip, &kd.ImagePath, &kd.StrokeSvgPath); err != nil {
			writeJSONError(w, "kanji not found", http.StatusNotFound)
			return
		}

		const exQ = `SELECT vi, ja, romaji, source_tag FROM content.kanji_example WHERE kanji_id = $1 ORDER BY id ASC LIMIT 20`
		eRows, err := db.Query(r.Context(), exQ, id)
		if err == nil {
			for eRows.Next() {
				var ex Example
				if err := eRows.Scan(&ex.Vi, &ex.Ja, &ex.Romaji, &ex.SourceTag); err == nil {
					kd.Examples = append(kd.Examples, ex)
				}
			}
			eRows.Close()
		}
		if kd.Examples == nil {
			kd.Examples = []Example{}
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
		parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		var id string
		for i, p := range parts {
			if p == "kanji" && i+2 < len(parts) && parts[i+2] == "stroke" {
				id = parts[i+1]
				break
			}
		}
		if id == "" {
			writeJSONError(w, "kanji id required", http.StatusBadRequest)
			return
		}

		const q = `SELECT stroke_svg_source, stroke_svg_path FROM content.kanji WHERE id = $1 AND status = 'active'`
		var svgSource, svgPath *string
		if err := db.QueryRow(r.Context(), q, id).Scan(&svgSource, &svgPath); err != nil {
			writeJSONError(w, "kanji not found", http.StatusNotFound)
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
		parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		var id string
		for i, p := range parts {
			if p == "words" && i > 0 && parts[i-1] == "kanji" && i+1 <= len(parts) {
				id = parts[i+1]
				break
			}
		}
		if id == "" {
			// Try extracting from .../kanji/words/{id}
			for i, p := range parts {
				if p == "words" && i+1 < len(parts) {
					id = parts[i+1]
					break
				}
			}
		}
		if id == "" {
			writeJSONError(w, "word id required", http.StatusBadRequest)
			return
		}

		type Word struct {
			ID        string  `json:"id"`
			Text      string  `json:"text"`
			Reading   *string `json:"reading,omitempty"`
			MeaningVi *string `json:"meaningVi,omitempty"`
		}

		const q = `SELECT DISTINCT w.id, w.headword AS text, w.reading, w.short_meaning_vi AS meaning_vi
			FROM content.lexeme w
			JOIN content.lexeme_sense ls ON ls.lexeme_id = w.id
			WHERE w.status = 'active'
			ORDER BY w.text ASC LIMIT 50`
		rows, err := db.Query(r.Context(), q, id)
		if err != nil {
			logger.Error("get kanji words", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		var words []Word
		for rows.Next() {
			var w Word
			if err := rows.Scan(&w.ID, &w.Text, &w.Reading, &w.MeaningVi); err != nil {
				continue
			}
			words = append(words, w)
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

		type KanjiSummary struct {
			ID        string  `json:"id"`
			Character string  `json:"character"`
			MeaningVi *string `json:"meaningVi,omitempty"`
		}

		const q = `SELECT k.id, k.character, k.meaning_vi
			FROM content.kanji k
WHERE k.status = 'active' AND false
ORDER BY k.character ASC`
		rows, err := db.Query(r.Context(), q)
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
				continue
			}
			kanjis = append(kanjis, k)
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