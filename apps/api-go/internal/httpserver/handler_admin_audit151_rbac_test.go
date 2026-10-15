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

func TestAudit151AdminGrowthI18nAndIAMRoutesRequirePermissions(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, fmt.Sprintf("audit151-roleless-%s@example.com", actorID[:8]), "AUDIT-151 roleless")
	token := createAdminSession(t, sessions, actorID)
	resourceID := newUUID(t)
	uniqueSlug := "audit151_" + strings.ReplaceAll(actorID, "-", "")
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM growth.share_template WHERE slug=$1`, uniqueSlug)
	})

	tests := []struct{ method, path, body string }{
		{http.MethodGet, "/api/admin/growth/postcards/" + resourceID, ""},
		{http.MethodPatch, "/api/admin/growth/postcards/" + resourceID, `{"name":"x","reason":"audit151"}`},
		{http.MethodPost, "/api/admin/growth/postcards/" + resourceID + "/archive", `{"reason":"audit151"}`},
		{http.MethodPost, "/api/admin/growth/postcards/" + resourceID + "/publish", `{"reason":"audit151"}`},
		{http.MethodGet, "/api/admin/growth/referrals", ""},
		{http.MethodGet, "/api/admin/growth/referrals/" + resourceID, ""},
		{http.MethodPost, "/api/admin/growth/referrals/" + resourceID + "/revoke", `{"reason":"audit151"}`},
		{http.MethodGet, "/api/admin/growth/social/events", ""},
		{http.MethodPost, "/api/admin/growth/social/events/" + resourceID + "/moderate", `{"action":"dismiss","reason":"audit151"}`},
		{http.MethodGet, "/api/admin/growth/social/templates", ""},
		{http.MethodPost, "/api/admin/growth/social/templates", fmt.Sprintf(`{"slug":%q,"kind":"achievement","config":{"privacyClass":"anonymized"},"reason":"audit151"}`, uniqueSlug)},
		{http.MethodGet, "/api/admin/growth/social/templates/" + resourceID, ""},
		{http.MethodPatch, "/api/admin/growth/social/templates/" + resourceID, `{"config":{"privacyClass":"anonymized"},"reason":"audit151"}`},
		{http.MethodPost, "/api/admin/growth/social/templates/" + resourceID + "/archive", `{"reason":"audit151"}`},
		{http.MethodPost, "/api/admin/growth/social/templates/" + resourceID + "/publish", `{"reason":"audit151"}`},
		{http.MethodPatch, "/api/admin/i18n/keys/9223372036854775807/translation", `{"locale":"vi","value":"audit151"}`},
		{http.MethodGet, "/api/admin/iam/admins/" + resourceID, ""},
		{http.MethodPatch, "/api/admin/iam/admins/" + resourceID, `{"displayName":"unauthorized"}`},
		{http.MethodPost, "/api/admin/iam/admins/" + resourceID + "/roles", `{"roleCode":"viewer","reason":"audit151"}`},
		{http.MethodDelete, "/api/admin/iam/admins/" + resourceID + "/roles/viewer", `{"reason":"audit151"}`},
	}
	for _, tc := range tests {
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
				t.Fatalf("roleless authenticated Admin received %s %s: status=%d body=%s; want 403", tc.method, tc.path, res.Code, res.Body.String())
			}
		})
	}
}

func TestAudit151AdminI18nContractsAUDIT151(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	ctx := context.Background()
	actorID, keyID := newUUID(t), ""
	seedAdminActor(t, db, actorID, fmt.Sprintf("audit151-i18n-%s@example.com", actorID[:8]), "AUDIT-151 i18n")
	grantAdminPermission(t, db, actorID, "admin.content.write")
	token := createAdminSession(t, sessions, actorID)
	key := "audit151." + strings.ReplaceAll(actorID, "-", "")
	if err := db.QueryRow(ctx, `INSERT INTO l10n.translation_key (namespace,key,description,created_at,updated_at) VALUES ('audit151',$1,'temporary audit key',now(),now()) RETURNING id::text`, key).Scan(&keyID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, `DELETE FROM ops.admin_audit_log WHERE target_id=$1`, keyID)
		_, _ = db.Exec(ctx, `DELETE FROM l10n.translation_key WHERE id=$1`, keyID)
	})
	if _, err := db.Exec(ctx, `INSERT INTO l10n.translation_value (key_id,locale_code,value,updated_at) VALUES ($1,'vi','Bản cũ',now())`, keyID); err != nil {
		t.Fatal(err)
	}
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
	list := call(http.MethodGet, "/api/admin/i18n/keys?page=1&pageSize=50", "")
	if list.Code != http.StatusOK {
		t.Fatalf("i18n list status=%d body=%s; want 200", list.Code, list.Body.String())
	}
	var page struct {
		Items []struct {
			ID     string             `json:"id"`
			Values map[string]*string `json:"values"`
			Status map[string]string  `json:"status"`
			Key    string             `json:"key"`
		} `json:"items"`
		Total int `json:"total"`
	}
	if err := json.Unmarshal(list.Body.Bytes(), &page); err != nil {
		t.Fatalf("decode i18n list: %v body=%s", err, list.Body.String())
	}
	found := false
	for _, item := range page.Items {
		if item.ID == keyID {
			found = item.Key == key && item.Values["vi"] != nil && *item.Values["vi"] == "Bản cũ" && item.Status["vi"] == "translated" && item.Status["ja"] == "missing"
		}
	}
	if !found {
		t.Fatalf("i18n list omitted or malformed fixture: %s", list.Body.String())
	}
	detail := call(http.MethodGet, "/api/admin/i18n/keys/"+keyID, "")
	if detail.Code != http.StatusOK || !strings.Contains(detail.Body.String(), `"vi":"Bản cũ"`) {
		t.Fatalf("i18n detail status=%d body=%s", detail.Code, detail.Body.String())
	}
	pending := call(http.MethodGet, "/api/admin/i18n/pending", "")
	if pending.Code != http.StatusOK {
		t.Fatalf("i18n pending status=%d body=%s; want 200", pending.Code, pending.Body.String())
	}
	patched := call(http.MethodPatch, "/api/admin/i18n/keys/"+keyID+"/translation", `{"locale":"vi","value":"Bản mới","reason":"audit151 update"}`)
	if patched.Code != http.StatusOK || !strings.Contains(patched.Body.String(), `"vi":"Bản mới"`) {
		t.Fatalf("i18n translation patch status=%d body=%s", patched.Code, patched.Body.String())
	}
	var stored string
	if err := db.QueryRow(ctx, `SELECT value FROM l10n.translation_value WHERE key_id=$1 AND locale_code='vi'`, keyID).Scan(&stored); err != nil || stored != "Bản mới" {
		t.Fatalf("persisted translation=%q err=%v", stored, err)
	}
	var audits int
	if err := db.QueryRow(ctx, `SELECT count(*) FROM ops.admin_audit_log WHERE target_id=$1 AND actor_id=$2 AND action='admin.i18n.translation.updated'`, keyID, actorID).Scan(&audits); err != nil || audits != 1 {
		t.Fatalf("translation audit count=%d err=%v", audits, err)
	}
}

func TestAudit151SocialEventsListUsesPersistedContractAUDIT151(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, fmt.Sprintf("audit151-social-%s@example.com", actorID[:8]), "AUDIT-151 social")
	grantAdminPermission(t, db, actorID, "admin.growth.read")
	token := createAdminSession(t, sessions, actorID)
	req := httptest.NewRequest(http.MethodGet, "/api/admin/growth/social/events?page=1&pageSize=10", nil)
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
	res := httptest.NewRecorder()
	srv.Config.Handler.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("social events status=%d body=%s; want 200", res.Code, res.Body.String())
	}
	var body struct {
		Items []json.RawMessage `json:"items"`
		Page  int               `json:"page"`
	}
	if err := json.Unmarshal(res.Body.Bytes(), &body); err != nil || body.Items == nil || body.Page != 1 {
		t.Fatalf("social events contract=%s err=%v", res.Body.String(), err)
	}
}

func TestAudit151PostcardArchiveRollsBackWithoutAuditAUDIT151(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	ctx := context.Background()
	actorID, postcardID := newUUID(t), newUUID(t)
	seedAdminActor(t, db, actorID, fmt.Sprintf("audit151-audit-%s@example.com", actorID[:8]), "AUDIT-151 audit rollback")
	grantAdminPermission(t, db, actorID, "growth.manage")
	token := createAdminSession(t, sessions, actorID)
	slug := "audit151_archive_" + strings.ReplaceAll(actorID, "-", "")
	functionName := "audit151_fail_audit_" + strings.ReplaceAll(actorID[:8], "-", "")
	triggerName := "audit151_fail_audit_" + strings.ReplaceAll(actorID[:8], "-", "")
	if _, err := db.Exec(ctx, `INSERT INTO growth.share_template (id,slug,kind,config,active,created_at,updated_at) VALUES ($1,$2,'postcard_achievement','{"privacyClass":"learner_private"}',true,now(),now())`, postcardID, slug); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, fmt.Sprintf(`CREATE FUNCTION public.%s() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.actor_id='%s'::uuid AND NEW.action='admin.growth.postcard_template.archived' THEN RAISE EXCEPTION 'injected AUDIT-151 failure'; END IF; RETURN NEW; END $$`, functionName, actorID)); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `CREATE TRIGGER `+triggerName+` BEFORE INSERT ON ops.admin_audit_log FOR EACH ROW EXECUTE FUNCTION public.`+functionName+`() `); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, `DROP TRIGGER IF EXISTS `+triggerName+` ON ops.admin_audit_log`)
		_, _ = db.Exec(ctx, `DROP FUNCTION IF EXISTS public.`+functionName+`() `)
		_, _ = db.Exec(ctx, `DELETE FROM ops.admin_audit_log WHERE target_id=$1`, postcardID)
		_, _ = db.Exec(ctx, `DELETE FROM growth.share_template WHERE id=$1`, postcardID)
	})
	req := httptest.NewRequest(http.MethodPost, "/api/admin/growth/postcards/"+postcardID+"/archive", strings.NewReader(`{"reason":"audit151 rollback"}`))
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("X-CSRF-Token", "test-csrf")
	req.Header.Set("Content-Type", "application/json")
	res := httptest.NewRecorder()
	srv.Config.Handler.ServeHTTP(res, req)
	if res.Code != http.StatusInternalServerError {
		t.Fatalf("archive status=%d body=%s; want 500 on audit failure", res.Code, res.Body.String())
	}
	var active bool
	if err := db.QueryRow(ctx, `SELECT active FROM growth.share_template WHERE id=$1`, postcardID).Scan(&active); err != nil || !active {
		t.Fatalf("postcard after failed audit active=%v err=%v; want unchanged", active, err)
	}
}

func TestAudit151ReferralListAndDetailMatchAdminScreenAUDIT151(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	ctx := context.Background()
	actorID, userID, referralID := newUUID(t), newUUID(t), newUUID(t)
	seedAdminActor(t, db, actorID, fmt.Sprintf("audit151-ref-%s@example.com", actorID[:8]), "AUDIT-151 referrals")
	grantAdminPermission(t, db, actorID, "admin.growth.read")
	token := createAdminSession(t, sessions, actorID)
	email := "audit151-user-" + userID[:8] + "@example.test"
	code := "a151" + strings.ReplaceAll(userID[:8], "-", "")
	if _, err := db.Exec(ctx, `INSERT INTO profile.user_profile (id,display_name,email,status,updated_at) VALUES ($1,'Audit learner',$2,'active',now())`, userID, email); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO growth.referral_code (id,user_id,code,created_at) VALUES ($1,$2,$3,now())`, referralID, userID, code); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO growth.referral_event (referrer_user_id,code,kind,payload,created_at) VALUES ($1,$2,'signup','{"source":"audit151"}',now())`, userID, code); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, `DELETE FROM growth.referral_event WHERE code=$1`, code)
		_, _ = db.Exec(ctx, `DELETE FROM growth.referral_code WHERE id=$1`, referralID)
		_, _ = db.Exec(ctx, `DELETE FROM profile.user_profile WHERE id=$1`, userID)
	})
	call := func(path string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		res := httptest.NewRecorder()
		srv.Config.Handler.ServeHTTP(res, req)
		return res
	}
	list := call("/api/admin/growth/referrals?page=1&pageSize=20&q=" + code)
	if list.Code != http.StatusOK {
		t.Fatalf("referral list status=%d body=%s", list.Code, list.Body.String())
	}
	var page struct {
		Items []struct {
			ID   string `json:"id"`
			User struct {
				ID          string `json:"id"`
				Email       string `json:"email"`
				DisplayName string `json:"displayName"`
			} `json:"user"`
		} `json:"items"`
	}
	if err := json.Unmarshal(list.Body.Bytes(), &page); err != nil || len(page.Items) != 1 || page.Items[0].ID != referralID || page.Items[0].User.ID != userID || page.Items[0].User.Email != email || page.Items[0].User.DisplayName != "Audit learner" {
		t.Fatalf("referral list contract=%s err=%v", list.Body.String(), err)
	}
	detail := call("/api/admin/growth/referrals/" + referralID)
	if detail.Code != http.StatusOK {
		t.Fatalf("referral detail status=%d body=%s", detail.Code, detail.Body.String())
	}
	var body struct {
		User struct {
			ID          string `json:"id"`
			DisplayName string `json:"displayName"`
		} `json:"user"`
		Events []struct {
			Kind           string            `json:"kind"`
			ReferrerUserID string            `json:"referrerUserId"`
			Payload        map[string]string `json:"payload"`
		} `json:"events"`
	}
	if err := json.Unmarshal(detail.Body.Bytes(), &body); err != nil || body.User.ID != userID || body.User.DisplayName != "Audit learner" || len(body.Events) != 1 || body.Events[0].Kind != "signup" || body.Events[0].ReferrerUserID != userID || body.Events[0].Payload["source"] != "audit151" {
		t.Fatalf("referral detail contract=%s err=%v", detail.Body.String(), err)
	}
}
