package httpserver

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"log/slog"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/credential"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

// lifecycleTestServer creates a test server with all lifecycle handlers wired.
func lifecycleTestServer(t *testing.T) *httptest.Server {
	t.Helper()
	pool := testPool(t)
	credStore := credential.NewStore(pool)
	sessionStore := session.NewStore(pool)
	rateLimiter, err := authn.NewRateLimiter(authn.DefaultRateLimiterConfig())
	if err != nil {
		t.Fatalf("create rate limiter: %v", err)
	}
	logger := slog.Default()

	mux := http.NewServeMux()
	mux.HandleFunc("/api/auth/register", registerHandler(pool, credStore, rateLimiter, logger))
	mux.HandleFunc("/api/auth/forgot-password", forgotPasswordHandler(rateLimiter, logger, testPasswordResetRequestQueue(true)))
	mux.HandleFunc("/api/auth/reset-password", resetPasswordHandler(pool, credStore, sessionStore, rateLimiter, logger))
	mux.HandleFunc("/api/auth/change-password", changePasswordHandler(pool, credStore, sessionStore, rateLimiter, logger))
	mux.HandleFunc("/api/auth/disable", disableAccountHandler(pool, sessionStore, rateLimiter, logger))
	mux.HandleFunc("/api/auth/delete", deleteAccountHandler(pool, sessionStore, rateLimiter, logger))

	return httptest.NewServer(mux)
}

type testPasswordResetRequestQueue bool

func (q testPasswordResetRequestQueue) Enqueue(string, string) bool { return bool(q) }

func TestForgotPasswordRateLimitsForwardedClientsIndependently(t *testing.T) {
	rateLimiter, err := authn.NewRateLimiter(authn.RateLimiterConfig{
		Limit: 1, Window: time.Minute, TTL: 5 * time.Minute, MaxKeys: 100, EvictEvery: time.Minute,
	})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(rateLimiter.Stop)
	handler := forgotPasswordHandler(rateLimiter, slog.Default(), testPasswordResetRequestQueue(true))
	request := func(ip, email string) int {
		t.Helper()
		body, _ := json.Marshal(map[string]string{"email": email})
		r := httptest.NewRequest(http.MethodPost, "/api/auth/forgot-password", bytes.NewReader(body))
		r.RemoteAddr = "127.0.0.1:4001"
		r.Header.Set("Content-Type", "application/json")
		r.Header.Set("X-Forwarded-For", ip)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		return w.Code
	}

	if got := request("198.51.100.1", "first@example.test"); got != http.StatusOK {
		t.Fatalf("first client status = %d, want 200", got)
	}
	if got := request("198.51.100.2", "second@example.test"); got != http.StatusOK {
		t.Fatalf("independent client status = %d, want 200", got)
	}
	if got := request("198.51.100.1", "third@example.test"); got != http.StatusTooManyRequests {
		t.Fatalf("repeated client status = %d, want 429", got)
	}
}

type testPasswordResetMailer struct {
	mu                       sync.Mutex
	recipient, token, locale string
}

func (m *testPasswordResetMailer) SendPasswordReset(_ context.Context, recipient, token, locale string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.recipient, m.token, m.locale = recipient, token, locale
	return nil
}

func (m *testPasswordResetMailer) snapshot() (string, string, string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.recipient, m.token, m.locale
}

func TestRegister_Success(t *testing.T) {
	srv := lifecycleTestServer(t)
	defer srv.Close()

	email := fmt.Sprintf("reg-success-%s@example.com", newUUID(t)[:8])
	body := map[string]string{
		"email":       email,
		"password":    "securepassword123",
		"displayName": "Test User",
	}
	b, _ := json.Marshal(body)

	resp, err := http.Post(srv.URL+"/api/auth/register", "application/json", bytes.NewReader(b))
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		t.Errorf("expected 201, got %d", resp.StatusCode)
	}

	var result map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		t.Fatalf("decode failed: %v", err)
	}
	if result["userId"] == "" {
		t.Error("expected userId in response")
	}
}

