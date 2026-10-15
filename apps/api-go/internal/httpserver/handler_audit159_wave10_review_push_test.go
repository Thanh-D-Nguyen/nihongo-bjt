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
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

func wave10ReviewPushFixture(t *testing.T, db *pgxpool.Pool) (http.Handler, string, string, *session.Store) {
	t.Helper()
	userID := newUUID(t)
	seedActiveUser(t, db, userID, "AUDIT-159 review/push", fmt.Sprintf("audit159-review-push-%s@example.test", userID[:8]), "")
	router, sessions := audit159Wave10Router(t, db, "")
	return router, userID, createLearnerSession(t, sessions, userID), sessions
}

func wave10ReviewPushRequest(router http.Handler, token, method, path, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	if token != "" {
		req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: token})
	}
	if method != http.MethodGet {
		req.Header.Set("Origin", "http://localhost:3000")
		req.Header.Set("Content-Type", "application/json")
	}
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)
	return rr
}

func TestAudit159Wave10PostPushSubscribeBrowserPayloadPersists(t *testing.T) {
	db := testPool(t)
	router, userID, token, _ := wave10ReviewPushFixture(t, db)
	endpoint := "https://push.example.test/" + strings.ReplaceAll(newUUID(t), "-", "")
	body := fmt.Sprintf(`{"subscription":{"endpoint":%q,"keys":{"p256dh":"p256dh-fixture","auth":"auth-fixture"}}}`, endpoint)
	created := wave10ReviewPushRequest(router, token, http.MethodPost, "/api/notifications/push/subscribe", body)
	if created.Code != http.StatusOK || !strings.Contains(created.Body.String(), `"subscribed":true`) {
		t.Fatalf("POST /api/notifications/push/subscribe status=%d body=%s", created.Code, created.Body.String())
	}
	var count int
	if err := db.QueryRow(context.Background(), `SELECT count(*) FROM ops.push_subscription WHERE user_id=$1 AND endpoint=$2 AND p256dh='p256dh-fixture' AND auth='auth-fixture'`, userID, endpoint).Scan(&count); err != nil || count != 1 {
		t.Fatalf("push subscription persistence count=%d err=%v", count, err)
	}
	invalid := wave10ReviewPushRequest(router, token, http.MethodPost, "/api/notifications/push/subscribe", `{"subscription":{"endpoint":"javascript:alert(1)","keys":{"p256dh":"x","auth":"y"}}}`)
	if invalid.Code != http.StatusBadRequest {
		t.Fatalf("invalid push endpoint status=%d body=%s", invalid.Code, invalid.Body.String())
	}
	if anonymous := wave10ReviewPushRequest(router, "", http.MethodPost, "/api/notifications/push/subscribe", body); anonymous.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous POST subscribe status=%d body=%s", anonymous.Code, anonymous.Body.String())
	}
}

func TestAudit159Wave10DeletePushSubscribeBrowserPayloadDeletesOwnSubscription(t *testing.T) {
	db := testPool(t)
	router, userID, token, _ := wave10ReviewPushFixture(t, db)
	endpoint := "https://push.example.test/" + strings.ReplaceAll(newUUID(t), "-", "")
	if _, err := db.Exec(context.Background(), `INSERT INTO ops.push_subscription(user_id,endpoint,p256dh,auth) VALUES($1,$2,'p256dh-fixture','auth-fixture')`, userID, endpoint); err != nil {
		t.Fatal(err)
	}
	removed := wave10ReviewPushRequest(router, token, http.MethodDelete, "/api/notifications/push/subscribe", fmt.Sprintf(`{"endpoint":%q}`, endpoint))
	if removed.Code != http.StatusOK || !strings.Contains(removed.Body.String(), `"unsubscribed":true`) {
		t.Fatalf("DELETE /api/notifications/push/subscribe status=%d body=%s", removed.Code, removed.Body.String())
	}
	var count int
	if err := db.QueryRow(context.Background(), `SELECT count(*) FROM ops.push_subscription WHERE user_id=$1 AND endpoint=$2`, userID, endpoint).Scan(&count); err != nil || count != 0 {
		t.Fatalf("push unsubscribe persistence count=%d err=%v", count, err)
	}
	if anonymous := wave10ReviewPushRequest(router, "", http.MethodDelete, "/api/notifications/push/subscribe", fmt.Sprintf(`{"endpoint":%q}`, endpoint)); anonymous.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous DELETE subscribe status=%d body=%s", anonymous.Code, anonymous.Body.String())
	}
}

