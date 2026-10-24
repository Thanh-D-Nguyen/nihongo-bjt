package search

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// ConfigureIndex puts exact words and readings ahead of title-prefix matches.
func (c *Client) ConfigureIndex(ctx context.Context) (int64, error) {
	if c == nil {
		return 0, fmt.Errorf("search client not configured")
	}
	settings := []byte(`{"searchableAttributes":["title","reading","description"],"filterableAttributes":["kind"],"rankingRules":["words","typo","exactness","proximity","attribute","sort"]}`)
	return c.enqueueTask(ctx, http.MethodPatch, "/indexes/"+IndexContent+"/settings", settings)
}

// VerifyReindex waits for processing, then rejects an incomplete projection.
func (c *Client) VerifyReindex(ctx context.Context, result ReindexResult) error {
	if c == nil {
		return fmt.Errorf("search client not configured")
	}
	for _, uid := range result.TaskUIDs {
		if err := c.waitForTask(ctx, uid, 30*time.Minute); err != nil {
			return fmt.Errorf("indexing task %d: %w", uid, err)
		}
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/indexes/"+IndexContent+"/stats", nil)
	if err != nil {
		return fmt.Errorf("create search stats request: %w", err)
	}
	c.authorize(req)
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("get search stats: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound && result.DocumentCount == 0 {
		var apiErr struct {
			Code string `json:"code"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&apiErr); err == nil && apiErr.Code == "index_not_found" {
			return nil
		}
	}
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("get search stats: status %d", resp.StatusCode)
	}
	var stats struct {
		NumberOfDocuments int `json:"numberOfDocuments"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&stats); err != nil {
		return fmt.Errorf("decode search stats: %w", err)
	}
	if stats.NumberOfDocuments != result.DocumentCount {
		return fmt.Errorf("incomplete search projection: indexed %d, canonical %d", stats.NumberOfDocuments, result.DocumentCount)
	}
	return nil
}
