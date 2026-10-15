package httpserver

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestAdminCompetencyRoutesEnforceContentPermissions(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()

	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, actorID+"@competency-rbac.example.com", "Competency RBAC Admin")
	token := createAdminSession(t, sessions, actorID)
	detailPath := "/api/admin/learning/competencies/00000000-0000-4000-8000-000000000001"
	cases := []struct {
		method string
		path   string
	}{
		{http.MethodGet, "/api/admin/learning/competencies?page=1&pageSize=1"},
		{http.MethodGet, detailPath},
		{http.MethodPost, "/api/admin/learning/competencies"},
		{http.MethodPatch, detailPath},
		{http.MethodPost, detailPath + "/publish"},
		{http.MethodPost, detailPath + "/archive"},
		{http.MethodDelete, detailPath},
	}

	anonymous := httptest.NewRecorder()
	srv.Config.Handler.ServeHTTP(anonymous, httptest.NewRequest(http.MethodGet, cases[0].path, nil))
	if anonymous.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous GET list status=%d body=%s; want 401", anonymous.Code, anonymous.Body.String())
	}

	for _, tc := range cases {
		t.Run(tc.method+" "+tc.path, func(t *testing.T) {
			req := httptest.NewRequest(tc.method, tc.path, strings.NewReader(`{"reason":"rbac test"}`))
			req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
			if tc.method != http.MethodGet {
				req.Header.Set("Origin", "http://localhost:3000")
			}
			res := httptest.NewRecorder()
			srv.Config.Handler.ServeHTTP(res, req)
			if res.Code != http.StatusForbidden {
				t.Fatalf("roleless %s status=%d body=%s; want 403", tc.method, res.Code, res.Body.String())
			}
		})
	}

	grantAdminPermission(t, db, actorID, "admin.content.read")
	list := httptest.NewRecorder()
	listReq := httptest.NewRequest(http.MethodGet, cases[0].path, nil)
	listReq.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
	srv.Config.Handler.ServeHTTP(list, listReq)
	if list.Code != http.StatusOK {
		t.Fatalf("authorized GET list status=%d body=%s; want 200", list.Code, list.Body.String())
	}
	detail := httptest.NewRecorder()
	detailReq := httptest.NewRequest(http.MethodGet, detailPath, nil)
	detailReq.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
	srv.Config.Handler.ServeHTTP(detail, detailReq)
	if detail.Code != http.StatusNotFound {
		t.Fatalf("authorized missing GET detail status=%d body=%s; want 404 after permission passes", detail.Code, detail.Body.String())
	}
}
