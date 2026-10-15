package httpserver

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"sort"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

// Capture a genuinely authenticated request before exercising actor changes or
// database failures, so these assertions test the handler's own fail-closed check.
func adminMeAuthenticatedRequest(t *testing.T, db *pgxpool.Pool, actorID string) *http.Request {
	t.Helper()
	store := session.NewStore(db)
	req := httptest.NewRequest(http.MethodGet, "/api/admin/me", nil)
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: createAdminSession(t, store, actorID)})
	var authenticated *http.Request
	guard := authn.AdminGuard(store, authn.DefaultGuardConfig(testLogger()))
	w := httptest.NewRecorder()
	guard(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		authenticated = r
	})).ServeHTTP(w, req)
	if authenticated == nil {
		t.Fatalf("authenticate request: status=%d body=%s", w.Code, w.Body.String())
	}
	return authenticated
}

func TestAdminMeRegression_CanonicalActorRoles(t *testing.T) {
	db := testPool(t)
	ctx := context.Background()
	actorID := newUUID(t)
	email := "admin-me-" + actorID + "@example.com"
	seedActiveAdmin(t, db, actorID, "Canonical Admin", email)
	permissionIDs := []string{newUUID(t), newUUID(t), newUUID(t)}
	permissionCodes := []string{"dashboard." + actorID, "audit." + actorID, "disabled." + actorID}
	for i, id := range permissionIDs {
		seedAdminPermission(t, db, id, permissionCodes[i])
	}
	expectedRoles := map[string][]string{}
	for i, name := range []string{"editor", "auditor", "empty", "disabled"} {
		roleID, roleCode := newUUID(t), name+"-"+actorID
		seedAdminRole(t, db, roleID, roleCode, name)
		if _, err := db.Exec(ctx, `INSERT INTO authz.admin_actor_role (actor_id, role_id) VALUES ($1, $2)`, actorID, roleID); err != nil {
			t.Fatal(err)
		}
		indices := [][]int{{0, 1}, {1}, {}, {2}}[i]
		codes := []string{}
		for _, index := range indices {
			if _, err := db.Exec(ctx, `INSERT INTO authz.admin_role_permission (role_id, permission_id) VALUES ($1, $2)`, roleID, permissionIDs[index]); err != nil {
				t.Fatal(err)
			}
			codes = append(codes, permissionCodes[index])
		}
		if name == "disabled" {
			if _, err := db.Exec(ctx, `UPDATE authz.admin_role SET status = 'disabled' WHERE id = $1`, roleID); err != nil {
				t.Fatal(err)
			}
		} else {
			sort.Strings(codes)
			expectedRoles[roleCode] = codes
		}
	}
	w := httptest.NewRecorder()
	adminMeHandler(db, testLogger()).ServeHTTP(w, adminMeAuthenticatedRequest(t, db, actorID))
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var body struct {
		ID, ActorID, Email, DisplayName, Status string
		Permissions                             []string
		Roles                                   []struct {
			Role struct {
				ID, Code, Name, Status string
				Permissions            []struct {
					Permission struct{ ID, Code string }
				}
			}
		}
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	actualRoles := map[string][]string{}
	for _, link := range body.Roles {
		role := link.Role
		if role.ID == "" || role.Name == "" || role.Status != "active" || role.Permissions == nil {
			t.Errorf("expected canonical active role with a permissions array, got %+v", role)
		}
		codes := []string{}
		for _, rp := range role.Permissions {
			if rp.Permission.ID == "" {
				t.Error("expected canonical permission ID")
			}
			codes = append(codes, rp.Permission.Code)
		}
		sort.Strings(codes)
		if _, duplicate := actualRoles[role.Code]; duplicate {
			t.Errorf("expected one entry per active role, duplicate %q", role.Code)
		}
		actualRoles[role.Code] = codes
	}
	if !reflect.DeepEqual(actualRoles, expectedRoles) {
		t.Fatalf("expected canonical nested active role permissions; got %v, want %v; body=%s", actualRoles, expectedRoles, w.Body.String())
	}
	if body.ID != actorID || body.ActorID != actorID || body.Email != email || body.DisplayName != "Canonical Admin" || body.Status != "active" {
		t.Errorf("expected canonical actor identity, got %+v", body)
	}
	expectedPermissions := append([]string{}, permissionCodes[:2]...)
	sort.Strings(expectedPermissions)
	sort.Strings(body.Permissions)
	if !reflect.DeepEqual(body.Permissions, expectedPermissions) {
		t.Errorf("expected deduplicated flat permissions %v, got %v", expectedPermissions, body.Permissions)
	}
}

func TestAdminMeRegression_WildcardAndNoRoles(t *testing.T) {
	for _, wildcard := range []bool{false, true} {
		t.Run(map[bool]string{false: "no_roles", true: "wildcard"}[wildcard], func(t *testing.T) {
			db := testPool(t)
			actorID := newUUID(t)
			seedActiveAdmin(t, db, actorID, "Admin", actorID+"@example.com")
			if wildcard {
				roleID := newUUID(t)
				seedAdminRole(t, db, roleID, "wildcard-"+actorID, "Super Admin")
				var permissionID string
				if err := db.QueryRow(context.Background(), `INSERT INTO authz.admin_permission (code) VALUES ('*') ON CONFLICT (code) DO UPDATE SET code = EXCLUDED.code RETURNING id`).Scan(&permissionID); err != nil {
					t.Fatal(err)
				}
				if _, err := db.Exec(context.Background(), `INSERT INTO authz.admin_actor_role (actor_id, role_id) VALUES ($1, $2)`, actorID, roleID); err != nil {
					t.Fatal(err)
				}
				if _, err := db.Exec(context.Background(), `INSERT INTO authz.admin_role_permission (role_id, permission_id) VALUES ($1, $2)`, roleID, permissionID); err != nil {
					t.Fatal(err)
				}
			}
			w := httptest.NewRecorder()
			adminMeHandler(db, testLogger()).ServeHTTP(w, adminMeAuthenticatedRequest(t, db, actorID))
			var body struct {
				Roles []struct {
					Role struct {
						Permissions []struct{ Permission struct{ Code string } }
					}
				}
				Permissions []string
			}
			if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
				t.Fatal(err)
			}
			if w.Code != http.StatusOK || body.Roles == nil || body.Permissions == nil {
				t.Fatalf("expected 200 with roles and permissions arrays, got %d: %s", w.Code, w.Body.String())
			}
			if wildcard {
				if len(body.Roles) != 1 || len(body.Roles[0].Role.Permissions) != 1 || body.Roles[0].Role.Permissions[0].Permission.Code != "*" || !reflect.DeepEqual(body.Permissions, []string{"*"}) {
					t.Errorf("expected real wildcard in nested and flat permissions, got %s", w.Body.String())
				}
			} else if len(body.Roles) != 0 || len(body.Permissions) != 0 {
				t.Errorf("expected no invented grants for actor without roles, got %s", w.Body.String())
			}
		})
	}
}

