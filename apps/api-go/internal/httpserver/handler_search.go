// Package httpserver provides HTTP handlers for search endpoints.
package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/search"
)

const (
	// maxSearchQueryLen bounds the length of search queries.
	maxSearchQueryLen = 200
	// minSearchQueryLen enforces minimum query length.
	minSearchQueryLen = 2
	// defaultSearchLimit caps results per page.
	defaultSearchLimit = 20
	// maxSearchLimit is the absolute cap on results.
	maxSearchLimit = 100
)

// searchHandler implements GET /api/search.
// Unified search across questions, vocabulary, and lessons with type filters.
func searchHandler(
	db *pgxpool.Pool,
	searchClient *search.Client,
	logger *slog.Logger,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeJSONError(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		if searchClient == nil {
			logger.Error("search: client nil; search disabled")
			writeJSONError(w, "search service unavailable", http.StatusServiceUnavailable)
			return
		}

		query := strings.TrimSpace(r.URL.Query().Get("q"))
		scope := strings.TrimSpace(r.URL.Query().Get("scope"))
		if scope == "" {
			// Keep the older API parameter working for existing clients.
			scope = strings.TrimSpace(r.URL.Query().Get("type"))
		}
		limitStr := r.URL.Query().Get("limit")
		offsetStr := r.URL.Query().Get("offset")

		// Validate query.
		if len(query) < minSearchQueryLen {
			writeJSONError(w, fmt.Sprintf("query must be at least %d characters", minSearchQueryLen), http.StatusBadRequest)
			return
		}
		if len(query) > maxSearchQueryLen {
			writeJSONError(w, fmt.Sprintf("query must be at most %d characters", maxSearchQueryLen), http.StatusBadRequest)
			return
		}

		// Parse limit/offset.
		limit := defaultSearchLimit
		if limitStr != "" {
			fmt.Sscanf(limitStr, "%d", &limit)
			if limit <= 0 {
				limit = defaultSearchLimit
			}
			if limit > maxSearchLimit {
				limit = maxSearchLimit
			}
		}

		offset := 0
		if offsetStr != "" {
			fmt.Sscanf(offsetStr, "%d", &offset)
			if offset < 0 {
				offset = 0
			}
		}

		// Validate against kinds in the canonical content_search projection.
		if scope != "" {
			validKinds := map[string]bool{"lexeme": true, "kanji": true, "grammar": true, "example": true, "lesson": true}
			if !validKinds[scope] {
				writeJSONError(w, "invalid search scope", http.StatusBadRequest)
				return
			}
		}

		ctx := r.Context()
		resp, err := searchClient.Search(ctx, query, scope, limit, offset)
		if err != nil {
			logger.Error("search: query failed", "error", err)
			writeJSONError(w, "search failed", http.StatusInternalServerError)
			return
		}
		if db == nil {
			writeJSONError(w, "search service unavailable", http.StatusServiceUnavailable)
			return
		}
		if err := enrichSearchResultLevels(r.Context(), db, &resp.Results); err != nil {
			logger.Error("search: validate canonical content and enrich JLPT levels", "error", err)
			writeJSONError(w, "search failed", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(resp.Results)
	}
}

func enrichSearchResultLevels(ctx context.Context, db *pgxpool.Pool, results *[]search.SearchResult) error {
	ids := make([]string, 0, len(*results))
	for _, result := range *results {
		if result.Kind == "lexeme" || result.Kind == "kanji" || result.Kind == "grammar" || result.Kind == "example" || result.Kind == "lesson" {
			ids = append(ids, result.ID)
		}
	}
	if len(ids) == 0 {
		*results = []search.SearchResult{}
		return nil
	}
	rows, err := db.Query(ctx, `
		SELECT id::text, 'lexeme'::text, jlpt_level
		FROM content.lexeme WHERE id::text = ANY($1::text[]) AND status = 'active'
		UNION ALL
		SELECT id::text, 'kanji'::text, CASE WHEN level BETWEEN 1 AND 5 THEN 'N' || level::text END
		FROM content.kanji WHERE id::text = ANY($1::text[]) AND status = 'active'
		UNION ALL
		SELECT id::text, 'grammar'::text, jlpt_level
		FROM content.grammar_point WHERE id::text = ANY($1::text[]) AND status = 'active'
		UNION ALL
		SELECT id::text, 'example'::text, NULL::text
		FROM content.example_sentence WHERE id::text = ANY($1::text[]) AND status = 'active'
		UNION ALL
		SELECT id::text, 'lesson'::text, NULL::text
		FROM curriculum.bjt_lesson
		WHERE id::text = ANY($1::text[])
			AND status IN ('active', 'published')
			AND (published_at IS NULL OR published_at <= NOW())
	`, ids)
	if err != nil {
		return fmt.Errorf("query canonical search levels: %w", err)
	}
	defer rows.Close()
	type contentKey struct{ id, kind string }
	levels := make(map[contentKey]*string, len(ids))
	for rows.Next() {
		var id string
		var kind string
		var level *string
		if err := rows.Scan(&id, &kind, &level); err != nil {
			return fmt.Errorf("scan canonical search level: %w", err)
		}
		levels[contentKey{id: id, kind: kind}] = level
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("iterate canonical search levels: %w", err)
	}
	active := make([]search.SearchResult, 0, len(*results))
	type lexemeKey struct{ title, reading string }
	seenLexemes := make(map[lexemeKey]struct{})
	for _, result := range *results {
		if result.Kind == "grammar" {
			// The existing Meilisearch projection puts grammar JLPT level in its reading slot.
			result.Reading = nil
		}
		if level, ok := levels[contentKey{id: result.ID, kind: result.Kind}]; ok {
			if result.Kind == "lexeme" {
				if !dictionaryGlossUsable(result.Title, result.Description) {
					continue
				}
				key := lexemeKey{title: strings.TrimSpace(result.Title)}
				if result.Reading != nil {
					key.reading = strings.TrimSpace(*result.Reading)
				}
				if _, exists := seenLexemes[key]; exists {
					continue
				}
				seenLexemes[key] = struct{}{}
			}
			result.JLPTLevel = level
			active = append(active, result)
		}
	}
	*results = active
	return nil
}

// reindexHandler implements POST /api/search/index.
// Admin-only trigger for full reindex.
func reindexHandler(
	db *pgxpool.Pool,
	searchClient *search.Client,
	logger *slog.Logger,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeJSONError(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		if searchClient == nil {
			logger.Error("reindex: client nil; search disabled")
			writeJSONError(w, "search service unavailable", http.StatusServiceUnavailable)
			return
		}

		ctx := r.Context()
		documents, err := search.LoadDocuments(ctx, db, "")
		if err != nil {
			logger.Error("reindex: load canonical search projection", "error", err)
			writeJSONError(w, "search projection unavailable", http.StatusInternalServerError)
			return
		}
		result, err := searchClient.ReindexDocuments(ctx, documents, "")
		if err != nil {
			logger.Error("reindex: failed", "error", err)
			writeJSONError(w, "reindex failed", http.StatusBadGateway)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(result)
	}
}
