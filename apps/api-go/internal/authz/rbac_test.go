package authz

import (
	"context"
	"errors"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

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

func seedAdminActor(t *testing.T, db *pgxpool.Pool, actorID, email string) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err := db.Exec(ctx,
		`INSERT INTO authz.admin_actor (id, display_name, email, status) VALUES ($1, 'Test Admin', $2, 'active') ON CONFLICT (id) DO NOTHING`,
		actorID, email)
	if err != nil {
		t.Fatalf("seed admin actor: %v", err)
	}
}

func seedRoleWithPermission(t *testing.T, db *pgxpool.Pool, actorID, roleCode, permCode string) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var roleID, permID string
	err := db.QueryRow(ctx, `INSERT INTO authz.admin_role (code, name, status) VALUES ($1, $2, 'active') RETURNING id`, roleCode, roleCode).Scan(&roleID)
	if err != nil {
		t.Fatalf("seed role: %v", err)
	}
	err = db.QueryRow(ctx, `INSERT INTO authz.admin_permission (code) VALUES ($1) RETURNING id`, permCode).Scan(&permID)
	if err != nil {
		t.Fatalf("seed permission: %v", err)
	}
	_, err = db.Exec(ctx, `INSERT INTO authz.admin_actor_role (actor_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, actorID, roleID)
	if err != nil {
		t.Fatalf("seed actor-role: %v", err)
	}
	_, err = db.Exec(ctx, `INSERT INTO authz.admin_role_permission (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, roleID, permID)
	if err != nil {
		t.Fatalf("seed role-permission: %v", err)
	}
}

func TestLoadPrincipal_WithPermissions(t *testing.T) {
	db := testPool(t)
	store := NewStore(db)
	actorID := "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
	seedAdminActor(t, db, actorID, fmt.Sprintf("admin-%s@example.com", actorID[:8]))
	seedRoleWithPermission(t, db, actorID, "test_role_m3", "admin.content.read")

	p, err := store.LoadPrincipal(context.Background(), actorID)
	if err != nil {
		t.Fatalf("LoadPrincipal: %v", err)
	}
	if p.ActorID != actorID {
		t.Errorf("ActorID = %q, want %q", p.ActorID, actorID)
	}
	if !p.HasPermission("admin.content.read") {
		t.Error("expected admin.content.read permission")
	}
	if p.HasPermission("admin.content.write") {
		t.Error("should not have admin.content.write")
	}
}

func TestLoadPrincipal_Wildcard(t *testing.T) {
	db := testPool(t)
	store := NewStore(db)
	actorID := "b2c3d4e5-f6a7-8901-bcde-f12345678901"
	seedAdminActor(t, db, actorID, fmt.Sprintf("super-%s@example.com", actorID[:8]))
	seedRoleWithPermission(t, db, actorID, "superadmin_m3", "*")

	p, err := store.LoadPrincipal(context.Background(), actorID)
	if err != nil {
		t.Fatalf("LoadPrincipal: %v", err)
	}
	if !p.HasPermission("any.permission.code") {
		t.Error("wildcard should grant any permission")
	}
	if !p.HasAnyPermission([]string{"unrelated.perm", "another.perm"}) {
		t.Error("wildcard should satisfy HasAnyPermission")
	}
}

func TestLoadPrincipal_DisabledActor(t *testing.T) {
	db := testPool(t)
	store := NewStore(db)
	actorID := "c3d4e5f6-a7b8-9012-cdef-123456789012"
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err := db.Exec(ctx,
		`INSERT INTO authz.admin_actor (id, display_name, email, status) VALUES ($1, 'Disabled', $2, 'disabled') ON CONFLICT (id) DO UPDATE SET status = 'disabled'`,
		actorID, fmt.Sprintf("disabled-%s@example.com", actorID[:8]))
	if err != nil {
		t.Fatalf("seed disabled actor: %v", err)
	}

	_, err = store.LoadPrincipal(context.Background(), actorID)
	if !errors.Is(err, ErrActorNotActive) {
		t.Errorf("expected ErrActorNotActive for disabled actor, got %v", err)
	}
}

func TestLoadPrincipal_MissingActor(t *testing.T) {
	db := testPool(t)
	store := NewStore(db)
	_, err := store.LoadPrincipal(context.Background(), "00000000-0000-0000-0000-000000000000")
	if !errors.Is(err, ErrActorNotActive) {
		t.Errorf("expected ErrActorNotActive for missing actor, got %v", err)
	}
}

func TestAdminPrincipal_HasAnyPermission_NoWildcard(t *testing.T) {
	p := &AdminPrincipal{
		ActorID:     "test",
		DisplayName: "Test",
		Permissions: map[string]bool{"admin.content.read": true, "viewer.audit": true},
	}
	if !p.HasAnyPermission([]string{"admin.content.write", "viewer.audit"}) {
		t.Error("should match viewer.audit")
	}
	if p.HasAnyPermission([]string{"admin.content.write", "growth.manage"}) {
		t.Error("should not match unrelated permissions")
	}
}
