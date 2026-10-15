package httpserver

import (
	"fmt"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/authz"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/credential"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/profile"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

func mustCIDRs(t *testing.T, values ...string) []*net.IPNet {
	t.Helper()
	out := make([]*net.IPNet, 0, len(values))
	for _, value := range values {
		_, network, err := net.ParseCIDR(value)
		if err != nil {
			t.Fatalf("parse CIDR %q: %v", value, err)
		}
		out = append(out, network)
	}
	return out
}

func TestClientIPMiddleware_TrustsForwardedAddressOnlyFromTrustedPeers(t *testing.T) {
	trusted := mustCIDRs(t, "172.16.0.0/12")
	cases := []struct {
		name, remote, forwarded, want string
	}{
		{"container proxy forwards visitor", "172.18.0.5:41000", "198.51.100.7", "198.51.100.7"},
		{"rightmost entry wins", "172.18.0.5:41000", "203.0.113.1, 198.51.100.8", "198.51.100.8"},
		{"public peer cannot spoof", "203.0.113.50:41000", "198.51.100.9", "203.0.113.50"},
		{"loopback stays trusted", "127.0.0.1:41000", "198.51.100.10", "198.51.100.10"},
		{"trusted peer without header", "172.18.0.5:41000", "", "172.18.0.5"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var got string
			handler := clientIPMiddleware(trusted)(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
				got = requestClientIP(r)
			}))
			req := httptest.NewRequest(http.MethodGet, "/", nil)
			req.RemoteAddr = tc.remote
			if tc.forwarded != "" {
				req.Header.Set("X-Forwarded-For", tc.forwarded)
			}
			handler.ServeHTTP(httptest.NewRecorder(), req)
			if got != tc.want {
				t.Fatalf("client IP = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestRequestClientIP_WithoutMiddlewareUsesLoopbackOnlyTrust(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.RemoteAddr = "172.18.0.5:41000"
	req.Header.Set("X-Forwarded-For", "198.51.100.7")
	if got := requestClientIP(req); got != "172.18.0.5" {
		t.Fatalf("non-loopback peer must not choose its identity, got %q", got)
	}
}

func buildLoginRouterBehindProxy(t *testing.T, limit int) http.Handler {
	t.Helper()
	pool := testPool(t)
	limiter, err := authn.NewRateLimiter(authn.RateLimiterConfig{
		Limit: limit, Window: time.Minute, TTL: 5 * time.Minute, MaxKeys: 1000, EvictEvery: 30 * time.Second,
	})
	if err != nil {
		t.Fatalf("create rate limiter: %v", err)
	}
	t.Cleanup(limiter.Stop)
	return NewRouter(Dependencies{
		Config: &config.Config{
			Port:              "4001",
			CORSOrigins:       []string{"https://app.example.com"},
			CookieSecure:      true,
			TrustedProxyCIDRs: mustCIDRs(t, "172.16.0.0/12"),
		},
		Logger:          testLogger(),
		SessionStore:    session.NewStore(pool),
		ProfileStore:    profile.NewStore(pool),
		RBACStore:       authz.NewStore(pool),
		CredentialStore: credential.NewStore(pool),
		RateLimiter:     limiter,
		Version:         "test",
	})
}

func postLoginFrom(router http.Handler, remote, forwarded string, attempt int) int {
	body := fmt.Sprintf(`{"email":"proxy-%d@example.com","password":"pass"}`, attempt)
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "https://app.example.com")
	req.RemoteAddr = remote
	if forwarded != "" {
		req.Header.Set("X-Forwarded-For", forwarded)
	}
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	return rec.Code
}

func TestLogin_BehindTrustedProxy_LimitsEachVisitorIndependently(t *testing.T) {
	router := buildLoginRouterBehindProxy(t, 2)
	const caddy = "172.18.0.5:41000"
	for i := 0; i < 2; i++ {
		if code := postLoginFrom(router, caddy, "198.51.100.1", i); code == http.StatusTooManyRequests {
			t.Fatalf("visitor A request %d limited too early", i+1)
		}
	}
	if code := postLoginFrom(router, caddy, "198.51.100.1", 2); code != http.StatusTooManyRequests {
		t.Fatalf("visitor A third request = %d, want 429", code)
	}
	// A second visitor through the same proxy container must not inherit A's bucket.
	if code := postLoginFrom(router, caddy, "198.51.100.2", 3); code == http.StatusTooManyRequests {
		t.Fatal("visitor B was limited by visitor A's bucket: every visitor shares the proxy address")
	}
}

func TestLogin_UntrustedPeerCannotRotateForwardedAddress(t *testing.T) {
	router := buildLoginRouterBehindProxy(t, 2)
	const attacker = "203.0.113.9:50000"
	for i := 0; i < 2; i++ {
		if code := postLoginFrom(router, attacker, fmt.Sprintf("198.51.100.%d", i+10), i); code == http.StatusTooManyRequests {
			t.Fatalf("request %d limited too early", i+1)
		}
	}
	if code := postLoginFrom(router, attacker, "198.51.100.99", 2); code != http.StatusTooManyRequests {
		t.Fatalf("rotating X-Forwarded-For from a public peer evaded the limiter: got %d", code)
	}
}
