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
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

func TestSearchReturnsClientCompatibleScopedArray(t *testing.T) {
	db := testPool(t)
	fixtureID := newUUID(t)
	if _, err := db.Exec(context.Background(), `INSERT INTO content.lexeme
		(id, headword, reading, short_meaning_vi, status, created_at, updated_at)
		VALUES ($1, '会議 fixture', 'かいぎ', 'cuộc họp', 'active', NOW(), NOW())`, fixtureID); err != nil {
		t.Fatalf("create active lexeme fixture: %v", err)
	}
	t.Cleanup(func() { _, _ = db.Exec(context.Background(), `DELETE FROM content.lexeme WHERE id=$1`, fixtureID) })
	meili := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/indexes/content_search/search" {
			t.Errorf("request=%s %s, want POST canonical content index", r.Method, r.URL.Path)
		}
		var request struct {
			Filter []string `json:"filter"`
		}
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Errorf("decode Meilisearch request: %v", err)
		}
		if len(request.Filter) != 1 || request.Filter[0] != `kind = "lexeme"` {
			t.Errorf("filter=%v, want lexeme scope", request.Filter)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"estimatedTotalHits":1,"hits":[{"id":"` + fixtureID + `","kind":"lexeme","title":"会議","description":"cuộc họp","reading":"かいぎ"}]}`))
	}))
	defer meili.Close()

	handler := searchHandler(db, search.NewClient(meili.URL, ""), slog.Default())
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/search?q=%E4%BC%9A%E8%AD%B0&scope=lexeme", nil)
	handler.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
	var results []search.SearchResult
	if err := json.Unmarshal(w.Body.Bytes(), &results); err != nil {
		t.Fatalf("response must be the SearchResult array expected by the learner UI: %v", err)
	}
	if len(results) != 1 || results[0].ID != fixtureID || results[0].Kind != "lexeme" {
		t.Fatalf("results=%+v", results)
	}
}

func TestSearchFiltersInactiveCanonicalContentAndEnrichesJLPTLevel(t *testing.T) {
	db := testPool(t)
	fixtureID, inactiveID := newUUID(t), newUUID(t)
	publishedLessonID, activeLessonID, futureLessonID := newUUID(t), newUUID(t), newUUID(t)
	if _, err := db.Exec(context.Background(), `INSERT INTO content.grammar_point
		(id, pattern, meaning_vi, jlpt_level, status, created_at, updated_at)
		VALUES ($1, 'ために fixture', 'temporary test fixture', 'N4', 'active', NOW(), NOW()),
		       ($2, 'inactive fixture', 'must never appear in public search', 'N3', 'draft', NOW(), NOW())`, fixtureID, inactiveID); err != nil {
		t.Fatalf("create grammar fixtures: %v", err)
	}
	for i, lesson := range []struct {
		id       string
		status   string
		isFuture bool
	}{{publishedLessonID, "published", false}, {activeLessonID, "active", false}, {futureLessonID, "published", true}} {
		_, err := db.Exec(context.Background(), `INSERT INTO curriculum.bjt_lesson
			(id, level_code, sort_order, slug, title_vi, title_ja, status, published_at, updated_at)
			VALUES ($1, 'J5', $2, $3, 'fixture lesson', 'fixture lesson', $4,
				CASE WHEN $5 THEN NOW() + INTERVAL '1 day' ELSE NOW() END, NOW())`,
			lesson.id, 900000+i, "search-fixture-"+lesson.id, lesson.status, lesson.isFuture)
		if err != nil {
			t.Fatalf("create lesson fixture: %v", err)
		}
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM content.grammar_point WHERE id = ANY($1::uuid[])`, []string{fixtureID, inactiveID})
		_, _ = db.Exec(context.Background(), `DELETE FROM curriculum.bjt_lesson WHERE id = ANY($1::uuid[])`, []string{publishedLessonID, activeLessonID, futureLessonID})
	})
	var id, wantLevel string
	if err := db.QueryRow(context.Background(), `
		SELECT id::text, jlpt_level FROM content.grammar_point
		WHERE id=$1 AND status='active' AND jlpt_level IS NOT NULL AND jlpt_level <> ''
	`, fixtureID).Scan(&id, &wantLevel); err != nil {
		t.Fatalf("canonical grammar JLPT fixture is required: %v", err)
	}
	meili := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"estimatedTotalHits":6,"hits":[{"id":"` + id + `","kind":"grammar","title":"ために","description":"meaning","reading":"` + wantLevel + `"},{"id":"` + inactiveID + `","kind":"grammar","title":"inactive fixture","description":"must be filtered","reading":"N3"},{"id":"` + publishedLessonID + `","kind":"lesson","title":"published lesson"},{"id":"` + activeLessonID + `","kind":"lesson","title":"active lesson"},{"id":"` + futureLessonID + `","kind":"lesson","title":"future lesson"},{"id":"hidden","kind":"private","title":"private hit"}]}`))
	}))
	defer meili.Close()

	handler := searchHandler(db, search.NewClient(meili.URL, ""), slog.Default())
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/search?q=%E3%81%9F%E3%82%81%E3%81%AB", nil))
	if w.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
	var got []search.SearchResult
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode search results: %v", err)
	}
	if len(got) != 3 || got[0].Kind != "grammar" || got[0].JLPTLevel == nil || *got[0].JLPTLevel != wantLevel || got[1].ID != publishedLessonID || got[1].Kind != "lesson" || got[2].ID != activeLessonID || got[2].Kind != "lesson" {
		t.Fatalf("search result level=%+v, want %q", got, wantLevel)
	}
	if got[0].Reading != nil {
		t.Fatalf("grammar JLPT projection must not render as a reading: %+v", got[0])
	}
}

func TestSearchDropsUnknownOnlyHits(t *testing.T) {
	db := testPool(t)
	meili := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"estimatedTotalHits":1,"hits":[{"id":"stale","kind":"private","title":"must be dropped"}]}`))
	}))
	defer meili.Close()
	handler := searchHandler(db, search.NewClient(meili.URL, ""), slog.Default())
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/search?q=stale", nil))
	if response.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
	}
	var results []search.SearchResult
	if err := json.Unmarshal(response.Body.Bytes(), &results); err != nil {
		t.Fatalf("decode public results: %v", err)
	}
	if results == nil || len(results) != 0 {
		t.Fatalf("unknown-only indexed hits=%+v, want empty array", results)
	}
}

