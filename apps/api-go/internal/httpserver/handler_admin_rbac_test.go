package httpserver

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"log/slog"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/authz"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/credential"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

// adminRBACTestServer creates a test server with all M6 admin RBAC routes wired
// through the real router so admin guard + CSRF middleware are applied.
func adminRBACTestServer(t *testing.T) (*httptest.Server, *session.Store) {
	t.Helper()
	pool := testPool(t)
	rbacStore := authz.NewStore(pool)
	sessStore := session.NewStore(pool)
	credStore := credential.NewStore(pool)
	rateLimiter, err := authn.NewRateLimiter(authn.RateLimiterConfig{
		Limit:      100,
		Window:     time.Minute,
		TTL:        5 * time.Minute,
		EvictEvery: time.Minute,
		MaxKeys:    10000,
	})
	if err != nil {
		t.Fatalf("create rate limiter: %v", err)
	}
	logger := slog.Default()

	router := NewRouter(Dependencies{
		Config:          &config.Config{CORSOrigins: []string{"http://localhost:3000"}},
		Logger:          logger,
		DBPool:          pool,
		SessionStore:    sessStore,
		RBACStore:       rbacStore,
		CredentialStore: credStore,
		RateLimiter:     rateLimiter,
	})

	return httptest.NewServer(router), sessStore
}

// seedAdminActor creates an admin actor directly in the authz schema for testing.
func seedAdminActor(t *testing.T, db *pgxpool.Pool, actorID, email, displayName string) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err := db.Exec(ctx,
		`INSERT INTO authz.admin_actor (id, email, display_name, status)
		 VALUES ($1, $2, $3, 'active')
		 ON CONFLICT (id) DO UPDATE SET email=$2, display_name=$3, status='active'`,
		actorID, email, displayName)
	if err != nil {
		t.Fatalf("seed admin actor failed: %v", err)
	}
	t.Cleanup(func() {
		cctx, ccancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer ccancel()
		_, _ = db.Exec(cctx, `DELETE FROM authz.admin_actor WHERE id = $1`, actorID)
	})
}

// seedAdminRole creates a role for testing.
func seedAdminRole(t *testing.T, db *pgxpool.Pool, roleID, code, name string) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err := db.Exec(ctx,
		`INSERT INTO authz.admin_role (id, code, name, status)
		 VALUES ($1, $2, $3, 'active')
		 ON CONFLICT (id) DO UPDATE SET code=$2, name=$3, status='active'`,
		roleID, code, name)
	if err != nil {
		t.Fatalf("seed admin role failed: %v", err)
	}
	t.Cleanup(func() {
		cctx, ccancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer ccancel()
		_, _ = db.Exec(cctx, `DELETE FROM authz.admin_role WHERE id = $1`, roleID)
	})
}

// seedAdminPermission creates a permission for testing.
func seedAdminPermission(t *testing.T, db *pgxpool.Pool, permID, code string) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err := db.Exec(ctx,
		`INSERT INTO authz.admin_permission (id, code)
		 VALUES ($1, $2)
		 ON CONFLICT (id) DO UPDATE SET code=$2`,
		permID, code)
	if err != nil {
		t.Fatalf("seed admin permission failed: %v", err)
	}
	t.Cleanup(func() {
		cctx, ccancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer ccancel()
		_, _ = db.Exec(cctx, `DELETE FROM authz.admin_permission WHERE id = $1`, permID)
	})
}

func TestListActors_Success(t *testing.T) {
	pool := testPool(t)
	srv, sessStore := adminRBACTestServer(t)
	defer srv.Close()

	actorID := newUUID(t)
	email := fmt.Sprintf("list-actors-%s@example.com", actorID[:8])
	seedAdminActor(t, pool, actorID, email, "List Actor")
	rawToken := createAdminSession(t, sessStore, actorID)

	req, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/admin/actors", nil)
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: rawToken})
	resp, err := srv.Client().Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	var actors []map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&actors); err != nil {
		t.Fatalf("decode failed: %v", err)
	}
	if len(actors) < 1 {
		t.Error("expected at least one actor in list")
	}
}

