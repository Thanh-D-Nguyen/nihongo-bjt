package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

func TestQuestionBankRoutesAreNotMountedWithoutRBACStore(t *testing.T) {
	db := testPool(t)
	sessions := session.NewStore(db)
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, actorID+"@no-rbac.example.com", "No RBAC Admin")
	token := createAdminSession(t, sessions, actorID)
	router := NewRouter(Dependencies{
		Config:       &config.Config{CORSOrigins: []string{"http://localhost:3000"}},
		Logger:       slog.Default(),
		DBPool:       db,
		SessionStore: sessions,
	})

	req := httptest.NewRequest(http.MethodPost, "/api/admin/assessment/question-bank", strings.NewReader(`{}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("X-CSRF-Token", "test-csrf")
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)
	if res.Code != http.StatusNotFound {
		t.Fatalf("without RBAC store, question-bank POST status=%d body=%s, want route absent (404)", res.Code, res.Body.String())
	}
}

func TestAdminQuestionCreatePersistsQuestionOptionsAndAudit(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServer(t)
	defer srv.Close()
	ctx := context.Background()
	testID := newUUID(t)
	if _, err := db.Exec(ctx, `INSERT INTO assessment.bjt_mock_test (id,slug,title_vi,type,status,updated_at) VALUES ($1,$2,'Question create fixture','mock','draft',now())`, testID, "audit-question-create-"+testID); err != nil {
		t.Fatalf("create disposable exam fixture: %v", err)
	}
	t.Cleanup(func() { _, _ = db.Exec(ctx, `DELETE FROM assessment.bjt_mock_test WHERE id=$1`, testID) })
	var sectionID string
	if err := db.QueryRow(ctx, `INSERT INTO assessment.bjt_test_section (test_id,code,title_vi,display_order) VALUES ($1,$2,'Question create fixture',1) RETURNING id::text`, testID, "AUDIT020_"+testID[:8]).Scan(&sectionID); err != nil {
		t.Fatalf("create disposable section fixture: %v", err)
	}
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, actorID+"@question-create.example.com", "Question Create Admin")
	grantAdminPermission(t, db, actorID, "assessment.manage")
	token := createAdminSession(t, sessions, actorID)
	prompt := "AUDIT020 successful create " + newUUID(t)
	body := fmt.Sprintf(`{"sectionId":%q,"prompt":%q,"explanationVi":"fixture","skillTag":"AUDIT020","difficulty":"standard","tags":["fixture"],"options":[{"optionKey":"A","text":"answer","isCorrect":true}],"reason":"atomic create success"}`, sectionID, prompt)
	req := httptest.NewRequest(http.MethodPost, "/api/admin/assessment/question-bank", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("X-CSRF-Token", "test-csrf")
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
	res := httptest.NewRecorder()
	srv.Config.Handler.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("create status=%d body=%s, want 200", res.Code, res.Body.String())
	}
	var result struct {
		ID      string   `json:"id"`
		Tags    []string `json:"tags"`
		Options []struct {
			Text      string `json:"text"`
			IsCorrect bool   `json:"isCorrect"`
		} `json:"options"`
		Audit []struct {
			Reason string `json:"reason"`
		} `json:"audit"`
	}
	if err := json.Unmarshal(res.Body.Bytes(), &result); err != nil {
		t.Fatalf("decode created question: %v", err)
	}
	t.Cleanup(func() {
		if result.ID != "" {
			_, _ = db.Exec(ctx, `DELETE FROM ops.admin_audit_log WHERE target_id=$1`, result.ID)
			_, _ = db.Exec(ctx, `DELETE FROM assessment.bjt_question WHERE id=$1`, result.ID)
		}
	})
	if result.ID == "" || len(result.Tags) != 1 || result.Tags[0] != "fixture" || len(result.Options) != 1 || result.Options[0].Text != "answer" || !result.Options[0].IsCorrect || len(result.Audit) != 1 || result.Audit[0].Reason != "atomic create success" {
		t.Fatalf("create response missing persisted children/audit: %+v", result)
	}

	listReq := httptest.NewRequest(http.MethodGet, "/api/admin/assessment/question-bank?q="+url.QueryEscape(prompt), nil)
	listReq.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
	listRes := httptest.NewRecorder()
	srv.Config.Handler.ServeHTTP(listRes, listReq)
	if listRes.Code != http.StatusOK || !strings.Contains(listRes.Body.String(), `"prompt":"`+prompt+`"`) || !strings.Contains(listRes.Body.String(), `"tags":["fixture"]`) {
		t.Fatalf("list did not return created question/tags: status=%d body=%s", listRes.Code, listRes.Body.String())
	}

	patchReq := httptest.NewRequest(http.MethodPatch, "/api/admin/assessment/question-bank/"+result.ID, strings.NewReader(`{"tags":["patched"],"reason":"patch tags"}`))
	patchReq.Header.Set("Content-Type", "application/json")
	patchReq.Header.Set("Origin", "http://localhost:3000")
	patchReq.Header.Set("X-CSRF-Token", "test-csrf")
	patchReq.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
	patchRes := httptest.NewRecorder()
	srv.Config.Handler.ServeHTTP(patchRes, patchReq)
	if patchRes.Code != http.StatusOK || !strings.Contains(patchRes.Body.String(), `"tags":["patched"]`) {
		t.Fatalf("patch tags status=%d body=%s", patchRes.Code, patchRes.Body.String())
	}

	bulkReq := httptest.NewRequest(http.MethodPost, "/api/admin/assessment/question-bank/bulk", strings.NewReader(fmt.Sprintf(`{"ids":[%q],"action":"tag","tags":["bulk"],"reason":"bulk tag"}`, result.ID)))
	bulkReq.Header.Set("Content-Type", "application/json")
	bulkReq.Header.Set("Origin", "http://localhost:3000")
	bulkReq.Header.Set("X-CSRF-Token", "test-csrf")
	bulkReq.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
	bulkRes := httptest.NewRecorder()
	srv.Config.Handler.ServeHTTP(bulkRes, bulkReq)
	if bulkRes.Code != http.StatusOK || !strings.Contains(bulkRes.Body.String(), `"processed":1`) {
		t.Fatalf("bulk tag status=%d body=%s", bulkRes.Code, bulkRes.Body.String())
	}

	untagReq := httptest.NewRequest(http.MethodPost, "/api/admin/assessment/question-bank/bulk", strings.NewReader(fmt.Sprintf(`{"ids":[%q],"action":"untag","tags":["patched"],"reason":"bulk untag"}`, result.ID)))
	untagReq.Header.Set("Content-Type", "application/json")
	untagReq.Header.Set("Origin", "http://localhost:3000")
	untagReq.Header.Set("X-CSRF-Token", "test-csrf")
	untagReq.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
	untagRes := httptest.NewRecorder()
	srv.Config.Handler.ServeHTTP(untagRes, untagReq)
	if untagRes.Code != http.StatusOK || !strings.Contains(untagRes.Body.String(), `"processed":1`) {
		t.Fatalf("bulk untag status=%d body=%s", untagRes.Code, untagRes.Body.String())
	}
	var storedTags []string
	if err := db.QueryRow(ctx, `SELECT tags FROM assessment.bjt_question WHERE id=$1`, result.ID).Scan(&storedTags); err != nil {
		t.Fatal(err)
	}
	if len(storedTags) != 1 || storedTags[0] != "bulk" {
		t.Fatalf("stored tags after tag/untag = %v, want [bulk]", storedTags)
	}
}

func TestAdminQuestionBankMutationRoutesEnforcePermissions(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServer(t)
	defer srv.Close()
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, actorID+"@question-rbac.example.com", "Question RBAC Admin")
	token := createAdminSession(t, sessions, actorID)
	questionID := newUUID(t)
	for _, tc := range []struct{ method, path, body string }{
		{http.MethodPost, "/api/admin/assessment/question-bank", `{}`},
		{http.MethodPatch, "/api/admin/assessment/question-bank/" + questionID, `{}`},
		{http.MethodPost, "/api/admin/assessment/question-bank/bulk", `{"ids":["` + questionID + `"],"action":"publish"}`},
		{http.MethodDelete, "/api/admin/assessment/question-bank/" + questionID, `{"reason":"fixture"}`},
		{http.MethodPost, "/api/admin/assessment/question-bank/" + questionID + "/suggest-edit", `{"field":"prompt","proposedValue":"fixture"}`},
	} {
		t.Run(tc.method+" "+tc.path, func(t *testing.T) {
			req := httptest.NewRequest(tc.method, tc.path, strings.NewReader(tc.body))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Origin", "http://localhost:3000")
			req.Header.Set("X-CSRF-Token", "test-csrf")
			req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
			res := httptest.NewRecorder()
			srv.Config.Handler.ServeHTTP(res, req)
			if res.Code != http.StatusForbidden {
				t.Fatalf("unprivileged %s %s status=%d body=%s, want 403", tc.method, tc.path, res.Code, res.Body.String())
			}
		})
	}
}

func TestAdminQuestionCreateRollsBackWhenChildWriteFails(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServer(t)
	defer srv.Close()

	ctx := context.Background()
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, actorID+"@question-create.example.com", "Question Create Admin")
	grantAdminPermission(t, db, actorID, "assessment.manage")
	token := createAdminSession(t, sessions, actorID)

	for _, tc := range []struct {
		name, table, predicate, reason, optionText string
	}{
		{name: "option write", table: "assessment.bjt_question_option", predicate: `text <> 'audit-020-option-fail'`, reason: "option failure", optionText: "audit-020-option-fail"},
		{name: "audit write", table: "ops.admin_audit_log", predicate: `action <> 'admin.assessment.question.created' OR reason <> 'audit-020-audit-fail'`, reason: "audit-020-audit-fail", optionText: "ordinary option"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			testID := newUUID(t)
			if _, err := db.Exec(ctx, `INSERT INTO assessment.bjt_mock_test (id,slug,title_vi,type,status,updated_at) VALUES ($1,$2,'Question create fixture','mock','draft',now())`, testID, "audit-question-create-"+testID); err != nil {
				t.Fatalf("create disposable exam fixture: %v", err)
			}
			t.Cleanup(func() { _, _ = db.Exec(ctx, `DELETE FROM assessment.bjt_mock_test WHERE id=$1`, testID) })
			var sectionID string
			if err := db.QueryRow(ctx, `INSERT INTO assessment.bjt_test_section (test_id,code,title_vi,display_order) VALUES ($1,$2,'Question create fixture',1) RETURNING id::text`, testID, "AUDIT020_"+testID[:8]).Scan(&sectionID); err != nil {
				t.Fatalf("create disposable section fixture: %v", err)
			}

			constraint := "audit020_" + strings.ReplaceAll(newUUID(t), "-", "")
			if _, err := db.Exec(ctx, fmt.Sprintf(`ALTER TABLE %s ADD CONSTRAINT %s CHECK (%s) NOT VALID`, tc.table, constraint, tc.predicate)); err != nil {
				t.Fatalf("install targeted write failure: %v", err)
			}
			t.Cleanup(func() {
				if _, err := db.Exec(ctx, fmt.Sprintf(`ALTER TABLE %s DROP CONSTRAINT %s`, tc.table, constraint)); err != nil {
					t.Errorf("drop targeted write failure: %v", err)
				}
			})

			prompt := "AUDIT020 atomic create " + newUUID(t)
			t.Cleanup(func() {
				_, _ = db.Exec(ctx, `DELETE FROM ops.admin_audit_log WHERE target_id IN (SELECT id::text FROM assessment.bjt_question WHERE prompt=$1)`, prompt)
				_, _ = db.Exec(ctx, `DELETE FROM assessment.bjt_question WHERE prompt=$1`, prompt)
			})

			body := fmt.Sprintf(`{"sectionId":%q,"prompt":%q,"explanationVi":"fixture","skillTag":"AUDIT020","difficulty":"standard","options":[{"optionKey":"A","text":%q,"isCorrect":true}],"reason":%q}`, sectionID, prompt, tc.optionText, tc.reason)
			req := httptest.NewRequest(http.MethodPost, "/api/admin/assessment/question-bank", strings.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Origin", "http://localhost:3000")
			req.Header.Set("X-CSRF-Token", "test-csrf")
			req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
			res := httptest.NewRecorder()
			srv.Config.Handler.ServeHTTP(res, req)
			if res.Code != http.StatusInternalServerError {
				t.Fatalf("create status=%d body=%s, want 500 on %s write failure", res.Code, res.Body.String(), tc.name)
			}

			var questionCount, auditCount int
			if err := db.QueryRow(ctx, `SELECT count(*) FROM assessment.bjt_question WHERE prompt=$1`, prompt).Scan(&questionCount); err != nil {
				t.Fatal(err)
			}
			if err := db.QueryRow(ctx, `SELECT count(*) FROM ops.admin_audit_log WHERE after->>'prompt'=$1`, prompt).Scan(&auditCount); err != nil {
				t.Fatal(err)
			}
			if questionCount != 0 || auditCount != 0 {
				t.Fatalf("partial create persisted: questions=%d audits=%d, want both zero", questionCount, auditCount)
			}
		})
	}
}
