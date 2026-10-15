package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/authz"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/credential"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/onboarding"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/quiztemplate"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/search"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

func audit159Wave10Router(t *testing.T, db *pgxpool.Pool, meiliURL string) (http.Handler, *session.Store) {
	t.Helper()
	sessions := session.NewStore(db)
	meili := search.NewClient(meiliURL, "")
	limiter, err := authn.NewRateLimiter(authn.RateLimiterConfig{Limit: 100, Window: time.Minute, TTL: time.Minute, EvictEvery: time.Minute, MaxKeys: 1000})
	if err != nil {
		t.Fatal(err)
	}
	return NewRouter(Dependencies{
		Config: &config.Config{CORSOrigins: []string{"http://localhost:3000"}}, Logger: testLogger(), DBPool: db,
		SessionStore: sessions, OnboardingStore: onboarding.NewStore(db), QuizTemplateStore: quiztemplate.NewStore(db),
		RBACStore: authz.NewStore(db), CredentialStore: credential.NewStore(db), RateLimiter: limiter, SearchClient: meili,
	}), sessions
}

func audit159Wave10RevengeFixture(t *testing.T) (*pgxpool.Pool, http.Handler, string, string, string, string) {
	t.Helper()
	db := testPool(t)
	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Wave10 learner", "wave10-"+userID+"@example.test", "")
	testID := seedQuizTemplate(t, db, 1)
	var questionID string
	if err := db.QueryRow(context.Background(), `SELECT q.id::text FROM assessment.bjt_question q JOIN assessment.bjt_test_section s ON s.id=q.section_id WHERE s.test_id=$1`, testID).Scan(&questionID); err != nil {
		t.Fatal(err)
	}
	sessionID := newUUID(t)
	if _, err := db.Exec(context.Background(), `INSERT INTO assessment.quiz_session(id,user_id,test_id,status,total_questions,started_at) VALUES($1,$2,$3,'completed',1,NOW())`, sessionID, userID, testID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(context.Background(), `INSERT INTO assessment.quiz_answer(session_id,question_id,selected_option,is_correct,answered_at) VALUES($1,$2,'B',false,NOW())`, sessionID, questionID); err != nil {
		t.Fatal(err)
	}
	router, sessions := audit159Wave10Router(t, db, "")
	raw := createLearnerSession(t, sessions, userID)
	return db, router, raw, userID, testID, questionID
}

func TestAudit159Wave10RevengeQueueRoute(t *testing.T) {
	db, router, raw, userID, _, questionID := audit159Wave10RevengeFixture(t)
	queue := quizRequest(t, router, raw, http.MethodGet, "/api/quiz/revenge/queue?limit=5", "")
	if queue.Code != http.StatusOK {
		t.Fatalf("GET queue status=%d body=%s", queue.Code, queue.Body.String())
	}
	var queued struct {
		TotalPending int `json:"totalPending"`
		Questions    []struct {
			QuestionID string `json:"questionId"`
		} `json:"questions"`
	}
	if err := json.Unmarshal(queue.Body.Bytes(), &queued); err != nil || queued.TotalPending != 1 || len(queued.Questions) != 1 || queued.Questions[0].QuestionID != questionID {
		t.Fatalf("GET queue contract/persistence: data=%+v err=%v body=%s", queued, err, queue.Body.String())
	}
	if _, err := db.Exec(context.Background(), `INSERT INTO learning.revenge_attempt(user_id,question_id,is_correct,answered_at) VALUES($1,$2,true,NOW())`, userID, questionID); err != nil {
		t.Fatal(err)
	}
	filtered := quizRequest(t, router, raw, http.MethodGet, "/api/quiz/revenge/queue?limit=5", "")
	if filtered.Code != http.StatusOK || !strings.Contains(filtered.Body.String(), `"totalPending":0`) {
		t.Fatalf("GET queue must exclude correctly revenged questions; status=%d body=%s", filtered.Code, filtered.Body.String())
	}
	if anon := httptest.NewRecorder(); func() bool {
		router.ServeHTTP(anon, httptest.NewRequest(http.MethodGet, "/api/quiz/revenge/queue", nil))
		return anon.Code == http.StatusUnauthorized
	}() == false {
		t.Fatalf("anonymous revenge queue status=%d body=%s", anon.Code, anon.Body.String())
	}
}

func TestAudit159Wave10RevengeAnswerRoute(t *testing.T) {
	db, router, raw, userID, _, questionID := audit159Wave10RevengeFixture(t)
	answer := quizRequest(t, router, raw, http.MethodPost, "/api/quiz/revenge/answer", fmt.Sprintf(`{"questionId":%q,"selectedOption":"A"}`, questionID))
	if answer.Code != http.StatusOK || !strings.Contains(answer.Body.String(), `"correct":true`) {
		t.Fatalf("POST answer status=%d body=%s", answer.Code, answer.Body.String())
	}
	var count int
	if err := db.QueryRow(context.Background(), `SELECT count(*) FROM learning.revenge_attempt WHERE user_id=$1 AND question_id=$2 AND is_correct=true`, userID, questionID).Scan(&count); err != nil || count != 1 {
		t.Fatalf("revenge attempt persistence count=%d err=%v", count, err)
	}
}

func TestAudit159Wave10QuizTemplateDetailRoute(t *testing.T) {
	db := testPool(t)
	testID := seedQuizTemplate(t, db, 1)
	router, _ := audit159Wave10Router(t, db, "")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/quiz/templates/"+testID, nil))
	if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), testID) || !strings.Contains(response.Body.String(), `"sections"`) {
		t.Fatalf("GET template status=%d body=%s", response.Code, response.Body.String())
	}
	missing := httptest.NewRecorder()
	router.ServeHTTP(missing, httptest.NewRequest(http.MethodGet, "/api/quiz/templates/"+newUUID(t), nil))
	if missing.Code != http.StatusNotFound {
		t.Fatalf("missing template status=%d body=%s", missing.Code, missing.Body.String())
	}
}

