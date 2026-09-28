package authz

import (
	"context"
	crand "crypto/rand"
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
		t.Skip("TEST_DATABASE_URL not set; skipping integration test (requires disposable PostgreSQL 17 with M2 schema)")
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

// newUUID generates a real UUID v4 via crypto/rand for test PK columns.
func newUUID(t *testing.T) string {
	t.Helper()
	var b [16]byte
	if _, err := crand.Read(b[:]); err != nil {
		t.Fatalf("crypto/rand: %v", err)
	}
	b[6] = (b[6] & 0x0f) | 0x40 // version 4
	b[8] = (b[8] & 0x3f) | 0x80 // variant RFC4122
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x",
		b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

// uniqueCode generates a unique varchar-safe code for role/permission codes.
func uniqueCode(t *testing.T, prefix string) string {
	t.Helper()
	var b [8]byte
	if _, err := crand.Read(b[:]); err != nil {
		t.Fatalf("crypto/rand: %v", err)
	}
	return fmt.Sprintf("%s_%x", prefix, b[:])
}

func seedAdminActor(t *testing.T, db *pgxpool.Pool, actorID, email string) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err := db.Exec(ctx,
		`INSERT INTO authz.admin_actor (id, display_name, email, status) VALUES ($1, 'Test Admin', $2, 'active') ON CONFLICT (id) DO UPDATE SET status = 'active'`,
		actorID, email)
	if err != nil {
		t.Fatalf("seed admin actor: %v", err)
	}
}

func seedRoleWithPermission(t *testing.T, db *pgxpool.Pool, actorID, roleCode, permCode string) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var roleID string
	err := db.QueryRow(ctx, `INSERT INTO authz.admin_role (code, name, status) VALUES ($1, $2, 'active') ON CONFLICT (code) DO UPDATE SET status = 'active' RETURNING id`, roleCode, roleCode).Scan(&roleID)
	if err != nil {
		t.Fatalf("seed role: %v", err)
	}

	var permID string
	err = db.QueryRow(ctx, `INSERT INTO authz.admin_permission (code) VALUES ($1) ON CONFLICT (code) DO UPDATE SET code = EXCLUDED.code RETURNING id`, permCode).Scan(&permID)
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
	actorID := newUUID(t)
	roleCode := uniqueCode(t, "role_perm")
	permCode := uniqueCode(t, "perm_read")
	seedAdminActor(t, db, actorID, fmt.Sprintf("admin-%s@example.com", actorID[:8]))
	seedRoleWithPermission(t, db, actorID, roleCode, permCode)

	p, err := store.LoadPrincipal(context.Background(), actorID)
	if err != nil {
		t.Fatalf("LoadPrincipal: %v", err)
	}
	if p.ActorID != actorID {
		t.Errorf("ActorID = %q, want %q", p.ActorID, actorID)
	}
	if !p.HasPermission(permCode) {
		t.Errorf("expected %s permission", permCode)
	}
	unrelatedPerm := uniqueCode(t, "perm_unrelated")
	if p.HasPermission(unrelatedPerm) {
		t.Errorf("should not have %s", unrelatedPerm)
	}
}

func TestLoadPrincipal_Wildcard(t *testing.T) {
	db := testPool(t)
	store := NewStore(db)
	actorID := newUUID(t)
	roleCode := uniqueCode(t, "role_wild")
	seedAdminActor(t, db, actorID, fmt.Sprintf("super-%s@example.com", actorID[:8]))
	// Permission code must be literal "*" for wildcard semantics; role code is unique per run.
	seedRoleWithPermission(t, db, actorID, roleCode, "*")

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
	actorID := newUUID(t)
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
