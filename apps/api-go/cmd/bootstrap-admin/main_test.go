package main

import (
	"context"
	"crypto/rand"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// testPool creates a disposable pgxpool connected to TEST_DATABASE_URL.
// Tests using this require a running Postgres 17 with M2+M3 schema applied.
// When TEST_DATABASE_URL is unset, tests are skipped (not failed).
func testPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set; skipping integration test")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatalf("failed to connect to test DB: %v", err)
	}
	t.Cleanup(pool.Close)
	return pool
}

// newTestUUID generates a random UUID v4 string for test isolation.
func newTestUUID(t *testing.T) string {
	t.Helper()
	var uuid [16]byte
	if _, err := rand.Read(uuid[:]); err != nil {
		t.Fatalf("crypto/rand: %v", err)
	}
	uuid[6] = (uuid[6] & 0x0f) | 0x40
	uuid[8] = (uuid[8] & 0x3f) | 0x80
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x",
		uuid[0:4], uuid[4:6], uuid[6:8], uuid[8:10], uuid[10:16])
}

// cleanAdminTables removes all admin actors, roles, and credentials for test isolation.
func cleanAdminTables(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	stmts := []string{
		`DELETE FROM auth.admin_password_credential`,
		`DELETE FROM authz.admin_actor_role`,
		`DELETE FROM authz.admin_actor`,
		`DELETE FROM authz.admin_role WHERE id != '00000000-0000-0000-0000-000000000001'`,
	}
	for _, s := range stmts {
		if _, err := pool.Exec(ctx, s); err != nil {
			t.Logf("cleanup warning: %v", err)
		}
	}
}

func TestBootstrapAdmin_Success(t *testing.T) {
	pool := testPool(t)
	cleanAdminTables(t, pool)

	email := "admin-" + newTestUUID(t) + "@test.local"
	os.Setenv("BOOTSTRAP_ADMIN_EMAIL", email)
	os.Setenv("BOOTSTRAP_ADMIN_DISPLAY_NAME", "Test Admin")
	os.Setenv("BOOTSTRAP_ADMIN_PASSWORD", "secure-password-1234")
	os.Setenv("DATABASE_URL", os.Getenv("TEST_DATABASE_URL"))
	defer func() {
		os.Unsetenv("BOOTSTRAP_ADMIN_EMAIL")
		os.Unsetenv("BOOTSTRAP_ADMIN_DISPLAY_NAME")
		os.Unsetenv("BOOTSTRAP_ADMIN_PASSWORD")
		os.Unsetenv("DATABASE_URL")
	}()

	ctx := context.Background()
	if err := run(ctx); err != nil {
		t.Fatalf("run() failed: %v", err)
	}

	// Verify actor was created.
	var actorEmail string
	err := pool.QueryRow(ctx, `SELECT email FROM authz.admin_actor WHERE email = $1`, email).Scan(&actorEmail)
	if err != nil {
		t.Fatalf("admin actor not found after bootstrap: %v", err)
	}
	if actorEmail != email {
		t.Errorf("email mismatch: got %q, want %q", actorEmail, email)
	}

	// Verify credential exists.
	var credCount int
	err = pool.QueryRow(ctx, `SELECT count(*) FROM auth.admin_password_credential`).Scan(&credCount)
	if err != nil {
		t.Fatalf("count credentials: %v", err)
	}
	if credCount != 1 {
		t.Errorf("expected 1 credential row, got %d", credCount)
	}

	// Verify role assignment exists.
	var roleCount int
	err = pool.QueryRow(ctx, `SELECT count(*) FROM authz.admin_actor_role`).Scan(&roleCount)
	if err != nil {
		t.Fatalf("count role assignments: %v", err)
	}
	if roleCount != 1 {
		t.Errorf("expected 1 role assignment, got %d", roleCount)
	}
}

