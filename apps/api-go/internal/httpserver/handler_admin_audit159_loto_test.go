package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type audit159LotoFixture struct {
	db      *pgxpool.Pool
	server  *httptest.Server
	token   string
	actorID string
}

func newAudit159LotoFixture(t *testing.T) audit159LotoFixture {
	t.Helper()
	db := testPool(t)
	server, sessions := adminRBACTestServerWithPool(t, db)
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, "audit159-loto-"+actorID+"@example.test", "AUDIT-159 loto")
	grantAdminPermission(t, db, actorID, "admin.content.read")
	grantAdminPermission(t, db, actorID, "admin.content.write")
	f := audit159LotoFixture{db: db, server: server, token: createAdminSession(t, sessions, actorID), actorID: actorID}
	t.Cleanup(func() {
		server.Close()
		_, _ = db.Exec(context.Background(), `DELETE FROM ops.admin_audit_log WHERE actor_id=$1`, actorID)
	})
	return f
}

func (f audit159LotoFixture) call(t *testing.T, method, path, body string) *httptest.ResponseRecorder {
	return f.callAs(t, method, path, body, f.token, true)
}

func (f audit159LotoFixture) callAs(t *testing.T, method, path, body, token string, origin bool) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	if origin {
		req.Header.Set("Origin", "http://localhost:3000")
	}
	if token != "" {
		req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
	}
	res := httptest.NewRecorder()
	f.server.Config.Handler.ServeHTTP(res, req)
	return res
}

func TestAudit159MagazineLotoRoutesRequireAdminAndCSRF(t *testing.T) {
	f := newAudit159LotoFixture(t)
	routes := []struct{ method, path, body string }{
		{http.MethodPut, "/api/admin/magazine/loto/predictions/00000000-0000-4000-8000-000000000001/approve", ""},
		{http.MethodPut, "/api/admin/magazine/loto/predictions/00000000-0000-4000-8000-000000000001/reject", ""},
		{http.MethodPost, "/api/admin/magazine/loto/publish", `{"runId":"00000000-0000-4000-8000-000000000001","setIds":["00000000-0000-4000-8000-000000000002"]}`},
		{http.MethodGet, "/api/admin/magazine/loto/summary?game=loto6", ""},
		{http.MethodPost, "/api/admin/magazine/loto/sync", `{"game":"loto6"}`},
		{http.MethodDelete, "/api/admin/magazine/00000000-0000-4000-8000-000000000001", ""},
		{http.MethodPost, "/api/admin/magazine/00000000-0000-4000-8000-000000000001/regenerate", ""},
	}
	for _, route := range routes {
		t.Run(route.method+" "+route.path, func(t *testing.T) {
			unauthenticated := f.callAs(t, route.method, route.path, route.body, "", true)
			if unauthenticated.Code != http.StatusUnauthorized {
				t.Fatalf("anonymous status=%d body=%s; want 401", unauthenticated.Code, unauthenticated.Body.String())
			}
			if route.method == http.MethodGet {
				return
			}
			csrf := f.callAs(t, route.method, route.path, route.body, f.token, false)
			if csrf.Code != http.StatusForbidden {
				t.Fatalf("missing-origin status=%d body=%s; want 403", csrf.Code, csrf.Body.String())
			}
		})
	}
}

