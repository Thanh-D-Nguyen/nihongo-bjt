package httpserver

import (
	"context"
	"net"
	"net/http"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
)

type clientIPContextKey struct{}

// clientIPMiddleware resolves the visitor address once per request. The
// X-Forwarded-For chain is honoured only when the direct peer is loopback or
// belongs to the explicitly configured trusted proxy CIDRs; any other peer
// cannot choose its own rate-limit identity.
func clientIPMiddleware(trustedProxyCIDRs []*net.IPNet) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := authn.NormalizeClientIP(r.RemoteAddr, r.Header.Get("X-Forwarded-For"), trustedProxyCIDRs)
			next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), clientIPContextKey{}, ip)))
		})
	}
}

// requestClientIP is the single source of IP-keyed limiter identities. Handlers
// served without the router middleware fall back to loopback-only trust.
func requestClientIP(r *http.Request) string {
	if ip, ok := r.Context().Value(clientIPContextKey{}).(string); ok && ip != "" {
		return ip
	}
	return authn.NormalizeClientIP(r.RemoteAddr, r.Header.Get("X-Forwarded-For"))
}
