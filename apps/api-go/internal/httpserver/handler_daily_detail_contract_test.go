package httpserver

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

func TestDailyDetailRouteReadsPublishedContent(t *testing.T) {
	db := testPool(t)
	id := newUUID(t)
	_, err := db.Exec(context.Background(), `INSERT INTO daily.daily_content_item
		(id,widget_kind,content_date,locale,title,japanese_text,reading_text,explanation_text,body_md,source_provider,source_ref,payload,status,created_at,updated_at)
		VALUES ($1,'business_phrase',CURRENT_DATE,'vi','Daily fixture','お疲れさまです','おつかれさまです','Dùng ở công sở','Nội dung thử','fixture','daily-detail-test',$2,'published',NOW(),NOW())`, id,
		`{"learningSafeguard":{"learningObjective":"objective","riskDisclaimer":"disclaimer","remediationLinks":[]}}`)
	if err != nil {
		t.Fatalf("insert daily content fixture: %v", err)
	}
	t.Cleanup(func() { _, _ = db.Exec(context.Background(), `DELETE FROM daily.daily_content_item WHERE id=$1`, id) })
	_, err = db.Exec(context.Background(), `INSERT INTO daily.daily_learning_extraction
		(daily_content_item_id,suggested_flashcards,suggested_quiz,created_at)
		VALUES ($1,$2,$3,NOW())`, id,
		`[{"frontText":"お疲れさまです","backText":"Cảm ơn vì đã vất vả","reading":"おつかれさまです"}]`,
		`{"prompt":"Chọn câu chào công sở","options":["お疲れさまです","ありがとう"],"answer":"お疲れさまです"}`)
	if err != nil {
		t.Fatalf("insert daily extraction fixture: %v", err)
	}
	router := NewRouter(Dependencies{
		Config:       &config.Config{},
		Logger:       testLogger(),
		DBPool:       db,
		SessionStore: session.NewStore(db),
	})
	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/daily/items/"+id, nil))
	if response.Code != http.StatusOK {
		t.Fatalf("daily detail status=%d body=%s", response.Code, response.Body.String())
	}
	var result map[string]any
	if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil {
		t.Fatalf("decode daily detail: %v", err)
	}
	if result["id"] != id || result["title"] != "Daily fixture" || result["japaneseText"] != "お疲れさまです" {
		t.Fatalf("daily detail contract missing fixture values: %s", response.Body.String())
	}
	if result["learningSafeguard"] == nil {
		t.Fatalf("learning safeguard missing: %s", response.Body.String())
	}

	missing := httptest.NewRecorder()
	router.ServeHTTP(missing, httptest.NewRequest(http.MethodGet, "/api/daily/items/"+newUUID(t), nil))
	if missing.Code != http.StatusNotFound || !strings.Contains(missing.Body.String(), "daily item not found") {
		t.Fatalf("missing daily item status=%d body=%s", missing.Code, missing.Body.String())
	}
	invalidID := httptest.NewRecorder()
	router.ServeHTTP(invalidID, httptest.NewRequest(http.MethodGet, "/api/daily/items/not-a-uuid", nil))
	if invalidID.Code != http.StatusBadRequest {
		t.Fatalf("invalid daily item id status=%d body=%s", invalidID.Code, invalidID.Body.String())
	}
	anonymousAction := httptest.NewRecorder()
	router.ServeHTTP(anonymousAction, httptest.NewRequest(http.MethodPost, "/api/daily/items/"+id+"/mark-useful", strings.NewReader(`{}`)))
	if anonymousAction.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous daily action status=%d body=%s", anonymousAction.Code, anonymousAction.Body.String())
	}
}

