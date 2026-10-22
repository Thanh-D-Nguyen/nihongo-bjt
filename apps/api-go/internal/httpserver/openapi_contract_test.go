package httpserver

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// TestIOSOpenAPIContract rejects the retired NestJS snapshot before mobile
// clients can consume it as the Go API contract.
func TestIOSOpenAPIContract(t *testing.T) {
	path := filepath.Join("..", "..", "..", "..", "docs", "openapi.json")
	contents, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read canonical OpenAPI document: %v", err)
	}

	var document struct {
		OpenAPI string `json:"openapi"`
		Servers []struct {
			URL string `json:"url"`
		} `json:"servers"`
		Paths      map[string]map[string]json.RawMessage `json:"paths"`
		Components struct {
			SecuritySchemes map[string]json.RawMessage `json:"securitySchemes"`
			Schemas         map[string]json.RawMessage `json:"schemas"`
			Parameters      map[string]json.RawMessage `json:"parameters"`
		} `json:"components"`
	}
	if err := json.Unmarshal(contents, &document); err != nil {
		t.Fatalf("decode canonical OpenAPI document: %v", err)
	}
	var values map[string]any
	if err := json.Unmarshal(contents, &values); err != nil {
		t.Fatalf("decode OpenAPI values: %v", err)
	}
	if err := validateLocalReferences(values, values); err != nil {
		t.Fatalf("invalid local OpenAPI reference: %v", err)
	}
	if document.OpenAPI != "3.0.0" {
		t.Fatalf("OpenAPI version = %q, want 3.0.0", document.OpenAPI)
	}
	if len(document.Servers) != 1 || document.Servers[0].URL != "http://localhost:4001" {
		t.Fatalf("servers = %#v, want Go API at http://localhost:4001", document.Servers)
	}
	assertLearnerSecuritySchemes(t, document.Components.SecuritySchemes)
	assertCSRFHeaderAlternatives(t, document.Components.Parameters)

	for path, method := range map[string]string{
		"/api/auth/login":                           "post",
		"/api/auth/me":                              "get",
		"/api/auth/logout":                          "post",
		"/api/content/lexemes":                      "get",
		"/api/content/lexemes/{id}":                 "get",
		"/api/search":                               "get",
		"/api/levels":                               "get",
		"/api/levels/{code}":                        "get",
		"/api/levels/{code}/lessons":                "get",
		"/api/flashcards/decks":                     "get",
		"/api/flashcards/decks/{deckId}":            "get",
		"/api/flashcards/reviews/due":               "get",
		"/api/flashcards/reviews/{userFlashcardId}": "post",
	} {
		operations, ok := document.Paths[path]
		if !ok || operations[method] == nil {
			t.Fatalf("missing %s %s from verified Go contract", method, path)
		}
	}
	for _, legacyPath := range []string{"/api/dictionary/search", "/api/dictionary/words/{id}", "/api/decks/{id}"} {
		if _, ok := document.Paths[legacyPath]; ok {
			t.Fatalf("legacy NestJS path %s must not be published as a Go contract", legacyPath)
		}
	}

	assertLearnerFullProfileSchema(t, document.Components.Schemas["LearnerFullProfile"])
	assertMeOperation(t, document.Paths["/api/auth/me"]["get"])
	assertUnsafeOperationCSRF(t, document.Paths["/api/auth/login"]["post"])
	assertUnsafeOperationCSRF(t, document.Paths["/api/auth/logout"]["post"])

	for operation, want := range map[string]string{
		"login response":  `"LoginResponse"`,
		"me response":     `"LearnerFullProfile"`,
		"logout response": `"OkResponse"`,
		"opaque security": `"bearerFormat": "opaque"`,
		"CSRF origin":     `"name": "Origin"`,
	} {
		if !containsJSON(contents, want) {
			t.Fatalf("%s is not represented in the canonical contract", operation)
		}
	}
}

func assertLearnerSecuritySchemes(t *testing.T, schemes map[string]json.RawMessage) {
	t.Helper()
	var bearer struct {
		Type         string `json:"type"`
		Scheme       string `json:"scheme"`
		BearerFormat string `json:"bearerFormat"`
	}
	if err := json.Unmarshal(schemes["learnerSession"], &bearer); err != nil {
		t.Fatalf("decode learnerSession security scheme: %v", err)
	}
	if bearer.Type != "http" || bearer.Scheme != "bearer" || bearer.BearerFormat != "opaque" {
		t.Errorf("learnerSession = %+v, want opaque bearer session", bearer)
	}

	var cookie struct {
		Type string `json:"type"`
		In   string `json:"in"`
		Name string `json:"name"`
	}
	if err := json.Unmarshal(schemes["learnerCookie"], &cookie); err != nil {
		t.Fatalf("decode learnerCookie security scheme: %v", err)
	}
	if cookie.Type != "apiKey" || cookie.In != "cookie" || cookie.Name != "bjt_web_session" {
		t.Errorf("learnerCookie = %+v, want bjt_web_session cookie", cookie)
	}
}

