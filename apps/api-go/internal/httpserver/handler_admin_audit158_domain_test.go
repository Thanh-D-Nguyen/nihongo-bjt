package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestAudit158CompetencyAPIsPersistLifecycle(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, fmt.Sprintf("audit158-comp-%s@example.test", actorID[:8]), "AUDIT-158 content admin")
	grantAdminPermission(t, db, actorID, "admin.content.read")
	grantAdminPermission(t, db, actorID, "admin.content.write")
	token := createAdminSession(t, sessions, actorID)
	call := func(method, path, body string) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		if method != http.MethodGet {
			req.Header.Set("Origin", "http://localhost:3000")
		}
		if body != "" {
			req.Header.Set("Content-Type", "application/json")
		}
		res := httptest.NewRecorder()
		srv.Config.Handler.ServeHTTP(res, req)
		return res
	}
	code := "audit158-" + actorID[:8]
	created := call(http.MethodPost, "/api/admin/learning/competencies", fmt.Sprintf(`{"code":%q,"titleVi":"Năng lực kiểm thử","titleJa":"試験","descriptionVi":"fixture","level":"beginner","reason":"audit test"}`, code))
	if created.Code != http.StatusCreated {
		t.Fatalf("POST create status=%d body=%s", created.Code, created.Body.String())
	}
	var result struct {
		ID     string `json:"id"`
		Code   string `json:"code"`
		Status string `json:"status"`
	}
	if err := json.Unmarshal(created.Body.Bytes(), &result); err != nil || result.ID == "" || result.Code != code || result.Status != "draft" {
		t.Fatalf("POST create contract body=%s err=%v", created.Body.String(), err)
	}
	assertAdminAuditEvent(t, db, actorID, "admin.learning.competency.created", "learning.competency", result.ID)

	updated := call(http.MethodPatch, "/api/admin/learning/competencies/"+result.ID, `{"titleVi":"Năng lực đã cập nhật","reason":"update fixture"}`)
	if updated.Code != http.StatusOK {
		t.Fatalf("PATCH update status=%d body=%s", updated.Code, updated.Body.String())
	}
	var title string
	if err := db.QueryRow(context.Background(), `SELECT title_vi FROM learning.competency WHERE id=$1`, result.ID).Scan(&title); err != nil || title != "Năng lực đã cập nhật" {
		t.Fatalf("PATCH persistence title=%q err=%v", title, err)
	}
	assertAdminAuditEvent(t, db, actorID, "admin.learning.competency.updated", "learning.competency", result.ID)

	missing := "00000000-0000-4000-8000-000000000099"
	if res := call(http.MethodPatch, "/api/admin/learning/competencies/"+missing, `{"titleVi":"orphan","reason":"missing target"}`); res.Code != http.StatusNotFound {
		t.Errorf("PATCH missing status=%d body=%s; want 404", res.Code, res.Body.String())
	}
	if res := call(http.MethodPost, "/api/admin/learning/competencies/"+missing+"/archive", `{"reason":"missing target"}`); res.Code != http.StatusNotFound {
		t.Errorf("POST archive missing status=%d body=%s; want 404", res.Code, res.Body.String())
	}

	published := call(http.MethodPost, "/api/admin/learning/competencies/"+result.ID+"/publish", `{"reason":"publish fixture"}`)
	if published.Code != http.StatusOK || !strings.Contains(published.Body.String(), `"status":"published"`) {
		t.Fatalf("POST publish status=%d body=%s", published.Code, published.Body.String())
	}
	archived := call(http.MethodPost, "/api/admin/learning/competencies/"+result.ID+"/archive", `{"reason":"archive fixture"}`)
	if archived.Code != http.StatusOK || !strings.Contains(archived.Body.String(), `"status":"archived"`) {
		t.Fatalf("POST archive status=%d body=%s", archived.Code, archived.Body.String())
	}
	if err := db.QueryRow(context.Background(), `SELECT status FROM learning.competency WHERE id=$1`, result.ID).Scan(&title); err != nil || title != "archived" {
		t.Fatalf("transition persisted status=%q err=%v", title, err)
	}
	assertAdminAuditEvent(t, db, actorID, "admin.learning.competency.published", "learning.competency", result.ID)
	assertAdminAuditEvent(t, db, actorID, "admin.learning.competency.archived", "learning.competency", result.ID)

	defer db.Exec(context.Background(), `DELETE FROM ops.admin_audit_log WHERE target_type='learning.competency' AND target_id IN (SELECT id::text FROM learning.competency WHERE code=$1)`, code)
	if _, err := db.Exec(context.Background(), `DELETE FROM learning.competency WHERE code=$1`, code); err != nil {
		t.Fatalf("cleanup competency: %v", err)
	}
	deletedFixture := call(http.MethodPost, "/api/admin/learning/competencies", fmt.Sprintf(`{"code":%q,"titleVi":"Xóa nháp","level":"beginner","reason":"delete fixture"}`, code+"-delete"))
	if deletedFixture.Code != http.StatusCreated {
		t.Fatalf("POST delete fixture status=%d body=%s", deletedFixture.Code, deletedFixture.Body.String())
	}
	if err := json.Unmarshal(deletedFixture.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	deleted := call(http.MethodDelete, "/api/admin/learning/competencies/"+result.ID, `{"reason":"delete fixture"}`)
	if deleted.Code != http.StatusOK || !strings.Contains(deleted.Body.String(), `"deleted":true`) {
		t.Fatalf("DELETE draft status=%d body=%s", deleted.Code, deleted.Body.String())
	}
	var count int
	if err := db.QueryRow(context.Background(), `SELECT count(*) FROM learning.competency WHERE id=$1`, result.ID).Scan(&count); err != nil || count != 0 {
		t.Fatalf("DELETE persistence count=%d err=%v", count, err)
	}
	assertAdminAuditEvent(t, db, actorID, "admin.learning.competency.deleted", "learning.competency", result.ID)
}