func TestAudit159LotoPublishPersistsSelectedSetInDailySchema(t *testing.T) {
	f := newAudit159LotoFixture(t)
	ctx := context.Background()
	runID, setID, secondSetID := newUUID(t), newUUID(t), newUUID(t)
	date := time.Now().UTC().AddDate(0, 2, 0).Format("2006-01-02")
	if _, err := f.db.Exec(ctx, `INSERT INTO daily.loto_generation_run (id,game,target_draw_date,status) VALUES ($1,'loto6',$2,'generated')`, runID, date); err != nil {
		t.Fatal(err)
	}
	if _, err := f.db.Exec(ctx, `INSERT INTO daily.loto_generated_set (id,run_id,rank,main_numbers,score) VALUES ($1,$2,1,ARRAY[1,2,3,4,5,6],0.75)`, setID, runID); err != nil {
		t.Fatal(err)
	}
	if _, err := f.db.Exec(ctx, `INSERT INTO daily.loto_generated_set (id,run_id,rank,main_numbers,score) VALUES ($1,$2,2,ARRAY[7,8,9,10,11,12],0.5)`, secondSetID, runID); err != nil {
		t.Fatal(err)
	}
	missingRun := f.call(t, http.MethodPost, "/api/admin/magazine/loto/publish", fmt.Sprintf(`{"runId":%q,"setIds":[%q]}`, newUUID(t), setID))
	if missingRun.Code != http.StatusNotFound {
		t.Fatalf("missing run publish status=%d body=%s", missingRun.Code, missingRun.Body.String())
	}
	emptySets := f.call(t, http.MethodPost, "/api/admin/magazine/loto/publish", fmt.Sprintf(`{"runId":%q,"setIds":[]}`, runID))
	if emptySets.Code != http.StatusBadRequest {
		t.Fatalf("empty sets publish status=%d body=%s", emptySets.Code, emptySets.Body.String())
	}
	t.Cleanup(func() {
		_, _ = f.db.Exec(ctx, `DELETE FROM daily.magazine_article WHERE widget_kind='magazine_loto6' AND content_date=$1 AND locale='vi'`, date)
		_, _ = f.db.Exec(ctx, `DELETE FROM daily.loto_generation_run WHERE id=$1`, runID)
	})

	invalid := f.call(t, http.MethodPost, "/api/admin/magazine/loto/publish", fmt.Sprintf(`{"runId":%q,"setIds":[%q]}`, runID, newUUID(t)))
	if invalid.Code != http.StatusBadRequest {
		t.Fatalf("foreign set publish status=%d body=%s want=400", invalid.Code, invalid.Body.String())
	}
	var unchangedStatus string
	if err := f.db.QueryRow(ctx, `SELECT status FROM daily.loto_generation_run WHERE id=$1`, runID).Scan(&unchangedStatus); err != nil || unchangedStatus != "generated" {
		t.Fatalf("invalid publish changed run state to %q err=%v", unchangedStatus, err)
	}
	res := f.call(t, http.MethodPost, "/api/admin/magazine/loto/publish", fmt.Sprintf(`{"runId":%q,"setIds":[%q]}`, runID, setID))
	if res.Code != http.StatusOK {
		t.Fatalf("publish status=%d body=%s", res.Code, res.Body.String())
	}
	var result struct {
		ArticleID    string `json:"articleId"`
		Status       string `json:"status"`
		SelectedSets int    `json:"selectedSets"`
	}
	if err := json.Unmarshal(res.Body.Bytes(), &result); err != nil || !isValidUUID(result.ArticleID) || result.Status != "published" || result.SelectedSets != 1 {
		t.Fatalf("publish response contract: result=%+v err=%v body=%s", result, err, res.Body.String())
	}
	var selected bool
	if err := f.db.QueryRow(ctx, `SELECT selected_for_magazine FROM daily.loto_generated_set WHERE id=$1`, setID).Scan(&selected); err != nil || !selected {
		t.Fatalf("selected set did not persist: selected=%v err=%v", selected, err)
	}
	assertAdminAuditEvent(t, f.db, f.actorID, "admin.magazine.loto.published", "daily.magazine_article", result.ArticleID)
	republished := f.call(t, http.MethodPost, "/api/admin/magazine/loto/publish", fmt.Sprintf(`{"runId":%q,"setIds":[%q]}`, runID, secondSetID))
	if republished.Code != http.StatusOK {
		t.Fatalf("republish status=%d body=%s", republished.Code, republished.Body.String())
	}
	var selectedCount int
	if err := f.db.QueryRow(ctx, `SELECT count(*) FROM daily.loto_generated_set WHERE run_id=$1 AND selected_for_magazine=true`, runID).Scan(&selectedCount); err != nil || selectedCount != 1 {
		t.Fatalf("republish selected count=%d err=%v", selectedCount, err)
	}
	if err := f.db.QueryRow(ctx, `SELECT selected_for_magazine FROM daily.loto_generated_set WHERE id=$1`, setID).Scan(&selected); err != nil || selected {
		t.Fatalf("old selection remained after republish: selected=%v err=%v", selected, err)
	}
	var publishAuditCount int
	if err := f.db.QueryRow(ctx, `SELECT count(*) FROM ops.admin_audit_log WHERE actor_id=$1 AND action='admin.magazine.loto.published' AND target_id=$2`, f.actorID, result.ArticleID).Scan(&publishAuditCount); err != nil || publishAuditCount != 2 {
		t.Fatalf("republish audit count=%d err=%v", publishAuditCount, err)
	}
	var runStatus string
	if err := f.db.QueryRow(ctx, `SELECT status FROM daily.loto_generation_run WHERE id=$1`, runID).Scan(&runStatus); err != nil || runStatus != "published" {
		t.Fatalf("run status did not persist: status=%q err=%v", runStatus, err)
	}
}

