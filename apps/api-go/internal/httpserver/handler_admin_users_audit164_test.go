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

func TestAdminUsersAudit164Routes(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	ctx := context.Background()

	adminID, deniedID, userID := newUUID(t), newUUID(t), newUUID(t)
	seedAdminActor(t, db, adminID, fmt.Sprintf("audit164-%s@example.test", adminID[:8]), "AUDIT-164 Admin")
	seedAdminActor(t, db, deniedID, fmt.Sprintf("audit164-denied-%s@example.test", deniedID[:8]), "AUDIT-164 Denied")
	adminToken, deniedToken := createAdminSession(t, sessions, adminID), createAdminSession(t, sessions, deniedID)
	userEmail := fmt.Sprintf("audit164-user-%s@example.test", userID[:8])
	seedActiveUser(t, db, userID, "AUDIT-164 Learner", userEmail, "audit164-"+userID)
	planID := newUUID(t)
	planSlug := "audit164-" + strings.ReplaceAll(planID, "-", "")[:12]
	if _, err := db.Exec(ctx, `INSERT INTO monetization.plan (id,slug,name_key,status,updated_at) VALUES ($1,$2,'audit164.plan','active',now())`, planID, planSlug); err != nil {
		t.Fatalf("seed disposable plan: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, `DELETE FROM ops.admin_audit_log WHERE target_id IN (SELECT id::text FROM profile.user_profile WHERE email LIKE 'audit164-%@example.test') OR actor_id=$1 OR actor_id=$2`, adminID, deniedID)
		_, _ = db.Exec(ctx, `DELETE FROM profile.user_invitation WHERE email LIKE 'audit164-%@example.test'`)
		_, _ = db.Exec(ctx, `DELETE FROM monetization.user_subscription WHERE user_id IN (SELECT id FROM profile.user_profile WHERE email LIKE 'audit164-%@example.test')`)
		_, _ = db.Exec(ctx, `DELETE FROM profile.user_profile WHERE email LIKE 'audit164-%@example.test'`)
		_, _ = db.Exec(ctx, `DELETE FROM monetization.plan WHERE id=$1`, planID)
	})

	call := func(method, path, body, token string, csrf bool) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		if token != "" {
			req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		}
		if method != http.MethodGet {
			req.Header.Set("Content-Type", "application/json")
			if csrf {
				req.Header.Set("Origin", "http://localhost:3000")
				req.Header.Set("X-CSRF-Token", "audit164-csrf")
			}
		}
		res := httptest.NewRecorder()
		srv.Config.Handler.ServeHTTP(res, req)
		return res
	}
	routes := []struct {
		method, path, body string
		write              bool
	}{
		{http.MethodGet, "/api/admin/users", "", false},
		{http.MethodPost, "/api/admin/users", `{"email":"new@example.test","displayName":"New","creationReason":"audit fixture"}`, true},
		{http.MethodPost, "/api/admin/users/invite", `{"email":"invite@example.test","displayName":"Invite","creationReason":"audit fixture"}`, true},
		{http.MethodGet, "/api/admin/users/kpis", "", false},
		{http.MethodGet, "/api/admin/users/" + userID, "", false},
		{http.MethodGet, "/api/admin/users/" + userID + "/audit", "", false},
		{http.MethodPatch, "/api/admin/users/" + userID + "/plan", fmt.Sprintf(`{"planSlug":%q,"reason":"AUDIT-164 plan"}`, planSlug), true},
		{http.MethodPatch, "/api/admin/users/" + userID + "/status", `{"status":"suspended","reason":"AUDIT-164 status"}`, true},
	}
	for _, route := range routes {
		if got := call(route.method, route.path, route.body, "", true).Code; got != http.StatusUnauthorized {
			t.Errorf("anonymous %s %s status=%d; want 401", route.method, route.path, got)
		}
		if got := call(route.method, route.path, route.body, deniedToken, true).Code; got != http.StatusForbidden {
			t.Errorf("unauthorized admin %s %s status=%d; want 403", route.method, route.path, got)
		}
		if route.write {
			if got := call(route.method, route.path, route.body, adminToken, false).Code; got != http.StatusForbidden {
				t.Errorf("missing CSRF %s %s status=%d; want 403", route.method, route.path, got)
			}
		}
	}

	grantAdminPermission(t, db, adminID, "iam.manage")
	t.Run("reads return disposable user contracts", func(t *testing.T) {
		list := call(http.MethodGet, "/api/admin/users?q="+userEmail+"&page=1&pageSize=10", "", adminToken, true)
		var listBody struct {
			Items []struct{ ID, Email string } `json:"items"`
			Total int                          `json:"total"`
		}
		if list.Code != http.StatusOK || json.Unmarshal(list.Body.Bytes(), &listBody) != nil || listBody.Total != 1 || len(listBody.Items) != 1 || listBody.Items[0].ID != userID {
			t.Fatalf("filtered list status=%d body=%s", list.Code, list.Body.String())
		}
		kpis := call(http.MethodGet, "/api/admin/users/kpis", "", adminToken, true)
		var kpiBody map[string]int
		if kpis.Code != http.StatusOK || json.Unmarshal(kpis.Body.Bytes(), &kpiBody) != nil || kpiBody["totalUsers"] < 1 {
			t.Fatalf("kpis status=%d body=%s", kpis.Code, kpis.Body.String())
		}
		detail := call(http.MethodGet, "/api/admin/users/"+userID, "", adminToken, true)
		var detailBody struct{ ID, Email string }
		if detail.Code != http.StatusOK || json.Unmarshal(detail.Body.Bytes(), &detailBody) != nil || detailBody.ID != userID || detailBody.Email != userEmail {
			t.Fatalf("detail status=%d body=%s", detail.Code, detail.Body.String())
		}
	})

	for _, create := range []struct{ path, email, action string }{
		{"/api/admin/users", fmt.Sprintf("audit164-created-%s@example.test", adminID[:8]), "admin.user.created"},
		{"/api/admin/users/invite", fmt.Sprintf("audit164-invited-%s@example.test", adminID[:8]), "admin.user.invited"},
	} {
		res := call(http.MethodPost, create.path, fmt.Sprintf(`{"email":%q,"displayName":"AUDIT-164","creationReason":"Disposable audit fixture"}`, create.email), adminToken, true)
		if res.Code != http.StatusCreated {
			t.Fatalf("create %s status=%d body=%s", create.path, res.Code, res.Body.String())
		}
		var created struct {
			ID           string `json:"id"`
			InvitationID string `json:"invitationId"`
		}
		if err := json.Unmarshal(res.Body.Bytes(), &created); err != nil || created.ID == "" {
			t.Fatalf("create %s response=%s err=%v", create.path, res.Body.String(), err)
		}
		var persisted, audited int
		if err := db.QueryRow(ctx, `SELECT count(*) FROM profile.user_profile WHERE id=$1 AND lower(email)=$2`, created.ID, create.email).Scan(&persisted); err != nil || persisted != 1 {
			t.Fatalf("create %s persistence count=%d err=%v", create.path, persisted, err)
		}
		if err := db.QueryRow(ctx, `SELECT count(*) FROM ops.admin_audit_log WHERE actor_id=$1 AND target_id=$2 AND action=$3`, adminID, created.ID, create.action).Scan(&audited); err != nil || audited != 1 {
			t.Fatalf("create %s audit count=%d err=%v", create.path, audited, err)
		}
		if create.action == "admin.user.invited" {
			var inviteCount int
			if created.InvitationID == "" || db.QueryRow(ctx, `SELECT count(*) FROM profile.user_invitation WHERE id=$1 AND user_profile_id=$2 AND status='pending'`, created.InvitationID, created.ID).Scan(&inviteCount) != nil || inviteCount != 1 {
				t.Fatalf("invite persistence id=%q count=%d", created.InvitationID, inviteCount)
			}
		}
	}
	kpisAfterInvite := call(http.MethodGet, "/api/admin/users/kpis", "", adminToken, true)
	var inviteKPIs map[string]int
	if kpisAfterInvite.Code != http.StatusOK || json.Unmarshal(kpisAfterInvite.Body.Bytes(), &inviteKPIs) != nil || inviteKPIs["onboardingIncomplete"] < 1 {
		t.Fatalf("post-invite KPIs status=%d body=%s", kpisAfterInvite.Code, kpisAfterInvite.Body.String())
	}
	duplicate := call(http.MethodPost, "/api/admin/users", fmt.Sprintf(`{"email":%q,"displayName":"Duplicate","creationReason":"duplicate test"}`, userEmail), adminToken, true)
	if duplicate.Code != http.StatusConflict {
		t.Fatalf("duplicate user status=%d body=%s; want 409", duplicate.Code, duplicate.Body.String())
	}

	if res := call(http.MethodPatch, "/api/admin/users/"+userID+"/plan", fmt.Sprintf(`{"planSlug":%q,"reason":"AUDIT-164 plan"}`, planSlug), adminToken, true); res.Code != http.StatusOK {
		t.Fatalf("plan update status=%d body=%s", res.Code, res.Body.String())
	}
	if res := call(http.MethodPatch, "/api/admin/users/"+userID+"/status", `{"status":"suspended","reason":"AUDIT-164 status"}`, adminToken, true); res.Code != http.StatusOK {
		t.Fatalf("status update status=%d body=%s", res.Code, res.Body.String())
	}
	var status, assignedPlan string
	if err := db.QueryRow(ctx, `SELECT status FROM profile.user_profile WHERE id=$1`, userID).Scan(&status); err != nil || status != "suspended" {
		t.Fatalf("persisted status=%q err=%v", status, err)
	}
	if err := db.QueryRow(ctx, `SELECT plan_id::text FROM monetization.user_subscription WHERE user_id=$1 AND plan_id=$2 AND status='active'`, userID, planID).Scan(&assignedPlan); err != nil || assignedPlan != planID {
		t.Fatalf("persisted plan=%q err=%v", assignedPlan, err)
	}
	for _, action := range []string{"admin.user.plan.updated", "admin.user.status.updated"} {
		var count int
		if err := db.QueryRow(ctx, `SELECT count(*) FROM ops.admin_audit_log WHERE actor_id=$1 AND target_id=$2 AND action=$3`, adminID, userID, action).Scan(&count); err != nil || count != 1 {
			t.Fatalf("audit %s count=%d err=%v", action, count, err)
		}
	}
	var statusBefore string
	if err := db.QueryRow(ctx, `SELECT before->>'status' FROM ops.admin_audit_log WHERE actor_id=$1 AND target_id=$2 AND action='admin.user.status.updated'`, adminID, userID).Scan(&statusBefore); err != nil || statusBefore != "active" {
		t.Fatalf("status audit before=%q err=%v; want active", statusBefore, err)
	}
	audit := call(http.MethodGet, "/api/admin/users/"+userID+"/audit?limit=20", "", adminToken, true)
	var auditBody []json.RawMessage
	if audit.Code != http.StatusOK || json.Unmarshal(audit.Body.Bytes(), &auditBody) != nil || len(auditBody) < 2 {
		t.Fatalf("user audit status=%d body=%s", audit.Code, audit.Body.String())
	}

	for _, invalid := range []struct {
		method, path, body string
		want               int
	}{
		{http.MethodPost, "/api/admin/users", `{"email":"bad email","displayName":"Invalid","creationReason":"fixture"}`, http.StatusBadRequest},
		{http.MethodPost, "/api/admin/users/invite", `{"email":"bad email","displayName":"Invalid","creationReason":"fixture"}`, http.StatusBadRequest},
		{http.MethodPatch, "/api/admin/users/" + userID + "/status", `{"status":"made-up","reason":"bad"}`, http.StatusBadRequest},
		{http.MethodPatch, "/api/admin/users/not-a-uuid/plan", `{"planSlug":"bad","reason":"fixture"}`, http.StatusBadRequest},
		{http.MethodPatch, "/api/admin/users/" + userID + "/plan", `{"planSlug":"missing-plan","reason":"fixture"}`, http.StatusNotFound},
		{http.MethodGet, "/api/admin/users/not-a-uuid", "", http.StatusBadRequest},
	} {
		if res := call(invalid.method, invalid.path, invalid.body, adminToken, true); res.Code != invalid.want {
			t.Errorf("invalid %s %s status=%d body=%s; want %d", invalid.method, invalid.path, res.Code, res.Body.String(), invalid.want)
		}
	}
}
