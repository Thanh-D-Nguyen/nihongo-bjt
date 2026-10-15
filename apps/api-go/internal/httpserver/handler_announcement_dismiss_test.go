package httpserver

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

func TestPostAnnouncementDismissPersistsForLearnerAndAcknowledgesGuest(t *testing.T) {
	db := testPool(t)
	userID, announcementID := newUUID(t), newUUID(t)
	seedActiveUser(t, db, userID, "Announcement learner", "announcement-"+userID[:8]+"@example.com", "")
	if _, err := db.Exec(context.Background(), `INSERT INTO content.announcement (id, message, updated_at) VALUES ($1, 'Audit dismissal', NOW())`, announcementID); err != nil {
		t.Fatalf("seed announcement: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM content.announcement WHERE id = $1`, announcementID)
		_, _ = db.Exec(context.Background(), `DELETE FROM auth.user WHERE id = $1`, userID)
	})
	sessions := session.NewStore(db)
	rawToken := createLearnerSession(t, sessions, userID)
	router := NewRouter(Dependencies{
		Config:       &config.Config{CORSOrigins: []string{"http://localhost:3000"}},
		Logger:       testLogger(),
		DBPool:       db,
		SessionStore: sessions,
	})

	post := func(token string) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(http.MethodPost, "/api/announcements/"+announcementID+"/dismiss", nil)
		req.Header.Set("Origin", "http://localhost:3000")
		if token != "" {
			req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: token})
		}
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		return w
	}
	assertBody := func(w *httptest.ResponseRecorder, persisted bool) {
		t.Helper()
		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200: %s", w.Code, w.Body.String())
		}
		var body struct {
			Dismissed bool `json:"dismissed"`
			Persisted bool `json:"persisted"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
			t.Fatalf("decode response: %v", err)
		}
		if !body.Dismissed || body.Persisted != persisted {
			t.Fatalf("response = %+v, want dismissed=true persisted=%t", body, persisted)
		}
	}

	assertBody(post(rawToken), true)
	assertBody(post(rawToken), true)
	var count int
	if err := db.QueryRow(context.Background(), `SELECT count(*) FROM content.announcement_dismissal WHERE announcement_id=$1 AND user_id=$2`, announcementID, userID).Scan(&count); err != nil {
		t.Fatalf("count learner dismissals: %v", err)
	}
	if count != 1 {
		t.Fatalf("got %d persisted dismissals, want 1", count)
	}
	assertBody(post(""), false)
	if err := db.QueryRow(context.Background(), `SELECT count(*) FROM content.announcement_dismissal WHERE announcement_id=$1 AND user_id=$2`, announcementID, userID).Scan(&count); err != nil {
		t.Fatalf("count guest dismissals: %v", err)
	}
	if count != 1 {
		t.Fatalf("guest dismissal changed persisted row count to %d", count)
	}
}
