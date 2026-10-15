package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/credential"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/devguard"
)

func main() {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		fmt.Fprintln(os.Stderr, "DATABASE_URL required")
		os.Exit(1)
	}
	if err := devguard.RequireLocalDatabase(dbURL, os.Getenv(devguard.AllowRemoteEnv)); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	adminPassword := os.Getenv("ADMIN_TEST_PASSWORD")
	learnerPassword := os.Getenv("LEARNER_TEST_PASSWORD")
	if adminPassword == "" || learnerPassword == "" {
		fmt.Fprintln(os.Stderr, "ADMIN_TEST_PASSWORD and LEARNER_TEST_PASSWORD required")
		os.Exit(1)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		fmt.Fprintf(os.Stderr, "connect: %v\n", err)
		os.Exit(1)
	}
	defer pool.Close()

	store := credential.NewStore(pool)

	// Admin credential for existing actor
	adminID := "00000000-0000-4000-8000-000000000001"
	if err := store.SetAdminCredential(ctx, adminID, []byte(adminPassword)); err != nil {
		fmt.Fprintf(os.Stderr, "admin cred: %v\n", err)
		os.Exit(1)
	}
	fmt.Println("admin credential set for", adminID)

	// Create learner profile + credential with all required NOT NULL columns
	var learnerID string
	err = pool.QueryRow(ctx, `SELECT id FROM profile.user_profile WHERE email = 'learner@test.local'`).Scan(&learnerID)
	if err != nil {
		now := time.Now()
		err = pool.QueryRow(ctx, `
			INSERT INTO profile.user_profile (
				email, display_name, ui_locale, explanation_locale, timezone,
				account_type, auth_sync_status, status, privacy_level,
				theme_mode, font_size_preference, density_preference,
				daily_goal_cards, daily_goal_exercises, low_pressure_mode,
				ads_personalization_opt_in, share_postcard_opt_in,
				created_at, updated_at
			) VALUES (
				'learner@test.local', 'Test Learner', 'vi', 'vi', 'Asia/Tokyo',
				'learner', 'not_linked', 'active', 'standard',
				'system', 'default', 'comfortable',
				20, 10, false,
				false, false,
				$1, $1
			) RETURNING id`, now).Scan(&learnerID)
		if err != nil {
			fmt.Fprintf(os.Stderr, "create learner: %v\n", err)
			os.Exit(1)
		}
		fmt.Println("learner created:", learnerID)
	} else {
		fmt.Println("learner exists:", learnerID)
	}

	if err := store.SetLearnerCredential(ctx, learnerID, []byte(learnerPassword)); err != nil {
		fmt.Fprintf(os.Stderr, "learner cred: %v\n", err)
		os.Exit(1)
	}
	fmt.Println("learner credential set")
}
