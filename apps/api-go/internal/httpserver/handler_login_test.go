package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
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

// buildLoginRouter creates a router with login routes wired to real stores
// backed by the test DB, plus a rate limiter for login abuse protection.
func buildLoginRouter(t *testing.T, trustedOrigins []string) http.Handler {
	t.Helper()
	pool := testPool(t)
	logger := testLogger()
	rateLimiter, err := authn.NewRateLimiter(authn.RateLimiterConfig{
		Limit:      5,
		Window:     time.Minute,
		TTL:        5 * time.Minute,
		MaxKeys:    100,
		EvictEvery: 30 * time.Second,
	})
	if err != nil {
		t.Fatalf("create rate limiter: %v", err)
	}
	t.Cleanup(rateLimiter.Stop)
	deps := Dependencies{
		Config: &config.Config{
			Port:        "4001",
			CORSOrigins: trustedOrigins,
		},
		Logger:          logger,
		SessionStore:    session.NewStore(pool),
		ProfileStore:    profile.NewStore(pool),
		RBACStore:       authz.NewStore(pool),
		CredentialStore: credential.NewStore(pool),
		RateLimiter:     rateLimiter,
		Version:         "test",
	}
	return NewRouter(deps)
}

// buildLoginRouterWithLimiter creates a router with a custom rate limiter config.
func buildLoginRouterWithLimiter(t *testing.T, trustedOrigins []string, limit, maxKeys int) (http.Handler, *authn.RateLimiter) {
	t.Helper()
	pool := testPool(t)
	logger := testLogger()
	rateLimiter, err := authn.NewRateLimiter(authn.RateLimiterConfig{
		Limit:      limit,
		Window:     time.Minute,
		TTL:        5 * time.Minute,
		MaxKeys:    maxKeys,
		EvictEvery: 30 * time.Second,
	})
	if err != nil {
		t.Fatalf("create rate limiter: %v", err)
	}
	t.Cleanup(rateLimiter.Stop)
	deps := Dependencies{
		Config: &config.Config{
			Port:        "4001",
			CORSOrigins: trustedOrigins,
		},
		Logger:          logger,
		SessionStore:    session.NewStore(pool),
		ProfileStore:    profile.NewStore(pool),
		RBACStore:       authz.NewStore(pool),
		CredentialStore: credential.NewStore(pool),
		RateLimiter:     rateLimiter,
		Version:         "test",
	}
	return NewRouter(deps), rateLimiter
}

// buildLoginRouterNoLimiter creates a router without a rate limiter to test fail-closed.
func buildLoginRouterNoLimiter(t *testing.T, trustedOrigins []string) http.Handler {
	t.Helper()
	pool := testPool(t)
	logger := testLogger()
	deps := Dependencies{
		Config: &config.Config{
			Port:        "4001",
			CORSOrigins: trustedOrigins,
		},
		Logger:          logger,
		SessionStore:    session.NewStore(pool),
		ProfileStore:    profile.NewStore(pool),
		RBACStore:       authz.NewStore(pool),
		CredentialStore: credential.NewStore(pool),
		RateLimiter:     nil, // intentionally nil
		Version:         "test",
	}
	return NewRouter(deps)
}

// seedLearnerCred inserts an Argon2id credential for the given learner.
func seedLearnerCred(t *testing.T, userID, password string) {
	t.Helper()
	pool := testPool(t)
	store := credential.NewStore(pool)
	if err := store.SetLearnerCredential(context.Background(), userID, []byte(password)); err != nil {
		t.Fatalf("seed learner credential: %v", err)
	}
}

// seedAdminCred inserts an Argon2id credential for the given admin actor.
func seedAdminCred(t *testing.T, actorID, password string) {
	t.Helper()
	pool := testPool(t)
	store := credential.NewStore(pool)
	if err := store.SetAdminCredential(context.Background(), actorID, []byte(password)); err != nil {
		t.Fatalf("seed admin credential: %v", err)
	}
}

// --- Learner Login Tests ---

