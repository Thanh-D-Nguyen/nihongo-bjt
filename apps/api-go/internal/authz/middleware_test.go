package authz

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

// mockSessionLookup implements authn.SessionLookup for composed guard+RBAC tests.
type mockSessionLookup struct {
	adminSession *session.AdminSession
	adminErr     error
}

func (m *mockSessionLookup) LookupLearnerSession(_ context.Context, _ string) (*session.LearnerSession, error) {
	return nil, session.ErrSessionNotFound
}

func (m *mockSessionLookup) LookupAdminSession(_ context.Context, _ string) (*session.AdminSession, error) {
	return m.adminSession, m.adminErr
}

// mockLoader implements PrincipalLoader for unit testing without DB.
type mockLoader struct {
	principal *AdminPrincipal
	err       error
}

func (m *mockLoader) LoadPrincipal(_ context.Context, _ string) (*AdminPrincipal, error) {
	return m.principal, m.err
}

// composedHandler chains AdminGuard → RequirePermission → downstream handler.
func composedHandler(lookup authn.SessionLookup, loader PrincipalLoader, perm string) http.Handler {
	guard := authn.AdminGuard(lookup, authn.GuardConfig{AdminCookieName: "bjt_admin_session"})
	rbac := RequirePermission(loader, perm)
	downstream := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := GetPrincipal(r.Context())
		if p == nil {
			http.Error(w, "missing principal", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
	})
	return guard(rbac(downstream))
}

func TestComposed_AllowWithValidCookieAndPermission(t *testing.T) {
	lookup := &mockSessionLookup{adminSession: &session.AdminSession{
		ID:      "sess-1",
		ActorID: "actor-1",
	}}
	loader := &mockLoader{principal: &AdminPrincipal{
		ActorID:     "actor-1",
		DisplayName: "Test Admin",
		Permissions: map[string]bool{"admin.content.read": true},
	}}

	handler := composedHandler(lookup, loader, "admin.content.read")
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: "any-valid-token"})
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d; body=%s", w.Code, w.Body.String())
	}
}

func TestComposed_DenyMissingCookie(t *testing.T) {
	lookup := &mockSessionLookup{}
	loader := &mockLoader{principal: &AdminPrincipal{Permissions: map[string]bool{"admin.content.read": true}}}

	handler := composedHandler(lookup, loader, "admin.content.read")
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for missing cookie, got %d", w.Code)
	}
	if ct := w.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("Content-Type = %q, want application/json", ct)
	}
}

func TestComposed_DenyInvalidSession(t *testing.T) {
	lookup := &mockSessionLookup{adminErr: session.ErrSessionNotFound}
	loader := &mockLoader{principal: &AdminPrincipal{Permissions: map[string]bool{"admin.content.read": true}}}

	handler := composedHandler(lookup, loader, "admin.content.read")
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: "stale-token"})
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for invalid session, got %d", w.Code)
	}
}

func TestComposed_DenyInsufficientPermission(t *testing.T) {
	lookup := &mockSessionLookup{adminSession: &session.AdminSession{ID: "sess-2", ActorID: "actor-2"}}
	loader := &mockLoader{principal: &AdminPrincipal{
		ActorID:     "actor-2",
		Permissions: map[string]bool{"viewer.audit": true},
	}}

	handler := composedHandler(lookup, loader, "admin.content.write")
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: "valid-token"})
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403 for insufficient permission, got %d", w.Code)
	}
	body := w.Body.String()
	if strings.Contains(body, "admin.content.write") {
		t.Errorf("denial response leaks checked permission code: %s", body)
	}
}

func TestComposed_DenyInactiveActor(t *testing.T) {
	lookup := &mockSessionLookup{adminSession: &session.AdminSession{ID: "sess-3", ActorID: "disabled-actor"}}
	loader := &mockLoader{err: ErrActorNotActive}

	handler := composedHandler(lookup, loader, "admin.content.read")
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: "valid-token"})
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403 for inactive actor, got %d", w.Code)
	}
}

func TestComposed_BackendErrorReturns500(t *testing.T) {
	lookup := &mockSessionLookup{adminSession: &session.AdminSession{ID: "sess-4", ActorID: "actor-4"}}
	loader := &mockLoader{err: errors.New("database connection refused")}

	handler := composedHandler(lookup, loader, "admin.content.read")
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: "valid-token"})
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected 500 for backend error, got %d", w.Code)
	}
	body := w.Body.String()
	if strings.Contains(body, "connection refused") || strings.Contains(body, "database") {
		t.Errorf("response leaks internal error details: %s", body)
	}
}

func TestComposed_NilPrincipalReturns500(t *testing.T) {
	lookup := &mockSessionLookup{adminSession: &session.AdminSession{ID: "sess-5", ActorID: "actor-5"}}
	loader := &mockLoader{principal: nil, err: nil}

	handler := composedHandler(lookup, loader, "admin.content.read")
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: "valid-token"})
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected 500 for nil principal, got %d", w.Code)
	}
}

func TestRequireAnyPermission_ComposedAllowSecond(t *testing.T) {
	lookup := &mockSessionLookup{adminSession: &session.AdminSession{ID: "sess-6", ActorID: "actor-6"}}
	loader := &mockLoader{principal: &AdminPrincipal{
		ActorID:     "actor-6",
		Permissions: map[string]bool{"viewer.audit": true},
	}}

	guard := authn.AdminGuard(lookup, authn.GuardConfig{AdminCookieName: "bjt_admin_session"})
	rbac := RequireAnyPermission(loader, []string{"admin.content.write", "viewer.audit"})
	downstream := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	handler := guard(rbac(downstream))

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: "valid-token"})
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200 when one permission matches, got %d", w.Code)
	}
}

func TestRequireAnyPermission_ComposedDenyNone(t *testing.T) {
	lookup := &mockSessionLookup{adminSession: &session.AdminSession{ID: "sess-7", ActorID: "actor-7"}}
	loader := &mockLoader{principal: &AdminPrincipal{
		ActorID:     "actor-7",
		Permissions: map[string]bool{"viewer.audit": true},
	}}

	guard := authn.AdminGuard(lookup, authn.GuardConfig{AdminCookieName: "bjt_admin_session"})
	rbac := RequireAnyPermission(loader, []string{"admin.content.write", "growth.manage"})
	downstream := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("handler should not be called when no permissions match")
	})
	handler := guard(rbac(downstream))

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: "valid-token"})
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403, got %d", w.Code)
	}
}

func TestGetPrincipal_ReturnsNilWhenAbsent(t *testing.T) {
	ctx := context.Background()
	if p := GetPrincipal(ctx); p != nil {
		t.Errorf("expected nil principal from empty context, got %+v", p)
	}
}

// Ensure json import is used.
var _ = json.Unmarshal
