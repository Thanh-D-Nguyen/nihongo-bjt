package httpserver

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestAdminLearningPathRoutesEnforceContentPermissions(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()

	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, actorID+"@learning-path-rbac.example.com", "Learning Path RBAC Admin")
	token := createAdminSession(t, sessions, actorID)
	detailPath := "/api/admin/learning/paths/00000000-0000-4000-8000-000000000001"
	cases := []struct {
		method string
		path   string
	}{
		{http.MethodGet, "/api/admin/learning/paths?page=1&pageSize=1"},
		{http.MethodGet, detailPath},
		{http.MethodPost, "/api/admin/learning/paths"},
		{http.MethodPatch, detailPath},
		{http.MethodPost, detailPath + "/publish"},
		{http.MethodPost, detailPath + "/archive"},
		{http.MethodPost, detailPath + "/duplicate"},
		{http.MethodDelete, detailPath},
	}

	for _, tc := range cases {
		t.Run(tc.method+" "+tc.path, func(t *testing.T) {
			anonymous := httptest.NewRecorder()
			srv.Config.Handler.ServeHTTP(anonymous, httptest.NewRequest(tc.method, tc.path, nil))
			if anonymous.Code != http.StatusUnauthorized {
				t.Fatalf("anonymous %s status=%d body=%s; want 401", tc.method, anonymous.Code, anonymous.Body.String())
			}

			req := httptest.NewRequest(tc.method, tc.path, strings.NewReader(`{"reason":"rbac test"}`))
			req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
			if tc.method != http.MethodGet {
				req.Header.Set("Origin", "http://localhost:3000")
			}
			roleless := httptest.NewRecorder()
			srv.Config.Handler.ServeHTTP(roleless, req)
			if roleless.Code != http.StatusForbidden {
				t.Fatalf("roleless %s status=%d body=%s; want 403", tc.method, roleless.Code, roleless.Body.String())
			}
		})
	}

	grantAdminPermission(t, db, actorID, "admin.content.read")
	for _, tc := range cases[:2] {
		req := httptest.NewRequest(tc.method, tc.path, nil)
		req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		res := httptest.NewRecorder()
		srv.Config.Handler.ServeHTTP(res, req)
		want := http.StatusOK
		if tc.method == http.MethodGet && strings.Contains(tc.path, "/00000000-") {
			want = http.StatusNotFound
		}
		if res.Code != want {
			t.Fatalf("read-enabled %s status=%d body=%s; want %d", tc.method, res.Code, res.Body.String(), want)
		}
	}
	for _, tc := range cases[2:] {
		req := httptest.NewRequest(tc.method, tc.path, strings.NewReader(`{"reason":"read-only must not write"}`))
		req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		req.Header.Set("Origin", "http://localhost:3000")
		res := httptest.NewRecorder()
		srv.Config.Handler.ServeHTTP(res, req)
		if res.Code != http.StatusForbidden {
			t.Fatalf("read-only %s status=%d body=%s; want 403", tc.method, res.Code, res.Body.String())
		}
	}

	grantAdminPermission(t, db, actorID, "admin.content.write")
	for _, tc := range cases[2:] {
		for _, origin := range []string{"", "https://untrusted.example"} {
			req := httptest.NewRequest(tc.method, tc.path, strings.NewReader(`{"reason":"csrf test"}`))
			req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
			if origin != "" {
				req.Header.Set("Origin", origin)
			}
			res := httptest.NewRecorder()
			srv.Config.Handler.ServeHTTP(res, req)
			if res.Code != http.StatusForbidden {
				t.Fatalf("authorized writer without trusted Origin %s %s status=%d body=%s; want 403", tc.method, tc.path, res.Code, res.Body.String())
			}
		}
	}
}