func TestCreateActor_Success(t *testing.T) {
	pool := testPool(t)
	srv, sessStore := adminRBACTestServer(t)
	defer srv.Close()

	adminID := newUUID(t)
	adminEmail := fmt.Sprintf("create-admin-%s@example.com", adminID[:8])
	seedAdminActor(t, pool, adminID, adminEmail, "Creator Admin")
	rawToken := createAdminSession(t, sessStore, adminID)

	body := map[string]string{
		"email":       fmt.Sprintf("new-actor-%s@example.com", newUUID(t)[:8]),
		"displayName": "New Actor",
		"password":    "securepass123",
	}
	b, _ := json.Marshal(body)
	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/admin/actors", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: rawToken})
	req.Header.Set("X-CSRF-Token", "test-csrf")
	req.Header.Set("Origin", "http://localhost:3000")
	resp, err := srv.Client().Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected 201, got %d: %s", resp.StatusCode, string(body))
	}

	var result map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		t.Fatalf("decode failed: %v", err)
	}
	if result["id"] == "" {
		t.Error("expected id in response")
	}
}

func TestCreateActor_DuplicateEmail(t *testing.T) {
	pool := testPool(t)
	srv, sessStore := adminRBACTestServer(t)
	defer srv.Close()

	adminID := newUUID(t)
	adminEmail := fmt.Sprintf("dup-admin-%s@example.com", adminID[:8])
	seedAdminActor(t, pool, adminID, adminEmail, "Dup Admin")
	rawToken := createAdminSession(t, sessStore, adminID)

	newEmail := fmt.Sprintf("dup-target-%s@example.com", newUUID(t)[:8])
	body := map[string]string{
		"email":       newEmail,
		"displayName": "First Actor",
		"password":    "securepass123",
	}
	b, _ := json.Marshal(body)

	// First creation should succeed.
	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/admin/actors", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: rawToken})
	req.Header.Set("X-CSRF-Token", "test-csrf")
	req.Header.Set("Origin", "http://localhost:3000")
	resp, err := srv.Client().Do(req)
	if err != nil {
		t.Fatalf("first request failed: %v", err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("first creation expected 201, got %d", resp.StatusCode)
	}

	// Second creation with same email should conflict.
	req2, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/admin/actors", bytes.NewReader(b))
	req2.Header.Set("Content-Type", "application/json")
	req2.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: rawToken})
	req2.Header.Set("X-CSRF-Token", "test-csrf")
	req2.Header.Set("Origin", "http://localhost:3000")
	resp2, err := srv.Client().Do(req2)
	if err != nil {
		t.Fatalf("second request failed: %v", err)
	}
	defer resp2.Body.Close()

	if resp2.StatusCode != http.StatusConflict {
		t.Errorf("expected 409, got %d", resp2.StatusCode)
	}
}

func TestCreateActor_WeakPassword(t *testing.T) {
	pool := testPool(t)
	srv, sessStore := adminRBACTestServer(t)
	defer srv.Close()

	adminID := newUUID(t)
	adminEmail := fmt.Sprintf("weak-admin-%s@example.com", adminID[:8])
	seedAdminActor(t, pool, adminID, adminEmail, "Weak Admin")
	rawToken := createAdminSession(t, sessStore, adminID)

	body := map[string]string{
		"email":       fmt.Sprintf("weak-%s@example.com", newUUID(t)[:8]),
		"displayName": "Weak Actor",
		"password":    "short",
	}
	b, _ := json.Marshal(body)
	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/admin/actors", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: rawToken})
	req.Header.Set("X-CSRF-Token", "test-csrf")
	req.Header.Set("Origin", "http://localhost:3000")
	resp, err := srv.Client().Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", resp.StatusCode)
	}
}

