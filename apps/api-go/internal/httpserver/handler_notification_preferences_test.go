package httpserver

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

func TestNotificationPreferencesPutCreatesMissingRow(t *testing.T) {
	db := testPool(t)
	userID := seedInAppLearner(t, db, "prefs-new")
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM profile.notification_preference WHERE user_id = $1`, userID)
	})
	router := inAppNotificationTestRouter(db)
	getDefaults := httptest.NewRequest(http.MethodGet, "/api/learner/notification-preferences", nil)
	getDefaults.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: createLearnerSession(t, session.NewStore(db), userID)})
	defaultsW := httptest.NewRecorder()
	router.ServeHTTP(defaultsW, getDefaults)
	if defaultsW.Code != http.StatusOK {
		t.Fatalf("GET without a preferences row status = %d, want 200: %s", defaultsW.Code, defaultsW.Body.String())
	}
	var defaults struct {
		StudyRemindersEnabled bool      `json:"studyRemindersEnabled"`
		ProductNewsEnabled    bool      `json:"productNewsEnabled"`
		EmailEnabled          bool      `json:"emailEnabled"`
		InAppEnabled          bool      `json:"inAppEnabled"`
		CreatedAt             time.Time `json:"createdAt"`
		UpdatedAt             time.Time `json:"updatedAt"`
	}
	if err := json.Unmarshal(defaultsW.Body.Bytes(), &defaults); err != nil {
		t.Fatalf("decode default GET response: %v: %s", err, defaultsW.Body.String())
	}
	if !defaults.StudyRemindersEnabled || defaults.ProductNewsEnabled || !defaults.EmailEnabled || !defaults.InAppEnabled {
		t.Fatalf("GET without a row returned wrong defaults: %s", defaultsW.Body.String())
	}
	if defaults.CreatedAt.IsZero() || !defaults.CreatedAt.Equal(defaults.UpdatedAt) || defaults.CreatedAt.Location() != time.UTC {
		t.Fatalf("GET without a row must return one non-zero UTC timestamp: %s", defaultsW.Body.String())
	}
	var rowsBeforeSave int
	if err := db.QueryRow(context.Background(), `SELECT count(*) FROM profile.notification_preference WHERE user_id = $1`, userID).Scan(&rowsBeforeSave); err != nil {
		t.Fatalf("count preferences after default GET: %v", err)
	}
	if rowsBeforeSave != 0 {
		t.Fatalf("default GET must not persist preferences, got %d rows", rowsBeforeSave)
	}

	body := `{"productNewsEnabled":true}`
	put := httptest.NewRequest(http.MethodPut, "/api/learner/notification-preferences", strings.NewReader(body))
	put.Header.Set("Content-Type", "application/json")
	put.Header.Set("Origin", inAppTestOrigin)
	put.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: createLearnerSession(t, session.NewStore(db), userID)})
	w := httptest.NewRecorder()
	router.ServeHTTP(w, put)
	if w.Code != http.StatusOK {
		t.Fatalf("PUT for learner without a preferences row status = %d, want 200: %s", w.Code, w.Body.String())
	}

	var echoed struct {
		StudyRemindersEnabled bool      `json:"studyRemindersEnabled"`
		ProductNewsEnabled    bool      `json:"productNewsEnabled"`
		EmailEnabled          bool      `json:"emailEnabled"`
		InAppEnabled          bool      `json:"inAppEnabled"`
		CreatedAt             time.Time `json:"createdAt"`
		UpdatedAt             time.Time `json:"updatedAt"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &echoed); err != nil {
		t.Fatalf("decode PUT response: %v: %s", err, w.Body.String())
	}
	if !echoed.StudyRemindersEnabled || !echoed.ProductNewsEnabled || !echoed.EmailEnabled || !echoed.InAppEnabled {
		t.Fatalf("first partial PUT did not preserve omitted defaults: %s", w.Body.String())
	}
	if echoed.CreatedAt.IsZero() || echoed.UpdatedAt.IsZero() {
		t.Fatalf("first partial PUT did not return persisted timestamps: %s", w.Body.String())
	}

	var createdAt, updatedAt *time.Time
	if err := db.QueryRow(context.Background(), `SELECT created_at, updated_at FROM profile.notification_preference WHERE user_id = $1`, userID).Scan(&createdAt, &updatedAt); err != nil {
		t.Fatalf("row not persisted: %v", err)
	}
	if createdAt == nil || updatedAt == nil {
		t.Fatalf("persisted row has null timestamps: created=%v updated=%v", createdAt, updatedAt)
	}
	if !echoed.CreatedAt.Equal(*createdAt) || !echoed.UpdatedAt.Equal(*updatedAt) {
		t.Fatalf("PUT response timestamps do not match persisted row: response=%s created=%v updated=%v", w.Body.String(), createdAt, updatedAt)
	}

	get := httptest.NewRequest(http.MethodGet, "/api/learner/notification-preferences", nil)
	get.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: createLearnerSession(t, session.NewStore(db), userID)})
	getW := httptest.NewRecorder()
	router.ServeHTTP(getW, get)
	if getW.Code != http.StatusOK {
		t.Fatalf("GET after PUT status = %d, want 200: %s", getW.Code, getW.Body.String())
	}
	var stored struct {
		StudyRemindersEnabled bool `json:"studyRemindersEnabled"`
		ProductNewsEnabled    bool `json:"productNewsEnabled"`
		EmailEnabled          bool `json:"emailEnabled"`
		InAppEnabled          bool `json:"inAppEnabled"`
	}
	if err := json.Unmarshal(getW.Body.Bytes(), &stored); err != nil {
		t.Fatalf("decode GET response: %v", err)
	}
	if !stored.StudyRemindersEnabled || !stored.ProductNewsEnabled || !stored.EmailEnabled || !stored.InAppEnabled {
		t.Fatalf("GET after PUT did not return saved preferences: %s", getW.Body.String())
	}

	again := httptest.NewRequest(http.MethodPut, "/api/learner/notification-preferences", strings.NewReader(`{"emailEnabled":true}`))
	again.Header.Set("Content-Type", "application/json")
	again.Header.Set("Origin", inAppTestOrigin)
	again.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: createLearnerSession(t, session.NewStore(db), userID)})
	againW := httptest.NewRecorder()
	router.ServeHTTP(againW, again)
	if againW.Code != http.StatusOK {
		t.Fatalf("second PUT status = %d, want 200: %s", againW.Code, againW.Body.String())
	}
	var rowCount int
	var secondUpdatedAt *time.Time
	if err := db.QueryRow(context.Background(), `SELECT count(*), max(updated_at) FROM profile.notification_preference WHERE user_id = $1`, userID).Scan(&rowCount, &secondUpdatedAt); err != nil {
		t.Fatalf("read row after second PUT: %v", err)
	}
	if rowCount != 1 {
		t.Fatalf("second PUT must update the same row, got %d rows", rowCount)
	}
	if secondUpdatedAt == nil || !secondUpdatedAt.After(*updatedAt) {
		t.Fatalf("second PUT must advance updated_at: first=%v second=%v", updatedAt, secondUpdatedAt)
	}
}
