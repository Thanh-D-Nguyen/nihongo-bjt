package httpserver

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"log/slog"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authz"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/profile"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

// testPool creates a disposable pgxpool connected to TEST_DATABASE_URL.
// Tests using this require a running Postgres 17 with M2 schema applied.
// When TEST_DATABASE_URL is unset, tests are skipped (not failed) so that
// `go test ./...` passes without a live database.
func testPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set; skipping integration test")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatalf("failed to connect to test DB: %v", err)
	}
	t.Cleanup(pool.Close)
	return pool
}

// newUUID generates a random UUID v4 string for test isolation.
// Production parent tables use UUID primary keys; text IDs cause FK type mismatches.
func newUUID(t *testing.T) string {
	t.Helper()
	var uuid [16]byte
	if _, err := rand.Read(uuid[:]); err != nil {
		t.Fatalf("crypto/rand: %v", err)
	}
	uuid[6] = (uuid[6] & 0x0f) | 0x40 // version 4
	uuid[8] = (uuid[8] & 0x3f) | 0x80 // variant RFC4122
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x",
		uuid[0:4], uuid[4:6], uuid[6:8], uuid[8:10], uuid[10:16])
}

func seedActiveUser(t *testing.T, db *pgxpool.Pool, userID, displayName, email, keycloakSubject string) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err := db.Exec(ctx,
		`INSERT INTO profile.user_profile (id, display_name, email, status, keycloak_subject, updated_at)
		 VALUES ($1, $2, $3, 'active', $4, now())
		 ON CONFLICT (id) DO UPDATE SET display_name=$2, email=$3, status='active', keycloak_subject=$4`,
		userID, displayName, email, nullStr(keycloakSubject))
	if err != nil {
		t.Fatalf("seed active user failed: %v", err)
	}
	// Cleanup: delete by UUID after test to prevent UNIQUE(email) collisions on -count=2.
	// Cascade deletes sessions and credentials via FK ON DELETE CASCADE.
	t.Cleanup(func() {
		cctx, ccancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer ccancel()
		_, _ = db.Exec(cctx, `DELETE FROM profile.user_profile WHERE id = $1`, userID)
	})
}

func seedDisabledUser(t *testing.T, db *pgxpool.Pool, userID string) {
	t.Helper()
	email := fmt.Sprintf("disabled-%s@example.com", userID[:8])
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err := db.Exec(ctx,
		`INSERT INTO profile.user_profile (id, display_name, email, status, updated_at)
		 VALUES ($1, 'Disabled User', $2, 'disabled', now())
		 ON CONFLICT (id) DO UPDATE SET status='disabled'`,
		userID, email)
	if err != nil {
		t.Fatalf("seed disabled user failed: %v", err)
	}
	t.Cleanup(func() {
		cctx, ccancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer ccancel()
		_, _ = db.Exec(cctx, `DELETE FROM profile.user_profile WHERE id = $1`, userID)
	})
}

func seedActiveAdmin(t *testing.T, db *pgxpool.Pool, actorID, displayName, email string) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err := db.Exec(ctx,
		`INSERT INTO authz.admin_actor (id, display_name, email, status, updated_at)
		 VALUES ($1, $2, $3, 'active', now())
		 ON CONFLICT (id) DO UPDATE SET display_name=$2, email=$3, status='active'`,
		actorID, displayName, email)
	if err != nil {
		t.Fatalf("seed active admin failed: %v", err)
	}
	t.Cleanup(func() {
		cctx, ccancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer ccancel()
		_, _ = db.Exec(cctx, `DELETE FROM authz.admin_actor WHERE id = $1`, actorID)
	})
}

func seedDisabledAdmin(t *testing.T, db *pgxpool.Pool, actorID string) {
	t.Helper()
	email := fmt.Sprintf("disabled-admin-%s@example.com", actorID[:8])
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err := db.Exec(ctx,
		`INSERT INTO authz.admin_actor (id, display_name, email, status, updated_at)
		 VALUES ($1, 'Disabled Admin', $2, 'disabled', now())
		 ON CONFLICT (id) DO UPDATE SET status='disabled'`,
		actorID, email)
	if err != nil {
		t.Fatalf("seed disabled admin failed: %v", err)
	}
	t.Cleanup(func() {
		cctx, ccancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer ccancel()
		_, _ = db.Exec(cctx, `DELETE FROM authz.admin_actor WHERE id = $1`, actorID)
	})
}

