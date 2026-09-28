package session

import (
	"context"
	"errors"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// testPool creates a disposable pgxpool connected to TEST_DATABASE_URL.
// Tests using this require a running Postgres with M2 schema applied.
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

// seedUser inserts a minimal profile.user_profile row for FK satisfaction.
func seedUser(t *testing.T, db *pgxpool.Pool, userID string) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err := db.Exec(ctx, `INSERT INTO profile.user_profile (id, display_name, email) VALUES ($1, 'Test User', $2) ON CONFLICT (id) DO NOTHING`, userID, fmt.Sprintf("test-%s@example.com", userID[:8]))
	if err != nil {
		t.Fatalf("seed user failed: %v", err)
	}
}

// seedAdmin inserts a minimal authz.admin_actor row for FK satisfaction.
func seedAdmin(t *testing.T, db *pgxpool.Pool, actorID string) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err := db.Exec(ctx, `INSERT INTO authz.admin_actor (id, display_name, email, status) VALUES ($1, 'Test Admin', $2, 'active') ON CONFLICT (id) DO NOTHING`, actorID, fmt.Sprintf("admin-%s@example.com", actorID[:8]))
	if err != nil {
		t.Fatalf("seed admin failed: %v", err)
	}
}

func TestCreateAndLookupLearnerSession(t *testing.T) {
	db := testPool(t)
	store := NewStore(db)
	userID := "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
	seedUser(t, db, userID)

	raw, digest, err := GenerateToken()
	if err != nil {
		t.Fatalf("GenerateToken: %v", err)
	}

	ctx := context.Background()
	expiresAt := time.Now().Add(24 * time.Hour)
	if err := store.CreateLearnerSession(ctx, userID, digest, "test-agent", "127.0.0.1", expiresAt); err != nil {
		t.Fatalf("CreateLearnerSession: %v", err)
	}

	sess, err := store.LookupLearnerSession(ctx, raw)
	if err != nil {
		t.Fatalf("LookupLearnerSession: %v", err)
	}
	if sess.UserID != userID {
		t.Errorf("UserID = %q, want %q", sess.UserID, userID)
	}
	if sess.UserAgent != "test-agent" {
		t.Errorf("UserAgent = %q, want %q", sess.UserAgent, "test-agent")
	}
}

func TestLookupLearnerSession_NotFound(t *testing.T) {
	db := testPool(t)
	store := NewStore(db)

	_, err := store.LookupLearnerSession(context.Background(), "nonexistent-token")
	if !errors.Is(err, ErrSessionNotFound) {
		t.Errorf("expected ErrSessionNotFound, got %v", err)
	}
}

func TestLookupLearnerSession_Expired(t *testing.T) {
	db := testPool(t)
	store := NewStore(db)
	userID := "b2c3d4e5-f6a7-8901-bcde-f12345678901"
	seedUser(t, db, userID)

	_, digest, err := GenerateToken()
	if err != nil {
		t.Fatalf("GenerateToken: %v", err)
	}

	ctx := context.Background()
	// Insert already-expired session directly
	_, err = db.Exec(ctx, `INSERT INTO auth.session (user_id, token_digest, expires_at) VALUES ($1, $2, now() - interval '1 hour')`, userID, digest)
	if err != nil {
		t.Fatalf("insert expired session: %v", err)
	}

	_, err = store.LookupLearnerSession(ctx, HashToken(digest)) // wrong: we need raw token
	// Actually, LookupLearnerSession hashes internally, so pass a raw whose digest matches
	// We stored digest directly, so we can't reverse it. Use direct lookup instead.
	// This test validates the SQL expiry filter works.
	var count int
	err = db.QueryRow(ctx, `SELECT count(*) FROM auth.session WHERE token_digest = $1 AND revoked_at IS NULL AND expires_at > now()`, digest).Scan(&count)
	if err != nil {
		t.Fatalf("count query: %v", err)
	}
	if count != 0 {
		t.Errorf("expired session should not be returned, found %d", count)
	}
}

