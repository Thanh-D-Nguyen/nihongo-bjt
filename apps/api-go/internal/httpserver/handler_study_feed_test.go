package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

// Authenticate through the real session guard, while exercising only this handler.
func studyFeedRequest(t *testing.T, db *pgxpool.Pool, query string) *http.Request {
	t.Helper()
	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Study Feed", fmt.Sprintf("feed-%s@example.com", userID), "")
	store := session.NewStore(db)
	token := createLearnerSession(t, store, userID)
	req := httptest.NewRequest(http.MethodGet, "/api/recommendation/study-feed"+query, nil)
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: token})
	var authenticated *http.Request
	guard := authn.LearnerGuard(store, authn.DefaultGuardConfig(testLogger()))
	rr := httptest.NewRecorder()
	guard(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		authenticated = r
	})).ServeHTTP(rr, req)
	if authenticated == nil {
		t.Fatalf("authenticate fixture: %d %s", rr.Code, rr.Body.String())
	}
	return authenticated
}

func TestStudyFeed_PublishedLessonsEnvelope(t *testing.T) {
	db := testPool(t)
	req := studyFeedRequest(t, db, "?limit=100")
	type fixture struct {
		id, slug, title, status string
		published               bool
	}
	lessons := []fixture{
		{newUUID(t), "", "Chào hỏi trong công ty", "published", true},
		{newUUID(t), "", "Giới thiệu bản thân", "published", true},
		{newUUID(t), "", "Xác nhận lịch họp", "active", true},
		{newUUID(t), "", "Bản nháp", "draft", true},
		{newUUID(t), "", "Bài học lưu trữ", "archived", true},
		{newUUID(t), "", "Chưa xuất bản", "draft", false},
	}
	for i := range lessons {
		lessons[i].slug = "feed-test-" + lessons[i].id
		lesson := lessons[i]
		_, err := db.Exec(context.Background(), `
			INSERT INTO curriculum.bjt_lesson
				(id, level_code, sort_order, slug, title_vi, title_ja, status, published_at, updated_at)
			VALUES ($1, 'J5', $2, $3, $4, '会社での挨拶', $5,
				CASE WHEN $6 THEN NOW() ELSE NULL END, NOW())`,
			lesson.id, 100000+i, lesson.slug, lesson.title, lesson.status, lesson.published)
		if err != nil {
			t.Fatalf("seed canonical lesson: %v", err)
		}
		t.Cleanup(func() {
			if _, err := db.Exec(context.Background(), `DELETE FROM curriculum.bjt_lesson WHERE id = $1`, lesson.id); err != nil {
				t.Errorf("cleanup lesson: %v", err)
			}
		})
	}

	handler := getStudyFeedHandler(db, testLogger())
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
	var feed struct {
		Items []struct {
			ID       string            `json:"id"`
			Type     string            `json:"type"`
			Title    string            `json:"title"`
			Score    *float64          `json:"score"`
			Source   string            `json:"source"`
			Metadata map[string]string `json:"metadata"`
		} `json:"items"`
		Meta *struct {
			Pipeline      string   `json:"pipeline"`
			TotalSourced  *int     `json:"totalSourced"`
			TotalReturned *int     `json:"totalReturned"`
			ExecutionMs   *float64 `json:"executionMs"`
		} `json:"meta"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &feed); err != nil {
		t.Fatalf("expected study-feed object envelope with items and meta, got %s: %v", rr.Body.String(), err)
	}
	if feed.Items == nil || feed.Meta == nil {
		t.Fatalf("expected non-null items array and meta object, got %s", rr.Body.String())
	}
	if feed.Meta.Pipeline == "" || feed.Meta.TotalSourced == nil || feed.Meta.TotalReturned == nil || feed.Meta.ExecutionMs == nil {
		t.Fatalf("missing feed metadata: %s", rr.Body.String())
	}
	if len(feed.Items) != 3 || *feed.Meta.TotalSourced != 3 || *feed.Meta.TotalReturned != len(feed.Items) || *feed.Meta.ExecutionMs < 0 {
		t.Fatalf("incorrect feed counts or timing: %s", rr.Body.String())
	}
	for i, lesson := range lessons {
		found := false
		for _, item := range feed.Items {
			if item.ID != lesson.id {
				continue
			}
			found = true
			if item.Type != "lesson" || item.Title != lesson.title || item.Score == nil || item.Source == "" || item.Metadata["slug"] != lesson.slug || item.Metadata["levelCode"] != "J5" {
				t.Errorf("incorrect seeded lesson item: %+v", item)
			}
		}
		if found != (i < 3) {
			t.Errorf("seeded lesson %s status=%s: found=%v, want %v", lesson.id, lesson.status, found, i < 3)
		}
	}

	// Limit must affect the result without changing the count of eligible sources.
	limitedReq := req.Clone(req.Context())
	limitedReq.URL.RawQuery = "limit=1"
	limitedRR := httptest.NewRecorder()
	handler.ServeHTTP(limitedRR, limitedReq)
	var limited struct {
		Items []json.RawMessage `json:"items"`
		Meta  struct {
			TotalSourced  int `json:"totalSourced"`
			TotalReturned int `json:"totalReturned"`
		} `json:"meta"`
	}
	if limitedRR.Code != http.StatusOK || json.Unmarshal(limitedRR.Body.Bytes(), &limited) != nil || len(limited.Items) != 1 || limited.Meta.TotalReturned != 1 || limited.Meta.TotalSourced != *feed.Meta.TotalSourced {
		t.Fatalf("expected limit=1 with unchanged sourced count: %d %s", limitedRR.Code, limitedRR.Body.String())
	}
}

func TestStudyFeed_InvalidLimit(t *testing.T) {
	db := testPool(t)
	req := studyFeedRequest(t, db, "")
	for _, value := range []string{"", "0", "-1", "101", "abc", "1.5", "999999999999999999999", "1&limit=2"} {
		t.Run(value, func(t *testing.T) {
			invalidReq := req.Clone(req.Context())
			invalidReq.URL.RawQuery = "limit=" + value
			rr := httptest.NewRecorder()
			getStudyFeedHandler(db, testLogger()).ServeHTTP(rr, invalidReq)
			if rr.Code != http.StatusBadRequest {
				t.Errorf("expected 400 for invalid limit %q, got %d: %s", value, rr.Code, rr.Body.String())
			}
		})
	}
}

func TestStudyFeed_Unauthorized(t *testing.T) {
	rr := httptest.NewRecorder()
	getStudyFeedHandler(nil, testLogger()).ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/api/recommendation/study-feed", nil))
	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 without learner identity, got %d", rr.Code)
	}
}

func TestStudyFeed_DatabaseFailure(t *testing.T) {
	db := testPool(t)
	req := studyFeedRequest(t, db, "")
	closedPool := testPool(t)
	closedPool.Close()
	rr := httptest.NewRecorder()
	getStudyFeedHandler(closedPool, testLogger()).ServeHTTP(rr, req)
	if rr.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500 for failed PostgreSQL query, got %d: %s", rr.Code, rr.Body.String())
	}
	var body map[string]string
	if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil || body["error"] == "" {
		t.Fatalf("expected JSON error response, got %s", rr.Body.String())
	}
}