func nullStr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func testLogger() *slog.Logger {
	return slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelError}))
}

// buildTestRouter creates a router wired to real stores backed by the test DB.
func buildTestRouter(t *testing.T, db *pgxpool.Pool, trustedOrigins []string) http.Handler {
	t.Helper()
	logger := testLogger()
	deps := Dependencies{
		Config: &config.Config{
			Port:        "4001",
			CORSOrigins: trustedOrigins,
		},
		Logger:       logger,
		SessionStore: session.NewStore(db),
		ProfileStore: profile.NewStore(db),
		RBACStore:    authz.NewStore(db),
		Version:      "test",
	}
	return NewRouter(deps)
}

// createLearnerSession creates a session and returns the raw token for use in cookies.
func createLearnerSession(t *testing.T, store *session.Store, userID string) string {
	t.Helper()
	raw, err := store.CreateLearnerSession(context.Background(), userID, "test-agent", "127.0.0.1", time.Now().Add(24*time.Hour))
	if err != nil {
		t.Fatalf("create learner session: %v", err)
	}
	return raw
}

// createAdminSession creates an admin session and returns the raw token.
func createAdminSession(t *testing.T, store *session.Store, actorID string) string {
	t.Helper()
	raw, err := store.CreateAdminSession(context.Background(), actorID, "admin-agent", "127.0.0.1", time.Now().Add(24*time.Hour))
	if err != nil {
		t.Fatalf("create admin session: %v", err)
	}
	return raw
}

// --- GET /api/auth/me tests ---

func TestLearnerMe_Success_ExactJSONShape(t *testing.T) {
	db := testPool(t)
	store := session.NewStore(db)
	router := buildTestRouter(t, db, []string{"https://app.example.com"})

	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Test Learner", "learner@example.com", "")
	rawToken := createLearnerSession(t, store, userID)

	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d; body: %s", w.Code, w.Body.String())
	}

	// M5 returns a flat profile object (no "profile" wrapper, no "sub" key).
	var resp map[string]json.RawMessage
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	expectedKeys := []string{
		"id", "email", "displayName", "status",
		"themeMode", "fontSizePreference", "densityPreference",
		"flashcardStyleSlug", "coverAssetId",
		"adsPersonalizationOptIn", "sharePostcardOptIn",
		"createdAt", "updatedAt",
	}
	for _, key := range expectedKeys {
		if _, ok := resp[key]; !ok {
			t.Errorf("response missing expected key %q", key)
		}
	}

	// Verify specific values.
	var idVal string
	json.Unmarshal(resp["id"], &idVal)
	if idVal != userID {
		t.Errorf("id = %q, want %q", idVal, userID)
	}
	var nameVal string
	json.Unmarshal(resp["displayName"], &nameVal)
	if nameVal != "Test Learner" {
		t.Errorf("displayName = %q, want %q", nameVal, "Test Learner")
	}

	// Nullable FK fields should serialize as JSON null when unset.
	if string(resp["coverAssetId"]) != "null" {
		t.Errorf("coverAssetId = %s, want null", string(resp["coverAssetId"]))
	}
	if string(resp["flashcardStyleSlug"]) != "null" {
		t.Errorf("flashcardStyleSlug = %s, want null", string(resp["flashcardStyleSlug"]))
	}

	// DB-defaulted NOT NULL columns must serialize with their default values
	// (canonical defaults: packages/database/prisma/migrations/
	// 20260520120000_add_appearance_prefs_to_profile).
	defaultedFields := map[string]string{
		"themeMode":          `"system"`,
		"densityPreference":  `"comfortable"`,
		"fontSizePreference": `"default"`,
	}
	for f, want := range defaultedFields {
		raw := resp[f]
		if string(raw) != want {
			t.Errorf("%s = %s, want %s (DB default)", f, string(raw), want)
		}
	}
}