func TestRegister_DuplicateEmail(t *testing.T) {
	srv := lifecycleTestServer(t)
	defer srv.Close()

	email := fmt.Sprintf("reg-dup-%s@example.com", newUUID(t)[:8])
	body := map[string]string{
		"email":       email,
		"password":    "securepassword123",
		"displayName": "Test User",
	}
	b, _ := json.Marshal(body)

	// First registration should succeed.
	resp, err := http.Post(srv.URL+"/api/auth/register", "application/json", bytes.NewReader(b))
	if err != nil {
		t.Fatalf("first request failed: %v", err)
	}
	resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("first registration expected 201, got %d", resp.StatusCode)
	}

	// Second registration with same email should conflict.
	resp2, err := http.Post(srv.URL+"/api/auth/register", "application/json", bytes.NewReader(b))
	if err != nil {
		t.Fatalf("second request failed: %v", err)
	}
	defer resp2.Body.Close()

	if resp2.StatusCode != http.StatusConflict {
		t.Errorf("expected 409, got %d", resp2.StatusCode)
	}
}

func TestRegister_WeakPassword(t *testing.T) {
	srv := lifecycleTestServer(t)
	defer srv.Close()

	email := fmt.Sprintf("reg-weak-%s@example.com", newUUID(t)[:8])
	body := map[string]string{
		"email":       email,
		"password":    "short",
		"displayName": "Test User",
	}
	b, _ := json.Marshal(body)

	resp, err := http.Post(srv.URL+"/api/auth/register", "application/json", bytes.NewReader(b))
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", resp.StatusCode)
	}
}

func TestForgotPassword_UnconfiguredMailer(t *testing.T) {
	pool := testPool(t)
	rateLimiter, err := authn.NewRateLimiter(authn.DefaultRateLimiterConfig())
	if err != nil {
		t.Fatalf("create rate limiter: %v", err)
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/api/auth/forgot-password", forgotPasswordHandler(rateLimiter, slog.Default(), nil))
	srv := httptest.NewServer(mux)
	defer srv.Close()

	// Seed a user first.
	userID := newUUID(t)
	email := fmt.Sprintf("forgot-success-%s@example.com", userID[:8])
	seedActiveUser(t, pool, userID, "Forgot User", email, "")

	body := map[string]string{"email": email}
	b, _ := json.Marshal(body)

	resp, err := http.Post(srv.URL+"/api/auth/forgot-password", "application/json", bytes.NewReader(b))
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusServiceUnavailable {
		t.Errorf("expected 503 for unconfigured mail delivery, got %d", resp.StatusCode)
	}

	// Verify token was created in DB.
	var tokenCount int
	err = pool.QueryRow(context.Background(),
		`SELECT count(*) FROM auth.password_reset_token WHERE user_id = $1`, userID).Scan(&tokenCount)
	if err != nil {
		t.Fatalf("query token count: %v", err)
	}
	if tokenCount != 0 {
		t.Errorf("must not create an unusable reset token, got %d", tokenCount)
	}
}

func TestForgotPassword_DoesNotLogResetToken(t *testing.T) {
	pool := testPool(t)
	userID := newUUID(t)
	email := fmt.Sprintf("forgot-log-%s@example.com", userID[:8])
	seedActiveUser(t, pool, userID, "Forgot User", email, "")
	rateLimiter, err := authn.NewRateLimiter(authn.DefaultRateLimiterConfig())
	if err != nil {
		t.Fatalf("create rate limiter: %v", err)
	}
	var logs bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&logs, nil))
	mux := http.NewServeMux()
	mailer := &testPasswordResetMailer{}
	queue := NewPasswordResetQueue(pool, mailer, logger)
	defer queue.Close(context.Background())
	mux.HandleFunc("/api/auth/forgot-password", forgotPasswordHandler(rateLimiter, logger, queue))
	mux.HandleFunc("/api/auth/reset-password", resetPasswordHandler(pool, credential.NewStore(pool), session.NewStore(pool), rateLimiter, logger))
	srv := httptest.NewServer(mux)
	defer srv.Close()

	body, _ := json.Marshal(map[string]string{"email": email, "locale": "ja"})
	resp, err := http.Post(srv.URL+"/api/auth/forgot-password", "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("read response: %v", err)
	}
	var recipient, token, locale string
	for i := 0; i < 100; i++ {
		recipient, token, locale = mailer.snapshot()
		if token != "" {
			break
		}
		time.Sleep(10 * time.Millisecond)
	}
	if token == "" || recipient != email || locale != "ja" {
		t.Fatal("expected reset token to be delivered to the requested account")
	}
	if strings.Contains(logs.String(), token) {
		t.Fatal("recovery logs must not contain the bearer token")
	}
	if strings.Contains(string(responseBody), `"token"`) {
		t.Fatal("reset token must not be exposed in the API response")
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected generic 200 after queuing delivery, got %d", resp.StatusCode)
	}
	var storedHash string
	if err := pool.QueryRow(context.Background(), `SELECT token_hash FROM auth.password_reset_token WHERE user_id = $1 AND used_at IS NULL`, userID).Scan(&storedHash); err != nil {
		t.Fatalf("load stored reset token: %v", err)
	}
	h := sha256.Sum256([]byte(token))
	if storedHash != hex.EncodeToString(h[:]) {
		t.Fatal("stored token hash must match the delivered token")
	}
	resetBody, _ := json.Marshal(map[string]string{"token": token, "password": "new-secure-password"})
	resetResp, err := http.Post(srv.URL+"/api/auth/reset-password", "application/json", bytes.NewReader(resetBody))
	if err != nil {
		t.Fatalf("reset request failed: %v", err)
	}
	resetResp.Body.Close()
	if resetResp.StatusCode != http.StatusOK {
		t.Fatalf("delivered token should be accepted by reset endpoint, got %d", resetResp.StatusCode)
	}
	replayResp, err := http.Post(srv.URL+"/api/auth/reset-password", "application/json", bytes.NewReader(resetBody))
	if err != nil {
		t.Fatalf("replay request failed: %v", err)
	}
	replayResp.Body.Close()
	if replayResp.StatusCode != http.StatusBadRequest {
		t.Fatalf("single-use token replay should fail, got %d", replayResp.StatusCode)
	}
}

