package session

import (
	"context"
	crand "crypto/rand"
	"errors"
	"fmt"
	"os"
	"strings"
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
		t.Skip("TEST_DATABASE_URL not set; skipping integration test (requires disposable PostgreSQL 17 with M2 schema)")
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

// newUUID generates a real UUID v4 via crypto/rand for test PK columns.
func newUUID(t *testing.T) string {
	t.Helper()
	var b [16]byte
	if _, err := crand.Read(b[:]); err != nil {
		t.Fatalf("crypto/rand: %v", err)
	}
	b[6] = (b[6] & 0x0f) | 0x40 // version 4
	b[8] = (b[8] & 0x3f) | 0x80 // variant RFC4122
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x",
		b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

// seedActiveUser inserts an active profile.user_profile row for FK satisfaction.
func seedActiveUser(t *testing.T, db *pgxpool.Pool, userID string) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err := db.Exec(ctx,
		`INSERT INTO profile.user_profile (id, display_name, email, status) VALUES ($1, 'Test User', $2, 'active') ON CONFLICT (id) DO UPDATE SET status = 'active'`,
		userID, fmt.Sprintf("test-%s@example.com", userID[:8]))
	if err != nil {
		t.Fatalf("seed active user failed: %v", err)
	}
}

// seedDisabledUser inserts a disabled profile.user_profile row.
func seedDisabledUser(t *testing.T, db *pgxpool.Pool, userID string) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err := db.Exec(ctx,
		`INSERT INTO profile.user_profile (id, display_name, email, status) VALUES ($1, 'Disabled User', $2, 'disabled') ON CONFLICT (id) DO UPDATE SET status = 'disabled'`,
		userID, fmt.Sprintf("disabled-%s@example.com", userID[:8]))
	if err != nil {
		t.Fatalf("seed disabled user failed: %v", err)
	}
}

// seedActiveAdmin inserts an active authz.admin_actor row.
func seedActiveAdmin(t *testing.T, db *pgxpool.Pool, actorID string) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err := db.Exec(ctx,
		`INSERT INTO authz.admin_actor (id, display_name, email, status) VALUES ($1, 'Test Admin', $2, 'active') ON CONFLICT (id) DO UPDATE SET status = 'active'`,
		actorID, fmt.Sprintf("admin-%s@example.com", actorID[:8]))
	if err != nil {
		t.Fatalf("seed active admin failed: %v", err)
	}
}

// seedDisabledAdmin inserts a disabled authz.admin_actor row.
func seedDisabledAdmin(t *testing.T, db *pgxpool.Pool, actorID string) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err := db.Exec(ctx,
		`INSERT INTO authz.admin_actor (id, display_name, email, status) VALUES ($1, 'Disabled Admin', $2, 'disabled') ON CONFLICT (id) DO UPDATE SET status = 'disabled'`,
		actorID, fmt.Sprintf("disabled-admin-%s@example.com", actorID[:8]))
	if err != nil {
		t.Fatalf("seed disabled admin failed: %v", err)
	}
}

func TestCreateAndLookupLearnerSession(t *testing.T) {
	db := testPool(t)
	store := NewStore(db)
	userID := newUUID(t)
	seedActiveUser(t, db, userID)

	raw, err := store.CreateLearnerSession(context.Background(), userID, "test-agent", "127.0.0.1", time.Now().Add(24*time.Hour))
	if err != nil {
		t.Fatalf("CreateLearnerSession: %v", err)
	}
	if len(raw) != 64 {
		t.Errorf("raw token length = %d, want 64", len(raw))
	}

	sess, err := store.LookupLearnerSession(context.Background(), raw)
	if err != nil {
		t.Fatalf("LookupLearnerSession: %v", err)
	}
	if sess.UserID != userID {
		t.Errorf("UserID = %q, want %q", sess.UserID, userID)
	}
	if sess.UserAgent != "test-agent" {
		t.Errorf("UserAgent = %q, want %q", sess.UserAgent, "test-agent")
	}
	if sess.IPAddress != "127.0.0.1" {
		t.Errorf("IPAddress = %q, want %q", sess.IPAddress, "127.0.0.1")
	}

	// Verify DB stores digest, not raw token
	digest := HashToken(raw)
	var storedDigest string
	err = db.QueryRow(context.Background(), `SELECT token_digest FROM auth.session WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`, userID).Scan(&storedDigest)
	if err != nil {
		t.Fatalf("query stored digest: %v", err)
	}
	if storedDigest != digest {
		t.Errorf("stored digest mismatch: got %q, want %q", storedDigest, digest)
	}
	if storedDigest == raw {
		t.Error("DB must NOT store raw token")
	}
}