func TestLearnerMe_NullableFieldsPresentAsNull(t *testing.T) {
	db := testPool(t)
	store := session.NewStore(db)
	router := buildTestRouter(t, db, []string{"https://app.example.com"})

	userID := newUUID(t)
	// Seed user with NULL keycloak_subject and no optional fields set
	seedActiveUser(t, db, userID, "Null Fields User", "null@example.com", "")
	rawToken := createLearnerSession(t, store, userID)

	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var resp map[string]json.RawMessage
	json.Unmarshal(w.Body.Bytes(), &resp)

	// M5 returns a flat profile object — no "sub" or "profile" wrapper keys.
	// Nullable fields (coverAssetId, flashcardStyleSlug) should serialize as JSON null.
	if string(resp["coverAssetId"]) != "null" {
		t.Errorf("coverAssetId = %s, want null", string(resp["coverAssetId"]))
	}
	if string(resp["flashcardStyleSlug"]) != "null" {
		t.Errorf("flashcardStyleSlug = %s, want null", string(resp["flashcardStyleSlug"]))
	}
}

func TestLearnerMe_NoCookie_Returns401(t *testing.T) {
	db := testPool(t)
	router := buildTestRouter(t, db, []string{"https://app.example.com"})

	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 without cookie, got %d", w.Code)
	}
}

func TestLearnerMe_InvalidToken_Returns401(t *testing.T) {
	db := testPool(t)
	router := buildTestRouter(t, db, []string{"https://app.example.com"})

	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: strings.Repeat("a", 64)})
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for invalid token, got %d", w.Code)
	}
}

func TestLearnerMe_ExpiredSession_FilteredBySQL(t *testing.T) {
	db := testPool(t)

	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Expired User", "expired@example.com", "")

	// Insert expired session directly
	_, digest, err := session.GenerateToken()
	if err != nil {
		t.Fatalf("GenerateToken: %v", err)
	}
	ctx := context.Background()
	_, err = db.Exec(ctx, `INSERT INTO auth.session (user_id, token_digest, expires_at) VALUES ($1, $2, now() - interval '1 hour')`, userID, digest)
	if err != nil {
		t.Fatalf("insert expired session: %v", err)
	}

	// Verify the SQL expiry filter works — expired sessions must not match active query
	var count int
	err = db.QueryRow(ctx, `SELECT count(*) FROM auth.session WHERE token_digest = $1 AND revoked_at IS NULL AND expires_at > now()`, digest).Scan(&count)
	if err != nil {
		t.Fatalf("count query: %v", err)
	}
	if count != 0 {
		t.Errorf("expired session should not match active filter, found %d", count)
	}
}

func TestLearnerMe_RevokedSession_Returns401(t *testing.T) {
	db := testPool(t)
	store := session.NewStore(db)
	router := buildTestRouter(t, db, []string{"https://app.example.com"})

	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Revoked User", "revoked@example.com", "")
	rawToken := createLearnerSession(t, store, userID)

	// Revoke the session
	sess, _ := store.LookupLearnerSession(context.Background(), rawToken)
	store.RevokeLearnerSession(context.Background(), sess.ID, userID)

	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for revoked session, got %d", w.Code)
	}
}

func TestLearnerMe_DisabledUser_Returns401(t *testing.T) {
	db := testPool(t)
	store := session.NewStore(db)
	router := buildTestRouter(t, db, []string{"https://app.example.com"})

	userID := newUUID(t)
	seedDisabledUser(t, db, userID)

	// Create session before disabling — session exists but user is disabled
	rawToken := createLearnerSession(t, store, userID)

	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Disabled user lookup returns ErrSessionNotFound due to JOIN on status='active'
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for disabled user, got %d", w.Code)
	}
}

// --- POST /api/auth/logout tests ---

