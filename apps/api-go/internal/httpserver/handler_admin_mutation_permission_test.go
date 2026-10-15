package httpserver

import (
	"net/http"
	"net/http/httptest"
	"regexp"
	"sort"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
)

// Admin mutations that any authenticated operator may perform on their own
// account. Everything else under /api/admin must be gated by a permission.
// Session endpoints are exercised separately: they authenticate or revoke the
// very session this walk reuses, which would turn later results into 401s.
var adminSelfServiceMutations = map[string]bool{
	"POST /api/admin/login":  true,
	"POST /api/admin/logout": true,
}

var routeParam = regexp.MustCompile(`\{[^}]+\}`)

type adminRoute struct{ method, pattern string }

func adminMutatingRoutes(t *testing.T, handler http.Handler) []adminRoute {
	t.Helper()
	routes, ok := handler.(chi.Routes)
	if !ok {
		t.Fatal("router does not expose its route table")
	}
	var mutating []adminRoute
	if err := chi.Walk(routes, func(method, pattern string, _ http.Handler, _ ...func(http.Handler) http.Handler) error {
		switch method {
		case http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete:
			if strings.HasPrefix(pattern, "/api/admin/") || pattern == "/api/search/index" {
				if !adminSelfServiceMutations[method+" "+pattern] {
					mutating = append(mutating, adminRoute{method, pattern})
				}
			}
		}
		return nil
	}); err != nil {
		t.Fatalf("walk routes: %v", err)
	}
	if len(mutating) < 50 {
		t.Fatalf("route walk found only %d admin mutations; the table is not being enumerated", len(mutating))
	}
	return mutating
}

func TestAdminMutatingRoutesDenyActorsWithoutPermissions(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, actorID+"@no-permission.example.com", "No permission operator")
	token := createAdminSession(t, sessions, actorID)
	mutating := adminMutatingRoutes(t, srv.Config.Handler)

	var exposed []string
	for _, rt := range mutating {
		path := routeParam.ReplaceAllString(strings.ReplaceAll(rt.pattern, "/*", "/x"), newUUID(t))
		req := httptest.NewRequest(rt.method, path, strings.NewReader(`{}`))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Origin", "http://localhost:3000")
		req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		rec := httptest.NewRecorder()
		srv.Config.Handler.ServeHTTP(rec, req)
		if rec.Code != http.StatusForbidden && rec.Code != http.StatusUnauthorized {
			exposed = append(exposed, rt.method+" "+rt.pattern+" -> "+http.StatusText(rec.Code))
		}
	}
	sort.Strings(exposed)
	if len(exposed) > 0 {
		t.Fatalf("%d admin mutation(s) reachable without any permission:\n%s", len(exposed), strings.Join(exposed, "\n"))
	}
}

// A fully privileged operator must still be unable to mutate state from a page
// on another origin: every admin mutation sits behind the CSRF origin check.
func TestAdminMutatingRoutesRejectCrossOriginRequests(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, actorID+"@cross-origin.example.com", "Cross origin operator")
	grantAdminPermission(t, db, actorID, "*")
	token := createAdminSession(t, sessions, actorID)

	var accepted []string
	for _, rt := range adminMutatingRoutes(t, srv.Config.Handler) {
		path := routeParam.ReplaceAllString(strings.ReplaceAll(rt.pattern, "/*", "/x"), newUUID(t))
		req := httptest.NewRequest(rt.method, path, strings.NewReader(`{}`))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Origin", "https://attacker.example")
		req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		rec := httptest.NewRecorder()
		srv.Config.Handler.ServeHTTP(rec, req)
		if rec.Code != http.StatusForbidden {
			accepted = append(accepted, rt.method+" "+rt.pattern+" -> "+http.StatusText(rec.Code))
		}
	}
	sort.Strings(accepted)
	if len(accepted) > 0 {
		t.Fatalf("%d admin mutation(s) accept a cross-origin request:\n%s", len(accepted), strings.Join(accepted, "\n"))
	}
}
