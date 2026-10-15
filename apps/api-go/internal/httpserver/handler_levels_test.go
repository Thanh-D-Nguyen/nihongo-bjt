package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"reflect"
	"strconv"
	"strings"
	"testing"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

func levelTestRateLimiter(t *testing.T) *authn.RateLimiter {
	t.Helper()
	limiter := testRateLimiter(t)
	t.Cleanup(limiter.Stop)
	return limiter
}

func withLevelReadLimiter(deps Dependencies, limiter *authn.RateLimiter) Dependencies {
	// The quality replay compiles this test against start_head, before the dedicated field existed.
	field := reflect.ValueOf(&deps).Elem().FieldByName("PublicReadRateLimiter")
	if field.IsValid() && field.CanSet() {
		if limiter == nil {
			field.Set(reflect.Zero(field.Type()))
		} else {
			field.Set(reflect.ValueOf(limiter))
		}
	}
	return deps
}

func TestLevelDetailReturnsEstablishedBJTDefinition(t *testing.T) {
	db := testPool(t)
	lexemeID, kanjiID, grammarID := newUUID(t), newUUID(t), newUUID(t)
	for _, fixture := range []struct {
		query string
		id    string
	}{
		{`INSERT INTO content.lexeme (id,headword,jlpt_level,status,created_at,updated_at) VALUES ($1::uuid,'fixture-'||left($1::text,8),'N1','active',now(),now())`, lexemeID},
		{`INSERT INTO content.kanji (id,character,level,status,created_at,updated_at) VALUES ($1,'鿿',1,'active',now(),now())`, kanjiID},
		{`INSERT INTO content.grammar_point (id,pattern,meaning_vi,jlpt_level,status,created_at,updated_at) VALUES ($1,'〜監査','fixture','N1','active',now(),now())`, grammarID},
	} {
		if _, err := db.Exec(context.Background(), fixture.query, fixture.id); err != nil {
			t.Fatalf("seed canonical level count fixture: %v", err)
		}
	}
	t.Cleanup(func() {
		for _, fixture := range []struct{ table, id string }{{"content.lexeme", lexemeID}, {"content.kanji", kanjiID}, {"content.grammar_point", grammarID}} {
			if _, err := db.Exec(context.Background(), `DELETE FROM `+fixture.table+` WHERE id=$1`, fixture.id); err != nil {
				t.Errorf("delete count fixture: %v", err)
			}
		}
	})
	router := NewRouter(withLevelReadLimiter(Dependencies{Config: &config.Config{}, Logger: testLogger(), DBPool: db}, levelTestRateLimiter(t)))

	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/api/levels/J1", nil))
	if rr.Code != http.StatusOK {
		t.Fatalf("expected known level metadata 200, got %d: %s", rr.Code, rr.Body.String())
	}
	var level struct {
		Code         string `json:"code"`
		ScoreMin     int    `json:"scoreMin"`
		ScoreMax     int    `json:"scoreMax"`
		JLPTEquiv    string `json:"jlptEquiv"`
		VocabCount   int    `json:"vocabCount"`
		KanjiCount   int    `json:"kanjiCount"`
		GrammarCount int    `json:"grammarCount"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &level); err != nil {
		t.Fatalf("decode level definition: %v", err)
	}
	if level.Code != "J1" || level.ScoreMin != 530 || level.ScoreMax != 599 || level.JLPTEquiv != "N1" || level.VocabCount == 0 || level.KanjiCount == 0 || level.GrammarCount == 0 {
		t.Fatalf("expected established J1 metadata and canonical counts, got %+v", level)
	}
	unknown := httptest.NewRecorder()
	router.ServeHTTP(unknown, httptest.NewRequest(http.MethodGet, "/api/levels/J9", nil))
	if unknown.Code != http.StatusNotFound {
		t.Fatalf("expected unknown level 404, got %d %s", unknown.Code, unknown.Body.String())
	}
}

func TestLevelListReturnsLocalizedCanonicalLevels(t *testing.T) {
	db := testPool(t)
	lexemeID, kanjiID, grammarID := newUUID(t), newUUID(t), newUUID(t)
	fixtures := []struct {
		query string
		id    string
	}{
		{`INSERT INTO content.lexeme (id,headword,jlpt_level,status,created_at,updated_at) VALUES ($1,'level-list-fixture','N5','active',now(),now())`, lexemeID},
		{`INSERT INTO content.kanji (id,character,level,status,created_at,updated_at) VALUES ($1,'𠀀',5,'active',now(),now())`, kanjiID},
		{`INSERT INTO content.grammar_point (id,pattern,meaning_vi,jlpt_level,status,created_at,updated_at) VALUES ($1,'level-list-fixture','fixture','N5','active',now(),now())`, grammarID},
	}
	for _, fixture := range fixtures {
		if _, err := db.Exec(context.Background(), fixture.query, fixture.id); err != nil {
			t.Fatalf("seed level list content: %v", err)
		}
	}
	t.Cleanup(func() {
		for _, fixture := range []struct{ table, id string }{{"content.lexeme", lexemeID}, {"content.kanji", kanjiID}, {"content.grammar_point", grammarID}} {
			if _, err := db.Exec(context.Background(), `DELETE FROM `+fixture.table+` WHERE id=$1`, fixture.id); err != nil {
				t.Errorf("delete level list fixture: %v", err)
			}
		}
	})
	limiter := levelTestRateLimiter(t)
	deps := withLevelReadLimiter(Dependencies{Config: &config.Config{}, Logger: testLogger(), DBPool: db, RateLimiter: limiter}, limiter)
	router := NewRouter(deps)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/levels", nil))
	if response.Code != http.StatusOK {
		t.Fatalf("public level list: expected 200, got %d: %s", response.Code, response.Body.String())
	}
	var levels []struct {
		Code          string `json:"code"`
		NameVi        string `json:"nameVi"`
		NameJa        string `json:"nameJa"`
		NameEn        string `json:"nameEn"`
		DescriptionEn string `json:"descriptionEn"`
		VocabCount    int    `json:"vocabCount"`
		KanjiCount    int    `json:"kanjiCount"`
		GrammarCount  int    `json:"grammarCount"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &levels); err != nil {
		t.Fatalf("decode level list: %v", err)
	}
	wantCodes := []string{"J5", "J4", "J3", "J2", "J1", "J1+"}
	if len(levels) != len(wantCodes) {
		t.Fatalf("expected six levels, got %d: %s", len(levels), response.Body.String())
	}
	for i, code := range wantCodes {
		if levels[i].Code != code || levels[i].NameVi == "" || levels[i].NameJa == "" || levels[i].NameEn == "" || levels[i].DescriptionEn == "" {
			t.Fatalf("localized level %d is incomplete: %+v", i, levels[i])
		}
	}
	if levels[0].VocabCount != 1 || levels[0].KanjiCount != 1 || levels[0].GrammarCount != 1 {
		t.Fatalf("J5 canonical counts should include the three active fixtures: %+v", levels[0])
	}
	if levels[5].VocabCount != 0 || levels[5].KanjiCount != 0 || levels[5].GrammarCount != 0 {
		t.Fatalf("J1+ must not alias N1 canonical content: %+v", levels[5])
	}
}

