package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestAdminGrowthCampaignTransitionRulesAUDIT146(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	actorID, campaignID := newUUID(t), newUUID(t)
	seedAdminActor(t, db, actorID, fmt.Sprintf("audit146-transition-%s@example.com", actorID[:8]), "AUDIT-146 transition")
	grantAdminPermission(t, db, actorID, "growth.manage")
	token := createAdminSession(t, sessions, actorID)
	if _, err := db.Exec(context.Background(), `INSERT INTO growth.growth_campaign (id,name,channel,status,created_at,updated_at) VALUES ($1,'AUDIT-146 archived','in_app','archived',now(),now())`, campaignID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM growth.growth_campaign WHERE id=$1`, campaignID)
	})
	for _, action := range []string{"activate", "schedule"} {
		req := httptest.NewRequest(http.MethodPost, "/api/admin/growth/campaigns/"+campaignID+"/"+action, strings.NewReader(`{"reason":"audit146 invalid transition"}`))
		req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		req.Header.Set("Origin", "http://localhost:3000")
		req.Header.Set("X-CSRF-Token", "test-csrf")
		res := httptest.NewRecorder()
		srv.Config.Handler.ServeHTTP(res, req)
		if res.Code != http.StatusBadRequest {
			t.Fatalf("archived campaign %s status=%d body=%s; want 400", action, res.Code, res.Body.String())
		}
	}
}

func TestValidateGrowthPostcardConfigAUDIT146(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, fmt.Sprintf("audit146-config-%s@example.com", actorID[:8]), "AUDIT-146 config")
	grantAdminPermission(t, db, actorID, "growth.manage")
	token := createAdminSession(t, sessions, actorID)
	slug := "audit146_invalid_" + strings.ReplaceAll(actorID, "-", "")
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM growth.share_template WHERE slug LIKE $1`, slug+"%")
	})
	for _, config := range []string{
		`{"surface":"social","name":"Invalid","bodyTemplate":"Hi","privacyClass":"anonymized"}`,
		`{"surface":"postcard","name":"Invalid","bodyTemplate":123,"privacyClass":"anonymized"}`,
		`{"surface":"postcard","name":"Invalid","bodyTemplate":"Hi","variables":"bad","privacyClass":"anonymized"}`,
		`{"surface":"postcard","name":"Invalid","bodyTemplate":"Hi","privacyClass":123}`,
	} {
		body := fmt.Sprintf(`{"slug":%q,"kind":"streak","config":%s,"reason":"audit146 invalid config"}`, slug+fmt.Sprint(len(config)), config)
		req := httptest.NewRequest(http.MethodPost, "/api/admin/growth/postcards", strings.NewReader(body))
		req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		req.Header.Set("Origin", "http://localhost:3000")
		req.Header.Set("X-CSRF-Token", "test-csrf")
		req.Header.Set("Content-Type", "application/json")
		res := httptest.NewRecorder()
		srv.Config.Handler.ServeHTTP(res, req)
		if res.Code != http.StatusBadRequest {
			t.Fatalf("invalid postcard config accepted status=%d body=%s config=%s", res.Code, res.Body.String(), config)
		}
	}
}

func TestGrowthPostcardPrivacyClassAcceptsAnonymizedAUDIT146(t *testing.T) {
	if err := assertPostcardPrivacy(json.RawMessage(`{"privacyClass":"anonymized"}`), false); err != nil {
		t.Fatalf("anonymized is a supported template privacy class: %v", err)
	}
}

func TestGrowthPostcardKindsIncludeAdminFormOptionsAUDIT146(t *testing.T) {
	for _, expected := range []string{"streak", "level_up", "bjt_pass", "battle_win", "daily_phrase", "bjt_result"} {
		found := false
		for _, actual := range growthPostcardKinds {
			found = found || actual == expected
		}
		if !found {
			t.Fatalf("postcard API does not accept UI kind: %s", expected)
		}
	}
}

