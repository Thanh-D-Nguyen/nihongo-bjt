package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/google/uuid"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/lifefeed"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/postgres"
)

func main() {
	if err := run(); err != nil {
		slog.Error("life feed refresh failed", "error", err)
		os.Exit(1)
	}
}

func run() error {
	if os.Getenv("LIFE_FEED_APPROVED_TEMPLATE") != lifefeed.GeographyTemplate {
		return fmt.Errorf("LIFE_FEED_APPROVED_TEMPLATE requires operator approval of %s", lifefeed.GeographyTemplate)
	}
	actor := os.Getenv("LIFE_FEED_APPROVED_REVIEWER_ID")
	if _, err := uuid.Parse(actor); err != nil {
		return fmt.Errorf("LIFE_FEED_APPROVED_REVIEWER_ID must identify the approving content publisher")
	}
	root, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	ctx, cancel := context.WithTimeout(root, 2*time.Minute)
	defer cancel()
	db, err := postgres.NewPool(ctx, postgres.PoolConfig{URL: os.Getenv("DATABASE_URL"), MaxConns: 2, AcquireTimeout: 5 * time.Second})
	if err != nil {
		return err
	}
	defer db.Close()
	if err := postgres.Ping(ctx, db); err != nil {
		return fmt.Errorf("life feed database is unavailable")
	}
	cards, err := lifefeed.NewGeographyProvider(os.Getenv("LIFE_FEED_SOURCE_USER_AGENT")).Fetch(ctx)
	if err != nil {
		return err
	}
	inserted, err := lifefeed.PublishGeography(ctx, db, actor, lifefeed.GeographyTemplate, cards, time.Now().UTC())
	if err != nil {
		return err
	}
	slog.Info("life feed refresh completed", "template", lifefeed.GeographyTemplate, "verifiedCities", len(cards), "inserted", inserted)
	return nil
}
