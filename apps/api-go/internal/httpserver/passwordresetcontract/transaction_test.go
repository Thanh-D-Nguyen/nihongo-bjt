package passwordresetcontract

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/credential"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/httpserver"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/profile"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

func TestResetPassword_ConcurrentRequestsOnlyOneSucceeds(t *testing.T) {
	db, router, userID := resetFixture(t)
	rawToken, hash := insertResetToken(t, db, userID)
	installTokenDelay(t, db, userID)

	passwords := []string{"concurrent-reset-password-a", "concurrent-reset-password-b"}
	start := make(chan struct{})
	statuses := make(chan int, len(passwords))
	var wg sync.WaitGroup
	for _, password := range passwords {
		wg.Add(1)
		go func(password string) {
			defer wg.Done()
			<-start
			statuses <- postReset(router, rawToken, password)
		}(password)
	}
	close(start)
	wg.Wait()
	close(statuses)
	var successes, invalid int
	for status := range statuses {
		switch status {
		case http.StatusOK:
			successes++
		case http.StatusBadRequest:
			invalid++
		default:
			t.Errorf("unexpected reset status %d", status)
		}
	}
	if successes != 1 || invalid != 1 {
		t.Fatalf("exactly one request should succeed and the replay should fail; got %d success, %d invalid (token hash %s)", successes, invalid, hash)
	}
}

func TestResetPassword_RollsBackTokenAndCredentialWhenSessionRevocationFails(t *testing.T) {
	db, router, userID := resetFixture(t)
	creds := credential.NewStore(db)
	sessions := session.NewStore(db)
	if err := creds.SetLearnerCredential(context.Background(), userID, []byte("oldpassword123")); err != nil {
		t.Fatalf("seed previous credential: %v", err)
	}
	if _, err := sessions.CreateLearnerSession(context.Background(), userID, "audit-test", "127.0.0.1", time.Now().Add(time.Hour)); err != nil {
		t.Fatalf("seed previous session: %v", err)
	}
	rawToken, hash := insertResetToken(t, db, userID)
	installSessionRevokeFailure(t, db, userID)

	if status := postReset(router, rawToken, "newpassword-reset-123"); status != http.StatusInternalServerError {
		t.Fatalf("expected injected session revocation failure, got %d", status)
	}
	if err := creds.VerifyLearner(context.Background(), userID, []byte("oldpassword123")); err != nil {
		t.Fatalf("failed reset must retain the previous password: %v", err)
	}
	if err := creds.VerifyLearner(context.Background(), userID, []byte("newpassword-reset-123")); err == nil {
		t.Fatal("failed reset must not persist the new password")
	}
	var usedAt *time.Time
	if err := db.QueryRow(context.Background(), `SELECT used_at FROM auth.password_reset_token WHERE token_hash=$1`, hash).Scan(&usedAt); err != nil {
		t.Fatalf("read reset token: %v", err)
	}
	if usedAt != nil {
		t.Fatal("failed reset must leave its token unused")
	}
	var active int
	if err := db.QueryRow(context.Background(), `SELECT count(*) FROM auth.session WHERE user_id=$1 AND revoked_at IS NULL`, userID).Scan(&active); err != nil {
		t.Fatalf("read learner sessions: %v", err)
	}
	if active != 1 {
		t.Fatalf("failed reset must preserve the previous session, got %d active sessions", active)
	}
}

func TestResetPassword_DisabledLearnerCannotConsumeResetToken(t *testing.T) {
	db, router, userID := resetFixture(t)
	creds := credential.NewStore(db)
	if err := creds.SetLearnerCredential(context.Background(), userID, []byte("previous-password-123")); err != nil {
		t.Fatalf("seed previous credential: %v", err)
	}
	if _, err := db.Exec(context.Background(), `UPDATE profile.user_profile SET status='disabled' WHERE id=$1`, userID); err != nil {
		t.Fatalf("disable learner: %v", err)
	}
	rawToken, hash := insertResetToken(t, db, userID)

	if status := postReset(router, rawToken, "new-password-disabled-123"); status != http.StatusBadRequest {
		t.Fatalf("disabled learner reset status = %d, want 400", status)
	}
	if err := creds.VerifyLearner(context.Background(), userID, []byte("previous-password-123")); err != nil {
		t.Fatalf("disabled learner credential must remain unchanged: %v", err)
	}
	var usedAt *time.Time
	if err := db.QueryRow(context.Background(), `SELECT used_at FROM auth.password_reset_token WHERE token_hash=$1`, hash).Scan(&usedAt); err != nil {
		t.Fatalf("read reset token: %v", err)
	}
	if usedAt != nil {
		t.Fatal("disabled learner token must remain unconsumed")
	}
}