func TestAudit159MagazineDeleteMissingReturnsNotFound(t *testing.T) {
	f := newAudit159LotoFixture(t)
	invalid := f.call(t, http.MethodDelete, "/api/admin/magazine/not-a-uuid", `{"reason":"audit fixture cleanup"}`)
	if invalid.Code != http.StatusBadRequest {
		t.Fatalf("invalid article ID delete status=%d want=%d body=%s", invalid.Code, http.StatusBadRequest, invalid.Body.String())
	}
	res := f.call(t, http.MethodDelete, "/api/admin/magazine/"+newUUID(t), `{"reason":"audit fixture cleanup"}`)
	if res.Code != http.StatusNotFound {
		t.Fatalf("missing article delete status=%d want=%d body=%s", res.Code, http.StatusNotFound, res.Body.String())
	}
}

func TestAudit159PredictionApprovalAndRejectionPersistAndAudit(t *testing.T) {
	f := newAudit159LotoFixture(t)
	ctx := context.Background()
	id, nonLotoID := newUUID(t), newUUID(t)
	date := time.Now().UTC().AddDate(30, 0, 20).Format("2006-01-02")
	if _, err := f.db.Exec(ctx, `INSERT INTO daily.magazine_article
		(id,slug,widget_kind,content_date,locale,title_jp,title_vi,content_json,status,approval_status)
		VALUES ($1,$2,'magazine_loto6',$3,'vi','予想','Dự đoán','{"fixture":true}','draft','pending')`, id, "audit159-approve-"+id, date); err != nil {
		t.Fatal(err)
	}
	if _, err := f.db.Exec(ctx, `INSERT INTO daily.magazine_article
		(id,slug,widget_kind,content_date,locale,title_jp,title_vi,content_json,status,approval_status)
		VALUES ($1,$2,'magazine_vocab',$3,'vi','語彙','Từ vựng','{}','draft','pending')`, nonLotoID, "audit159-non-loto-"+nonLotoID, time.Now().UTC().AddDate(30, 0, 23).Format("2006-01-02")); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = f.db.Exec(ctx, `DELETE FROM daily.magazine_article WHERE id=ANY($1::uuid[])`, []string{id, nonLotoID})
	})
	for _, tc := range []struct{ suffix, action, approval, status string }{
		{"approve", "admin.magazine.loto.prediction.approved", "approved", "published"},
		{"reject", "admin.magazine.loto.prediction.rejected", "rejected", "draft"},
	} {
		res := f.call(t, http.MethodPut, "/api/admin/magazine/loto/predictions/"+id+"/"+tc.suffix, "")
		var body map[string]any
		if res.Code != http.StatusOK || json.Unmarshal(res.Body.Bytes(), &body) != nil || body["id"] != id || body["approvalStatus"] != tc.approval || body["status"] != tc.status {
			t.Fatalf("%s status=%d body=%s", tc.suffix, res.Code, res.Body.String())
		}
		var approval, status string
		if err := f.db.QueryRow(ctx, `SELECT approval_status,status FROM daily.magazine_article WHERE id=$1`, id).Scan(&approval, &status); err != nil || approval != tc.approval || status != tc.status {
			t.Fatalf("%s state approval=%q status=%q err=%v", tc.suffix, approval, status, err)
		}
		assertAdminAuditEvent(t, f.db, f.actorID, tc.action, "daily.magazine_article", id)
	}
	missing := f.call(t, http.MethodPut, "/api/admin/magazine/loto/predictions/"+newUUID(t)+"/approve", "")
	if missing.Code != http.StatusNotFound {
		t.Fatalf("missing prediction status=%d body=%s", missing.Code, missing.Body.String())
	}
	for _, suffix := range []string{"approve", "reject"} {
		invalid := f.call(t, http.MethodPut, "/api/admin/magazine/loto/predictions/"+nonLotoID+"/"+suffix, "")
		if invalid.Code != http.StatusBadRequest {
			t.Fatalf("non-loto %s status=%d body=%s", suffix, invalid.Code, invalid.Body.String())
		}
	}
}

