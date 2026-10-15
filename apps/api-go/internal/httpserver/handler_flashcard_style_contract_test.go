package httpserver

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/flashcardstyle"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

func TestLearnerFlashcardStyleListMatchesPickerContract(t *testing.T) {
	db := testPool(t)
	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Style picker learner", userID+"@example.test", "")
	const slug = "audit-128-picker-contract"
	const configJSON = `{"background":"#f8fafc","foreground":"#172554","accent":"#2563eb"}`
	if _, err := db.Exec(context.Background(), `INSERT INTO learning.flashcard_style
		(slug, name_key, config, tier, status) VALUES ($1, 'flashcard.theme.audit', $2::jsonb, 'free', 'active')`, slug, configJSON); err != nil {
		t.Fatalf("insert Admin-managed style: %v", err)
	}
	t.Cleanup(func() {
		if _, err := db.Exec(context.Background(), `DELETE FROM learning.flashcard_style WHERE slug=$1`, slug); err != nil {
			t.Errorf("remove Admin-managed style fixture: %v", err)
		}
	})
	if _, err := db.Exec(context.Background(), `UPDATE profile.user_profile SET flashcard_style_slug=$1 WHERE id=$2`, slug, userID); err != nil {
		t.Fatalf("select Admin-managed style: %v", err)
	}

	sessions := session.NewStore(db)
	token := createLearnerSession(t, sessions, userID)
	router := NewRouter(Dependencies{
		Config:              &config.Config{Port: "4001", CORSOrigins: []string{"http://localhost:3000"}},
		Logger:              testLogger(),
		SessionStore:        sessions,
		FlashcardStyleStore: flashcardstyle.NewStore(db),
	})
	request := httptest.NewRequest(http.MethodGet, "/api/flashcards/styles", nil)
	request.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: token})
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("style picker list status=%d body=%s", response.Code, response.Body.String())
	}
	var body struct {
		ActiveSlug *string `json:"activeSlug"`
		Styles     []struct {
			Config json.RawMessage `json:"config"`
			Slug   string          `json:"slug"`
			Status string          `json:"status"`
		} `json:"styles"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode style picker contract: %v", err)
	}
	if body.ActiveSlug == nil || *body.ActiveSlug != slug {
		t.Fatalf("activeSlug=%v; want %q", body.ActiveSlug, slug)
	}
	for _, style := range body.Styles {
		if style.Slug == slug {
			var gotConfig map[string]string
			if err := json.Unmarshal(style.Config, &gotConfig); err != nil {
				t.Fatalf("decode style config: %v", err)
			}
			if style.Status != "active" || gotConfig["background"] != "#f8fafc" || gotConfig["foreground"] != "#172554" || gotConfig["accent"] != "#2563eb" {
				t.Fatalf("style = %+v; want active Admin-managed config %s", style, configJSON)
			}
			return
		}
	}
	t.Fatalf("style picker omitted selected Admin-managed style %q: %s", slug, response.Body.String())
}

func TestLearnerFlashcardStyleRoutesRequireSessionAndCSRF(t *testing.T) {
	db := testPool(t)
	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Style picker learner", userID+"@example.test", "")
	sessions := session.NewStore(db)
	token := createLearnerSession(t, sessions, userID)
	router := NewRouter(Dependencies{
		Config:              &config.Config{Port: "4001", CORSOrigins: []string{"http://localhost:3000"}},
		Logger:              testLogger(),
		SessionStore:        sessions,
		FlashcardStyleStore: flashcardstyle.NewStore(db),
	})
	for _, tc := range []struct {
		method string
		path   string
		body   string
	}{
		{method: http.MethodGet, path: "/api/flashcards/styles"},
		{method: http.MethodGet, path: "/api/flashcards/styles/active"},
		{method: http.MethodPut, path: "/api/flashcards/styles/active", body: `{"slug":null}`},
	} {
		t.Run(tc.method+" "+tc.path+" anonymous", func(t *testing.T) {
			request := httptest.NewRequest(tc.method, tc.path, strings.NewReader(tc.body))
			request.Header.Set("Content-Type", "application/json")
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)
			if response.Code != http.StatusUnauthorized {
				t.Fatalf("anonymous status=%d; want 401: %s", response.Code, response.Body.String())
			}
		})
	}
	request := httptest.NewRequest(http.MethodPut, "/api/flashcards/styles/active", strings.NewReader(`{"slug":null}`))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Origin", "https://untrusted.example")
	request.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: token})
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusForbidden {
		t.Fatalf("untrusted-origin style selection status=%d; want 403: %s", response.Code, response.Body.String())
	}
	var persisted *string
	if err := db.QueryRow(context.Background(), `SELECT flashcard_style_slug FROM profile.user_profile WHERE id=$1`, userID).Scan(&persisted); err != nil {
		t.Fatalf("read style selection after CSRF denial: %v", err)
	}
	if persisted != nil {
		t.Fatalf("CSRF-denied request changed learner style to %v", persisted)
	}
}
