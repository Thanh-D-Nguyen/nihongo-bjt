package authn

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
)

func csrfTestLogger() *slog.Logger {
	return slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelError}))
}

func validCSRFConfig() CSRFConfig {
	return CSRFConfig{
		TrustedOrigins: []string{"https://app.example.com", "https://admin.example.com"},
		Logger:         csrfTestLogger(),
	}
}

func TestCSRFGuard_SafeMethodsPassThrough(t *testing.T) {
	cfg := validCSRFConfig()
	called := false
	handler := CSRFGuard(cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	}))

	for _, method := range []string{http.MethodGet, http.MethodHead, http.MethodOptions} {
		t.Run(method, func(t *testing.T) {
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
		})
	}
}

func TestCSRFGuard_UnsafeMethod_MissingOrigin_Returns403(t *testing.T) {
	cfg := validCSRFConfig()
	handler := CSRFGuard(cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("handler should not be called")
	}))

	for _, method := range []string{http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete} {
		t.Run(method, func(t *testing.T) {
			req := httptest.NewRequest(method, "/api/test", nil)
			w := httptest.NewRecorder()
			handler.ServeHTTP(w, req)
			if w.Code != http.StatusForbidden {
				t.Errorf("%s: expected 403, got %d", method, w.Code)
			}
			assertCSRFJSONError(t, w, "forbidden: missing origin")
		})
	}
}

func TestCSRFGuard_TrustedOrigin_PassesThrough(t *testing.T) {
	cfg := validCSRFConfig()
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

func TestCSRFGuard_UntrustedOrigin_Returns403(t *testing.T) {
	cfg := validCSRFConfig()
	handler := CSRFGuard(cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("handler should not be called")
	}))

	req := httptest.NewRequest(http.MethodPost, "/api/test", nil)
	req.Header.Set("Origin", "https://evil.example.com")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403 for untrusted origin, got %d", w.Code)
	}
	assertCSRFJSONError(t, w, "forbidden: untrusted origin")
}

func TestCSRFGuard_RefererFallback_TrustedHost(t *testing.T) {
	cfg := validCSRFConfig()
	called := false
	handler := CSRFGuard(cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodPost, "/api/test", nil)
	// No Origin header; Referer includes path but host matches
	req.Header.Set("Referer", "https://app.example.com/some/page?q=1")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200 for trusted referer host, got %d", w.Code)
	}
	if !called {
		t.Error("handler should be called for trusted referer")
	}
}

func TestCSRFGuard_RefererFallback_UntrustedHost(t *testing.T) {
	cfg := validCSRFConfig()
	handler := CSRFGuard(cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("handler should not be called")
	}))

	req := httptest.NewRequest(http.MethodPost, "/api/test", nil)
	req.Header.Set("Referer", "https://evil.example.com/page")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403 for untrusted referer, got %d", w.Code)
	}
}

func TestCSRFGuard_NullOrigin_Returns403(t *testing.T) {
	cfg := validCSRFConfig()
	handler := CSRFGuard(cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("handler should not be called")
	}))

	req := httptest.NewRequest(http.MethodPost, "/api/test", nil)
	req.Header.Set("Origin", "null")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403 for null origin, got %d", w.Code)
	}
}

func TestCSRFGuard_FileSchemeOrigin_Returns403(t *testing.T) {
	cfg := validCSRFConfig()
	handler := CSRFGuard(cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("handler should not be called")
	}))

	req := httptest.NewRequest(http.MethodPost, "/api/test", nil)
	req.Header.Set("Origin", "file:///etc/passwd")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403 for file:// origin, got %d", w.Code)
	}
}

func TestCSRFGuard_UserinfoInOrigin_Returns403(t *testing.T) {
	cfg := validCSRFConfig()
	handler := CSRFGuard(cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("handler should not be called")
	}))

	req := httptest.NewRequest(http.MethodPost, "/api/test", nil)
	req.Header.Set("Origin", "https://user:pass@app.example.com")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403 for origin with userinfo, got %d", w.Code)
	}
}

func TestCSRFGuard_LookalikeHost_Returns403(t *testing.T) {
	cfg := validCSRFConfig()
	handler := CSRFGuard(cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("handler should not be called")
	}))

	cases := []struct {
		name   string
		origin string
	}{
		{"subdomain_prefix", "https://app.example.com.evil.com"},
		{"missing_dot", "https://appexample.com"},
		{"different_tld", "https://app.example.org"},
		{"port_mismatch", "https://app.example.com:8080"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/api/test", nil)
			req.Header.Set("Origin", tc.origin)
			w := httptest.NewRecorder()
			handler.ServeHTTP(w, req)
			if w.Code != http.StatusForbidden {
				t.Errorf("expected 403 for lookalike %q, got %d", tc.origin, w.Code)
			}
		})
	}
}

