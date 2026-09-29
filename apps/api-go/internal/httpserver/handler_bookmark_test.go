package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

func TestBookmarkToggle_Create(t *testing.T) {
	db := testPool(t)
	sessStore := session.NewStore(db)
	router := NewRouter(Dependencies{
		Config:       &config.Config{CORSOrigins: []string{"http://localhost:3000"}},
		Logger:       testLogger(),
		DBPool:       db,
		SessionStore: sessStore,
	})

	userID := newUUID(t)
	email := fmt.Sprintf("bm-toggle-%s@example.com", userID[:8])
	seedActiveUser(t, db, userID, "BM Toggle", email, "")
	rawToken := createLearnerSession(t, sessStore, userID)

	req := httptest.NewRequest(http.MethodPost, "/api/bookmarks/word/w-001", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("X-CSRF-Token", "test-csrf")
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var resp map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp["bookmarked"] != true {
		t.Errorf("expected bookmarked=true, got %v", resp["bookmarked"])
	}
	if resp["targetId"] != "w-001" {
		t.Errorf("expected targetId=w-001, got %v", resp["targetId"])
	}

	t.Cleanup(func() {
		cctx, ccancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer ccancel()
		_, _ = db.Exec(cctx, `DELETE FROM learner.bookmark WHERE user_id = $1`, userID)
	})
}

func TestBookmarkToggle_Delete(t *testing.T) {
	db := testPool(t)
	sessStore := session.NewStore(db)
	router := NewRouter(Dependencies{
		Config:       &config.Config{CORSOrigins: []string{"http://localhost:3000"}},
		Logger:       testLogger(),
		DBPool:       db,
		SessionStore: sessStore,
	})

	userID := newUUID(t)
	email := fmt.Sprintf("bm-del-%s@example.com", userID[:8])
	seedActiveUser(t, db, userID, "BM Del", email, "")
	rawToken := createLearnerSession(t, sessStore, userID)

	// Create bookmark first.
	req := httptest.NewRequest(http.MethodPost, "/api/bookmarks/kanji/k-001", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("X-CSRF-Token", "test-csrf")
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("create: expected 200, got %d", rr.Code)
	}

	// Toggle again to delete.
	req2 := httptest.NewRequest(http.MethodPost, "/api/bookmarks/kanji/k-001", nil)
	req2.Header.Set("Origin", "http://localhost:3000")
	req2.Header.Set("X-CSRF-Token", "test-csrf")
	req2.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})
	rr2 := httptest.NewRecorder()
	router.ServeHTTP(rr2, req2)

	if rr2.Code != http.StatusOK {
		t.Fatalf("delete: expected 200, got %d: %s", rr2.Code, rr2.Body.String())
	}

	var resp map[string]any
	if err := json.Unmarshal(rr2.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp["bookmarked"] != false {
		t.Errorf("expected bookmarked=false after toggle, got %v", resp["bookmarked"])
	}

	t.Cleanup(func() {
		cctx, ccancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer ccancel()
		_, _ = db.Exec(cctx, `DELETE FROM learner.bookmark WHERE user_id = $1`, userID)
	})
}