func TestAudit159Wave10GetPublicShareContractAndExpiry(t *testing.T) {
	db := testPool(t)
	router, userID, _, _ := wave10ReviewPushFixture(t, db)
	ctx := context.Background()
	liveID, expiredID := newUUID(t), newUUID(t)
	liveToken := "audit159-review-push-" + strings.ReplaceAll(liveID, "-", "")
	expiredToken := "audit159-review-push-" + strings.ReplaceAll(expiredID, "-", "")
	for _, fixture := range []struct {
		id, token string
		expires   any
	}{{liveID, liveToken, nil}, {expiredID, expiredToken, time.Now().Add(-time.Hour)}} {
		if _, err := db.Exec(ctx, `INSERT INTO growth.share_item(id,user_id,public_token,kind,summary_payload,expires_at,created_at) VALUES($1,$2,$3,'achievement','{"headline":"safe fixture"}',$4,now())`, fixture.id, userID, fixture.token, fixture.expires); err != nil {
			t.Fatalf("seed public share: %v", err)
		}
		id := fixture.id
		t.Cleanup(func() { _, _ = db.Exec(ctx, `DELETE FROM growth.share_item WHERE id=$1`, id) })
	}
	live := wave10ReviewPushRequest(router, "", http.MethodGet, "/api/public/shares/"+liveToken, "")
	var payload map[string]json.RawMessage
	if live.Code != http.StatusOK || live.Header().Get("Cache-Control") != "no-store" || json.Unmarshal(live.Body.Bytes(), &payload) != nil || payload["summaryPayload"] == nil {
		t.Fatalf("GET live share status=%d cache=%q body=%s", live.Code, live.Header().Get("Cache-Control"), live.Body.String())
	}
	expired := wave10ReviewPushRequest(router, "", http.MethodGet, "/api/public/shares/"+expiredToken, "")
	if expired.Code != http.StatusNotFound || expired.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("GET expired share status=%d cache=%q body=%s", expired.Code, expired.Header().Get("Cache-Control"), expired.Body.String())
	}
}

func TestAudit159Wave10GetStudyFeedRouteAuthValidationAndEnvelope(t *testing.T) {
	db := testPool(t)
	router, _, token, _ := wave10ReviewPushFixture(t, db)
	if anonymous := wave10ReviewPushRequest(router, "", http.MethodGet, "/api/recommendation/study-feed?limit=1", ""); anonymous.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous study feed status=%d body=%s", anonymous.Code, anonymous.Body.String())
	}
	if invalid := wave10ReviewPushRequest(router, token, http.MethodGet, "/api/recommendation/study-feed?limit=101", ""); invalid.Code != http.StatusBadRequest {
		t.Fatalf("invalid study feed limit status=%d body=%s", invalid.Code, invalid.Body.String())
	}
	response := wave10ReviewPushRequest(router, token, http.MethodGet, "/api/recommendation/study-feed?limit=1", "")
	var body struct {
		Items []json.RawMessage `json:"items"`
		Meta  map[string]any    `json:"meta"`
	}
	if response.Code != http.StatusOK || json.Unmarshal(response.Body.Bytes(), &body) != nil || body.Items == nil || body.Meta["totalReturned"] == nil {
		t.Fatalf("authenticated study feed status=%d body=%s", response.Code, response.Body.String())
	}
}

