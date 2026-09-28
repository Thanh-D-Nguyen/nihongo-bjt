// Package authn provides CSRF defense for cookie-authenticated routes.
package authn

import (
	"log/slog"
	"net/http"
	"strings"
)

// CSRFConfig holds trusted origins and logger for CSRF validation.
type CSRFConfig struct {
	// TrustedOrigins is the explicit allowlist of request origins.
	// In production this MUST be non-empty; empty list rejects all unsafe requests.
	TrustedOrigins []string
	Logger         *slog.Logger
}

// UnsafeMethods are HTTP methods that mutate state and require CSRF protection.
var unsafeMethods = map[string]bool{
	http.MethodPost:   true,
	http.MethodPut:    true,
	http.MethodPatch:  true,
	http.MethodDelete: true,
}

// CSRFGuard returns middleware that validates Origin/Referer headers on unsafe methods
// for cookie-authenticated routes. Safe methods (GET, HEAD, OPTIONS) pass through.
// Fails closed: if no trusted origins are configured, all unsafe requests are rejected.
func CSRFGuard(cfg CSRFConfig) func(http.Handler) http.Handler {
	logger := cfg.Logger
	if logger == nil {
		logger = slog.Default()
	}
	// Build normalized origin set for O(1) lookup.
	trusted := make(map[string]bool, len(cfg.TrustedOrigins))
	for _, o := range cfg.TrustedOrigins {
		trusted[strings.TrimRight(o, "/")] = true
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !unsafeMethods[r.Method] {
				next.ServeHTTP(w, r)
				return
			}

			origin := extractOrigin(r)
			if origin == "" {
				logger.Warn("csrf: missing origin on unsafe request",
					"method", r.Method, "path", r.URL.Path)
				http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
				return
			}

			if !trusted[origin] {
				logger.Warn("csrf: untrusted origin",
					"origin", origin, "method", r.Method, "path", r.URL.Path)
				http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// extractOrigin returns the validated origin from the request.
// Prefers Origin header; falls back to Referer for older clients.
// Returns empty string if neither is present or parseable.
func extractOrigin(r *http.Request) string {
	if o := r.Header.Get("Origin"); o != "" {
		return strings.TrimRight(o, "/")
	}
	if ref := r.Header.Get("Referer"); ref != "" {
		// Extract scheme+host from Referer URL.
		if idx := strings.Index(ref, "://"); idx >= 0 {
			rest := ref[idx+3:]
			if slash := strings.IndexByte(rest, '/'); slash >= 0 {
				return ref[:idx+3+slash]
			}
			return ref
		}
	}
	return ""
}
