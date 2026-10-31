package httpserver

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/imagesearch"
)

func TestPixabayCacheSurvivesClientRestartAndReservesMiss(t *testing.T) {
	ctx := context.Background()
	db, err := pgxpool.New(ctx, os.Getenv("TEST_DATABASE_URL"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	key := "test-" + newUUID(t)
	c := imageSearchDurableCache{db: db, namespace: key}
	t.Cleanup(func() { _, _ = db.Exec(ctx, `DELETE FROM media.image_search_cache WHERE namespace=$1`, key) })
	if _, hit, err := c.Get(ctx, "cat"); err != nil || hit {
		t.Fatalf("first lookup: hit=%v err=%v", hit, err)
	}
	var reservationSeconds float64
	if err := db.QueryRow(ctx, `SELECT EXTRACT(EPOCH FROM (expires_at-NOW())) FROM media.image_search_cache WHERE namespace=$1`, key).Scan(&reservationSeconds); err != nil || reservationSeconds <= (24*time.Hour).Seconds() {
		t.Fatalf("reservation must outlast the provider request by 24h: seconds=%v err=%v", reservationSeconds, err)
	}
	// A reservation prevents duplicate upstream calls even if a worker crashes.
	if images, hit, err := c.Get(ctx, "cat"); err != nil || !hit || len(images) != 0 {
		t.Fatalf("reserved lookup: %v hit=%v err=%v", images, hit, err)
	}
	want := []imagesearch.Image{{Provider: "pixabay", URL: "https://pixabay.com/test"}}
	if err := c.Put(ctx, "cat", want, 24*time.Hour); err != nil {
		t.Fatal(err)
	}
	restarted := imageSearchDurableCache{db: db, namespace: key}
	got, hit, err := restarted.Get(ctx, "cat")
	if err != nil || !hit || len(got) != 1 || got[0] != want[0] {
		t.Fatalf("after restart: %v hit=%v err=%v", got, hit, err)
	}
	var remaining time.Duration
	var seconds float64
	if err := db.QueryRow(ctx, `SELECT EXTRACT(EPOCH FROM (expires_at-NOW())) FROM media.image_search_cache WHERE namespace=$1`, key).Scan(&seconds); err != nil {
		t.Fatal(err)
	}
	remaining = time.Duration(seconds * float64(time.Second))
	if remaining < 23*time.Hour+59*time.Minute {
		t.Fatalf("retention too short: %v", remaining)
	}
}
