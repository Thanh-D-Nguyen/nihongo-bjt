package httpserver

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/search"
)

func TestSearchRouteIsPublicWithoutSessionStore(t *testing.T) {
	db := testPool(t)
	fixtureID := newUUID(t)
	if _, err := db.Exec(context.Background(), `INSERT INTO content.grammar_point
		(id, pattern, meaning_vi, jlpt_level, status, created_at, updated_at)
		VALUES ($1, 'ために public fixture', 'vì, để', 'N4', 'active', NOW(), NOW())`, fixtureID); err != nil {
		t.Fatalf("create public search fixture: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM content.grammar_point WHERE id=$1`, fixtureID)
	})
	meili := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/indexes/content_search/search" {
			t.Errorf("request=%s %s, want canonical content search", r.Method, r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"estimatedTotalHits":1,"hits":[{"id":"` + fixtureID + `","kind":"grammar","title":"ために","description":"vì, để","reading":"N4"}]}`))
	}))
	defer meili.Close()

	router := NewRouter(Dependencies{
		Config:       &config.Config{CORSOrigins: []string{"http://localhost:18081"}},
		DBPool:       db,
		Logger:       slog.Default(),
		SearchClient: search.NewClient(meili.URL, ""),
	})
	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/search?q=%E3%81%9F%E3%82%81%E3%81%AB&scope=lexeme", nil))
	if response.Code != http.StatusOK {
		t.Fatalf("anonymous content search status=%d body=%s; want 200", response.Code, response.Body.String())
	}
	var results []search.SearchResult
	if err := json.Unmarshal(response.Body.Bytes(), &results); err != nil {
		t.Fatalf("response must be the public SearchResult array: %v", err)
	}
	if len(results) != 1 || results[0].ID != fixtureID || results[0].JLPTLevel == nil || *results[0].JLPTLevel != "N4" {
		t.Fatalf("anonymous results=%+v", results)
	}
}