func TestLearnerLogin_Success_SetsSecureCookie(t *testing.T) {
	db := testPool(t)
	router := buildLoginRouter(t, []string{"https://app.example.com"})

	userID := newUUID(t)
	email := fmt.Sprintf("login-success-%s@example.com", userID[:8])
	password := "correct-horse-battery-staple"
	seedActiveUser(t, db, userID, "Login User", email, "")
	seedLearnerCred(t, userID, password)

	body := fmt.Sprintf(`{"email":"%s","password":"%s"}`, email, password)
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "https://app.example.com")
	req.RemoteAddr = "192.168.1.1:54321"
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d; body: %s", w.Code, w.Body.String())
	}

	var resp map[string]bool
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !resp["ok"] {
		t.Error("expected ok:true")
	}

	// Verify cookie attributes.
	cookies := w.Result().Cookies()
	var found bool
	for _, c := range cookies {
		if c.Name == learnerCookieName {
			found = true
			if !c.HttpOnly {
				t.Error("cookie must be HttpOnly")
			}
			if !c.Secure {
				t.Error("cookie must be Secure")
			}
			if c.SameSite != http.SameSiteLaxMode {
				t.Errorf("cookie SameSite = %v, want Lax", c.SameSite)
			}
			if c.Path != "/" {
				t.Errorf("cookie Path = %q, want /", c.Path)
			}
			if c.Value == "" {
				t.Error("cookie value must not be empty")
			}
			// Verify session exists in DB.
			sessStore := session.NewStore(db)
			sess, err := sessStore.LookupLearnerSession(context.Background(), c.Value)
			if err != nil {
				t.Fatalf("session lookup failed: %v", err)
			}
			if sess.UserID != userID {
				t.Errorf("session UserID = %q, want %q", sess.UserID, userID)
			}
		}
	}
	if !found {
		t.Fatal("Set-Cookie for bjt_web_session not found")
	}
}

func TestLearnerLogin_WrongPassword_Generic401(t *testing.T) {
	db := testPool(t)
	router := buildLoginRouter(t, []string{"https://app.example.com"})

	userID := newUUID(t)
	email := fmt.Sprintf("wrong-pw-%s@example.com", userID[:8])
	seedActiveUser(t, db, userID, "Wrong PW", email, "")
	seedLearnerCred(t, userID, "correct-password")

	body := fmt.Sprintf(`{"email":"%s","password":"wrong-password"}`, email)
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "https://app.example.com")
	req.RemoteAddr = "10.0.0.1:12345"
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d; body: %s", w.Code, w.Body.String())
	}
	var resp map[string]string
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["error"] != "invalid credentials" {
		t.Errorf("error = %q, want 'invalid credentials'", resp["error"])
	}
}

func TestLearnerLogin_UnknownEmail_Generic401(t *testing.T) {
	router := buildLoginRouter(t, []string{"https://app.example.com"})

	body := `{"email":"nonexistent@example.com","password":"any-password"}`
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "https://app.example.com")
	req.RemoteAddr = "10.0.0.2:12345"
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for unknown email, got %d", w.Code)
	}
}

func TestLearnerLogin_DisabledUser_Generic401(t *testing.T) {
	db := testPool(t)
	router := buildLoginRouter(t, []string{"https://app.example.com"})

	userID := newUUID(t)
	email := fmt.Sprintf("disabled-login-%s@example.com", userID[:8])
	seedDisabledUser(t, db, userID)
	// Update email to match what we'll send.
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	db.Exec(ctx, `UPDATE profile.user_profile SET email = $1 WHERE id = $2`, email, userID)

	body := fmt.Sprintf(`{"email":"%s","password":"any-password"}`, email)
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "https://app.example.com")
	req.RemoteAddr = "10.0.0.3:12345"
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for disabled user, got %d", w.Code)
	}
}