func TestBootstrapAdmin_Idempotency(t *testing.T) {
	pool := testPool(t)
	cleanAdminTables(t, pool)

	email := "admin-" + newTestUUID(t) + "@test.local"
	os.Setenv("BOOTSTRAP_ADMIN_EMAIL", email)
	os.Setenv("BOOTSTRAP_ADMIN_DISPLAY_NAME", "Test Admin")
	os.Setenv("BOOTSTRAP_ADMIN_PASSWORD", "secure-password-1234")
	os.Setenv("DATABASE_URL", os.Getenv("TEST_DATABASE_URL"))
	defer func() {
		os.Unsetenv("BOOTSTRAP_ADMIN_EMAIL")
		os.Unsetenv("BOOTSTRAP_ADMIN_DISPLAY_NAME")
		os.Unsetenv("BOOTSTRAP_ADMIN_PASSWORD")
		os.Unsetenv("DATABASE_URL")
	}()

	ctx := context.Background()

	// First run should succeed.
	if err := run(ctx); err != nil {
		t.Fatalf("first run() failed: %v", err)
	}

	// Second run should skip gracefully (no error).
	if err := run(ctx); err != nil {
		t.Fatalf("second run() should skip gracefully, got error: %v", err)
	}

	// Verify only one actor exists.
	var count int
	err := pool.QueryRow(ctx, `SELECT count(*) FROM authz.admin_actor`).Scan(&count)
	if err != nil {
		t.Fatalf("count actors: %v", err)
	}
	if count != 1 {
		t.Errorf("expected exactly 1 admin actor after idempotent run, got %d", count)
	}
}

func TestBootstrapAdmin_MissingEnvVars(t *testing.T) {
	// Clear all relevant env vars.
	os.Unsetenv("BOOTSTRAP_ADMIN_EMAIL")
	os.Unsetenv("BOOTSTRAP_ADMIN_DISPLAY_NAME")
	os.Unsetenv("BOOTSTRAP_ADMIN_PASSWORD")
	os.Unsetenv("DATABASE_URL")

	tests := []struct {
		name    string
		setup   func()
		wantErr string
	}{
		{
			name:    "missing email",
			setup:   func() {},
			wantErr: "BOOTSTRAP_ADMIN_EMAIL is required",
		},
		{
			name: "missing display name",
			setup: func() {
				os.Setenv("BOOTSTRAP_ADMIN_EMAIL", "test@test.local")
			},
			wantErr: "BOOTSTRAP_ADMIN_DISPLAY_NAME is required",
		},
		{
			name: "missing password",
			setup: func() {
				os.Setenv("BOOTSTRAP_ADMIN_EMAIL", "test@test.local")
				os.Setenv("BOOTSTRAP_ADMIN_DISPLAY_NAME", "Test")
			},
			wantErr: "BOOTSTRAP_ADMIN_PASSWORD is required",
		},
		{
			name: "missing database URL",
			setup: func() {
				os.Setenv("BOOTSTRAP_ADMIN_EMAIL", "test@test.local")
				os.Setenv("BOOTSTRAP_ADMIN_DISPLAY_NAME", "Test")
				os.Setenv("BOOTSTRAP_ADMIN_PASSWORD", "secure-password-1234")
			},
			wantErr: "DATABASE_URL is required",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			os.Unsetenv("BOOTSTRAP_ADMIN_EMAIL")
			os.Unsetenv("BOOTSTRAP_ADMIN_DISPLAY_NAME")
			os.Unsetenv("BOOTSTRAP_ADMIN_PASSWORD")
			os.Unsetenv("DATABASE_URL")
			tt.setup()
			defer func() {
				os.Unsetenv("BOOTSTRAP_ADMIN_EMAIL")
				os.Unsetenv("BOOTSTRAP_ADMIN_DISPLAY_NAME")
				os.Unsetenv("BOOTSTRAP_ADMIN_PASSWORD")
				os.Unsetenv("DATABASE_URL")
			}()

			err := run(context.Background())
			if err == nil {
				t.Fatal("expected error, got nil")
			}
			if err.Error() != tt.wantErr {
				t.Errorf("error = %q, want %q", err.Error(), tt.wantErr)
			}
		})
	}
}

func TestBootstrapAdmin_WeakPassword(t *testing.T) {
	os.Setenv("BOOTSTRAP_ADMIN_EMAIL", "test@test.local")
	os.Setenv("BOOTSTRAP_ADMIN_DISPLAY_NAME", "Test")
	os.Setenv("BOOTSTRAP_ADMIN_PASSWORD", "short")
	os.Setenv("DATABASE_URL", "postgres://localhost/test")
	defer func() {
		os.Unsetenv("BOOTSTRAP_ADMIN_EMAIL")
		os.Unsetenv("BOOTSTRAP_ADMIN_DISPLAY_NAME")
		os.Unsetenv("BOOTSTRAP_ADMIN_PASSWORD")
		os.Unsetenv("DATABASE_URL")
	}()

	err := run(context.Background())
	if err == nil {
		t.Fatal("expected error for weak password, got nil")
	}
	want := "password must be at least 12 characters"
	if err.Error() != want {
		t.Errorf("error = %q, want %q", err.Error(), want)
	}
}