func TestJ1PlusDoesNotReuseN1ReferenceContent(t *testing.T) {
	jlpt, kanjiLevel, ok := levelFilters("J1+")
	if !ok || len(jlpt) != 0 || kanjiLevel != 0 {
		t.Fatalf("J1+ filter = (%v, %d, %v), want empty JLPT/level 0/true", jlpt, kanjiLevel, ok)
	}
	db := testPool(t)
	limiter := levelTestRateLimiter(t)
	router := NewRouter(withLevelReadLimiter(Dependencies{Config: &config.Config{}, Logger: testLogger(), DBPool: db}, limiter))
	for _, endpoint := range []string{"/api/levels/J1+", "/api/levels/J1+/vocabulary", "/api/levels/J1+/kanji", "/api/levels/J1+/grammar"} {
		response := httptest.NewRecorder()
		router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, endpoint, nil))
		if response.Code != http.StatusOK {
			t.Fatalf("GET %s: expected 200, got %d: %s", endpoint, response.Code, response.Body.String())
		}
		if endpoint == "/api/levels/J1+" {
			var counts struct {
				Vocabulary int `json:"vocabCount"`
				Kanji      int `json:"kanjiCount"`
				Grammar    int `json:"grammarCount"`
			}
			if err := json.Unmarshal(response.Body.Bytes(), &counts); err != nil {
				t.Fatal(err)
			}
			if counts.Vocabulary != 0 || counts.Kanji != 0 || counts.Grammar != 0 {
				t.Fatalf("J1+ counts must not duplicate N1 data: %+v", counts)
			}
		} else if response.Body.String() != "[]\n" {
			t.Fatalf("GET %s must not repeat N1 rows, got %s", endpoint, response.Body.String())
		}
	}
}