func TestForgotPassword_UnknownEmail(t *testing.T) {
	srv := lifecycleTestServer(t)
	defer srv.Close()

	body := map[string]string{"email": "nonexistent@example.com"}
	b, _ := json.Marshal(body)

	resp, err := http.Post(srv.URL+"/api/auth/forgot-password", "application/json", bytes.NewReader(b))
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	// Anti-enumeration: must return 200 even for unknown email.
	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200 (anti-enumeration), got %d", resp.StatusCode)
	}
}

func TestForgotPassword_QueueFullReturnsGenericRetryableFailure(t *testing.T) {
	rateLimiter, err := authn.NewRateLimiter(authn.DefaultRateLimiterConfig())
	if err != nil {
		t.Fatalf("create rate limiter: %v", err)
	}
	srv := httptest.NewServer(forgotPasswordHandler(rateLimiter, slog.Default(), testPasswordResetRequestQueue(false)))
	defer srv.Close()
	body, _ := json.Marshal(map[string]string{"email": "learner@example.com"})
	resp, err := http.Post(srv.URL, "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()
	var response map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if resp.StatusCode != http.StatusServiceUnavailable || response["error"] != "service unavailable" {
		t.Fatalf("queue saturation must return a generic retryable failure, got status %d body %#v", resp.StatusCode, response)
	}
}

func TestLookupUserIDByEmail_ExcludesDisabledLearners(t *testing.T) {
	db := testPool(t)
	userID := newUUID(t)
	email := "disabled-reset-" + userID[:8] + "@example.test"
	if _, err := db.Exec(context.Background(), `INSERT INTO profile.user_profile (id, display_name, email, status, updated_at) VALUES ($1, 'Disabled learner', $2, 'disabled', now())`, userID, email); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = db.Exec(context.Background(), `DELETE FROM profile.user_profile WHERE id=$1`, userID) })

	got, err := lookupUserIDByEmail(context.Background(), db, email)
	if err != nil || got != "" {
		t.Fatalf("disabled account should not be eligible for recovery: id=%q err=%v", got, err)
	}
}