func TestAudit158LearningReviewAPIsPersistAndReport(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	actorID, userID := newUUID(t), newUUID(t)
	seedAdminActor(t, db, actorID, fmt.Sprintf("audit158-review-admin-%s@example.test", actorID[:8]), "AUDIT-158 review admin")
	grantAdminPermission(t, db, actorID, "admin.content.read")
	grantAdminPermission(t, db, actorID, "admin.content.write")
	token := createAdminSession(t, sessions, actorID)
	seedActiveUser(t, db, userID, "AUDIT-158 review learner", fmt.Sprintf("audit158-review-user-%s@example.test", userID[:8]), "")
	var cardID, flashcardID string
	if err := db.QueryRow(context.Background(), `INSERT INTO learning.flashcard_variant (source_type,source_id,front_text,back_text,reading,status,updated_at) VALUES ('audit158',gen_random_uuid(),'会議','meeting','かいぎ','active',NOW()) RETURNING id`).Scan(&cardID); err != nil {
		t.Fatal(err)
	}
	defer db.Exec(context.Background(), `DELETE FROM learning.flashcard_variant WHERE id=$1`, cardID)
	var deckID string
	if err := db.QueryRow(context.Background(), `INSERT INTO learning.deck (owner_user_id,title_vi,status,visibility,updated_at) VALUES ($1,'AUDIT-158 review','active','private',NOW()) RETURNING id`, userID).Scan(&deckID); err != nil {
		t.Fatal(err)
	}
	defer db.Exec(context.Background(), `DELETE FROM learning.deck WHERE id=$1`, deckID)
	if _, err := db.Exec(context.Background(), `INSERT INTO learning.deck_card (deck_id,card_id,position) VALUES ($1,$2,0)`, deckID, cardID); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(context.Background(), `INSERT INTO learning.user_flashcard (user_id,card_id,state,due_at,interval_days,ease_factor,repetitions,lapses,leeched,updated_at) VALUES ($1,$2,'review',NOW()-INTERVAL '1 day',1,1.3,2,4,true,NOW()) RETURNING id`, userID, cardID).Scan(&flashcardID); err != nil {
		t.Fatal(err)
	}
	defer db.Exec(context.Background(), `DELETE FROM learning.user_flashcard WHERE id=$1`, flashcardID)
	if _, err := db.Exec(context.Background(), `INSERT INTO learning.review_event (user_id,user_flashcard_id,rating,elapsed_ms,previous_due_at,next_due_at,reviewed_at) VALUES ($1,$2,'good',350,NOW()-INTERVAL '1 day',NOW()+INTERVAL '1 day',NOW())`, userID, flashcardID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(context.Background(), `INSERT INTO learning.review_event (user_id,user_flashcard_id,rating,elapsed_ms,previous_due_at,next_due_at,reviewed_at) VALUES ($1,$2,'again',500,NOW()-INTERVAL '1 day',NOW()+INTERVAL '1 day',NOW())`, userID, flashcardID); err != nil {
		t.Fatal(err)
	}
	defer db.Exec(context.Background(), `DELETE FROM learning.review_event WHERE user_flashcard_id=$1`, flashcardID)
	call := func(method, path, body string) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		if method != http.MethodGet {
			req.Header.Set("Origin", "http://localhost:3000")
		}
		res := httptest.NewRecorder()
		srv.Config.Handler.ServeHTTP(res, req)
		return res
	}
	filtered := call(http.MethodGet, "/api/admin/learning/review/problem-cards?minLapses=2&maxRetention=40&leeched=leeched&q=会議&page=1&pageSize=10", "")
	if filtered.Code != http.StatusOK || !strings.Contains(filtered.Body.String(), `"total":0`) || strings.Contains(filtered.Body.String(), flashcardID) {
		t.Fatalf("retention cap mismatch: status=%d body=%s", filtered.Code, filtered.Body.String())
	}
	for _, path := range []string{"/api/admin/learning/review/summary?windowDays=30", "/api/admin/learning/review/retention-curve?windowDays=30", "/api/admin/learning/review/problem-cards?minLapses=2&maxRetention=70&leeched=leeched&q=会議&page=1&pageSize=10"} {
		res := call(http.MethodGet, path, "")
		if res.Code != http.StatusOK {
			t.Fatalf("GET %s status=%d body=%s", path, res.Code, res.Body.String())
		}
		if strings.Contains(path, "problem-cards") && (!strings.Contains(res.Body.String(), flashcardID) || !strings.Contains(res.Body.String(), `"card":{"id":"`+cardID+`"`) || !strings.Contains(res.Body.String(), `"recent":{"reviews":2`) || !strings.Contains(res.Body.String(), `"retentionPct":50`)) {
			t.Fatalf("problem-card contract body=%s", res.Body.String())
		}
		if strings.Contains(path, "summary") {
			var summary struct {
				TotalCards   int `json:"totalCards"`
				ReviewsTotal int `json:"reviewsTotal"`
			}
			if err := json.Unmarshal(res.Body.Bytes(), &summary); err != nil || summary.TotalCards < 1 || summary.ReviewsTotal < 2 {
				t.Fatalf("summary contract=%+v body=%s err=%v", summary, res.Body.String(), err)
			}
		}
		if strings.Contains(path, "retention-curve") && !strings.Contains(res.Body.String(), `"retentionPct":50`) {
			t.Fatalf("retention contract body=%s", res.Body.String())
		}
	}
	detail := call(http.MethodGet, "/api/admin/learning/review/cards/"+flashcardID, "")
	if detail.Code != http.StatusOK || !strings.Contains(detail.Body.String(), flashcardID) || !strings.Contains(detail.Body.String(), `"rating":"good"`) || !strings.Contains(detail.Body.String(), `"title":"会議"`) {
		t.Fatalf("GET card detail status=%d body=%s", detail.Code, detail.Body.String())
	}
	forced := call(http.MethodPost, "/api/admin/learning/review/cards/"+flashcardID+"/force-reintroduce", `{"reason":"audit158 recovery"}`)
	if forced.Code != http.StatusOK || !strings.Contains(forced.Body.String(), `"reintroduced":true`) {
		t.Fatalf("POST force reintroduce status=%d body=%s", forced.Code, forced.Body.String())
	}
	var state string
	var interval int
	if err := db.QueryRow(context.Background(), `SELECT state,interval_days FROM learning.user_flashcard WHERE id=$1`, flashcardID).Scan(&state, &interval); err != nil || state != "relearning" || interval != 0 {
		t.Fatalf("force reintroduce state=%q interval=%d err=%v", state, interval, err)
	}
	assertAdminAuditEvent(t, db, actorID, "admin.learning.review.force_reintroduce", "learning.user_flashcard", flashcardID)
}