func TestUpdateActorStatus_Success(t *testing.T) {
	pool := testPool(t)
	srv, sessStore := adminRBACTestServer(t)
	defer srv.Close()

	adminID := newUUID(t)
	adminEmail := fmt.Sprintf("status-admin-%s@example.com", adminID[:8])
	seedAdminActor(t, pool, adminID, adminEmail, "Status Admin")
	rawToken := createAdminSession(t, sessStore, adminID)

	targetID := newUUID(t)
	targetEmail := fmt.Sprintf("target-%s@example.com", targetID[:8])
	seedAdminActor(t, pool, targetID, targetEmail, "Target Actor")

	body := map[string]string{"status": "disabled"}
	b, _ := json.Marshal(body)
	req, _ := http.NewRequest(http.MethodPut, fmt.Sprintf("%s/api/admin/actors/%s/status", srv.URL, targetID), bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: rawToken})
	req.Header.Set("X-CSRF-Token", "test-csrf")
	req.Header.Set("Origin", "http://localhost:3000")
	resp, err := srv.Client().Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	var result map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		t.Fatalf("decode failed: %v", err)
	}
	if result["status"] != "disabled" {
		t.Errorf("expected status=disabled, got %v", result["status"])
	}
}

func TestUpdateActorStatus_CannotDisableSelf(t *testing.T) {
	pool := testPool(t)
	srv, sessStore := adminRBACTestServer(t)
	defer srv.Close()

	adminID := newUUID(t)
	adminEmail := fmt.Sprintf("self-admin-%s@example.com", adminID[:8])
	seedAdminActor(t, pool, adminID, adminEmail, "Self Admin")
	rawToken := createAdminSession(t, sessStore, adminID)

	body := map[string]string{"status": "disabled"}
	b, _ := json.Marshal(body)
	req, _ := http.NewRequest(http.MethodPut, fmt.Sprintf("%s/api/admin/actors/%s/status", srv.URL, adminID), bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: rawToken})
	req.Header.Set("X-CSRF-Token", "test-csrf")
	req.Header.Set("Origin", "http://localhost:3000")
	resp, err := srv.Client().Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusForbidden {
		t.Errorf("expected 403, got %d", resp.StatusCode)
	}
}

func TestAssignRole_Success(t *testing.T) {
	pool := testPool(t)
	srv, sessStore := adminRBACTestServer(t)
	defer srv.Close()

	adminID := newUUID(t)
	adminEmail := fmt.Sprintf("assign-admin-%s@example.com", adminID[:8])
	seedAdminActor(t, pool, adminID, adminEmail, "Assign Admin")
	rawToken := createAdminSession(t, sessStore, adminID)

	targetID := newUUID(t)
	targetEmail := fmt.Sprintf("assign-target-%s@example.com", targetID[:8])
	seedAdminActor(t, pool, targetID, targetEmail, "Assign Target")

	roleID := newUUID(t)
	seedAdminRole(t, pool, roleID, "test-role", "Test Role")

	body := map[string]string{"roleId": roleID}
	b, _ := json.Marshal(body)
	req, _ := http.NewRequest(http.MethodPost, fmt.Sprintf("%s/api/admin/actors/%s/roles", srv.URL, targetID), bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: rawToken})
	req.Header.Set("X-CSRF-Token", "test-csrf")
	req.Header.Set("Origin", "http://localhost:3000")
	resp, err := srv.Client().Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	var result map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		t.Fatalf("decode failed: %v", err)
	}
	if result["actorId"] != targetID {
		t.Errorf("expected actorId=%s, got %v", targetID, result["actorId"])
	}
	if result["roleId"] != roleID {
		t.Errorf("expected roleId=%s, got %v", roleID, result["roleId"])
	}
}

func TestAssignRole_Idempotent(t *testing.T) {
	pool := testPool(t)
	srv, sessStore := adminRBACTestServer(t)
	defer srv.Close()

	adminID := newUUID(t)
	adminEmail := fmt.Sprintf("idem-admin-%s@example.com", adminID[:8])
	seedAdminActor(t, pool, adminID, adminEmail, "Idem Admin")
	rawToken := createAdminSession(t, sessStore, adminID)

	targetID := newUUID(t)
	targetEmail := fmt.Sprintf("idem-target-%s@example.com", targetID[:8])
	seedAdminActor(t, pool, targetID, targetEmail, "Idem Target")

	roleID := newUUID(t)
	seedAdminRole(t, pool, roleID, "idem-role", "Idem Role")

	body := map[string]string{"roleId": roleID}
	b, _ := json.Marshal(body)

	// First assignment.
	req, _ := http.NewRequest(http.MethodPost, fmt.Sprintf("%s/api/admin/actors/%s/roles", srv.URL, targetID), bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: rawToken})
	req.Header.Set("X-CSRF-Token", "test-csrf")
	req.Header.Set("Origin", "http://localhost:3000")
	resp, err := srv.Client().Do(req)
	if err != nil {
		t.Fatalf("first request failed: %v", err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("first assignment expected 200, got %d", resp.StatusCode)
	}

	// Second assignment (idempotent).
	req2, _ := http.NewRequest(http.MethodPost, fmt.Sprintf("%s/api/admin/actors/%s/roles", srv.URL, targetID), bytes.NewReader(b))
	req2.Header.Set("Content-Type", "application/json")
	req2.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: rawToken})
	req2.Header.Set("X-CSRF-Token", "test-csrf")
	req2.Header.Set("Origin", "http://localhost:3000")
	resp2, err := srv.Client().Do(req2)
	if err != nil {
		t.Fatalf("second request failed: %v", err)
	}
	defer resp2.Body.Close()

	if resp2.StatusCode != http.StatusOK {
		t.Errorf("idempotent assignment expected 200, got %d", resp2.StatusCode)
	}
}

