// Command livecheck verifies complete batched indexing, Japanese relevance and stale
// document cleanup against real Meilisearch, including first task UID 0.
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
	reading, meaning := "かいぎ", "cuộc họp"
	roomReading := "かいぎしつ"
	documents := []search.Document{
		{ID: "meeting", Kind: "lexeme", Title: "会議", Reading: &reading, Description: &meaning},
		{ID: "room", Kind: "lexeme", Title: "会議室", Reading: &roomReading},
		{ID: "reverse", Kind: "lexeme", Title: "衆議院運営委員会"},
		{ID: "reverse-example", Kind: "example", Title: "電波管理審議会"},
		{ID: "kana-prefix", Kind: "lexeme", Title: "かいぎろく"},
	}
	for i := len(documents); i < 1001; i++ {
		documents = append(documents, search.Document{ID: fmt.Sprintf("filler-%d", i), Kind: "lexeme", Title: "unrelated fixture"})
	}
	result, err := client.ReindexDocuments(ctx, documents, "")
	if err != nil {
		return fmt.Errorf("initial rebuild: %w", err)
	}
	if len(result.TaskUIDs) == 0 {
		return fmt.Errorf("no indexing task returned")
	}
	if err := client.VerifyReindex(ctx, result); err != nil {
		return err
	}
	for _, tc := range []struct{ query, id string }{
		{"会議", "meeting"}, {"かいぎ", "meeting"}, {"cuộc họp", "meeting"}, {"会議室", "room"},
	} {
		found, err := client.Search(ctx, tc.query, "lexeme", 10, 0)
		if err != nil || len(found.Results) == 0 || found.Results[0].ID != tc.id {
			return fmt.Errorf("query %q must rank %s first: %+v, error=%v", tc.query, tc.id, found, err)
		}
	}
	found, err := client.Search(ctx, "zznonexistentquery987", "", 10, 0)
	if err != nil || len(found.Results) != 0 {
		return fmt.Errorf("unmatched query must be empty: %+v, error=%v", found, err)
	}
	result, err = client.ReindexDocuments(ctx, documents[:1000], "")
	if err != nil {
		return fmt.Errorf("stale document reconciliation: %w", err)
	}
	if err := client.VerifyReindex(ctx, result); err != nil {
		return err
	}
	fmt.Println("PASS real Meilisearch: 1001 batched documents, kanji/kana/Vietnamese ranking, scope, empty query results, stale cleanup")
	return nil
}