func TestLevelLessonsRouteRegisteredWithoutLearnerSessions(t *testing.T) {
	db := testPool(t)
	router := NewRouter(withLevelReadLimiter(Dependencies{Config: &config.Config{}, Logger: testLogger(), DBPool: db}, levelTestRateLimiter(t)))
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/api/levels/J1/lessons", nil))
	if rr.Code != http.StatusOK {
		t.Fatalf("public lesson list without session store: expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestLevelPublicReadsApplyIPRateLimit(t *testing.T) {
	db := testPool(t)
	limiterConfig := authn.DefaultRateLimiterConfig()
	limiterConfig.Limit = 1
	limiter, err := authn.NewRateLimiter(limiterConfig)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(limiter.Stop)
	router := NewRouter(withLevelReadLimiter(Dependencies{Config: &config.Config{}, Logger: testLogger(), DBPool: db, RateLimiter: limiter}, limiter))
	request := httptest.NewRequest(http.MethodGet, "/api/levels/J1", nil)
	request.RemoteAddr = "192.0.2.10:54321"
	first := httptest.NewRecorder()
	router.ServeHTTP(first, request)
	if first.Code != http.StatusOK {
		t.Fatalf("first public read: expected 200, got %d: %s", first.Code, first.Body.String())
	}
	second := httptest.NewRecorder()
	secondRequest := request.Clone(context.Background())
	secondRequest.Header.Set("X-Forwarded-For", "198.51.100.99")
	router.ServeHTTP(second, secondRequest)
	if second.Code != http.StatusTooManyRequests {
		t.Fatalf("rate-limited public read: expected 429, got %d: %s", second.Code, second.Body.String())
	}
}

func TestLevelPublicReadsUseClientIPFromLocalProxy(t *testing.T) {
	db := testPool(t)
	limiterConfig := authn.DefaultRateLimiterConfig()
	limiterConfig.Limit = 1
	limiter, err := authn.NewRateLimiter(limiterConfig)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(limiter.Stop)
	router := NewRouter(withLevelReadLimiter(Dependencies{Config: &config.Config{}, Logger: testLogger(), DBPool: db, RateLimiter: limiter}, limiter))
	request := func(clientIP string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodGet, "/api/levels/J1", nil)
		req.RemoteAddr = "127.0.0.1:4001"
		req.Header.Set("X-Forwarded-For", clientIP)
		response := httptest.NewRecorder()
		router.ServeHTTP(response, req)
		return response
	}
	if response := request("198.51.100.10"); response.Code != http.StatusOK {
		t.Fatalf("first proxied client read: expected 200, got %d: %s", response.Code, response.Body.String())
	}
	if response := request("198.51.100.11"); response.Code != http.StatusOK {
		t.Fatalf("second proxied client must have an independent bucket: expected 200, got %d: %s", response.Code, response.Body.String())
	}
	if response := request("198.51.100.10"); response.Code != http.StatusTooManyRequests {
		t.Fatalf("repeated proxied client read: expected 429, got %d: %s", response.Code, response.Body.String())
	}
}

func TestLevelPublicReadsUseConfiguredDockerProxyIP(t *testing.T) {
	db := testPool(t)
	limiterConfig := authn.DefaultRateLimiterConfig()
	limiterConfig.Limit = 1
	limiter, err := authn.NewRateLimiter(limiterConfig)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(limiter.Stop)
	_, proxyCIDR, err := net.ParseCIDR("172.29.254.3/32")
	if err != nil {
		t.Fatal(err)
	}
	deps := Dependencies{Config: &config.Config{TrustedProxyCIDRs: []*net.IPNet{proxyCIDR}}, Logger: testLogger(), DBPool: db, RateLimiter: limiter}
	router := NewRouter(withLevelReadLimiter(deps, limiter))
	request := func(clientIP string, remote string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodGet, "/api/levels/J1", nil)
		req.RemoteAddr = remote
		req.Header.Set("X-Forwarded-For", clientIP)
		response := httptest.NewRecorder()
		router.ServeHTTP(response, req)
		return response
	}
	if response := request("198.51.100.10", "172.29.254.3:4001"); response.Code != http.StatusOK {
		t.Fatalf("first configured Caddy client: expected 200, got %d: %s", response.Code, response.Body.String())
	}
	if response := request("198.51.100.11", "172.29.254.3:4001"); response.Code != http.StatusOK {
		t.Fatalf("second configured Caddy client should have independent bucket: got %d: %s", response.Code, response.Body.String())
	}
	if response := request("198.51.100.12", "172.29.254.4:4001"); response.Code != http.StatusOK {
		t.Fatalf("untrusted Docker peer should use its own peer-IP bucket, got %d: %s", response.Code, response.Body.String())
	}
	if response := request("198.51.100.13", "172.29.254.4:4001"); response.Code != http.StatusTooManyRequests {
		t.Fatalf("untrusted peer must not bypass its bucket by spoofing forwarded IP, got %d: %s", response.Code, response.Body.String())
	}
}

