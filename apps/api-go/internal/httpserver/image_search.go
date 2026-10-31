package httpserver

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/imagesearch"
	"github.com/redis/go-redis/v9"
)

const imageSearchLimit = 30

// ImageSearchService coordinates shared provider access and per-user limits.
type ImageSearchService struct {
	redis     *redis.Client
	client    *imagesearch.Client
	namespace string
	timeout   time.Duration
}

func imageSearchHash(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])
}

// NewImageSearchService disables Pixabay when durable storage is unavailable.
// Providers are tried in order: Unsplash, Pixabay, Pexels, Wikimedia Commons.
func NewImageSearchService(client *redis.Client, db *pgxpool.Pool, unsplashKey, pixabayKey, pexelsKey string, writeTimeout time.Duration) *ImageSearchService {
	return newImageSearchService(client, db, unsplashKey, pixabayKey, pexelsKey, nil, writeTimeout)
}
func newImageSearchService(client *redis.Client, db *pgxpool.Pool, unsplashKey, pixabayKey, pexelsKey string, httpClient *http.Client, writeTimeout time.Duration) *ImageSearchService {
	timeout := 12 * time.Second
	if writeTimeout > 0 && writeTimeout <= timeout+time.Second {
		timeout = writeTimeout / 2
	}
	if httpClient == nil {
		httpClient = &http.Client{}
	}
	copyClient := *httpClient
	if copyClient.Timeout <= 0 || copyClient.Timeout > 3*time.Second {
		copyClient.Timeout = 3 * time.Second
	}
	namespace := imageSearchHash(pixabayKey)
	var cache imagesearch.Cache
	if db != nil {
		cache = imageSearchDurableCache{db: db, namespace: namespace}
	}
	return &ImageSearchService{redis: client, client: imagesearch.New(&copyClient, unsplashKey, pixabayKey, cache, imagesearch.WithPexelsKey(pexelsKey), imagesearch.WithResultFilter(validSelectionImage)), namespace: namespace, timeout: timeout}
}

var imageSearchLimitScript = redis.NewScript(`
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
return count
`)

// Allow applies a shared fixed-window limit to the authenticated user.
func (s *ImageSearchService) Allow(ctx context.Context, userID string) (bool, error) {
	if s == nil || s.redis == nil || userID == "" {
		return false, errors.New("image search limiter unavailable")
	}
	ctx, cancel := context.WithTimeout(ctx, min(time.Second, s.timeout/4))
	defer cancel()
	n, err := imageSearchLimitScript.Run(ctx, s.redis, []string{"image-search:limit:" + imageSearchHash(userID)}, time.Minute.Milliseconds()).Int64()
	return n <= imageSearchLimit && err == nil, err
}

var imageSearchUnlockScript = redis.NewScript(`
if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end
return 0
`)

// Search serializes a query across instances before the provider cache is checked.
func (s *ImageSearchService) Search(ctx context.Context, query string) (images []imagesearch.Image, resultErr error) {
	if s == nil || s.redis == nil {
		return nil, errors.New("image search coordination unavailable")
	}
	query = strings.TrimSpace(query)
	ctx, cancel := context.WithTimeout(ctx, s.timeout)
	defer cancel()
	token := make([]byte, 16)
	if _, err := rand.Read(token); err != nil {
		return nil, errors.New("image search coordination unavailable")
	}
	lockKey := "image-search:lock:" + s.namespace + ":" + imageSearchHash(query)
	value := hex.EncodeToString(token)
	for {
		acquired, err := s.redis.SetNX(ctx, lockKey, value, 40*time.Second).Result()
		if err != nil {
			if ctx.Err() != nil {
				return nil, ctx.Err()
			}
			return nil, errors.New("image search coordination unavailable")
		}
		if acquired {
			break
		}
		timer := time.NewTimer(100 * time.Millisecond)
		select {
		case <-ctx.Done():
			timer.Stop()
			return nil, ctx.Err()
		case <-timer.C:
		}
	}
	defer func() {
		unlockCtx, cancel := context.WithTimeout(context.Background(), min(s.timeout/10, 250*time.Millisecond))
		defer cancel()
		if err := imageSearchUnlockScript.Run(unlockCtx, s.redis, []string{lockKey}, value).Err(); err != nil && resultErr == nil {
			images = nil
			resultErr = errors.New("image search coordination unavailable")
		}
	}()
	images, err := s.client.Search(ctx, query)
	if ctx.Err() != nil {
		return nil, ctx.Err()
	}
	if err != nil {
		return nil, errors.New("image search provider unavailable")
	}
	return images, nil
}

// TrackDownload records a selected Unsplash image using the provider client.
func (s *ImageSearchService) TrackDownload(ctx context.Context, location string) error {
	if s == nil || s.redis == nil || s.client == nil {
		return errors.New("image selection unavailable")
	}
	ctx, cancel := context.WithTimeout(ctx, min(s.timeout, 3*time.Second))
	defer cancel()
	return s.client.TrackDownload(ctx, location)
}