func TestLearnerLogin_MissingCredential_Generic401(t *testing.T) {
	db := testPool(t)
	router := buildLoginRouter(t, []string{"https://app.example.com"})

	userID := newUUID(t)
	email := fmt.Sprintf("no-cred-%s@example.com", userID[:8])
	seedActiveUser(t, db, userID, "No Cred", email, "")
	// Do NOT seed a credential.

	body := fmt.Sprintf(`{"email":"%s","password":"any-password"}`, email)
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "https://app.example.com")
	req.RemoteAddr = "10.0.0.4:12345"
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for missing credential, got %d", w.Code)
	}
}

func TestLearnerLogin_EmptyFields_401(t *testing.T) {
	router := buildLoginRouter(t, []string{"https://app.example.com"})

	cases := []struct {
		name string
		body string
	}{
		{"empty email", `{"email":"","password":"pass"}`},
		{"empty password", `{"email":"a@b.com","password":""}`},
		{"both empty", `{"email":"","password":""}`},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(tc.body))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Origin", "https://app.example.com")
			req.RemoteAddr = "10.0.0.5:12345"
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)
			if w.Code != http.StatusUnauthorized {
				t.Errorf("expected 401, got %d", w.Code)
			}
		})
	}
}

func TestLearnerLogin_OversizedBody_413(t *testing.T) {
	router := buildLoginRouter(t, []string{"https://app.example.com"})

	bigBody := `{"email":"a@b.com","password":"` + strings.Repeat("x", maxLoginBodyBytes+1) + `"}`
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(bigBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "https://app.example.com")
	req.RemoteAddr = "10.0.0.6:12345"
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusRequestEntityTooLarge {
		t.Errorf("expected 413, got %d", w.Code)
	}
}

func TestLearnerLogin_TrailingJSON_400(t *testing.T) {
	router := buildLoginRouter(t, []string{"https://app.example.com"})

	body := `{"email":"a@b.com","password":"pass"}{"extra":true}`
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "https://app.example.com")
	req.RemoteAddr = "10.0.0.7:12345"
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for trailing JSON, got %d", w.Code)
	}
}

func TestLearnerLogin_WrongContentType_400(t *testing.T) {
	router := buildLoginRouter(t, []string{"https://app.example.com"})

	body := `{"email":"a@b.com","password":"pass"}`
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(body))
	req.Header.Set("Content-Type", "text/plain")
	req.Header.Set("Origin", "https://app.example.com")
	req.RemoteAddr = "10.0.0.8:12345"
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for wrong content type, got %d", w.Code)
	}
}

func TestLearnerLogin_CSRF_MissingOrigin_403(t *testing.T) {
	router := buildLoginRouter(t, []string{"https://app.example.com"})

	body := `{"email":"a@b.com","password":"pass"}`
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	// No Origin or Referer header.
	req.RemoteAddr = "10.0.0.9:12345"
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403 for missing CSRF origin, got %d; body: %s", w.Code, w.Body.String())
	}
}

func TestLearnerLogin_CSRF_UntrustedOrigin_403(t *testing.T) {
	router := buildLoginRouter(t, []string{"https://app.example.com"})

	body := `{"email":"a@b.com","password":"pass"}`
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "https://evil.attacker.com")
	req.RemoteAddr = "10.0.0.10:12345"
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403 for untrusted origin, got %d", w.Code)
	}
}

func TestLearnerLogin_LimiterNil_FailClosed503(t *testing.T) {
	router := buildLoginRouterNoLimiter(t, []string{"https://app.example.com"})

	body := `{"email":"a@b.com","password":"pass"}`
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "https://app.example.com")
	req.RemoteAddr = "10.0.0.11:12345"
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected 503 when limiter is nil, got %d; body: %s", w.Code, w.Body.String())
	}
}

func TestLearnerLogin_IPRateLimit_429(t *testing.T) {
	// Limit=3 per minute for testing.
	router, _ := buildLoginRouterWithLimiter(t, []string{"https://app.example.com"}, 3, 100)

	remoteAddr := "172.16.0.1:9999"
	for i := 0; i < 3; i++ {
		body := `{"email":"ratelimit@example.com","password":"pass"}`
		req := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Origin", "https://app.example.com")
		req.RemoteAddr = remoteAddr
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		if w.Code == http.StatusTooManyRequests {
			t.Fatalf("request %d should not be rate limited yet", i+1)
		}
	}

	// 4th request from same IP must be 429.
	body := `{"email":"ratelimit@example.com","password":"pass"}`
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "https://app.example.com")
	req.RemoteAddr = remoteAddr
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusTooManyRequests {
		t.Errorf("expected 429 after exceeding IP limit, got %d", w.Code)
	}
}

