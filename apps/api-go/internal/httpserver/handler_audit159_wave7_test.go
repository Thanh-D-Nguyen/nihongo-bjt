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
	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/exercisereview"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/flashcarddeck"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/flashcardreview"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

const audit159Wave7Origin = "http://localhost:3000"

func audit159Wave7Router(t *testing.T, db *pgxpool.Pool) (http.Handler, string, string) {
	t.Helper()
	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Wave 7 disposable learner", fmt.Sprintf("audit159-wave7-%s@example.test", userID), "")
	sessions := session.NewStore(db)
	token := createLearnerSession(t, sessions, userID)
	router := NewRouter(Dependencies{
		Config:               &config.Config{Port: "4001", CORSOrigins: []string{audit159Wave7Origin}},
		Logger:               testLogger(),
		DBPool:               db,
		SessionStore:         sessions,
		ExerciseReviewStore:  exercisereview.NewStore(db),
		FlashcardDeckStore:   flashcarddeck.NewStore(db),
		FlashcardReviewStore: flashcardreview.NewStore(db),
	})
	return router, userID, token
}

func audit159Wave7Request(t *testing.T, router http.Handler, token, method, path, body string, trustedOrigin bool) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: token})
	}
	if trustedOrigin {
		req.Header.Set("Origin", audit159Wave7Origin)
	}
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)
	return rr
}

func audit159Wave7SeedCard(t *testing.T, db *pgxpool.Pool, userID, label string, comeback bool) (string, string) {
	t.Helper()
	sourceID := newUUID(t)
	if _, err := db.Exec(context.Background(), `INSERT INTO content.lexeme
		(id,headword,reading,jlpt_level,short_meaning_vi,status,created_at,updated_at)
		VALUES ($1,$2,'かいぎ','N5','cuộc họp','active',NOW(),NOW())`, sourceID, "Wave7 "+label+" "+sourceID[:8]); err != nil {
		t.Fatalf("insert disposable lexeme: %v", err)
	}
	cardID := newUUID(t)
	if _, err := db.Exec(context.Background(), `INSERT INTO learning.flashcard_variant
		(id,source_type,source_id,front_text,back_text,reading,status,updated_at)
		VALUES ($1,'lexeme',$2,$3,$4,'かいぎ','active',NOW())`, cardID, sourceID, "会議 "+label, "Meeting "+label); err != nil {
		t.Fatalf("insert disposable flashcard: %v", err)
	}
	var deckID string
	if err := db.QueryRow(context.Background(), `INSERT INTO learning.deck
		(owner_user_id,title_vi,status,visibility,updated_at) VALUES ($1,$2,'active','private',NOW()) RETURNING id::text`,
		userID, "Wave 7 deck "+label).Scan(&deckID); err != nil {
		t.Fatalf("insert disposable deck: %v", err)
	}
	if _, err := db.Exec(context.Background(), `INSERT INTO learning.deck_card(deck_id,card_id,position) VALUES ($1,$2,0)`, deckID, cardID); err != nil {
		t.Fatalf("link disposable flashcard: %v", err)
	}
	var userFlashcardID string
	if err := db.QueryRow(context.Background(), `INSERT INTO learning.user_flashcard(user_id,card_id,comeback_mode,due_at,updated_at)
		VALUES ($1,$2,$3,NOW(),NOW()) RETURNING id::text`, userID, cardID, comeback).Scan(&userFlashcardID); err != nil {
		t.Fatalf("insert disposable user flashcard: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.user_flashcard WHERE id=$1`, userFlashcardID)
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.deck WHERE id=$1`, deckID)
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.flashcard_variant WHERE id=$1`, cardID)
		_, _ = db.Exec(context.Background(), `DELETE FROM content.lexeme WHERE id=$1`, sourceID)
	})
	return deckID, userFlashcardID
}