func TestDailyItemActionsPersistAgainstSessionIdentity(t *testing.T) {
	db := testPool(t)
	id := newUUID(t)
	_, err := db.Exec(context.Background(), `INSERT INTO daily.daily_content_item
		(id,widget_kind,content_date,locale,title,status,created_at,updated_at)
		VALUES ($1,'business_phrase',CURRENT_DATE,'vi','Action fixture','published',NOW(),NOW())`, id)
	if err != nil {
		t.Fatalf("insert daily item fixture: %v", err)
	}
	defer db.Exec(context.Background(), `DELETE FROM daily.daily_content_item WHERE id=$1`, id)
	_, err = db.Exec(context.Background(), `INSERT INTO daily.daily_learning_extraction
		(daily_content_item_id,suggested_flashcards,suggested_quiz,created_at)
		VALUES ($1,$2,$3,NOW())`, id,
		`[{"frontText":"お疲れさまです","backText":"Cảm ơn vì đã vất vả","reading":"おつかれさまです"},{"frontText":"よろしくお願いします","backText":"Mong được giúp đỡ","reading":"よろしくおねがいします"}]`,
		`{"prompt":"Chọn câu chào công sở","options":["お疲れさまです","ありがとう"],"answer":"お疲れさまです"}`)
	if err != nil {
		t.Fatalf("insert daily extraction fixture: %v", err)
	}
	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Daily action fixture", "daily-action-"+userID+"@example.test", "")
	sessions := session.NewStore(db)
	token := createLearnerSession(t, sessions, userID)
	router := NewRouter(Dependencies{
		Config:       &config.Config{CORSOrigins: []string{"http://localhost:18081"}},
		Logger:       testLogger(),
		DBPool:       db,
		SessionStore: sessions,
	})
	markUseful := func() *httptest.ResponseRecorder {
		return dailyRouteAction(t, router, token, id, "mark-useful", `{"userId":"`+newUUID(t)+`"}`)
	}
	for range 2 {
		response := markUseful()
		if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), `"useful":true`) {
			t.Fatalf("mark useful status=%d body=%s", response.Code, response.Body.String())
		}
	}
	var usefulCount int
	if err := db.QueryRow(context.Background(), `SELECT count(*)::int FROM daily.daily_user_action WHERE user_id=$1 AND daily_content_item_id=$2 AND action_type='mark-useful'`, userID, id).Scan(&usefulCount); err != nil || usefulCount != 1 {
		t.Fatalf("useful action count=%d err=%v", usefulCount, err)
	}
	quiz := httptest.NewRecorder()
	quiz = dailyRouteAction(t, router, token, id, "quick-quiz", `{}`)
	if quiz.Code != http.StatusOK || !strings.Contains(quiz.Body.String(), `"prompt":"Chọn câu chào công sở"`) {
		t.Fatalf("quick quiz status=%d body=%s", quiz.Code, quiz.Body.String())
	}
	var quizActionCount int
	if err := db.QueryRow(context.Background(), `SELECT count(*)::int FROM daily.daily_user_action WHERE user_id=$1 AND daily_content_item_id=$2 AND action_type='quick-quiz'`, userID, id).Scan(&quizActionCount); err != nil || quizActionCount != 1 {
		t.Fatalf("quick quiz action count=%d err=%v", quizActionCount, err)
	}
	flashcards := httptest.NewRecorder()
	flashcards = dailyRouteAction(t, router, token, id, "generate-flashcards", `{}`)
	if flashcards.Code != http.StatusCreated || !strings.Contains(flashcards.Body.String(), `"cardsCreated":2`) {
		t.Fatalf("generate flashcards status=%d body=%s", flashcards.Code, flashcards.Body.String())
	}
	var deckID string
	if err := db.QueryRow(context.Background(), `SELECT id::text FROM learning.deck WHERE owner_user_id=$1 AND title_vi='Cụm từ hằng ngày: Action fixture' ORDER BY created_at DESC LIMIT 1`, userID).Scan(&deckID); err != nil {
		t.Fatalf("daily flashcard deck was not persisted: %v", err)
	}
	defer db.Exec(context.Background(), `DELETE FROM learning.deck WHERE id=$1`, deckID)
	var cardCount int
	if err := db.QueryRow(context.Background(), `SELECT count(*)::int FROM learning.deck_card WHERE deck_id=$1`, deckID).Scan(&cardCount); err != nil || cardCount != 2 {
		t.Fatalf("daily deck card count=%d err=%v", cardCount, err)
	}
	unauthorized := dailyRouteAction(t, router, "", id, "mark-useful", `{}`)
	if unauthorized.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous action status=%d body=%s", unauthorized.Code, unauthorized.Body.String())
	}
}