func TestLookupLearnerSession_NotFound(t *testing.T) {
	db := testPool(t)
	store := NewStore(db)

	fakeToken := strings.Repeat("a", 64)
	_, err := store.LookupLearnerSession(context.Background(), fakeToken)
	if !errors.Is(err, ErrSessionNotFound) {
		t.Errorf("expected ErrSessionNotFound, got %v", err)
	}
}

func TestLookupLearnerSession_InvalidTokenFormat(t *testing.T) {
	db := testPool(t)
	store := NewStore(db)

	cases := []struct {
		name  string
		token string
	}{
		{"empty", ""},
		{"too_short", strings.Repeat("a", 32)},
		{"too_long", strings.Repeat("a", 128)},
		{"non_hex", strings.Repeat("g", 64)},
		{"uppercase_hex", strings.Repeat("A", 64)},
		{"mixed_case", strings.Repeat("aB", 32)},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := store.LookupLearnerSession(context.Background(), tc.token)
			if !errors.Is(err, ErrSessionNotFound) {
				t.Errorf("expected ErrSessionNotFound for invalid token %q, got %v", tc.name, err)
			}
		})
	}
}

func TestLookupLearnerSession_Expired(t *testing.T) {
	db := testPool(t)
	store := NewStore(db)
	userID := newUUID(t)
	seedActiveUser(t, db, userID)

	// Create a valid session first to get a real raw token
	raw, err := store.CreateLearnerSession(context.Background(), userID, "", "", time.Now().Add(24*time.Hour))
	if err != nil {
		t.Fatalf("CreateLearnerSession: %v", err)
	}

	// Manually expire the session in DB (bypasses Store's future-expiry guard)
	digest := HashToken(raw)
	_, err = db.Exec(context.Background(),
		`UPDATE auth.session SET expires_at = now() - interval '1 hour' WHERE token_digest = $1`, digest)
	if err != nil {
		t.Fatalf("expire session: %v", err)
	}

	// Lookup with the original raw token must return ErrSessionNotFound
	_, err = store.LookupLearnerSession(context.Background(), raw)
	if !errors.Is(err, ErrSessionNotFound) {
		t.Errorf("expected ErrSessionNotFound for expired session, got %v", err)
	}
}

func TestCreateLearnerSession_RejectsPastExpiry(t *testing.T) {
	db := testPool(t)
	store := NewStore(db)
	userID := newUUID(t)
	seedActiveUser(t, db, userID)

	_, err := store.CreateLearnerSession(context.Background(), userID, "", "", time.Now().Add(-1*time.Hour))
	if !errors.Is(err, ErrInvalidExpiry) {
		t.Errorf("expected ErrInvalidExpiry, got %v", err)
	}
}

func TestRevokeLearnerSession_OwnerScoped(t *testing.T) {
	db := testPool(t)
	store := NewStore(db)

	victimID := newUUID(t)
	attackerID := newUUID(t)
	seedActiveUser(t, db, victimID)
	seedActiveUser(t, db, attackerID)

	victimRaw, err := store.CreateLearnerSession(context.Background(), victimID, "", "", time.Now().Add(24*time.Hour))
	if err != nil {
		t.Fatalf("create victim session: %v", err)
	}

	// Get victim session ID
	var victimSessID string
	err = db.QueryRow(context.Background(),
		`SELECT id FROM auth.session WHERE user_id = $1 AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1`, victimID).Scan(&victimSessID)
	if err != nil {
		t.Fatalf("find victim session: %v", err)
	}

	// Attacker tries to revoke victim's session using their own userID
	err = store.RevokeLearnerSession(context.Background(), victimSessID, attackerID)
	if err != nil {
		t.Fatalf("RevokeLearnerSession should not error on wrong owner: %v", err)
	}

	// Victim's session should still be active
	_, err = store.LookupLearnerSession(context.Background(), victimRaw)
	if err != nil {
		t.Errorf("cross-owner revoke should NOT affect victim session, got %v", err)
	}

	// Now revoke with correct owner
	err = store.RevokeLearnerSession(context.Background(), victimSessID, victimID)
	if err != nil {
		t.Fatalf("RevokeLearnerSession with correct owner: %v", err)
	}

	_, err = store.LookupLearnerSession(context.Background(), victimRaw)
	if !errors.Is(err, ErrSessionNotFound) {
		t.Errorf("revoked session should not be found, got %v", err)
	}
}

