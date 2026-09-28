package authn

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

// mockSessionLookup implements SessionLookup for unit testing without a database.
type mockSessionLookup struct {
	learnerSess *session.LearnerSession
	learnerErr  error
	adminSess   *session.AdminSession
	adminErr    error
}

func (m *mockSessionLookup) LookupLearnerSession(_ context.Context, _ string) (*session.LearnerSession, error) {
	return m.learnerSess, m.learnerErr
}

func (m *mockSessionLookup) LookupAdminSession(_ context.Context, _ string) (*session.AdminSession, error) {
	return m.adminSess, m.adminErr
}

func testLogger() *slog.Logger {
	return slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelError}))
}

func TestLearnerGuard_MissingCookie_Returns401(t *testing.T) {
	cfg := DefaultGuardConfig(testLogger())
	handler := LearnerGuard(&mockSessionLookup{}, cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("handler should not be called for missing cookie")
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
	assertJSONError(t, w, "unauthorized")
}

func TestLearnerGuard_ValidSession_InjectsIdentity(t *testing.T) {
	store := &mockSessionLookup{
		learnerSess: &session.LearnerSession{
			ID:     "sess-123",
			UserID: "user-456",
		},
	}
	cfg := DefaultGuardConfig(testLogger())

	var gotIdentity LearnerIdentity
	var gotOK bool
	handler := LearnerGuard(store, cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotIdentity, gotOK = GetLearnerIdentity(r.Context())
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: "valid-token"})
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
	if !gotOK {
		t.Fatal("expected learner identity in context")
	}
	if gotIdentity.SessionID != "sess-123" {
		t.Errorf("SessionID = %q, want sess-123", gotIdentity.SessionID)
	}
	if gotIdentity.UserID != "user-456" {
		t.Errorf("UserID = %q, want user-456", gotIdentity.UserID)
	}
}

func TestLearnerGuard_SessionNotFound_Returns401(t *testing.T) {
	store := &mockSessionLookup{learnerErr: session.ErrSessionNotFound}
	cfg := DefaultGuardConfig(testLogger())
	handler := LearnerGuard(store, cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("handler should not be called for invalid session")
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: "expired-token"})
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
	assertJSONError(t, w, "unauthorized")
}

func TestLearnerGuard_InvalidToken_Returns401(t *testing.T) {
	store := &mockSessionLookup{learnerErr: session.ErrInvalidToken}
	cfg := DefaultGuardConfig(testLogger())
	handler := LearnerGuard(store, cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("handler should not be called for invalid token format")
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: "bad-format"})
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
	assertJSONError(t, w, "unauthorized")
}

func TestLearnerGuard_BackendError_Returns500(t *testing.T) {
	store := &mockSessionLookup{learnerErr: errors.New("database connection refused")}
	cfg := DefaultGuardConfig(testLogger())
	handler := LearnerGuard(store, cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("handler should not be called on backend error")
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: "some-token"})
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d", w.Code)
	}
	assertJSONError(t, w, "internal")
}

func TestAdminGuard_MissingCookie_Returns401(t *testing.T) {
	cfg := DefaultGuardConfig(testLogger())
	handler := AdminGuard(&mockSessionLookup{}, cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("handler should not be called for missing cookie")
	}))

	req := httptest.NewRequest(http.MethodGet, "/admin/test", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
	assertJSONError(t, w, "unauthorized")
}

func TestAdminGuard_ValidSession_InjectsIdentity(t *testing.T) {
	store := &mockSessionLookup{
		adminSess: &session.AdminSession{
			ID:      "asess-789",
			ActorID: "actor-abc",
		},
	}
	cfg := DefaultGuardConfig(testLogger())

	var gotIdentity AdminIdentity
	var gotOK bool
	handler := AdminGuard(store, cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotIdentity, gotOK = GetAdminIdentity(r.Context())
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/admin/test", nil)
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: "valid-admin-token"})
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
	if !gotOK {
		t.Fatal("expected admin identity in context")
	}
	if gotIdentity.SessionID != "asess-789" {
		t.Errorf("SessionID = %q, want asess-789", gotIdentity.SessionID)
	}
	if gotIdentity.ActorID != "actor-abc" {
		t.Errorf("ActorID = %q, want actor-abc", gotIdentity.ActorID)
	}
}

func TestAdminGuard_SessionNotFound_Returns401(t *testing.T) {
	store := &mockSessionLookup{adminErr: session.ErrSessionNotFound}
	cfg := DefaultGuardConfig(testLogger())
	handler := AdminGuard(store, cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("handler should not be called")
	}))

	req := httptest.NewRequest(http.MethodGet, "/admin/test", nil)
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: "expired-admin"})
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
	assertJSONError(t, w, "unauthorized")
}