func TestLevelPublicReadsFailClosedWithoutLimiter(t *testing.T) {
	db := testPool(t)
	router := NewRouter(Dependencies{
		Config:      &config.Config{},
		Logger:      testLogger(),
		DBPool:      db,
		RateLimiter: levelTestRateLimiter(t),
	})
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/api/levels/J1", nil))
	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("public read without limiter: expected 503, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestLevelLessonsExposePublishedRowsAndLearnerProgress(t *testing.T) {
	db := testPool(t)
	lessonID, userID := newUUID(t), newUUID(t)
	draftID := newUUID(t)
	type contentFixture struct{ active, inactive, missing string }
	content := map[string]contentFixture{
		"vocabulary": {newUUID(t), newUUID(t), newUUID(t)},
		"kanji":      {newUUID(t), newUUID(t), newUUID(t)},
		"grammar":    {newUUID(t), newUUID(t), newUUID(t)},
	}
	slug := "level-summary-" + lessonID[:8]
	order := func(id string) int64 {
		value, err := strconv.ParseInt(id[:8], 16, 64)
		if err != nil {
			t.Fatalf("parse lesson fixture id: %v", err)
		}
		return 1_000_000_000 + value%500_000_000
	}
	publishedOrder, draftOrder := order(lessonID), order(draftID)
	t.Cleanup(func() {
		for _, id := range []string{lessonID, draftID} {
			if _, err := db.Exec(context.Background(), `DELETE FROM curriculum.bjt_lesson WHERE id=$1`, id); err != nil {
				t.Errorf("delete lesson fixture: %v", err)
			}
		}
		for _, fixture := range []struct{ table, id string }{
			{"content.lexeme", content["vocabulary"].active}, {"content.lexeme", content["vocabulary"].inactive},
			{"content.kanji", content["kanji"].active}, {"content.kanji", content["kanji"].inactive},
			{"content.grammar_point", content["grammar"].active}, {"content.grammar_point", content["grammar"].inactive},
		} {
			if _, err := db.Exec(context.Background(), `DELETE FROM `+fixture.table+` WHERE id=$1`, fixture.id); err != nil {
				t.Errorf("delete content fixture: %v", err)
			}
		}
	})
	seedActiveUser(t, db, userID, "Level summary", fmt.Sprintf("level-summary-%s@example.com", userID[:8]), "")
	_, err := db.Exec(context.Background(), `INSERT INTO curriculum.bjt_lesson
		(id,level_code,sort_order,slug,title_vi,title_ja,week_number,unit_type,unit_order,estimated_duration_min,lesson_content,status,published_at,updated_at)
		VALUES ($1,'J1',$2,$3,'Bài kiểm thử','テスト',8,'checkpoint',3,35,
		'{"activities":[{},{}]}'::jsonb,'published',now(),now())`, lessonID, publishedOrder, slug)
	if err != nil {
		t.Fatalf("seed published lesson: %v", err)
	}
	for _, fixture := range []struct {
		query string
		args  []any
	}{
		{`INSERT INTO content.lexeme (id,headword,jlpt_level,status,created_at,updated_at) VALUES ($1,'active-fixture','N1','active',now(),now()),($2,'inactive-fixture','N1','inactive',now(),now())`, []any{content["vocabulary"].active, content["vocabulary"].inactive}},
		{`INSERT INTO content.kanji (id,character,level,status,created_at,updated_at) VALUES ($1,'鿿',1,'active',now(),now()),($2,'鿾',1,'inactive',now(),now())`, []any{content["kanji"].active, content["kanji"].inactive}},
		{`INSERT INTO content.grammar_point (id,pattern,meaning_vi,jlpt_level,status,created_at,updated_at) VALUES ($1,'active-fixture','fixture','N1','active',now(),now()),($2,'inactive-fixture','fixture','N1','inactive',now(),now())`, []any{content["grammar"].active, content["grammar"].inactive}},
	} {
		if _, err := db.Exec(context.Background(), fixture.query, fixture.args...); err != nil {
			t.Fatalf("seed active and inactive content: %v", err)
		}
	}
	if _, err := db.Exec(context.Background(), `INSERT INTO curriculum.bjt_lesson_item (lesson_id,content_type,content_id,sort_order)
		VALUES ($1,'vocabulary',$2,1),($1,'vocabulary',$3,2),($1,'vocabulary',$4,3),
		($1,'kanji',$5,4),($1,'kanji',$6,5),($1,'kanji',$7,6),
		($1,'grammar',$8,7),($1,'grammar',$9,8),($1,'grammar',$10,9)`, lessonID,
		content["vocabulary"].active, content["vocabulary"].inactive, content["vocabulary"].missing,
		content["kanji"].active, content["kanji"].inactive, content["kanji"].missing,
		content["grammar"].active, content["grammar"].inactive, content["grammar"].missing); err != nil {
		t.Fatalf("seed lesson content links: %v", err)
	}
	_, err = db.Exec(context.Background(), `INSERT INTO curriculum.bjt_lesson
		(id,level_code,sort_order,slug,title_vi,title_ja,status,updated_at)
		VALUES ($1,'J1',$2,$3,'Borrador','草稿','draft',now())`, draftID, draftOrder, "draft-"+lessonID[:8])
	if err != nil {
		t.Fatalf("seed draft lesson: %v", err)
	}

	sessions := session.NewStore(db)
	token := createLearnerSession(t, sessions, userID)
	router := NewRouter(withLevelReadLimiter(Dependencies{
		Config:       &config.Config{CORSOrigins: []string{"http://localhost:18081"}},
		Logger:       testLogger(),
		DBPool:       db,
		SessionStore: sessions,
		RateLimiter:  levelTestRateLimiter(t),
	}, levelTestRateLimiter(t)))
	getLessons := func(authenticated bool) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodGet, "/api/levels/J1/lessons", nil)
		if authenticated {
			req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: token})
		}
		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)
		return rr
	}
	anonymous := getLessons(false)
	if anonymous.Code != http.StatusOK {
		t.Fatalf("expected anonymous lesson list 200, got %d %s", anonymous.Code, anonymous.Body.String())
	}
	var rows []struct {
		ID            string `json:"id"`
		Slug          string `json:"slug"`
		ActivityCount int    `json:"activityCount"`
		VocabCount    int    `json:"vocabCount"`
		KanjiCount    int    `json:"kanjiCount"`
		GrammarCount  int    `json:"grammarCount"`
		IsCompleted   bool   `json:"isCompleted"`
	}
	if err := json.Unmarshal(anonymous.Body.Bytes(), &rows); err != nil {
		t.Fatalf("decode level lessons: %v", err)
	}
	var fixture *struct {
		ID            string `json:"id"`
		Slug          string `json:"slug"`
		ActivityCount int    `json:"activityCount"`
		VocabCount    int    `json:"vocabCount"`
		KanjiCount    int    `json:"kanjiCount"`
		GrammarCount  int    `json:"grammarCount"`
		IsCompleted   bool   `json:"isCompleted"`
	}
	for i := range rows {
		if rows[i].Slug == slug {
			fixture = &rows[i]
			break
		}
	}
	if fixture == nil || fixture.ID != lessonID || fixture.ActivityCount != 2 || fixture.VocabCount != 1 || fixture.KanjiCount != 1 || fixture.GrammarCount != 1 || fixture.IsCompleted {
		t.Fatalf("published lesson summary or anonymous progress is wrong: %+v", fixture)
	}
	detail := httptest.NewRecorder()
	router.ServeHTTP(detail, httptest.NewRequest(http.MethodGet, "/api/levels/lessons/"+slug, nil))
	var lesson struct {
		Contents []struct {
			ContentType string `json:"contentType"`
		} `json:"contents"`
	}
	if detail.Code != http.StatusOK || json.Unmarshal(detail.Body.Bytes(), &lesson) != nil || len(lesson.Contents) != 3 {
		t.Fatalf("lesson detail must contain only active linked content: %d %s", detail.Code, detail.Body.String())
	}

	put := httptest.NewRequest(http.MethodPut, "/api/levels/lessons/"+slug+"/progress", strings.NewReader(`{"completed":true}`))
	put.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: token})
	put.Header.Set("Origin", "http://localhost:18081")
	putResult := httptest.NewRecorder()
	router.ServeHTTP(putResult, put)
	if putResult.Code != http.StatusOK {
		t.Fatalf("complete lesson: %d %s", putResult.Code, putResult.Body.String())
	}
	authenticated := getLessons(true)
	rows = nil
	if authenticated.Code != http.StatusOK || json.Unmarshal(authenticated.Body.Bytes(), &rows) != nil {
		t.Fatalf("authenticated lesson list: %d %s", authenticated.Code, authenticated.Body.String())
	}
	for _, row := range rows {
		if row.Slug == slug {
			if !row.IsCompleted {
				t.Fatal("authenticated level list did not reflect persisted lesson progress")
			}
			return
		}
	}
	t.Fatalf("published lesson missing from authenticated list: %s", authenticated.Body.String())
}