func TestRemoveRole_Success(t *testing.T) {
	pool := testPool(t)
	srv, sessStore := adminRBACTestServer(t)
	defer srv.Close()

	adminID := newUUID(t)
	adminEmail := fmt.Sprintf("remove-admin-%s@example.com", adminID[:8])
	seedAdminActor(t, pool, adminID, adminEmail, "Remove Admin")
	rawToken := createAdminSession(t, sessStore, adminID)

	targetID := newUUID(t)
	targetEmail := fmt.Sprintf("remove-target-%s@example.com", targetID[:8])
	seedAdminActor(t, pool, targetID, targetEmail, "Remove Target")

	roleID := newUUID(t)
	seedAdminRole(t, pool, roleID, "remove-role", "Remove Role")

	// Assign first.
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err := pool.Exec(ctx,
		`INSERT INTO authz.admin_actor_role (actor_id, role_id) VALUES ($1, $2)`,
		targetID, roleID)
	if err != nil {
		t.Fatalf("pre-assign role: %v", err)
	}

	req, _ := http.NewRequest(http.MethodDelete, fmt.Sprintf("%s/api/admin/actors/%s/roles/%s", srv.URL, targetID, roleID), nil)
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: rawToken})
	req.Header.Set("X-CSRF-Token", "test-csrf")
	req.Header.Set("Origin", "http://localhost:3000")
	resp, err := srv.Client().Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent {
		t.Errorf("expected 204, got %d", resp.StatusCode)
	}
}

func TestListRoles_Success(t *testing.T) {
	pool := testPool(t)
	srv, sessStore := adminRBACTestServer(t)
	defer srv.Close()

	adminID := newUUID(t)
	adminEmail := fmt.Sprintf("roles-admin-%s@example.com", adminID[:8])
	seedAdminActor(t, pool, adminID, adminEmail, "Roles Admin")
	rawToken := createAdminSession(t, sessStore, adminID)

	roleID := newUUID(t)
	seedAdminRole(t, pool, roleID, "list-test-role", "List Test Role")

	req, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/admin/roles", nil)
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: rawToken})
	resp, err := srv.Client().Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	var roles []map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&roles); err != nil {
		t.Fatalf("decode failed: %v", err)
	}
	found := false
	for _, r := range roles {
		if r["id"] == roleID {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("seeded role %s not found in list", roleID)
	}
}

func TestListPermissions_Success(t *testing.T) {
	pool := testPool(t)
	srv, sessStore := adminRBACTestServer(t)
	defer srv.Close()

	adminID := newUUID(t)
	adminEmail := fmt.Sprintf("perms-admin-%s@example.com", adminID[:8])
	seedAdminActor(t, pool, adminID, adminEmail, "Perms Admin")
	rawToken := createAdminSession(t, sessStore, adminID)

	permID := newUUID(t)
	seedAdminPermission(t, pool, permID, "users:read")

	req, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/admin/permissions", nil)
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: rawToken})
	resp, err := srv.Client().Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	var perms []map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&perms); err != nil {
		t.Fatalf("decode failed: %v", err)
	}
	found := false
	for _, p := range perms {
		if p["id"] == permID {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("seeded permission %s not found in list", permID)
	}
}
