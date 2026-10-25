// route-contract synchronizes source-discovered API operations into the
// canonical OpenAPI document and its machine-readable verification inventory.
package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"strings"
	"unicode"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/routecontract"
)

type inventory struct {
	Scope                      string                    `json:"scope"`
	SourceRegisteredOperations int                       `json:"sourceRegisteredOperations"`
	OpenAPIOperations          int                       `json:"openAPIOperations"`
	VerifiedContracts          int                       `json:"verifiedContracts"`
	TestEvidencedContracts     int                       `json:"testEvidencedContracts"`
	SourceOnlyContracts        int                       `json:"sourceOnlyContracts"`
	UnverifiedContracts        int                       `json:"unverifiedContracts"`
	RuntimeVerifiedOperations  int                       `json:"runtimeVerifiedOperations"`
	Families                   map[string]familyCoverage `json:"families"`
	Operations                 []inventoryOperation      `json:"operations"`
}

type familyCoverage struct {
	Routes        int `json:"routes"`
	Verified      int `json:"verifiedContracts"`
	TestEvidenced int `json:"testEvidencedContracts"`
}

type inventoryOperation struct {
	routecontract.Operation
	Authentication map[string]any `json:"authentication"`
	Authorization  map[string]any `json:"authorization"`
	Request        map[string]any `json:"request"`
	Response       map[string]any `json:"response"`
	Validation     map[string]any `json:"validation"`
	Tests          map[string]any `json:"tests"`
	Contract       map[string]any `json:"contract"`
	Runtime        map[string]any `json:"runtimeAvailability"`
}

func main() {
	root := flag.String("root", "", "repository root")
	check := flag.Bool("check", false, "fail instead of writing changed documents")
	flag.Parse()
	if *root == "" {
		var err error
		*root, err = findRoot()
		if err != nil {
			fatal(err)
		}
	}
	if err := synchronize(*root, *check); err != nil {
		fatal(err)
	}
}

func synchronize(root string, check bool) error {
	routes, err := routecontract.Discover(filepath.Join(root, "apps", "api-go", "internal", "httpserver", "server.go"))
	if err != nil {
		return err
	}
	openAPIPath := filepath.Join(root, "docs", "openapi.json")
	document, err := readObject(openAPIPath)
	if err != nil {
		return err
	}
	paths, ok := document["paths"].(map[string]any)
	if !ok {
		return fmt.Errorf("OpenAPI paths is not an object")
	}
	// Reconcile deletions as well as additions within the direct /api scope.
	registered := make(map[string]bool, len(routes))
	for _, route := range routes {
		registered[route.Method+" "+route.Path] = true
	}
	for path, item := range paths {
		if path != "/api" && !strings.HasPrefix(path, "/api/") {
			continue
		}
		pathItem, ok := item.(map[string]any)
		if !ok {
			return fmt.Errorf("invalid OpenAPI path object %s", path)
		}
		remaining := 0
		for method := range pathItem {
			switch method {
			case "get", "post", "put", "patch", "delete", "head", "options", "trace":
				if !registered[strings.ToUpper(method)+" "+path] {
					delete(pathItem, method)
				} else {
					remaining++
				}
			}
		}
		if remaining == 0 {
			delete(paths, path)
		}
	}

	for _, route := range routes {
		pathItem, ok := paths[route.Path].(map[string]any)
		if !ok {
			pathItem = make(map[string]any)
			paths[route.Path] = pathItem
		}
		method := strings.ToLower(route.Method)
		operation, exists := pathItem[method].(map[string]any)
		if !exists {
			operation = map[string]any{
				"operationId": operationID(route.Method, route.Path),
				"tags":        []any{route.Family},
				"summary":     "Source-discovered route handled by " + route.Handler,
				"responses": map[string]any{
					"default": map[string]any{"description": "Response schema is not yet verified; see the route inventory."},
				},
			}
			pathItem[method] = operation
		}
		if _, hasParameters := operation["parameters"]; !hasParameters {
			var parameters []any
			for _, segment := range strings.Split(route.Path, "/") {
				if strings.HasPrefix(segment, "{") && strings.HasSuffix(segment, "}") {
					parameters = append(parameters, map[string]any{
						"name": strings.Trim(segment, "{}"), "in": "path", "required": true,
						"schema":      map[string]any{"type": "string"},
						"description": "Path token; application-level format and validation are unverified.",
					})
				}
			}
			if len(parameters) > 0 {
				operation["parameters"] = parameters
			}
		}
		status := verificationStatus(root, route.Method, route.Path, operation["x-verification"])
		operation["x-contract-verification"] = map[string]any{
			"status": status,
			"scope":  contractScope(status),
		}
		operation["x-route-source"] = map[string]any{
			"handler":           route.Handler,
			"guards":            route.Guards,
			"runtimeConditions": route.RuntimeConditions,
		}
	}
	document["x-contract-scope"] = "Static inventory of /api operations registered directly in apps/api-go/internal/httpserver/server.go NewRouter; excludes /health and /ws routes. Conditional routes are not proven available at runtime. Request/response verification is per operation."
	document["x-generated-from"] = "apps/api-go/cmd/route-contract; run go run ./cmd/route-contract -root ../.. from apps/api-go after route changes."

	openAPI, err := marshal(document)
	if err != nil {
		return err
	}
	inv, err := buildInventory(routes, paths)
	if err != nil {
		return err
	}
	inventoryJSON, err := marshal(inv)
	if err != nil {
		return err
	}
	changes := []fileChange{{openAPIPath, openAPI}, {filepath.Join(root, "docs", "api-route-inventory.json"), inventoryJSON}}
	if check {
		for _, change := range changes {
			current, err := os.ReadFile(change.path)
			if err != nil || string(current) != string(change.contents) {
				return fmt.Errorf("%s is stale; run go run ./cmd/route-contract -root %s", change.path, root)
			}
		}
		return nil
	}
	for _, change := range changes {
		if err := os.WriteFile(change.path, change.contents, 0o644); err != nil {
			return fmt.Errorf("write %s: %w", change.path, err)
		}
	}
	return nil
}

