package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
)

type nhkArticleResponse struct {
	ID               string          `json:"id"`
	SourceType       string          `json:"sourceType"`
	Title            string          `json:"title"`
	TitleWithRuby    *string         `json:"titleWithRuby"`
	PublishedAt      time.Time       `json:"publishedAt"`
	ImageURL         *string         `json:"imageUrl"`
	AudioURL         *string         `json:"audioUrl"`
	Difficulty       *string         `json:"difficulty"`
	URL              string          `json:"url"`
	BodyHTML         *string         `json:"bodyHtml"`
	BodyPlain        *string         `json:"bodyPlain"`
	Vocabulary       json.RawMessage `json:"vocabulary,omitempty"`
	HasBody          bool            `json:"hasBody"`
	CanGenerateCards bool            `json:"canGenerateCards"`
}

func isAllowedNewsType(kind string) bool {
	switch kind {
	case "easy", "normal", "business", "livedoor":
		return true
	default:
		return false
	}
}

func nhkNewsListHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		kind := r.URL.Query().Get("type")
		if kind == "" {
			kind = "easy"
		}
		if !isAllowedNewsType(kind) {
			writeJSONError(w, "type must be easy, normal, business, or livedoor", http.StatusBadRequest)
			return
		}
		limit := nhkPageValue(r, "limit", 12, 1, 48)
		offset := nhkPageValue(r, "offset", 0, 0, 1_000_000)
		rows, err := db.Query(r.Context(), `SELECT id,source_type,title,title_with_ruby,published_at,image_url,difficulty,url,
			COALESCE(NULLIF(btrim(body_plain),''),NULLIF(btrim(body_html),'')) IS NOT NULL,
			COALESCE(jsonb_typeof(vocabulary)='array' AND vocabulary != '[]'::jsonb,false)
			FROM content.nhk_article WHERE source_type=$1 ORDER BY published_at DESC,id LIMIT $2 OFFSET $3`, kind, limit, offset)
		if err != nil {
			logger.Error("list NHK articles", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		articles := make([]nhkArticleResponse, 0)
		for rows.Next() {
			var article nhkArticleResponse
			if err := rows.Scan(&article.ID, &article.SourceType, &article.Title, &article.TitleWithRuby, &article.PublishedAt, &article.ImageURL, &article.Difficulty, &article.URL, &article.HasBody, &article.CanGenerateCards); err != nil {
				logger.Error("scan NHK article", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			articles = append(articles, article)
		}
		if err := rows.Err(); err != nil {
			logger.Error("iterate NHK articles", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, articles)
	}
}

func nhkRouteArticleID(r *http.Request) string {
	raw := chi.URLParam(r, "id")
	for strings.Contains(raw, "%") {
		unescaped, err := url.PathUnescape(raw)
		if err != nil || unescaped == raw {
			break
		}
		raw = unescaped
	}
	return raw
}

func nhkArticleDetailHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var article nhkArticleResponse
		var vocabulary []byte
		err := db.QueryRow(r.Context(), `SELECT id,source_type,title,title_with_ruby,published_at,image_url,audio_url,difficulty,url,body_html,body_plain,vocabulary,
			COALESCE(NULLIF(btrim(body_plain),''),NULLIF(btrim(body_html),'')) IS NOT NULL,
			COALESCE(jsonb_typeof(vocabulary)='array' AND vocabulary != '[]'::jsonb,false)
			FROM content.nhk_article WHERE id=$1`, nhkRouteArticleID(r)).Scan(
			&article.ID, &article.SourceType, &article.Title, &article.TitleWithRuby, &article.PublishedAt,
			&article.ImageURL, &article.AudioURL, &article.Difficulty, &article.URL, &article.BodyHTML,
			&article.BodyPlain, &vocabulary, &article.HasBody, &article.CanGenerateCards)
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSONError(w, "article not found", http.StatusNotFound)
			return
		}
		if err != nil {
			logger.Error("get NHK article", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if len(vocabulary) == 0 || string(vocabulary) == "null" {
			vocabulary = []byte("[]")
		}
		if !article.CanGenerateCards && article.HasBody {
			sample := []nhkFeedArticle{{
				ID:            article.ID,
				SourceType:    article.SourceType,
				Title:         article.Title,
				TitleWithRuby: stringValue(article.TitleWithRuby),
				BodyHTML:      stringValue(article.BodyHTML),
				BodyPlain:     stringValue(article.BodyPlain),
			}}
			enrichNHKArticlesWithLexemes(r.Context(), db, sample)
			if len(sample[0].VocabularyJSON) > 0 && string(sample[0].VocabularyJSON) != "[]" {
				vocabulary = sample[0].VocabularyJSON
				article.CanGenerateCards = true
				_, _ = db.Exec(r.Context(), `UPDATE content.nhk_article SET vocabulary=$2::jsonb, updated_at=NOW() WHERE id=$1`, article.ID, string(vocabulary))
			}
		}
		article.Vocabulary = vocabulary
		writeJSON(w, http.StatusOK, article)
	}
}

func nhkReadingProgressHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		if r.Method == http.MethodPost {
			var req struct {
				ReadTimeSec int  `json:"readTimeSec"`
				Completed   bool `json:"completed"`
			}
			if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&req); err != nil || req.ReadTimeSec < 0 || req.ReadTimeSec > 86400 {
				writeJSONError(w, "invalid reading progress", http.StatusBadRequest)
				return
			}
			result, err := db.Exec(r.Context(), `INSERT INTO learning.nhk_reading_progress (user_id,article_id,read_time_sec,completed)
				SELECT $1,id,$3,$4 FROM content.nhk_article WHERE id=$2
				ON CONFLICT (user_id,article_id) DO UPDATE SET read_at=NOW(),read_time_sec=GREATEST(COALESCE(learning.nhk_reading_progress.read_time_sec,0),EXCLUDED.read_time_sec),completed=learning.nhk_reading_progress.completed OR EXCLUDED.completed`,
				identity.UserID, nhkRouteArticleID(r), req.ReadTimeSec, req.Completed)
			if err != nil {
				logger.Error("save NHK reading progress", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			if result.RowsAffected() == 0 {
				writeJSONError(w, "article not found", http.StatusNotFound)
				return
			}
			writeJSON(w, http.StatusOK, map[string]bool{"saved": true})
			return
		}
		ids := strings.Split(r.URL.Query().Get("articleIds"), ",")
		if len(ids) == 1 && ids[0] == "" {
			writeJSON(w, http.StatusOK, []any{})
			return
		}
		if len(ids) > 100 {
			writeJSONError(w, "too many articleIds", http.StatusBadRequest)
			return
		}
		rows, err := db.Query(r.Context(), `SELECT article_id FROM learning.nhk_reading_progress WHERE user_id=$1 AND article_id=ANY($2) AND completed`, identity.UserID, ids)
		if err != nil {
			logger.Error("get NHK reading progress", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		result := make([]map[string]string, 0)
		for rows.Next() {
			var id string
			if err := rows.Scan(&id); err != nil {
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			result = append(result, map[string]string{"articleId": id})
		}
		writeJSON(w, http.StatusOK, result)
	}
}

func nhkBookmarkHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		id := nhkRouteArticleID(r)
		if r.Method == http.MethodGet {
			var bookmarked bool
			err := db.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM learning.nhk_bookmark WHERE user_id=$1 AND article_id=$2)`, identity.UserID, id).Scan(&bookmarked)
			if err != nil {
				logger.Error("get NHK bookmark", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
			writeJSON(w, http.StatusOK, map[string]bool{"bookmarked": bookmarked})
			return
		}
		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("toggle NHK bookmark", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(r.Context())
		var exists bool
		if err := tx.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM content.nhk_article WHERE id=$1)`, id).Scan(&exists); err != nil {
			logger.Error("check NHK article for bookmark", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if !exists {
			writeJSONError(w, "article not found", http.StatusNotFound)
			return
		}
		deleted, err := tx.Exec(r.Context(), `DELETE FROM learning.nhk_bookmark WHERE user_id=$1 AND article_id=$2`, identity.UserID, id)
		if err != nil {
			logger.Error("delete NHK bookmark", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		bookmarked := deleted.RowsAffected() == 0
		if bookmarked {
			_, err = tx.Exec(r.Context(), `INSERT INTO learning.nhk_bookmark (user_id,article_id) VALUES ($1,$2)`, identity.UserID, id)
			if err != nil {
				logger.Error("create NHK bookmark", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
		}
		if err := tx.Commit(r.Context()); err != nil {
			logger.Error("commit NHK bookmark", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]bool{"bookmarked": bookmarked})
	}
}

func nhkFlashcardHandler(db *pgxpool.Pool, logger *slog.Logger, wholeArticle bool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			Word      string  `json:"word"`
			DeckTitle *string `json:"deckTitle"`
		}
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		id := nhkRouteArticleID(r)
		var title string
		var bodyHTML, bodyPlain *string
		var vocabJSON []byte
		if err := db.QueryRow(r.Context(), `SELECT title,body_html,body_plain,vocabulary FROM content.nhk_article WHERE id=$1`, id).Scan(&title, &bodyHTML, &bodyPlain, &vocabJSON); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				writeJSONError(w, "article not found", http.StatusNotFound)
				return
			}
			logger.Error("load NHK flashcard source", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		var words []struct {
			Word    string  `json:"word"`
			Reading *string `json:"reading"`
			Meaning *string `json:"meaning"`
		}
		if len(vocabJSON) == 0 {
			vocabJSON = []byte("[]")
		}
		if err := json.Unmarshal(vocabJSON, &words); err != nil {
			logger.Error("decode NHK vocabulary", "error", err)
			writeJSONError(w, "article vocabulary is invalid", http.StatusInternalServerError)
			return
		}
		if len(words) == 0 && (strings.TrimSpace(stringValue(bodyHTML)) != "" || strings.TrimSpace(stringValue(bodyPlain)) != "") {
			sample := []nhkFeedArticle{{
				ID:        id,
				Title:     title,
				BodyHTML:  stringValue(bodyHTML),
				BodyPlain: stringValue(bodyPlain),
			}}
			enrichNHKArticlesWithLexemes(r.Context(), db, sample)
			if len(sample[0].VocabularyJSON) > 0 && string(sample[0].VocabularyJSON) != "[]" {
				_ = json.Unmarshal(sample[0].VocabularyJSON, &words)
				_, _ = db.Exec(r.Context(), `UPDATE content.nhk_article SET vocabulary=$2::jsonb, updated_at=NOW() WHERE id=$1`, id, string(sample[0].VocabularyJSON))
			}
		}
		if wholeArticle {
			if req.DeckTitle != nil && (len(strings.TrimSpace(*req.DeckTitle)) == 0 || len(*req.DeckTitle) > 120) {
				writeJSONError(w, "deckTitle must be 1-120 characters", http.StatusBadRequest)
				return
			}
		} else {
			found := false
			for _, word := range words {
				if word.Word == req.Word {
					words = []struct {
						Word    string  `json:"word"`
						Reading *string `json:"reading"`
						Meaning *string `json:"meaning"`
					}{word}
					found = true
					break
				}
			}
			if !found {
				writeJSONError(w, "word is not in this article", http.StatusBadRequest)
				return
			}
		}
		if len(words) == 0 {
			writeJSONError(w, "article vocabulary is unavailable", http.StatusUnprocessableEntity)
			return
		}
		deckTitle := "NHK: " + title
		if req.DeckTitle != nil && strings.TrimSpace(*req.DeckTitle) != "" {
			deckTitle = strings.TrimSpace(*req.DeckTitle)
		}
		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin NHK flashcard save", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(r.Context())
		if _, err := tx.Exec(r.Context(), `SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))`, identity.UserID, id); err != nil {
			logger.Error("lock NHK flashcard save", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		marker := "nhk-article:" + id
		var deckID string
		err = tx.QueryRow(r.Context(), `SELECT id::text FROM learning.deck WHERE owner_user_id=$1 AND description_vi=$2 AND status='active' FOR UPDATE`, identity.UserID, marker).Scan(&deckID)
		if errors.Is(err, pgx.ErrNoRows) {
			err = tx.QueryRow(r.Context(), `INSERT INTO learning.deck (owner_user_id,title_vi,description_vi,visibility,status,updated_at)
				VALUES ($1,$2,$3,'private','active',NOW()) RETURNING id::text`, identity.UserID, deckTitle, marker).Scan(&deckID)
		} else if err == nil && wholeArticle && req.DeckTitle != nil && strings.TrimSpace(*req.DeckTitle) != "" {
			_, err = tx.Exec(r.Context(), `UPDATE learning.deck SET title_vi=$1,updated_at=NOW() WHERE id=$2 AND owner_user_id=$3`, deckTitle, deckID, identity.UserID)
		}
		if err != nil {
			logger.Error("create NHK flashcard deck", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		for _, word := range words {
			var cardID string
			err := tx.QueryRow(r.Context(), `SELECT id::text FROM learning.flashcard_variant WHERE source_type='custom' AND source_id=$1 AND front_text=$2 AND status='active'`, deckID, word.Word).Scan(&cardID)
			if errors.Is(err, pgx.ErrNoRows) {
				position, posErr := countDeckCards(r.Context(), tx, deckID)
				if posErr != nil {
					err = posErr
				} else {
					backText := strings.TrimSpace(stringValue(word.Meaning))
					if backText == "" {
						backText = strings.TrimSpace(stringValue(word.Reading))
					}
					if backText == "" {
						backText = word.Word
					}
					err = tx.QueryRow(r.Context(), `INSERT INTO learning.flashcard_variant (source_type,source_id,front_text,back_text,reading,status,updated_at)
						VALUES ('custom',$1,$2,$3,$4,'active',NOW()) RETURNING id::text`, deckID, word.Word, backText, word.Reading).Scan(&cardID)
					if err == nil {
						_, err = tx.Exec(r.Context(), `INSERT INTO learning.deck_card (deck_id,card_id,position) VALUES ($1,$2,$3)`, deckID, cardID, position)
					}
				}
			}
			if err == nil {
				_, err = tx.Exec(r.Context(), `INSERT INTO learning.user_flashcard (user_id,card_id,state,due_at,updated_at) VALUES ($1,$2,'new',NOW(),NOW()) ON CONFLICT (user_id,card_id) DO NOTHING`, identity.UserID, cardID)
			}
			if err != nil {
				logger.Error("save NHK vocabulary flashcard", "error", err)
				writeJSONError(w, "internal error", http.StatusInternalServerError)
				return
			}
		}
		if err := tx.Commit(r.Context()); err != nil {
			logger.Error("commit NHK flashcard save", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusCreated, map[string]any{"deckId": deckID, "saved": len(words)})
	}
}

func countDeckCards(ctx context.Context, tx pgx.Tx, deckID string) (int, error) {
	var count int
	err := tx.QueryRow(ctx, `SELECT count(*)::int FROM learning.deck_card WHERE deck_id=$1`, deckID).Scan(&count)
	return count, err
}

func stringValue(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func nhkPageValue(r *http.Request, key string, fallback, min, max int) int {
	value := r.URL.Query().Get(key)
	if value == "" {
		return fallback
	}
	n, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	if n < min {
		return min
	}
	if n > max {
		return max
	}
	return n
}
