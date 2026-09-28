package authn

import (
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
)

func testCSRFLogger() *slog.Logger {
	return slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelError}))
}

func TestCSRFGuard_SafeMethodsPassThrough(t *testing.T) {
	cfg := CSRFConfig{
		TrustedOrigins: []string{"https://app.example.com"},
		Logger:         testCSRFLogger(),
	}
	called := false
	handler := CSRFGuard(cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	}))

	for _, method := range []string{http.MethodGet, http.MethodHead, http.MethodOptions} {
		called = false
		req := httptest.NewRequest(method, "/api/test", nil)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Errorf("%s: expected 200, got %d", method, w.Code)
		}
		if !called {
			t.Errorf("%s: handler should be called for safe method", method)
		}
	}
}

func TestCSRFGuard_UnsafeMethod_MissingOrigin_Returns403(t *testing.T) {
	cfg := CSRFConfig{
		TrustedOrigins: []string{"https://app.example.com"},
		Logger:         testCSRFLogger(),
	}
	handler := CSRFGuard(cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("handler should not be called for missing origin on unsafe method")
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodPost, "/api/test", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403 for missing origin, got %d", w.Code)
	}
}

func TestCSRFGuard_UnsafeMethod_UntrustedOrigin_Returns403(t *testing.T) {
	cfg := CSRFConfig{
		TrustedOrigins: []string{"https://app.example.com"},
		Logger:         testCSRFLogger(),
	}
	handler := CSRFGuard(cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("handler should not be called for untrusted origin")
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodPost, "/api/test", nil)
	req.Header.Set("Origin", "https://evil.example.com")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403 for untrusted origin, got %d", w.Code)
	}
}

func TestCSRFGuard_UnsafeMethod_TrustedOrigin_PassesThrough(t *testing.T) {
	cfg := CSRFConfig{
		TrustedOrigins: []string{"https://app.example.com"},
		Logger:         testCSRFLogger(),
	}
	called := false
	handler := CSRFGuard(cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodPost, "/api/test", nil)
	req.Header.Set("Origin", "https://app.example.com")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200 for trusted origin, got %d", w.Code)
	}
	if !called {
		t.Error("handler should be called for trusted origin")
	}
}

func TestCSRFGuard_EmptyTrustedOrigins_RejectsAllUnsafe(t *testing.T) {
	cfg := CSRFConfig{
		TrustedOrigins: []string{}, // fail closed
		Logger:         testCSRFLogger(),
	}
	handler := CSRFGuard(cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("handler should not be called when no trusted origins configured")
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodPost, "/api/test", nil)
	req.Header.Set("Origin", "https://app.example.com")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403 with empty trusted origins, got %d", w.Code)
	}
}

func TestCSRFGuard_RefererFallback(t *testing.T) {
	cfg := CSRFConfig{
		TrustedOrigins: []string{"https://app.example.com"},
		Logger:         testCSRFLogger(),
	}
	called := false
	handler := CSRFGuard(cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	}))

	// No Origin header, but Referer matches trusted origin
	req := httptest.NewRequest(http.MethodPut, "/api/test", nil)
	req.Header.Set("Referer", "https://app.example.com/some/page?q=1")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200 via Referer fallback, got %d", w.Code)
	}
	if !called {
		t.Error("handler should be called when Referer matches trusted origin")
	}
}

func TestCSRFGuard_RefererFallback_Untrusted(t *testing.T) {
	cfg := CSRFConfig{
		TrustedOrigins: []string{"https://app.example.com"},
		Logger:         testCSRFLogger(),
	}
	handler := CSRFGuard(cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("handler should not be called for untrusted Referer")
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodDelete, "/api/test", nil)
	req.Header.Set("Referer", "https://evil.example.com/attack")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403 for untrusted Referer, got %d", w.Code)
	}
}

func TestCSRFGuard_TrailingSlashNormalization(t *testing.T) {
	cfg := CSRFConfig{
		TrustedOrigins: []string{"https://app.example.com/"}, // trailing slash in config
		Logger:         testCSRFLogger(),
	}
	called := false
	handler := CSRFGuard(cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodPatch, "/api/test", nil)
	req.Header.Set("Origin", "https://app.example.com") // no trailing slash in request
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200 with normalized trailing slash, got %d", w.Code)
	}
	if !called {
		t.Error("handler should be called after trailing slash normalization")
	}
}

func TestExtractOrigin_PrefersOriginOverReferer(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/", nil)
	req.Header.Set("Origin", "https://origin.example.com")
	req.Header.Set("Referer", "https://referer.example.com/page")

	got := extractOrigin(req)
	if got != "https://origin.example.com" {
		t.Errorf("expected Origin header to take precedence, got %q", got)
	}
}

func TestExtractOrigin_NeitherPresent(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/", nil)
	got := extractOrigin(req)
	if got != "" {
		t.Errorf("expected empty string when neither Origin nor Referer present, got %q", got)
	}
}