// searchTestServer wires the router to a local Meilisearch stub.
func searchTestServer(t *testing.T) (*httptest.Server, *session.Store) {
	t.Helper()
	meili := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"estimatedTotalHits":0,"hits":[]}`))
	}))
	t.Cleanup(meili.Close)
	pool := testPool(t)
	sessStore := session.NewStore(pool)
	logger := slog.Default()
	searchClient := search.NewClient(meili.URL, "")

	router := NewRouter(Dependencies{
		Config: &config.Config{
			CORSOrigins:    []string{"http://localhost:3000"},
			MeilisearchURL: meili.URL,
		},
		Logger:       logger,
		DBPool:       pool,
		SessionStore: sessStore,
		SearchClient: searchClient,
	})
	return httptest.NewServer(router), sessStore
}

func TestSearch_NoQuery_Returns400(t *testing.T) {
	srv, _ := searchTestServer(t)
	defer srv.Close()
	req, err := http.NewRequest(http.MethodGet, srv.URL+"/api/search", nil)
	if err != nil {
		t.Fatalf("build request: %v", err)
	}
	resp, err := srv.Client().Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400 for missing query, got %d", resp.StatusCode)
	}
}

func TestSearch_Success_WithResults(t *testing.T) {
	db := testPool(t)
	fixtureID := newUUID(t)
	if _, err := db.Exec(context.Background(), `INSERT INTO content.kanji
		(id, character, meaning_vi, status, created_at, updated_at)
		VALUES ($1, '会', 'cuộc họp', 'active', NOW(), NOW())`, fixtureID); err != nil {
		t.Fatalf("create active kanji fixture: %v", err)
	}
	t.Cleanup(func() { _, _ = db.Exec(context.Background(), `DELETE FROM content.kanji WHERE id=$1`, fixtureID) })
	meili := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"estimatedTotalHits":1,"hits":[{"id":"` + fixtureID + `","kind":"kanji","title":"会","description":"cuộc họp"}]}`))
	}))
	defer meili.Close()
	handler := searchHandler(db, search.NewClient(meili.URL, ""), slog.Default())
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/search?q=%E4%BC%9A", nil))
	if response.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
	}
	var results []search.SearchResult
	if err := json.Unmarshal(response.Body.Bytes(), &results); err != nil {
		t.Fatalf("decode result array: %v", err)
	}
	if len(results) != 1 || results[0].ID != fixtureID || results[0].Kind != "kanji" || results[0].Title != "会" || results[0].Description == nil || *results[0].Description != "cuộc họp" {
		t.Fatalf("unexpected public result: %+v", results)
	}
}

