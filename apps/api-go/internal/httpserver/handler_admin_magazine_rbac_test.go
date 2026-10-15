package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestAdminMagazineLotoRoutesEnforceContentPermissions(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()

	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, actorID+"@magazine-rbac.example.com", "Magazine RBAC Admin")
	token := createAdminSession(t, sessions, actorID)
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM auth.admin_session WHERE actor_id=$1`, actorID)
	})

	reads := []struct{ path string }{
		{"/api/admin/magazine?locale=vi"},
		{"/api/admin/magazine/loto/predictions?game=loto6"},
		{"/api/admin/magazine/loto/predictions/analytics?game=loto6"},
		{"/api/admin/magazine/loto/summary"},
		{"/api/admin/magazine/loto/draws?game=loto6"},
	}
	writes := []struct {
		method, path, body string
	}{
		{http.MethodPost, "/api/admin/magazine/generate", `{}`},
		{http.MethodPost, "/api/admin/magazine/00000000-0000-4000-8000-000000000001/regenerate", `{}`},
		{http.MethodDelete, "/api/admin/magazine/00000000-0000-4000-8000-000000000001", `{}`},
		{http.MethodPut, "/api/admin/magazine/loto/predictions/00000000-0000-4000-8000-000000000001/approve", `{}`},
		{http.MethodPut, "/api/admin/magazine/loto/predictions/00000000-0000-4000-8000-000000000001/reject", `{}`},
		{http.MethodPost, "/api/admin/magazine/loto/predictions/results", `{}`},
		{http.MethodPost, "/api/admin/magazine/loto/import-csv", `{}`},
		{http.MethodPost, "/api/admin/magazine/loto/sync", `{}`},
		{http.MethodPost, "/api/admin/magazine/loto/autopilot", `{"game":"loto6"}`},
		{http.MethodPost, "/api/admin/magazine/loto/generate", `{}`},
		{http.MethodPost, "/api/admin/magazine/loto/publish", `{}`},
	}

	for _, tc := range reads {
		t.Run("anonymous GET "+tc.path, func(t *testing.T) {
			res := httptest.NewRecorder()
			srv.Config.Handler.ServeHTTP(res, httptest.NewRequest(http.MethodGet, tc.path, nil))
			if res.Code != http.StatusUnauthorized {
				t.Fatalf("anonymous GET status=%d body=%s; want 401", res.Code, res.Body.String())
			}
		})
		t.Run("roleless GET "+tc.path, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, tc.path, nil)
			req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
			res := httptest.NewRecorder()
			srv.Config.Handler.ServeHTTP(res, req)
			if res.Code != http.StatusForbidden {
				t.Fatalf("roleless GET status=%d body=%s; want 403", res.Code, res.Body.String())
			}
		})
	}
	for _, tc := range writes {
		t.Run("anonymous "+tc.method+" "+tc.path, func(t *testing.T) {
			res := httptest.NewRecorder()
			srv.Config.Handler.ServeHTTP(res, httptest.NewRequest(tc.method, tc.path, strings.NewReader(tc.body)))
			if res.Code != http.StatusUnauthorized {
				t.Fatalf("anonymous status=%d body=%s; want 401", res.Code, res.Body.String())
			}
		})
		t.Run("roleless "+tc.method+" "+tc.path, func(t *testing.T) {
			req := httptest.NewRequest(tc.method, tc.path, strings.NewReader(tc.body))
			req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
			req.Header.Set("Origin", "http://localhost:3000")
			res := httptest.NewRecorder()
			srv.Config.Handler.ServeHTTP(res, req)
			if res.Code != http.StatusForbidden {
				t.Fatalf("roleless status=%d body=%s; want 403", res.Code, res.Body.String())
			}
		})
	}

	grantAdminPermission(t, db, actorID, "admin.content.read")
	for _, tc := range reads {
		req := httptest.NewRequest(http.MethodGet, tc.path, nil)
		req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		res := httptest.NewRecorder()
		srv.Config.Handler.ServeHTTP(res, req)
		if res.Code == http.StatusForbidden {
			t.Fatalf("read-enabled GET %s unexpectedly forbidden: %s", tc.path, res.Body.String())
		}
	}
	for _, tc := range writes {
		req := httptest.NewRequest(tc.method, tc.path, strings.NewReader(tc.body))
		req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		req.Header.Set("Origin", "http://localhost:3000")
		res := httptest.NewRecorder()
		srv.Config.Handler.ServeHTTP(res, req)
		if res.Code != http.StatusForbidden {
			t.Fatalf("read-only %s %s status=%d body=%s; want 403", tc.method, tc.path, res.Code, res.Body.String())
		}
	}

	grantAdminPermission(t, db, actorID, "admin.content.write")
	for _, tc := range writes {
		req := httptest.NewRequest(tc.method, tc.path, strings.NewReader(tc.body))
		req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		res := httptest.NewRecorder()
		srv.Config.Handler.ServeHTTP(res, req)
		if res.Code != http.StatusForbidden {
			t.Fatalf("writer without trusted Origin %s %s status=%d body=%s; want 403", tc.method, tc.path, res.Code, res.Body.String())
		}
	}
}

func TestAdminMagazineLotoFiveApiContracts(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, actorID+"@magazine-api.example.com", "Magazine API Admin")
	token := createAdminSession(t, sessions, actorID)
	grantAdminPermission(t, db, actorID, "admin.content.read")
	grantAdminPermission(t, db, actorID, "admin.content.write")
	locale := "vi"
	fixtureID := ""
	contentDate := time.Now().UTC().AddDate(90, 0, 0).Format("2006-01-02")
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM daily.magazine_article WHERE id=$1`, fixtureID)
		_, _ = db.Exec(context.Background(), `DELETE FROM auth.admin_session WHERE actor_id=$1`, actorID)
	})
	do := func(method, path, body string, withOrigin bool) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		req.Header.Set("Content-Type", "application/json")
		if withOrigin {
			req.Header.Set("Origin", "http://localhost:3000")
		}
		res := httptest.NewRecorder()
		srv.Config.Handler.ServeHTTP(res, req)
		return res
	}

	list := do(http.MethodGet, "/api/admin/magazine?locale="+locale, "", false)
	if list.Code != http.StatusOK {
		t.Fatalf("GET magazine status=%d body=%s; want 200", list.Code, list.Body.String())
	}
	var listBody struct {
		Data  []map[string]any `json:"data"`
		Total int              `json:"total"`
		Page  int              `json:"page"`
		Limit int              `json:"limit"`
	}
	if err := json.Unmarshal(list.Body.Bytes(), &listBody); err != nil || listBody.Data == nil || listBody.Total != 0 || listBody.Page != 1 || listBody.Limit != 10 {
		t.Fatalf("GET magazine contract=%+v err=%v body=%s", listBody, err, list.Body.String())
	}

	generated := do(http.MethodPost, "/api/admin/magazine/generate", fmt.Sprintf(`{"widgetKind":"magazine_vocab","date":%q,"locale":%q}`, contentDate, locale), true)
	if generated.Code != http.StatusOK {
		t.Fatalf("POST magazine generate status=%d body=%s; want 200", generated.Code, generated.Body.String())
	}
	var generatedBody struct {
		ID        string `json:"id"`
		Generated bool   `json:"generated"`
	}
	if err := json.Unmarshal(generated.Body.Bytes(), &generatedBody); err != nil || !generatedBody.Generated || generatedBody.ID == "" {
		t.Fatalf("generate contract=%+v err=%v body=%s", generatedBody, err, generated.Body.String())
	}
	fixtureID = generatedBody.ID
	var persistedStatus string
	if err := db.QueryRow(context.Background(), `SELECT status FROM daily.magazine_article WHERE id=$1`, generatedBody.ID).Scan(&persistedStatus); err != nil || persistedStatus != "draft" {
		t.Fatalf("generated article persistence status=%q err=%v", persistedStatus, err)
	}
	var auditEvents int
	if err := db.QueryRow(context.Background(), `SELECT COUNT(*) FROM ops.admin_audit_log WHERE action='magazine.article.generated' AND target_id=$1`, generatedBody.ID).Scan(&auditEvents); err != nil || auditEvents != 1 {
		t.Fatalf("magazine generation audit events=%d err=%v; want exactly one", auditEvents, err)
	}
	listed := do(http.MethodGet, "/api/admin/magazine?locale="+locale, "", false)
	var listedBody struct {
		Data []map[string]any `json:"data"`
	}
	if listed.Code != http.StatusOK || json.Unmarshal(listed.Body.Bytes(), &listedBody) != nil || len(listedBody.Data) != 1 || listedBody.Data[0]["id"] != generatedBody.ID {
		t.Fatalf("generated article not present in list: status=%d body=%s", listed.Code, listed.Body.String())
	}
	duplicate := do(http.MethodPost, "/api/admin/magazine/generate", fmt.Sprintf(`{"widgetKind":"magazine_vocab","date":%q,"locale":%q}`, contentDate, locale), true)
	var duplicateBody struct {
		ID        *string `json:"id"`
		Generated bool    `json:"generated"`
	}
	if duplicate.Code != http.StatusOK || json.Unmarshal(duplicate.Body.Bytes(), &duplicateBody) != nil || duplicateBody.Generated || duplicateBody.ID != nil {
		t.Fatalf("duplicate generation contract status=%d body=%s", duplicate.Code, duplicate.Body.String())
	}

	autopilot := do(http.MethodPost, "/api/admin/magazine/loto/autopilot", `{"game":"loto6"}`, true)
	var autopilotBody struct {
		Status    string `json:"status"`
		Game      string `json:"game"`
		TodayDate string `json:"todayDate"`
	}
	if autopilot.Code != http.StatusOK || json.Unmarshal(autopilot.Body.Bytes(), &autopilotBody) != nil || autopilotBody.Status != "waiting_result" || autopilotBody.Game != "loto6" || autopilotBody.TodayDate == "" {
		t.Fatalf("POST autopilot contract status=%d body=%s", autopilot.Code, autopilot.Body.String())
	}
	invalidAutopilot := do(http.MethodPost, "/api/admin/magazine/loto/autopilot", `{"game":"invalid"}`, true)
	if invalidAutopilot.Code != http.StatusBadRequest {
		t.Fatalf("invalid autopilot game status=%d body=%s; want 400", invalidAutopilot.Code, invalidAutopilot.Body.String())
	}

	draws := do(http.MethodGet, "/api/admin/magazine/loto/draws?game=loto6&limit=1", "", false)
	var drawRows []map[string]any
	if draws.Code != http.StatusOK || json.Unmarshal(draws.Body.Bytes(), &drawRows) != nil || drawRows == nil || len(drawRows) > 1 {
		t.Fatalf("GET loto draws contract status=%d body=%s", draws.Code, draws.Body.String())
	}
	invalidDraws := do(http.MethodGet, "/api/admin/magazine/loto/draws?game=invalid", "", false)
	if invalidDraws.Code != http.StatusBadRequest {
		t.Fatalf("invalid loto game status=%d body=%s; want 400", invalidDraws.Code, invalidDraws.Body.String())
	}

	anonymousLogout := httptest.NewRecorder()
	srv.Config.Handler.ServeHTTP(anonymousLogout, httptest.NewRequest(http.MethodPost, "/api/admin/logout", strings.NewReader(`{}`)))
	if anonymousLogout.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous POST logout status=%d body=%s; want 401", anonymousLogout.Code, anonymousLogout.Body.String())
	}
	badOriginLogout := httptest.NewRequest(http.MethodPost, "/api/admin/logout", strings.NewReader(`{}`))
	badOriginLogout.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
	badOriginLogout.Header.Set("Origin", "https://untrusted.example")
	badOriginLogoutResult := httptest.NewRecorder()
	srv.Config.Handler.ServeHTTP(badOriginLogoutResult, badOriginLogout)
	if badOriginLogoutResult.Code != http.StatusForbidden {
		t.Fatalf("untrusted-origin POST logout status=%d body=%s; want 403", badOriginLogoutResult.Code, badOriginLogoutResult.Body.String())
	}
	logout := do(http.MethodPost, "/api/admin/logout", "", true)
	var logoutBody map[string]bool
	if logout.Code != http.StatusOK || json.Unmarshal(logout.Body.Bytes(), &logoutBody) != nil || !logoutBody["ok"] {
		t.Fatalf("POST admin logout status=%d body=%s", logout.Code, logout.Body.String())
	}
	afterLogout := do(http.MethodGet, "/api/admin/session", "", false)
	if afterLogout.Code != http.StatusUnauthorized {
		t.Fatalf("session after logout status=%d; want 401", afterLogout.Code)
	}
}