func TestGuardNamespaceIsolation_DifferentCookieNames(t *testing.T) {
	cfg := DefaultGuardConfig(testLogger())
	store := &mockSessionLookup{}

	learnerCalled := false
	adminCalled := false

	learnerHandler := LearnerGuard(store, cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		learnerCalled = true
		w.WriteHeader(http.StatusOK)
	}))
	adminHandler := AdminGuard(store, cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		adminCalled = true
		w.WriteHeader(http.StatusOK)
	}))

	// Request with only admin cookie should fail learner guard
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: "admin-token"})
	w := httptest.NewRecorder()
	learnerHandler.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("learner guard should reject admin cookie; got %d", w.Code)
	}
	if learnerCalled {
		t.Error("learner handler should not be called with admin cookie")
	}

	// Request with only learner cookie should fail admin guard
	req2 := httptest.NewRequest(http.MethodGet, "/", nil)
	req2.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: "learner-token"})
	w2 := httptest.NewRecorder()
	adminHandler.ServeHTTP(w2, req2)
	if w2.Code != http.StatusUnauthorized {
		t.Errorf("admin guard should reject learner cookie; got %d", w2.Code)
	}
	if adminCalled {
		t.Error("admin handler should not be called with learner cookie")
	}
}

func TestGetLearnerIdentity_NotSet(t *testing.T) {
	_, ok := GetLearnerIdentity(context.Background())
	if ok {
		t.Error("expected no learner identity in empty context")
	}
}

func TestGetAdminIdentity_NotSet(t *testing.T) {
	_, ok := GetAdminIdentity(context.Background())
	if ok {
		t.Error("expected no admin identity in empty context")
	}
}

func TestDefaultGuardConfig_CookieNames(t *testing.T) {
	cfg := DefaultGuardConfig(testLogger())
	if cfg.LearnerCookieName != "bjt_web_session" {
		t.Errorf("expected bjt_web_session, got %s", cfg.LearnerCookieName)
	}
	if cfg.AdminCookieName != "bjt_admin_session" {
		t.Errorf("expected bjt_admin_session, got %s", cfg.AdminCookieName)
	}
}

func TestExtractCookie_Present(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.AddCookie(&http.Cookie{Name: "test_cookie", Value: "token-value"})
	got := extractCookie(req, "test_cookie")
	if got != "token-value" {
		t.Errorf("expected token-value, got %q", got)
	}
}

func TestExtractCookie_Missing(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	got := extractCookie(req, "nonexistent")
	if got != "" {
		t.Errorf("expected empty string for missing cookie, got %q", got)
	}
}

func TestExtractCookie_TrimmedWhitespace(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.AddCookie(&http.Cookie{Name: "ws", Value: "  spaced  "})
	got := extractCookie(req, "ws")
	if got != "spaced" {
		t.Errorf("expected trimmed value, got %q", got)
	}
}

func TestGuardResponse_ContentTypeJSON(t *testing.T) {
	cfg := DefaultGuardConfig(testLogger())
	handler := LearnerGuard(&mockSessionLookup{}, cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("should not reach handler")
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	ct := w.Header().Get("Content-Type")
	if ct != "application/json" {
		t.Errorf("expected Content-Type application/json, got %q", ct)
	}
}

func TestGuardResponse_NoRawTokenInBody(t *testing.T) {
	sentinelToken := "SUPER_SECRET_TOKEN_VALUE_12345"
	cfg := DefaultGuardConfig(testLogger())
	handler := LearnerGuard(&mockSessionLookup{learnerErr: session.ErrSessionNotFound}, cfg)(
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			t.Error("should not reach handler")
		}),
	)

	req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: sentinelToken})
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	body := w.Body.String()
	if len(body) > 0 && (len(sentinelToken) > 0) {
		// Verify token does not appear in response body
		for i := 0; i <= len(body)-len(sentinelToken); i++ {
			if body[i:i+len(sentinelToken)] == sentinelToken {
				t.Error("raw token must not appear in response body")
			}
		}
	}
}

// assertJSONError verifies the response is JSON with the expected error message.
func assertJSONError(t *testing.T, w *httptest.ResponseRecorder, wantMsg string) {
	t.Helper()
	ct := w.Header().Get("Content-Type")
	if ct != "application/json" {
		t.Errorf("expected Content-Type application/json, got %q", ct)
	}
	var resp map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to decode JSON error response: %v", err)
	}
	if resp["error"] != wantMsg {
		t.Errorf("expected error %q, got %q", wantMsg, resp["error"])
	}
}
