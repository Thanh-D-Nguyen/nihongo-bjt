package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/notification"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

const inAppTestOrigin = "http://localhost:3000"

func inAppNotificationTestRouter(db *pgxpool.Pool) http.Handler {
	return NewRouter(Dependencies{
		Config:            &config.Config{CORSOrigins: []string{inAppTestOrigin}},
		Logger:            testLogger(),
		DBPool:            db,
		SessionStore:      session.NewStore(db),
		NotificationStore: notification.NewStore(db),
	})
}

func seedInAppLearner(t *testing.T, db *pgxpool.Pool, prefix string) string {
	t.Helper()
	userID := newUUID(t)
	seedActiveUser(t, db, userID, prefix+" fixture", fmt.Sprintf("%s-%s@example.test", prefix, userID), "")
	return userID
}

func seedInAppNotification(t *testing.T, db *pgxpool.Pool, userID, kind string, createdAt time.Time, readAt *time.Time) string {
	t.Helper()
	id := newUUID(t)
	_, err := db.Exec(context.Background(),
		`INSERT INTO profile.in_app_notification (id, user_id, kind, payload, read_at, created_at)
		 VALUES ($1, $2, $3, '{"message":"fixture"}'::jsonb, $4, $5)`,
		id, userID, kind, readAt, createdAt)
	if err != nil {
		t.Fatalf("seed in-app notification: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM profile.in_app_notification WHERE id = $1`, id)
	})
	return id
}

func inAppLearnerRequest(t *testing.T, db *pgxpool.Pool, userID, method, path string) *http.Request {
	t.Helper()
	req := httptest.NewRequest(method, path, nil)
	req.Header.Set("Origin", inAppTestOrigin)
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: createLearnerSession(t, session.NewStore(db), userID)})
	return req
}

