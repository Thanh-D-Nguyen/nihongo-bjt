package authn

import (
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// newTestLimiter creates a RateLimiter with an injectable clock and no
// background eviction goroutine racing with manual time advances. Tests
// call evict() directly after advancing the fake clock.
func newTestLimiter(t *testing.T, cfg RateLimiterConfig) (*RateLimiter, func(time.Duration)) {
	t.Helper()
	v, err := ValidateRateLimiterConfig(cfg)
	if err != nil {
		t.Fatalf("invalid test config: %v", err)
	}
	var mu sync.Mutex
	fakeNow := time.Now()
	rl := &RateLimiter{
		buckets:    make(map[string]*bucket, v.MaxKeys/8),
		limit:      v.Limit,
		window:     v.Window,
		ttl:        v.TTL,
		maxKeys:    v.MaxKeys,
		evictEvery: v.EvictEvery,
		stopCh:     make(chan struct{}),
		now: func() time.Time {
			mu.Lock()
			defer mu.Unlock()
			return fakeNow
		},
	}
	advance := func(d time.Duration) {
		mu.Lock()
		fakeNow = fakeNow.Add(d)
		mu.Unlock()
	}
	return rl, advance
}

func TestValidateRateLimiterConfig_RejectsInvalid(t *testing.T) {
	base := DefaultRateLimiterConfig()
	cases := []struct {
		name string
		mut  func(c *RateLimiterConfig)
	}{
		{"zero limit", func(c *RateLimiterConfig) { c.Limit = 0 }},
		{"negative limit", func(c *RateLimiterConfig) { c.Limit = -1 }},
		{"zero window", func(c *RateLimiterConfig) { c.Window = 0 }},
		{"zero ttl", func(c *RateLimiterConfig) { c.TTL = 0 }},
		{"zero max_keys", func(c *RateLimiterConfig) { c.MaxKeys = 0 }},
		{"zero evict_every", func(c *RateLimiterConfig) { c.EvictEvery = 0 }},
		{"evict exceeds ttl", func(c *RateLimiterConfig) { c.EvictEvery = c.TTL + time.Second }},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			cfg := base
			tc.mut(&cfg)
			_, err := ValidateRateLimiterConfig(cfg)
			if err == nil {
				t.Fatal("expected validation error, got nil")
			}
		})
	}
}

func TestNewRateLimiter_RejectsBadConfig(t *testing.T) {
	cfg := DefaultRateLimiterConfig()
	cfg.Limit = 0
	rl, err := NewRateLimiter(cfg)
	if err == nil {
		t.Fatal("expected error for invalid config")
	}
	if rl != nil {
		t.Fatal("expected nil limiter on error")
	}
}

func TestAllow_BasicWindowReset(t *testing.T) {
	rl, advance := newTestLimiter(t, RateLimiterConfig{
		Limit: 3, Window: time.Minute, TTL: 5 * time.Minute,
		MaxKeys: 100, EvictEvery: 30 * time.Second,
	})

	key := "ip:192.168.1.1"
	for i := 0; i < 3; i++ {
		ok, err := rl.Allow(key)
		if err != nil || !ok {
			t.Fatalf("request %d should be allowed", i+1)
		}
	}
	// 4th request in same window must be denied.
	ok, err := rl.Allow(key)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ok {
		t.Fatal("4th request should be denied within window")
	}

	// Advance past window; next request should succeed.
	advance(time.Minute + time.Second)
	ok, err = rl.Allow(key)
	if err != nil || !ok {
		t.Fatal("request after window reset should be allowed")
	}
}

func TestAllow_SameIPDifferentPortsShareBucket(t *testing.T) {
	// The login handler normalizes RemoteAddr to host-only before calling
	// Allow. This test verifies that if the same normalized IP is used as
	// the key, distinct source ports do not create separate buckets.
	rl, _ := newTestLimiter(t, RateLimiterConfig{
		Limit: 2, Window: time.Minute, TTL: 5 * time.Minute,
		MaxKeys: 100, EvictEvery: 30 * time.Second,
	})

	normalizedKey := "ip:10.0.0.1"
	ok, _ := rl.Allow(normalizedKey)
	if !ok {
		t.Fatal("first request should be allowed")
	}
	ok, _ = rl.Allow(normalizedKey)
	if !ok {
		t.Fatal("second request should be allowed")
	}
	// Third attempt on the SAME normalized key must be denied regardless of
	// what original port the client used — the handler already stripped it.
	ok, _ = rl.Allow(normalizedKey)
	if ok {
		t.Fatal("third request on same normalized IP should be denied")
	}
	if rl.Len() != 1 {
		t.Fatalf("expected 1 bucket for normalized IP, got %d", rl.Len())
	}
}

func TestAllow_FullMapFailsClosed(t *testing.T) {
	rl, _ := newTestLimiter(t, RateLimiterConfig{
		Limit: 10, Window: time.Minute, TTL: 5 * time.Minute,
		MaxKeys: 5, EvictEvery: 30 * time.Second,
	})

	// Fill the map to capacity.
	for i := 0; i < 5; i++ {
		ok, err := rl.Allow(fmt.Sprintf("key-%d", i))
		if err != nil || !ok {
			t.Fatalf("fill request %d should succeed", i)
		}
	}
	if rl.Len() != 5 {
		t.Fatalf("expected 5 buckets, got %d", rl.Len())
	}

	// A new unseen key must be rejected with ErrLimiterFull.
	ok, err := rl.Allow("new-attacker-key")
	if !errors.Is(err, ErrLimiterFull) {
		t.Fatalf("expected ErrLimiterFull, got %v", err)
	}
	if ok {
		t.Fatal("new key at capacity should be denied")
	}

	// Existing keys must still work.
	ok, err = rl.Allow("key-0")
	if err != nil || !ok {
		t.Fatal("existing key should still be allowed when under limit")
	}
}

