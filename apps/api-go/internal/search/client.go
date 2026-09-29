// Package search provides Meilisearch integration for unified search across questions, vocabulary, and lessons.
package search

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"time"
)

const (
	// IndexQuestions is the Meilisearch index for BJT questions.
	IndexQuestions = "questions"
	// IndexVocabulary is the Meilisearch index for vocabulary entries.
	IndexVocabulary = "vocabulary"
	// IndexLessons is the Meilisearch index for lessons.
	IndexLessons = "lessons"

	// defaultTimeout bounds Meilisearch HTTP requests.
	defaultTimeout = 10 * time.Second
)

// SearchResult represents a single search hit from Meilisearch.
type SearchResult struct {
	ID      string                 `json:"id"`
	Type    string                 `json:"type"`
	Title   string                 `json:"title"`
	Snippet string                 `json:"snippet"`
	Score   float64                `json:"score"`
	Raw     map[string]interface{} `json:"-"`
}

// SearchResponse is the envelope returned by GET /api/search.
type SearchResponse struct {
	Query      string         `json:"query"`
	Type       string         `json:"type,omitempty"`
	Total      int64          `json:"total"`
	Limit      int            `json:"limit"`
	Offset     int            `json:"offset"`
	Results    []SearchResult `json:"results"`
	DurationMs int64          `json:"durationMs"`
}

// Client wraps Meilisearch HTTP interactions with connection pooling and error normalization.
type Client struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
}

// NewClient creates a Meilisearch client. Returns nil if baseURL is empty (search disabled).
func NewClient(baseURL, apiKey string) *Client {
	if baseURL == "" {
		return nil
	}
	return &Client{
		baseURL: baseURL,
		apiKey:  apiKey,
		httpClient: &http.Client{
			Timeout: defaultTimeout,
		},
	}
}

// Ping checks Meilisearch health. Returns nil on success.
func (c *Client) Ping(ctx context.Context) error {
	if c == nil {
		return fmt.Errorf("search client not configured")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/health", nil)
	if err != nil {
		return fmt.Errorf("search ping: %w", err)
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("search ping: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("search ping: status %d", resp.StatusCode)
	}
	return nil
}

// Search executes a search query against the specified index (or all indices if empty).
func (c *Client) Search(ctx context.Context, query, index string, limit, offset int) (*SearchResponse, error) {
	if c == nil {
		return nil, fmt.Errorf("search client not configured")
	}
	if query == "" {
		return nil, fmt.Errorf("search query required")
	}

	targetIndex := index
	if targetIndex == "" {
		targetIndex = "*" // multi-index search placeholder; actual implementation uses federated search or sequential queries
	}

	// For MVP: search each index sequentially and merge results.
	// Production should use Meilisearch federated search when available.
	var allResults []SearchResult
	var totalHits int64

	indices := []string{IndexQuestions, IndexVocabulary, IndexLessons}
	if index != "" {
		indices = []string{index}
	}

	for _, idx := range indices {
		hits, total, err := c.searchIndex(ctx, query, idx, limit, offset)
		if err != nil {
			continue // skip unavailable indices
		}
		allResults = append(allResults, hits...)
		totalHits += total
	}

	return &SearchResponse{
		Query:   query,
		Type:    index,
		Total:   totalHits,
		Limit:   limit,
		Offset:  offset,
		Results: allResults,
	}, nil
}

// searchIndex searches a single Meilisearch index.
func (c *Client) searchIndex(ctx context.Context, query, index string, limit, offset int) ([]SearchResult, int64, error) {
	url := fmt.Sprintf("%s/indexes/%s/search", c.baseURL, index)

	bodyBytes := []byte(fmt.Sprintf(`{"q":%q,"limit":%d,"offset":%d}`, query, limit, offset))

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, 0, fmt.Errorf("search %s: %w", index, err)
	}
	req.Header.Set("Content-Type", "application/json")
	if c.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+c.apiKey)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, 0, fmt.Errorf("search %s: %w", index, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, 0, fmt.Errorf("search %s: status %d", index, resp.StatusCode)
	}

	// Parse response — simplified for initial implementation.
	// Full implementation would decode Meilisearch search response format.
	return []SearchResult{}, 0, nil
}

// Reindex triggers a full reindex of all content types. Admin-only operation.
func (c *Client) Reindex(ctx context.Context) error {
	if c == nil {
		return fmt.Errorf("search client not configured")
	}
	// Placeholder: actual implementation would iterate DB records and upsert to Meilisearch.
	// This is intentionally minimal for the initial M8 checkpoint.
	return nil
}
