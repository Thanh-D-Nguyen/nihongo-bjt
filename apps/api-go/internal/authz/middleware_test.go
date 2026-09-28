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
)

// mockLoader implements PrincipalLoader for unit testing without DB.
type mockLoader struct {
	principal *AdminPrincipal
	err       error
}

func (m *mockLoader) LoadPrincipal(_ context.Context, _ string) (*AdminPrincipal, error) {
	return m.principal, m.err
}

func TestRequirePermission_Allow(t *testing.T) {
	loader := &mockLoader{principal: &AdminPrincipal{
		ActorID:     "actor-1",
		DisplayName: "Test Admin",
		Permissions: map[string]bool{"admin.content.read": true},
	}}
	handler := RequirePermission(loader, "admin.content.read")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := GetPrincipal(r.Context())
		if p == nil {
			t.Fatal("expected principal in context")
		}
		if p.ActorID != "actor-1" {
			t.Errorf("ActorID = %q, want actor-1", p.ActorID)
		}
		w.WriteHeader(http.StatusOK)
	}))
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req = authn.WithAdminIdentity(req, "actor-1", "sess-1")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestRequirePermission_DenyMissingPermission(t *testing.T) {
	loader := &mockLoader{principal: &AdminPrincipal{
		ActorID:     "actor-1",
		Permissions: map[string]bool{"admin.content.read": true},
	}}
	handler := RequirePermission(loader, "admin.content.write")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("handler should not be called on deny")
	}))
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req = authn.WithAdminIdentity(req, "actor-1", "sess-1")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403, got %d", w.Code)
	}
	if ct := w.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("Content-Type = %q, want application/json", ct)
	}
	var body map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode JSON body: %v", err)
	}
	if body["error"] == "" {
		t.Error("expected non-empty error message")
	}
}

func TestRequirePermission_WildcardGrantsAll(t *testing.T) {
	loader := &mockLoader{principal: &AdminPrincipal{
		ActorID:     "super-1",
		Permissions: map[string]bool{"*": true},
	}}
	handler := RequirePermission(loader, "any.permission.code")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req = authn.WithAdminIdentity(req, "super-1", "sess-super")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("wildcard should grant any permission; expected 200, got %d", w.Code)
	}
}

func TestRequirePermission_MissingIdentity(t *testing.T) {
	loader := &mockLoader{}
	handler := RequirePermission(loader, "admin.content.read")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("handler should not be called without identity")
	}))
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	// No identity injected
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
	if ct := w.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("Content-Type = %q, want application/json", ct)
	}
}

func TestRequirePermission_InactiveActor(t *testing.T) {
	loader := &mockLoader{err: ErrActorNotActive}
	handler := RequirePermission(loader, "admin.content.read")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("handler should not be called for inactive actor")
	}))
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req = authn.WithAdminIdentity(req, "disabled-actor", "sess-dis")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403 for inactive actor, got %d", w.Code)
	}
}

func TestRequirePermission_BackendError(t *testing.T) {
	loader := &mockLoader{err: errors.New("database connection refused")}
	handler := RequirePermission(loader, "admin.content.read")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("handler should not be called on backend error")
	}))
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req = authn.WithAdminIdentity(req, "actor-1", "sess-1")
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

func TestRequireAnyPermission_AllowSecond(t *testing.T) {
	loader := &mockLoader{principal: &AdminPrincipal{
		ActorID:     "actor-2",
		Permissions: map[string]bool{"viewer.audit": true},
	}}
	handler := RequireAnyPermission(loader, []string{"admin.content.write", "viewer.audit"})(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req = authn.WithAdminIdentity(req, "actor-2", "sess-2")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200 when one permission matches, got %d", w.Code)
	}
}

func TestRequireAnyPermission_DenyNone(t *testing.T) {
	loader := &mockLoader{principal: &AdminPrincipal{
		ActorID:     "actor-3",
		Permissions: map[string]bool{"viewer.audit": true},
	}}
	handler := RequireAnyPermission(loader, []string{"admin.content.write", "growth.manage"})(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("handler should not be called when no permissions match")
	}))
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req = authn.WithAdminIdentity(req, "actor-3", "sess-3")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403, got %d", w.Code)
	}
}