func TestDailyItemActionsBuildFallbacksFromPublishedContent(t *testing.T) {
	db := testPool(t)
	itemID, distractorID := newUUID(t), newUUID(t)
	_, err := db.Exec(context.Background(), `INSERT INTO daily.daily_content_item
		(id,widget_kind,content_date,locale,title,japanese_text,reading_text,explanation_text,status,created_at,updated_at)
		VALUES ($1,'business_phrase',CURRENT_DATE,'vi','Fallback fixture','お先に失礼します','おさきにしつれいします','Dùng khi rời văn phòng trước đồng nghiệp','published',NOW(),NOW()),
		($2,'business_phrase',CURRENT_DATE-1,'vi','Distractor fixture','少々お待ちください','しょうしょうおまちください','Vui lòng đợi một chút','published',NOW(),NOW())`, itemID, distractorID)
	if err != nil {
		t.Fatalf("insert daily fallback fixtures: %v", err)
	}
	defer db.Exec(context.Background(), `DELETE FROM daily.daily_content_item WHERE id=ANY($1::uuid[])`, []string{itemID, distractorID})
	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Daily fallback fixture", "daily-fallback-"+userID+"@example.test", "")
	sessions := session.NewStore(db)
	token := createLearnerSession(t, sessions, userID)
	router := NewRouter(Dependencies{
		Config:       &config.Config{CORSOrigins: []string{"http://localhost:18081"}},
		Logger:       testLogger(),
		DBPool:       db,
		SessionStore: sessions,
	})
	quizResponse := dailyRouteAction(t, router, token, itemID, "quick-quiz", `{}`)
	if quizResponse.Code != http.StatusOK {
		t.Fatalf("fallback quiz status=%d body=%s", quizResponse.Code, quizResponse.Body.String())
	}
	var quizResult struct {
		Quiz struct {
			Prompt  string   `json:"prompt"`
			Options []string `json:"options"`
			Answer  string   `json:"answer"`
		} `json:"quiz"`
	}
	if err := json.Unmarshal(quizResponse.Body.Bytes(), &quizResult); err != nil || len(quizResult.Quiz.Options) < 2 || !slices.Contains(quizResult.Quiz.Options, quizResult.Quiz.Answer) || quizResult.Quiz.Answer != "お先に失礼します" {
		t.Fatalf("fallback quiz is incomplete: result=%+v err=%v body=%s", quizResult, err, quizResponse.Body.String())
	}
	flashcardsResponse := dailyRouteAction(t, router, token, itemID, "generate-flashcards", `{}`)
	if flashcardsResponse.Code != http.StatusCreated || !strings.Contains(flashcardsResponse.Body.String(), `"cardsCreated":1`) {
		t.Fatalf("fallback flashcard status=%d body=%s", flashcardsResponse.Code, flashcardsResponse.Body.String())
	}
	var deckID string
	if err := db.QueryRow(context.Background(), `SELECT id::text FROM learning.deck WHERE owner_user_id=$1 AND title_vi='Cụm từ hằng ngày: Fallback fixture'`, userID).Scan(&deckID); err != nil {
		t.Fatalf("fallback flashcard deck missing: %v", err)
	}
	defer db.Exec(context.Background(), `DELETE FROM learning.deck WHERE id=$1`, deckID)
	var front, back, reading string
	if err := db.QueryRow(context.Background(), `SELECT fv.front_text,fv.back_text,COALESCE(fv.reading,'') FROM learning.deck_card dc JOIN learning.flashcard_variant fv ON fv.id=dc.card_id WHERE dc.deck_id=$1`, deckID).Scan(&front, &back, &reading); err != nil || front != "お先に失礼します" || back != "Dùng khi rời văn phòng trước đồng nghiệp" || reading != "おさきにしつれいします" {
		t.Fatalf("fallback card values front=%q back=%q reading=%q err=%v", front, back, reading, err)
	}
}