type fileChange struct {
	path     string
	contents []byte
}

func buildInventory(routes []routecontract.Operation, paths map[string]any) (inventory, error) {
	result := inventory{
		Scope:                      "Static /api inventory of direct NewRouter registrations (excludes /health and /ws). Conditions do not prove runtime availability.",
		SourceRegisteredOperations: len(routes),
		Families:                   make(map[string]familyCoverage),
		Operations:                 make([]inventoryOperation, 0, len(routes)),
	}
	for _, route := range routes {
		pathItem := paths[route.Path].(map[string]any)
		operation := pathItem[strings.ToLower(route.Method)].(map[string]any)
		verification, _ := operation["x-contract-verification"].(map[string]any)
		status, _ := verification["status"].(string)
		if status == "" {
			return result, fmt.Errorf("missing contract status for %s %s", route.Method, route.Path)
		}
		coverage := result.Families[route.Family]
		coverage.Routes++
		if status == "verified" {
			coverage.Verified++
			result.VerifiedContracts++
		} else if status == "test-evidenced" {
			coverage.TestEvidenced++
			result.TestEvidencedContracts++
		} else {
			result.SourceOnlyContracts++
		}
		if status != "verified" {
			result.UnverifiedContracts++
		}
		result.Families[route.Family] = coverage
		result.Operations = append(result.Operations, inventoryOperation{
			Operation: route,
			Authentication: map[string]any{
				"status": "source-inferred", "guards": nonNil(route.Guards),
			},
			Authorization: map[string]any{
				"status": "source-inferred", "rbacGuards": permissionGuards(route.Guards),
			},
			Request:    facet("unverified", "request DTO and headers"),
			Response:   facet("unverified", "response DTO and status codes"),
			Validation: facet("unverified", "handler validation"),
			Tests:      testFacet(status, operation["x-verification"]),
			Contract: map[string]any{
				"status": status, "openAPIPath": route.Path, "method": strings.ToLower(route.Method),
			},
			Runtime: map[string]any{
				"status": "not-runtime-verified", "sourceConditions": nonNil(route.RuntimeConditions),
			},
		})
	}
	for path, item := range paths {
		if path != "/api" && !strings.HasPrefix(path, "/api/") {
			continue
		}
		methods, ok := item.(map[string]any)
		if !ok {
			return result, fmt.Errorf("invalid OpenAPI path object")
		}
		for method := range methods {
			switch method {
			case "get", "post", "put", "patch", "delete", "head", "options", "trace":
				result.OpenAPIOperations++
			}
		}
	}
	if result.OpenAPIOperations != result.SourceRegisteredOperations {
		return result, fmt.Errorf("OpenAPI contains %d operations, source contains %d", result.OpenAPIOperations, result.SourceRegisteredOperations)
	}
	return result, nil
}