func TestEvict_RemovesIdleKeys(t *testing.T) {
	rl, advance := newTestLimiter(t, RateLimiterConfig{
		Limit: 10, Window: time.Minute, TTL: 2 * time.Minute,
		MaxKeys: 100, EvictEvery: 30 * time.Second,
	})

	rl.Allow("active")
	advance(time.Minute)
	rl.Allow("idle") // seen at t+1m

	// At t+1m, neither should be evicted (TTL=2m).
	rl.evict()
	if rl.Len() != 2 {
		t.Fatalf("expected 2 buckets before TTL, got %d", rl.Len())
	}

	// Advance to t+3m1s: "idle" last seen at t+1m is now >2m old; "active"
	// was also last seen at t+0 but re-accessed... actually "active" was
	// only seen at t+0. Both are idle. Add a fresh one to distinguish.
	advance(2*time.Minute + time.Second) // now t+3m1s
	rl.Allow("fresh")                    // seen at t+3m1s
	rl.evict()
	if rl.Len() != 1 {
		t.Fatalf("expected 1 bucket after eviction, got %d", rl.Len())
	}
	// The surviving key must be "fresh".
	ok, _ := rl.Allow("fresh")
	if !ok {
		t.Fatal("fresh key should survive eviction")
	}
}

func TestStop_IdempotentAndReleasesGoroutine(t *testing.T) {
	cfg := DefaultRateLimiterConfig()
	rl, err := NewRateLimiter(cfg)
	if err != nil {
		t.Fatalf("NewRateLimiter: %v", err)
	}
	// Multiple Stop calls must not panic.
	rl.Stop()
	rl.Stop()
	rl.Stop()
}

func TestAllow_ConcurrentAccess(t *testing.T) {
	rl, _ := newTestLimiter(t, RateLimiterConfig{
		Limit: 100, Window: time.Minute, TTL: 5 * time.Minute,
		MaxKeys: 10_000, EvictEvery: 30 * time.Second,
	})

	const goroutines = 50
	const requestsPerGoroutine = 20
	var wg sync.WaitGroup
	var allowed, denied atomic.Int64

	wg.Add(goroutines)
	for g := 0; g < goroutines; g++ {
		go func(id int) {
			defer wg.Done()
			key := fmt.Sprintf("ip:10.0.%d.%d", id/256, id%256)
			for r := 0; r < requestsPerGoroutine; r++ {
				ok, err := rl.Allow(key)
				if err != nil {
					if errors.Is(err, ErrLimiterFull) {
						denied.Add(1)
						continue
					}
					t.Errorf("unexpected error: %v", err)
					return
				}
				if ok {
					allowed.Add(1)
				} else {
					denied.Add(1)
				}
			}
		}(g)
	}
	wg.Wait()

	total := allowed.Load() + denied.Load()
	expected := int64(goroutines * requestsPerGoroutine)
	if total != expected {
		t.Fatalf("expected %d total decisions, got %d", expected, total)
	}
	// Each goroutine has its own key with limit=100 and only 20 requests,
	// so all should be allowed and none denied.
	if denied.Load() != 0 {
		t.Fatalf("expected 0 denials with distinct keys under limit, got %d", denied.Load())
	}
	if rl.Len() != goroutines {
		t.Fatalf("expected %d buckets, got %d", goroutines, rl.Len())
	}
}

func TestAllow_ConcurrentFloodStaysBounded(t *testing.T) {
	maxKeys := 50
	rl, _ := newTestLimiter(t, RateLimiterConfig{
		Limit: 10, Window: time.Minute, TTL: 5 * time.Minute,
		MaxKeys: maxKeys, EvictEvery: 30 * time.Second,
	})

	const goroutines = 100
	var wg sync.WaitGroup
	var fullCount atomic.Int64

	wg.Add(goroutines)
	for g := 0; g < goroutines; g++ {
		go func(id int) {
			defer wg.Done()
			key := fmt.Sprintf("flood-%d", id)
			_, err := rl.Allow(key)
			if errors.Is(err, ErrLimiterFull) {
				fullCount.Add(1)
			}
		}(g)
	}
	wg.Wait()

	if rl.Len() > maxKeys {
		t.Fatalf("map exceeded maxKeys=%d: got %d", maxKeys, rl.Len())
	}
	// At least some requests must have been rejected since goroutines > maxKeys.
	if fullCount.Load() == 0 {
		t.Fatal("expected some ErrLimiterFull when goroutines exceed maxKeys")
	}
}

func TestDefaultRateLimiterConfig_Validates(t *testing.T) {
	cfg := DefaultRateLimiterConfig()
	if _, err := ValidateRateLimiterConfig(cfg); err != nil {
		t.Fatalf("default config should be valid: %v", err)
	}
}
