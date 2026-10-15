package httpserver

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func adminSharePreviewCall(t *testing.T, srv *httptest.Server, token, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/api/admin/growth/share-template/preview", strings.NewReader(body))
	if token != "" {
		req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		req.Header.Set("Origin", "http://localhost:3000")
		req.Header.Set("X-CSRF-Token", "test-csrf")
	}
	req.Header.Set("Content-Type", "application/json")
	res := httptest.NewRecorder()
	srv.Config.Handler.ServeHTTP(res, req)
	return res
}

func TestAdminGrowthSharePreviewRequiresReadPermissionAUDIT149(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	body := `{"headline":"Hello","sub":"World","kind":"streak"}`

	if res := adminSharePreviewCall(t, srv, "", body); res.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous preview status=%d body=%s; want 401", res.Code, res.Body.String())
	}

	roleless := newUUID(t)
	seedAdminActor(t, db, roleless, "audit149-roleless-"+roleless[:8]+"@example.com", "AUDIT-149 roleless")
	if res := adminSharePreviewCall(t, srv, createAdminSession(t, sessions, roleless), body); res.Code != http.StatusForbidden {
		t.Fatalf("roleless preview status=%d body=%s; want 403", res.Code, res.Body.String())
	}

	reader := newUUID(t)
	seedAdminActor(t, db, reader, "audit149-reader-"+reader[:8]+"@example.com", "AUDIT-149 reader")
	grantAdminPermission(t, db, reader, "admin.growth.read")
	if res := adminSharePreviewCall(t, srv, createAdminSession(t, sessions, reader), body); res.Code != http.StatusOK {
		t.Fatalf("admin.growth.read preview status=%d body=%s; want 200", res.Code, res.Body.String())
	}
}

func TestAdminGrowthSharePreviewRejectsInvalidInputAUDIT149(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, "audit149-invalid-"+actorID[:8]+"@example.com", "AUDIT-149 invalid")
	grantAdminPermission(t, db, actorID, "admin.growth.read")
	token := createAdminSession(t, sessions, actorID)

	var before int
	if err := db.QueryRow(context.Background(), `SELECT count(*) FROM growth.share_template`).Scan(&before); err != nil {
		t.Fatal(err)
	}
	for _, body := range []string{
		`{`,
		`{"headline":"","sub":"x","kind":"streak"}`,
		`{"headline":"x","sub":"","kind":"streak"}`,
		`{"headline":"` + strings.Repeat("h", 201) + `","sub":"x","kind":"streak"}`,
		`{"headline":"x","sub":"x","kind":"not_a_kind"}`,
		`{"headline":"x","sub":"x","kind":"streak","config":{"brandBg":"red\" onload=\"x"}}`,
		`{"headline":"x","sub":"x","kind":"streak","config":{"brandAccent":"#12345"}}`,
		`{"headline":"x","sub":"x","kind":"streak","config":{"pattern":"<x>"}}`,
		`{"headline":"x","sub":"x","kind":"streak","config":{"badgeKey":"` + strings.Repeat("b", 65) + `"}}`,
	} {
		if res := adminSharePreviewCall(t, srv, token, body); res.Code != http.StatusBadRequest {
			t.Fatalf("invalid preview body %q status=%d body=%s; want 400", body, res.Code, res.Body.String())
		}
	}
	var after int
	if err := db.QueryRow(context.Background(), `SELECT count(*) FROM growth.share_template`).Scan(&after); err != nil {
		t.Fatal(err)
	}
	if after != before {
		t.Fatalf("invalid previews changed share_template rows: before=%d after=%d", before, after)
	}
}

func TestAdminGrowthSharePreviewRendersEscapedSVGWithoutPersistenceAUDIT149(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, "audit149-render-"+actorID[:8]+"@example.com", "AUDIT-149 render")
	grantAdminPermission(t, db, actorID, "admin.growth.read")
	token := createAdminSession(t, sessions, actorID)

	var before int
	if err := db.QueryRow(context.Background(), `SELECT count(*) FROM growth.share_template`).Scan(&before); err != nil {
		t.Fatal(err)
	}
	body := `{"headline":"<script>alert(1)</script> 7日連続 & more","sub":"Keep \"going\"","kind":"streak","config":{"brandBg":"#0f172a","brandBgEnd":"#1e293b","brandFg":"#ffffff","brandAccent":"#38bdf8","badgeKey":"KotobaWorks","pattern":"dots"}}`
	res := adminSharePreviewCall(t, srv, token, body)
	if res.Code != http.StatusOK {
		t.Fatalf("valid preview status=%d body=%s; want 200", res.Code, res.Body.String())
	}
	var response struct {
		Base64SVG   string `json:"base64Svg"`
		ContentType string `json:"contentType"`
		Width       int    `json:"width"`
		Height      int    `json:"height"`
	}
	if err := json.Unmarshal(res.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode preview response: %v body=%s", err, res.Body.String())
	}
	if response.ContentType != "image/svg+xml" || response.Width != 1200 || response.Height != 630 {
		t.Fatalf("preview contract=%+v; want image/svg+xml 1200x630", response)
	}
	svgBytes, err := base64.StdEncoding.DecodeString(response.Base64SVG)
	if err != nil {
		t.Fatalf("base64Svg is not base64: %v", err)
	}
	svg := string(svgBytes)
	if !strings.HasPrefix(svg, "<svg") {
		t.Fatalf("rendered document does not start with <svg: %.80s", svg)
	}
	if strings.Contains(svg, "<script>") {
		t.Fatalf("user headline was rendered as raw script markup")
	}
	for _, want := range []string{"&lt;script&gt;alert(1)&lt;/script&gt;", "&amp; more", "KotobaWorks", "#38bdf8"} {
		if !strings.Contains(svg, want) {
			t.Fatalf("rendered SVG missing %q", want)
		}
	}
	var after int
	if err := db.QueryRow(context.Background(), `SELECT count(*) FROM growth.share_template`).Scan(&after); err != nil {
		t.Fatal(err)
	}
	if after != before {
		t.Fatalf("preview persisted a share_template row: before=%d after=%d", before, after)
	}
}

