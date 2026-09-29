// Command bootstrap-admin provisions the first admin actor with Argon2id credentials.
// It is idempotent: running when an admin already exists exits cleanly without error.
package main

import (
	"context"
	"crypto/rand"
	"fmt"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/credential"
)

const minPasswordLen = 12

func main() {
	if err := run(context.Background()); err != nil {
		fmt.Fprintf(os.Stderr, "bootstrap-admin: %v\n", err)
		os.Exit(1)
	}
}

func run(ctx context.Context) error {
	email := os.Getenv("BOOTSTRAP_ADMIN_EMAIL")
	displayName := os.Getenv("BOOTSTRAP_ADMIN_DISPLAY_NAME")
	password := os.Getenv("BOOTSTRAP_ADMIN_PASSWORD")
	dbURL := os.Getenv("DATABASE_URL")

	if email == "" {
		return fmt.Errorf("BOOTSTRAP_ADMIN_EMAIL is required")
	}
	if displayName == "" {
		return fmt.Errorf("BOOTSTRAP_ADMIN_DISPLAY_NAME is required")
	}
	if password == "" {
		return fmt.Errorf("BOOTSTRAP_ADMIN_PASSWORD is required")
	}
	if len(password) < minPasswordLen {
		return fmt.Errorf("password must be at least %d characters", minPasswordLen)
	}
	if dbURL == "" {
		return fmt.Errorf("DATABASE_URL is required")
	}

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		return fmt.Errorf("connect to database: %w", err)
	}
	defer pool.Close()

	// Check if any admin actor already exists.
	var count int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM authz.admin_actor`).Scan(&count); err != nil {
		return fmt.Errorf("check existing admins: %w", err)
	}
	if count > 0 {
		fmt.Println("admin already exists; skipping bootstrap")
		return nil
	}

	// Generate UUID v4 for actor ID.
	actorID, err := newUUID()
	if err != nil {
		return fmt.Errorf("generate actor ID: %w", err)
	}

	// Insert admin actor.
	const insertActor = `INSERT INTO authz.admin_actor (id, email, display_name, status, created_at, updated_at)
		VALUES ($1, $2, $3, 'active', now(), now())`
	if _, err := pool.Exec(ctx, insertActor, actorID, email, displayName); err != nil {
		return fmt.Errorf("insert admin actor: %w", err)
	}

	// Ensure default admin role exists.
	const ensureRole = `INSERT INTO authz.admin_role (id, name, code, status, created_at)
		VALUES ('00000000-0000-0000-0000-000000000001', 'Super Admin', 'super_admin', 'active', now())
		ON CONFLICT (id) DO NOTHING`
	if _, err := pool.Exec(ctx, ensureRole); err != nil {
		return fmt.Errorf("ensure admin role: %w", err)
	}

	// Assign role to actor.
	const assignRole = `INSERT INTO authz.admin_actor_role (actor_id, role_id, granted_at)
		VALUES ($1, '00000000-0000-0000-0000-000000000001', now())
		ON CONFLICT (actor_id, role_id) DO NOTHING`
	if _, err := pool.Exec(ctx, assignRole, actorID); err != nil {
		return fmt.Errorf("assign admin role: %w", err)
	}

	// Hash and store credential using the shared credential.Store.
	store := credential.NewStore(pool)
	if err := store.SetAdminCredential(ctx, actorID, []byte(password)); err != nil {
		return fmt.Errorf("set admin credential: %w", err)
	}

	fmt.Printf("admin actor created: %s (%s)\n", actorID, email)
	return nil
}

// newUUID generates a random UUID v4 string.
func newUUID() (string, error) {
	var uuid [16]byte
	if _, err := rand.Read(uuid[:]); err != nil {
		return "", err
	}
	uuid[6] = (uuid[6] & 0x0f) | 0x40 // version 4
	uuid[8] = (uuid[8] & 0x3f) | 0x80 // variant RFC4122
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x",
		uuid[0:4], uuid[4:6], uuid[6:8], uuid[8:10], uuid[10:16]), nil
}
