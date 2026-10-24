// Command search-reindex reconciles the full canonical PostgreSQL search projection.
package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/postgres"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/search"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "search rebuild failed:", err)
		os.Exit(1)
	}
}

func run() error {
	if os.Getenv("DATABASE_URL") == "" || os.Getenv("MEILISEARCH_URL") == "" {
		return fmt.Errorf("DATABASE_URL and MEILISEARCH_URL are required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
	defer cancel()
	db, err := postgres.NewPool(ctx, postgres.PoolConfig{URL: os.Getenv("DATABASE_URL"), MaxConns: 2, AcquireTimeout: 10 * time.Second})
	if err != nil {
		return err
	}
	defer db.Close()
	documents, err := search.LoadDocuments(ctx, db, "")
	if err != nil {
		return err
	}
	fmt.Printf("Loaded %d canonical documents; rebuilding content_search...\n", len(documents))
	client := search.NewClient(os.Getenv("MEILISEARCH_URL"), os.Getenv("MEILISEARCH_API_KEY"))
	result, err := client.ReindexDocuments(ctx, documents, "")
	if err != nil {
		return err
	}
	if result.DocumentCount > 0 {
		uid, err := client.ConfigureIndex(ctx)
		if err != nil {
			return err
		}
		result.TaskUIDs = append(result.TaskUIDs, uid)
	}
	fmt.Printf("Waiting for %d indexing tasks...\n", len(result.TaskUIDs))
	if err := client.VerifyReindex(ctx, result); err != nil {
		return err
	}
	fmt.Printf("PASS: %d canonical documents indexed and verified.\n", result.DocumentCount)
	return nil
}
