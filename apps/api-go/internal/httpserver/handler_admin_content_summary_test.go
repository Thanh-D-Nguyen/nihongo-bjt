package httpserver

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestAdminContentSummaryReturnsCMSChartContract(t *testing.T) {
	db := testPool(t)
	for _, contentType := range []string{"lexeme", "kanji", "grammar"} {
		t.Run(contentType, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodGet, "/api/admin/content/summary?type="+contentType, nil)
			adminContentSummaryHandler(db, testLogger()).ServeHTTP(recorder, request)
			if recorder.Code != http.StatusOK {
				t.Fatalf("status=%d body=%s; want 200", recorder.Code, recorder.Body.String())
			}
			var result struct {
				ByCategory         map[string]int `json:"byCategory"`
				ByLevel            map[string]int `json:"byLevel"`
				ByStatus           map[string]int `json:"byStatus"`
				DistinctLevelCount int            `json:"distinctLevelCount"`
				Total              int            `json:"total"`
				Type               string         `json:"type"`
			}
			if err := json.Unmarshal(recorder.Body.Bytes(), &result); err != nil {
				t.Fatal(err)
			}
			if result.ByLevel == nil || result.ByStatus == nil || result.Type != contentType || result.DistinctLevelCount < 0 || result.Total < 0 {
				t.Fatalf("invalid content summary contract: %+v", result)
			}
		})
	}
}

func TestAdminContentSummaryReturnsServerErrorWhenDatabaseFails(t *testing.T) {
	db := testPool(t)
	db.Close()
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/admin/content/summary?type=lexeme", nil)
	adminContentSummaryHandler(db, testLogger()).ServeHTTP(recorder, request)
	if recorder.Code != http.StatusInternalServerError {
		t.Fatalf("status=%d body=%s; want 500", recorder.Code, recorder.Body.String())
	}
}

func TestAdminContentListReturnsTypedItems(t *testing.T) {
	db := testPool(t)
	for _, contentType := range []string{"lexeme", "kanji", "grammar"} {
		t.Run(contentType, func(t *testing.T) {
			var fixture string
			switch contentType {
			case "lexeme":
				fixture = "audit-list-fixture-lexeme"
				if _, err := db.Exec(context.Background(), "INSERT INTO content.lexeme (headword, reading, created_at, updated_at) VALUES ($1, $1, NOW(), NOW())", fixture); err != nil {
					t.Fatal(err)
				}
				defer db.Exec(context.Background(), "DELETE FROM content.lexeme WHERE headword = $1", fixture)
			case "kanji":
				fixture = "鿿"
				if _, err := db.Exec(context.Background(), "INSERT INTO content.kanji (character, created_at, updated_at) VALUES ($1, NOW(), NOW())", fixture); err != nil {
					t.Fatal(err)
				}
				defer db.Exec(context.Background(), "DELETE FROM content.kanji WHERE character = $1", fixture)
			case "grammar":
				fixture = "audit-list-fixture-grammar"
				if _, err := db.Exec(context.Background(), "INSERT INTO content.grammar_point (pattern, meaning_vi, created_at, updated_at) VALUES ($1, $1, NOW(), NOW())", fixture); err != nil {
					t.Fatal(err)
				}
				defer db.Exec(context.Background(), "DELETE FROM content.grammar_point WHERE pattern = $1", fixture)
			}
			recorder := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodGet, "/api/admin/content?type="+contentType+"&q="+fixture+"&page=1&pageSize=1", nil)
			adminContentListHandler(db, testLogger()).ServeHTTP(recorder, request)
			if recorder.Code != http.StatusOK {
				t.Fatalf("status=%d body=%s; want 200", recorder.Code, recorder.Body.String())
			}
			var result struct {
				Items []map[string]any `json:"items"`
			}
			if err := json.Unmarshal(recorder.Body.Bytes(), &result); err != nil {
				t.Fatal(err)
			}
			if len(result.Items) != 1 {
				t.Fatalf("expected fixture item, got %d", len(result.Items))
			}
			key := map[string]string{"lexeme": "headword", "kanji": "character", "grammar": "pattern"}[contentType]
			if _, ok := result.Items[0][key]; !ok {
				t.Fatalf("item missing %q: %+v", key, result.Items[0])
			}
		})
	}
}
