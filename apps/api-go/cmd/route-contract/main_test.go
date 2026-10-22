package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/routecontract"
)

// go test ./... in the canonical Go CI gate must also reject stale generated files.
func TestGeneratedContractMatchesRouter(t *testing.T) {
	if err := synchronize(filepath.Join("..", "..", "..", ".."), true); err != nil {
		t.Fatal(err)
	}
}

func TestPermissionGuardsIncludesAnyPermission(t *testing.T) {
	input := []string{"authz.RequireAnyPermission(store, \"read\", \"write\")", "authn.CSRFGuard(cfg)", "authz.RequirePermission(store, \"admin\")"}
	want := []string{input[0], input[2]}
	if got := permissionGuards(input); !reflect.DeepEqual(got, want) {
		t.Fatalf("RBAC guards = %v, want %v", got, want)
	}
}

func TestUnverifiedWithoutTestEvidence(t *testing.T) {
	root := filepath.Join("..", "..", "..", "..")
	loginTest := "apps/api-go/internal/httpserver/handler_login_test.go"
	for _, tc := range []struct {
		name, root, method, path string
		evidence                 any
		want                     string
	}{
		{"known test", root, "POST", "/api/auth/login", []any{loginTest}, "test-evidenced"},
		{"unrelated operation", root, "POST", "/api/unknown", []any{loginTest}, "unverified"},
		{"wrong evidence", root, "POST", "/api/auth/login", []any{"apps/api-go/internal/httpserver/handler_profile_test.go"}, "unverified"},
		{"missing evidence", root, "POST", "/api/auth/login", nil, "unverified"},
		{"stale file", t.TempDir(), "POST", "/api/auth/login", []any{loginTest}, "unverified"},
		{"no handler test", root, "GET", "/api/content/lexemes", []any{loginTest}, "unverified"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if got := verificationStatus(tc.root, tc.method, tc.path, tc.evidence); got != tc.want {
				t.Fatalf("verification status = %s, want %s", got, tc.want)
			}
		})
	}
	for operation, proof := range verifiedOperations {
		parts := strings.SplitN(operation, " ", 2)
		evidence := []any{"apps/api-go/internal/httpserver/" + proof.file}
		if got := verificationStatus(root, parts[0], parts[1], evidence); got != "test-evidenced" {
			t.Errorf("allowlisted evidence missing for %s: %s", operation, got)
		}
	}
}

func TestNamedHandlerEvidenceDoesNotVerifySchemas(t *testing.T) {
	routes := []routecontract.Operation{{Method: "POST", Path: "/api/auth/login", Family: "auth"}}
	paths := map[string]any{"/api/auth/login": map[string]any{"post": map[string]any{
		"x-contract-verification": map[string]any{"status": "test-evidenced"},
		"x-verification":          []any{"apps/api-go/internal/httpserver/handler_login_test.go"},
	}}}
	inv, err := buildInventory(routes, paths)
	if err != nil {
		t.Fatal(err)
	}
	if inv.VerifiedContracts != 0 || inv.TestEvidencedContracts != 1 || inv.SourceOnlyContracts != 0 || inv.UnverifiedContracts != 1 {
		t.Fatalf("test evidence must not certify schemas: %+v", inv)
	}
	op := inv.Operations[0]
	for _, field := range []map[string]any{op.Request, op.Response, op.Validation} {
		if field["status"] != "unverified" {
			t.Fatalf("schema facet was wrongly promoted: %v", field)
		}
	}
	if op.Tests["status"] != "test-evidenced" || op.Contract["status"] != "test-evidenced" {
		t.Fatalf("test and contract facets lost evidence: %+v", op)
	}
}

func TestRegenerateDropsRetiredAPIRoutes(t *testing.T) {
	root := t.TempDir()
	serverDir := filepath.Join(root, "apps", "api-go", "internal", "httpserver")
	docsDir := filepath.Join(root, "docs")
	for _, dir := range []string{serverDir, docsDir} {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			t.Fatal(err)
		}
	}
	if err := os.WriteFile(filepath.Join(serverDir, "server.go"), []byte(`package httpserver
func NewRouter() { r.Get("/api/current", handler) }`), 0o644); err != nil {
		t.Fatal(err)
	}
	contract := filepath.Join(docsDir, "openapi.json")
	if err := os.WriteFile(contract, []byte(`{"paths":{"/api/retired":{"get":{}},"/api/current":{"get":{},"post":{}},"/health/live":{"get":{}}}}`), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := synchronize(root, true); err == nil || !strings.Contains(err.Error(), "stale") {
		t.Fatalf("check must reject stale API routes: %v", err)
	}
	if err := synchronize(root, false); err != nil {
		t.Fatal(err)
	}
	if err := synchronize(root, true); err != nil {
		t.Fatalf("regeneration must resolve stale routes: %v", err)
	}
	contents, err := os.ReadFile(contract)
	if err != nil {
		t.Fatal(err)
	}
	var document struct {
		Paths map[string]map[string]json.RawMessage `json:"paths"`
	}
	if err := json.Unmarshal(contents, &document); err != nil {
		t.Fatal(err)
	}
	if _, exists := document.Paths["/api/retired"]; exists {
		t.Fatal("retired API path was retained")
	}
	if len(document.Paths["/api/current"]) != 1 || document.Paths["/api/current"]["get"] == nil {
		t.Fatalf("retired HTTP method was retained: %v", document.Paths["/api/current"])
	}
	if document.Paths["/health/live"]["get"] == nil {
		t.Fatal("unrelated router surface was removed")
	}
}