func TestAudit159Wave10ReadingAssistAnalyticsRoute(t *testing.T) {
	db := testPool(t)
	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Wave10 analytics", "wave10-analytics-"+userID+"@example.test", "")
	router, sessions := audit159Wave10Router(t, db, "")
	raw := createLearnerSession(t, sessions, userID)
	response := quizRequest(t, router, raw, http.MethodPost, "/api/reading-assist/analytics", `{"eventName":"reading_assist_token_open","textHash":"hash","tokenIndex":2}`)
	if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), `"recorded":true`) {
		t.Fatalf("POST analytics status=%d body=%s", response.Code, response.Body.String())
	}
	var persisted int
	if err := db.QueryRow(context.Background(), `SELECT count(*) FROM learning.reading_assist_report WHERE user_id=$1 AND kind='analytics'`, userID).Scan(&persisted); err != nil || persisted != 1 {
		t.Fatalf("analytics persistence count=%d err=%v", persisted, err)
	}
	bad := quizRequest(t, router, raw, http.MethodPost, "/api/reading-assist/analytics", `[]`)
	if bad.Code != http.StatusBadRequest {
		t.Fatalf("invalid analytics payload status=%d body=%s", bad.Code, bad.Body.String())
	}
	tooLongSession := quizRequest(t, router, raw, http.MethodPost, "/api/reading-assist/analytics", `{"eventName":"event","sessionId":"`+strings.Repeat("x", 136)+`"}`)
	if tooLongSession.Code != http.StatusBadRequest {
		t.Fatalf("oversized analytics session id status=%d body=%s", tooLongSession.Code, tooLongSession.Body.String())
	}
}