func TestAudit159Wave10ReviewDeckCRUDPersistenceAndOwnership(t *testing.T) {
	db := testPool(t)
	router, userID, token, sessions := wave10ReviewPushFixture(t, db)
	otherID := newUUID(t)
	seedActiveUser(t, db, otherID, "AUDIT-159 other learner", fmt.Sprintf("audit159-review-other-%s@example.test", otherID[:8]), "")
	otherToken := createLearnerSession(t, sessions, otherID)
	id := newUUID(t)

	list := wave10ReviewPushRequest(router, token, http.MethodGet, "/api/review", "")
	var decks []struct {
		ID        string `json:"id"`
		Title     string `json:"title"`
		Kind      string `json:"kind"`
		CreatedAt string `json:"createdAt"`
	}
	if list.Code != http.StatusOK || json.Unmarshal(list.Body.Bytes(), &decks) != nil || len(decks) != 0 {
		t.Fatalf("GET /api/review empty contract status=%d body=%s", list.Code, list.Body.String())
	}
	if anonymous := wave10ReviewPushRequest(router, "", http.MethodGet, "/api/review", ""); anonymous.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous GET /api/review status=%d body=%s", anonymous.Code, anonymous.Body.String())
	}

	created := wave10ReviewPushRequest(router, token, http.MethodPost, "/api/review", `{"title":"Saved review","kind":"flashcard"}`)
	var createBody struct {
		ID string `json:"id"`
	}
	if created.Code != http.StatusOK || json.Unmarshal(created.Body.Bytes(), &createBody) != nil || createBody.ID == "" {
		t.Fatalf("POST /api/review status=%d body=%s", created.Code, created.Body.String())
	}
	id = createBody.ID
	var persistedUser, persistedTitle, persistedKind string
	var beforeUpdate time.Time
	if err := db.QueryRow(context.Background(), `SELECT user_id::text,title,kind,updated_at FROM study.user_review_deck WHERE id=$1`, id).Scan(&persistedUser, &persistedTitle, &persistedKind, &beforeUpdate); err != nil || persistedUser != userID || persistedTitle != "Saved review" || persistedKind != "flashcard" {
		t.Fatalf("created review persistence user=%q title=%q kind=%q err=%v", persistedUser, persistedTitle, persistedKind, err)
	}
	if _, err := db.Exec(context.Background(), `INSERT INTO study.user_review_deck(user_id,title,kind) VALUES($1,'orphan','flashcard')`, newUUID(t)); err == nil {
		t.Fatal("review deck accepted an unknown owner")
	}
	otherList := wave10ReviewPushRequest(router, otherToken, http.MethodGet, "/api/review", "")
	var otherDecks []json.RawMessage
	if otherList.Code != http.StatusOK || json.Unmarshal(otherList.Body.Bytes(), &otherDecks) != nil || len(otherDecks) != 0 {
		t.Fatalf("GET /api/review leaked another user's deck: status=%d body=%s", otherList.Code, otherList.Body.String())
	}
	if _, err := db.Exec(context.Background(), `UPDATE study.user_review_deck SET updated_at=NOW()-INTERVAL '1 day' WHERE id=$1`, id); err != nil {
		t.Fatal(err)
	}
	detail := wave10ReviewPushRequest(router, token, http.MethodGet, "/api/review/"+id, "")
	var detailBody struct {
		ID        string `json:"id"`
		Title     string `json:"title"`
		Kind      string `json:"kind"`
		CreatedAt string `json:"createdAt"`
	}
	if detail.Code != http.StatusOK || json.Unmarshal(detail.Body.Bytes(), &detailBody) != nil || detailBody.ID != id || detailBody.Title != "Saved review" || detailBody.Kind != "flashcard" || detailBody.CreatedAt == "" {
		t.Fatalf("GET /api/review/{id} status=%d body=%s", detail.Code, detail.Body.String())
	}
	if forbidden := wave10ReviewPushRequest(router, otherToken, http.MethodGet, "/api/review/"+id, ""); forbidden.Code != http.StatusNotFound {
		t.Fatalf("cross-user GET review status=%d body=%s", forbidden.Code, forbidden.Body.String())
	}
	if invalid := wave10ReviewPushRequest(router, token, http.MethodPatch, "/api/review/"+id, `{}`); invalid.Code != http.StatusBadRequest {
		t.Fatalf("empty PATCH review status=%d body=%s", invalid.Code, invalid.Body.String())
	}
	if forbidden := wave10ReviewPushRequest(router, otherToken, http.MethodPatch, "/api/review/"+id, `{"title":"stolen"}`); forbidden.Code != http.StatusNotFound {
		t.Fatalf("cross-user PATCH review status=%d body=%s", forbidden.Code, forbidden.Body.String())
	}
	updated := wave10ReviewPushRequest(router, token, http.MethodPatch, "/api/review/"+id, `{"title":"Renamed review"}`)
	if updated.Code != http.StatusOK || !strings.Contains(updated.Body.String(), `"updated":true`) {
		t.Fatalf("PATCH /api/review/{id} status=%d body=%s", updated.Code, updated.Body.String())
	}
	var afterUpdate time.Time
	if err := db.QueryRow(context.Background(), `SELECT title,updated_at FROM study.user_review_deck WHERE id=$1`, id).Scan(&persistedTitle, &afterUpdate); err != nil || persistedTitle != "Renamed review" || !afterUpdate.After(beforeUpdate) {
		t.Fatalf("review update persistence title=%q updated=%s before=%s err=%v", persistedTitle, afterUpdate, beforeUpdate, err)
	}
	list = wave10ReviewPushRequest(router, token, http.MethodGet, "/api/review", "")
	if list.Code != http.StatusOK || json.Unmarshal(list.Body.Bytes(), &decks) != nil || len(decks) != 1 || decks[0].ID != id || decks[0].Title != "Renamed review" {
		t.Fatalf("GET /api/review after update status=%d body=%s", list.Code, list.Body.String())
	}
	if forbidden := wave10ReviewPushRequest(router, otherToken, http.MethodDelete, "/api/review/"+id, ""); forbidden.Code != http.StatusNotFound {
		t.Fatalf("cross-user DELETE review status=%d body=%s", forbidden.Code, forbidden.Body.String())
	}
	var count int
	if err := db.QueryRow(context.Background(), `SELECT count(*) FROM study.user_review_deck WHERE id=$1`, id).Scan(&count); err != nil || count != 1 {
		t.Fatalf("cross-user delete changed row count=%d err=%v", count, err)
	}
	deleted := wave10ReviewPushRequest(router, token, http.MethodDelete, "/api/review/"+id, "")
	if deleted.Code != http.StatusOK || !strings.Contains(deleted.Body.String(), `"deleted":true`) {
		t.Fatalf("DELETE /api/review/{id} status=%d body=%s", deleted.Code, deleted.Body.String())
	}
	if err := db.QueryRow(context.Background(), `SELECT count(*) FROM study.user_review_deck WHERE id=$1 AND user_id=$2`, id, userID).Scan(&count); err != nil || count != 0 {
		t.Fatalf("review delete persistence count=%d err=%v", count, err)
	}
	if missing := wave10ReviewPushRequest(router, token, http.MethodGet, "/api/review/"+id, ""); missing.Code != http.StatusNotFound {
		t.Fatalf("GET deleted review status=%d body=%s", missing.Code, missing.Body.String())
	}
	if invalid := wave10ReviewPushRequest(router, token, http.MethodPost, "/api/review", `{"title":"  ","kind":"flashcard"}`); invalid.Code != http.StatusBadRequest {
		t.Fatalf("empty POST review status=%d body=%s", invalid.Code, invalid.Body.String())
	}
}

