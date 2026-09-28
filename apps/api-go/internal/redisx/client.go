// Package redisx provides Redis client setup via go-redis/v9.
package redisx

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// ClientConfig holds Redis client configuration.
type ClientConfig struct {
	URL string
}

// NewClient creates a new Redis client from the given URL.
// Returns nil, nil if url is empty (Redis is optional).
// Returns safe error messages that never contain connection strings or credentials.
func NewClient(cfg ClientConfig) (*redis.Client, error) {
	if cfg.URL == "" {
		return nil, nil
	}
	opts, err := redis.ParseURL(cfg.URL)
	if err != nil {
		return nil, fmt.Errorf("redis: invalid connection configuration")
	}
	client := redis.NewClient(opts)
	return client, nil
}

// Pinger is the interface used by readiness checks to verify Redis connectivity.
type Pinger interface {
	Ping(ctx context.Context) *redis.StatusCmd
}

// Ping checks connectivity to Redis with a bounded timeout.
func Ping(ctx context.Context, p Pinger) error {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	return p.Ping(ctx).Err()
}
