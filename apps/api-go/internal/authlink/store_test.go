package authlink

// Characterization tests for the one-time link-code exchange (existing
// behavior, written during the final quality review — not TDD). Real
// PostgreSQL via TEST_DATABASE_URL, like internal/session.

import (
	"context"
	crand "crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func testPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set; skipping integration test (requires disposable PostgreSQL 17 with the canonical schema)")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatalf("connect test DB: %v", err)
	}
	t.Cleanup(pool.Close)
	return pool
}

func newUUID(t *testing.T) string {
	t.Helper()
	var b [16]byte
	if _, err := crand.Read(b[:]); err != nil {
		t.Fatal(err)
	}
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

func seedUser(t *testing.T, db *pgxpool.Pool, status string) (userID, email string) {
	t.Helper()
	userID = newUUID(t)
	email = fmt.Sprintf("link-%s@example.com", userID[:8])
	ctx := context.Background()
	if _, err := db.Exec(ctx,
		`INSERT INTO profile.user_profile (id, display_name, email, status, updated_at) VALUES ($1, 'Link User', $2, $3, now())`,
		userID, email, status); err != nil {
		t.Fatalf("seed user: %v", err)
	}
	t.Cleanup(func() { _, _ = db.Exec(context.Background(), `DELETE FROM profile.user_profile WHERE id = $1`, userID) })
	return userID, email
}

func seedCode(t *testing.T, db *pgxpool.Pool, userID string, expiresIn time.Duration) string {
	t.Helper()
	raw := "code-" + newUUID(t)
	sum := sha256.Sum256([]byte(raw))
	if _, err := db.Exec(context.Background(),
		`INSERT INTO auth.auth_link_code (code_hash, user_id, expires_at) VALUES ($1, $2, $3)`,
		hex.EncodeToString(sum[:]), userID, time.Now().Add(expiresIn)); err != nil {
		t.Fatalf("seed link code: %v", err)
	}
	return raw
}

func TestExchangeCode_SingleUse(t *testing.T) {
	db := testPool(t)
	store := NewStore(db)
	userID, email := seedUser(t, db, "active")
	raw := seedCode(t, db, userID, 5*time.Minute)

	res, err := store.ExchangeCode(context.Background(), raw)
	if err != nil {
		t.Fatalf("first exchange: %v", err)
	}
	if res.UserID != userID || res.DisplayName != "Link User" {
		t.Fatalf("unexpected result: %+v", res)
	}
	if res.EmailMasked == nil || *res.EmailMasked != "l***"+email[len("link-")+8:] {
		t.Fatalf("email not masked as expected: %v", res.EmailMasked)
	}

	if _, err := store.ExchangeCode(context.Background(), raw); !errors.Is(err, ErrInvalidOrExpired) {
		t.Fatalf("replayed code must be rejected with ErrInvalidOrExpired, got %v", err)
	}
}

func TestExchangeCode_ExpiredAndUnknownRejected(t *testing.T) {
	db := testPool(t)
	store := NewStore(db)
	userID, _ := seedUser(t, db, "active")
	expired := seedCode(t, db, userID, -time.Second)

	if _, err := store.ExchangeCode(context.Background(), expired); !errors.Is(err, ErrInvalidOrExpired) {
		t.Fatalf("expired code: want ErrInvalidOrExpired, got %v", err)
	}
	if _, err := store.ExchangeCode(context.Background(), "never-issued"); !errors.Is(err, ErrInvalidOrExpired) {
		t.Fatalf("unknown code: want ErrInvalidOrExpired, got %v", err)
	}
}

func TestExchangeCode_ConcurrentExchangeHasOneWinner(t *testing.T) {
	db := testPool(t)
	store := NewStore(db)
	userID, _ := seedUser(t, db, "active")
	raw := seedCode(t, db, userID, 5*time.Minute)

	const n = 12
	var wg sync.WaitGroup
	results := make(chan error, n)
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := store.ExchangeCode(context.Background(), raw)
			results <- err
		}()
	}
	wg.Wait()
	close(results)
	wins := 0
	for err := range results {
		switch {
		case err == nil:
			wins++
		case errors.Is(err, ErrInvalidOrExpired):
		default:
			t.Errorf("unexpected error: %v", err)
		}
	}
	if wins != 1 {
		t.Fatalf("exactly one concurrent exchange must succeed, got %d", wins)
	}
}

func TestExchangeCode_DisabledUserFailsAndCodeIsBurned(t *testing.T) {
	db := testPool(t)
	store := NewStore(db)
	userID, _ := seedUser(t, db, "disabled")
	raw := seedCode(t, db, userID, 5*time.Minute)

	res, err := store.ExchangeCode(context.Background(), raw)
	if err == nil {
		t.Fatalf("exchange for a disabled user must fail, got %+v", res)
	}
	// Current behavior: the code is consumed before the user check, so it cannot be replayed.
	if _, err := store.ExchangeCode(context.Background(), raw); !errors.Is(err, ErrInvalidOrExpired) {
		t.Fatalf("code must not be replayable after a failed exchange, got %v", err)
	}
}