func TestLookupLearnerSession_DisabledUser(t *testing.T) {
	db := testPool(t)
	store := NewStore(db)
	userID := newUUID(t)
	seedActiveUser(t, db, userID)

	raw, err := store.CreateLearnerSession(context.Background(), userID, "", "", time.Now().Add(24*time.Hour))
	if err != nil {
		t.Fatalf("CreateLearnerSession: %v", err)
	}

	// Disable the user after session creation
	seedDisabledUser(t, db, userID)

	_, err = store.LookupLearnerSession(context.Background(), raw)
	if !errors.Is(err, ErrSessionNotFound) {
		t.Errorf("disabled user session should return ErrSessionNotFound, got %v", err)
	}
}

func TestCreateAndLookupAdminSession(t *testing.T) {
	db := testPool(t)
	store := NewStore(db)
	actorID := newUUID(t)
	seedActiveAdmin(t, db, actorID)

	raw, err := store.CreateAdminSession(context.Background(), actorID, "admin-agent", "10.0.0.1", time.Now().Add(24*time.Hour))
	if err != nil {
		t.Fatalf("CreateAdminSession: %v", err)
	}

	sess, err := store.LookupAdminSession(context.Background(), raw)
	if err != nil {
		t.Fatalf("LookupAdminSession: %v", err)
	}
	if sess.ActorID != actorID {
		t.Errorf("ActorID = %q, want %q", sess.ActorID, actorID)
	}
	if sess.UserAgent != "admin-agent" {
		t.Errorf("UserAgent = %q, want %q", sess.UserAgent, "admin-agent")
	}
}

func TestLookupAdminSession_DisabledActor(t *testing.T) {
	db := testPool(t)
	store := NewStore(db)
	actorID := newUUID(t)
	seedActiveAdmin(t, db, actorID)

	raw, err := store.CreateAdminSession(context.Background(), actorID, "", "", time.Now().Add(24*time.Hour))
	if err != nil {
		t.Fatalf("CreateAdminSession: %v", err)
	}

	// Disable the admin after session creation
	seedDisabledAdmin(t, db, actorID)

	_, err = store.LookupAdminSession(context.Background(), raw)
	if !errors.Is(err, ErrSessionNotFound) {
		t.Errorf("disabled admin session should return ErrSessionNotFound, got %v", err)
	}
}

func TestRevokeAllAdminSessions(t *testing.T) {
	db := testPool(t)
	store := NewStore(db)
	actorID := newUUID(t)
	seedActiveAdmin(t, db, actorID)

	ctx := context.Background()
	expiresAt := time.Now().Add(24 * time.Hour)

	// Create two sessions
	for i := 0; i < 2; i++ {
		_, err := store.CreateAdminSession(ctx, actorID, "", "", expiresAt)
		if err != nil {
			t.Fatalf("CreateAdminSession %d: %v", i, err)
		}
	}

	if err := store.RevokeAllAdminSessions(ctx, actorID); err != nil {
		t.Fatalf("RevokeAllAdminSessions: %v", err)
	}

	var activeCount int
	err := db.QueryRow(ctx,
		`SELECT count(*) FROM auth.admin_session WHERE actor_id = $1 AND revoked_at IS NULL AND expires_at > now()`,
		actorID).Scan(&activeCount)
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
	userID := newUUID(t)
	seedActiveUser(t, db, userID)

	raw, err := store.CreateLearnerSession(context.Background(), userID, "", "", time.Now().Add(24*time.Hour))
	if err != nil {
		t.Fatalf("CreateLearnerSession: %v", err)
	}

	// Same raw token should NOT resolve as admin session
	_, err = store.LookupAdminSession(context.Background(), raw)
	if !errors.Is(err, ErrSessionNotFound) {
		t.Errorf("learner token should not resolve in admin namespace, got %v", err)
	}
}

func TestAdminTokenCannotLookupLearner(t *testing.T) {
	db := testPool(t)
	store := NewStore(db)
	actorID := newUUID(t)
	seedActiveAdmin(t, db, actorID)

	raw, err := store.CreateAdminSession(context.Background(), actorID, "", "", time.Now().Add(24*time.Hour))
	if err != nil {
		t.Fatalf("CreateAdminSession: %v", err)
	}

	_, err = store.LookupLearnerSession(context.Background(), raw)
	if !errors.Is(err, ErrSessionNotFound) {
		t.Errorf("admin token should not resolve in learner namespace, got %v", err)
	}
}