func TestAdminMeRegression_FailClosed(t *testing.T) {
	for _, scenario := range []struct {
		name   string
		status int
	}{
		{"unauthenticated", http.StatusUnauthorized},
		{"disabled_actor", http.StatusForbidden},
		{"missing_actor", http.StatusForbidden},
		{"database_error", http.StatusInternalServerError},
	} {
		t.Run(scenario.name, func(t *testing.T) {
			db := testPool(t)
			actorID := newUUID(t)
			seedActiveAdmin(t, db, actorID, "Admin", actorID+"@example.com")
			req := adminMeAuthenticatedRequest(t, db, actorID)
			switch scenario.name {
			case "unauthenticated":
				req = httptest.NewRequest(http.MethodGet, "/api/admin/me", nil)
			case "disabled_actor":
				if _, err := db.Exec(context.Background(), `UPDATE authz.admin_actor SET status = 'disabled' WHERE id = $1`, actorID); err != nil {
					t.Fatal(err)
				}
			case "missing_actor":
				if _, err := db.Exec(context.Background(), `DELETE FROM authz.admin_actor WHERE id = $1`, actorID); err != nil {
					t.Fatal(err)
				}
			case "database_error":
				db = testPool(t)
				db.Close()
			}
			w := httptest.NewRecorder()
			adminMeHandler(db, testLogger()).ServeHTTP(w, req)
			if w.Code != scenario.status {
				t.Fatalf("expected fail-closed status %d, got %d: %s", scenario.status, w.Code, w.Body.String())
			}
			var body map[string]json.RawMessage
			if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
				t.Fatal(err)
			}
			if len(body) != 1 || body["error"] == nil {
				t.Errorf("expected only safe error response, got %s", w.Body.String())
			}
		})
	}
}