func TestAudit159LotoSummaryAndSyncContracts(t *testing.T) {
	f := newAudit159LotoFixture(t)
	invalidSummary := f.call(t, http.MethodGet, "/api/admin/magazine/loto/summary?game=invalid", "")
	if invalidSummary.Code != http.StatusBadRequest {
		t.Fatalf("invalid summary status=%d body=%s", invalidSummary.Code, invalidSummary.Body.String())
	}
	summary := f.call(t, http.MethodGet, "/api/admin/magazine/loto/summary?game=loto6", "")
	var summaryBody map[string]any
	if summary.Code != http.StatusOK || json.Unmarshal(summary.Body.Bytes(), &summaryBody) != nil || summaryBody["game"] != "loto6" || summaryBody["totalDraws"] == nil || summaryBody["latestDrawDate"] == nil || summaryBody["totalRuns"] == nil || summaryBody["publishedRuns"] == nil {
		t.Fatalf("summary status=%d body=%s", summary.Code, summary.Body.String())
	}
	invalidSync := f.call(t, http.MethodPost, "/api/admin/magazine/loto/sync", `{"game":"invalid"}`)
	if invalidSync.Code != http.StatusBadRequest {
		t.Fatalf("invalid sync status=%d body=%s", invalidSync.Code, invalidSync.Body.String())
	}
	malformedSync := f.call(t, http.MethodPost, "/api/admin/magazine/loto/sync", `not-json`)
	if malformedSync.Code != http.StatusBadRequest {
		t.Fatalf("malformed sync status=%d body=%s", malformedSync.Code, malformedSync.Body.String())
	}
	sync := f.call(t, http.MethodPost, "/api/admin/magazine/loto/sync", `{"game":"loto6"}`)
	var syncBody map[string]any
	if sync.Code != http.StatusOK || json.Unmarshal(sync.Body.Bytes(), &syncBody) != nil || syncBody["game"] != "loto6" || syncBody["status"] != "sync_requested" {
		t.Fatalf("sync status=%d body=%s", sync.Code, sync.Body.String())
	}
	assertAdminAuditEvent(t, f.db, f.actorID, "admin.magazine.loto.sync.requested", "daily.loto_draw", "loto6")
}

func TestAudit159MagazineDeleteAndRegenerateKeepAuditAndContent(t *testing.T) {
	f := newAudit159LotoFixture(t)
	ctx := context.Background()
	date := time.Now().UTC().AddDate(30, 0, 21).Format("2006-01-02")
	deleteID, regenID := newUUID(t), newUUID(t)
	regenSlug := "audit159-regen-" + regenID
	for _, article := range []struct{ id, slug, kind, date string }{
		{deleteID, "audit159-delete-" + deleteID, "magazine_vocab", date},
		{regenID, regenSlug, "magazine_vocab", time.Now().UTC().AddDate(30, 0, 22).Format("2006-01-02")},
	} {
		if _, err := f.db.Exec(ctx, `INSERT INTO daily.magazine_article
			(id,slug,widget_kind,content_date,locale,title_jp,title_vi,content_json,status,approval_status)
			VALUES ($1,$2,$3,$4,'vi','Original title','Nội dung gốc','{"preserved":true}','published','approved')`, article.id, article.slug, article.kind, article.date); err != nil {
			t.Fatal(err)
		}
	}
	t.Cleanup(func() {
		_, _ = f.db.Exec(ctx, `DELETE FROM daily.magazine_article WHERE id=ANY($1::uuid[])`, []string{deleteID, regenID})
	})
	deleted := f.call(t, http.MethodDelete, "/api/admin/magazine/"+deleteID, "")
	var deletedBody map[string]any
	if deleted.Code != http.StatusOK || json.Unmarshal(deleted.Body.Bytes(), &deletedBody) != nil || deletedBody["deleted"] != true {
		t.Fatalf("delete status=%d body=%s", deleted.Code, deleted.Body.String())
	}
	var count int
	if err := f.db.QueryRow(ctx, `SELECT count(*) FROM daily.magazine_article WHERE id=$1`, deleteID).Scan(&count); err != nil || count != 0 {
		t.Fatalf("delete persistence count=%d err=%v", count, err)
	}
	assertAdminAuditEvent(t, f.db, f.actorID, "admin.magazine.article.deleted", "daily.magazine_article", deleteID)

	regenerated := f.call(t, http.MethodPost, "/api/admin/magazine/"+regenSlug+"/regenerate", "")
	var regenBody map[string]any
	if regenerated.Code != http.StatusOK || json.Unmarshal(regenerated.Body.Bytes(), &regenBody) != nil || regenBody["id"] != regenID || regenBody["regenerated"] != true {
		t.Fatalf("regenerate status=%d body=%s", regenerated.Code, regenerated.Body.String())
	}
	var title, status, approval, content string
	if err := f.db.QueryRow(ctx, `SELECT title_jp,status,approval_status,content_json::text FROM daily.magazine_article WHERE id=$1`, regenID).Scan(&title, &status, &approval, &content); err != nil || title != "Original title" || status != "draft" || approval != "pending" || !strings.Contains(content, "preserved") {
		t.Fatalf("regenerated record title=%q status=%q approval=%q content=%q err=%v", title, status, approval, content, err)
	}
	assertAdminAuditEvent(t, f.db, f.actorID, "admin.magazine.article.regenerated", "daily.magazine_article", regenID)
	missing := f.call(t, http.MethodPost, "/api/admin/magazine/missing-audit159/regenerate", "")
	if missing.Code != http.StatusNotFound {
		t.Fatalf("missing regenerate status=%d body=%s", missing.Code, missing.Body.String())
	}
}