func TestCSRFGuard_EmptyTrustedOrigins_RejectsAll(t *testing.T) {
	cfg := CSRFConfig{
		TrustedOrigins: []string{},
		Logger:         csrfTestLogger(),
	}
	handler := CSRFGuard(cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("handler should not be called with empty trusted list")
	}))

	req := httptest.NewRequest(http.MethodPost, "/api/test", nil)
	req.Header.Set("Origin", "https://app.example.com")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403 with empty trusted origins, got %d", w.Code)
	}
}

func TestCSRFGuard_InvalidConfigFailsClosed(t *testing.T) {
	cfg := CSRFConfig{TrustedOrigins: []string{"https://app.example.com/path"}, Logger: csrfTestLogger()}
	handler := CSRFGuard(cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("invalid config must not authorize request")
	}))
	req := httptest.NewRequest(http.MethodPost, "/api/test", nil)
	req.Header.Set("Origin", "https://app.example.com")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", w.Code)
	}
}

func TestValidateCSRFConfig_DoesNotEchoCredentials(t *testing.T) {
	err := ValidateCSRFConfig(CSRFConfig{TrustedOrigins: []string{"https://user:secret@app.example.com"}})
	if err == nil {
		t.Fatal("expected invalid config")
	}
	if strings.Contains(err.Error(), "secret") {
		t.Fatal("validation error exposed credentials")
	}
}

func TestCSRFGuard_OriginWithPathRejected(t *testing.T) {
	handler := CSRFGuard(validCSRFConfig())(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("path-bearing Origin must not authorize request")
	}))
	req := httptest.NewRequest(http.MethodPost, "/api/test", nil)
	req.Header.Set("Origin", "https://app.example.com/path")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", w.Code)
	}
}

func TestCSRFGuard_CaseInsensitiveOriginMatch(t *testing.T) {
	cfg := validCSRFConfig()
	called := false
	handler := CSRFGuard(cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodPost, "/api/test", nil)
	req.Header.Set("Origin", "HTTPS://APP.EXAMPLE.COM")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200 for case-insensitive match, got %d", w.Code)
	}
	if !called {
		t.Error("handler should be called for case-insensitive origin match")
	}
}

func TestValidateCSRFConfig_ValidEntries(t *testing.T) {
	cfg := validCSRFConfig()
	if err := ValidateCSRFConfig(cfg); err != nil {
		t.Errorf("valid config should pass validation: %v", err)
	}
}

func TestValidateCSRFConfig_MalformedEntries(t *testing.T) {
	cases := []struct {
		name    string
		origins []string
	}{
		{"invalid_url", []string{"://bad"}},
		{"ftp_scheme", []string{"ftp://app.example.com"}},
		{"missing_host", []string{"https://"}},
		{"with_userinfo", []string{"https://user:pass@app.example.com"}},
		{"with_path", []string{"https://app.example.com/path"}},
		{"with_query", []string{"https://app.example.com?q=1"}},
		{"with_fragment", []string{"https://app.example.com#frag"}},
		{"empty_string", []string{""}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			cfg := CSRFConfig{TrustedOrigins: tc.origins, Logger: csrfTestLogger()}
			err := ValidateCSRFConfig(cfg)
			if err == nil {
				t.Errorf("expected validation error for %v, got nil", tc.origins)
			}
		})
	}
}

func TestValidateCSRFConfig_EmptyListIsValid(t *testing.T) {
	cfg := CSRFConfig{TrustedOrigins: []string{}, Logger: csrfTestLogger()}
	if err := ValidateCSRFConfig(cfg); err != nil {
		t.Errorf("empty trusted origins should be valid (fail-closed): %v", err)
	}
}

func TestNormalizeOrigin_EdgeCases(t *testing.T) {
	cases := []struct {
		name  string
		input string
		want  string
	}{
		{"empty", "", ""},
		{"null_literal", "null", ""},
		{"whitespace_only", "   ", ""},
		{"no_scheme", "app.example.com", ""},
		{"data_scheme", "data:text/html,<h1>hi</h1>", ""},
		{"javascript_scheme", "javascript:alert(1)", ""},
		{"valid_https", "https://app.example.com", "https://app.example.com"},
		{"valid_http", "http://localhost:3000", "http://localhost:3000"},
		{"uppercase_normalized", "HTTPS://APP.EXAMPLE.COM", "https://app.example.com"},
		{"with_trailing_slash", "https://app.example.com/", "https://app.example.com"},
		{"userinfo_rejected", "https://user@app.example.com", ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := normalizeOrigin(tc.input)
			if got != tc.want {
				t.Errorf("normalizeOrigin(%q) = %q, want %q", tc.input, got, tc.want)
			}
		})
	}
}

func TestCSRFGuard_ResponseContentTypeJSON(t *testing.T) {
	cfg := validCSRFConfig()
	handler := CSRFGuard(cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("should not reach handler")
	}))

	req := httptest.NewRequest(http.MethodPost, "/api/test", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	ct := w.Header().Get("Content-Type")
	if ct != "application/json" {
		t.Errorf("expected Content-Type application/json, got %q", ct)
	}
}

func assertCSRFJSONError(t *testing.T, w *httptest.ResponseRecorder, wantMsg string) {
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