func TestAudit159Wave10ReadingAssistAnalyzeRoute(t *testing.T) {
	db := testPool(t)
	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Wave10 analyze", "wave10-analyze-"+userID+"@example.test", "")
	seedWave10Lexeme(t, db, "東京", "とうきょう", "Tokyo")
	seedWave10Lexeme(t, db, "会議", "かいぎ", "cuộc họp")
	router, sessions := audit159Wave10Router(t, db, "")
	raw := createLearnerSession(t, sessions, userID)
	response := quizRequest(t, router, raw, http.MethodPost, "/api/reading-assist/analyze", `{"text":"東京で会議","examContext":{"kind":"bjt_quiz","mode":"timed","answerSubmitted":true}}`)
	if response.Code != http.StatusOK {
		t.Fatalf("analyze status=%d body=%s", response.Code, response.Body.String())
	}
	var payload struct {
		Normalized string `json:"normalized"`
		TextHash   string `json:"textHash"`
		Tokens     []struct {
			Surface       string  `json:"surface"`
			Reading       string  `json:"reading"`
			Meaning       *string `json:"shortMeaningVi"`
			MeaningHidden bool    `json:"meaningHidden"`
			Start         int     `json:"start"`
			End           int     `json:"end"`
		} `json:"tokens"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if payload.Normalized != "東京で会議" || len(payload.TextHash) != 64 || len(payload.Tokens) != 3 {
		t.Fatalf("unexpected analysis payload: %+v", payload)
	}
	if payload.Tokens[0].Surface != "東京" || payload.Tokens[0].Reading != "とうきょう" || !payload.Tokens[0].MeaningHidden || payload.Tokens[0].Meaning != nil || payload.Tokens[0].Start != 0 || payload.Tokens[0].End != 2 {
		t.Fatalf("dictionary token or timed-exam redaction mismatch: %+v", payload.Tokens[0])
	}
	practice := quizRequest(t, router, raw, http.MethodPost, "/api/reading-assist/analyze", `{"text":"東京で会議","examContext":{"kind":"bjt_quiz","mode":"practice","answerSubmitted":false}}`)
	if practice.Code != http.StatusOK || !strings.Contains(practice.Body.String(), `"shortMeaningVi":"Tokyo"`) || !strings.Contains(practice.Body.String(), `"meaningHidden":false`) {
		t.Fatalf("practice analysis should show dictionary meaning: status=%d body=%s", practice.Code, practice.Body.String())
	}
	var persisted int
	if err := db.QueryRow(context.Background(), `SELECT count(*) FROM learning.reading_assist_report WHERE user_id=$1 AND kind='exam'`, userID).Scan(&persisted); err != nil || persisted != 1 {
		t.Fatalf("analysis audit persistence count=%d err=%v", persisted, err)
	}
	empty := quizRequest(t, router, raw, http.MethodPost, "/api/reading-assist/analyze", `{"text":"  "}`)
	if empty.Code != http.StatusBadRequest {
		t.Fatalf("empty analysis text status=%d body=%s", empty.Code, empty.Body.String())
	}
}

func audit159Wave10PreferencesFixture(t *testing.T) (*pgxpool.Pool, http.Handler, string, string, string) {
	t.Helper()
	db := testPool(t)
	userID, otherID := newUUID(t), newUUID(t)
	seedActiveUser(t, db, userID, "Wave10 preferences", "wave10-prefs-"+userID+"@example.test", "")
	seedActiveUser(t, db, otherID, "Other learner", "wave10-prefs-other-"+otherID+"@example.test", "")
	if _, err := db.Exec(context.Background(), `INSERT INTO profile.reading_user_preference(user_id,display_mode,show_romaji,created_at,updated_at) VALUES($1,'off',true,NOW(),NOW())`, otherID); err != nil {
		t.Fatal(err)
	}
	router, sessions := audit159Wave10Router(t, db, "")
	raw := createLearnerSession(t, sessions, userID)
	return db, router, raw, userID, otherID
}

func TestAudit159Wave10ReadingAssistPreferencesGetRoute(t *testing.T) {
	_, router, raw, _, otherID := audit159Wave10PreferencesFixture(t)
	path := "/api/reading-assist/preferences?userId=" + otherID
	initial := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, path, nil)
	request.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: raw})
	router.ServeHTTP(initial, request)
	if initial.Code != http.StatusOK || !strings.Contains(initial.Body.String(), `"displayMode":"hover"`) || !strings.Contains(initial.Body.String(), `"showRomaji":false`) {
		t.Fatalf("GET preferences defaults/status=%d body=%s", initial.Code, initial.Body.String())
	}
	unauthorized := httptest.NewRecorder()
	router.ServeHTTP(unauthorized, httptest.NewRequest(http.MethodGet, "/api/reading-assist/preferences", nil))
	if unauthorized.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous GET preferences status=%d body=%s", unauthorized.Code, unauthorized.Body.String())
	}
}

func TestAudit159Wave10ReadingAssistPreferencesPutRoute(t *testing.T) {
	db, router, raw, userID, otherID := audit159Wave10PreferencesFixture(t)
	update := audit159Wave10Request(router, raw, http.MethodPut, "/api/reading-assist/preferences", `{"displayMode":"full_furigana","showRomaji":true,"userId":"`+otherID+`"}`)
	if update.Code != http.StatusOK {
		t.Fatalf("PUT preferences status=%d body=%s", update.Code, update.Body.String())
	}
	var ownMode string
	var ownRomaji bool
	if err := db.QueryRow(context.Background(), `SELECT display_mode,show_romaji FROM profile.reading_user_preference WHERE user_id=$1`, userID).Scan(&ownMode, &ownRomaji); err != nil || ownMode != "full_furigana" || !ownRomaji {
		t.Fatalf("own preference persistence mode=%q romaji=%v err=%v", ownMode, ownRomaji, err)
	}
	var otherMode string
	var otherRomaji bool
	if err := db.QueryRow(context.Background(), `SELECT display_mode,show_romaji FROM profile.reading_user_preference WHERE user_id=$1`, otherID).Scan(&otherMode, &otherRomaji); err != nil || otherMode != "off" || !otherRomaji {
		t.Fatalf("client-supplied userId changed other user's preferences: mode=%q romaji=%v err=%v", otherMode, otherRomaji, err)
	}
	invalid := audit159Wave10Request(router, raw, http.MethodPut, "/api/reading-assist/preferences", `{"displayMode":"bogus","showRomaji":true}`)
	if invalid.Code != http.StatusBadRequest {
		t.Fatalf("invalid preference mode status=%d body=%s", invalid.Code, invalid.Body.String())
	}
	after := httptest.NewRecorder()
	read := httptest.NewRequest(http.MethodGet, "/api/reading-assist/preferences", nil)
	read.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: raw})
	router.ServeHTTP(after, read)
	if after.Code != http.StatusOK || !strings.Contains(after.Body.String(), `"displayMode":"full_furigana"`) || !strings.Contains(after.Body.String(), `"showRomaji":true`) {
		t.Fatalf("GET saved preferences status=%d body=%s", after.Code, after.Body.String())
	}
}

func audit159Wave10Request(router http.Handler, token string, method, path, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("X-CSRF-Token", "wave10-csrf")
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: token})
	response := httptest.NewRecorder()
	router.ServeHTTP(response, req)
	return response
}

func TestAudit159Wave10ReadingAssistReadingsRoute(t *testing.T) {
	db := testPool(t)
	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Wave10 readings", "wave10-readings-"+userID+"@example.test", "")
	seedWave10Lexeme(t, db, "東京", "とうきょう", "Tokyo")
	seedWave10Lexeme(t, db, "会議", "かいぎ", "cuộc họp")
	router, sessions := audit159Wave10Router(t, db, "")
	raw := createLearnerSession(t, sessions, userID)
	response := quizRequest(t, router, raw, http.MethodPost, "/api/reading-assist/readings", `{"text":"東京で会議"}`)
	if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), `"reading":"とうきょうでかいぎ"`) {
		t.Fatalf("POST readings status=%d body=%s", response.Code, response.Body.String())
	}
	empty := quizRequest(t, router, raw, http.MethodPost, "/api/reading-assist/readings", `{"text":" "}`)
	if empty.Code != http.StatusBadRequest {
		t.Fatalf("empty readings input status=%d body=%s", empty.Code, empty.Body.String())
	}
}

func seedWave10Lexeme(t *testing.T, db *pgxpool.Pool, headword, reading, meaning string) {
	t.Helper()
	id := newUUID(t)
	if _, err := db.Exec(context.Background(), `INSERT INTO content.lexeme(id,headword,reading,short_meaning_vi,status,created_at,updated_at)
		VALUES($1,$2,$3,$4,'active',NOW(),NOW())`, id, headword, reading, meaning); err != nil {
		t.Fatalf("seed reading-assist lexeme %q: %v", headword, err)
	}
	t.Cleanup(func() {
		if _, err := db.Exec(context.Background(), `DELETE FROM content.lexeme WHERE id=$1`, id); err != nil {
			t.Errorf("cleanup reading-assist lexeme %q: %v", headword, err)
		}
	})
}

func TestAudit159Wave10OnboardingPreferencesRoute(t *testing.T) {
	db := testPool(t)
	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Wave10 onboarding", "wave10-onboarding-"+userID+"@example.test", "")
	router, sessions := audit159Wave10Router(t, db, "")
	raw := createLearnerSession(t, sessions, userID)
	response := quizRequest(t, router, raw, http.MethodPost, "/api/recommendation/onboarding/preferences", `{"currentLevel":3,"goal":"pass_bjt","topics":["business_japanese"],"dailyMinutes":30,"style":"mixed"}`)
	if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), `"goal":"pass_bjt"`) {
		t.Fatalf("POST onboarding preferences status=%d body=%s", response.Code, response.Body.String())
	}
	var level, minutes int
	var goal, style string
	if err := db.QueryRow(context.Background(), `SELECT onboarding_current_level,learning_purpose,daily_study_minutes,learning_personality FROM profile.user_profile WHERE id=$1`, userID).Scan(&level, &goal, &minutes, &style); err != nil || level != 3 || goal != "pass_bjt" || minutes != 30 || style != "mixed" {
		t.Fatalf("onboarding persistence level=%d goal=%q minutes=%d style=%q err=%v", level, goal, minutes, style, err)
	}
	invalid := quizRequest(t, router, raw, http.MethodPost, "/api/recommendation/onboarding/preferences", `{"currentLevel":9,"goal":"pass_bjt","style":"mixed"}`)
	if invalid.Code != http.StatusBadRequest {
		t.Fatalf("invalid onboarding status=%d body=%s", invalid.Code, invalid.Body.String())
	}
}

func TestAudit159Wave10SearchIndexRoute(t *testing.T) {
	db := testPool(t)
	fixtureID := newUUID(t)
	if _, err := db.Exec(context.Background(), `INSERT INTO content.lexeme(id,headword,reading,short_meaning_vi,status,created_at,updated_at) VALUES($1,'api-index-fixture','えーぴーあい','fixture','active',NOW(),NOW())`, fixtureID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = db.Exec(context.Background(), `DELETE FROM content.lexeme WHERE id=$1`, fixtureID) })
	var indexed []search.Document
	meili := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			_, _ = w.Write([]byte(`{"results":[],"total":0}`))
			return
		}
		if err := json.NewDecoder(r.Body).Decode(&indexed); err != nil {
			t.Errorf("decode reindex docs: %v", err)
		}
		w.WriteHeader(http.StatusAccepted)
		_, _ = w.Write([]byte(`{"taskUid":19}`))
	}))
	defer meili.Close()
	router, sessions := audit159Wave10Router(t, db, meili.URL)
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, fmt.Sprintf("wave10-index-%s@example.test", actorID[:8]), "Wave10 Search Admin")
	grantAdminPermission(t, db, actorID, "iam.manage")
	raw, err := sessions.CreateAdminSession(context.Background(), actorID, "audit", "127.0.0.1", time.Now().Add(time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodPost, "/api/search/index", nil)
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: raw})
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("X-CSRF-Token", "wave10-csrf")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, req)
	if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), `19`) {
		t.Fatalf("POST search index status=%d body=%s", response.Code, response.Body.String())
	}
	found := false
	for _, doc := range indexed {
		if doc.ID == fixtureID {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("reindex omitted canonical fixture %s", fixtureID)
	}
	unauth := httptest.NewRecorder()
	router.ServeHTTP(unauth, httptest.NewRequest(http.MethodPost, "/api/search/index", nil))
	if unauth.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous reindex status=%d body=%s", unauth.Code, unauth.Body.String())
	}
}
