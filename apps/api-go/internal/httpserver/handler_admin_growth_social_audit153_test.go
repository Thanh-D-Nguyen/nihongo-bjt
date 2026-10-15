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

func TestAudit153SocialAdminContractsPersistAcrossTemplateAndEventFlows(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	ctx := context.Background()
	actorID, userID, eventID, templateID := newUUID(t), newUUID(t), newUUID(t), newUUID(t)
	seedAdminActor(t, db, actorID, fmt.Sprintf("audit153-%s@example.com", actorID[:8]), "AUDIT-153 admin")
	grantAdminPermission(t, db, actorID, "growth.manage")
	token := createAdminSession(t, sessions, actorID)
	slug := "audit153_social_" + strings.ReplaceAll(actorID, "-", "")
	publicToken := "audit153" + strings.ReplaceAll(eventID, "-", "")
	if _, err := db.Exec(ctx, `INSERT INTO profile.user_profile (id,display_name,email,status,updated_at) VALUES ($1,'AUDIT-153 learner',$2,'active',now())`, userID, "learner-"+userID[:8]+"@example.test"); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO growth.share_template (id,slug,kind,config,active,created_at,updated_at) VALUES ($1,$2,'social_achievement','{"name":"Event template","privacyClass":"anonymized","surface":"social"}',true,now(),now())`, templateID, slug+"_event"); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO growth.share_item (id,user_id,template_id,public_token,kind,summary_payload,created_at) VALUES ($1,$2,$3,$4,'achievement','{"headline":"BJT level up","sub":"Score 82"}',now())`, eventID, userID, templateID, publicToken); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, `DELETE FROM ops.admin_audit_log WHERE target_id = ANY($1)`, []string{eventID, templateID})
		_, _ = db.Exec(ctx, `DELETE FROM growth.share_item WHERE id=$1`, eventID)
		_, _ = db.Exec(ctx, `DELETE FROM growth.share_template WHERE id=$1 OR slug=$2`, templateID, slug)
		_, _ = db.Exec(ctx, `DELETE FROM profile.user_profile WHERE id=$1`, userID)
	})
	call := func(method, path, body string) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		if method != http.MethodGet {
			req.Header.Set("Origin", "http://localhost:3000")
			req.Header.Set("X-CSRF-Token", "test-csrf")
			req.Header.Set("Content-Type", "application/json")
		}
		res := httptest.NewRecorder()
		srv.Config.Handler.ServeHTTP(res, req)
		return res
	}
	decode := func(res *httptest.ResponseRecorder, dst any) {
		t.Helper()
		if err := json.Unmarshal(res.Body.Bytes(), dst); err != nil {
			t.Fatalf("decode response status=%d body=%s: %v", res.Code, res.Body.String(), err)
		}
	}

	events := call(http.MethodGet, "/api/admin/growth/social/events?page=1&pageSize=10", "")
	if events.Code != http.StatusOK {
		t.Fatalf("events status=%d body=%s; want 200", events.Code, events.Body.String())
	}
	var eventBody []map[string]json.RawMessage
	var eventList struct {
		Items []map[string]json.RawMessage `json:"items"`
		Total int                          `json:"total"`
	}
	decode(events, &eventList)
	eventBody = eventList.Items
	if eventList.Total < 1 || eventBody == nil {
		t.Fatalf("events response omitted seeded item: %s", events.Body.String())
	}
	var found map[string]json.RawMessage
	for _, item := range eventBody {
		var id string
		_ = json.Unmarshal(item["id"], &id)
		if id == eventID {
			found = item
			break
		}
	}
	if found == nil {
		t.Fatalf("seeded event not found in raw list: %s", events.Body.String())
	}
	for _, key := range []string{"publicToken", "kind", "hidden", "template", "user", "summaryPreview"} {
		if _, ok := found[key]; !ok {
			t.Errorf("event UI field %q missing: %s", key, events.Body.String())
		}
	}
	var eventUser, eventTemplate, summary map[string]json.RawMessage
	_ = json.Unmarshal(found["user"], &eventUser)
	_ = json.Unmarshal(found["template"], &eventTemplate)
	_ = json.Unmarshal(found["summaryPreview"], &summary)
	assertJSONField(t, found, "publicToken", publicToken)
	assertJSONField(t, found, "kind", "achievement")
	assertJSONField(t, eventUser, "id", userID)
	assertJSONField(t, eventUser, "displayName", "AUDIT-153 learner")
	assertJSONField(t, eventTemplate, "id", templateID)
	assertJSONField(t, eventTemplate, "kind", "social_achievement")
	assertJSONField(t, eventTemplate, "slug", slug+"_event")
	assertJSONField(t, summary, "headline", "BJT level up")
	assertJSONField(t, summary, "sub", "Score 82")
	var hidden bool
	if err := json.Unmarshal(found["hidden"], &hidden); err != nil || hidden {
		t.Fatalf("new event hidden=%v err=%v; want false", hidden, err)
	}

	publicShareBefore := httptest.NewRecorder()
	srv.Config.Handler.ServeHTTP(publicShareBefore, httptest.NewRequest(http.MethodGet, "/api/public/shares/"+publicToken, nil))
	if publicShareBefore.Code != http.StatusOK {
		t.Fatalf("live public share status=%d body=%s; want 200", publicShareBefore.Code, publicShareBefore.Body.String())
	}
	if publicShareBefore.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("live share Cache-Control=%q; want no-store", publicShareBefore.Header().Get("Cache-Control"))
	}
	moderated := call(http.MethodPost, "/api/admin/growth/social/events/"+eventID+"/moderate", `{"action":"hide_from_public","reason":"audit153 hide event"}`)
	var moderationResponse struct {
		Action string `json:"action"`
		ID     string `json:"id"`
		OK     bool   `json:"ok"`
	}
	if moderated.Code != http.StatusOK {
		t.Fatalf("moderation status=%d body=%s; want successful response", moderated.Code, moderated.Body.String())
	}
	decode(moderated, &moderationResponse)
	if moderationResponse.Action != "hide_from_public" || moderationResponse.ID != eventID || !moderationResponse.OK {
		t.Fatalf("moderation response mismatch: %s", moderated.Body.String())
	}
	var hiddenAt *time.Time
	if err := db.QueryRow(ctx, `SELECT expires_at FROM growth.share_item WHERE id=$1`, eventID).Scan(&hiddenAt); err != nil || hiddenAt == nil {
		t.Fatalf("moderated event expires_at=%v err=%v; want persisted hidden state", hiddenAt, err)
	}
	assertSocialAudit(t, db, eventID, actorID, "admin.growth.share_item.hide_from_public")
	publicShare := httptest.NewRecorder()
	srv.Config.Handler.ServeHTTP(publicShare, httptest.NewRequest(http.MethodGet, "/api/public/shares/"+publicToken, nil))
	if publicShare.Code != http.StatusNotFound {
		t.Fatalf("moderated public share status=%d body=%s; want 404", publicShare.Code, publicShare.Body.String())
	}
	if publicShare.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("moderated share Cache-Control=%q; want no-store", publicShare.Header().Get("Cache-Control"))
	}
	hiddenEvents := call(http.MethodGet, "/api/admin/growth/social/events?hidden=hidden&page=1&pageSize=10", "")
	if hiddenEvents.Code != http.StatusOK || !strings.Contains(hiddenEvents.Body.String(), eventID) {
		t.Fatalf("hidden event filter status=%d body=%s", hiddenEvents.Code, hiddenEvents.Body.String())
	}
	var hiddenList struct {
		Items []map[string]json.RawMessage `json:"items"`
	}
	decode(hiddenEvents, &hiddenList)
	for _, item := range hiddenList.Items {
		var id string
		_ = json.Unmarshal(item["id"], &id)
		if id == eventID {
			if err := json.Unmarshal(item["hidden"], &hidden); err != nil || !hidden {
				t.Fatalf("moderated event hidden=%v err=%v; want true", hidden, err)
			}
		}
	}

	config := `{"name":"AUDIT-153 social","description":"contract test","bodyTemplate":"{name}","privacyClass":"anonymized","noPiiVerified":true,"surface":"social"}`
	created := call(http.MethodPost, "/api/admin/growth/social/templates", fmt.Sprintf(`{"slug":%q,"kind":"social_achievement","config":%s,"reason":"audit153 create"}`, slug, config))
	if created.Code != http.StatusOK {
		t.Fatalf("template create status=%d body=%s; want 200", created.Code, created.Body.String())
	}
	var detail struct {
		ID            string         `json:"id"`
		Slug          string         `json:"slug"`
		Kind          string         `json:"kind"`
		Name          string         `json:"name"`
		Active        bool           `json:"active"`
		Version       int            `json:"version"`
		PrivacyClass  string         `json:"privacyClass"`
		NoPIIVerified bool           `json:"noPiiVerified"`
		Surface       string         `json:"surface"`
		Config        map[string]any `json:"config"`
		Audit         []struct {
			Action string `json:"action"`
			Actor  *struct {
				ID string `json:"id"`
			} `json:"actor"`
		} `json:"audit"`
	}
	decode(created, &detail)
	if detail.ID == "" || detail.Slug != slug || detail.Kind != "social_achievement" || detail.Name != "AUDIT-153 social" || detail.Version != 1 || detail.Active {
		t.Fatalf("created template response mismatch: %s", created.Body.String())
	}
	if detail.PrivacyClass != "anonymized" || !detail.NoPIIVerified || detail.Surface != "social" || detail.Config["bodyTemplate"] != "{name}" {
		t.Fatalf("created template policy/config mismatch: %s", created.Body.String())
	}
	assertSocialAudit(t, db, detail.ID, actorID, "admin.growth.social_template.created")

	list := call(http.MethodGet, "/api/admin/growth/social/templates?q="+slug+"&page=1&pageSize=25", "")
	if list.Code != http.StatusOK || !strings.Contains(list.Body.String(), `"name":"AUDIT-153 social"`) {
		t.Fatalf("template list status=%d body=%s", list.Code, list.Body.String())
	}
	patched := call(http.MethodPatch, "/api/admin/growth/social/templates/"+detail.ID, fmt.Sprintf(`{"slug":%q,"kind":"social_streak","config":%s,"reason":"audit153 patch"}`, slug+"_updated", config))
	if patched.Code != http.StatusOK {
		t.Fatalf("template patch status=%d body=%s; want 200", patched.Code, patched.Body.String())
	}
	decode(patched, &detail)
	if detail.Slug != slug+"_updated" || detail.Kind != "social_streak" || detail.Version != 2 {
		t.Fatalf("patched template response mismatch: %s", patched.Body.String())
	}
	assertSocialAudit(t, db, detail.ID, actorID, "admin.growth.social_template.updated")
	var patchAuditAfter []byte
	if err := db.QueryRow(ctx, `SELECT after FROM ops.admin_audit_log WHERE target_id=$1 AND action='admin.growth.social_template.updated'`, detail.ID).Scan(&patchAuditAfter); err != nil {
		t.Fatal(err)
	}
	var patchAfter map[string]json.RawMessage
	if err := json.Unmarshal(patchAuditAfter, &patchAfter); err != nil {
		t.Fatalf("decode patch audit after %s: %v", patchAuditAfter, err)
	}
	assertJSONField(t, patchAfter, "slug", slug+"_updated")
	assertJSONField(t, patchAfter, "kind", "social_streak")
	var patchVersion int
	if err := json.Unmarshal(patchAfter["version"], &patchVersion); err != nil || patchVersion != 2 {
		t.Fatalf("patch audit version=%d err=%v after=%s", patchVersion, err, patchAuditAfter)
	}
	var patchConfig map[string]any
	if err := json.Unmarshal(patchAfter["config"], &patchConfig); err != nil || patchConfig["name"] != "AUDIT-153 social" {
		t.Fatalf("patch audit config=%v err=%v after=%s", patchConfig, err, patchAuditAfter)
	}

	published := call(http.MethodPost, "/api/admin/growth/social/templates/"+detail.ID+"/publish", `{"reason":"audit153 publish"}`)
	if published.Code != http.StatusOK {
		t.Fatalf("template publish status=%d body=%s; want 200", published.Code, published.Body.String())
	}
	decode(published, &detail)
	if !detail.Active {
		t.Fatalf("published template remains inactive: %s", published.Body.String())
	}
	assertSocialAudit(t, db, detail.ID, actorID, "admin.growth.social_template.published")

	archived := call(http.MethodPost, "/api/admin/growth/social/templates/"+detail.ID+"/archive", `{"reason":"audit153 archive"}`)
	if archived.Code != http.StatusOK {
		t.Fatalf("template archive status=%d body=%s; want 200", archived.Code, archived.Body.String())
	}
	decode(archived, &detail)
	if detail.Active {
		t.Fatalf("archived template remains active: %s", archived.Body.String())
	}
	assertSocialAudit(t, db, detail.ID, actorID, "admin.growth.social_template.archived")

	selected := call(http.MethodGet, "/api/admin/growth/social/templates/"+detail.ID, "")
	if selected.Code != http.StatusOK {
		t.Fatalf("template detail status=%d body=%s; want 200", selected.Code, selected.Body.String())
	}
	decode(selected, &detail)
	if len(detail.Audit) < 4 {
		t.Fatalf("template detail audit length=%d body=%s", len(detail.Audit), selected.Body.String())
	}
	for _, audit := range detail.Audit {
		if audit.Actor == nil || audit.Actor.ID != actorID {
			t.Fatalf("template detail actor shape mismatch: %s", selected.Body.String())
		}
	}
	var storedSlug, storedKind string
	var storedActive bool
	var storedVersion int
	if err := db.QueryRow(ctx, `SELECT slug,kind,active,version FROM growth.share_template WHERE id=$1`, detail.ID).Scan(&storedSlug, &storedKind, &storedActive, &storedVersion); err != nil {
		t.Fatal(err)
	}
	if storedSlug != slug+"_updated" || storedKind != "social_streak" || storedActive || storedVersion != 2 {
		t.Fatalf("template persisted slug=%q kind=%q active=%v version=%d", storedSlug, storedKind, storedActive, storedVersion)
	}
}