func TestAudit159Wave10GetReviewNextReturnsEarliestIncompleteQueueItemPerUser(t *testing.T) {
	db := testPool(t)
	router, userID, token, sessions := wave10ReviewPushFixture(t, db)
	otherID := newUUID(t)
	seedActiveUser(t, db, otherID, "AUDIT-159 queue other", fmt.Sprintf("audit159-review-queue-other-%s@example.test", otherID[:8]), "")
	otherToken := createLearnerSession(t, sessions, otherID)
	exerciseID := insertWave10ReviewExercise(t, db)
	completedExerciseID := insertWave10ReviewExercise(t, db)
	otherExerciseID := insertWave10ReviewExercise(t, db)
	var queueID string
	if err := db.QueryRow(context.Background(), `INSERT INTO study.review_queue(user_id,exercise_id,due_at,priority,completed,completed_at,correct) VALUES($1,$2,NOW()-INTERVAL '1 hour',3,false,NULL,NULL) RETURNING id::text`, userID, exerciseID).Scan(&queueID); err != nil {
		t.Fatalf("seed due queue item: %v", err)
	}
	if _, err := db.Exec(context.Background(), `INSERT INTO study.review_queue(user_id,exercise_id) VALUES($1,$2)`, userID, exerciseID); err == nil {
		t.Fatal("review queue accepted a duplicate user/exercise item")
	}
	if _, err := db.Exec(context.Background(), `INSERT INTO study.review_queue(user_id,exercise_id) VALUES($1,$2)`, newUUID(t), completedExerciseID); err == nil {
		t.Fatal("review queue accepted an unknown learner")
	}
	if _, err := db.Exec(context.Background(), `INSERT INTO study.review_queue(user_id,exercise_id) VALUES($1,$2)`, userID, newUUID(t)); err == nil {
		t.Fatal("review queue accepted an unknown exercise")
	}
	if _, err := db.Exec(context.Background(), `INSERT INTO study.review_queue(user_id,exercise_id,due_at,priority,completed,completed_at,correct) VALUES($1,$2,NOW()-INTERVAL '2 hours',10,true,NOW(),false),($3,$4,NOW()-INTERVAL '3 hours',100,false,NULL,NULL)`, userID, completedExerciseID, otherID, otherExerciseID); err != nil {
		t.Fatalf("seed completed and other-user queue items: %v", err)
	}
	response := wave10ReviewPushRequest(router, token, http.MethodGet, "/api/review/next", "")
	var due []struct {
		ID         string `json:"id"`
		ExerciseID string `json:"exerciseId"`
		DueAt      string `json:"dueAt"`
	}
	if response.Code != http.StatusOK || json.Unmarshal(response.Body.Bytes(), &due) != nil || len(due) != 1 || due[0].ID != queueID || due[0].ExerciseID != exerciseID || due[0].DueAt == "" {
		t.Fatalf("GET /api/review/next status=%d body=%s", response.Code, response.Body.String())
	}
	if anonymous := wave10ReviewPushRequest(router, "", http.MethodGet, "/api/review/next", ""); anonymous.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous GET /api/review/next status=%d body=%s", anonymous.Code, anonymous.Body.String())
	}
	if other := wave10ReviewPushRequest(router, otherToken, http.MethodGet, "/api/review/next", ""); other.Code != http.StatusOK || !strings.Contains(other.Body.String(), otherExerciseID) || strings.Contains(other.Body.String(), exerciseID) {
		t.Fatalf("GET /api/review/next leaked another user's queue: status=%d body=%s", other.Code, other.Body.String())
	}
	if _, err := db.Exec(context.Background(), `UPDATE study.review_queue SET completed=true,completed_at=NOW(),correct=true WHERE id=$1`, queueID); err != nil {
		t.Fatal(err)
	}
	noDue := wave10ReviewPushRequest(router, token, http.MethodGet, "/api/review/next", "")
	if noDue.Code != http.StatusOK || noDue.Body.String() != "[]\n" {
		t.Fatalf("GET /api/review/next after completion status=%d body=%s", noDue.Code, noDue.Body.String())
	}
}

func insertWave10ReviewExercise(t *testing.T, db *pgxpool.Pool) string {
	t.Helper()
	var id string
	if err := db.QueryRow(context.Background(), `INSERT INTO exercise.exercise(exercise_type,source_type,source_id,prompt,correct_answer) VALUES('translation','lexeme',$1,'{"text":"review fixture"}','{"key":"A"}') RETURNING id::text`, newUUID(t)).Scan(&id); err != nil {
		t.Fatalf("seed review exercise: %v", err)
	}
	return id
}