func TestAudit158LearningReviewRequiresReadAndWritePermissions(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, fmt.Sprintf("audit158-review-rbac-%s@example.test", actorID[:8]), "AUDIT-158 review RBAC")
	token := createAdminSession(t, sessions, actorID)
	call := func(method, path string) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, path, strings.NewReader(`{"reason":"audit"}`))
		req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		req.Header.Set("Origin", "http://localhost:3000")
		res := httptest.NewRecorder()
		srv.Config.Handler.ServeHTTP(res, req)
		return res
	}
	if res := call(http.MethodGet, "/api/admin/learning/review/summary"); res.Code != http.StatusForbidden {
		t.Fatalf("learning review requires admin.content.read: status=%d body=%s", res.Code, res.Body.String())
	}
	grantAdminPermission(t, db, actorID, "admin.content.read")
	if res := call(http.MethodGet, "/api/admin/learning/review/summary"); res.Code != http.StatusOK {
		t.Fatalf("read permission should allow review summary: status=%d body=%s", res.Code, res.Body.String())
	}
	if res := call(http.MethodPost, "/api/admin/learning/review/cards/00000000-0000-4000-8000-000000000001/force-reintroduce"); res.Code != http.StatusForbidden {
		t.Fatalf("force reintroduce requires admin.content.write: status=%d body=%s", res.Code, res.Body.String())
	}
}