func TestBookmarkCheck_Found(t *testing.T) {
	db := testPool(t)
	sessStore := session.NewStore(db)
	router := NewRouter(Dependencies{
		Config:       &config.Config{CORSOrigins: []string{"http://localhost:3000"}},
		Logger:       testLogger(),
		DBPool:       db,
		SessionStore: sessStore,
	})

	userID := newUUID(t)
	email := fmt.Sprintf("bm-chk-%s@example.com", userID[:8])
	seedActiveUser(t, db, userID, "BM Check", email, "")
	rawToken := createLearnerSession(t, sessStore, userID)

	// Seed a bookmark directly.
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err := db.Exec(ctx,
		`INSERT INTO learner.bookmark (user_id, target_type, target_id) VALUES ($1, 'grammar', 'g-001')`,
		userID)
	if err != nil {
		t.Fatalf("seed bookmark: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/bookmarks/check/grammar/g-001", nil)
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var resp map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp["bookmarked"] != true {
		t.Errorf("expected bookmarked=true, got %v", resp["bookmarked"])
	}

	t.Cleanup(func() {
		cctx, ccancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer ccancel()
		_, _ = db.Exec(cctx, `DELETE FROM learner.bookmark WHERE user_id = $1`, userID)
	})
}

func TestBookmarkCheck_NotFound(t *testing.T) {
	db := testPool(t)
	sessStore := session.NewStore(db)
	router := NewRouter(Dependencies{
		Config:       &config.Config{CORSOrigins: []string{"http://localhost:3000"}},
		Logger:       testLogger(),
		DBPool:       db,
		SessionStore: sessStore,
	})

	userID := newUUID(t)
	email := fmt.Sprintf("bm-nochk-%s@example.com", userID[:8])
	seedActiveUser(t, db, userID, "BM NoCheck", email, "")
	rawToken := createLearnerSession(t, sessStore, userID)

	req := httptest.NewRequest(http.MethodGet, "/api/bookmarks/check/lexeme/nonexistent", nil)
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}

	var resp map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp["bookmarked"] != false {
		t.Errorf("expected bookmarked=false, got %v", resp["bookmarked"])
	}
}

func TestBookmarkList_Success(t *testing.T) {
	db := testPool(t)
	sessStore := session.NewStore(db)
	router := NewRouter(Dependencies{
		Config:       &config.Config{CORSOrigins: []string{"http://localhost:3000"}},
		Logger:       testLogger(),
		DBPool:       db,
		SessionStore: sessStore,
	})

	userID := newUUID(t)
	email := fmt.Sprintf("bm-list-%s@example.com", userID[:8])
	seedActiveUser(t, db, userID, "BM List", email, "")
	rawToken := createLearnerSession(t, sessStore, userID)

	// Seed two bookmarks.
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, _ = db.Exec(ctx,
		`INSERT INTO learner.bookmark (user_id, target_type, target_id) VALUES ($1, 'lexeme', 'w-100'), ($1, 'lexeme', 'w-200')`,
		userID)

	req := httptest.NewRequest(http.MethodGet, "/api/bookmarks/words?limit=10", nil)
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var resp map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	items, ok := resp["items"].([]any)
	if !ok {
		t.Fatal("expected items array")
	}
	if len(items) != 2 {
		t.Errorf("expected 2 items, got %d", len(items))
	}

	t.Cleanup(func() {
		cctx, ccancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer ccancel()
		_, _ = db.Exec(cctx, `DELETE FROM learner.bookmark WHERE user_id = $1`, userID)
	})
}

func TestBookmark_Unauthorized(t *testing.T) {
	db := testPool(t)
	sessStore := session.NewStore(db)
	router := NewRouter(Dependencies{
		Config:       &config.Config{CORSOrigins: []string{"http://localhost:3000"}},
		Logger:       testLogger(),
		DBPool:       db,
		SessionStore: sessStore,
	})

	req := httptest.NewRequest(http.MethodPost, "/api/bookmarks/word/w-001", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("X-CSRF-Token", "test-csrf")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 without session, got %d", rr.Code)
	}
}

func TestBookmark_InvalidType(t *testing.T) {
	db := testPool(t)
	sessStore := session.NewStore(db)
	router := NewRouter(Dependencies{
		Config:       &config.Config{CORSOrigins: []string{"http://localhost:3000"}},
		Logger:       testLogger(),
		DBPool:       db,
		SessionStore: sessStore,
	})

	userID := newUUID(t)
	email := fmt.Sprintf("bm-badtype-%s@example.com", userID[:8])
	seedActiveUser(t, db, userID, "BM BadType", email, "")
	rawToken := createLearnerSession(t, sessStore, userID)

	req := httptest.NewRequest(http.MethodPost, "/api/bookmarks/invalid/x-001", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("X-CSRF-Token", "test-csrf")
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for invalid type, got %d", rr.Code)
	}
}