func TestAdminMagazineGenerateRejectsShortDate(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, actorID+"@magazine-date.example.com", "Magazine Date Admin")
	token := createAdminSession(t, sessions, actorID)
	grantAdminPermission(t, db, actorID, "admin.content.write")
	req := httptest.NewRequest(http.MethodPost, "/api/admin/magazine/generate", strings.NewReader(`{"widgetKind":"magazine_vocab","date":"bad"}`))
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
	req.Header.Set("Origin", "http://localhost:3000")
	res := httptest.NewRecorder()
	srv.Config.Handler.ServeHTTP(res, req)
	if res.Code != http.StatusBadRequest {
		t.Fatalf("invalid magazine date status=%d body=%s; want 400", res.Code, res.Body.String())
	}
	unsupportedLocale := httptest.NewRequest(http.MethodPost, "/api/admin/magazine/generate", strings.NewReader(`{"widgetKind":"magazine_vocab","date":"2099-01-01","locale":"unsupported-locale"}`))
	unsupportedLocale.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
	unsupportedLocale.Header.Set("Origin", "http://localhost:3000")
	unsupportedLocaleResult := httptest.NewRecorder()
	srv.Config.Handler.ServeHTTP(unsupportedLocaleResult, unsupportedLocale)
	if unsupportedLocaleResult.Code != http.StatusBadRequest {
		t.Fatalf("unsupported magazine locale status=%d body=%s; want 400", unsupportedLocaleResult.Code, unsupportedLocaleResult.Body.String())
	}
}