func TestLearnerLogout_Success_RevokeAndClearCookie(t *testing.T) {
	db := testPool(t)
	store := session.NewStore(db)
	router := buildTestRouter(t, db, []string{"https://app.example.com"})

	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Logout User", "logout@example.com", "")
	rawToken := createLearnerSession(t, store, userID)

	req := httptest.NewRequest(http.MethodPost, "/api/auth/logout", nil)
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})
	req.Header.Set("Origin", "https://app.example.com")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d; body: %s", w.Code, w.Body.String())
	}

	var resp map[string]bool
	json.Unmarshal(w.Body.Bytes(), &resp)
	if !resp["ok"] {
		t.Error("expected ok:true in response")
	}

	// Verify cookie is cleared
	cookies := w.Result().Cookies()
	var found bool
	for _, c := range cookies {
		if c.Name == "bjt_web_session" {
			found = true
			if c.MaxAge != -1 {
				t.Errorf("cookie MaxAge = %d, want -1 (delete)", c.MaxAge)
			}
			if c.Value != "" {
				t.Errorf("cookie Value = %q, want empty", c.Value)
			}
			if !c.HttpOnly {
				t.Error("cleared cookie must remain HttpOnly")
			}
			if !c.Secure {
				t.Error("cleared cookie must remain Secure")
			}
		}
	}
	if !found {
		t.Error("Set-Cookie header for bjt_web_session not found in logout response")
	}

	// Verify session is actually revoked in DB
	_, err := store.LookupLearnerSession(context.Background(), rawToken)
	if err == nil {
		t.Error("revoked session should not be found after logout")
	}
}

func TestLearnerLogout_ReplayAfterRevoke_Returns401(t *testing.T) {
	db := testPool(t)
	store := session.NewStore(db)
	router := buildTestRouter(t, db, []string{"https://app.example.com"})

	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Replay User", "replay@example.com", "")
	rawToken := createLearnerSession(t, store, userID)

	// First logout succeeds
	req1 := httptest.NewRequest(http.MethodPost, "/api/auth/logout", nil)
	req1.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})
	req1.Header.Set("Origin", "https://app.example.com")
	w1 := httptest.NewRecorder()
	router.ServeHTTP(w1, req1)
	if w1.Code != http.StatusOK {
		t.Fatalf("first logout expected 200, got %d", w1.Code)
	}

	// Replay same token — should be 401
	req2 := httptest.NewRequest(http.MethodPost, "/api/auth/logout", nil)
	req2.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})
	req2.Header.Set("Origin", "https://app.example.com")
	w2 := httptest.NewRecorder()
	router.ServeHTTP(w2, req2)
	if w2.Code != http.StatusUnauthorized {
		t.Errorf("replay after revoke expected 401, got %d", w2.Code)
	}
}

func TestLearnerLogout_OwnerScoped_CannotRevokeOther(t *testing.T) {
	db := testPool(t)
	store := session.NewStore(db)

	victimID := newUUID(t)
	attackerID := newUUID(t)
	seedActiveUser(t, db, victimID, "Victim", "victim@example.com", "")
	seedActiveUser(t, db, attackerID, "Attacker", "attacker@example.com", "")

	victimToken := createLearnerSession(t, store, victimID)
	_ = createLearnerSession(t, store, attackerID)

	// Attacker tries to revoke victim's session via direct store call
	victimSess, _ := store.LookupLearnerSession(context.Background(), victimToken)
	err := store.RevokeLearnerSession(context.Background(), victimSess.ID, attackerID)
	if err != nil {
		t.Logf("RevokeLearnerSession returned error (expected): %v", err)
	}

	// Victim's session should still be valid
	_, err = store.LookupLearnerSession(context.Background(), victimToken)
	if err != nil {
		t.Errorf("victim session should still be valid after cross-user revoke attempt, got %v", err)
	}
}

func TestLearnerLogout_NoCookie_Returns401(t *testing.T) {
	db := testPool(t)
	router := buildTestRouter(t, db, []string{"https://app.example.com"})

	req := httptest.NewRequest(http.MethodPost, "/api/auth/logout", nil)
	req.Header.Set("Origin", "https://app.example.com")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 without cookie, got %d", w.Code)
	}
}

// --- CSRF tests ---