func assertJSONField(t *testing.T, object map[string]json.RawMessage, key, want string) {
	t.Helper()
	var got string
	if err := json.Unmarshal(object[key], &got); err != nil || got != want {
		t.Errorf("field %s=%q err=%v; want %q", key, got, err, want)
	}
}

func assertSocialAudit(t *testing.T, db *pgxpool.Pool, targetID, actorID, action string) {
	t.Helper()
	var count int
	if err := db.QueryRow(context.Background(), `SELECT count(*) FROM ops.admin_audit_log WHERE target_id=$1 AND actor_id=$2 AND action=$3`, targetID, actorID, action).Scan(&count); err != nil || count != 1 {
		t.Errorf("audit %s target=%s count=%d err=%v; want one", action, targetID, count, err)
	}
}

func TestAudit153SocialAdminWritesRollBackWhenAuditFails(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	ctx := context.Background()
	actorID, userID, eventID, patchID, publishID, archiveID := newUUID(t), newUUID(t), newUUID(t), newUUID(t), newUUID(t), newUUID(t)
	seedAdminActor(t, db, actorID, fmt.Sprintf("audit153-atomic-%s@example.com", actorID[:8]), "AUDIT-153 atomic")
	grantAdminPermission(t, db, actorID, "growth.manage")
	token := createAdminSession(t, sessions, actorID)
	baseSlug := "audit153_atomic_" + strings.ReplaceAll(actorID, "-", "")
	for _, row := range []struct {
		id     string
		slug   string
		active bool
	}{{patchID, baseSlug + "_patch", true}, {publishID, baseSlug + "_publish", false}, {archiveID, baseSlug + "_archive", true}} {
		if _, err := db.Exec(ctx, `INSERT INTO growth.share_template (id,slug,kind,config,active,created_at,updated_at) VALUES ($1,$2,'social_achievement','{"privacyClass":"anonymized","noPiiVerified":true}', $3,now(),now())`, row.id, row.slug, row.active); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := db.Exec(ctx, `INSERT INTO profile.user_profile (id,display_name,email,status,updated_at) VALUES ($1,'AUDIT-153 atomic learner',$2,'active',now())`, userID, "atomic-"+userID[:8]+"@example.test"); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO growth.share_item (id,user_id,public_token,kind,summary_payload,created_at) VALUES ($1,$2,$3,'achievement','{}',now())`, eventID, userID, "audit153"+strings.ReplaceAll(eventID, "-", "")); err != nil {
		t.Fatal(err)
	}
	fnName := "audit153_fail_" + strings.ReplaceAll(actorID, "-", "")
	triggerName := "audit153_fail_" + strings.ReplaceAll(actorID[:8], "-", "")
	if _, err := db.Exec(ctx, fmt.Sprintf(`CREATE FUNCTION public.%s() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.actor_id='%s'::uuid AND (NEW.action LIKE 'admin.growth.social_template.%%' OR NEW.action LIKE 'admin.growth.share_item.%%') THEN RAISE EXCEPTION 'injected AUDIT-153 failure'; END IF; RETURN NEW; END $$`, fnName, actorID)); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `CREATE TRIGGER `+triggerName+` BEFORE INSERT ON ops.admin_audit_log FOR EACH ROW EXECUTE FUNCTION public.`+fnName+`() `); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, `DROP TRIGGER IF EXISTS `+triggerName+` ON ops.admin_audit_log`)
		_, _ = db.Exec(ctx, `DROP FUNCTION IF EXISTS public.`+fnName+`() `)
		_, _ = db.Exec(ctx, `DELETE FROM growth.share_item WHERE id=$1`, eventID)
		_, _ = db.Exec(ctx, `DELETE FROM growth.share_template WHERE slug LIKE $1`, baseSlug+"%")
		_, _ = db.Exec(ctx, `DELETE FROM profile.user_profile WHERE id=$1`, userID)
	})
	call := func(method, path, body string) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		if method != http.MethodGet {
			req.Header.Set("Origin", "http://localhost:3000")
			req.Header.Set("X-CSRF-Token", "test-csrf")
			req.Header.Set("Content-Type", "application/json")
		}
		res := httptest.NewRecorder()
		srv.Config.Handler.ServeHTTP(res, req)
		return res
	}
	config := `{"name":"changed","bodyTemplate":"{name}","privacyClass":"anonymized","noPiiVerified":true,"surface":"social"}`
	requests := []struct{ method, path, body string }{
		{http.MethodPost, "/api/admin/growth/social/templates", fmt.Sprintf(`{"slug":%q,"kind":"social_achievement","config":%s,"reason":"audit153 rollback"}`, baseSlug+"_create", config)},
		{http.MethodPatch, "/api/admin/growth/social/templates/" + patchID, fmt.Sprintf(`{"slug":%q,"reason":"audit153 rollback"}`, baseSlug+"_changed")},
		{http.MethodPost, "/api/admin/growth/social/templates/" + publishID + "/publish", `{"reason":"audit153 rollback"}`},
		{http.MethodPost, "/api/admin/growth/social/templates/" + archiveID + "/archive", `{"reason":"audit153 rollback"}`},
		{http.MethodPost, "/api/admin/growth/social/events/" + eventID + "/moderate", `{"action":"hide_from_public","reason":"audit153 rollback"}`},
	}
	for _, request := range requests {
		res := call(request.method, request.path, request.body)
		if res.Code != http.StatusInternalServerError {
			t.Fatalf("%s %s status=%d body=%s; want audit failure", request.method, request.path, res.Code, res.Body.String())
		}
	}
	var exists bool
	if err := db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM growth.share_template WHERE slug=$1)`, baseSlug+"_create").Scan(&exists); err != nil || exists {
		t.Fatalf("failed create persisted exists=%v err=%v", exists, err)
	}
	var patchSlug string
	var publishActive, archiveActive bool
	if err := db.QueryRow(ctx, `SELECT slug FROM growth.share_template WHERE id=$1`, patchID).Scan(&patchSlug); err != nil || patchSlug != baseSlug+"_patch" {
		t.Fatalf("failed patch persisted slug=%q err=%v", patchSlug, err)
	}
	if err := db.QueryRow(ctx, `SELECT active FROM growth.share_template WHERE id=$1`, publishID).Scan(&publishActive); err != nil || publishActive {
		t.Fatalf("failed publish persisted active=%v err=%v", publishActive, err)
	}
	if err := db.QueryRow(ctx, `SELECT active FROM growth.share_template WHERE id=$1`, archiveID).Scan(&archiveActive); err != nil || !archiveActive {
		t.Fatalf("failed archive persisted active=%v err=%v", archiveActive, err)
	}
	var expiresAt *time.Time
	if err := db.QueryRow(ctx, `SELECT expires_at FROM growth.share_item WHERE id=$1`, eventID).Scan(&expiresAt); err != nil || expiresAt != nil {
		t.Fatalf("failed moderation persisted expires_at=%v err=%v", expiresAt, err)
	}
	var auditCount int
	if err := db.QueryRow(ctx, `SELECT count(*) FROM ops.admin_audit_log WHERE actor_id=$1 AND (action LIKE 'admin.growth.social_template.%' OR action LIKE 'admin.growth.share_item.%')`, actorID).Scan(&auditCount); err != nil || auditCount != 0 {
		t.Fatalf("failed mutations wrote %d audit rows, err=%v", auditCount, err)
	}
}