func TestCreateAdminSession_RejectsPastExpiry(t *testing.T) {
	db := testPool(t)
	store := NewStore(db)
	actorID := newUUID(t)
	seedActiveAdmin(t, db, actorID)

	_, err := store.CreateAdminSession(context.Background(), actorID, "", "", time.Now().Add(-1*time.Second))
	if !errors.Is(err, ErrInvalidExpiry) {
		t.Errorf("expected ErrInvalidExpiry, got %v", err)
	}
}

func TestRevokeAdminSession_OwnerScoped(t *testing.T) {
	db := testPool(t)
	store := NewStore(db)

	victimID := newUUID(t)
	attackerID := newUUID(t)
	seedActiveAdmin(t, db, victimID)
	seedActiveAdmin(t, db, attackerID)

	victimRaw, err := store.CreateAdminSession(context.Background(), victimID, "", "", time.Now().Add(24*time.Hour))
	if err != nil {
		t.Fatalf("create victim admin session: %v", err)
	}

	var victimSessID string
	err = db.QueryRow(context.Background(),
		`SELECT id FROM auth.admin_session WHERE actor_id = $1 AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1`, victimID).Scan(&victimSessID)
	if err != nil {
		t.Fatalf("find victim admin session: %v", err)
	}

	// Attacker tries to revoke victim's session
	err = store.RevokeAdminSession(context.Background(), victimSessID, attackerID)
	if err != nil {
		t.Fatalf("RevokeAdminSession should not error on wrong owner: %v", err)
	}

	// Victim's session should still be active
	_, err = store.LookupAdminSession(context.Background(), victimRaw)
	if err != nil {
		t.Errorf("cross-owner revoke should NOT affect victim admin session, got %v", err)
	}
}

func TestRotateLearnerSession_RejectsExpiredToken(t *testing.T) {
	db := testPool(t)
	store := NewStore(db)
	userID := newUUID(t)
	seedActiveUser(t, db, userID)

	raw, err := store.CreateLearnerSession(context.Background(), userID, "", "", time.Now().Add(24*time.Hour))
	if err != nil {
		t.Fatalf("CreateLearnerSession: %v", err)
	}

	// Expire the session directly in DB
	digest := HashToken(raw)
	_, err = db.Exec(context.Background(),
		`UPDATE auth.session SET expires_at = now() - interval '1 hour' WHERE token_digest = $1`, digest)
	if err != nil {
		t.Fatalf("expire session: %v", err)
	}

	_, err = store.RotateLearnerSession(context.Background(), raw, "", "", time.Now().Add(24*time.Hour))
	if !errors.Is(err, ErrSessionNotFound) {
		t.Errorf("expected ErrSessionNotFound for expired token rotation, got %v", err)
	}
}

func TestRotateLearnerSession_RejectsRevokedToken(t *testing.T) {
	db := testPool(t)
	store := NewStore(db)
	userID := newUUID(t)
	seedActiveUser(t, db, userID)

	raw, err := store.CreateLearnerSession(context.Background(), userID, "", "", time.Now().Add(24*time.Hour))
	if err != nil {
		t.Fatalf("CreateLearnerSession: %v", err)
	}

	// Get session ID and revoke via Store
	var sessID string
	err = db.QueryRow(context.Background(),
		`SELECT id FROM auth.session WHERE user_id = $1 AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1`, userID).Scan(&sessID)
	if err != nil {
		t.Fatalf("find session: %v", err)
	}
	if err := store.RevokeLearnerSession(context.Background(), sessID, userID); err != nil {
		t.Fatalf("RevokeLearnerSession: %v", err)
	}

	_, err = store.RotateLearnerSession(context.Background(), raw, "", "", time.Now().Add(24*time.Hour))
	if !errors.Is(err, ErrSessionNotFound) {
		t.Errorf("expected ErrSessionNotFound for revoked token rotation, got %v", err)
	}
}

