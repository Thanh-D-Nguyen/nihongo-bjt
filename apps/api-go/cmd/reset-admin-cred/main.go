package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/credential"
)

func main() {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		fmt.Fprintln(os.Stderr, "DATABASE_URL required")
		os.Exit(1)
	}
	password := os.Getenv("RESET_ADMIN_PASSWORD")
	if password == "" {
		fmt.Fprintln(os.Stderr, "RESET_ADMIN_PASSWORD required")
		os.Exit(1)
	}
	email := os.Getenv("RESET_ADMIN_EMAIL")
	if email == "" {
		fmt.Fprintln(os.Stderr, "RESET_ADMIN_EMAIL required")
		os.Exit(1)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		fmt.Fprintf(os.Stderr, "pool: %v\n", err)
		os.Exit(1)
	}
	defer pool.Close()
	var actorID string
	err = pool.QueryRow(ctx, `SELECT id FROM authz.admin_actor WHERE email = $1`, email).Scan(&actorID)
	if err != nil {
		fmt.Fprintf(os.Stderr, "find actor: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("ACTOR_ID: %s\n", actorID)
	store := credential.NewStore(pool)
	if err := store.SetAdminCredential(ctx, actorID, []byte(password)); err != nil {
		fmt.Fprintf(os.Stderr, "set credential: %v\n", err)
		os.Exit(1)
	}
	fmt.Println("CREDENTIAL_RESET_OK")
}