func TestAdminGrowthPostcardsRequireGrowthReadPermissionAUDIT146(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, fmt.Sprintf("audit146-read-%s@example.com", actorID[:8]), "AUDIT-146 roleless")
	token := createAdminSession(t, sessions, actorID)
	req := httptest.NewRequest(http.MethodGet, "/api/admin/growth/postcards", nil)
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
	res := httptest.NewRecorder()
	srv.Config.Handler.ServeHTTP(res, req)
	if res.Code != http.StatusForbidden {
		t.Fatalf("roleless postcard list status=%d body=%s; want 403", res.Code, res.Body.String())
	}
	postcardSlug := "audit146_denied_" + strings.ReplaceAll(actorID, "-", "")
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM growth.share_template WHERE slug=$1`, postcardSlug)
	})
	writeReq := httptest.NewRequest(http.MethodPost, "/api/admin/growth/postcards", strings.NewReader(fmt.Sprintf(`{"slug":%q,"kind":"postcard_achievement","config":{},"reason":"audit denied"}`, postcardSlug)))
	writeReq.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
	writeReq.Header.Set("Origin", "http://localhost:3000")
	writeReq.Header.Set("X-CSRF-Token", "test-csrf")
	writeReq.Header.Set("Content-Type", "application/json")
	writeRes := httptest.NewRecorder()
	srv.Config.Handler.ServeHTTP(writeRes, writeReq)
	if writeRes.Code != http.StatusForbidden {
		t.Fatalf("roleless postcard create status=%d body=%s; want 403", writeRes.Code, writeRes.Body.String())
	}
	grantAdminPermission(t, db, actorID, "admin.growth.read")
	readReq := httptest.NewRequest(http.MethodGet, "/api/admin/growth/postcards", nil)
	readReq.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
	readRes := httptest.NewRecorder()
	srv.Config.Handler.ServeHTTP(readRes, readReq)
	if readRes.Code != http.StatusOK {
		t.Fatalf("growth-read postcard list status=%d body=%s; want 200", readRes.Code, readRes.Body.String())
	}
	writeReq = httptest.NewRequest(http.MethodPost, "/api/admin/growth/postcards", strings.NewReader(fmt.Sprintf(`{"slug":%q,"kind":"postcard_achievement","config":{},"reason":"audit denied"}`, postcardSlug)))
	writeReq.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
	writeReq.Header.Set("Origin", "http://localhost:3000")
	writeReq.Header.Set("X-CSRF-Token", "test-csrf")
	writeReq.Header.Set("Content-Type", "application/json")
	writeRes = httptest.NewRecorder()
	srv.Config.Handler.ServeHTTP(writeRes, writeReq)
	if writeRes.Code != http.StatusForbidden {
		t.Fatalf("growth-read only postcard create status=%d body=%s; want 403", writeRes.Code, writeRes.Body.String())
	}
}

func TestAdminGrowthCampaignAndPostcardAPIsAUDIT146(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	ctx := context.Background()
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, fmt.Sprintf("audit146-write-%s@example.com", actorID[:8]), "AUDIT-146 writer")
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

	campaignID := newUUID(t)
	campaignName := "AUDIT-146 campaign " + actorID
	postcardSlug := "audit146_" + strings.ReplaceAll(actorID, "-", "")
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, `DELETE FROM ops.admin_audit_log WHERE target_id=$1 OR target_id IN (SELECT id::text FROM growth.share_template WHERE slug=$2)`, campaignID, postcardSlug)
		_, _ = db.Exec(ctx, `DELETE FROM growth.growth_campaign WHERE id=$1 OR name LIKE $2`, campaignID, campaignName+"%")
		_, _ = db.Exec(ctx, `DELETE FROM growth.share_template WHERE slug=$1`, postcardSlug)
	})
	if _, err := db.Exec(ctx, `INSERT INTO growth.growth_campaign (id,name,channel,status,schedule_start,schedule_end,created_at,updated_at) VALUES ($1,$2,'in_app','draft',now()+interval '1 day',now()+interval '2 days',now(),now())`, campaignID, campaignName); err != nil {
		t.Fatal(err)
	}
	var duplicateID string
	for _, tc := range []struct{ method, path, body string }{
		{http.MethodGet, "/api/admin/growth/campaigns/audience-estimate?locale=vi&level=BJT-J2", ""},
		{http.MethodGet, "/api/admin/growth/campaigns/" + campaignID, ""},
		{http.MethodPatch, "/api/admin/growth/campaigns/" + campaignID, `{"name":"AUDIT-146 campaign updated","reason":"audit146 patch"}`},
		{http.MethodPost, "/api/admin/growth/campaigns/" + campaignID + "/schedule", `{"reason":"audit146 schedule"}`},
		{http.MethodPost, "/api/admin/growth/campaigns/" + campaignID + "/activate", `{"reason":"audit146 activate"}`},
		{http.MethodPost, "/api/admin/growth/campaigns/" + campaignID + "/end", `{"reason":"audit146 end"}`},
		{http.MethodPost, "/api/admin/growth/campaigns/" + campaignID + "/archive", `{"reason":"audit146 archive"}`},
		{http.MethodPost, "/api/admin/growth/campaigns/" + campaignID + "/duplicate", `{"reason":"audit146 duplicate"}`},
	} {
		res := call(tc.method, tc.path, tc.body)
		if res.Code != http.StatusOK {
			t.Fatalf("%s %s status=%d body=%s; want 200", tc.method, tc.path, res.Code, res.Body.String())
		}
		if strings.Contains(tc.path, "audience-estimate") {
			var response struct {
				Total   int               `json:"total"`
				Filters map[string]string `json:"filters"`
			}
			if err := json.Unmarshal(res.Body.Bytes(), &response); err != nil || response.Filters["locale"] != "vi" || response.Filters["level"] != "BJT-J2" {
				t.Fatalf("audience estimate=%s err=%v; filters not honored", res.Body.String(), err)
			}
		}
		if strings.HasSuffix(tc.path, campaignID) && tc.method == http.MethodGet {
			var response struct {
				ID string `json:"id"`
			}
			if err := json.Unmarshal(res.Body.Bytes(), &response); err != nil || response.ID != campaignID {
				t.Fatalf("campaign detail=%s err=%v", res.Body.String(), err)
			}
		}
		if tc.method == http.MethodPatch {
			var response struct {
				Name string `json:"name"`
			}
			if err := json.Unmarshal(res.Body.Bytes(), &response); err != nil || response.Name != "AUDIT-146 campaign updated" {
				t.Fatalf("campaign patch=%s err=%v", res.Body.String(), err)
			}
		}
		if tc.method == http.MethodPost && strings.HasPrefix(tc.path, "/api/admin/growth/campaigns/"+campaignID+"/") && !strings.HasSuffix(tc.path, "/duplicate") {
			expected := strings.TrimPrefix(tc.path, "/api/admin/growth/campaigns/"+campaignID+"/")
			statuses := map[string]string{"schedule": "scheduled", "activate": "active", "end": "ended", "archive": "archived"}
			var response struct {
				Status string `json:"status"`
			}
			if err := json.Unmarshal(res.Body.Bytes(), &response); err != nil || response.Status != statuses[expected] {
				t.Fatalf("campaign transition %s=%s err=%v", expected, res.Body.String(), err)
			}
		}
		if strings.HasSuffix(tc.path, "/duplicate") {
			var response struct {
				ID     string `json:"id"`
				Name   string `json:"name"`
				Status string `json:"status"`
			}
			if err := json.Unmarshal(res.Body.Bytes(), &response); err != nil || response.ID == "" || response.Name != "AUDIT-146 campaign updated (copy)" || response.Status != "draft" {
				t.Fatalf("campaign duplicate=%s err=%v", res.Body.String(), err)
			}
			duplicateID = response.ID
		}
	}
	if res := call(http.MethodGet, "/api/admin/growth/campaigns/audience-estimate?country=JP", ""); res.Code != http.StatusBadRequest {
		t.Fatalf("unsupported country estimate status=%d body=%s; want 400", res.Code, res.Body.String())
	}
	postcardList := call(http.MethodGet, "/api/admin/growth/postcards?page=1&pageSize=10", "")
	if postcardList.Code != http.StatusOK {
		t.Fatalf("postcard list status=%d body=%s; want 200", postcardList.Code, postcardList.Body.String())
	}

	created := call(http.MethodPost, "/api/admin/growth/postcards", fmt.Sprintf(`{"slug":%q,"kind":"postcard_achievement","config":{"surface":"postcard","name":"AUDIT-146 postcard","bodyTemplate":"Achievement unlocked","privacyClass":"learner_private","noPiiVerified":false},"reason":"audit146 create"}`, postcardSlug))
	if created.Code != http.StatusCreated {
		t.Fatalf("postcard create status=%d body=%s; want 201", created.Code, created.Body.String())
	}
	var postcard struct{ ID, Slug, Kind string }
	if err := json.Unmarshal(created.Body.Bytes(), &postcard); err != nil || postcard.ID == "" || postcard.Slug != postcardSlug || postcard.Kind != "postcard_achievement" {
		t.Fatalf("postcard contract=%s err=%v", created.Body.String(), err)
	}
	var auditCount int
	if err := db.QueryRow(ctx, `SELECT count(*) FROM ops.admin_audit_log WHERE target_id=$1 AND actor_id=$2 AND action='admin.growth.postcard_template.created'`, postcard.ID, actorID).Scan(&auditCount); err != nil || auditCount != 1 {
		t.Fatalf("postcard audit count=%d err=%v", auditCount, err)
	}
	postcardList = call(http.MethodGet, "/api/admin/growth/postcards?page=1&pageSize=10&q="+postcardSlug, "")
	if postcardList.Code != http.StatusOK || !strings.Contains(postcardList.Body.String(), postcard.ID) {
		t.Fatalf("postcard list after create status=%d body=%s; want created row", postcardList.Code, postcardList.Body.String())
	}
	for action, target := range map[string]string{
		"admin.growth.campaign.updated":    campaignID,
		"admin.growth.campaign.scheduled":  campaignID,
		"admin.growth.campaign.active":     campaignID,
		"admin.growth.campaign.ended":      campaignID,
		"admin.growth.campaign.archived":   campaignID,
		"admin.growth.campaign.duplicated": duplicateID,
	} {
		if err := db.QueryRow(ctx, `SELECT count(*) FROM ops.admin_audit_log WHERE target_id=$1 AND actor_id=$2 AND action=$3`, target, actorID, action).Scan(&auditCount); err != nil || auditCount != 1 {
			t.Fatalf("campaign audit action=%s target=%s count=%d err=%v", action, target, auditCount, err)
		}
	}
}

func TestAdminGrowthCampaignPatchClearsScheduleDatesAUDIT146(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	ctx := context.Background()
	actorID, campaignID := newUUID(t), newUUID(t)
	seedAdminActor(t, db, actorID, fmt.Sprintf("audit146-schedule-%s@example.com", actorID[:8]), "AUDIT-146 schedule editor")
	grantAdminPermission(t, db, actorID, "growth.manage")
	token := createAdminSession(t, sessions, actorID)
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, `DELETE FROM ops.admin_audit_log WHERE target_id=$1`, campaignID)
		_, _ = db.Exec(ctx, `DELETE FROM growth.growth_campaign WHERE id=$1`, campaignID)
	})
	if _, err := db.Exec(ctx, `INSERT INTO growth.growth_campaign (id,name,channel,status,schedule_start,schedule_end,created_at,updated_at)
		VALUES ($1,'AUDIT-146 scheduled campaign','email','draft',now()+interval '1 day',now()+interval '2 days',now(),now())`, campaignID); err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodPatch, "/api/admin/growth/campaigns/"+campaignID,
		strings.NewReader(`{"scheduleStart":null,"scheduleEnd":null,"reason":"AUDIT-146 clear schedule"}`))
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("X-CSRF-Token", "test-csrf")
	req.Header.Set("Content-Type", "application/json")
	res := httptest.NewRecorder()
	srv.Config.Handler.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("schedule dates were not cleared: status=%d body=%s", res.Code, res.Body.String())
	}
	var schedule struct {
		ScheduleStart *string `json:"scheduleStart"`
		ScheduleEnd   *string `json:"scheduleEnd"`
	}
	if err := json.Unmarshal(res.Body.Bytes(), &schedule); err != nil {
		t.Fatal(err)
	}
	var start, end *string
	if err := db.QueryRow(ctx, `SELECT schedule_start::text,schedule_end::text FROM growth.growth_campaign WHERE id=$1`, campaignID).Scan(&start, &end); err != nil {
		t.Fatal(err)
	}
	if schedule.ScheduleStart != nil || schedule.ScheduleEnd != nil || start != nil || end != nil {
		t.Fatalf("schedule dates were not cleared: response=%s database_start=%v database_end=%v", res.Body.String(), start, end)
	}
}

func TestAdminGrowthAudienceEstimateDefaultsNoSubscriptionToFreeAUDIT146(t *testing.T) {
	db := testPool(t)
	ctx := context.Background()
	freeLearnerID, paidLearnerID, paidPlanID := newUUID(t), newUUID(t), newUUID(t)
	locale := "a146" + freeLearnerID[:8]
	paidPlanSlug := "audit146-" + paidLearnerID[:8]
	if _, err := db.Exec(ctx, `INSERT INTO monetization.plan (id,slug,name_key,status,sort_order,config,updated_at)
		VALUES ($1,$2,'audit146.paid','active',99,'{}'::jsonb,now())`, paidPlanID, paidPlanSlug); err != nil {
		t.Fatalf("seed paid plan: %v", err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO profile.user_profile
		(id,display_name,email,status,ui_locale,target_bjt_band,updated_at)
		VALUES ($1,'AUDIT-146 free learner',$2,'active',$4,'BJT-J2',now()),
		       ($3,'AUDIT-146 paid learner',$5,'active',$4,'BJT-J2',now())`,
		freeLearnerID, "audit146-free-"+freeLearnerID[:8]+"@example.test", paidLearnerID,
		locale, "audit146-paid-"+paidLearnerID[:8]+"@example.test"); err != nil {
		t.Fatalf("seed audience learners: %v", err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO monetization.user_subscription
		(user_id,plan_id,status,current_period_start,updated_at) VALUES ($1,$2,'active',now(),now())`, paidLearnerID, paidPlanID); err != nil {
		t.Fatalf("seed paid learner subscription: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, `DELETE FROM monetization.user_subscription WHERE user_id=$1`, paidLearnerID)
		_, _ = db.Exec(ctx, `DELETE FROM profile.user_profile WHERE id IN ($1,$2)`, freeLearnerID, paidLearnerID)
		_, _ = db.Exec(ctx, `DELETE FROM monetization.plan WHERE id=$1`, paidPlanID)
	})

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet,
		"/api/admin/growth/campaigns/audience-estimate?locale="+locale+"&level=BJT-J2&plan=free", nil)
	adminGrowthCampaignsAudienceEstimateHandler(db, slog.Default()).ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("audience estimate status=%d body=%s", recorder.Code, recorder.Body.String())
	}
	var response struct {
		Total int `json:"total"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if response.Total != 1 {
		t.Fatalf("default free-plan learner was omitted: got total=%d, want 1", response.Total)
	}
}

func TestAdminGrowthCampaignMutationsRequireAuditReasonAUDIT146(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	ctx := context.Background()
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, fmt.Sprintf("audit146-reason-%s@example.com", actorID[:8]), "AUDIT-146 reason")
	grantAdminPermission(t, db, actorID, "growth.manage")
	token := createAdminSession(t, sessions, actorID)
	campaignIDs := make([]string, 5)
	for i := range campaignIDs {
		campaignIDs[i] = newUUID(t)
		if _, err := db.Exec(ctx, `INSERT INTO growth.growth_campaign (id,name,channel,status,created_at,updated_at) VALUES ($1,$2,'in_app','draft',now(),now())`, campaignIDs[i], fmt.Sprintf("AUDIT-146 reason %d %s", i, actorID)); err != nil {
			t.Fatal(err)
		}
	}
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, `DELETE FROM ops.admin_audit_log WHERE target_id IN (SELECT id::text FROM growth.growth_campaign WHERE name LIKE $1)`, "AUDIT-146 reason %"+actorID+"%")
		_, _ = db.Exec(ctx, `DELETE FROM growth.growth_campaign WHERE name LIKE $1`, "AUDIT-146 reason %"+actorID+"%")
	})
	cases := []struct{ method, path, body string }{
		{http.MethodPatch, "/api/admin/growth/campaigns/" + campaignIDs[0], `{"name":"Valid name"}`},
		{http.MethodPost, "/api/admin/growth/campaigns/" + campaignIDs[1] + "/schedule", `{}`},
		{http.MethodPost, "/api/admin/growth/campaigns/" + campaignIDs[2] + "/activate", `{}`},
		{http.MethodPost, "/api/admin/growth/campaigns/" + campaignIDs[3] + "/end", `{}`},
		{http.MethodPost, "/api/admin/growth/campaigns/" + campaignIDs[4] + "/archive", `{}`},
		{http.MethodPost, "/api/admin/growth/campaigns/" + campaignIDs[0] + "/duplicate", `{}`},
	}
	var failures []string
	for _, tc := range cases {
		req := httptest.NewRequest(tc.method, tc.path, strings.NewReader(tc.body))
		req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		req.Header.Set("Origin", "http://localhost:3000")
		req.Header.Set("X-CSRF-Token", "test-csrf")
		req.Header.Set("Content-Type", "application/json")
		res := httptest.NewRecorder()
		srv.Config.Handler.ServeHTTP(res, req)
		if res.Code != http.StatusBadRequest {
			failures = append(failures, fmt.Sprintf("%s %s status=%d body=%s", tc.method, tc.path, res.Code, res.Body.String()))
		}
	}
	if len(failures) != 0 {
		t.Fatalf("mutations without an audit reason must be rejected: %s", strings.Join(failures, "; "))
	}
}