func TestInAppNotificationsListReturnsOwnRowsNewestFirst(t *testing.T) {
	db := testPool(t)
	ownerID := seedInAppLearner(t, db, "inbox-owner")
	otherID := seedInAppLearner(t, db, "inbox-other")
	now := time.Now().UTC().Truncate(time.Microsecond)
	olderID := seedInAppNotification(t, db, ownerID, "placement_complete", now.Add(-2*time.Hour), nil)
	newerID := seedInAppNotification(t, db, ownerID, "daily_radar", now.Add(-time.Hour), &now)
	seedInAppNotification(t, db, otherID, "placement_complete", now, nil)
	router := inAppNotificationTestRouter(db)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, inAppLearnerRequest(t, db, ownerID, http.MethodGet, "/api/learner/in-app-notifications?limit=20"))
	if w.Code != http.StatusOK {
		t.Fatalf("list status = %d, want 200: %s", w.Code, w.Body.String())
	}
	var got []struct {
		ID        string         `json:"id"`
		Kind      string         `json:"kind"`
		Payload   map[string]any `json:"payload"`
		ReadAt    *string        `json:"readAt"`
		CreatedAt string         `json:"createdAt"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode list response: %v: %s", err, w.Body.String())
	}
	if len(got) != 2 {
		t.Fatalf("got %d notifications, want the owner's 2 only: %s", len(got), w.Body.String())
	}
	if got[0].ID != newerID || got[1].ID != olderID {
		t.Fatalf("notifications not newest first or leaked another user's row: %s", w.Body.String())
	}
	if got[0].ReadAt == nil || got[1].ReadAt != nil {
		t.Fatalf("readAt not preserved per row: %s", w.Body.String())
	}
	if got[0].Kind != "daily_radar" || got[0].Payload["message"] != "fixture" || got[0].CreatedAt == "" {
		t.Fatalf("row does not match in-app notification contract: %#v", got[0])
	}

	anon := httptest.NewRecorder()
	router.ServeHTTP(anon, httptest.NewRequest(http.MethodGet, "/api/learner/in-app-notifications", nil))
	if anon.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous list status = %d, want 401: %s", anon.Code, anon.Body.String())
	}
}

func TestInAppNotificationMarkReadIsOwnerScopedAndIdempotent(t *testing.T) {
	db := testPool(t)
	ownerID := seedInAppLearner(t, db, "read-owner")
	otherID := seedInAppLearner(t, db, "read-other")
	now := time.Now().UTC().Truncate(time.Microsecond)
	ownRowID := seedInAppNotification(t, db, ownerID, "placement_complete", now, nil)
	otherRowID := seedInAppNotification(t, db, otherID, "placement_complete", now, nil)
	router := inAppNotificationTestRouter(db)

	readAtOf := func(id string) *time.Time {
		t.Helper()
		var readAt *time.Time
		if err := db.QueryRow(context.Background(), `SELECT read_at FROM profile.in_app_notification WHERE id = $1`, id).Scan(&readAt); err != nil {
			t.Fatalf("read read_at: %v", err)
		}
		return readAt
	}

	first := httptest.NewRecorder()
	router.ServeHTTP(first, inAppLearnerRequest(t, db, ownerID, http.MethodPost, "/api/learner/in-app-notifications/"+ownRowID+"/read"))
	if first.Code != http.StatusCreated {
		t.Fatalf("mark own read status = %d, want 201: %s", first.Code, first.Body.String())
	}
	firstReadAt := readAtOf(ownRowID)
	if firstReadAt == nil {
		t.Fatal("own notification read_at not set after mark-read")
	}

	again := httptest.NewRecorder()
	router.ServeHTTP(again, inAppLearnerRequest(t, db, ownerID, http.MethodPost, "/api/learner/in-app-notifications/"+ownRowID+"/read"))
	if again.Code != http.StatusCreated {
		t.Fatalf("repeat mark-read status = %d, want 201: %s", again.Code, again.Body.String())
	}
	if secondReadAt := readAtOf(ownRowID); secondReadAt == nil || !secondReadAt.Equal(*firstReadAt) {
		t.Fatalf("repeat mark-read changed first read_at: first=%v second=%v", firstReadAt, secondReadAt)
	}

	foreign := httptest.NewRecorder()
	router.ServeHTTP(foreign, inAppLearnerRequest(t, db, ownerID, http.MethodPost, "/api/learner/in-app-notifications/"+otherRowID+"/read"))
	if foreign.Code != http.StatusNotFound {
		t.Fatalf("mark other user's notification status = %d, want 404: %s", foreign.Code, foreign.Body.String())
	}
	if readAtOf(otherRowID) != nil {
		t.Fatal("another user's notification was marked read")
	}

	malformed := httptest.NewRecorder()
	router.ServeHTTP(malformed, inAppLearnerRequest(t, db, ownerID, http.MethodPost, "/api/learner/in-app-notifications/not-a-uuid/read"))
	if malformed.Code != http.StatusBadRequest {
		t.Fatalf("malformed id status = %d, want 400: %s", malformed.Code, malformed.Body.String())
	}

	noOrigin := inAppLearnerRequest(t, db, otherID, http.MethodPost, "/api/learner/in-app-notifications/"+otherRowID+"/read")
	noOrigin.Header.Del("Origin")
	csrf := httptest.NewRecorder()
	router.ServeHTTP(csrf, noOrigin)
	if csrf.Code != http.StatusForbidden {
		t.Fatalf("mark-read without trusted origin status = %d, want 403: %s", csrf.Code, csrf.Body.String())
	}
	if readAtOf(otherRowID) != nil {
		t.Fatal("CSRF-rejected mark-read still changed the notification")
	}
}

func TestInAppNotificationListLimitContract(t *testing.T) {
	db := testPool(t)
	ownerID := seedInAppLearner(t, db, "limit-owner")
	base := time.Now().UTC().Truncate(time.Microsecond)
	for i := 0; i < 21; i++ {
		seedInAppNotification(t, db, ownerID, "placement_complete", base.Add(-time.Duration(i)*time.Minute), nil)
	}
	router := inAppNotificationTestRouter(db)

	cases := []struct {
		name     string
		query    string
		wantCode int
		wantRows int
	}{
		{name: "default limit is 20", query: "", wantCode: http.StatusOK, wantRows: 20},
		{name: "explicit limit 1", query: "?limit=1", wantCode: http.StatusOK, wantRows: 1},
		{name: "upper bound 100 accepted", query: "?limit=100", wantCode: http.StatusOK, wantRows: 21},
		{name: "zero rejected", query: "?limit=0", wantCode: http.StatusBadRequest},
		{name: "above 100 rejected", query: "?limit=101", wantCode: http.StatusBadRequest},
		{name: "negative rejected", query: "?limit=-1", wantCode: http.StatusBadRequest},
		{name: "non-numeric rejected", query: "?limit=abc", wantCode: http.StatusBadRequest},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			router.ServeHTTP(w, inAppLearnerRequest(t, db, ownerID, http.MethodGet, "/api/learner/in-app-notifications"+tc.query))
			if w.Code != tc.wantCode {
				t.Fatalf("status = %d, want %d: %s", w.Code, tc.wantCode, w.Body.String())
			}
			if tc.wantCode != http.StatusOK {
				return
			}
			var rows []map[string]any
			if err := json.Unmarshal(w.Body.Bytes(), &rows); err != nil {
				t.Fatalf("decode: %v", err)
			}
			if len(rows) != tc.wantRows {
				t.Fatalf("rows = %d, want %d", len(rows), tc.wantRows)
			}
		})
	}
}

func TestInAppNotificationWriteAccessContract(t *testing.T) {
	db := testPool(t)
	ownerID := seedInAppLearner(t, db, "access-owner")
	rowID := seedInAppNotification(t, db, ownerID, "placement_complete", time.Now().UTC(), nil)
	router := inAppNotificationTestRouter(db)

	anon := httptest.NewRecorder()
	anonReq := httptest.NewRequest(http.MethodPost, "/api/learner/in-app-notifications/"+rowID+"/read", nil)
	anonReq.Header.Set("Origin", inAppTestOrigin)
	router.ServeHTTP(anon, anonReq)
	if anon.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous mark-read status = %d, want 401: %s", anon.Code, anon.Body.String())
	}

	untrusted := inAppLearnerRequest(t, db, ownerID, http.MethodPost, "/api/learner/in-app-notifications/"+rowID+"/read")
	untrusted.Header.Set("Origin", "https://evil.example.com")
	forbidden := httptest.NewRecorder()
	router.ServeHTTP(forbidden, untrusted)
	if forbidden.Code != http.StatusForbidden {
		t.Fatalf("untrusted-origin mark-read status = %d, want 403: %s", forbidden.Code, forbidden.Body.String())
	}

	missing := httptest.NewRecorder()
	router.ServeHTTP(missing, inAppLearnerRequest(t, db, ownerID, http.MethodPost, "/api/learner/in-app-notifications/"+newUUID(t)+"/read"))
	if missing.Code != http.StatusNotFound {
		t.Fatalf("unknown-id mark-read status = %d, want 404: %s", missing.Code, missing.Body.String())
	}
}
