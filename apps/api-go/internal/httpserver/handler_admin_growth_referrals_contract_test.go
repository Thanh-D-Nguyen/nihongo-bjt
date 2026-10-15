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

func TestAdminGrowthReferralsListAndDetailUseAdminClientContractAUDIT152(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	ctx := context.Background()
	actorID, userID, referredUserID, referralID := newUUID(t), newUUID(t), newUUID(t), newUUID(t)
	seedAdminActor(t, db, actorID, fmt.Sprintf("audit152-read-%s@example.test", actorID[:8]), "AUDIT-152 Admin")
	grantAdminPermission(t, db, actorID, "admin.growth.read")
	token := createAdminSession(t, sessions, actorID)
	email := fmt.Sprintf("audit152-user-%s@example.test", userID[:8])
	code := "a152" + strings.ReplaceAll(userID[:8], "-", "")
	if _, err := db.Exec(ctx, `INSERT INTO profile.user_profile (id,display_name,email,status,updated_at) VALUES ($1,'AUDIT-152 Learner',$2,'active',now())`, userID, email); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO profile.user_profile (id,display_name,email,status,updated_at) VALUES ($1,'AUDIT-152 Referred',$2,'active',now())`, referredUserID, fmt.Sprintf("audit152-referred-%s@example.test", referredUserID[:8])); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO growth.referral_code (id,user_id,code,created_at) VALUES ($1,$2,$3,now())`, referralID, userID, code); err != nil {
		t.Fatal(err)
	}
	var eventID string
	if err := db.QueryRow(ctx, `INSERT INTO growth.referral_event (referrer_user_id,referred_user_id,code,kind,payload,created_at) VALUES ($1,$2,$3,'signup','{"source":"audit152"}',now()) RETURNING id::text`, userID, referredUserID, code).Scan(&eventID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO ops.admin_audit_log (action,actor_id,target_id,target_type,reason,before,created_at) VALUES ('admin.growth.referral_code.reviewed',$1,$2,'growth.referral_code','audit152 detail','{}',now())`, actorID, referralID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, `DELETE FROM ops.admin_audit_log WHERE target_id=$1`, referralID)
		_, _ = db.Exec(ctx, `DELETE FROM growth.referral_event WHERE code=$1`, code)
		_, _ = db.Exec(ctx, `DELETE FROM growth.referral_code WHERE id=$1`, referralID)
		_, _ = db.Exec(ctx, `DELETE FROM profile.user_profile WHERE id=$1`, referredUserID)
		_, _ = db.Exec(ctx, `DELETE FROM profile.user_profile WHERE id=$1`, userID)
	})
	call := func(path string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		res := httptest.NewRecorder()
		srv.Config.Handler.ServeHTTP(res, req)
		return res
	}

	list := call("/api/admin/growth/referrals?page=1&pageSize=25&q=" + code)
	if list.Code != http.StatusOK {
		t.Fatalf("list status=%d body=%s; want 200", list.Code, list.Body.String())
	}
	var page struct {
		Items []struct {
			ID     string `json:"id"`
			Code   string `json:"code"`
			UserID string `json:"userId"`
			User   struct {
				ID          string `json:"id"`
				Email       string `json:"email"`
				DisplayName string `json:"displayName"`
			} `json:"user"`
			EventsLastHour int    `json:"eventsLastHour"`
			AbuseFlag      bool   `json:"abuseFlag"`
			CreatedAt      string `json:"createdAt"`
		} `json:"items"`
		Page     int `json:"page"`
		PageSize int `json:"pageSize"`
		Total    int `json:"total"`
	}
	if err := json.Unmarshal(list.Body.Bytes(), &page); err != nil || len(page.Items) != 1 || page.Page != 1 || page.PageSize != 25 || page.Total != 1 {
		t.Fatalf("list contract=%s err=%v", list.Body.String(), err)
	}
	item := page.Items[0]
	if item.ID != referralID || item.Code != code || item.UserID != userID || item.User.ID != userID || item.User.Email != email || item.User.DisplayName != "AUDIT-152 Learner" || item.EventsLastHour != 1 || item.AbuseFlag || item.CreatedAt == "" {
		t.Fatalf("list item contract=%+v", item)
	}

	detail := call("/api/admin/growth/referrals/" + referralID)
	if detail.Code != http.StatusOK {
		t.Fatalf("detail status=%d body=%s; want 200", detail.Code, detail.Body.String())
	}
	var body struct {
		ID   string `json:"id"`
		User struct {
			ID          string `json:"id"`
			Email       string `json:"email"`
			DisplayName string `json:"displayName"`
		} `json:"user"`
		Events []struct {
			ID             string         `json:"id"`
			Kind           string         `json:"kind"`
			Code           string         `json:"code"`
			Payload        map[string]any `json:"payload"`
			ReferrerUserID string         `json:"referrerUserId"`
			ReferredUserID *string        `json:"referredUserId"`
			CreatedAt      string         `json:"createdAt"`
		} `json:"events"`
		Audit []struct {
			Action string `json:"action"`
			Reason string `json:"reason"`
			Actor  struct {
				ID          string `json:"id"`
				Email       string `json:"email"`
				DisplayName string `json:"displayName"`
			} `json:"actor"`
		} `json:"audit"`
	}
	if err := json.Unmarshal(detail.Body.Bytes(), &body); err != nil || body.ID != referralID || body.User.ID != userID || body.User.Email != email || body.User.DisplayName != "AUDIT-152 Learner" || len(body.Events) != 1 || len(body.Audit) != 1 {
		t.Fatalf("detail contract=%s err=%v", detail.Body.String(), err)
	}
	event := body.Events[0]
	if event.ID != eventID || event.Kind != "signup" || event.Code != code || event.Payload["source"] != "audit152" || event.ReferrerUserID != userID || event.ReferredUserID == nil || *event.ReferredUserID != referredUserID || event.CreatedAt == "" {
		t.Fatalf("detail event contract=%+v", event)
	}
	audit := body.Audit[0]
	if audit.Action != "admin.growth.referral_code.reviewed" || audit.Reason != "audit152 detail" || audit.Actor.ID != actorID || audit.Actor.Email == "" || audit.Actor.DisplayName == "" {
		t.Fatalf("detail audit contract=%+v", audit)
	}
}

func TestAdminGrowthReferralsRevokePersistsAndAuditsAUDIT152(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	ctx := context.Background()
	actorID, userID, referralID := newUUID(t), newUUID(t), newUUID(t)
	seedAdminActor(t, db, actorID, fmt.Sprintf("audit152-revoke-%s@example.test", actorID[:8]), "AUDIT-152 Revoke Admin")
	grantAdminPermission(t, db, actorID, "growth.manage")
	token := createAdminSession(t, sessions, actorID)
	code := "r152" + strings.ReplaceAll(userID[:8], "-", "")
	if _, err := db.Exec(ctx, `INSERT INTO profile.user_profile (id,display_name,email,status,updated_at) VALUES ($1,'AUDIT-152 Revoked learner',$2,'active',now())`, userID, fmt.Sprintf("audit152-revoke-user-%s@example.test", userID[:8])); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO growth.referral_code (id,user_id,code,created_at) VALUES ($1,$2,$3,now())`, referralID, userID, code); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, `DELETE FROM ops.admin_audit_log WHERE target_id=$1`, referralID)
		_, _ = db.Exec(ctx, `DELETE FROM growth.referral_code WHERE id=$1`, referralID)
		_, _ = db.Exec(ctx, `DELETE FROM profile.user_profile WHERE id=$1`, userID)
	})

	req := httptest.NewRequest(http.MethodPost, "/api/admin/growth/referrals/"+referralID+"/revoke", strings.NewReader(`{"reason":"AUDIT-152 revoke test"}`))
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("X-CSRF-Token", "test-csrf")
	req.Header.Set("Content-Type", "application/json")
	res := httptest.NewRecorder()
	srv.Config.Handler.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("revoke status=%d body=%s; want 200", res.Code, res.Body.String())
	}
	var response struct {
		ID      string `json:"id"`
		Revoked bool   `json:"revoked"`
	}
	if err := json.Unmarshal(res.Body.Bytes(), &response); err != nil || response.ID != referralID || !response.Revoked {
		t.Fatalf("revoke response=%s err=%v", res.Body.String(), err)
	}
	var remaining, audits int
	if err := db.QueryRow(ctx, `SELECT count(*) FROM growth.referral_code WHERE id=$1`, referralID).Scan(&remaining); err != nil || remaining != 0 {
		t.Fatalf("referral remaining=%d err=%v; want deleted", remaining, err)
	}
	if err := db.QueryRow(ctx, `SELECT count(*) FROM ops.admin_audit_log WHERE target_id=$1 AND actor_id=$2 AND action='admin.growth.referral_code.revoked' AND reason='AUDIT-152 revoke test'`, referralID, actorID).Scan(&audits); err != nil || audits != 1 {
		t.Fatalf("revoke audit count=%d err=%v; want 1", audits, err)
	}
}