func TestLearnerLogin_SameIPDifferentPorts_ShareBucket(t *testing.T) {
	router, _ := buildLoginRouterWithLimiter(t, []string{"https://app.example.com"}, 2, 100)

	// Two requests from same IP but different ports.
	for i, port := range []string{"40001", "40002"} {
		body := `{"email":"port-share@example.com","password":"pass"}`
		req := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Origin", "https://app.example.com")
		req.RemoteAddr = "10.10.10.10:" + port
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		if w.Code == http.StatusTooManyRequests {
			t.Fatalf("request %d (port %s) should not be limited yet", i+1, port)
		}
	}

	// 3rd request from same IP (yet another port) must be 429.
	body := `{"email":"port-share@example.com","password":"pass"}`
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "https://app.example.com")
	req.RemoteAddr = "10.10.10.10:60000"
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusTooManyRequests {
		t.Errorf("expected 429 — different ports must share IP bucket, got %d", w.Code)
	}
}

func TestLearnerLogin_ForgedXForwardedFor_Ignored(t *testing.T) {
	router, _ := buildLoginRouterWithLimiter(t, []string{"https://app.example.com"}, 2, 100)

	realAddr := "10.20.30.40:55555"
	for i := 0; i < 2; i++ {
		body := `{"email":"spoof@example.com","password":"pass"}`
		req := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Origin", "https://app.example.com")
		req.RemoteAddr = realAddr
		req.Header.Set("X-Forwarded-For", "1.2.3.4")
		req.Header.Set("X-Real-IP", "5.6.7.8")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		if w.Code == http.StatusTooManyRequests {
			t.Fatalf("request %d should not be limited yet", i+1)
		}
	}

	// 3rd request with SAME real RemoteAddr but DIFFERENT spoofed headers must still be 429.
	body := `{"email":"spoof@example.com","password":"pass"}`
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "https://app.example.com")
	req.RemoteAddr = realAddr
	req.Header.Set("X-Forwarded-For", "99.99.99.99")
	req.Header.Set("X-Real-IP", "88.88.88.88")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusTooManyRequests {
		t.Errorf("expected 429 — forged headers must not bypass IP limit, got %d", w.Code)
	}
}

func TestLearnerLogin_FullMap_429(t *testing.T) {
	// Each login request consumes TWO rate-limit keys: one IP key and one
	// account key (SHA-256 prefix of normalized email). With MaxKeys=4,
	// two requests from distinct IPs with distinct emails consume all 4
	// slots (2 IPs × 1 + 2 accounts × 1 = 4). The third request with a
	// new IP AND new account key must fail closed with 429.
	router, _ := buildLoginRouterWithLimiter(t, []string{"https://app.example.com"}, 100, 4)

	// Fill: 2 distinct IPs × 2 distinct emails = 4 keys consumed.
	fillEmails := []string{"fill1@example.com", "fill2@example.com"}
	for i, email := range fillEmails {
		body := fmt.Sprintf(`{"email":"%s","password":"pass"}`, email)
		req := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Origin", "https://app.example.com")
		req.RemoteAddr = fmt.Sprintf("10.99.0.%d:12345", i+1)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		if w.Code == http.StatusTooManyRequests {
			t.Fatalf("fill request %d (ip=10.99.0.%d, email=%s) should succeed", i+1, i+1, email)
		}
	}

	// 3rd request with new IP + new email must be rejected (map full).
	body := `{"email":"overflow@example.com","password":"pass"}`
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "https://app.example.com")
	req.RemoteAddr = "10.99.0.99:12345"
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusTooManyRequests {
		t.Errorf("expected 429 when map is full (dual-key), got %d", w.Code)
	}
}