func TestCSRF_RejectsMissingOrigin(t *testing.T) {
	db := testPool(t)
	store := session.NewStore(db)
	router := buildTestRouter(t, db, []string{"https://app.example.com"})

	userID := newUUID(t)
	seedActiveUser(t, db, userID, "CSRF User", "csrf@example.com", "")
	rawToken := createLearnerSession(t, store, userID)

	req := httptest.NewRequest(http.MethodPost, "/api/auth/logout", nil)
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})
	// No Origin or Referer header
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403 for missing origin, got %d; body: %s", w.Code, w.Body.String())
	}
}

func TestCSRF_RejectsUntrustedOrigin(t *testing.T) {
	db := testPool(t)
	store := session.NewStore(db)
	router := buildTestRouter(t, db, []string{"https://app.example.com"})

	userID := newUUID(t)
	seedActiveUser(t, db, userID, "CSRF Bad", "csrfbad@example.com", "")
	rawToken := createLearnerSession(t, store, userID)

	req := httptest.NewRequest(http.MethodPost, "/api/auth/logout", nil)
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})
	req.Header.Set("Origin", "https://evil.attacker.com")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403 for untrusted origin, got %d; body: %s", w.Code, w.Body.String())
	}
}

func TestCSRF_AcceptsTrustedOrigin(t *testing.T) {
	db := testPool(t)
	store := session.NewStore(db)
	router := buildTestRouter(t, db, []string{"https://app.example.com"})

	userID := newUUID(t)
	seedActiveUser(t, db, userID, "CSRF Good", "csrcgood@example.com", "")
	rawToken := createLearnerSession(t, store, userID)

	req := httptest.NewRequest(http.MethodPost, "/api/auth/logout", nil)
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})
	req.Header.Set("Origin", "https://app.example.com")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200 for trusted origin, got %d; body: %s", w.Code, w.Body.String())
	}
}

func TestCSRF_EmptyTrustedOrigins_RejectsAllUnsafe(t *testing.T) {
	db := testPool(t)
	store := session.NewStore(db)
	// Empty trusted origins — all unsafe requests should be rejected
	router := buildTestRouter(t, db, []string{})

	userID := newUUID(t)
	seedActiveUser(t, db, userID, "CSRF Empty", "csrfempty@example.com", "")
	rawToken := createLearnerSession(t, store, userID)

	req := httptest.NewRequest(http.MethodPost, "/api/auth/logout", nil)
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})
	req.Header.Set("Origin", "https://any-origin.com")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403 with empty trusted origins, got %d", w.Code)
	}
}

// --- GET /api/admin/session tests ---

func TestAdminSession_Success_WithRealDisplayName(t *testing.T) {
	db := testPool(t)
	store := session.NewStore(db)
	router := buildTestRouter(t, db, []string{"https://admin.example.com"})

	actorID := newUUID(t)
	displayName := "Admin Jane Doe"
	seedActiveAdmin(t, db, actorID, displayName, "admin@example.com")
	rawToken := createAdminSession(t, store, actorID)

	req := httptest.NewRequest(http.MethodGet, "/api/admin/session", nil)
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: rawToken})
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d; body: %s", w.Code, w.Body.String())
	}

	var resp map[string]string
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["actorId"] != actorID {
		t.Errorf("actorId = %q, want %q", resp["actorId"], actorID)
	}
	if resp["displayName"] != displayName {
		t.Errorf("displayName = %q, want %q", resp["displayName"], displayName)
	}
}

func TestAdminSession_NoCookie_Returns401(t *testing.T) {
	db := testPool(t)
	router := buildTestRouter(t, db, []string{"https://admin.example.com"})

	req := httptest.NewRequest(http.MethodGet, "/api/admin/session", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestAdminSession_DisabledActor_Returns401(t *testing.T) {
	db := testPool(t)
	store := session.NewStore(db)
	router := buildTestRouter(t, db, []string{"https://admin.example.com"})

	actorID := newUUID(t)
	seedDisabledAdmin(t, db, actorID)
	rawToken := createAdminSession(t, store, actorID)

	req := httptest.NewRequest(http.MethodGet, "/api/admin/session", nil)
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: rawToken})
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for disabled admin, got %d", w.Code)
	}
}