func TestAudit159Wave7DailyRadarModulesContract(t *testing.T) {
	db := testPool(t)
	moduleID, moduleKey := newUUID(t), "wave7-"+newUUID(t)
	if _, err := db.Exec(context.Background(), `INSERT INTO daily.daily_radar_module_config
		(id,module_key,title_vi,title_ja,description_vi,category,module_type,status,is_enabled,default_priority,route_path,disclaimer_vi,metadata,created_at,updated_at)
		VALUES ($1,$2,'Module title','モジュール','Description','daily','reading','published',true,7,'/vi/modules/wave7','Disclaimer','{"comingSoon":true}',NOW(),NOW())`, moduleID, moduleKey); err != nil {
		t.Fatalf("insert daily radar module fixture: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM daily.daily_radar_module_config WHERE id=$1`, moduleID)
	})
	router := NewRouter(Dependencies{Config: &config.Config{}, Logger: testLogger(), DBPool: db})
	response := audit159Wave7Request(t, router, "", http.MethodGet, "/api/daily-radar/modules", "", false)
	if response.Code != http.StatusOK {
		t.Fatalf("GET /api/daily-radar/modules status=%d body=%s", response.Code, response.Body.String())
	}
	var modules []struct {
		ModuleKey   string          `json:"moduleKey"`
		TitleVi     string          `json:"titleVi"`
		Description string          `json:"descriptionVi"`
		Disclaimer  *string         `json:"disclaimerVi"`
		RoutePath   *string         `json:"routePath"`
		Metadata    json.RawMessage `json:"metadata"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &modules); err != nil {
		t.Fatalf("decode modules contract: %v", err)
	}
	for _, module := range modules {
		if module.ModuleKey == moduleKey {
			if module.TitleVi != "Module title" || module.Description != "Description" || module.Disclaimer == nil || *module.Disclaimer != "Disclaimer" || module.RoutePath == nil || *module.RoutePath != "/vi/modules/wave7" || !json.Valid(module.Metadata) {
				t.Fatalf("module contract mismatch: %+v", module)
			}
			return
		}
	}
	t.Fatalf("published module %q missing from payload: %s", moduleKey, response.Body.String())
}

func TestAudit159Wave7DailyHomeAnonymousContract(t *testing.T) {
	db := testPool(t)
	router, userID, token := audit159Wave7Router(t, db)
	audit159Wave7SeedCard(t, db, userID, "daily-home-due", false)
	response := audit159Wave7Request(t, router, "", http.MethodGet, "/api/daily/home?locale=vi&timeZone=Asia%2FTokyo", "", false)
	if response.Code != http.StatusOK {
		t.Fatalf("GET /api/daily/home status=%d body=%s", response.Code, response.Body.String())
	}
	var payload struct {
		Today      string `json:"today"`
		DueReviews int    `json:"dueReviews"`
		Greeting   struct {
			Japanese string  `json:"japanese"`
			Reading  *string `json:"reading"`
		} `json:"greeting"`
		Widgets []json.RawMessage `json:"widgets"`
		Items   []json.RawMessage `json:"items"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode daily home: %v", err)
	}
	if _, err := time.Parse("2006-01-02", payload.Today); err != nil || payload.Greeting.Japanese == "" || (payload.Greeting.Reading != nil && *payload.Greeting.Reading == "") || payload.Widgets == nil || payload.Items == nil {
		t.Fatalf("daily home contract mismatch: %+v", payload)
	}
	authenticated := audit159Wave7Request(t, router, token, http.MethodGet, "/api/daily/home?locale=vi&timeZone=Asia%2FTokyo", "", false)
	if authenticated.Code != http.StatusOK || !strings.Contains(authenticated.Body.String(), `"dueReviews":1`) {
		t.Fatalf("authenticated daily home dueReviews contract status=%d body=%s", authenticated.Code, authenticated.Body.String())
	}
}

