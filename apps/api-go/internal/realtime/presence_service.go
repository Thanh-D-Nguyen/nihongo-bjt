package realtime

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	// presenceOnlineKey is the Redis hash tracking online users (matches NestJS).
	presenceOnlineKey = "presence:online"
	// presenceLastSeenKey is the Redis hash tracking last-seen timestamps (matches NestJS).
	presenceLastSeenKey = "presence:last_seen"
	// heartbeatTTLSeconds is the staleness threshold for presence (matches NestJS).
	heartbeatTTLSeconds = 90
)

// PresenceService provides Redis-backed presence tracking compatible with the
// NestJS PresenceService key schema for cross-compatibility during transition.
type PresenceService struct {
	rdb *redis.Client
}

// NewPresenceService creates a presence service backed by the given Redis client.
// Returns nil if rdb is nil (presence disabled).
func NewPresenceService(rdb *redis.Client) *PresenceService {
	if rdb == nil {
		return nil
	}
	return &PresenceService{rdb: rdb}
}

// SetOnline marks a user as online with the current timestamp.
func (ps *PresenceService) SetOnline(ctx context.Context, userID string) error {
	if ps == nil {
		return nil
	}
	now := strconv.FormatInt(time.Now().UnixMilli(), 10)
	pipe := ps.rdb.Pipeline()
	pipe.HSet(ctx, presenceOnlineKey, userID, now)
	pipe.HSet(ctx, presenceLastSeenKey, userID, now)
	_, err := pipe.Exec(ctx)
	return err
}

// SetOffline removes a user from the online set and updates last-seen.
func (ps *PresenceService) SetOffline(ctx context.Context, userID string) error {
	if ps == nil {
		return nil
	}
	now := strconv.FormatInt(time.Now().UnixMilli(), 10)
	pipe := ps.rdb.Pipeline()
	pipe.HDel(ctx, presenceOnlineKey, userID)
	pipe.HSet(ctx, presenceLastSeenKey, userID, now)
	_, err := pipe.Exec(ctx)
	return err
}

// IsOnline checks whether a single user is currently online (within TTL).
func (ps *PresenceService) IsOnline(ctx context.Context, userID string) (bool, error) {
	if ps == nil {
		return false, nil
	}
	ts, err := ps.rdb.HGet(ctx, presenceOnlineKey, userID).Result()
	if err == redis.Nil {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	ms, err := strconv.ParseInt(ts, 10, 64)
	if err != nil {
		return false, nil
	}
	return time.Now().UnixMilli()-ms < heartbeatTTLSeconds*1000, nil
}

// PresenceInfo holds online status and last-seen timestamp for a user.
type PresenceInfo struct {
	Online     bool    `json:"online"`
	LastSeenAt *string `json:"lastSeenAt"`
}

// GetPresenceBatch returns presence info for multiple users at once.
func (ps *PresenceService) GetPresenceBatch(ctx context.Context, userIDs []string) (map[string]PresenceInfo, error) {
	result := make(map[string]PresenceInfo, len(userIDs))
	if ps == nil || len(userIDs) == 0 {
		return result, nil
	}

	onlinePipe := ps.rdb.Pipeline()
	lastSeenPipe := ps.rdb.Pipeline()
	onlineCmds := make([]*redis.StringCmd, len(userIDs))
	lastSeenCmds := make([]*redis.StringCmd, len(userIDs))

	for i, uid := range userIDs {
		onlineCmds[i] = onlinePipe.HGet(ctx, presenceOnlineKey, uid)
		lastSeenCmds[i] = lastSeenPipe.HGet(ctx, presenceLastSeenKey, uid)
	}
	_, _ = onlinePipe.Exec(ctx)
	_, _ = lastSeenPipe.Exec(ctx)

	now := time.Now().UnixMilli()
	for i, uid := range userIDs {
		info := PresenceInfo{}

		onlineTs, err := onlineCmds[i].Result()
		if err == nil && onlineTs != "" {
			ms, parseErr := strconv.ParseInt(onlineTs, 10, 64)
			if parseErr == nil && now-ms < heartbeatTTLSeconds*1000 {
				info.Online = true
			}
		}

		lastSeenTs, err := lastSeenCmds[i].Result()
		if err == nil && lastSeenTs != "" {
			ms, parseErr := strconv.ParseInt(lastSeenTs, 10, 64)
			if parseErr == nil {
				t := time.UnixMilli(ms).UTC().Format(time.RFC3339)
				info.LastSeenAt = &t
			}
		}

		result[uid] = info
	}
	return result, nil
}

// Heartbeat refreshes a user's online timestamp.
func (ps *PresenceService) Heartbeat(ctx context.Context, userID string) error {
	return ps.SetOnline(ctx, userID)
}

// CleanupStale removes entries from the online set that exceed the TTL.
// Returns the number of stale entries removed.
func (ps *PresenceService) CleanupStale(ctx context.Context) (int, error) {
	if ps == nil {
		return 0, nil
	}
	all, err := ps.rdb.HGetAll(ctx, presenceOnlineKey).Result()
	if err != nil {
		return 0, fmt.Errorf("cleanup stale: %w", err)
	}
	now := time.Now().UnixMilli()
	var staleIDs []string
	for uid, ts := range all {
		ms, parseErr := strconv.ParseInt(ts, 10, 64)
		if parseErr != nil || now-ms >= heartbeatTTLSeconds*1000 {
			staleIDs = append(staleIDs, uid)
		}
	}
	if len(staleIDs) > 0 {
		if err := ps.rdb.HDel(ctx, presenceOnlineKey, staleIDs...).Err(); err != nil {
			return 0, fmt.Errorf("cleanup stale delete: %w", err)
		}
	}
	return len(staleIDs), nil
}

// GetOnlineCount returns the number of users in the online set.
func (ps *PresenceService) GetOnlineCount(ctx context.Context) (int64, error) {
	if ps == nil {
		return 0, nil
	}
	return ps.rdb.HLen(ctx, presenceOnlineKey).Result()
}