func TestAdminGrowthCampaignDetailReturnsServerErrorWhenDatabaseIsClosedAUDIT146(t *testing.T) {
	db := testPool(t)
	db.Close()
	res := httptest.NewRecorder()
	adminGrowthCampaignsDetailHandler(db, testLogger()).ServeHTTP(res,
		httptest.NewRequest(http.MethodGet, "/api/admin/growth/campaigns/00000000-0000-4000-8000-000000000001", nil))
	if res.Code != http.StatusInternalServerError {
		t.Fatalf("detail status=%d body=%s; want 500 for database failure", res.Code, res.Body.String())
	}
}

func TestAdminGrowthCampaignAndPostcardMutationsRollbackWhenAuditFailsAUDIT146(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	ctx := context.Background()
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, fmt.Sprintf("audit146-rollback-%s@example.com", actorID[:8]), "AUDIT-146 rollback")
	grantAdminPermission(t, db, actorID, "growth.manage")
	token := createAdminSession(t, sessions, actorID)
	campaignID := newUUID(t)
	campaignName := "AUDIT-146 rollback " + actorID
	postcardSlug := "audit146_rb_" + strings.ReplaceAll(actorID, "-", "")
	if _, err := db.Exec(ctx, `INSERT INTO growth.growth_campaign (id,name,channel,status,schedule_start,schedule_end,created_at,updated_at) VALUES ($1,$2,'in_app','draft',now()+interval '1 day',now()+interval '2 days',now(),now())`, campaignID, campaignName); err != nil {
		t.Fatal(err)
	}
	triggerName := "audit146_reject_" + strings.ReplaceAll(actorID, "-", "")
	functionName := triggerName + "_fn"
	if _, err := db.Exec(ctx, fmt.Sprintf(`CREATE FUNCTION public.%s() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.actor_id='%s'::uuid AND NEW.action IN ('admin.growth.campaign.updated','admin.growth.campaign.scheduled','admin.growth.campaign.duplicated','admin.growth.postcard_template.created') THEN RAISE EXCEPTION 'injected AUDIT-146 failure'; END IF;
  RETURN NEW;
END $$`, functionName, actorID)); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `CREATE TRIGGER `+triggerName+` BEFORE INSERT ON ops.admin_audit_log FOR EACH ROW EXECUTE FUNCTION public.`+functionName+`() `); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, `DROP TRIGGER IF EXISTS `+triggerName+` ON ops.admin_audit_log`)
		_, _ = db.Exec(ctx, `DROP FUNCTION IF EXISTS public.`+functionName+`() `)
		_, _ = db.Exec(ctx, `DELETE FROM ops.admin_audit_log WHERE target_id=$1 OR target_id IN (SELECT id::text FROM growth.share_template WHERE slug=$2)`, campaignID, postcardSlug)
		_, _ = db.Exec(ctx, `DELETE FROM growth.growth_campaign WHERE id=$1 OR name LIKE $2`, campaignID, campaignName+"%")
		_, _ = db.Exec(ctx, `DELETE FROM growth.share_template WHERE slug=$1`, postcardSlug)
	})
	call := func(method, path, body string) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		req.Header.Set("Origin", "http://localhost:3000")
		req.Header.Set("X-CSRF-Token", "test-csrf")
		req.Header.Set("Content-Type", "application/json")
		res := httptest.NewRecorder()
		srv.Config.Handler.ServeHTTP(res, req)
		return res
	}
	cases := []struct{ method, path, body string }{
		{http.MethodPatch, "/api/admin/growth/campaigns/" + campaignID, `{"name":"Changed campaign","reason":"audit rollback"}`},
		{http.MethodPost, "/api/admin/growth/campaigns/" + campaignID + "/schedule", `{"reason":"audit rollback"}`},
		{http.MethodPost, "/api/admin/growth/campaigns/" + campaignID + "/duplicate", `{"reason":"audit rollback"}`},
		{http.MethodPost, "/api/admin/growth/postcards", fmt.Sprintf(`{"slug":%q,"kind":"postcard_achievement","config":{"surface":"postcard","name":"Rollback postcard","bodyTemplate":"Achievement unlocked","privacyClass":"learner_private"},"reason":"audit rollback"}`, postcardSlug)},
	}
	for _, tc := range cases {
		if res := call(tc.method, tc.path, tc.body); res.Code != http.StatusInternalServerError {
			t.Fatalf("%s %s status=%d body=%s; want 500 when audit fails", tc.method, tc.path, res.Code, res.Body.String())
		}
	}
	var name, status string
	if err := db.QueryRow(ctx, `SELECT name,status FROM growth.growth_campaign WHERE id=$1`, campaignID).Scan(&name, &status); err != nil || name != campaignName || status != "draft" {
		t.Fatalf("campaign after audit failures=(%q,%q), err=%v; want original row", name, status, err)
	}
	var duplicateCount, postcardCount int
	if err := db.QueryRow(ctx, `SELECT count(*) FROM growth.growth_campaign WHERE name LIKE $1`, campaignName+"%").Scan(&duplicateCount); err != nil || duplicateCount != 1 {
		t.Fatalf("campaigns after failed duplicate=%d err=%v; want only source", duplicateCount, err)
	}
	if err := db.QueryRow(ctx, `SELECT count(*) FROM growth.share_template WHERE slug=$1`, postcardSlug).Scan(&postcardCount); err != nil || postcardCount != 0 {
		t.Fatalf("postcards after failed create=%d err=%v; want 0", postcardCount, err)
	}
}
