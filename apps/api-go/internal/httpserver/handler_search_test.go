package httpserver

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"log/slog"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/search"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

// searchTestServer creates a test server with search handlers wired.
// Tests skip gracefully when TEST_MEILISEARCH_URL is unset.
func searchTestServer(t *testing.T) (*httptest.Server, *session.Store) {
	t.Helper()
	meiliURL := os.Getenv("TEST_MEILISEARCH_URL")
	if meiliURL == "" {
		t.Skip("TEST_MEILISEARCH_URL not set; skipping search integration tests")
	}
	pool := testPool(t)
	sessStore := session.NewStore(pool)
	logger := slog.Default()
	searchClient := search.NewClient(meiliURL, os.Getenv("TEST_MEILISEARCH_API_KEY"))

	router := NewRouter(Dependencies{
		Config: &config.Config{
			CORSOrigins:    []string{"http://localhost:3000"},
			MeilisearchURL: meiliURL,
		},
		Logger:       logger,
		SessionStore: sessStore,
		SearchClient: searchClient,
	})
	return httptest.NewServer(router), sessStore
}

func TestSearch_Success_WithResults(t *testing.T) {
	srv, _ := searchTestServer(t)
	defer srv.Close()
	req := httptest.NewRequest(http.MethodGet, "/api/search?q=test&limit=10", nil)
	srv.Client().Transport.(*http.Transport).CloseIdleConnections()
	resp, err := srv.Client().Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	// Search may return 200 even with no results if Meilisearch is up.
	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}

	var result map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		t.Fatalf("decode failed: %v", err)
	}
	if _, ok := result["query"]; !ok {
		t.Error("expected query field in response")
	}
}

func TestSearch_NoQuery_Returns400(t *testing.T) {
	srv, _ := searchTestServer(t)
	defer srv.Close()
	req := httptest.NewRequest(http.MethodGet, "/api/search", nil)
	srv.Client().Transport.(*http.Transport).CloseIdleConnections()
	resp, err := srv.Client().Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400 for missing query, got %d", resp.StatusCode)
	}
}

func TestSearch_TypeFilter_QuestionsOnly(t *testing.T) {
	srv, _ := searchTestServer(t)
	defer srv.Close()
	req := httptest.NewRequest(http.MethodGet, "/api/search?q=test&type=question", nil)
	srv.Client().Transport.(*http.Transport).CloseIdleConnections()
	resp, err := srv.Client().Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}
}

func TestSearch_Pagination(t *testing.T) {
	srv, _ := searchTestServer(t)
	defer srv.Close()
	req := httptest.NewRequest(http.MethodGet, "/api/search?q=test&limit=5&offset=10", nil)
	srv.Client().Transport.(*http.Transport).CloseIdleConnections()
	resp, err := srv.Client().Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}

	var result map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		t.Fatalf("decode failed: %v", err)
	}
	if result["limit"] != float64(5) {
		t.Errorf("expected limit=5, got %v", result["limit"])
	}
	if result["offset"] != float64(10) {
		t.Errorf("expected offset=10, got %v", result["offset"])
	}
}

func TestSearch_Unauthorized(t *testing.T) {
	srv, _ := searchTestServer(t)
	defer srv.Close()
	// Search requires session guard — no cookie should return 401.
	req := httptest.NewRequest(http.MethodGet, "/api/search?q=test", nil)
	srv.Client().Transport.(*http.Transport).CloseIdleConnections()
	resp, err := srv.Client().Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("expected 401 without session, got %d", resp.StatusCode)
	}
}

func TestReindex_AdminOnly(t *testing.T) {
	srv, _ := searchTestServer(t)
	defer srv.Close()
	// Reindex requires admin session — learner cookie should return 403 or 401.
	req := httptest.NewRequest(http.MethodPost, "/api/search/index", nil)
	req.Header.Set("Content-Type", "application/json")
	srv.Client().Transport.(*http.Transport).CloseIdleConnections()
	resp, err := srv.Client().Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	// Without any session, expect 401.
	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("expected 401 without admin session, got %d", resp.StatusCode)
	}
}