// A named handler test is evidence that a scenario is exercised, not proof
// that every declared schema field and status code has been validated.
var verifiedOperations = map[string]struct{ file, test string }{
	"POST /api/auth/google":                     {"handler_google_login_test.go", "TestGoogleLoginCreatesIdentityAndReusesIt"},
	"POST /api/auth/login":                      {"handler_login_test.go", "TestLearnerLogin_Success_SetsSecureCookie"},
	"POST /api/auth/logout":                     {"handler_auth_wave6_test.go", "TestAudit159Wave6LearnerAuthSessionLifecycle"},
	"GET /api/auth/me":                          {"handler_profile_test.go", "TestLearnerGetMe_Success"},
	"GET /api/levels":                           {"handler_levels_test.go", "TestLevelListReturnsLocalizedCanonicalLevels"},
	"GET /api/levels/{code}":                    {"handler_levels_test.go", "TestLevelDetailReturnsEstablishedBJTDefinition"},
	"GET /api/levels/{code}/lessons":            {"handler_levels_test.go", "TestLevelLessonsExposePublishedRowsAndLearnerProgress"},
	"GET /api/search":                           {"handler_search_test.go", "TestSearchReturnsClientCompatibleScopedArray"},
	"GET /api/scenarios":                        {"handler_scenario_test.go", "TestScenarioLearnerHTTPContract"},
	"GET /api/scenarios/{scenarioId}":           {"handler_scenario_test.go", "TestScenarioLearnerHTTPContract"},
	"GET /api/scenarios/{scenarioId}/attempts":  {"handler_scenario_test.go", "TestScenarioLearnerHTTPContract"},
	"POST /api/scenarios/steps/{stepId}/answer": {"handler_scenario_test.go", "TestScenarioLearnerHTTPContract"},
	"POST /api/scenarios/{scenarioId}/complete": {"handler_scenario_test.go", "TestScenarioLearnerHTTPContract"},
}

func verificationStatus(root, method, path string, evidence any) string {
	proof, listed := verifiedOperations[method+" "+path]
	if !listed {
		return "unverified"
	}
	items, ok := evidence.([]any)
	if !ok || len(items) != 1 {
		return "unverified"
	}
	testPath := filepath.Join("apps", "api-go", "internal", "httpserver", proof.file)
	if items[0] != filepath.ToSlash(testPath) {
		return "unverified"
	}
	file, err := parser.ParseFile(token.NewFileSet(), filepath.Join(root, testPath), nil, 0)
	if err != nil {
		return "unverified"
	}
	for _, decl := range file.Decls {
		if fn, ok := decl.(*ast.FuncDecl); ok && fn.Recv == nil && fn.Name.Name == proof.test {
			return "test-evidenced"
		}
	}
	return "unverified"
}

func nonNil(items []string) []string {
	if items == nil {
		return []string{}
	}
	return items
}

func facet(status, subject string) map[string]any {
	if status == "verified" {
		return map[string]any{"status": "verified", "evidence": "OpenAPI x-verification", "subject": subject}
	}
	return map[string]any{"status": "unverified", "subject": subject}
}

func testFacet(status string, evidence any) map[string]any {
	result := facet(status, "handler integration tests")
	if status == "test-evidenced" {
		result["status"] = "test-evidenced"
		result["evidence"] = evidence
		return result
	}
	result["evidence"] = []any{}
	if evidence != nil {
		result["unverifiedSourceReferences"] = evidence
	}
	return result
}

func permissionGuards(guards []string) []string {
	result := []string{}
	for _, guard := range guards {
		if strings.Contains(guard, "RequirePermission") || strings.Contains(guard, "RequireAnyPermission") {
			result = append(result, guard)
		}
	}
	return result
}

func contractScope(status string) string {
	if status == "test-evidenced" {
		return "named handler test exists; request/response schemas and validation are not independently verified"
	}
	return "route/method/handler coverage only; request and response schemas are unverified"
}

func operationID(method, path string) string {
	var parts []string
	for _, raw := range strings.Split(strings.Trim(path, "/"), "/") {
		parameter := strings.HasPrefix(raw, "{") && strings.HasSuffix(raw, "}")
		raw = strings.Trim(raw, "{}")
		words := strings.FieldsFunc(raw, func(r rune) bool { return !unicode.IsLetter(r) && !unicode.IsDigit(r) })
		for _, word := range words {
			if parameter {
				parts = append(parts, "by")
				parameter = false
			}
			parts = append(parts, strings.ToUpper(word[:1])+word[1:])
		}
	}
	return strings.ToLower(method) + strings.Join(parts, "")
}

func readObject(path string) (map[string]any, error) {
	contents, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var value map[string]any
	if err := json.Unmarshal(contents, &value); err != nil {
		return nil, err
	}
	return value, nil
}

func marshal(value any) ([]byte, error) {
	var buffer bytes.Buffer
	enc := json.NewEncoder(&buffer)
	enc.SetIndent("", "  ")
	enc.SetEscapeHTML(false)
	if err := enc.Encode(value); err != nil {
		return nil, err
	}
	return buffer.Bytes(), nil
}

func findRoot() (string, error) {
	directory, err := os.Getwd()
	if err != nil {
		return "", err
	}
	for {
		if _, err := os.Stat(filepath.Join(directory, "docs", "openapi.json")); err == nil {
			return directory, nil
		}
		parent := filepath.Dir(directory)
		if parent == directory {
			return "", fmt.Errorf("repository root not found")
		}
		directory = parent
	}
}

func fatal(err error) {
	fmt.Fprintln(os.Stderr, "route-contract:", err)
	os.Exit(1)
}
