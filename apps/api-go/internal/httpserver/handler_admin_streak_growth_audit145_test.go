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
)

func TestAdminStreakAndGrowthCampaignRoutesEnforcePermissions(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()

	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, fmt.Sprintf("audit145-%s@example.com", actorID[:8]), "AUDIT-145 roleless")
	token := createAdminSession(t, sessions, actorID)
	streakID := newUUID(t)
	cases := []struct {
		method string
		path   string
		body   string
	}{
		{http.MethodPost, "/api/admin/gamification/streaks", `{"name":"audit145","activityType":"review","minActionsPerDay":1}`},
		{http.MethodPut, "/api/admin/gamification/streaks/" + streakID, `{"name":"audit145","activityType":"review","minActionsPerDay":1}`},
		{http.MethodDelete, "/api/admin/gamification/streaks/" + streakID, ""},
		{http.MethodGet, "/api/admin/growth/campaigns", ""},
		{http.MethodPost, "/api/admin/growth/campaigns", `{"name":"AUDIT-145 disposable","channel":"in_app","reason":"audit145"}`},
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM growth.growth_campaign WHERE name='AUDIT-145 disposable'`)
		_, _ = db.Exec(context.Background(), `DELETE FROM gamification.streak_config WHERE name='audit145'`)
	})
	for _, tc := range cases {
		t.Run(tc.method+" "+tc.path, func(t *testing.T) {
			req := httptest.NewRequest(tc.method, tc.path, strings.NewReader(tc.body))
			req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
			req.Header.Set("Origin", "http://localhost:3000")
			req.Header.Set("X-CSRF-Token", "test-csrf")
			if tc.body != "" {
				req.Header.Set("Content-Type", "application/json")
			}
			res := httptest.NewRecorder()
			srv.Config.Handler.ServeHTTP(res, req)
			if res.Code != http.StatusForbidden {
				t.Fatalf("roleless status=%d body=%s; want 403", res.Code, res.Body.String())
			}
		})
	}
	grantAdminPermission(t, db, actorID, "admin.content.read")
	grantAdminPermission(t, db, actorID, "admin.growth.read")
	readReq := httptest.NewRequest(http.MethodGet, cases[3].path, nil)
	readReq.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
	readRes := httptest.NewRecorder()
	srv.Config.Handler.ServeHTTP(readRes, readReq)
	if readRes.Code != http.StatusOK {
		t.Fatalf("growth-read Admin GET campaigns status=%d; want 200", readRes.Code)
	}
	for _, tc := range []struct{ method, path, body string }{cases[0], cases[1], cases[2], cases[4]} {
		req := httptest.NewRequest(tc.method, tc.path, strings.NewReader(tc.body))
		req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		req.Header.Set("Origin", "http://localhost:3000")
		req.Header.Set("X-CSRF-Token", "test-csrf")
		if tc.body != "" {
			req.Header.Set("Content-Type", "application/json")
		}
		res := httptest.NewRecorder()
		srv.Config.Handler.ServeHTTP(res, req)
		if res.Code != http.StatusForbidden {
			t.Fatalf("read-only Admin %s %s status=%d; want 403", tc.method, tc.path, res.Code)
		}
	}
	grantAdminPermission(t, db, actorID, "admin.content.write")
	contentWriterReq := httptest.NewRequest(http.MethodPost, cases[4].path, strings.NewReader(cases[4].body))
	contentWriterReq.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
	contentWriterReq.Header.Set("Origin", "http://localhost:3000")
	contentWriterReq.Header.Set("X-CSRF-Token", "test-csrf")
	contentWriterReq.Header.Set("Content-Type", "application/json")
	contentWriterRes := httptest.NewRecorder()
	srv.Config.Handler.ServeHTTP(contentWriterRes, contentWriterReq)
	if contentWriterRes.Code != http.StatusForbidden {
		t.Fatalf("content-write Admin POST campaign status=%d; want 403", contentWriterRes.Code)
	}
	grantAdminPermission(t, db, actorID, "growth.manage")
	for _, tc := range []struct{ method, path, body string }{cases[0], cases[1], cases[2], cases[4]} {
		req := httptest.NewRequest(tc.method, tc.path, strings.NewReader(tc.body))
		req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		req.Header.Set("Content-Type", "application/json")
		res := httptest.NewRecorder()
		srv.Config.Handler.ServeHTTP(res, req)
		if res.Code != http.StatusForbidden {
			t.Fatalf("missing trusted Origin/CSRF %s %s status=%d; want 403", tc.method, tc.path, res.Code)
		}
	}
}

func TestAdminStreakAndGrowthCampaignMutationsPersistAndAudit(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	ctx := context.Background()
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, fmt.Sprintf("audit145-write-%s@example.com", actorID[:8]), "AUDIT-145 writer")
	grantAdminPermission(t, db, actorID, "admin.content.read")
	grantAdminPermission(t, db, actorID, "admin.content.write")
	grantAdminPermission(t, db, actorID, "admin.growth.read")
	grantAdminPermission(t, db, actorID, "growth.manage")
	token := createAdminSession(t, sessions, actorID)
	call := func(method, path, body string) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		req.Header.Set("Origin", "http://localhost:3000")
		req.Header.Set("X-CSRF-Token", "test-csrf")
		if body != "" {
			req.Header.Set("Content-Type", "application/json")
		}
		res := httptest.NewRecorder()
		srv.Config.Handler.ServeHTTP(res, req)
		return res
	}
	streakName := "AUDIT-145 streak " + actorID
	campaignName := "AUDIT-145 campaign " + actorID
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, `DELETE FROM ops.admin_audit_log WHERE target_id IN (SELECT id::text FROM gamification.streak_config WHERE name=$1 UNION SELECT id::text FROM growth.growth_campaign WHERE name=$2)`, streakName, campaignName)
		_, _ = db.Exec(ctx, `DELETE FROM gamification.streak_config WHERE name=$1`, streakName)
		_, _ = db.Exec(ctx, `DELETE FROM growth.growth_campaign WHERE name=$1`, campaignName)
	})
	for _, body := range []string{
		`{"name":" ","activityType":"review","minActionsPerDay":1}`,
		`{"name":"invalid","activityType":"unknown","minActionsPerDay":1}`,
		`{"name":"invalid","activityType":"review","minActionsPerDay":0}`,
		`{"name":"invalid","activityType":"review","minActionsPerDay":101}`,
		`{"name":"invalid","activityType":"review","minActionsPerDay":2147483648}`,
		`{"name":"invalid","activityType":"review","minActionsPerDay":1,"freezesAllowed":-1}`,
		`{"name":"invalid","activityType":"review","minActionsPerDay":1,"freezesAllowed":11}`,
	} {
		if got := call(http.MethodPost, "/api/admin/gamification/streaks", body).Code; got != http.StatusBadRequest {
			t.Fatalf("invalid streak status=%d body=%s", got, body)
		}
	}
	if got := call(http.MethodPut, "/api/admin/gamification/streaks/not-a-uuid", `{"name":"valid","activityType":"review","minActionsPerDay":1}`).Code; got != http.StatusBadRequest {
		t.Fatalf("invalid streak ID status=%d; want 400", got)
	}
	createdStreak := call(http.MethodPost, "/api/admin/gamification/streaks", fmt.Sprintf(`{"name":%q,"activityType":"review","minActionsPerDay":2,"freezesAllowed":1,"enabled":true}`, streakName))
	if createdStreak.Code != http.StatusCreated {
		t.Fatalf("streak create status=%d body=%s", createdStreak.Code, createdStreak.Body.String())
	}
	var streakBody struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(createdStreak.Body.Bytes(), &streakBody); err != nil || streakBody.ID == "" {
		t.Fatalf("streak response=%s err=%v", createdStreak.Body.String(), err)
	}
	if got := call(http.MethodPut, "/api/admin/gamification/streaks/"+streakBody.ID, fmt.Sprintf(`{"name":%q,"activityType":"quiz","minActionsPerDay":3,"freezesAllowed":2,"enabled":false}`, streakName)).Code; got != http.StatusOK {
		t.Fatalf("streak update status=%d", got)
	}
	var activity string
	var minActions int
	var enabled bool
	if err := db.QueryRow(ctx, `SELECT activity_type,min_actions_per_day,enabled FROM gamification.streak_config WHERE id=$1`, streakBody.ID).Scan(&activity, &minActions, &enabled); err != nil || activity != "quiz" || minActions != 3 || enabled {
		t.Fatalf("persisted streak=(%q,%d,%v) err=%v", activity, minActions, enabled, err)
	}
	if got := call(http.MethodDelete, "/api/admin/gamification/streaks/"+streakBody.ID, "").Code; got != http.StatusOK {
		t.Fatalf("streak delete status=%d", got)
	}
	if got := call(http.MethodPut, "/api/admin/gamification/streaks/"+streakBody.ID, fmt.Sprintf(`{"name":%q,"activityType":"review","minActionsPerDay":1}`, streakName)).Code; got != http.StatusNotFound {
		t.Fatalf("missing streak update status=%d, want 404", got)
	}
	for _, action := range []string{"admin.gamification.streak.created", "admin.gamification.streak.updated", "admin.gamification.streak.deleted"} {
		var count int
		if err := db.QueryRow(ctx, `SELECT count(*) FROM ops.admin_audit_log WHERE actor_id=$1 AND target_id=$2 AND action=$3`, actorID, streakBody.ID, action).Scan(&count); err != nil || count != 1 {
			t.Fatalf("audit action=%s count=%d err=%v", action, count, err)
		}
	}

	start := time.Now().UTC().Add(24 * time.Hour).Truncate(time.Second).Format(time.RFC3339)
	end := time.Now().UTC().Add(48 * time.Hour).Truncate(time.Second).Format(time.RFC3339)
	createdCampaign := call(http.MethodPost, "/api/admin/growth/campaigns", fmt.Sprintf(`{"name":%q,"channel":"in_app","reason":"AUDIT-145 test","scheduleStart":%q,"scheduleEnd":%q}`, campaignName, start, end))
	if createdCampaign.Code != http.StatusCreated {
		t.Fatalf("campaign create status=%d body=%s", createdCampaign.Code, createdCampaign.Body.String())
	}
	var campaignBody struct {
		ID            string `json:"id"`
		Name          string `json:"name"`
		Status        string `json:"status"`
		Channel       string `json:"channel"`
		ScheduleStart string `json:"scheduleStart"`
		ScheduleEnd   string `json:"scheduleEnd"`
		CreatedAt     string `json:"createdAt"`
		CreatedByID   string `json:"createdById"`
		Audit         []struct {
			ID      string `json:"id"`
			Action  string `json:"action"`
			ActorID string `json:"actorId"`
			Reason  string `json:"reason"`
		} `json:"audit"`
	}
	if err := json.Unmarshal(createdCampaign.Body.Bytes(), &campaignBody); err != nil ||
		campaignBody.ID == "" || campaignBody.Name != campaignName || campaignBody.Status != "draft" ||
		campaignBody.Channel != "in_app" || campaignBody.ScheduleStart != start || campaignBody.ScheduleEnd != end ||
		campaignBody.CreatedAt == "" || campaignBody.CreatedByID != actorID || len(campaignBody.Audit) != 1 ||
		campaignBody.Audit[0].ID == "" || campaignBody.Audit[0].Action != "admin.growth.campaign.created" ||
		campaignBody.Audit[0].ActorID != actorID || campaignBody.Audit[0].Reason != "AUDIT-145 test" {
		t.Fatalf("campaign response=%s err=%v", createdCampaign.Body.String(), err)
	}
	var auditCount int
	if err := db.QueryRow(ctx, `SELECT count(*) FROM ops.admin_audit_log WHERE actor_id=$1 AND target_id=$2 AND action='admin.growth.campaign.created' AND reason='AUDIT-145 test'`, actorID, campaignBody.ID).Scan(&auditCount); err != nil || auditCount != 1 {
		t.Fatalf("campaign audit count=%d err=%v", auditCount, err)
	}
	listed := call(http.MethodGet, "/api/admin/growth/campaigns?q=AUDIT-145+campaign&page=1&pageSize=1", "")
	if listed.Code != http.StatusOK || !strings.Contains(listed.Body.String(), campaignBody.ID) {
		t.Fatalf("campaign list status=%d body=%s", listed.Code, listed.Body.String())
	}
	page := int(^uint(0) >> 1)
	overflowPage := call(http.MethodGet, fmt.Sprintf("/api/admin/growth/campaigns?q=AUDIT-145+campaign&page=%d&pageSize=100", page), "")
	if overflowPage.Code != http.StatusOK || !strings.Contains(overflowPage.Body.String(), `"total":1`) || !strings.Contains(overflowPage.Body.String(), `"items":[]`) {
		t.Fatalf("overflow page status=%d body=%s", overflowPage.Code, overflowPage.Body.String())
	}
	for _, body := range []string{
		fmt.Sprintf(`{"name":%q,"channel":"sms","reason":"test reason"}`, campaignName),
		fmt.Sprintf(`{"name":"x","channel":"email","reason":"valid reason"}`),
		fmt.Sprintf(`{"name":%q,"channel":"email","reason":"x"}`, campaignName),
		fmt.Sprintf(`{"name":%q,"channel":"email","reason":"valid reason","scheduleStart":"bad-date"}`, campaignName),
		fmt.Sprintf(`{"name":%q,"channel":"email","reason":"valid reason","scheduleStart":%q,"scheduleEnd":%q}`, campaignName, end, start),
		fmt.Sprintf(`{"name":%q,"channel":"email","reason":"valid reason","scheduleStart":%q,"scheduleEnd":%q}`, campaignName, start, start),
	} {
		if got := call(http.MethodPost, "/api/admin/growth/campaigns", body).Code; got != http.StatusBadRequest {
			t.Fatalf("invalid campaign status=%d body=%s", got, body)
		}
	}
}

func TestAdminStreakAndGrowthCampaignMutationsRollbackWhenAuditFails(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	ctx := context.Background()
	actorID := newUUID(t)
	streakName := "AUDIT-145 rollback streak " + actorID
	campaignName := "AUDIT-145 rollback campaign " + actorID
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, `DELETE FROM gamification.streak_config WHERE name=$1`, streakName)
		_, _ = db.Exec(ctx, `DELETE FROM growth.growth_campaign WHERE name=$1`, campaignName)
	})
	for _, tc := range []struct{ action, method, path, body string }{
		{"admin.gamification.streak.created", http.MethodPost, "/api/admin/gamification/streaks", fmt.Sprintf(`{"name":%q,"activityType":"review","minActionsPerDay":1}`, streakName)},
		{"admin.growth.campaign.created", http.MethodPost, "/api/admin/growth/campaigns", fmt.Sprintf(`{"name":%q,"channel":"email","reason":"audit rollback"}`, campaignName)},
	} {
		actionActorID := newUUID(t)
		seedAdminActor(t, db, actionActorID, fmt.Sprintf("audit145-rollback-%s@example.com", actionActorID[:8]), "AUDIT-145 rollback")
		grantAdminPermission(t, db, actionActorID, "admin.content.write")
		grantAdminPermission(t, db, actionActorID, "admin.growth.read")
		grantAdminPermission(t, db, actionActorID, "growth.manage")
		token := createAdminSession(t, sessions, actionActorID)
		rejectCompanionAuditAction(t, db, actionActorID, tc.action)
		req := httptest.NewRequest(tc.method, tc.path, strings.NewReader(tc.body))
		req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		req.Header.Set("Origin", "http://localhost:3000")
		req.Header.Set("X-CSRF-Token", "test-csrf")
		req.Header.Set("Content-Type", "application/json")
		res := httptest.NewRecorder()
		srv.Config.Handler.ServeHTTP(res, req)
		if res.Code != http.StatusInternalServerError {
			t.Fatalf("%s status=%d body=%s; want 500", tc.action, res.Code, res.Body.String())
		}
	}
	for _, tc := range []struct{ table, name string }{{"gamification.streak_config", streakName}, {"growth.growth_campaign", campaignName}} {
		var count int
		if err := db.QueryRow(ctx, `SELECT count(*) FROM `+tc.table+` WHERE name=$1`, tc.name).Scan(&count); err != nil || count != 0 {
			t.Fatalf("%s count=%d err=%v after rejected audit", tc.table, count, err)
		}
	}

	streakID := newUUID(t)
	streakName = "AUDIT-145 existing streak " + actorID
	if _, err := db.Exec(ctx, `INSERT INTO gamification.streak_config (id,name,activity_type,min_actions_per_day,freezes_allowed,enabled,created_at,updated_at) VALUES ($1,$2,'review',1,0,true,NOW(),NOW())`, streakID, streakName); err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct{ action, method, body string }{
		{"admin.gamification.streak.updated", http.MethodPut, fmt.Sprintf(`{"name":%q,"activityType":"quiz","minActionsPerDay":2}`, streakName)},
		{"admin.gamification.streak.deleted", http.MethodDelete, ""},
	} {
		actionActorID := newUUID(t)
		seedAdminActor(t, db, actionActorID, fmt.Sprintf("audit145-rollback-%s@example.com", actionActorID[:8]), "AUDIT-145 rollback")
		grantAdminPermission(t, db, actionActorID, "admin.content.write")
		token := createAdminSession(t, sessions, actionActorID)
		rejectCompanionAuditAction(t, db, actionActorID, tc.action)
		req := httptest.NewRequest(tc.method, "/api/admin/gamification/streaks/"+streakID, strings.NewReader(tc.body))
		req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		req.Header.Set("Origin", "http://localhost:3000")
		req.Header.Set("X-CSRF-Token", "test-csrf")
		if tc.body != "" {
			req.Header.Set("Content-Type", "application/json")
		}
		res := httptest.NewRecorder()
		srv.Config.Handler.ServeHTTP(res, req)
		if res.Code != http.StatusInternalServerError {
			t.Fatalf("%s status=%d body=%s; want 500", tc.action, res.Code, res.Body.String())
		}
		var persistedName string
		if err := db.QueryRow(ctx, `SELECT name FROM gamification.streak_config WHERE id=$1`, streakID).Scan(&persistedName); err != nil || persistedName != streakName {
			t.Fatalf("%s left name=%q err=%v; want row restored", tc.action, persistedName, err)
		}
	}
}

func TestAdminGrowthCampaignListReturnsServerErrorWhenDatabaseIsClosed(t *testing.T) {
	db := testPool(t)
	db.Close()
	res := httptest.NewRecorder()
	adminGrowthCampaignsListHandler(db, testLogger()).ServeHTTP(res, httptest.NewRequest(http.MethodGet, "/api/admin/growth/campaigns", nil))
	if res.Code != http.StatusInternalServerError {
		t.Fatalf("status=%d body=%s; want 500", res.Code, res.Body.String())
	}
}