func TestAudit159Wave7ExerciseReviewPersistsAndEnforcesSessionCSRF(t *testing.T) {
	db := testPool(t)
	router, _, token := audit159Wave7Router(t, db)
	exerciseID, sourceID := newUUID(t), newUUID(t)
	if _, err := db.Exec(context.Background(), `INSERT INTO exercise.exercise
		(id,exercise_type,source_type,source_id,level,prompt,choices,correct_answer,difficulty,created_at)
		VALUES ($1,'meaning_match','lexeme',$2,'N5','{"q":"fixture"}','[]','{"answer":"x"}','easy',NOW())`, exerciseID, sourceID); err != nil {
		t.Fatalf("insert exercise fixture: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM exercise.exercise_review_state WHERE exercise_id=$1`, exerciseID)
		_, _ = db.Exec(context.Background(), `DELETE FROM exercise.exercise WHERE id=$1`, exerciseID)
	})
	path, body := "/api/exercises/review/"+exerciseID, `{"rating":"good"}`
	if got := audit159Wave7Request(t, router, "", http.MethodPost, path, body, true).Code; got != http.StatusUnauthorized {
		t.Fatalf("anonymous POST /api/exercises/review/{exerciseId}=%d; want 401", got)
	}
	if got := audit159Wave7Request(t, router, token, http.MethodPost, path, body, false).Code; got != http.StatusForbidden {
		t.Fatalf("POST /api/exercises/review/{exerciseId} without trusted origin=%d; want 403", got)
	}
	response := audit159Wave7Request(t, router, token, http.MethodPost, path, body, true)
	if response.Code != http.StatusOK {
		t.Fatalf("POST /api/exercises/review/{exerciseId} status=%d body=%s", response.Code, response.Body.String())
	}
	var persisted struct {
		State        string  `json:"state"`
		IntervalDays int     `json:"intervalDays"`
		EaseFactor   float64 `json:"easeFactor"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &persisted); err != nil || persisted.IntervalDays != 1 || persisted.EaseFactor != 2.5 {
		t.Fatalf("review response contract=%+v err=%v", persisted, err)
	}
	var state string
	if err := db.QueryRow(context.Background(), `SELECT state FROM exercise.exercise_review_state WHERE exercise_id=$1`, exerciseID).Scan(&state); err != nil || state != "new" {
		t.Fatalf("persisted review state=%q err=%v", state, err)
	}
}

func TestAudit159Wave7FlashcardSuggestReturnsCanonicalFixture(t *testing.T) {
	db := testPool(t)
	router, _, token := audit159Wave7Router(t, db)
	sourceID := newUUID(t)
	if _, err := db.Exec(context.Background(), `INSERT INTO content.lexeme(id,headword,reading,jlpt_level,short_meaning_vi,status,created_at,updated_at)
		VALUES ($1,$2,'よみ','N5','Nghĩa','active',NOW(),NOW())`, sourceID, "Suggestion wave7 "+sourceID[:8]); err != nil {
		t.Fatalf("insert suggestion source: %v", err)
	}
	cardID := newUUID(t)
	if _, err := db.Exec(context.Background(), `INSERT INTO learning.flashcard_variant(id,source_type,source_id,front_text,back_text,reading,status,updated_at)
		VALUES ($1,'lexeme',$2,$3,'Meaning fixture','よみ','active',NOW())`, cardID, sourceID, "Suggestion wave7 "+sourceID[:8]); err != nil {
		t.Fatalf("insert suggestion variant: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.flashcard_variant WHERE id=$1`, cardID)
		_, _ = db.Exec(context.Background(), `DELETE FROM content.lexeme WHERE id=$1`, sourceID)
	})
	path, body := "/api/flashcards/cards/suggest", fmt.Sprintf(`{"query":%q,"sourceTypes":["lexeme"],"limit":10}`, "Suggestion wave7 "+sourceID[:8])
	if got := audit159Wave7Request(t, router, token, http.MethodPost, path, body, false).Code; got != http.StatusForbidden {
		t.Fatalf("POST /api/flashcards/cards/suggest without trusted origin=%d; want 403", got)
	}
	response := audit159Wave7Request(t, router, token, http.MethodPost, path, body, true)
	if response.Code != http.StatusOK {
		t.Fatalf("POST /api/flashcards/cards/suggest status=%d body=%s", response.Code, response.Body.String())
	}
	var cards []flashcarddeck.SuggestedCard
	if err := json.Unmarshal(response.Body.Bytes(), &cards); err != nil || len(cards) != 1 || cards[0].VariantID != cardID || cards[0].SourceID != sourceID || cards[0].BackText != "Meaning fixture" {
		t.Fatalf("suggestion response=%+v err=%v", cards, err)
	}
}