func TestAdminMagazineGenerateValidatesWidgetKindAndConcurrentDuplicate(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, actorID+"@magazine-idempotency.example.com", "Magazine Idempotency Admin")
	token := createAdminSession(t, sessions, actorID)
	grantAdminPermission(t, db, actorID, "admin.content.write")
	defer func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM auth.admin_session WHERE actor_id=$1`, actorID)
	}()
	do := func(date, widgetKind, locale string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodPost, "/api/admin/magazine/generate", strings.NewReader(fmt.Sprintf(`{"widgetKind":%q,"date":%q,"locale":%q}`, widgetKind, date, locale)))
		req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		req.Header.Set("Origin", "http://localhost:3000")
		res := httptest.NewRecorder()
		srv.Config.Handler.ServeHTTP(res, req)
		return res
	}
	localeDate := "2097-10-13"
	defer func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM daily.magazine_article WHERE widget_kind='magazine_vocab' AND content_date=$1 AND locale IN ('vi','en')`, localeDate)
	}()
	for _, locale := range []string{"vi", "en"} {
		res := do(localeDate, "magazine_vocab", locale)
		if res.Code != http.StatusOK {
			t.Fatalf("locale=%s status=%d body=%s; want 200", locale, res.Code, res.Body.String())
		}
		var body struct {
			ID        string `json:"id"`
			Generated bool   `json:"generated"`
		}
		if err := json.Unmarshal(res.Body.Bytes(), &body); err != nil || !body.Generated || body.ID == "" {
			t.Fatalf("locale=%s generation contract=%+v err=%v", locale, body, err)
		}
	}
	invalid := do("2098-10-13", "unrecognized_kind", "vi")
	if invalid.Code != http.StatusBadRequest {
		t.Fatalf("unknown widget kind status=%d body=%s; want 400", invalid.Code, invalid.Body.String())
	}

	date := time.Now().UTC().AddDate(92, 0, 0).Format("2006-01-02")
	defer func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM daily.magazine_article WHERE widget_kind='magazine_vocab' AND content_date=$1 AND locale='vi'`, date)
	}()
	const workers = 12
	start := make(chan struct{})
	results := make(chan *httptest.ResponseRecorder, workers)
	var wg sync.WaitGroup
	for range workers {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			results <- do(date, "magazine_vocab", "vi")
		}()
	}
	close(start)
	wg.Wait()
	close(results)
	generatedCount := 0
	for res := range results {
		if res.Code != http.StatusOK {
			t.Fatalf("concurrent duplicate status=%d body=%s; want 200", res.Code, res.Body.String())
		}
		var body struct {
			Generated bool `json:"generated"`
		}
		if err := json.Unmarshal(res.Body.Bytes(), &body); err != nil {
			t.Fatalf("decode concurrent duplicate result: %v", err)
		}
		if body.Generated {
			generatedCount++
		}
	}
	if generatedCount != 1 {
		t.Fatalf("concurrent calls generated %d articles; want exactly one", generatedCount)
	}
}
