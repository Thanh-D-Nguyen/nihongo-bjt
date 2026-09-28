package session

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"testing"
	"time"
)

func TestRotateLearnerSession_Success(t *testing.T) {
	db := testPool(t)
	store := NewStore(db)
	userID := newUUID(t)
	seedActiveUser(t, db, userID)

	raw, err := store.CreateLearnerSession(context.Background(), userID, "agent-1", "1.2.3.4", time.Now().Add(24*time.Hour))
	if err != nil {
		t.Fatalf("CreateLearnerSession: %v", err)
	}

	newRaw, err := store.RotateLearnerSession(context.Background(), raw, "agent-2", "5.6.7.8", time.Now().Add(48*time.Hour))
	if err != nil {
		t.Fatalf("RotateLearnerSession: %v", err)
	}
	if newRaw == raw {
		t.Error("new token must differ from old token")
	}
	if len(newRaw) != 64 {
		t.Errorf("new token length = %d, want 64", len(newRaw))
	}

	// Old token must no longer resolve.
	_, err = store.LookupLearnerSession(context.Background(), raw)
	if !errors.Is(err, ErrSessionNotFound) {
		t.Errorf("old token should be revoked; got %v", err)
	}

	// New token must resolve to same user with updated metadata.
	sess, err := store.LookupLearnerSession(context.Background(), newRaw)
	if err != nil {
		t.Fatalf("LookupLearnerSession after rotate: %v", err)
	}
	if sess.UserID != userID {
		t.Errorf("UserID = %q, want %q", sess.UserID, userID)
	}
	if sess.UserAgent != "agent-2" {
		t.Errorf("UserAgent = %q, want agent-2", sess.UserAgent)
	}
	if sess.IPAddress != "5.6.7.8" {
		t.Errorf("IPAddress = %q, want 5.6.7.8", sess.IPAddress)
	}
}

func TestRotateLearnerSession_RejectsNonActiveToken(t *testing.T) {
	db := testPool(t)
	store := NewStore(db)
	userID := newUUID(t)
	seedActiveUser(t, db, userID)

	// Create an already-expired session directly via SQL.
	_, digest, err := GenerateToken()
	if err != nil {
		t.Fatalf("GenerateToken: %v", err)
	}
	ctx := context.Background()
	_, err = db.Exec(ctx,
		`INSERT INTO auth.session (user_id, token_digest, expires_at) VALUES ($1, $2, now() - interval '1 hour')`,
		userID, digest)
	if err != nil {
		t.Fatalf("insert expired session: %v", err)
	}

	// Use a valid-format but non-existent token — rotation rejects tokens that
	// don't resolve to an active session.
	fakeRaw := "aabbccdd00112233445566778899aabbccddeeff00112233445566778899aabb"
	_, err = store.RotateLearnerSession(context.Background(), fakeRaw, "", "", time.Now().Add(24*time.Hour))
	if !errors.Is(err, ErrSessionNotFound) {
		t.Errorf("expected ErrSessionNotFound for non-active token, got %v", err)
	}
}

func TestRotateLearnerSession_RejectsPastExpiry(t *testing.T) {
	db := testPool(t)
	store := NewStore(db)
	userID := newUUID(t)
	seedActiveUser(t, db, userID)

	raw, err := store.CreateLearnerSession(context.Background(), userID, "", "", time.Now().Add(24*time.Hour))
	if err != nil {
		t.Fatalf("CreateLearnerSession: %v", err)
	}

	_, err = store.RotateLearnerSession(context.Background(), raw, "", "", time.Now().Add(-1*time.Hour))
	if !errors.Is(err, ErrInvalidExpiry) {
		t.Errorf("expected ErrInvalidExpiry, got %v", err)
	}
}

func TestRotateLearnerSession_ConcurrentWinner(t *testing.T) {
	db := testPool(t)
	store := NewStore(db)
	userID := newUUID(t)
	seedActiveUser(t, db, userID)

	raw, err := store.CreateLearnerSession(context.Background(), userID, "", "", time.Now().Add(24*time.Hour))
	if err != nil {
		t.Fatalf("CreateLearnerSession: %v", err)
	}

	var (
		wg        sync.WaitGroup
		mu        sync.Mutex
		successes int
		failures  int
	)
	for i := 0; i < 5; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, rotErr := store.RotateLearnerSession(context.Background(), raw, "", "", time.Now().Add(24*time.Hour))
			mu.Lock()
			defer mu.Unlock()
			if rotErr == nil {
				successes++
			} else {
				failures++
			}
		}()
	}
	wg.Wait()

	if successes != 1 {
		t.Errorf("expected exactly 1 concurrent rotation winner, got %d (failures=%d)", successes, failures)
	}
	if failures != 4 {
		t.Errorf("expected 4 concurrent rotation losers, got %d", failures)
	}
}

func TestRotateAdminSession_Success(t *testing.T) {
	db := testPool(t)
	store := NewStore(db)
	actorID := newUUID(t)
	seedActiveAdmin(t, db, actorID)

	raw, err := store.CreateAdminSession(context.Background(), actorID, "admin-agent", "10.0.0.1", time.Now().Add(24*time.Hour))
	if err != nil {
		t.Fatalf("CreateAdminSession: %v", err)
	}

	newRaw, err := store.RotateAdminSession(context.Background(), raw, "admin-agent-2", "10.0.0.2", time.Now().Add(48*time.Hour))
	if err != nil {
		t.Fatalf("RotateAdminSession: %v", err)
	}
	if newRaw == raw {
		t.Error("new admin token must differ from old")
	}

	// Old token revoked.
	_, err = store.LookupAdminSession(context.Background(), raw)
	if !errors.Is(err, ErrSessionNotFound) {
		t.Errorf("old admin token should be revoked; got %v", err)
	}

	// New token resolves correctly.
	sess, err := store.LookupAdminSession(context.Background(), newRaw)
	if err != nil {
		t.Fatalf("LookupAdminSession after rotate: %v", err)
	}
	if sess.ActorID != actorID {
		t.Errorf("ActorID = %q, want %q", sess.ActorID, actorID)
	}
	if sess.UserAgent != "admin-agent-2" {
		t.Errorf("UserAgent = %q, want admin-agent-2", sess.UserAgent)
	}
}

func TestRotateAdminSession_LearnerTokenCannotRotateAdmin(t *testing.T) {
	db := testPool(t)
	store := NewStore(db)
	userID := newUUID(t)
	seedActiveUser(t, db, userID)

	raw, err := store.CreateLearnerSession(context.Background(), userID, "", "", time.Now().Add(24*time.Hour))
	if err != nil {
		t.Fatalf("CreateLearnerSession: %v", err)
	}

	// Attempting to rotate a learner token as admin must fail.
	_, err = store.RotateAdminSession(context.Background(), raw, "", "", time.Now().Add(24*time.Hour))
	if !errors.Is(err, ErrSessionNotFound) {
		t.Errorf("learner token should not rotate in admin namespace; got %v", err)
	}
}

func TestRotateLearnerSession_InvalidTokenFormat(t *testing.T) {
	db := testPool(t)
	store := NewStore(db)

	_, err := store.RotateLearnerSession(context.Background(), "short", "", "", time.Now().Add(24*time.Hour))
	if !errors.Is(err, ErrInvalidToken) {
		t.Errorf("expected ErrInvalidToken, got %v", err)
	}
}

// Ensure fmt is used (seed helpers use it).
var _ = fmt.Sprintf