func assertCSRFHeaderAlternatives(t *testing.T, parameters map[string]json.RawMessage) {
	t.Helper()
	for _, want := range []string{"Origin", "Referer"} {
		var parameter struct {
			Name     string `json:"name"`
			In       string `json:"in"`
			Required bool   `json:"required"`
		}
		if err := json.Unmarshal(parameters[want], &parameter); err != nil {
			t.Fatalf("decode %s CSRF parameter: %v", want, err)
		}
		if parameter.Name != want || parameter.In != "header" || parameter.Required {
			t.Errorf("%s parameter = %+v, want optional header", want, parameter)
		}
	}
}

func assertLearnerFullProfileSchema(t *testing.T, raw json.RawMessage) {
	t.Helper()
	var schema struct {
		Required   []string                   `json:"required"`
		Properties map[string]json.RawMessage `json:"properties"`
	}
	if err := json.Unmarshal(raw, &schema); err != nil {
		t.Fatalf("decode LearnerFullProfile schema: %v", err)
	}
	for _, field := range []string{
		"id", "email", "displayName", "status", "themeMode", "fontSizePreference",
		"densityPreference", "flashcardStyleSlug", "coverAssetId", "adsPersonalizationOptIn",
		"sharePostcardOptIn", "createdAt", "updatedAt",
	} {
		if !contains(schema.Required, field) {
			t.Errorf("LearnerFullProfile must require %q", field)
		}
		if _, ok := schema.Properties[field]; !ok {
			t.Errorf("LearnerFullProfile must expose %q", field)
		}
	}
	if _, wrapped := schema.Properties["profile"]; wrapped {
		t.Error("LearnerFullProfile must be the flat /api/auth/me response, not a profile envelope")
	}
}

func assertMeOperation(t *testing.T, raw json.RawMessage) {
	t.Helper()
	var operation struct {
		Security  []map[string][]string `json:"security"`
		Responses map[string]struct {
			Content map[string]struct {
				Schema struct {
					Ref string `json:"$ref"`
				} `json:"schema"`
			} `json:"content"`
		} `json:"responses"`
	}
	if err := json.Unmarshal(raw, &operation); err != nil {
		t.Fatalf("decode GET /api/auth/me operation: %v", err)
	}
	if got := operation.Responses["200"].Content["application/json"].Schema.Ref; got != "#/components/schemas/LearnerFullProfile" {
		t.Errorf("GET /api/auth/me 200 schema = %q, want LearnerFullProfile", got)
	}
	for _, scheme := range []string{"learnerSession", "learnerCookie"} {
		if !hasSecurityScheme(operation.Security, scheme) {
			t.Errorf("GET /api/auth/me must document %s authentication", scheme)
		}
	}
}

func assertUnsafeOperationCSRF(t *testing.T, raw json.RawMessage) {
	t.Helper()
	var operation struct {
		Parameters []struct {
			Ref string `json:"$ref"`
		} `json:"parameters"`
	}
	if err := json.Unmarshal(raw, &operation); err != nil {
		t.Fatalf("decode unsafe operation: %v", err)
	}
	for _, want := range []string{"#/components/parameters/Origin", "#/components/parameters/Referer"} {
		found := false
		for _, parameter := range operation.Parameters {
			if parameter.Ref == want {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("unsafe operation missing %s", want)
		}
	}
}

func hasSecurityScheme(requirements []map[string][]string, want string) bool {
	for _, requirement := range requirements {
		if _, ok := requirement[want]; ok {
			return true
		}
	}
	return false
}

func contains(values []string, want string) bool {
	for _, value := range values {
		if value == want {
			return true
		}
	}
	return false
}

func containsJSON(contents []byte, want string) bool {
	return strings.Contains(string(contents), want)
}

func validateLocalReferences(node any, root map[string]any) error {
	switch value := node.(type) {
	case map[string]any:
		if ref, ok := value["$ref"].(string); ok && strings.HasPrefix(ref, "#/") {
			if _, err := resolveReference(root, ref); err != nil {
				return err
			}
		}
		for _, child := range value {
			if err := validateLocalReferences(child, root); err != nil {
				return err
			}
		}
	case []any:
		for _, child := range value {
			if err := validateLocalReferences(child, root); err != nil {
				return err
			}
		}
	}
	return nil
}

func resolveReference(root map[string]any, ref string) (any, error) {
	var current any = root
	for _, segment := range strings.Split(strings.TrimPrefix(ref, "#/"), "/") {
		object, ok := current.(map[string]any)
		if !ok {
			return nil, fmt.Errorf("%s has a non-object parent", ref)
		}
		current, ok = object[strings.ReplaceAll(strings.ReplaceAll(segment, "~1", "/"), "~0", "~")]
		if !ok {
			return nil, fmt.Errorf("%s does not resolve", ref)
		}
	}
	return current, nil
}