func TestLearnerLogin_NewTokenOnEachLogin_FixationPrevention(t *testing.T) {
	db := testPool(t)
	router := buildLoginRouter(t, []string{"https://app.example.com"})

	userID := newUUID(t)
	email := fmt.Sprintf("fixation-%s@example.com", userID[:8])
	password := "secure-password-123"
	seedActiveUser(t, db, userID, "Fixation User", email, "")
	seedLearnerCred(t, userID, password)

	body := fmt.Sprintf(`{"email":"%s","password":"%s"}`, email, password)

	// First login.
	req1 := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(body))
	req1.Header.Set("Content-Type", "application/json")
	req1.Header.Set("Origin", "https://app.example.com")
	req1.RemoteAddr = "10.0.1.1:12345"
	w1 := httptest.NewRecorder()
	router.ServeHTTP(w1, req1)
	if w1.Code != http.StatusOK {
		t.Fatalf("first login: expected 200, got %d", w1.Code)
	}
	var token1 string
	for _, c := range w1.Result().Cookies() {
		if c.Name == learnerCookieName {
			token1 = c.Value
		}
	}

	// Second login — must produce a DIFFERENT token.
	req2 := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(body))
	req2.Header.Set("Content-Type", "application/json")
	req2.Header.Set("Origin", "https://app.example.com")
	req2.RemoteAddr = "10.0.1.1:12346"
	w2 := httptest.NewRecorder()
	router.ServeHTTP(w2, req2)
	if w2.Code != http.StatusOK {
		t.Fatalf("second login: expected 200, got %d", w2.Code)
	}
	var token2 string
	for _, c := range w2.Result().Cookies() {
		if c.Name == learnerCookieName {
			token2 = c.Value
		}
	}

	if token1 == token2 {
		t.Fatal("each login must produce a new token to prevent session fixation")
	}
	if token1 == "" || token2 == "" {
		t.Fatal("both tokens must be non-empty")
	}
}

// --- Admin Login Tests ---

func TestAdminLogin_Success_SetsSecureCookie(t *testing.T) {
	db := testPool(t)
	router := buildLoginRouter(t, []string{"https://admin.example.com"})

	actorID := newUUID(t)
	email := fmt.Sprintf("admin-login-%s@example.com", actorID[:8])
	password := "admin-secure-password"
	seedActiveAdmin(t, db, actorID, "Admin Login", email)
	seedAdminCred(t, actorID, password)

	body := fmt.Sprintf(`{"email":"%s","password":"%s"}`, email, password)
	req := httptest.NewRequest(http.MethodPost, "/api/admin/login", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "https://admin.example.com")
	req.RemoteAddr = "192.168.2.1:54321"
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d; body: %s", w.Code, w.Body.String())
	}

	cookies := w.Result().Cookies()
	var found bool
	for _, c := range cookies {
		if c.Name == adminCookieName {
			found = true
			if !c.HttpOnly {
				t.Error("admin cookie must be HttpOnly")
			}
			if !c.Secure {
				t.Error("admin cookie must be Secure")
			}
			if c.SameSite != http.SameSiteLaxMode {
				t.Errorf("admin cookie SameSite = %v, want Lax", c.SameSite)
			}
			// Verify session exists.
			sessStore := session.NewStore(db)
			sess, err := sessStore.LookupAdminSession(context.Background(), c.Value)
			if err != nil {
				t.Fatalf("admin session lookup failed: %v", err)
			}
			if sess.ActorID != actorID {
				t.Errorf("admin session ActorID = %q, want %q", sess.ActorID, actorID)
			}
		}
	}
	if !found {
		t.Fatal("Set-Cookie for bjt_admin_session not found")
	}
}

