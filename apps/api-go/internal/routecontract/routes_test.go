package routecontract

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestDiscoverChainedGuardsAndLoopRoutes(t *testing.T) {
	path := filepath.Join(t.TempDir(), "server.go")
	source := `package httpserver
func NewRouter() {
	r.Group(func(ar Router) {
		ar.Use(adminGuard)
		ar.With(permission("read"), csrfGuard).Post("/api/admin/items", handler)
		for _, kind := range []string{"a", "b"} {
			ar.With(permission("write")).Get("/api/admin/" + kind, handler)
		}
	})
}`
	if err := os.WriteFile(path, []byte(source), 0o600); err != nil {
		t.Fatal(err)
	}
	routes, err := Discover(path)
	if err != nil {
		t.Fatal(err)
	}
	if len(routes) != 3 {
		t.Fatalf("discovered %d operations, want 3", len(routes))
	}
	for _, route := range routes {
		if !strings.Contains(strings.Join(route.Guards, ","), "adminGuard") {
			t.Errorf("%s missing inherited admin guard: %v", route.Path, route.Guards)
		}
		if route.Path == "/api/admin/items" && (len(route.Guards) != 3 || route.Guards[1] != `permission("read")` || route.Guards[2] != "csrfGuard") {
			t.Errorf("chained route lost With middleware: %v", route.Guards)
		}
	}
}

func TestDiscoverExactAPIRoot(t *testing.T) {
	path := filepath.Join(t.TempDir(), "server.go")
	if err := os.WriteFile(path, []byte(`package httpserver
func NewRouter() { r.Get("/api", handler); r.Get("/outside", handler) }`), 0o600); err != nil {
		t.Fatal(err)
	}
	routes, err := Discover(path)
	if err != nil {
		t.Fatal(err)
	}
	if len(routes) != 1 || routes[0].Method != "GET" || routes[0].Path != "/api" {
		t.Fatalf("exact API root should be discovered, got %+v", routes)
	}
}

func TestDiscoverRejectsRouterAliases(t *testing.T) {
	for _, registration := range []string{
		`api := r.With(mw); api.Get("/api/new", handler)`,
		`api := r; api.Post("/api/new", handler)`,
		`base := r.With(mw); api := base.With(other); api.Get("/api/new", handler)`,
		`var api = r.With(mw); api.Get("/api/new", handler)`,
	} {
		t.Run(registration, func(t *testing.T) {
			path := filepath.Join(t.TempDir(), "server.go")
			if err := os.WriteFile(path, []byte("package httpserver\nfunc NewRouter() { "+registration+" }"), 0o600); err != nil {
				t.Fatal(err)
			}
			if _, err := Discover(path); err == nil || !strings.Contains(err.Error(), "unsupported router registration") {
				t.Fatalf("router alias must fail closed, got %v", err)
			}
		})
	}
}

func TestDiscoverRejectsDynamicRoute(t *testing.T) {
	path := filepath.Join(t.TempDir(), "server.go")
	if err := os.WriteFile(path, []byte(`package httpserver
func NewRouter() { r.Get(dynamicPath, handler) }`), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := Discover(path); err == nil || !strings.Contains(err.Error(), "dynamic route path") {
		t.Fatalf("dynamic route must fail discovery, got %v", err)
	}
}

func TestDiscoverRejectsUnsupportedRegistration(t *testing.T) {
	for _, call := range []string{
		`r.Handle("/api/new", handler)`,
		`r.HandleFunc("/api/new", handler)`,
		`r.MethodFunc("GET", "/api/new", handler)`,
		`r.Head("/api/new", handler)`,
		`r.Options("/api/new", handler)`,
		`r.Route("/api", func(r Router) { r.Get("/new", handler) })`,
		`r.Mount("/api", otherRouter)`,
		`r.Group(namedGroup)`,
		`switch x { case 1: r.Get("/api/new", handler) }`,
		`registerNewRoutes(r)`,
		`r.Group(func(ar Router) { if enabled { ar.Use(permission) }; ar.Get("/api/new", handler) })`,
	} {
		t.Run(call, func(t *testing.T) {
			path := filepath.Join(t.TempDir(), "server.go")
			source := "package httpserver\nfunc NewRouter() { r := chi.NewRouter(); " + call + " }"
			if err := os.WriteFile(path, []byte(source), 0o600); err != nil {
				t.Fatal(err)
			}
			if _, err := Discover(path); err == nil {
				t.Fatalf("unhandled route registration silently accepted: %s", call)
			}
		})
	}
}