func TestAudit159Wave7FlashcardDeckPatchPersistsAndEnforcesCSRF(t *testing.T) {
	db := testPool(t)
	router, userID, token := audit159Wave7Router(t, db)
	deckID, _ := audit159Wave7SeedCard(t, db, userID, "patch", false)
	path, body := "/api/flashcards/decks/"+deckID, `{"titleVi":"Updated wave7 deck","visibility":"public"}`
	if got := audit159Wave7Request(t, router, token, http.MethodPatch, path, body, false).Code; got != http.StatusForbidden {
		t.Fatalf("PATCH /api/flashcards/decks/{deckId} without trusted origin=%d; want 403", got)
	}
	response := audit159Wave7Request(t, router, token, http.MethodPatch, path, body, true)
	if response.Code != http.StatusOK {
		t.Fatalf("PATCH /api/flashcards/decks/{deckId} status=%d body=%s", response.Code, response.Body.String())
	}
	var title, visibility string
	if err := db.QueryRow(context.Background(), `SELECT title_vi,visibility FROM learning.deck WHERE id=$1`, deckID).Scan(&title, &visibility); err != nil || title != "Updated wave7 deck" || visibility != "public" {
		t.Fatalf("updated deck title=%q visibility=%q err=%v", title, visibility, err)
	}
}

func TestAudit159Wave7FlashcardDeckDeleteArchivesAndEnforcesCSRF(t *testing.T) {
	db := testPool(t)
	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Wave 7 delete learner", fmt.Sprintf("audit159-wave7-delete-%s@example.test", userID), "")
	sessions := session.NewStore(db)
	token := createLearnerSession(t, sessions, userID)
	router := NewRouter(Dependencies{Config: &config.Config{CORSOrigins: []string{audit159Wave7Origin}}, Logger: testLogger(), DBPool: db, SessionStore: sessions, FlashcardDeckStore: flashcarddeck.NewStore(db)})
	deckID, _ := audit159Wave7SeedCard(t, db, userID, "delete", false)
	path := "/api/flashcards/decks/" + deckID
	if got := audit159Wave7Request(t, router, token, http.MethodDelete, path, "", false).Code; got != http.StatusForbidden {
		t.Fatalf("DELETE /api/flashcards/decks/{deckId} without trusted origin=%d; want 403", got)
	}
	response := audit159Wave7Request(t, router, token, http.MethodDelete, path, "", true)
	if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), `"archived":true`) {
		t.Fatalf("DELETE /api/flashcards/decks/{deckId} status=%d body=%s", response.Code, response.Body.String())
	}
	var status string
	if err := db.QueryRow(context.Background(), `SELECT status FROM learning.deck WHERE id=$1`, deckID).Scan(&status); err != nil || status != "archived" {
		t.Fatalf("deleted deck status=%q err=%v", status, err)
	}
}

func TestAudit159Wave7FlashcardBatchReviewPersistsAndEnforcesCSRF(t *testing.T) {
	db := testPool(t)
	router, userID, token := audit159Wave7Router(t, db)
	_, userCardID := audit159Wave7SeedCard(t, db, userID, "batch", false)
	path, body := "/api/flashcards/reviews/batch", fmt.Sprintf(`{"items":[{"clientMutationId":"wave7","userFlashcardId":%q,"rating":"again","elapsedMs":120}]}`, userCardID)
	if got := audit159Wave7Request(t, router, token, http.MethodPost, path, body, false).Code; got != http.StatusForbidden {
		t.Fatalf("POST /api/flashcards/reviews/batch without trusted origin=%d; want 403", got)
	}
	response := audit159Wave7Request(t, router, token, http.MethodPost, path, body, true)
	if response.Code != http.StatusOK {
		t.Fatalf("POST /api/flashcards/reviews/batch status=%d body=%s", response.Code, response.Body.String())
	}
	var results []flashcardreview.BatchReviewResult
	if err := json.Unmarshal(response.Body.Bytes(), &results); err != nil || len(results) != 1 || !results[0].OK || results[0].ClientMutationID != "wave7" {
		t.Fatalf("batch result=%+v err=%v", results, err)
	}
	var state string
	var count int
	if err := db.QueryRow(context.Background(), `SELECT state FROM learning.user_flashcard WHERE id=$1`, userCardID).Scan(&state); err != nil || state != "learning" {
		t.Fatalf("batch state=%q err=%v", state, err)
	}
	if err := db.QueryRow(context.Background(), `SELECT COUNT(*) FROM learning.review_event WHERE user_flashcard_id=$1 AND rating='again'`, userCardID).Scan(&count); err != nil || count != 1 {
		t.Fatalf("batch persisted review event count=%d err=%v", count, err)
	}
}