func TestLevelReferenceTabsReturnCanonicalRowsWithSearchAndPagination(t *testing.T) {
	db := testPool(t)
	lexemeID, kanjiID, grammarID := newUUID(t), newUUID(t), newUUID(t)
	lexemeWord := "監査レベル" + lexemeID[:6]
	kanjiChar := "𠀀"
	grammarPattern := "〜監査  レベル" + grammarID[:6]
	fixtures := []struct {
		query string
		args  []any
	}{
		{`INSERT INTO content.lexeme (id,headword,reading,jlpt_level,short_meaning_vi,status,created_at,updated_at) VALUES ($1,$2,'かんさ','N2,N1','từ kiểm thử','active',now(),now())`, []any{lexemeID, lexemeWord}},
		{`INSERT INTO content.lexeme_sense (lexeme_id,position,part_of_speech,meaning_vi) VALUES ($1,1,'noun','nghĩa kiểm thử')`, []any{lexemeID}},
		{`INSERT INTO content.kanji (id,character,meaning_vi,onyomi,level,frequency,status,created_at,updated_at) VALUES ($1,$2,'kanji kiểm thử','カン',1,1,'active',now(),now())`, []any{kanjiID, kanjiChar}},
		{`INSERT INTO content.kanji_component (kanji_id,position,han_viet,character) VALUES ($1,1,'nhân','人')`, []any{kanjiID}},
		{`INSERT INTO content.kanji_example (kanji_id,position,word,reading,meaning_vi) VALUES ($1,1,'日本','にほん','Nhật Bản')`, []any{kanjiID}},
		{`INSERT INTO content.grammar_point (id,pattern,meaning_vi,jlpt_level,status,created_at,updated_at) VALUES ($1,$2,'ngữ pháp kiểm thử','N1','active',now(),now())`, []any{grammarID, grammarPattern}},
		{`INSERT INTO content.grammar_point_detail (grammar_point_id,position,explanation) VALUES ($1,1,'giải thích')`, []any{grammarID}},
	}
	for _, fixture := range fixtures {
		if _, err := db.Exec(context.Background(), fixture.query, fixture.args...); err != nil {
			t.Fatalf("seed canonical reference fixture: %v", err)
		}
	}
	t.Cleanup(func() {
		for _, fixture := range []struct{ table, id string }{{"content.lexeme", lexemeID}, {"content.kanji", kanjiID}, {"content.grammar_point", grammarID}} {
			if _, err := db.Exec(context.Background(), `DELETE FROM `+fixture.table+` WHERE id=$1`, fixture.id); err != nil {
				t.Errorf("delete reference fixture: %v", err)
			}
		}
	})
	router := NewRouter(withLevelReadLimiter(Dependencies{Config: &config.Config{}, Logger: testLogger(), DBPool: db}, levelTestRateLimiter(t)))
	for _, endpoint := range []struct {
		path, query, expected string
		nested                []string
		unexpected            []string
	}{
		{"vocabulary", lexemeWord, `"headword":"` + lexemeWord + `"`, []string{`"senses":[{"pos":"noun","meaningVi":"nghĩa kiểm thử"}]`}, []string{`"partOfSpeech"`}},
		{"kanji", kanjiChar, `"character":"` + kanjiChar + `"`, []string{`"components":[{"component":"人","meaningVi":"nhân"}]`, `"examples":[{"word":"日本","reading":"にほん","meaningVi":"Nhật Bản"}]`}, []string{`"hanViet"`}},
		{"grammar", strings.Join(strings.Fields(grammarPattern), " "), `"pattern":"` + grammarPattern + `"`, []string{`"details":[{"explanationVi":"giải thích"}]`}, []string{`"explanation":"`}},
	} {
		req := httptest.NewRequest(http.MethodGet, "/api/levels/J1/"+endpoint.path+"?q="+url.QueryEscape(endpoint.query)+"&limit=1&offset=0", nil)
		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)
		if rr.Code != http.StatusOK {
			t.Fatalf("GET %s: expected 200, got %d: %s", endpoint.path, rr.Code, rr.Body.String())
		}
		if !strings.Contains(rr.Body.String(), endpoint.expected) {
			t.Fatalf("GET %s did not return its active canonical fixture: %s", endpoint.path, rr.Body.String())
		}
		for _, expected := range endpoint.nested {
			if !strings.Contains(rr.Body.String(), expected) {
				t.Errorf("GET %s did not preserve nested DTO %s: %s", endpoint.path, expected, rr.Body.String())
			}
		}
		for _, unexpected := range endpoint.unexpected {
			if strings.Contains(rr.Body.String(), unexpected) {
				t.Errorf("GET %s used incompatible nested DTO field %s: %s", endpoint.path, unexpected, rr.Body.String())
			}
		}
		offset := httptest.NewRecorder()
		router.ServeHTTP(offset, httptest.NewRequest(http.MethodGet, "/api/levels/J1/"+endpoint.path+"?q="+url.QueryEscape(endpoint.query)+"&limit=1&offset=1", nil))
		if offset.Code != http.StatusOK || offset.Body.String() != "[]\n" {
			t.Fatalf("GET %s offset page: expected empty 200, got %d: %s", endpoint.path, offset.Code, offset.Body.String())
		}
		invalid := httptest.NewRecorder()
		router.ServeHTTP(invalid, httptest.NewRequest(http.MethodGet, "/api/levels/J1/"+endpoint.path+"?limit=51", nil))
		if invalid.Code != http.StatusBadRequest {
			t.Fatalf("GET %s with oversized limit: expected 400, got %d: %s", endpoint.path, invalid.Code, invalid.Body.String())
		}
		invalid = httptest.NewRecorder()
		router.ServeHTTP(invalid, httptest.NewRequest(http.MethodGet, "/api/levels/J1/"+endpoint.path+"?offset=-1", nil))
		if invalid.Code != http.StatusBadRequest {
			t.Fatalf("GET %s with negative offset: expected 400, got %d: %s", endpoint.path, invalid.Code, invalid.Body.String())
		}
	}
}
