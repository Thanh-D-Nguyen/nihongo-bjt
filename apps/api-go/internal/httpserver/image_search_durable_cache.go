package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/imagesearch"
)

// Reservations fail closed for 24 hours if a worker dies or cannot save a
// response. They prevent duplicate provider requests even after Redis eviction.
type imageSearchDurableCache struct {
	db        *pgxpool.Pool
	namespace string
}

func (c imageSearchDurableCache) Get(ctx context.Context, key string) ([]imagesearch.Image, bool, error) {
	key = imageSearchHash(key)
	var reserved int
	err := c.db.QueryRow(ctx, `INSERT INTO media.image_search_cache (namespace,cache_key,images,expires_at)
		VALUES ($1,$2,'[]'::jsonb,NOW()+interval '24 hours 1 minute')
		ON CONFLICT (namespace,cache_key) DO UPDATE SET images='[]'::jsonb,expires_at=NOW()+interval '24 hours 1 minute'
		WHERE media.image_search_cache.expires_at <= NOW() RETURNING 1`, c.namespace, key).Scan(&reserved)
	if err == nil {
		// Bound table growth without ever removing an unexpired reservation.
		if _, err := c.db.Exec(ctx, `DELETE FROM media.image_search_cache WHERE (namespace,cache_key) IN
			(SELECT namespace,cache_key FROM media.image_search_cache WHERE expires_at <= NOW() ORDER BY expires_at LIMIT 32 FOR UPDATE SKIP LOCKED)`); err != nil {
			return nil, false, err
		}
		return nil, false, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, false, err
	}
	var data []byte
	if err := c.db.QueryRow(ctx, `SELECT images FROM media.image_search_cache WHERE namespace=$1 AND cache_key=$2`, c.namespace, key).Scan(&data); err != nil {
		return nil, false, err
	}
	var images []imagesearch.Image
	if err := json.Unmarshal(data, &images); err != nil {
		return nil, false, err
	}
	return images, true, nil
}

func (c imageSearchDurableCache) Put(ctx context.Context, key string, images []imagesearch.Image, ttl time.Duration) error {
	data, err := json.Marshal(images)
	if err != nil {
		return err
	}
	result, err := c.db.Exec(ctx, `UPDATE media.image_search_cache SET images=$3::jsonb,expires_at=NOW()+$4*interval '1 second' WHERE namespace=$1 AND cache_key=$2`, c.namespace, imageSearchHash(key), data, ttl.Seconds())
	if err != nil {
		return err
	}
	if result.RowsAffected() != 1 {
		return errors.New("image search reservation missing")
	}
	return nil
}