func TestAudit159Wave7FlashcardComebackSummaryReadsPersistedState(t *testing.T) {
	db := testPool(t)
	router, userID, token := audit159Wave7Router(t, db)
	audit159Wave7SeedCard(t, db, userID, "comeback", true)
	if got := audit159Wave7Request(t, router, "", http.MethodGet, "/api/flashcards/reviews/comeback-summary", "", false).Code; got != http.StatusUnauthorized {
		t.Fatalf("anonymous GET /api/flashcards/reviews/comeback-summary=%d; want 401", got)
	}
	response := audit159Wave7Request(t, router, token, http.MethodGet, "/api/flashcards/reviews/comeback-summary", "", false)
	if response.Code != http.StatusOK {
		t.Fatalf("GET /api/flashcards/reviews/comeback-summary status=%d body=%s", response.Code, response.Body.String())
	}
	var summary flashcardreview.ComebackSummary
	if err := json.Unmarshal(response.Body.Bytes(), &summary); err != nil || summary.TotalComebackCards != 1 || summary.DueNow != 1 {
		t.Fatalf("comeback summary=%+v err=%v", summary, err)
	}
}

func TestAudit159Wave7FlashcardDistractorsUseLearnerCardsAndContract(t *testing.T) {
	db := testPool(t)
	router, userID, token := audit159Wave7Router(t, db)
	_, userCardID := audit159Wave7SeedCard(t, db, userID, "distractors-correct", false)
	for _, label := range []string{"distractor-a", "distractor-b", "distractor-c"} {
		sourceID, cardID := newUUID(t), newUUID(t)
		if _, err := db.Exec(context.Background(), `INSERT INTO content.lexeme(id,headword,reading,jlpt_level,short_meaning_vi,status,created_at,updated_at)
			VALUES ($1,$2,'よみ','N5','meaning','active',NOW(),NOW())`, sourceID, "Wave7 "+label+" "+sourceID[:8]); err != nil {
			t.Fatal(err)
		}
		if _, err := db.Exec(context.Background(), `INSERT INTO learning.flashcard_variant(id,source_type,source_id,front_text,back_text,status,updated_at)
			VALUES ($1,'lexeme',$2,$3,$4,'active',NOW())`, cardID, sourceID, "Front "+label, "Wrong answer "+label); err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() {
			_, _ = db.Exec(context.Background(), `DELETE FROM learning.flashcard_variant WHERE id=$1`, cardID)
			_, _ = db.Exec(context.Background(), `DELETE FROM content.lexeme WHERE id=$1`, sourceID)
		})
	}
	path := "/api/flashcards/reviews/" + userCardID + "/distractors?n=2"
	if got := audit159Wave7Request(t, router, "", http.MethodGet, path, "", false).Code; got != http.StatusUnauthorized {
		t.Fatalf("anonymous GET /api/flashcards/reviews/{userFlashcardId}/distractors=%d; want 401", got)
	}
	response := audit159Wave7Request(t, router, token, http.MethodGet, path, "", false)
	if response.Code != http.StatusOK {
		t.Fatalf("GET /api/flashcards/reviews/{userFlashcardId}/distractors status=%d body=%s", response.Code, response.Body.String())
	}
	var payload struct {
		Items []string `json:"items"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil || len(payload.Items) != 2 {
		t.Fatalf("distractor contract=%+v err=%v body=%s", payload, err, response.Body.String())
	}
}