func TestResetPassword_Success(t *testing.T) {
	pool := testPool(t)
	srv := lifecycleTestServer(t)
	defer srv.Close()

	// Seed user with credential.
	userID := newUUID(t)
	email := fmt.Sprintf("reset-success-%s@example.com", userID[:8])
	seedActiveUser(t, pool, userID, "Reset User", email, "")
	credStore := credential.NewStore(pool)
	if err := credStore.SetLearnerCredential(context.Background(), userID, []byte("oldpassword123")); err != nil {
		t.Fatalf("set credential: %v", err)
	}
	sessions := session.NewStore(pool)
	oldSession, err := sessions.CreateLearnerSession(context.Background(), userID, "audit-test", "127.0.0.1", time.Now().Add(time.Hour))
	if err != nil {
		t.Fatalf("create pre-reset session: %v", err)
	}

	// Create reset token.
	rawToken := newUUID(t)
	tokenHash := sha256.Sum256([]byte(rawToken))
	hashHex := hex.EncodeToString(tokenHash[:])
	expiresAt := time.Now().Add(1 * time.Hour)
	_, err = pool.Exec(context.Background(),
		`INSERT INTO auth.password_reset_token (id, user_id, token_hash, expires_at, created_at)
		 VALUES ($1, $2, $3, $4, now())`, newUUID(t), userID, hashHex, expiresAt)
	if err != nil {
		t.Fatalf("insert reset token: %v", err)
	}

	body := map[string]string{
		"token":    rawToken,
		"password": "newsecurepass123",
	}
	b, _ := json.Marshal(body)

	resp, err := http.Post(srv.URL+"/api/auth/reset-password", "application/json", bytes.NewReader(b))
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}
	if err := credStore.VerifyLearner(context.Background(), userID, []byte("newsecurepass123")); err != nil {
		t.Fatalf("new credential was not persisted: %v", err)
	}
	if err := credStore.VerifyLearner(context.Background(), userID, []byte("oldpassword123")); err == nil {
		t.Fatal("old password must stop authenticating after reset")
	}
	if _, err := sessions.LookupLearnerSession(context.Background(), oldSession); err != session.ErrSessionNotFound {
		t.Fatalf("password reset must revoke the old session, got %v", err)
	}

	// Verify token is marked used.
	var usedAt *time.Time
	err = pool.QueryRow(context.Background(),
		`SELECT used_at FROM auth.password_reset_token WHERE token_hash = $1`, hashHex).Scan(&usedAt)
	if err != nil {
		t.Fatalf("query used_at: %v", err)
	}
	if usedAt == nil {
		t.Error("expected token to be marked as used")
	}
}

func TestResetPassword_ExpiredToken(t *testing.T) {
	pool := testPool(t)
	srv := lifecycleTestServer(t)
	defer srv.Close()

	userID := newUUID(t)
	email := fmt.Sprintf("reset-expired-%s@example.com", userID[:8])
	seedActiveUser(t, pool, userID, "Expired User", email, "")

	rawToken := newUUID(t)
	tokenHash := sha256.Sum256([]byte(rawToken))
	hashHex := hex.EncodeToString(tokenHash[:])
	expiredAt := time.Now().Add(-1 * time.Hour)
	_, err := pool.Exec(context.Background(),
		`INSERT INTO auth.password_reset_token (id, user_id, token_hash, expires_at, created_at)
		 VALUES ($1, $2, $3, $4, now())`, newUUID(t), userID, hashHex, expiredAt)
	if err != nil {
		t.Fatalf("insert expired token: %v", err)
	}

	body := map[string]string{
		"token":    rawToken,
		"password": "newsecurepass123",
	}
	b, _ := json.Marshal(body)

	resp, err := http.Post(srv.URL+"/api/auth/reset-password", "application/json", bytes.NewReader(b))
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400 for expired token, got %d", resp.StatusCode)
	}
}