func TestRotateLearnerSession_RejectsDisabledUser(t *testing.T) {
	db := testPool(t)
	store := NewStore(db)
	userID := newUUID(t)
	seedActiveUser(t, db, userID)

	raw, err := store.CreateLearnerSession(context.Background(), userID, "", "", time.Now().Add(24*time.Hour))
	if err != nil {
		t.Fatalf("CreateLearnerSession: %v", err)
	}

	// Disable the user after session creation
	seedDisabledUser(t, db, userID)

	_, err = store.RotateLearnerSession(context.Background(), raw, "", "", time.Now().Add(24*time.Hour))
	if !errors.Is(err, ErrSessionNotFound) {
		t.Errorf("expected ErrSessionNotFound for disabled user rotation, got %v", err)
	}
}

func TestRotateAdminSession_RejectsDisabledActor(t *testing.T) {
	db := testPool(t)
	store := NewStore(db)
	actorID := newUUID(t)
	seedActiveAdmin(t, db, actorID)

	raw, err := store.CreateAdminSession(context.Background(), actorID, "", "", time.Now().Add(24*time.Hour))
	if err != nil {
		t.Fatalf("CreateAdminSession: %v", err)
	}

	// Disable the admin after session creation
	seedDisabledAdmin(t, db, actorID)

	_, err = store.RotateAdminSession(context.Background(), raw, "", "", time.Now().Add(24*time.Hour))
	if !errors.Is(err, ErrSessionNotFound) {
		t.Errorf("expected ErrSessionNotFound for disabled admin rotation, got %v", err)
	}
}

func TestRotateAdminSession_ConcurrentWinner(t *testing.T) {
	db := testPool(t)
	store := NewStore(db)
	actorID := newUUID(t)
	seedActiveAdmin(t, db, actorID)

	raw, err := store.CreateAdminSession(context.Background(), actorID, "", "", time.Now().Add(24*time.Hour))
	if err != nil {
		t.Fatalf("CreateAdminSession: %v", err)
	}

	type result struct {
		raw string
		err error
	}
	ch := make(chan result, 2)
	for i := 0; i < 2; i++ {
		go func() {
			newRaw, rotErr := store.RotateAdminSession(context.Background(), raw, "", "", time.Now().Add(24*time.Hour))
			ch <- result{newRaw, rotErr}
		}()
	}

	r1 := <-ch
	r2 := <-ch

	var winner, loser result
	if r1.err == nil && errors.Is(r2.err, ErrSessionNotFound) {
		winner, loser = r1, r2
	} else if r2.err == nil && errors.Is(r1.err, ErrSessionNotFound) {
		winner, loser = r2, r1
	} else {
		t.Fatalf("expected exactly one winner and one ErrSessionNotFound; got (%v, %v)", r1.err, r2.err)
	}

	if winner.raw == "" {
		t.Error("winner returned empty raw token")
	}
	if !errors.Is(loser.err, ErrSessionNotFound) {
		t.Errorf("loser expected ErrSessionNotFound, got %v", loser.err)
	}

	// Winner's new token must be valid
	sess, err := store.LookupAdminSession(context.Background(), winner.raw)
	if err != nil {
		t.Fatalf("winner token lookup failed: %v", err)
	}
	if sess.ActorID != actorID {
		t.Errorf("winner session ActorID = %q, want %q", sess.ActorID, actorID)
	}

	// Old token must no longer work
	_, err = store.LookupAdminSession(context.Background(), raw)
	if !errors.Is(err, ErrSessionNotFound) {
		t.Errorf("old token should be invalid after rotation, got %v", err)
	}
}

func TestRotateAdminSession_RejectsRevokedToken(t *testing.T) {
	db := testPool(t)
	store := NewStore(db)
	actorID := newUUID(t)
	seedActiveAdmin(t, db, actorID)

	raw, err := store.CreateAdminSession(context.Background(), actorID, "", "", time.Now().Add(24*time.Hour))
	if err != nil {
		t.Fatalf("CreateAdminSession: %v", err)
	}

	// Obtain session ID and revoke through Store with correct owner
	var sessID string
	err = db.QueryRow(context.Background(),
		`SELECT id FROM auth.admin_session WHERE actor_id = $1 AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1`, actorID).Scan(&sessID)
	if err != nil {
		t.Fatalf("find admin session: %v", err)
	}
	if err := store.RevokeAdminSession(context.Background(), sessID, actorID); err != nil {
		t.Fatalf("RevokeAdminSession: %v", err)
	}

	// Rotation with the same raw token must fail
	_, err = store.RotateAdminSession(context.Background(), raw, "", "", time.Now().Add(24*time.Hour))
	if !errors.Is(err, ErrSessionNotFound) {
		t.Errorf("expected ErrSessionNotFound for revoked admin token rotation, got %v", err)
	}
}