func TestAdminLearningPathAuthorizedWritesAndWorkflow(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, actorID+"@learning-path-write.example.com", "Learning Path Writer")
	token := createAdminSession(t, sessions, actorID)
	grantAdminPermission(t, db, actorID, "admin.content.read")
	grantAdminPermission(t, db, actorID, "admin.content.write")
	ids := []string{}
	t.Cleanup(func() {
		for _, id := range ids {
			_, _ = db.Exec(context.Background(), `DELETE FROM ops.admin_audit_log WHERE target_type='learning.learning_path' AND target_id=$1`, id)
			_, _ = db.Exec(context.Background(), `DELETE FROM learning.learning_path WHERE id=$1`, id)
		}
	})
	do := func(method, path, body string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		req.Header.Set("Origin", "http://localhost:3000")
		req.Header.Set("Content-Type", "application/json")
		res := httptest.NewRecorder()
		srv.Config.Handler.ServeHTTP(res, req)
		return res
	}
	decodeID := func(res *httptest.ResponseRecorder) string {
		t.Helper()
		var body struct {
			ID string `json:"id"`
		}
		if err := json.Unmarshal(res.Body.Bytes(), &body); err != nil || body.ID == "" {
			t.Fatalf("decode response id: id=%q err=%v body=%s", body.ID, err, res.Body.String())
		}
		return body.ID
	}
	assertStatus := func(res *httptest.ResponseRecorder, want int, operation string) {
		t.Helper()
		if res.Code != want {
			t.Fatalf("%s status=%d body=%s; want %d", operation, res.Code, res.Body.String(), want)
		}
	}

	missingID := newUUID(t)
	assertStatus(do(http.MethodPatch, "/api/admin/learning/paths/"+missingID, `{"titleVi":"missing","reason":"missing row"}`), http.StatusNotFound, "patch missing path")
	assertStatus(do(http.MethodPost, "/api/admin/learning/paths/"+missingID+"/archive", `{"reason":"missing row"}`), http.StatusNotFound, "archive missing path")
	var missingAuditCount int
	if err := db.QueryRow(context.Background(), `SELECT COUNT(*) FROM ops.admin_audit_log WHERE target_id=$1`, missingID).Scan(&missingAuditCount); err != nil {
		t.Fatal(err)
	}
	if missingAuditCount != 0 {
		t.Fatalf("missing path emitted %d audit entries", missingAuditCount)
	}

	slug := "audit-path-rbac-" + newUUID(t)
	created := do(http.MethodPost, "/api/admin/learning/paths", `{"slug":"`+slug+`","titleVi":"RBAC disposable","reason":"integration create"}`)
	assertStatus(created, http.StatusCreated, "create")
	id := decodeID(created)
	ids = append(ids, id)
	detailPath := "/api/admin/learning/paths/" + id
	detail := do(http.MethodGet, detailPath, "")
	assertStatus(detail, http.StatusOK, "detail after create")
	var detailBody struct {
		TitleVi string            `json:"titleVi"`
		Status  string            `json:"status"`
		Audit   []json.RawMessage `json:"audit"`
	}
	if err := json.Unmarshal(detail.Body.Bytes(), &detailBody); err != nil || detailBody.TitleVi != "RBAC disposable" || detailBody.Status != "draft" || len(detailBody.Audit) != 1 {
		t.Fatalf("created path detail=%+v err=%v body=%s", detailBody, err, detail.Body.String())
	}
	updated := do(http.MethodPatch, detailPath, `{"titleVi":"RBAC disposable edited","reason":"integration update"}`)
	assertStatus(updated, http.StatusOK, "update")
	verify := do(http.MethodGet, detailPath, "")
	assertStatus(verify, http.StatusOK, "detail after update")
	if err := json.Unmarshal(verify.Body.Bytes(), &detailBody); err != nil || detailBody.TitleVi != "RBAC disposable edited" || len(detailBody.Audit) != 2 {
		t.Fatalf("updated path detail=%+v err=%v body=%s", detailBody, err, verify.Body.String())
	}
	duplicate := do(http.MethodPost, detailPath+"/duplicate", `{"reason":"integration duplicate"}`)
	assertStatus(duplicate, http.StatusCreated, "duplicate")
	duplicateID := decodeID(duplicate)
	ids = append(ids, duplicateID)
	deleted := do(http.MethodDelete, "/api/admin/learning/paths/"+duplicateID, `{"reason":"integration cleanup"}`)
	assertStatus(deleted, http.StatusOK, "delete draft duplicate")
	missing := do(http.MethodGet, "/api/admin/learning/paths/"+duplicateID, "")
	assertStatus(missing, http.StatusNotFound, "detail after delete")
	published := do(http.MethodPost, detailPath+"/publish", `{"reason":"integration publish"}`)
	assertStatus(published, http.StatusOK, "publish")
	archived := do(http.MethodPost, detailPath+"/archive", `{"reason":"integration archive"}`)
	assertStatus(archived, http.StatusOK, "archive")
	verify = do(http.MethodGet, detailPath, "")
	assertStatus(verify, http.StatusOK, "detail after archive")
	if err := json.Unmarshal(verify.Body.Bytes(), &detailBody); err != nil || detailBody.Status != "archived" || len(detailBody.Audit) != 4 {
		t.Fatalf("archived path detail=%+v err=%v body=%s", detailBody, err, verify.Body.String())
	}
}