// --- POST /api/admin/logout tests ---

func TestAdminLogout_Success_RevokeAndClearCookie(t *testing.T) {
	db := testPool(t)
	store := session.NewStore(db)
	router := buildTestRouter(t, db, []string{"https://admin.example.com"})

	actorID := newUUID(t)
	seedActiveAdmin(t, db, actorID, "Logout Admin", "admlogout@example.com")
	rawToken := createAdminSession(t, store, actorID)

	req := httptest.NewRequest(http.MethodPost, "/api/admin/logout", nil)
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: rawToken})
	req.Header.Set("Origin", "https://admin.example.com")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d; body: %s", w.Code, w.Body.String())
	}

	// Verify cookie cleared
	cookies := w.Result().Cookies()
	var found bool
	for _, c := range cookies {
		if c.Name == "bjt_admin_session" {
			found = true
			if c.MaxAge != -1 {
				t.Errorf("admin cookie MaxAge = %d, want -1", c.MaxAge)
			}
			if c.Value != "" {
				t.Errorf("admin cookie Value = %q, want empty", c.Value)
			}
		}
	}
	if !found {
		t.Error("Set-Cookie for bjt_admin_session not found")
	}

	// Verify session revoked
	_, err := store.LookupAdminSession(context.Background(), rawToken)
	if err == nil {
		t.Error("admin session should be revoked after logout")
	}
}

// --- Namespace isolation tests ---

func TestNamespaceIsolation_LearnerCookieCannotAccessAdmin(t *testing.T) {
	db := testPool(t)
	store := session.NewStore(db)
	router := buildTestRouter(t, db, []string{"https://app.example.com", "https://admin.example.com"})

	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Iso User", "iso@example.com", "")
	learnerToken := createLearnerSession(t, store, userID)

	// Try learner cookie on admin endpoint
	req := httptest.NewRequest(http.MethodGet, "/api/admin/session", nil)
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: learnerToken})
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("learner cookie on admin route expected 401, got %d", w.Code)
	}
}

func TestNamespaceIsolation_AdminCookieCannotAccessLearner(t *testing.T) {
	db := testPool(t)
	store := session.NewStore(db)
	router := buildTestRouter(t, db, []string{"https://app.example.com", "https://admin.example.com"})

	actorID := newUUID(t)
	seedActiveAdmin(t, db, actorID, "Iso Admin", "admiso@example.com")
	adminToken := createAdminSession(t, store, actorID)

	// Try admin cookie on learner endpoint
	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: adminToken})
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("admin cookie on learner route expected 401, got %d", w.Code)
	}
}

// --- /api/admin/me must NOT be mounted ---

func TestAdminMe_NotMounted(t *testing.T) {
	db := testPool(t)
	store := session.NewStore(db)
	router := buildTestRouter(t, db, []string{"https://admin.example.com"})

	actorID := newUUID(t)
	seedActiveAdmin(t, db, actorID, "No Me Admin", "nome@example.com")
	rawToken := createAdminSession(t, store, actorID)

	req := httptest.NewRequest(http.MethodGet, "/api/admin/me", nil)
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: rawToken})
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound && w.Code != http.StatusMethodNotAllowed {
		t.Errorf("/api/admin/me should not be mounted; expected 404/405, got %d", w.Code)
	}
}

// --- Method enforcement ---

func TestLearnerMe_PostNotAllowed(t *testing.T) {
	db := testPool(t)
	store := session.NewStore(db)
	router := buildTestRouter(t, db, []string{"https://app.example.com"})

	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Method User", "method@example.com", "")
	rawToken := createLearnerSession(t, store, userID)

	req := httptest.NewRequest(http.MethodPost, "/api/auth/me", nil)
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// chi returns 405 for wrong method on registered route
	if w.Code != http.StatusMethodNotAllowed && w.Code != http.StatusUnauthorized {
		t.Errorf("POST /api/auth/me expected 405 or 401, got %d", w.Code)
	}
}
