// Package authn provides CSRF defense for cookie-authenticated routes.
// This implementation uses strict Origin/Referer header validation against
// a configured allowlist of trusted origins. No token-based CSRF is implemented
// in this partial scaffold; routes are not yet mounted.
package authn

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
)

// CSRFConfig holds trusted origins and logger for CSRF validation.
type CSRFConfig struct {
	// TrustedOrigins is an explicit allowlist of scheme+host values
	// (e.g., "https://app.example.com"). Entries must be valid URLs
	// with http or https scheme and non-empty host. Path, query,
	// fragment, and userinfo are rejected at config load time.
	TrustedOrigins []string

	Logger *slog.Logger
}

// ValidateCSRFConfig checks that all trusted origins are well-formed.
// Returns an error if any entry is malformed. Fail-closed: empty list
// is valid but will reject all requests.
func ValidateCSRFConfig(cfg CSRFConfig) error {
	for i, raw := range cfg.TrustedOrigins {
		u, err := url.Parse(raw)
		if err != nil {
			return fmt.Errorf("csrf: trusted origin[%d] %q: invalid URL: %w", i, raw, err)
		}
		if u.Scheme != "http" && u.Scheme != "https" {
			return fmt.Errorf("csrf: trusted origin[%d] %q: scheme must be http or https, got %q", i, raw, u.Scheme)
		}
		if u.Host == "" {
			return fmt.Errorf("csrf: trusted origin[%d] %q: missing host", i, raw)
		}
		if u.User != nil {
			return fmt.Errorf("csrf: trusted origin[%d] %q: userinfo not allowed", i, raw)
		}
		if u.Path != "" && u.Path != "/" {
			return fmt.Errorf("csrf: trusted origin[%d] %q: path not allowed (got %q)", i, raw, u.Path)
		}
		if u.RawQuery != "" {
			return fmt.Errorf("csrf: trusted origin[%d] %q: query not allowed", i, raw)
		}
		if u.Fragment != "" {
			return fmt.Errorf("csrf: trusted origin[%d] %q: fragment not allowed", i, raw)
		}
	}
	return nil
}

// unsafeMethods are HTTP methods that require CSRF validation.
var unsafeMethods = map[string]bool{
	http.MethodPost:   true,
	http.MethodPut:    true,
	http.MethodPatch:  true,
	http.MethodDelete: true,
}

// CSRFGuard returns middleware that validates Origin/Referer headers on unsafe
// methods against the configured trusted origins. Safe methods (GET, HEAD,
// OPTIONS) pass through without CSRF checks. Returns 403 JSON on failure.
func CSRFGuard(cfg CSRFConfig) func(http.Handler) http.Handler {
	logger := cfg.Logger
	if logger == nil {
		logger = slog.Default()
	}

	// Pre-parse trusted origins into normalized scheme+host for fast comparison.
	trusted := make(map[string]bool, len(cfg.TrustedOrigins))
	for _, raw := range cfg.TrustedOrigins {
		u, err := url.Parse(raw)
		if err != nil {
			// Should not happen if ValidateCSRFConfig was called first.
			logger.Error("csrf: skipping malformed trusted origin", "origin", raw, "error", err)
			continue
		}
		key := strings.ToLower(u.Scheme) + "://" + strings.ToLower(u.Host)
		trusted[key] = true
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !unsafeMethods[r.Method] {
				next.ServeHTTP(w, r)
				return
			}

			origin := extractOrigin(r)
			if origin == "" {
				logger.Warn("csrf: missing Origin and Referer", "method", r.Method, "path", r.URL.Path)
				csrfJSONError(w, "forbidden: missing origin")
				return
			}

			if !trusted[origin] {
				logger.Warn("csrf: untrusted origin", "origin", origin, "method", r.Method, "path", r.URL.Path)
				csrfJSONError(w, "forbidden: untrusted origin")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// extractOrigin extracts and normalizes the request origin from Origin or
// Referer headers. Returns lowercase scheme://host or empty string.
// Rejects malformed URLs, userinfo, opaque origins ("null"), and file:// schemes.
func extractOrigin(r *http.Request) string {
	// Prefer Origin header (always scheme+host).
	if raw := r.Header.Get("Origin"); raw != "" {
		return normalizeOrigin(raw)
	}

	// Fall back to Referer (may include path; we extract scheme+host only).
	if raw := r.Header.Get("Referer"); raw != "" {
		return normalizeOrigin(raw)
	}

	return ""
}

// normalizeOrigin parses a raw origin/referer value and returns lowercase
// scheme://host. Returns empty string for any malformed or disallowed input.
func normalizeOrigin(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" || raw == "null" {
		return ""
	}

	u, err := url.Parse(raw)
	if err != nil {
		return ""
	}

	// Reject non-http(s) schemes (file://, data:, javascript:, etc.).
	if u.Scheme != "http" && u.Scheme != "https" {
		return ""
	}

	// Reject userinfo (credentials in URL).
	if u.User != nil {
		return ""
	}

	// Reject missing host.
	if u.Host == "" {
		return ""
	}

	// Reject opaque origins (no scheme parsed).
	if !strings.Contains(raw, "://") {
		return ""
	}

	return strings.ToLower(u.Scheme) + "://" + strings.ToLower(u.Host)
}

// csrfJSONError writes a 403 JSON response for CSRF failures.
func csrfJSONError(w http.ResponseWriter, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusForbidden)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