func resetFixture(t *testing.T) (*pgxpool.Pool, http.Handler, string) {
	t.Helper()
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Fatal("TEST_DATABASE_URL is required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	db, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatalf("open test database: %v", err)
	}
	if err := db.Ping(ctx); err != nil {
		db.Close()
		t.Fatalf("ping test database: %v", err)
	}
	t.Cleanup(db.Close)
	userID := resetUUID(t)
	if _, err := db.Exec(ctx, `INSERT INTO profile.user_profile (id, display_name, email, status, updated_at) VALUES ($1, 'Reset audit', $2, 'active', now())`, userID, "reset-transaction-"+userID[:8]+"@example.com"); err != nil {
		t.Fatalf("seed learner: %v", err)
	}
	t.Cleanup(func() { _, _ = db.Exec(context.Background(), `DELETE FROM profile.user_profile WHERE id=$1`, userID) })
	limiter, err := authn.NewRateLimiter(authn.DefaultRateLimiterConfig())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(limiter.Stop)
	router := httpserver.NewRouter(httpserver.Dependencies{
		Config:          &config.Config{CORSOrigins: []string{"http://localhost"}},
		Logger:          slog.Default(),
		DBPool:          db,
		ProfileStore:    profile.NewStore(db),
		CredentialStore: credential.NewStore(db),
		SessionStore:    session.NewStore(db),
		RateLimiter:     limiter,
	})
	return db, router, userID
}

func insertResetToken(t *testing.T, db *pgxpool.Pool, userID string) (string, string) {
	t.Helper()
	token := resetUUID(t)
	digest := sha256.Sum256([]byte(token))
	hash := hex.EncodeToString(digest[:])
	if _, err := db.Exec(context.Background(), `INSERT INTO auth.password_reset_token (id,user_id,token_hash,expires_at,created_at) VALUES ($1,$2,$3,now()+interval '1 hour',now())`, resetUUID(t), userID, hash); err != nil {
		t.Fatalf("insert reset token: %v", err)
	}
	return token, hash
}

func postReset(router http.Handler, token, password string) int {
	body, _ := json.Marshal(map[string]string{"token": token, "password": password})
	req := httptest.NewRequest(http.MethodPost, "/api/auth/reset-password", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "http://localhost")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, req)
	return response.Code
}

func resetUUID(t *testing.T) string {
	t.Helper()
	var id [16]byte
	if _, err := rand.Read(id[:]); err != nil {
		t.Fatal(err)
	}
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x", id[0:4], id[4:6], id[6:8], id[8:10], id[10:16])
}

func installTokenDelay(t *testing.T, db *pgxpool.Pool, userID string) {
	t.Helper()
	suffix := strings.ReplaceAll(userID, "-", "")
	function, trigger := "audit_reset_delay_"+suffix, "audit_reset_delay_trigger_"+suffix
	if _, err := db.Exec(context.Background(), fmt.Sprintf(`CREATE FUNCTION public.%s() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_sleep(0.5); RETURN NEW; END $$`, function)); err != nil {
		t.Fatalf("create token delay function: %v", err)
	}
	if _, err := db.Exec(context.Background(), fmt.Sprintf(`CREATE TRIGGER %s BEFORE UPDATE ON auth.password_reset_token FOR EACH ROW WHEN (OLD.user_id::text = '%s' AND OLD.used_at IS NULL) EXECUTE FUNCTION public.%s()`, trigger, userID, function)); err != nil {
		t.Fatalf("create token delay trigger: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), fmt.Sprintf(`DROP TRIGGER IF EXISTS %s ON auth.password_reset_token`, trigger))
		_, _ = db.Exec(context.Background(), fmt.Sprintf(`DROP FUNCTION IF EXISTS public.%s()`, function))
	})
}

func installSessionRevokeFailure(t *testing.T, db *pgxpool.Pool, userID string) {
	t.Helper()
	suffix := strings.ReplaceAll(userID, "-", "")
	function, trigger := "audit_reset_fail_revoke_"+suffix, "audit_reset_fail_revoke_trigger_"+suffix
	if _, err := db.Exec(context.Background(), fmt.Sprintf(`CREATE FUNCTION public.%s() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced session revoke failure'; END $$`, function)); err != nil {
		t.Fatalf("create session failure function: %v", err)
	}
	if _, err := db.Exec(context.Background(), fmt.Sprintf(`CREATE TRIGGER %s BEFORE UPDATE ON auth.session FOR EACH ROW WHEN (OLD.user_id::text = '%s') EXECUTE FUNCTION public.%s()`, trigger, userID, function)); err != nil {
		t.Fatalf("create session failure trigger: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), fmt.Sprintf(`DROP TRIGGER IF EXISTS %s ON auth.session`, trigger))
		_, _ = db.Exec(context.Background(), fmt.Sprintf(`DROP FUNCTION IF EXISTS public.%s()`, function))
	})
}