func TestResetPassword_UsedToken(t *testing.T) {
	pool := testPool(t)
	srv := lifecycleTestServer(t)
	defer srv.Close()

	userID := newUUID(t)
	email := fmt.Sprintf("reset-used-%s@example.com", userID[:8])
	seedActiveUser(t, pool, userID, "Used User", email, "")

	rawToken := newUUID(t)
	tokenHash := sha256.Sum256([]byte(rawToken))
	hashHex := hex.EncodeToString(tokenHash[:])
	expiresAt := time.Now().Add(1 * time.Hour)
	_, err := pool.Exec(context.Background(),
		`INSERT INTO auth.password_reset_token (id, user_id, token_hash, expires_at, used_at, created_at)
		 VALUES ($1, $2, $3, $4, now(), now())`, newUUID(t), userID, hashHex, expiresAt)
	if err != nil {
		t.Fatalf("insert used token: %v", err)
	}

	body := map[string]string{
		"token":    rawToken,
		"password": "newsecurepass123",
	}
	b, _ := json.Marshal(body)

	resp, err := http.Post(srv.URL+"/api/auth/reset-password", "application/json", bytes.NewReader(b))
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400 for used token, got %d", resp.StatusCode)
	}
}

func TestChangePassword_Success(t *testing.T) {
	pool := testPool(t)
	srv := lifecycleTestServer(t)
	defer srv.Close()

	userID := newUUID(t)
	email := fmt.Sprintf("change-success-%s@example.com", userID[:8])
	seedActiveUser(t, pool, userID, "Change User", email, "")
	credStore := credential.NewStore(pool)
	if err := credStore.SetLearnerCredential(context.Background(), userID, []byte("currentpass123")); err != nil {
		t.Fatalf("set credential: %v", err)
	}

	// Create session for auth.
	sessionStore := session.NewStore(pool)
	rawToken := createLearnerSession(t, sessionStore, userID)

	body := map[string]string{
		"currentPassword": "currentpass123",
		"newPassword":     "newsecurepass456",
	}
	b, _ := json.Marshal(body)

	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/auth/change-password", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}
}

func TestChangePassword_WrongCurrent(t *testing.T) {
	pool := testPool(t)
	srv := lifecycleTestServer(t)
	defer srv.Close()

	userID := newUUID(t)
	email := fmt.Sprintf("change-wrong-%s@example.com", userID[:8])
	seedActiveUser(t, pool, userID, "Wrong User", email, "")
	credStore := credential.NewStore(pool)
	if err := credStore.SetLearnerCredential(context.Background(), userID, []byte("correctpass123")); err != nil {
		t.Fatalf("set credential: %v", err)
	}

	sessionStore := session.NewStore(pool)
	rawToken := createLearnerSession(t, sessionStore, userID)

	body := map[string]string{
		"currentPassword": "wrongpassword123",
		"newPassword":     "newsecurepass456",
	}
	b, _ := json.Marshal(body)

	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/auth/change-password", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", resp.StatusCode)
	}
}

func TestDisableAccount_Success(t *testing.T) {
	pool := testPool(t)
	srv := lifecycleTestServer(t)
	defer srv.Close()

	userID := newUUID(t)
	email := fmt.Sprintf("disable-success-%s@example.com", userID[:8])
	seedActiveUser(t, pool, userID, "Disable User", email, "")

	sessionStore := session.NewStore(pool)
	rawToken := createLearnerSession(t, sessionStore, userID)

	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/auth/disable", nil)
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}

	// Verify status changed.
	var status string
	err = pool.QueryRow(context.Background(),
		`SELECT status FROM profile.user_profile WHERE id = $1`, userID).Scan(&status)
	if err != nil {
		t.Fatalf("query status: %v", err)
	}
	if status != "disabled" {
		t.Errorf("expected status 'disabled', got %q", status)
	}
}

func TestDeleteAccount_Success(t *testing.T) {
	pool := testPool(t)
	srv := lifecycleTestServer(t)
	defer srv.Close()

	userID := newUUID(t)
	email := fmt.Sprintf("delete-success-%s@example.com", userID[:8])
	seedActiveUser(t, pool, userID, "Delete User", email, "")

	sessionStore := session.NewStore(pool)
	rawToken := createLearnerSession(t, sessionStore, userID)

	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/auth/delete", nil)
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}

	// Verify user deleted.
	var count int
	err = pool.QueryRow(context.Background(),
		`SELECT count(*) FROM profile.user_profile WHERE id = $1`, userID).Scan(&count)
	if err != nil {
		t.Fatalf("query count: %v", err)
	}
	if count != 0 {
		t.Errorf("expected user deleted, got count=%d", count)
	}
}
