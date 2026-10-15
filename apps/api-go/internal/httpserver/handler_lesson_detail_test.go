package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

func TestLessonDetailPublishedRoute(t *testing.T) {
	db := testPool(t)
	lessonID := newUUID(t)
	slug := "lesson-detail-test-" + lessonID[:8]
	_, err := db.Exec(context.Background(), `
		INSERT INTO curriculum.bjt_lesson
			(id, level_code, sort_order, slug, title_vi, title_ja, lesson_content, status, published_at, updated_at)
		VALUES ($1, 'J1', 999900, $2, 'Bài học kiểm thử', 'テストレッスン',
			'{"schemaVersion":"1","learningObjectives":["Mục tiêu"]}'::jsonb,
			'published', now(), now())`, lessonID, slug)
	if err != nil {
		t.Fatalf("seed published lesson: %v", err)
	}
	t.Cleanup(func() {
		if _, err := db.Exec(context.Background(), `DELETE FROM curriculum.bjt_lesson WHERE id=$1`, lessonID); err != nil {
			t.Errorf("delete test lesson: %v", err)
		}
	})

	router := NewRouter(withLevelReadLimiter(Dependencies{Config: &config.Config{}, Logger: testLogger(), DBPool: db, RateLimiter: levelTestRateLimiter(t)}, levelTestRateLimiter(t)))
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/api/levels/lessons/"+slug, nil))
	if rr.Code != http.StatusOK {
		t.Fatalf("expected published lesson detail 200, got %d: %s", rr.Code, rr.Body.String())
	}
	var body struct {
		ID            string          `json:"id"`
		Slug          string          `json:"slug"`
		TitleVi       string          `json:"titleVi"`
		LessonContent json.RawMessage `json:"lessonContent"`
		Contents      []any           `json:"contents"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode lesson detail: %v", err)
	}
	if body.ID != lessonID || body.Slug != slug || body.TitleVi != "Bài học kiểm thử" || len(body.Contents) != 0 {
		t.Fatalf("unexpected lesson response: %+v", body)
	}
	var content struct {
		SchemaVersion string   `json:"schemaVersion"`
		Objectives    []string `json:"learningObjectives"`
	}
	if err := json.Unmarshal(body.LessonContent, &content); err != nil || content.SchemaVersion != "1" || len(content.Objectives) != 1 {
		t.Fatalf("lesson content was not preserved: %s (%v)", body.LessonContent, err)
	}

	missing := httptest.NewRecorder()
	router.ServeHTTP(missing, httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/levels/lessons/%s", slug+"-missing"), nil))
	if missing.Code != http.StatusNotFound {
		t.Fatalf("expected unknown lesson 404, got %d: %s", missing.Code, missing.Body.String())
	}
}

func TestLessonDetailReturnsCanonicalLinkedContent(t *testing.T) {
	db := testPool(t)
	lessonID, lexemeID, kanjiID, grammarID := newUUID(t), newUUID(t), newUUID(t), newUUID(t)
	slug := "lesson-content-test-" + lessonID[:8]
	_, err := db.Exec(context.Background(), `INSERT INTO curriculum.bjt_lesson
		(id, level_code, sort_order, slug, title_vi, title_ja, status, published_at, updated_at)
		VALUES ($1, 'J1', 999901, $2, 'Bài học', 'レッスン', 'published', now(), now())`, lessonID, slug)
	if err != nil {
		t.Fatalf("seed lesson: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM curriculum.bjt_lesson WHERE id=$1`, lessonID)
	})
	fixtures := []struct {
		query string
		args  []any
	}{
		{`INSERT INTO content.lexeme (id,headword,reading,short_meaning_vi,status,created_at,updated_at) VALUES ($1,'会議','かいぎ','cuộc họp','active',now(),now())`, []any{lexemeID}},
		{`INSERT INTO content.lexeme_sense (lexeme_id,position,part_of_speech,meaning_vi) VALUES ($1,1,'noun','cuộc họp')`, []any{lexemeID}},
		{`INSERT INTO content.kanji (id,character,meaning_vi,onyomi,kunyomi,status,created_at,updated_at) VALUES ($1,'会','hội','カイ','あ.う','active',now(),now())`, []any{kanjiID}},
		{`INSERT INTO content.kanji_component (kanji_id,position,han_viet,character) VALUES ($1,1,'nhân','人')`, []any{kanjiID}},
		{`INSERT INTO content.kanji_example (kanji_id,position,meaning_vi,reading,word) VALUES ($1,1,'cuộc họp','かいぎ','会議')`, []any{kanjiID}},
		{`INSERT INTO content.grammar_point (id,pattern,meaning_vi,status,created_at,updated_at) VALUES ($1,'〜について','về','active',now(),now())`, []any{grammarID}},
		{`INSERT INTO content.grammar_point_detail (grammar_point_id,position,explanation) VALUES ($1,1,'Cách dùng trong công việc')`, []any{grammarID}},
	}
	for _, fixture := range fixtures {
		if _, err := db.Exec(context.Background(), fixture.query, fixture.args...); err != nil {
			t.Fatalf("seed lesson content: %v", err)
		}
	}
	for index, item := range []struct{ kind, id string }{{"vocabulary", lexemeID}, {"kanji", kanjiID}, {"grammar", grammarID}} {
		if _, err := db.Exec(context.Background(), `INSERT INTO curriculum.bjt_lesson_item (lesson_id,content_type,content_id,sort_order) VALUES ($1,$2,$3,$4)`, lessonID, item.kind, item.id, index+1); err != nil {
			t.Fatalf("link lesson content: %v", err)
		}
	}
	t.Cleanup(func() {
		for _, fixture := range []struct{ table, id string }{{"content.lexeme", lexemeID}, {"content.kanji", kanjiID}, {"content.grammar_point", grammarID}} {
			if _, err := db.Exec(context.Background(), `DELETE FROM `+fixture.table+` WHERE id=$1`, fixture.id); err != nil {
				t.Errorf("delete content fixture %s: %v", fixture.table, err)
			}
		}
	})

	router := NewRouter(withLevelReadLimiter(Dependencies{Config: &config.Config{}, Logger: testLogger(), DBPool: db, RateLimiter: levelTestRateLimiter(t)}, levelTestRateLimiter(t)))
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/api/levels/lessons/"+slug, nil))
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
	var response struct {
		Contents []struct {
			SortOrder   int             `json:"sortOrder"`
			ContentType string          `json:"contentType"`
			Content     json.RawMessage `json:"content"`
		} `json:"contents"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode lesson contents: %v", err)
	}
	if len(response.Contents) != 3 {
		t.Fatalf("expected all three canonical content types, got %s", rr.Body.String())
	}
	for i, expected := range []string{"vocabulary", "kanji", "grammar"} {
		if response.Contents[i].SortOrder != i+1 || response.Contents[i].ContentType != expected || len(response.Contents[i].Content) == 0 {
			t.Fatalf("content order/type mismatch at %d: %+v", i, response.Contents[i])
		}
	}
	if !strings.Contains(string(response.Contents[0].Content), `"meaningVi":"cuộc họp"`) ||
		!strings.Contains(string(response.Contents[1].Content), `"component":"人"`) ||
		!strings.Contains(string(response.Contents[2].Content), `"explanationVi":"Cách dùng trong công việc"`) {
		t.Fatalf("canonical child details missing from response: %s", rr.Body.String())
	}
}

func TestLessonProgressPersistsForAuthenticatedLearner(t *testing.T) {
	db := testPool(t)
	userID, lessonID := newUUID(t), newUUID(t)
	slug := "lesson-progress-test-" + lessonID[:8]
	seedActiveUser(t, db, userID, "Lesson Progress", fmt.Sprintf("lesson-%s@example.com", userID[:8]), "")
	if _, err := db.Exec(context.Background(), `INSERT INTO curriculum.bjt_lesson
		(id, level_code, sort_order, slug, title_vi, title_ja, status, published_at, updated_at)
		VALUES ($1, 'J1', 999902, $2, 'Bài học', 'レッスン', 'published', now(), now())`, lessonID, slug); err != nil {
		t.Fatalf("seed lesson: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM curriculum.bjt_lesson WHERE id=$1`, lessonID)
	})
	sessions := session.NewStore(db)
	token := createLearnerSession(t, sessions, userID)
	router := NewRouter(withLevelReadLimiter(Dependencies{
		Config:       &config.Config{CORSOrigins: []string{"http://localhost:18081"}},
		Logger:       testLogger(),
		DBPool:       db,
		SessionStore: sessions,
		RateLimiter:  levelTestRateLimiter(t),
	}, levelTestRateLimiter(t)))
	request := func(method, body string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, "/api/levels/lessons/"+slug+"/progress", strings.NewReader(body))
		req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: token})
		if method == http.MethodPut {
			req.Header.Set("Origin", "http://localhost:18081")
		}
		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)
		return rr
	}
	if rr := request(http.MethodPut, `{"completed":true}`); rr.Code != http.StatusOK {
		t.Fatalf("complete lesson: %d %s", rr.Code, rr.Body.String())
	}
	if rr := request(http.MethodPut, `{"completed":true}`); rr.Code != http.StatusOK {
		t.Fatalf("idempotent completion: %d %s", rr.Code, rr.Body.String())
	}
	get := httptest.NewRequest(http.MethodGet, "/api/levels/lessons/"+slug, nil)
	get.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: token})
	completed := httptest.NewRecorder()
	router.ServeHTTP(completed, get)
	if completed.Code != http.StatusOK || !strings.Contains(completed.Body.String(), `"isCompleted":true`) || !strings.Contains(completed.Body.String(), `"canSaveProgress":true`) {
		t.Fatalf("expected persisted completion in lesson response, got %d %s", completed.Code, completed.Body.String())
	}
	if rr := request(http.MethodPut, `{"completed":false}`); rr.Code != http.StatusOK {
		t.Fatalf("uncomplete lesson: %d %s", rr.Code, rr.Body.String())
	}
	get = httptest.NewRequest(http.MethodGet, "/api/levels/lessons/"+slug, nil)
	get.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: token})
	cleared := httptest.NewRecorder()
	router.ServeHTTP(cleared, get)
	if cleared.Code != http.StatusOK || !strings.Contains(cleared.Body.String(), `"isCompleted":false`) {
		t.Fatalf("expected cleared completion in lesson response, got %d %s", cleared.Code, cleared.Body.String())
	}
	if rr := request(http.MethodPut, `{"completed":"yes"}`); rr.Code != http.StatusBadRequest {
		t.Fatalf("invalid completion value should be rejected, got %d %s", rr.Code, rr.Body.String())
	}
}