func TestSearch_TypeFilter_QuestionsOnly(t *testing.T) {
	srv, _ := searchTestServer(t)
	defer srv.Close()
	req, err := http.NewRequest(http.MethodGet, srv.URL+"/api/search?q=test&type=question", nil)
	if err != nil {
		t.Fatalf("build request: %v", err)
	}
	resp, err := srv.Client().Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("unsupported question scope status=%d, want 400", resp.StatusCode)
	}
}

func TestSearch_Pagination(t *testing.T) {
	db := testPool(t)
	meili := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request struct {
			Limit  int `json:"limit"`
			Offset int `json:"offset"`
		}
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Errorf("decode Meilisearch request: %v", err)
		}
		if request.Limit != 5 || request.Offset != 10 {
			t.Errorf("pagination forwarded as %+v, want limit=5 offset=10", request)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"estimatedTotalHits":0,"hits":[]}`))
	}))
	defer meili.Close()
	handler := searchHandler(db, search.NewClient(meili.URL, ""), slog.Default())
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/search?q=test&limit=5&offset=10", nil))
	if response.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
	}
	var results []search.SearchResult
	if err := json.Unmarshal(response.Body.Bytes(), &results); err != nil {
		t.Fatalf("response must remain a result array: %v", err)
	}
	if len(results) != 0 {
		t.Fatalf("empty fixture returned unexpected rows: %+v", results)
	}
}

func TestSearch_PublicReadOnly(t *testing.T) {
	srv, _ := searchTestServer(t)
	defer srv.Close()
	req, err := http.NewRequest(http.MethodGet, srv.URL+"/api/search?q=test", nil)
	if err != nil {
		t.Fatalf("build anonymous request: %v", err)
	}
	resp, err := srv.Client().Do(req)
	if err != nil {
		t.Fatalf("anonymous request failed: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("anonymous search status=%d, want 200", resp.StatusCode)
	}
	var results []search.SearchResult
	if err := json.NewDecoder(resp.Body).Decode(&results); err != nil {
		t.Fatalf("anonymous response must be a public result array: %v", err)
	}
	if results == nil || len(results) != 0 {
		t.Fatalf("empty anonymous search results=%+v, want []", results)
	}
}

func TestReindex_AdminOnly(t *testing.T) {
	srv, _ := searchTestServer(t)
	defer srv.Close()
	// Reindex requires admin session — learner cookie should return 403 or 401.
	req, err := http.NewRequest(http.MethodPost, srv.URL+"/api/search/index", nil)
	if err != nil {
		t.Fatalf("build request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
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
