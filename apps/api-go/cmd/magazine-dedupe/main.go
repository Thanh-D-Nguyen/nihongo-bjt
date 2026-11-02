// Command magazine-dedupe archives duplicate published magazine articles.
//
// It is a dry run unless -apply is given, and it never deletes anything:
// duplicates are set to status='archived' (see magazine.ArchiveDuplicates for
// the restore statement).
//
//	DATABASE_URL=postgres://... go run ./cmd/magazine-dedupe
//	DATABASE_URL=postgres://... go run ./cmd/magazine-dedupe -apply [-keep earliest] [-kind magazine_vocab]
package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"sort"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/magazine"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "magazine-dedupe:", err)
		os.Exit(1)
	}
}

func run() error {
	apply := flag.Bool("apply", false, "archive the duplicates (default: dry run)")
	keep := flag.String("keep", "latest", "which article of each group stays published: latest or earliest")
	kind := flag.String("kind", "", "restrict to one widget kind, e.g. magazine_vocab")
	flag.Parse()
	if *keep != "latest" && *keep != "earliest" {
		return fmt.Errorf("-keep must be latest or earliest, got %q", *keep)
	}
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		return fmt.Errorf("DATABASE_URL is required (this command never guesses a database)")
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()
	ctx, cancel := context.WithTimeout(ctx, 2*time.Minute)
	defer cancel()
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		return fmt.Errorf("connect: %w", err)
	}
	defer pool.Close()

	dupes, err := magazine.ArchiveDuplicates(ctx, pool, magazine.DedupeOptions{
		Kind: *kind, KeepEarliest: *keep == "earliest", Apply: *apply,
	})
	if err != nil {
		return err
	}

	mode := "DRY-RUN"
	if *apply {
		mode = "APPLIED"
	}
	perKind := map[string]int{}
	for _, d := range dupes {
		perKind[d.WidgetKind]++
	}
	kinds := make([]string, 0, len(perKind))
	for k := range perKind {
		kinds = append(kinds, k)
	}
	sort.Strings(kinds)
	fmt.Printf("%s: %d duplicate published article(s), keeping the %s of each group\n", mode, len(dupes), *keep)
	for _, k := range kinds {
		fmt.Printf("  %s: %d\n", k, perKind[k])
	}
	for _, d := range dupes {
		fmt.Printf("  %s  %s  %s\n", d.ContentDate.Format("2006-01-02"), d.WidgetKind, d.Slug)
	}
	if !*apply {
		fmt.Println("No changes made. Re-run with -apply to archive these rows.")
	}
	return nil
}