func TestLessonProgressRejectsAnonymousMutation(t *testing.T) {
	db := testPool(t)
	router := NewRouter(withLevelReadLimiter(Dependencies{
		Config:       &config.Config{CORSOrigins: []string{"http://localhost:18081"}},
		Logger:       testLogger(),
		DBPool:       db,
		SessionStore: session.NewStore(db),
		RateLimiter:  levelTestRateLimiter(t),
	}, levelTestRateLimiter(t)))
	req := httptest.NewRequest(http.MethodPut, "/api/levels/lessons/nope/progress", strings.NewReader(`{"completed":true}`))
	req.Header.Set("Origin", "http://localhost:18081")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)
	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected anonymous progress mutation to be denied, got %d %s", rr.Code, rr.Body.String())
	}
}

func TestLessonProgressUncompleteMissingLessonReturnsNotFound(t *testing.T) {
	db := testPool(t)
	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Lesson Progress", fmt.Sprintf("lesson-missing-%s@example.com", userID[:8]), "")
	sessions := session.NewStore(db)
	token := createLearnerSession(t, sessions, userID)
	router := NewRouter(withLevelReadLimiter(Dependencies{
		Config:       &config.Config{CORSOrigins: []string{"http://localhost:18081"}},
		Logger:       testLogger(),
		DBPool:       db,
		SessionStore: sessions,
		RateLimiter:  levelTestRateLimiter(t),
	}, levelTestRateLimiter(t)))
	req := httptest.NewRequest(http.MethodPut, "/api/levels/lessons/lesson-does-not-exist/progress", strings.NewReader(`{"completed":false}`))
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: token})
	req.Header.Set("Origin", "http://localhost:18081")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)
	if rr.Code != http.StatusNotFound {
		t.Fatalf("expected missing lesson uncomplete to return 404, got %d %s", rr.Code, rr.Body.String())
	}
}

func TestLessonProgressRejectsUntrustedOrigin(t *testing.T) {
	db := testPool(t)
	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Lesson CSRF", fmt.Sprintf("lesson-csrf-%s@example.com", userID[:8]), "")
	sessions := session.NewStore(db)
	token := createLearnerSession(t, sessions, userID)
	router := NewRouter(withLevelReadLimiter(Dependencies{
		Config:       &config.Config{CORSOrigins: []string{"http://localhost:18081"}},
		Logger:       testLogger(),
		DBPool:       db,
		SessionStore: sessions,
		RateLimiter:  levelTestRateLimiter(t),
	}, levelTestRateLimiter(t)))
	req := httptest.NewRequest(http.MethodPut, "/api/levels/lessons/lesson-does-not-exist/progress", strings.NewReader(`{"completed":true}`))
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: token})
	req.Header.Set("Origin", "https://attacker.example")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)
	if rr.Code != http.StatusForbidden {
		t.Fatalf("expected untrusted origin to be rejected, got %d %s", rr.Code, rr.Body.String())
	}
}