func TestDailyItemActionsThroughRouterPersistPayloadsAndEnforceCSRF(t *testing.T) {
	db := testPool(t)
	itemID, distractorID := newUUID(t), newUUID(t)
	_, err := db.Exec(context.Background(), `INSERT INTO daily.daily_content_item
		(id,widget_kind,content_date,locale,title,japanese_text,reading_text,explanation_text,status,created_at,updated_at)
		VALUES ($1,'business_phrase',CURRENT_DATE,'vi','Router fixture','お先に失礼します','おさきにしつれいします','Dùng khi rời văn phòng trước đồng nghiệp','published',NOW(),NOW()),
		($2,'business_phrase',CURRENT_DATE-1,'vi','Router distractor','少々お待ちください','しょうしょうおまちください','Vui lòng đợi một chút','published',NOW(),NOW())`, itemID, distractorID)
	if err != nil {
		t.Fatalf("insert daily route fixtures: %v", err)
	}
	defer db.Exec(context.Background(), `DELETE FROM daily.daily_content_item WHERE id=ANY($1::uuid[])`, []string{itemID, distractorID})
	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Daily route fixture", "daily-route-"+userID+"@example.test", "")
	sessions := session.NewStore(db)
	token := createLearnerSession(t, sessions, userID)
	router := NewRouter(Dependencies{
		Config:       &config.Config{CORSOrigins: []string{"http://localhost:18081"}},
		Logger:       testLogger(),
		DBPool:       db,
		SessionStore: sessions,
	})
	request := func(origin, action string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodPost, "/api/daily/items/"+itemID+"/"+action, strings.NewReader(`{"userId":"`+newUUID(t)+`"}`))
		req.Header.Set("Origin", origin)
		req.Header.Set("X-CSRF-Token", "test-csrf")
		req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: token})
		response := httptest.NewRecorder()
		router.ServeHTTP(response, req)
		return response
	}

	if response := request("http://attacker.example", "mark-useful"); response.Code != http.StatusForbidden {
		t.Fatalf("untrusted origin status=%d body=%s", response.Code, response.Body.String())
	}
	quiz := request("http://localhost:18081", "quick-quiz")
	if quiz.Code != http.StatusOK {
		t.Fatalf("quick quiz status=%d body=%s", quiz.Code, quiz.Body.String())
	}
	var quizResult struct {
		Quiz struct {
			Prompt  string   `json:"prompt"`
			Options []string `json:"options"`
			Answer  string   `json:"answer"`
		} `json:"quiz"`
	}
	if err := json.Unmarshal(quiz.Body.Bytes(), &quizResult); err != nil || len(quizResult.Quiz.Options) < 2 {
		t.Fatalf("decode quick quiz result=%+v err=%v body=%s", quizResult, err, quiz.Body.String())
	}
	var savedQuiz struct {
		Prompt  string   `json:"prompt"`
		Options []string `json:"options"`
		Answer  string   `json:"answer"`
	}
	if err := db.QueryRow(context.Background(), `SELECT payload FROM daily.daily_user_action WHERE user_id=$1 AND daily_content_item_id=$2 AND action_type='quick-quiz'`, userID, itemID).Scan(&savedQuiz); err != nil || savedQuiz.Prompt != quizResult.Quiz.Prompt || !slices.Contains(savedQuiz.Options, savedQuiz.Answer) {
		t.Fatalf("persisted fallback quiz=%+v err=%v", savedQuiz, err)
	}

	flashcards := request("http://localhost:18081", "generate-flashcards")
	if flashcards.Code != http.StatusCreated {
		t.Fatalf("generate flashcards status=%d body=%s", flashcards.Code, flashcards.Body.String())
	}
	var flashcardResult struct {
		DeckID       string `json:"deckId"`
		CardsCreated int    `json:"cardsCreated"`
	}
	if err := json.Unmarshal(flashcards.Body.Bytes(), &flashcardResult); err != nil || flashcardResult.DeckID == "" || flashcardResult.CardsCreated != 1 {
		t.Fatalf("decode flashcards result=%+v err=%v body=%s", flashcardResult, err, flashcards.Body.String())
	}
	defer db.Exec(context.Background(), `DELETE FROM learning.deck WHERE id=$1`, flashcardResult.DeckID)
	var savedDeckID string
	var savedCardCount int
	if err := db.QueryRow(context.Background(), `SELECT payload->>'deckId', (payload->>'cardsCreated')::int FROM daily.daily_user_action WHERE user_id=$1 AND daily_content_item_id=$2 AND action_type='generate-flashcards'`, userID, itemID).Scan(&savedDeckID, &savedCardCount); err != nil || savedDeckID != flashcardResult.DeckID || savedCardCount != 1 {
		t.Fatalf("persisted flashcard action deck=%q cards=%d err=%v", savedDeckID, savedCardCount, err)
	}

	anonymous := httptest.NewRecorder()
	unauthenticated := httptest.NewRequest(http.MethodPost, "/api/daily/items/"+itemID+"/mark-useful", strings.NewReader(`{}`))
	unauthenticated.Header.Set("Origin", "http://localhost:18081")
	router.ServeHTTP(anonymous, unauthenticated)
	if anonymous.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous route status=%d body=%s", anonymous.Code, anonymous.Body.String())
	}
}

func dailyRouteAction(t *testing.T, router http.Handler, token, itemID, action, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/api/daily/items/"+itemID+"/"+action, strings.NewReader(body))
	req.Header.Set("Origin", "http://localhost:18081")
	req.Header.Set("X-CSRF-Token", "test-csrf")
	if token != "" {
		req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: token})
	}
	response := httptest.NewRecorder()
	router.ServeHTTP(response, req)
	return response
}