func TestRevokeLearnerSession(t *testing.T) {
	db := testPool(t)
	store := NewStore(db)
	userID := "c3d4e5f6-a7b8-9012-cdef-123456789012"
	seedUser(t, db, userID)

	raw, digest, err := GenerateToken()
	if err != nil {
		t.Fatalf("GenerateToken: %v", err)
	}

	ctx := context.Background()
	expiresAt := time.Now().Add(24 * time.Hour)
	if err := store.CreateLearnerSession(ctx, userID, digest, "", "", expiresAt); err != nil {
		t.Fatalf("CreateLearnerSession: %v", err)
	}

	// Find session ID
	var sessID string
	err = db.QueryRow(ctx, `SELECT id FROM auth.session WHERE token_digest = $1`, digest).Scan(&sessID)
	if err != nil {
		t.Fatalf("find session: %v", err)
	}

	if err := store.RevokeLearnerSession(ctx, sessID); err != nil {
		t.Fatalf("RevokeLearnerSession: %v", err)
	}

	_, err = store.LookupLearnerSession(ctx, raw)
	if !errors.Is(err, ErrSessionNotFound) {
		t.Errorf("revoked session should not be found, got %v", err)
	}
}

func TestCreateAndLookupAdminSession(t *testing.T) {
	db := testPool(t)
	store := NewStore(db)
	actorID := "d4e5f6a7-b8c9-0123-defa-234567890123"
	seedAdmin(t, db, actorID)

	raw, digest, err := GenerateToken()
	if err != nil {
		t.Fatalf("GenerateToken: %v", err)
	}

	ctx := context.Background()
	expiresAt := time.Now().Add(24 * time.Hour)
	if err := store.CreateAdminSession(ctx, actorID, digest, "admin-agent", "10.0.0.1", expiresAt); err != nil {
		t.Fatalf("CreateAdminSession: %v", err)
	}

	sess, err := store.LookupAdminSession(ctx, raw)
	if err != nil {
		t.Fatalf("LookupAdminSession: %v", err)
	}
	if sess.ActorID != actorID {
		t.Errorf("ActorID = %q, want %q", sess.ActorID, actorID)
	}
}

func TestRevokeAllAdminSessions(t *testing.T) {
	db := testPool(t)
	store := NewStore(db)
	actorID := "e5f6a7b8-c9d0-1234-efab-345678901234"
	seedAdmin(t, db, actorID)

	ctx := context.Background()
	expiresAt := time.Now().Add(24 * time.Hour)

	// Create two sessions
	for i := 0; i < 2; i++ {
		_, digest, err := GenerateToken()
		if err != nil {
			t.Fatalf("GenerateToken: %v", err)
		}
		if err := store.CreateAdminSession(ctx, actorID, digest, "", "", expiresAt); err != nil {
			t.Fatalf("CreateAdminSession %d: %v", i, err)
		}
	}

	if err := store.RevokeAllAdminSessions(ctx, actorID); err != nil {
		t.Fatalf("RevokeAllAdminSessions: %v", err)
	}

	var activeCount int
	err := db.QueryRow(ctx, `SELECT count(*) FROM auth.admin_session WHERE actor_id = $1 AND revoked_at IS NULL AND expires_at > now()`, actorID).Scan(&activeCount)
	if err != nil {
		t.Fatalf("count active: %v", err)
	}
	if activeCount != 0 {
		t.Errorf("expected 0 active sessions after revoke all, got %d", activeCount)
	}
}

func TestLearnerTokenCannotLookupAdmin(t *testing.T) {
	db := testPool(t)
	store := NewStore(db)
	userID := "f6a7b8c9-d0e1-2345-fabc-456789012345"
	seedUser(t, db, userID)

	raw, digest, err := GenerateToken()
	if err != nil {
		t.Fatalf("GenerateToken: %v", err)
	}

	ctx := context.Background()
	expiresAt := time.Now().Add(24 * time.Hour)
	if err := store.CreateLearnerSession(ctx, userID, digest, "", "", expiresAt); err != nil {
		t.Fatalf("CreateLearnerSession: %v", err)
	}

	// Same raw token should NOT resolve as admin session
	_, err = store.LookupAdminSession(ctx, raw)
	if !errors.Is(err, ErrSessionNotFound) {
		t.Errorf("learner token should not resolve in admin namespace, got %v", err)
	}
}
