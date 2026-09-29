package httpserver

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
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
	mux.HandleFunc("/api/auth/forgot-password", forgotPasswordHandler(pool, rateLimiter, logger))
	mux.HandleFunc("/api/auth/reset-password", resetPasswordHandler(pool, credStore, sessionStore, rateLimiter, logger))
	mux.HandleFunc("/api/auth/change-password", changePasswordHandler(pool, credStore, sessionStore, rateLimiter, logger))
	mux.HandleFunc("/api/auth/disable", disableAccountHandler(pool, sessionStore, rateLimiter, logger))
	mux.HandleFunc("/api/auth/delete", deleteAccountHandler(pool, sessionStore, rateLimiter, logger))

	return httptest.NewServer(mux)
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

func TestForgotPassword_Success(t *testing.T) {
	pool := testPool(t)
	srv := lifecycleTestServer(t)
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

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}

	// Verify token was created in DB.
	var tokenCount int
	err = pool.QueryRow(context.Background(),
		`SELECT count(*) FROM auth.password_reset_token WHERE user_id = $1`, userID).Scan(&tokenCount)
	if err != nil {
		t.Fatalf("query token count: %v", err)
	}
	if tokenCount != 1 {
		t.Errorf("expected 1 reset token, got %d", tokenCount)
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

	// Create reset token.
	rawToken := newUUID(t)
	tokenHash := sha256.Sum256([]byte(rawToken))
	hashHex := hex.EncodeToString(tokenHash[:])
	expiresAt := time.Now().Add(1 * time.Hour)
	_, err := pool.Exec(context.Background(),
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
