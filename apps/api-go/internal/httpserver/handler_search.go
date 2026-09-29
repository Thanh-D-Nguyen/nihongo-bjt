// Package httpserver provides HTTP handlers for search endpoints.
package httpserver

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

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
		typeFilter := strings.TrimSpace(r.URL.Query().Get("type"))
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

		// Validate type filter.
		validTypes := map[string]bool{
			"question":   true,
			"vocabulary": true,
			"lesson":     true,
		}
		index := ""
		if typeFilter != "" {
			if !validTypes[typeFilter] {
				writeJSONError(w, "invalid type filter; must be question, vocabulary, or lesson", http.StatusBadRequest)
				return
			}
			// Map type to Meilisearch index.
			switch typeFilter {
			case "question":
				index = search.IndexQuestions
			case "vocabulary":
				index = search.IndexVocabulary
			case "lesson":
				index = search.IndexLessons
			}
		}

		ctx := r.Context()
		resp, err := searchClient.Search(ctx, query, index, limit, offset)
		if err != nil {
			logger.Error("search: query failed", "error", err)
			writeJSONError(w, "search failed", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(resp)
	}
}

// reindexHandler implements POST /api/search/index.
// Admin-only trigger for full reindex.
func reindexHandler(
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
		if err := searchClient.Reindex(ctx); err != nil {
			logger.Error("reindex: failed", "error", err)
			writeJSONError(w, "reindex failed", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "reindex triggered"})
	}
}
