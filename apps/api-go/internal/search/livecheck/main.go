// Command livecheck indexes and queries one document against a real
// Meilisearch (MEILI_URL). It is the release gate for the client's task-UID
// handling: a fresh Meilisearch legitimately returns taskUid 0.
//
//	python3 scripts/release/search-check.py   # starts a disposable Meilisearch
package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/search"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "FAIL:", err)
		os.Exit(1)
	}
}

func run() error {
	url := os.Getenv("MEILI_URL")
	if url == "" {
		return fmt.Errorf("MEILI_URL is required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	client := search.NewClient(url, os.Getenv("MEILI_API_KEY"))
	if err := client.Ping(ctx); err != nil {
		return fmt.Errorf("ping: %w", err)
	}
	result, err := client.ReindexDocuments(ctx, []search.Document{{ID: "release-1", Kind: "lexeme", Title: "Kotoba release"}}, "")
	if err != nil {
		return fmt.Errorf("first index into an empty Meilisearch: %w", err)
	}
	if len(result.TaskUIDs) == 0 {
		return fmt.Errorf("no indexing task returned")
	}
	for i := 0; i < 100; i++ {
		found, err := client.Search(ctx, "Kotoba", "", 10, 0)
		if err == nil && found.Total == 1 && len(found.Results) == 1 {
			fmt.Println("PASS real Meilisearch indexing + query (first task UID", result.TaskUIDs[0], ")")
			return nil
		}
		time.Sleep(100 * time.Millisecond)
	}
	return fmt.Errorf("document not searchable")
}