func TestAdminLogin_WrongPassword_Generic401(t *testing.T) {
	db := testPool(t)
	router := buildLoginRouter(t, []string{"https://admin.example.com"})

	actorID := newUUID(t)
	email := fmt.Sprintf("admin-wrong-%s@example.com", actorID[:8])
	seedActiveAdmin(t, db, actorID, "Admin Wrong", email)
	seedAdminCred(t, actorID, "correct-admin-pw")

	body := fmt.Sprintf(`{"email":"%s","password":"wrong-admin-pw"}`, email)
	req := httptest.NewRequest(http.MethodPost, "/api/admin/login", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "https://admin.example.com")
	req.RemoteAddr = "10.0.2.1:12345"
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestAdminLogin_UnknownEmail_Generic401(t *testing.T) {
	router := buildLoginRouter(t, []string{"https://admin.example.com"})

	body := `{"email":"unknown-admin@example.com","password":"any"}`
	req := httptest.NewRequest(http.MethodPost, "/api/admin/login", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "https://admin.example.com")
	req.RemoteAddr = "10.0.2.2:12345"
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for unknown admin, got %d", w.Code)
	}
}

func TestAdminLogin_DisabledActor_Generic401(t *testing.T) {
	db := testPool(t)
	router := buildLoginRouter(t, []string{"https://admin.example.com"})

	actorID := newUUID(t)
	email := fmt.Sprintf("disabled-admin-%s@example.com", actorID[:8])
	seedDisabledAdmin(t, db, actorID)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	db.Exec(ctx, `UPDATE authz.admin_actor SET email = $1 WHERE id = $2`, email, actorID)

	body := fmt.Sprintf(`{"email":"%s","password":"any"}`, email)
	req := httptest.NewRequest(http.MethodPost, "/api/admin/login", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "https://admin.example.com")
	req.RemoteAddr = "10.0.2.3:12345"
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for disabled admin, got %d", w.Code)
	}
}

func TestAdminLogin_LimiterNil_FailClosed503(t *testing.T) {
	router := buildLoginRouterNoLimiter(t, []string{"https://admin.example.com"})

	body := `{"email":"a@b.com","password":"pass"}`
	req := httptest.NewRequest(http.MethodPost, "/api/admin/login", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "https://admin.example.com")
	req.RemoteAddr = "10.0.2.4:12345"
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected 503 when limiter is nil, got %d", w.Code)
	}
}

func TestAdminLogin_CSRF_MissingOrigin_403(t *testing.T) {
	router := buildLoginRouter(t, []string{"https://admin.example.com"})

	body := `{"email":"a@b.com","password":"pass"}`
	req := httptest.NewRequest(http.MethodPost, "/api/admin/login", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	// No Origin.
	req.RemoteAddr = "10.0.2.5:12345"
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403 for missing CSRF origin on admin login, got %d", w.Code)
	}
}

// --- Namespace Isolation ---

func TestLogin_NamespaceIsolation_LearnerCookieNotAdmin(t *testing.T) {
	db := testPool(t)
	router := buildLoginRouter(t, []string{"https://app.example.com", "https://admin.example.com"})

	// Login as learner.
	userID := newUUID(t)
	email := fmt.Sprintf("iso-learner-%s@example.com", userID[:8])
	password := "learner-pass"
	seedActiveUser(t, db, userID, "ISO Learner", email, "")
	seedLearnerCred(t, userID, password)

	body := fmt.Sprintf(`{"email":"%s","password":"%s"}`, email, password)
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "https://app.example.com")
	req.RemoteAddr = "10.0.3.1:12345"
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("learner login: expected 200, got %d", w.Code)
	}

	var learnerToken string
	for _, c := range w.Result().Cookies() {
		if c.Name == learnerCookieName {
			learnerToken = c.Value
		}
	}

	// Try learner token on admin session endpoint.
	adminReq := httptest.NewRequest(http.MethodGet, "/api/admin/session", nil)
	adminReq.AddCookie(&http.Cookie{Name: learnerCookieName, Value: learnerToken})
	aw := httptest.NewRecorder()
	router.ServeHTTP(aw, adminReq)

	if aw.Code != http.StatusUnauthorized {
		t.Errorf("learner cookie on admin route expected 401, got %d", aw.Code)
	}
}
