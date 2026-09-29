package httpserver

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"log/slog"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/profile"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

// profileTestServer creates a test server with GET and PUT /api/auth/me handlers
// wrapped in the LearnerGuard middleware so session cookies are validated and
// learner identity is injected into the request context.
func profileTestServer(t *testing.T) (*httptest.Server, *session.Store) {
	t.Helper()
	pool := testPool(t)
	profileStore := profile.NewStore(pool)
	sessionStore := session.NewStore(pool)
	logger := slog.Default()

	guardCfg := authn.DefaultGuardConfig(logger)
	learnerGuard := authn.LearnerGuard(sessionStore, guardCfg)

	mux := http.NewServeMux()
	mux.Handle("/api/auth/me", learnerGuard(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			learnerGetMeHandler(profileStore, logger)(w, r)
		case http.MethodPut:
			learnerUpdateMeHandler(profileStore, logger)(w, r)
		default:
			writeJSONError(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})))

	return httptest.NewServer(mux), sessionStore
}

func TestGetMe_Success(t *testing.T) {
	pool := testPool(t)
	srv, sessionStore := profileTestServer(t)
	defer srv.Close()

	userID := newUUID(t)
	email := fmt.Sprintf("getme-success-%s@example.com", userID[:8])
	seedActiveUser(t, pool, userID, "GetMe User", email, "")

	rawToken := createLearnerSession(t, sessionStore, userID)

	req, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/auth/me", nil)
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		t.Fatalf("decode failed: %v", err)
	}
	if result["id"] != userID {
		t.Errorf("expected id=%s, got %v", userID, result["id"])
	}
	if result["email"] != email {
		t.Errorf("expected email=%s, got %v", email, result["email"])
	}
	if result["displayName"] != "GetMe User" {
		t.Errorf("expected displayName='GetMe User', got %v", result["displayName"])
	}
	if result["themeMode"] != "system" {
		t.Errorf("expected themeMode='system', got %v", result["themeMode"])
	}
}

func TestGetMe_Unauthorized_NoCookie(t *testing.T) {
	srv, _ := profileTestServer(t)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/api/auth/me")
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", resp.StatusCode)
	}
}

func TestGetMe_InvalidSession(t *testing.T) {
	srv, _ := profileTestServer(t)
	defer srv.Close()

	req, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/auth/me", nil)
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: "invalid-session-token"})
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", resp.StatusCode)
	}
}

func TestUpdateMe_Success(t *testing.T) {
	pool := testPool(t)
	srv, sessionStore := profileTestServer(t)
	defer srv.Close()

	userID := newUUID(t)
	email := fmt.Sprintf("updateme-success-%s@example.com", userID[:8])
	seedActiveUser(t, pool, userID, "Update User", email, "")

	rawToken := createLearnerSession(t, sessionStore, userID)

	body := map[string]string{"displayName": "Updated Name", "themeMode": "dark"}
	b, _ := json.Marshal(body)
	req, _ := http.NewRequest(http.MethodPut, srv.URL+"/api/auth/me", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		t.Fatalf("decode failed: %v", err)
	}
	if result["displayName"] != "Updated Name" {
		t.Errorf("expected displayName='Updated Name', got %v", result["displayName"])
	}
	if result["themeMode"] != "dark" {
		t.Errorf("expected themeMode='dark', got %v", result["themeMode"])
	}
}

func TestUpdateMe_PartialUpdate(t *testing.T) {
	pool := testPool(t)
	srv, sessionStore := profileTestServer(t)
	defer srv.Close()

	userID := newUUID(t)
	email := fmt.Sprintf("updateme-partial-%s@example.com", userID[:8])
	seedActiveUser(t, pool, userID, "Partial User", email, "")

	rawToken := createLearnerSession(t, sessionStore, userID)

	// Update only fontSizePreference; other fields should remain unchanged.
	body := map[string]string{"fontSizePreference": "large"}
	b, _ := json.Marshal(body)
	req, _ := http.NewRequest(http.MethodPut, srv.URL+"/api/auth/me", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		t.Fatalf("decode failed: %v", err)
	}
	if result["fontSizePreference"] != "large" {
		t.Errorf("expected fontSizePreference='large', got %v", result["fontSizePreference"])
	}
	// displayName should be unchanged.
	if result["displayName"] != "Partial User" {
		t.Errorf("expected displayName='Partial User' (unchanged), got %v", result["displayName"])
	}
}

func TestUpdateMe_InvalidEnum(t *testing.T) {
	pool := testPool(t)
	srv, sessionStore := profileTestServer(t)
	defer srv.Close()

	userID := newUUID(t)
	email := fmt.Sprintf("updateme-enum-%s@example.com", userID[:8])
	seedActiveUser(t, pool, userID, "Enum User", email, "")

	rawToken := createLearnerSession(t, sessionStore, userID)

	body := map[string]string{"themeMode": "neon"}
	b, _ := json.Marshal(body)
	req, _ := http.NewRequest(http.MethodPut, srv.URL+"/api/auth/me", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400 for invalid enum, got %d", resp.StatusCode)
	}
}

func TestUpdateMe_DisplayNameTooLong(t *testing.T) {
	pool := testPool(t)
	srv, sessionStore := profileTestServer(t)
	defer srv.Close()

	userID := newUUID(t)
	email := fmt.Sprintf("updateme-long-%s@example.com", userID[:8])
	seedActiveUser(t, pool, userID, "Long User", email, "")

	rawToken := createLearnerSession(t, sessionStore, userID)

	longName := ""
	for i := 0; i < 121; i++ {
		longName += "a"
	}
	body := map[string]string{"displayName": longName}
	b, _ := json.Marshal(body)
	req, _ := http.NewRequest(http.MethodPut, srv.URL+"/api/auth/me", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400 for displayName too long, got %d", resp.StatusCode)
	}
}

func TestUpdateMe_UnknownField(t *testing.T) {
	pool := testPool(t)
	srv, sessionStore := profileTestServer(t)
	defer srv.Close()

	userID := newUUID(t)
	email := fmt.Sprintf("updateme-unknown-%s@example.com", userID[:8])
	seedActiveUser(t, pool, userID, "Unknown User", email, "")

	rawToken := createLearnerSession(t, sessionStore, userID)

	body := map[string]string{"nonExistentField": "value"}
	b, _ := json.Marshal(body)
	req, _ := http.NewRequest(http.MethodPut, srv.URL+"/api/auth/me", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400 for unknown field, got %d", resp.StatusCode)
	}
}

func TestUpdateMe_Unauthorized_NoCookie(t *testing.T) {
	srv, _ := profileTestServer(t)
	defer srv.Close()

	body := map[string]string{"displayName": "New Name"}
	b, _ := json.Marshal(body)
	req, _ := http.NewRequest(http.MethodPut, srv.URL+"/api/auth/me", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", resp.StatusCode)
	}
}

// Ensure imports are used.
var (
	_ = context.Background
	_ = authn.GetLearnerIdentity
)
