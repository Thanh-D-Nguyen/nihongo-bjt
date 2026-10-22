package httpserver

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/routecontract"
)

func TestOpenAPIHasEverySourceRegisteredAPIRoute(t *testing.T) {
	root := filepath.Join("..", "..", "..", "..")
	routes, err := routecontract.Discover(filepath.Join(root, "apps", "api-go", "internal", "httpserver", "server.go"))
	if err != nil {
		t.Fatalf("discover source routes: %v", err)
	}

	contents, err := os.ReadFile(filepath.Join(root, "docs", "openapi.json"))
	if err != nil {
		t.Fatalf("read OpenAPI: %v", err)
	}
	var document struct {
		Paths      map[string]map[string]json.RawMessage `json:"paths"`
		Components struct {
			Parameters map[string]json.RawMessage `json:"parameters"`
		} `json:"components"`
	}
	if err := json.Unmarshal(contents, &document); err != nil {
		t.Fatalf("decode OpenAPI: %v", err)
	}

	source := make(map[string]bool, len(routes))
	operationIDs := make(map[string]string, len(routes))
	for _, route := range routes {
		key := route.Method + " " + route.Path
		source[key] = true
		raw := document.Paths[route.Path][strings.ToLower(route.Method)]
		if raw == nil {
			t.Errorf("undocumented source route %s", key)
			continue
		}
		var operation struct {
			OperationID string `json:"operationId"`
			Parameters  []struct {
				Ref      string `json:"$ref"`
				Name     string `json:"name"`
				In       string `json:"in"`
				Required bool   `json:"required"`
			} `json:"parameters"`
			Contract struct {
				Status string `json:"status"`
			} `json:"x-contract-verification"`
		}
		if err := json.Unmarshal(raw, &operation); err != nil {
			t.Errorf("decode OpenAPI operation %s: %v", key, err)
			continue
		}
		if operation.OperationID == "" {
			t.Errorf("OpenAPI operation %s has no operationId", key)
		} else if previous, exists := operationIDs[operation.OperationID]; exists {
			t.Errorf("duplicate OpenAPI operationId %q for %s and %s", operation.OperationID, previous, key)
		} else {
			operationIDs[operation.OperationID] = key
		}
		if operation.Contract.Status != "verified" && operation.Contract.Status != "test-evidenced" && operation.Contract.Status != "unverified" {
			t.Errorf("OpenAPI operation %s has invalid contract status %q", key, operation.Contract.Status)
		}
		for _, match := range regexp.MustCompile(`\{([^{}]+)\}`).FindAllStringSubmatch(route.Path, -1) {
			found := false
			for _, parameter := range operation.Parameters {
				if strings.HasPrefix(parameter.Ref, "#/components/parameters/") {
					ref := strings.TrimPrefix(parameter.Ref, "#/components/parameters/")
					if err := json.Unmarshal(document.Components.Parameters[ref], &parameter); err != nil {
						t.Errorf("unresolved parameter reference %s in %s: %v", ref, key, err)
						continue
					}
				}
				if parameter.Name == match[1] && parameter.In == "path" && parameter.Required {
					found = true
					break
				}
			}
			if !found {
				t.Errorf("OpenAPI operation %s lacks required path parameter %s", key, match[1])
			}
		}
	}
	for path, methods := range document.Paths {
		for method := range methods {
			if !isHTTPMethod(method) {
				continue
			}
			key := strings.ToUpper(method) + " " + path
			if !source[key] {
				t.Errorf("obsolete OpenAPI operation %s", key)
			}
		}
	}
	assertRouteInventory(t, root, source, len(routes))

	// A minimally configured live router must not reveal /api routes missed by
	// the source extractor. Conditional routes still need separate evidence.
	live := NewRouter(Dependencies{Config: &config.Config{}, Logger: slog.Default()})
	chiRoutes, ok := live.(chi.Routes)
	if !ok {
		t.Fatal("live router does not implement chi.Routes")
	}
	observed := 0
	if err := chi.Walk(chiRoutes, func(method, pattern string, _ http.Handler, _ ...func(http.Handler) http.Handler) error {
		if pattern == "/api" || strings.HasPrefix(pattern, "/api/") {
			observed++
			if !source[method+" "+pattern] {
				t.Errorf("active Chi route absent from source/OpenAPI: %s %s", method, pattern)
			}
		}
		return nil
	}); err != nil {
		t.Fatalf("walk active router: %v", err)
	}
	if observed == 0 {
		t.Fatal("active Chi router yielded no /api operations")
	}
}

func assertRouteInventory(t *testing.T, root string, source map[string]bool, sourceCount int) {
	t.Helper()
	contents, err := os.ReadFile(filepath.Join(root, "docs", "api-route-inventory.json"))
	if err != nil {
		t.Fatalf("read route inventory: %v", err)
	}
	var inventory struct {
		SourceRegisteredOperations int `json:"sourceRegisteredOperations"`
		OpenAPIOperations          int `json:"openAPIOperations"`
		Operations                 []struct {
			Method   string `json:"method"`
			Path     string `json:"path"`
			Contract struct {
				Status string `json:"status"`
			} `json:"contract"`
		} `json:"operations"`
	}
	if err := json.Unmarshal(contents, &inventory); err != nil {
		t.Fatalf("decode route inventory: %v", err)
	}
	if inventory.SourceRegisteredOperations != sourceCount || inventory.OpenAPIOperations != sourceCount {
		t.Errorf("inventory counts source=%d OpenAPI=%d, want %d", inventory.SourceRegisteredOperations, inventory.OpenAPIOperations, sourceCount)
	}
	keys := make([]string, 0, len(inventory.Operations))
	for _, operation := range inventory.Operations {
		key := operation.Method + " " + operation.Path
		keys = append(keys, key)
		if !source[key] {
			t.Errorf("inventory contains obsolete route %s", key)
		}
		if operation.Contract.Status != "verified" && operation.Contract.Status != "test-evidenced" && operation.Contract.Status != "unverified" {
			t.Errorf("inventory route %s has invalid contract status %q", key, operation.Contract.Status)
		}
	}
	sort.Strings(keys)
	for index := 1; index < len(keys); index++ {
		if keys[index] == keys[index-1] {
			t.Errorf("inventory duplicates route %s", keys[index])
		}
	}
	if len(keys) != sourceCount {
		t.Errorf("inventory has %d operations, want %d", len(keys), sourceCount)
	}
}

func isHTTPMethod(method string) bool {
	switch method {
	case "get", "post", "put", "patch", "delete", "head", "options", "trace":
		return true
	default:
		return false
	}
}