func TestAdminGrowthSharePreviewAcceptsEveryFormPatternAUDIT149(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, "audit149-pattern-"+actorID[:8]+"@example.com", "AUDIT-149 pattern")
	grantAdminPermission(t, db, actorID, "admin.growth.read")
	token := createAdminSession(t, sessions, actorID)

	// Every value the Admin Postcards pattern select offers must be accepted, or the preview fails for that choice.
	for _, pattern := range []string{"none", "dots", "waves", "grid", "stripes", "diamonds", "circles", "zigzag", "crosshatch", "sakura"} {
		body := fmt.Sprintf(`{"headline":"Hello","sub":"World","kind":"streak","config":{"pattern":%q}}`, pattern)
		if res := adminSharePreviewCall(t, srv, token, body); res.Code != http.StatusOK {
			t.Fatalf("preview pattern %s status=%d body=%s; want 200", pattern, res.Code, res.Body.String())
		}
	}
}

func TestAdminGrowthSharePreviewRendersWellFormedSVGAUDIT149(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, "audit149-xml-"+actorID[:8]+"@example.com", "AUDIT-149 xml")
	grantAdminPermission(t, db, actorID, "admin.growth.read")
	token := createAdminSession(t, sessions, actorID)

	// JSON escapes let a client send control characters that are illegal in XML; the document must still parse.
	body := `{"headline":"bad\u0001char\u0007 and ￿ end","sub":"tab\tand\u000bvt","kind":"streak"}`
	res := adminSharePreviewCall(t, srv, token, body)
	if res.Code != http.StatusOK {
		t.Fatalf("control-character preview status=%d body=%s; want 200", res.Code, res.Body.String())
	}
	var response struct {
		Base64SVG string `json:"base64Svg"`
	}
	if err := json.Unmarshal(res.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode preview response: %v", err)
	}
	svgBytes, err := base64.StdEncoding.DecodeString(response.Base64SVG)
	if err != nil {
		t.Fatalf("base64Svg is not base64: %v", err)
	}
	decoder := xml.NewDecoder(strings.NewReader(string(svgBytes)))
	for {
		if _, err := decoder.Token(); err != nil {
			if err == io.EOF {
				break
			}
			t.Fatalf("rendered SVG is not well-formed XML: %v", err)
		}
	}
}

func TestAdminGrowthSharePreviewRejectsMissingOriginAUDIT149(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, "audit149-origin-"+actorID[:8]+"@example.com", "AUDIT-149 origin")
	grantAdminPermission(t, db, actorID, "admin.growth.read")
	token := createAdminSession(t, sessions, actorID)

	// A reader's cookie alone must not authorize a state-changing-style POST: the trusted Origin is required.
	req := httptest.NewRequest(http.MethodPost, "/api/admin/growth/share-template/preview", strings.NewReader(`{"headline":"Hello","sub":"World","kind":"streak"}`))
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
	req.Header.Set("Content-Type", "application/json")
	res := httptest.NewRecorder()
	srv.Config.Handler.ServeHTTP(res, req)
	if res.Code != http.StatusForbidden || !strings.Contains(res.Body.String(), "missing origin") {
		t.Fatalf("preview without Origin status=%d body=%s; want 403 missing origin", res.Code, res.Body.String())
	}
	// Positive control: the same request with a trusted Origin is accepted, so the 403 is caused by the Origin check alone.
	body := `{"headline":"Hello","sub":"World","kind":"streak"}`
	if res := adminSharePreviewCall(t, srv, token, body); res.Code != http.StatusOK {
		t.Fatalf("trusted-origin preview status=%d body=%s; want 200", res.Code, res.Body.String())
	}
}
