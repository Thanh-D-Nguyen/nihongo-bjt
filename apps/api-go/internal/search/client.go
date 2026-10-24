// Package search provides Meilisearch integration for unified search across questions, vocabulary, and lessons.
package search

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"time"
)

const (
	// IndexContent is the canonical projection for learner content search.
	IndexContent = "content_search"

	// defaultTimeout bounds Meilisearch HTTP requests.
	defaultTimeout = 10 * time.Second
)

// SearchResult represents a single search hit from Meilisearch.
type SearchResult struct {
	Description *string `json:"description"`
	ID          string  `json:"id"`
	JLPTLevel   *string `json:"jlptLevel,omitempty"`
	Kind        string  `json:"kind"`
	Reading     *string `json:"reading"`
	Title       string  `json:"title"`
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

// Document is one row from reporting.v_content_search_documents.
type Document struct {
	ID          string  `json:"id"`
	Kind        string  `json:"kind"`
	Title       string  `json:"title"`
	Reading     *string `json:"reading"`
	Description *string `json:"description"`
}

// ReindexResult describes the Meilisearch tasks accepted for a rebuild.
type ReindexResult struct {
	Status        string  `json:"status"`
	DocumentCount int     `json:"documentCount"`
	TaskUIDs      []int64 `json:"taskUids"`
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

// Search executes a search query against the canonical content projection.
func (c *Client) Search(ctx context.Context, query, scope string, limit, offset int) (*SearchResponse, error) {
	if c == nil {
		return nil, fmt.Errorf("search client not configured")
	}
	if query == "" {
		return nil, fmt.Errorf("search query required")
	}

	type meiliRequest struct {
		Q                string   `json:"q"`
		Limit            int      `json:"limit"`
		Offset           int      `json:"offset"`
		Filter           []string `json:"filter,omitempty"`
		MatchingStrategy string   `json:"matchingStrategy"`
	}
	body := meiliRequest{Q: query, Limit: limit, Offset: offset, MatchingStrategy: "last"}
	if scope != "" {
		body.Filter = []string{fmt.Sprintf("kind = %q", scope)}
	}
	bodyBytes, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("encode search request: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/indexes/"+IndexContent+"/search", bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("create search request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if c.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+c.apiKey)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("search request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("search request: status %d", resp.StatusCode)
	}
	var result struct {
		EstimatedTotalHits int64          `json:"estimatedTotalHits"`
		Hits               []SearchResult `json:"hits"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode search response: %w", err)
	}
	if result.Hits == nil {
		result.Hits = []SearchResult{}
	}
	return &SearchResponse{Query: query, Type: scope, Total: result.EstimatedTotalHits, Limit: limit, Offset: offset, Results: result.Hits}, nil
}

// ReindexDocuments replaces the requested content projection. An empty kind reconciles the full index.
func (c *Client) ReindexDocuments(ctx context.Context, documents []Document, kind string) (ReindexResult, error) {
	result := ReindexResult{Status: "no_changes", TaskUIDs: []int64{}}
	if c == nil {
		return result, fmt.Errorf("search client not configured")
	}
	if kind != "" && kind != "lexeme" && kind != "kanji" && kind != "grammar" && kind != "example" {
		return result, fmt.Errorf("unsupported search document kind %q", kind)
	}
	for _, document := range documents {
		if document.ID == "" || document.Kind == "" || (kind != "" && document.Kind != kind) {
			return result, fmt.Errorf("invalid search document for kind %q", kind)
		}
	}

	staleIDs, indexMissing, err := c.staleDocumentIDs(ctx, documents, kind)
	if err != nil {
		return result, err
	}
	if indexMissing && len(documents) > 0 {
		body, err := json.Marshal(map[string]string{"uid": IndexContent, "primaryKey": "id"})
		if err != nil {
			return result, fmt.Errorf("encode content search index: %w", err)
		}
		uid, err := c.enqueueTask(ctx, http.MethodPost, "/indexes", body)
		if err != nil {
			return result, fmt.Errorf("create content search index: %w", err)
		}
		result.TaskUIDs = append(result.TaskUIDs, uid)
		if err := c.waitForTask(ctx, uid, defaultTimeout); err != nil {
			return result, fmt.Errorf("create content search index task %d: %w", uid, err)
		}
		uid, err = c.ConfigureIndex(ctx)
		if err != nil {
			return result, fmt.Errorf("configure content search index: %w", err)
		}
		result.TaskUIDs = append(result.TaskUIDs, uid)
		if err := c.waitForTask(ctx, uid, defaultTimeout); err != nil {
			return result, fmt.Errorf("configure content search index task %d: %w", uid, err)
		}
	}
	for start := 0; start < len(documents); start += 1000 {
		end := min(start+1000, len(documents))
		uid, err := c.enqueueDocuments(ctx, documents[start:end])
		if err != nil {
			return result, err
		}
		result.TaskUIDs = append(result.TaskUIDs, uid)
		result.Status = "rebuild_enqueued"
	}
	for start := 0; start < len(staleIDs); start += 1000 {
		end := min(start+1000, len(staleIDs))
		body, err := json.Marshal(staleIDs[start:end])
		if err != nil {
			return result, fmt.Errorf("encode stale search document IDs: %w", err)
		}
		uid, err := c.enqueueTask(ctx, http.MethodPost, "/indexes/"+IndexContent+"/documents/delete-batch", body)
		if err != nil {
			return result, err
		}
		result.TaskUIDs = append(result.TaskUIDs, uid)
		result.Status = "rebuild_enqueued"
	}
	result.DocumentCount = len(documents)
	return result, nil
}

func (c *Client) staleDocumentIDs(ctx context.Context, documents []Document, kind string) ([]string, bool, error) {
	keep := make(map[string]struct{}, len(documents))
	for _, document := range documents {
		keep[document.ID] = struct{}{}
	}
	var stale []string
	for offset := 0; ; offset += 1000 {
		u := c.baseURL + "/indexes/" + IndexContent + "/documents?fields=id,kind&limit=1000&offset=" + fmt.Sprint(offset)
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
		if err != nil {
			return nil, false, fmt.Errorf("create search document listing request: %w", err)
		}
		c.authorize(req)
		resp, err := c.httpClient.Do(req)
		if err != nil {
			return nil, false, fmt.Errorf("list existing search documents: %w", err)
		}
		if resp.StatusCode == http.StatusNotFound {
			var apiErr struct {
				Code string `json:"code"`
			}
			_ = json.NewDecoder(resp.Body).Decode(&apiErr)
			resp.Body.Close()
			if apiErr.Code == "index_not_found" {
				return nil, true, nil
			}
			return nil, false, fmt.Errorf("list existing search documents: status %d (%s)", resp.StatusCode, apiErr.Code)
		}
		if resp.StatusCode != http.StatusOK {
			resp.Body.Close()
			return nil, false, fmt.Errorf("list existing search documents: status %d", resp.StatusCode)
		}
		var page struct {
			Results []struct {
				ID   string `json:"id"`
				Kind string `json:"kind"`
			} `json:"results"`
			Total int `json:"total"`
		}
		decodeErr := json.NewDecoder(resp.Body).Decode(&page)
		resp.Body.Close()
		if decodeErr != nil {
			return nil, false, fmt.Errorf("decode existing search documents: %w", decodeErr)
		}
		for _, existing := range page.Results {
			if kind != "" && existing.Kind != kind {
				continue
			}
			if _, ok := keep[existing.ID]; !ok {
				stale = append(stale, existing.ID)
			}
		}
		if offset+len(page.Results) >= page.Total || len(page.Results) == 0 {
			break
		}
	}
	sort.Strings(stale)
	return stale, false, nil
}

func (c *Client) enqueueDocuments(ctx context.Context, documents []Document) (int64, error) {
	body, err := json.Marshal(documents)
	if err != nil {
		return 0, fmt.Errorf("encode search documents: %w", err)
	}
	return c.enqueueTask(ctx, http.MethodPost, "/indexes/"+IndexContent+"/documents?primaryKey=id", body)
}

func (c *Client) enqueueTask(ctx context.Context, method, path string, body []byte) (int64, error) {
	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, bytes.NewReader(body))
	if err != nil {
		return 0, fmt.Errorf("create search indexing request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	c.authorize(req)
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return 0, fmt.Errorf("submit search indexing task: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusAccepted {
		return 0, fmt.Errorf("submit search indexing task: status %d", resp.StatusCode)
	}
	var task struct {
		TaskUID *int64 `json:"taskUid"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&task); err != nil {
		return 0, fmt.Errorf("decode search indexing task: %w", err)
	}
	if task.TaskUID == nil || *task.TaskUID < 0 {
		return 0, fmt.Errorf("submit search indexing task: missing taskUid")
	}
	return *task.TaskUID, nil
}

func (c *Client) waitForTask(ctx context.Context, taskUID int64, timeout time.Duration) error {
	deadline := time.NewTimer(timeout)
	defer deadline.Stop()
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()
	for {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, fmt.Sprintf("%s/tasks/%d", c.baseURL, taskUID), nil)
		if err != nil {
			return fmt.Errorf("create task status request: %w", err)
		}
		c.authorize(req)
		resp, err := c.httpClient.Do(req)
		if err != nil {
			return fmt.Errorf("get task status: %w", err)
		}
		if resp.StatusCode != http.StatusOK {
			resp.Body.Close()
			return fmt.Errorf("get task status: status %d", resp.StatusCode)
		}
		var task struct {
			Status string `json:"status"`
			Error  *struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			} `json:"error"`
		}
		decodeErr := json.NewDecoder(resp.Body).Decode(&task)
		resp.Body.Close()
		if decodeErr != nil {
			return fmt.Errorf("decode task status: %w", decodeErr)
		}
		switch task.Status {
		case "succeeded":
			return nil
		case "failed", "canceled":
			if task.Error != nil {
				return fmt.Errorf("task %s: %s (%s)", task.Status, task.Error.Message, task.Error.Code)
			}
			return fmt.Errorf("task %s", task.Status)
		case "enqueued", "processing":
		default:
			return fmt.Errorf("unexpected task status %q", task.Status)
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-deadline.C:
			return fmt.Errorf("timed out waiting for task %d", taskUID)
		case <-ticker.C:
		}
	}
}

func (c *Client) authorize(req *http.Request) {
	if c.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+c.apiKey)
	}
}
