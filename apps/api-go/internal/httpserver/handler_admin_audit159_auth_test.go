package httpserver

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestAudit159MediaAndAdsReadsRequireDeclaredPermissions(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, "audit159-auth-"+actorID+"@example.test", "AUDIT-159 auth")
	token := createAdminSession(t, sessions, actorID)
	call := func(method, path, body string) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Origin", "http://localhost:3000")
		req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		res := httptest.NewRecorder()
		srv.Config.Handler.ServeHTTP(res, req)
		return res
	}
	for _, path := range []string{
		"/api/admin/media",
		"/api/admin/module-contracts",
		"/api/admin/monetization/ads/campaigns",
	} {
		if res := call(http.MethodGet, path, ""); res.Code != http.StatusForbidden {
			t.Errorf("%s requires its read permission: status=%d body=%s", path, res.Code, res.Body.String())
		}
	}
	grantAdminPermission(t, db, actorID, "admin.content.read")
	contracts := call(http.MethodGet, "/api/admin/module-contracts", "")
	if contracts.Code != http.StatusOK || strings.TrimSpace(contracts.Body.String()) != "[]" {
		t.Fatalf("module contracts read status=%d body=%s", contracts.Code, contracts.Body.String())
	}
	media := call(http.MethodPatch, "/api/admin/media/"+newUUID(t)+"/metadata", `{"license":"CC0","reason":"fixture edit"}`)
	if media.Code != http.StatusForbidden {
		t.Fatalf("media writes require admin.content.write: status=%d body=%s", media.Code, media.Body.String())
	}
}
