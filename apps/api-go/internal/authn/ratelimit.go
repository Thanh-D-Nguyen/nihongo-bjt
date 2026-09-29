// Package authn provides authentication middleware and login abuse protection.
package authn

import (
	"errors"
	"sync"
	"time"
)

// Default rate-limiter tuning. Exported so tests and wiring can reference them
// without re-declaring magic numbers. Production may override via NewRateLimiter.
const (
	DefaultLoginLimit    = 10              // requests per window per key
	DefaultLoginWindow   = 1 * time.Minute // token-bucket reset period
	DefaultLoginTTL      = 5 * time.Minute // idle-key eviction horizon
	DefaultLoginMaxKeys  = 10_000          // hard cap on distinct keys in memory
	DefaultEvictInterval = 30 * time.Second
)

// ErrLimiterFull is returned by Allow when the bucket map is at capacity and
// the key has not been seen before. Callers should treat this as deny (fail
// closed): admitting a new key would require unbounded memory or evicting an
// active victim chosen by an attacker.
var ErrLimiterFull = errors.New("authn: rate limiter at capacity")

// RateLimiter is a bounded in-memory fixed-window counter keyed by string.
// It is safe for concurrent use. Keys not observed within TTL are evicted by
// a background goroutine. When the map reaches MaxKeys, unseen keys are
// rejected with ErrLimiterFull rather than growing without bound or picking
// an attacker-chosen victim to evict.
type RateLimiter struct {
	mu         sync.Mutex
	buckets    map[string]*bucket
	limit      int
	window     time.Duration
	ttl        time.Duration
	maxKeys    int
	evictEvery time.Duration
	stopOnce   sync.Once
	stopCh     chan struct{}
	now        func() time.Time // injectable for tests; defaults to time.Now
}

type bucket struct {
	count    int
	resetAt  time.Time
	lastSeen time.Time
}

// RateLimiterConfig holds validated construction parameters. Use
// ValidateRateLimiterConfig or DefaultRateLimiterConfig to obtain one.
type RateLimiterConfig struct {
	Limit      int
	Window     time.Duration
	TTL        time.Duration
	MaxKeys    int
	EvictEvery time.Duration
}

// DefaultRateLimiterConfig returns production-safe defaults suitable for
// login abuse protection on a single-node Go backend.
func DefaultRateLimiterConfig() RateLimiterConfig {
	return RateLimiterConfig{
		Limit:      DefaultLoginLimit,
		Window:     DefaultLoginWindow,
		TTL:        DefaultLoginTTL,
		MaxKeys:    DefaultLoginMaxKeys,
		EvictEvery: DefaultEvictInterval,
	}
}

// ValidateRateLimiterConfig checks that all fields are positive and that
// EvictEvery does not exceed TTL (otherwise idle keys could outlive their
// bucket). Returns a zero-value config and error on failure.
func ValidateRateLimiterConfig(c RateLimiterConfig) (RateLimiterConfig, error) {
	if c.Limit <= 0 {
		return RateLimiterConfig{}, errors.New("authn: rate limiter limit must be > 0")
	}
	if c.Window <= 0 {
		return RateLimiterConfig{}, errors.New("authn: rate limiter window must be > 0")
	}
	if c.TTL <= 0 {
		return RateLimiterConfig{}, errors.New("authn: rate limiter ttl must be > 0")
	}
	if c.MaxKeys <= 0 {
		return RateLimiterConfig{}, errors.New("authn: rate limiter max_keys must be > 0")
	}
	if c.EvictEvery <= 0 {
		return RateLimiterConfig{}, errors.New("authn: rate limiter evict_every must be > 0")
	}
	if c.EvictEvery > c.TTL {
		return RateLimiterConfig{}, errors.New("authn: rate limiter evict_every must be <= ttl")
	}
	return c, nil
}

// NewRateLimiter creates a bounded rate limiter from a validated config.
// Returns nil and an error if the config is invalid. The caller must call
// Stop when the limiter is no longer needed to release the eviction goroutine.
func NewRateLimiter(cfg RateLimiterConfig) (*RateLimiter, error) {
	v, err := ValidateRateLimiterConfig(cfg)
	if err != nil {
		return nil, err
	}
	rl := &RateLimiter{
		buckets:    make(map[string]*bucket, v.MaxKeys/8),
		limit:      v.Limit,
		window:     v.Window,
		ttl:        v.TTL,
		maxKeys:    v.MaxKeys,
		evictEvery: v.EvictEvery,
		stopCh:     make(chan struct{}),
		now:        time.Now,
	}
	go rl.evictLoop()
	return rl, nil
}

// Allow returns true if the key has remaining capacity in the current window.
// Consumes one token on success. If the map is full and the key is new, it
// returns false and ErrLimiterFull (fail closed). Thread-safe.
func (rl *RateLimiter) Allow(key string) (bool, error) {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := rl.now()
	b, ok := rl.buckets[key]
	if !ok {
		if len(rl.buckets) >= rl.maxKeys {
			return false, ErrLimiterFull
		}
		rl.buckets[key] = &bucket{
			count:    1,
			resetAt:  now.Add(rl.window),
			lastSeen: now,
		}
		return true, nil
	}
	if now.After(b.resetAt) {
		b.count = 1
		b.resetAt = now.Add(rl.window)
		b.lastSeen = now
		return true, nil
	}
	if b.count >= rl.limit {
		b.lastSeen = now
		return false, nil
	}
	b.count++
	b.lastSeen = now
	return true, nil
}

// Stop terminates the eviction goroutine. Safe to call multiple times.
func (rl *RateLimiter) Stop() {
	rl.stopOnce.Do(func() {
		close(rl.stopCh)
	})
}

// Len returns the current number of tracked keys. Exported for tests only.
func (rl *RateLimiter) Len() int {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	return len(rl.buckets)
}

func (rl *RateLimiter) evictLoop() {
	ticker := time.NewTicker(rl.evictEvery)
	defer ticker.Stop()
	for {
		select {
		case <-rl.stopCh:
			return
		case <-ticker.C:
			rl.evict()
		}
	}
}

func (rl *RateLimiter) evict() {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	cutoff := rl.now().Add(-rl.ttl)
	for k, b := range rl.buckets {
		if b.lastSeen.Before(cutoff) {
			delete(rl.buckets, k)
		}
	}
}
