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
func NewClient(cfg ClientConfig) (*redis.Client, error) {
	if cfg.URL == "" {
		return nil, nil
	}
	opts, err := redis.ParseURL(cfg.URL)
	if err != nil {
		return nil, fmt.Errorf("redis: parse url: %w", err)
	}
	client := redis.NewClient(opts)
	return client, nil
}

// Ping checks connectivity to Redis with a bounded timeout.
func Ping(ctx context.Context, client *redis.Client) error {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	return client.Ping(ctx).Err()
}
