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
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

const audit158LegalPath = "/api/admin/legal/policies"

type audit158LegalPolicy struct {
	ID          string    `json:"id"`
	PolicyKey   string    `json:"policyKey"`
	Version     string    `json:"version"`
	Status      string    `json:"status"`
	EffectiveAt time.Time `json:"effectiveAt"`
	ContentMd   *string   `json:"contentMd"`
	CreatedAt   time.Time `json:"createdAt"`
}

type audit158LegalFixture struct {
	db                  *pgxpool.Pool
	actorID, key, token string
	call                func(method, path, body, token string) *httptest.ResponseRecorder
	callOrigin          func(method, path, body, token, origin string) *httptest.ResponseRecorder
}

func audit158LegalSetup(t *testing.T) audit158LegalFixture {
	t.Helper()
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	t.Cleanup(srv.Close)
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, "audit158-legal-"+actorID+"@example.test", "AUDIT-158 legal")
	grantAdminPermission(t, db, actorID, "admin.legal.write")
	f := audit158LegalFixture{db: db, actorID: actorID, key: "audit158_" + newUUID(t), token: createAdminSession(t, sessions, actorID)}
	f.callOrigin = func(method, path, body, token, origin string) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		if token != "" {
			req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		}
		if origin != "" {
			req.Header.Set("Origin", origin)
		}
		req.Header.Set("Content-Type", "application/json")
		res := httptest.NewRecorder()
		srv.Config.Handler.ServeHTTP(res, req)
		return res
	}
	f.call = func(method, path, body, token string) *httptest.ResponseRecorder {
		return f.callOrigin(method, path, body, token, "http://localhost:3000")
	}
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if _, err := db.Exec(ctx, `DELETE FROM ops.admin_audit_log WHERE actor_id=$1`, actorID); err != nil {
			t.Error(err)
		}
		// POST versions are unique to this fixture even when the handler fails after INSERT.
		if _, err := db.Exec(ctx, `DELETE FROM legal.legal_policy WHERE policy_key=$1 OR (policy_key='legal_document' AND version=$2)`, f.key, actorID[:32]); err != nil {
			t.Error(err)
		}
		var remaining int
		if err := db.QueryRow(ctx, `SELECT count(*) FROM legal.legal_policy WHERE policy_key=$1 OR (policy_key='legal_document' AND version=$2)`, f.key, actorID[:32]).Scan(&remaining); err != nil || remaining != 0 {
			t.Errorf("fixture cleanup: rows=%d err=%v", remaining, err)
		}
	})
	return f
}

func (f audit158LegalFixture) seed(t *testing.T, version, status string, content *string) string {
	t.Helper()
	id := newUUID(t)
	if _, err := f.db.Exec(context.Background(), `INSERT INTO legal.legal_policy (id,policy_key,version,status,effective_at,content_md) VALUES ($1,$2,$3,$4,$5,$6)`, id, f.key, version, status, time.Now().Add(48*time.Hour).UTC().Truncate(time.Second), content); err != nil {
		t.Fatal(err)
	}
	return id
}

func audit158LegalStatus(t *testing.T, res *httptest.ResponseRecorder, want int) {
	t.Helper()
	if res.Code != want {
		t.Fatalf("status=%d want=%d body=%s", res.Code, want, res.Body.String())
	}
}

func audit158LegalDecode(t *testing.T, res *httptest.ResponseRecorder) audit158LegalPolicy {
	t.Helper()
	var policy audit158LegalPolicy
	if err := json.Unmarshal(res.Body.Bytes(), &policy); err != nil {
		t.Fatal(err)
	}
	if !isValidUUID(policy.ID) || policy.PolicyKey == "" || policy.Version == "" || policy.Status == "" || policy.EffectiveAt.IsZero() || policy.CreatedAt.IsZero() {
		t.Fatalf("incomplete UI policy contract: %s", res.Body.String())
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(res.Body.Bytes(), &fields); err != nil {
		t.Fatal(err)
	}
	if _, ok := fields["contentMd"]; !ok {
		t.Fatalf("missing nullable contentMd: %s", res.Body.String())
	}
	return policy
}

func (f audit158LegalFixture) audit(t *testing.T, id, action string) {
	t.Helper()
	var count int
	if err := f.db.QueryRow(context.Background(), `SELECT count(*) FROM ops.admin_audit_log WHERE actor_id=$1 AND target_id=$2 AND target_type='legal.legal_policy' AND action=$3`, f.actorID, id, action).Scan(&count); err != nil || count != 1 {
		t.Fatalf("audit %s count=%d err=%v", action, count, err)
	}
}

func TestAudit158LegalPoliciesGET(t *testing.T) {
	f := audit158LegalSetup(t)
	body := "# Japanese policy 日本語"
	id := f.seed(t, "v1", "draft", &body)
	f.seed(t, "v2", "published", nil)
	res := f.call(http.MethodGet, audit158LegalPath+"?policyKey="+f.key+"&status=draft&limit=1&offset=0", "", f.token)
	audit158LegalStatus(t, res, http.StatusOK)
	var list struct {
		Items                []json.RawMessage `json:"items"`
		Total, Limit, Offset int
	}
	if err := json.Unmarshal(res.Body.Bytes(), &list); err != nil {
		t.Fatal(err)
	}
	if len(list.Items) != 1 || list.Total != 1 || list.Limit != 1 || list.Offset != 0 {
		t.Fatalf("filtered pagination: %s", res.Body.String())
	}
	itemRes := httptest.NewRecorder()
	itemRes.Body.Write(list.Items[0])
	p := audit158LegalDecode(t, itemRes)
	if p.ID != id || p.ContentMd == nil || *p.ContentMd != body {
		t.Fatalf("stored list item: %+v", p)
	}
	for _, query := range []string{"&offset=2", "&status=archived"} {
		res = f.call(http.MethodGet, audit158LegalPath+"?policyKey="+f.key+query, "", f.token)
		audit158LegalStatus(t, res, http.StatusOK)
		if !strings.Contains(res.Body.String(), `"items":[]`) {
			t.Fatalf("empty list must be array: %s", res.Body.String())
		}
	}
	res = f.call(http.MethodGet, audit158LegalPath+"?policyKey="+f.key+"&limit=0&offset=-1", "", f.token)
	audit158LegalStatus(t, res, http.StatusOK)
	if !strings.Contains(res.Body.String(), `"limit":100`) || !strings.Contains(res.Body.String(), `"offset":0`) {
		t.Fatalf("pagination fallback: %s", res.Body.String())
	}
}

func TestAudit158LegalPolicyDiffUsesPersistedContract(t *testing.T) {
	f := audit158LegalSetup(t)
	first, second := "# first 日本語", "# second 日本語"
	id := f.seed(t, "diff-v1", "draft", &first)
	against := f.seed(t, "diff-v2", "published", &second)
	path := fmt.Sprintf("%s/%s/diff?against=%s", audit158LegalPath, id, against)
	res := f.call(http.MethodGet, path, "", f.token)
	audit158LegalStatus(t, res, http.StatusOK)
	var diff struct {
		Current struct {
			ID, PolicyKey, Version, Status string
			ContentMd                      *string   `json:"contentMd"`
			CreatedAt                      time.Time `json:"createdAt"`
		} `json:"current"`
		Against  struct{ ID string } `json:"against"`
		SameBody bool                `json:"sameBody"`
	}
	if err := json.Unmarshal(res.Body.Bytes(), &diff); err != nil {
		t.Fatal(err)
	}
	if diff.Current.ID != id || diff.Current.Version != "diff-v1" || diff.Current.ContentMd == nil || *diff.Current.ContentMd != first || diff.Current.CreatedAt.IsZero() || diff.Against.ID != against || diff.SameBody {
		t.Fatalf("unexpected diff contract: %s", res.Body.String())
	}
	audit158LegalStatus(t, f.call(http.MethodGet, audit158LegalPath+"/invalid/diff?against="+against, "", f.token), http.StatusBadRequest)
	audit158LegalStatus(t, f.call(http.MethodGet, audit158LegalPath+"/"+id+"/diff?against="+newUUID(t), "", f.token), http.StatusNotFound)
}

func TestAudit158LegalPoliciesPOST(t *testing.T) {
	f := audit158LegalSetup(t)
	effective := time.Now().Add(48 * time.Hour).UTC().Truncate(time.Second)
	body := fmt.Sprintf(`{"policyKey":"legal_document","version":%q,"status":"draft","effectiveAt":%q,"contentMd":"# 利用規約"}`, f.actorID[:32], effective.Format(time.RFC3339))
	res := f.call(http.MethodPost, audit158LegalPath, body, f.token)
	audit158LegalStatus(t, res, http.StatusCreated)
	p := audit158LegalDecode(t, res)
	var stored audit158LegalPolicy
	if err := f.db.QueryRow(context.Background(), `SELECT policy_key,version,status,effective_at,content_md FROM legal.legal_policy WHERE id=$1`, p.ID).Scan(&stored.PolicyKey, &stored.Version, &stored.Status, &stored.EffectiveAt, &stored.ContentMd); err != nil {
		t.Fatal(err)
	}
	if stored.PolicyKey != "legal_document" || stored.Version != f.actorID[:32] || stored.Status != "draft" || !stored.EffectiveAt.Equal(effective) || stored.ContentMd == nil || *stored.ContentMd != "# 利用規約" {
		t.Fatalf("create persistence: %+v", stored)
	}
	f.audit(t, p.ID, "legal.policy.created")
	audit158LegalStatus(t, f.call(http.MethodPost, audit158LegalPath, body, f.token), http.StatusConflict)
	for _, invalid := range []string{`{`, `null`, `{}`, `{"policyKey":"legal_document","version":"v1"}`, strings.Replace(body, `"draft"`, `"published"`, 1), strings.Replace(body, `"# 利用規約"`, `42`, 1), strings.Replace(body, effective.Format(time.RFC3339), "not-a-date", 1), strings.Replace(body, f.actorID[:32], strings.Repeat("v", 33), 1), strings.Replace(body, f.actorID[:32], " ", 1), strings.Replace(body, effective.Format(time.RFC3339), time.Now().Add(-time.Hour).Format(time.RFC3339), 1)} {
		t.Run(invalid, func(t *testing.T) {
			audit158LegalStatus(t, f.call(http.MethodPost, audit158LegalPath, invalid, f.token), http.StatusBadRequest)
		})
	}
	var count int
	if err := f.db.QueryRow(context.Background(), `SELECT count(*) FROM legal.legal_policy WHERE version=$1`, f.actorID[:32]).Scan(&count); err != nil || count != 1 {
		t.Fatalf("invalid POST changed rows: %d err=%v", count, err)
	}
}

func TestAudit158LegalPolicyGET(t *testing.T) {
	f := audit158LegalSetup(t)
	id := f.seed(t, "v1", "draft", nil)
	if _, err := f.db.Exec(context.Background(), `INSERT INTO ops.admin_audit_log (actor_id,action,target_type,target_id,reason) VALUES ($1,'legal.policy.created','legal.legal_policy',$2,'fixture')`, f.actorID, id); err != nil {
		t.Fatal(err)
	}
	res := f.call(http.MethodGet, audit158LegalPath+"/"+id, "", f.token)
	audit158LegalStatus(t, res, http.StatusOK)
	p := audit158LegalDecode(t, res)
	if p.ID != id || p.ContentMd != nil {
		t.Fatalf("detail: %+v", p)
	}
	var detail struct {
		Audit []struct {
			Action string
			Actor  *struct{ ID, DisplayName, Email string }
		}
	}
	if err := json.Unmarshal(res.Body.Bytes(), &detail); err != nil {
		t.Fatal(err)
	}
	if len(detail.Audit) != 1 || detail.Audit[0].Action != "legal.policy.created" || detail.Audit[0].Actor == nil || detail.Audit[0].Actor.ID != f.actorID || detail.Audit[0].Actor.DisplayName != "AUDIT-158 legal" || detail.Audit[0].Actor.Email == "" {
		t.Fatalf("UI actor audit contract: %s", res.Body.String())
	}
	id = f.seed(t, "v2", "draft", nil)
	res = f.call(http.MethodGet, audit158LegalPath+"/"+id, "", f.token)
	audit158LegalStatus(t, res, http.StatusOK)
	if !strings.Contains(res.Body.String(), `"audit":[]`) {
		t.Fatalf("empty audit: %s", res.Body.String())
	}
	audit158LegalStatus(t, f.call(http.MethodGet, audit158LegalPath+"/"+newUUID(t), "", f.token), http.StatusNotFound)
	audit158LegalStatus(t, f.call(http.MethodGet, audit158LegalPath+"/invalid", "", f.token), http.StatusBadRequest)
}

func TestAudit158LegalPolicyPATCH(t *testing.T) {
	f := audit158LegalSetup(t)
	body := "original"
	id := f.seed(t, "v1", "draft", &body)
	effective := time.Now().Add(72 * time.Hour).UTC().Truncate(time.Second)
	patch := fmt.Sprintf(`{"version":%q,"effectiveAt":%q,"contentMd":"updated 日本語"}`, "updated-"+f.actorID[:8], effective.Format(time.RFC3339))
	res := f.call(http.MethodPatch, audit158LegalPath+"/"+id, patch, f.token)
	audit158LegalStatus(t, res, http.StatusOK)
	p := audit158LegalDecode(t, res)
	if p.ID != id || p.Version != "updated-"+f.actorID[:8] || !p.EffectiveAt.Equal(effective) || p.ContentMd == nil || *p.ContentMd != "updated 日本語" {
		t.Fatalf("PATCH response: %+v", p)
	}
	var version, content, status string
	var date time.Time
	if err := f.db.QueryRow(context.Background(), `SELECT version,content_md,status,effective_at FROM legal.legal_policy WHERE id=$1`, id).Scan(&version, &content, &status, &date); err != nil || version != p.Version || content != *p.ContentMd || status != "draft" || !date.Equal(effective) {
		t.Fatalf("PATCH persistence version=%s content=%s status=%s date=%s err=%v", version, content, status, date, err)
	}
	f.audit(t, id, "legal.policy.updated")
	for _, invalid := range []string{`{`, `null`, `{}`, `{"status":"published"}`, `{"version":null}`, `{"version":" "}`, `{"version":42}`, `{"contentMd":{}}`, `{"effectiveAt":null}`, `{"effectiveAt":"invalid"}`} {
		t.Run(invalid, func(t *testing.T) {
			audit158LegalStatus(t, f.call(http.MethodPatch, audit158LegalPath+"/"+id, invalid, f.token), http.StatusBadRequest)
		})
	}
	f.seed(t, "duplicate", "draft", nil)
	audit158LegalStatus(t, f.call(http.MethodPatch, audit158LegalPath+"/"+id, `{"version":"duplicate"}`, f.token), http.StatusConflict)
	f.audit(t, id, "legal.policy.updated")
	if err := f.db.QueryRow(context.Background(), `SELECT version,content_md FROM legal.legal_policy WHERE id=$1`, id).Scan(&version, &content); err != nil || version != p.Version || content != *p.ContentMd {
		t.Fatalf("rejected PATCH changed policy: version=%s content=%s err=%v", version, content, err)
	}
	res = f.call(http.MethodPatch, audit158LegalPath+"/"+id, `{"contentMd":null}`, f.token)
	audit158LegalStatus(t, res, http.StatusOK)
	p = audit158LegalDecode(t, res)
	if p.ContentMd != nil || p.Version != version || !p.EffectiveAt.Equal(date) {
		t.Fatalf("partial nullable update: %+v", p)
	}
	var isNull bool
	if err := f.db.QueryRow(context.Background(), `SELECT content_md IS NULL FROM legal.legal_policy WHERE id=$1`, id).Scan(&isNull); err != nil || !isNull {
		t.Fatalf("nullable PATCH not persisted: isNull=%v err=%v", isNull, err)
	}
	for _, state := range []string{"published", "archived"} {
		locked := f.seed(t, state, state, nil)
		audit158LegalStatus(t, f.call(http.MethodPatch, audit158LegalPath+"/"+locked, `{"contentMd":"changed"}`, f.token), http.StatusBadRequest)
	}
	audit158LegalStatus(t, f.call(http.MethodPatch, audit158LegalPath+"/"+newUUID(t), `{"contentMd":"changed"}`, f.token), http.StatusNotFound)
	audit158LegalStatus(t, f.call(http.MethodPatch, audit158LegalPath+"/invalid", `{"contentMd":"changed"}`, f.token), http.StatusBadRequest)
}

func TestAudit158LegalPolicyPublishArchiveAndDuplicatePersist(t *testing.T) {
	f := audit158LegalSetup(t)
	content := "# Policy copy"
	effective := time.Now().Add(48 * time.Hour).UTC().Truncate(time.Second)
	id := f.seed(t, "lifecycle", "draft", &content)
	if _, err := f.db.Exec(context.Background(), `UPDATE legal.legal_policy SET effective_at=$2 WHERE id=$1`, id, effective); err != nil {
		t.Fatal(err)
	}
	for _, action := range []struct {
		name, method, suffix, status string
		want                         int
	}{
		{"publish", http.MethodPatch, "/publish", "published", http.StatusOK},
		{"archive", http.MethodPatch, "/archive", "archived", http.StatusOK},
	} {
		t.Run(action.name, func(t *testing.T) {
			res := f.call(action.method, audit158LegalPath+"/"+id+action.suffix, "", f.token)
			if res.Code != action.want {
				t.Fatalf("%s policy contract: status=%d want=%d body=%s", action.name, res.Code, action.want, res.Body.String())
			}
			var stored string
			if err := f.db.QueryRow(context.Background(), `SELECT status FROM legal.legal_policy WHERE id=$1`, id).Scan(&stored); err != nil || stored != action.status {
				t.Fatalf("%s persistence: status=%q err=%v", action.name, stored, err)
			}
		})
	}
	res := f.call(http.MethodPost, audit158LegalPath+"/"+id+"/duplicate", "", f.token)
	if res.Code != http.StatusCreated {
		t.Fatalf("duplicate policy contract: status=%d want=%d body=%s", res.Code, http.StatusCreated, res.Body.String())
	}
	var duplicate struct {
		ID             string `json:"id"`
		Status         string `json:"status"`
		DuplicatedFrom string `json:"duplicatedFrom"`
	}
	if err := json.Unmarshal(res.Body.Bytes(), &duplicate); err != nil || !isValidUUID(duplicate.ID) || duplicate.Status != "draft" || duplicate.DuplicatedFrom != id {
		t.Fatalf("duplicate response contract: %+v err=%v body=%s", duplicate, err, res.Body.String())
	}
	var key, version, storedContent, status string
	var storedEffective time.Time
	if err := f.db.QueryRow(context.Background(), `SELECT policy_key,version,effective_at,content_md,status FROM legal.legal_policy WHERE id=$1`, duplicate.ID).
		Scan(&key, &version, &storedEffective, &storedContent, &status); err != nil {
		t.Fatal(err)
	}
	if key != f.key || version != "lifecycle-draft" || !storedEffective.Equal(effective) || storedContent != content || status != "draft" {
		t.Fatalf("duplicate persistence: key=%q version=%q effectiveAt=%s content=%q status=%q", key, version, storedEffective, storedContent, status)
	}
	audit158LegalTransitionsRejectMalformedUUIDs(t)
}

func TestAudit158LegalPolicyDuplicateSupportsNullableContentAndMaximumVersion(t *testing.T) {
	f := audit158LegalSetup(t)
	content := "maximum version content"
	for _, fixture := range []struct {
		name, version string
		content       *string
		wantVersion   string
	}{
		{name: "nullable content", version: "null-body", wantVersion: "null-body-draft"},
		{name: "maximum version", version: strings.Repeat("v", 32), content: &content},
	} {
		t.Run(fixture.name, func(t *testing.T) {
			source := f.seed(t, fixture.version, "draft", fixture.content)
			res := f.call(http.MethodPost, audit158LegalPath+"/"+source+"/duplicate", "", f.token)
			audit158LegalStatus(t, res, http.StatusCreated)
			var copyResult struct {
				ID string `json:"id"`
			}
			if err := json.Unmarshal(res.Body.Bytes(), &copyResult); err != nil || !isValidUUID(copyResult.ID) {
				t.Fatalf("duplicate response: %s err=%v", res.Body.String(), err)
			}
			var copiedVersion, copiedStatus string
			var copiedContent *string
			if err := f.db.QueryRow(context.Background(), `SELECT version,status,content_md FROM legal.legal_policy WHERE id=$1`, copyResult.ID).Scan(&copiedVersion, &copiedStatus, &copiedContent); err != nil {
				t.Fatal(err)
			}
			if fixture.wantVersion != "" && copiedVersion != fixture.wantVersion || copiedStatus != "draft" || (fixture.content == nil) != (copiedContent == nil) || fixture.content != nil && *fixture.content != *copiedContent {
				t.Fatalf("copied nullable/long contract: version=%q status=%q content=%v", copiedVersion, copiedStatus, copiedContent)
			}
		})
	}
	audit158LegalPolicyDuplicateLongVersionsDoNotCollide(t)
}

func audit158LegalPolicyDuplicateLongVersionsDoNotCollide(t *testing.T) {
	f := audit158LegalSetup(t)
	first := f.seed(t, strings.Repeat("v", 31)+"a", "draft", nil)
	second := f.seed(t, strings.Repeat("v", 31)+"b", "draft", nil)
	versions := make([]string, 0, 2)
	for _, id := range []string{first, second} {
		res := f.call(http.MethodPost, audit158LegalPath+"/"+id+"/duplicate", "", f.token)
		audit158LegalStatus(t, res, http.StatusCreated)
		var copyResult struct {
			ID string `json:"id"`
		}
		if err := json.Unmarshal(res.Body.Bytes(), &copyResult); err != nil || !isValidUUID(copyResult.ID) {
			t.Fatalf("duplicate response: %s err=%v", res.Body.String(), err)
		}
		var version string
		if err := f.db.QueryRow(context.Background(), `SELECT version FROM legal.legal_policy WHERE id=$1`, copyResult.ID).Scan(&version); err != nil {
			t.Fatal(err)
		}
		if len([]rune(version)) > 32 || !strings.HasSuffix(version, "-draft") {
			t.Fatalf("invalid duplicated version %q", version)
		}
		if len([]rune(version)) != 31 || !strings.HasPrefix(version, strings.Repeat("v", 4)+"-") {
			t.Fatalf("long duplicate must keep a four-rune source prefix and 96-bit bounded digest: %q", version)
		}
		versions = append(versions, version)
	}
	if versions[0] == versions[1] {
		t.Fatalf("distinct source versions collided as %q", versions[0])
	}
}

func audit158LegalTransitionsRejectMalformedUUIDs(t *testing.T) {
	f := audit158LegalSetup(t)
	for _, route := range []struct{ method, suffix string }{
		{http.MethodPatch, "/publish"},
		{http.MethodPatch, "/archive"},
		{http.MethodPost, "/duplicate"},
	} {
		t.Run(route.method+route.suffix, func(t *testing.T) {
			res := f.call(route.method, audit158LegalPath+"/not-a-uuid"+route.suffix, "", f.token)
			audit158LegalStatus(t, res, http.StatusBadRequest)
		})
	}
}

func TestAudit158LegalAuditFailureRollsBack(t *testing.T) {
	f := audit158LegalSetup(t)
	ctx := context.Background()
	name := "audit158_legal_" + strings.ReplaceAll(f.actorID, "-", "")
	// Only this fixture's actor fails audit writes; other concurrent fixtures are unaffected.
	if _, err := f.db.Exec(ctx, fmt.Sprintf(`CREATE FUNCTION ops.%s() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN IF NEW.actor_id='%s'::uuid THEN RAISE EXCEPTION 'audit158 audit failure'; END IF; RETURN NEW; END $$`, name, f.actorID)); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if _, err := f.db.Exec(ctx, "DROP TRIGGER IF EXISTS "+name+" ON ops.admin_audit_log"); err != nil {
			t.Error(err)
		}
		if _, err := f.db.Exec(ctx, "DROP FUNCTION ops."+name+"()"); err != nil {
			t.Error(err)
		}
	})
	if _, err := f.db.Exec(ctx, "CREATE TRIGGER "+name+" BEFORE INSERT ON ops.admin_audit_log FOR EACH ROW EXECUTE FUNCTION ops."+name+"()"); err != nil {
		t.Fatal(err)
	}
	body := "original"
	id := f.seed(t, "rollback", "draft", &body)
	create := fmt.Sprintf(`{"policyKey":"legal_document","version":%q,"effectiveAt":%q}`, f.actorID[:32], time.Now().Add(48*time.Hour).Format(time.RFC3339))
	for _, route := range []struct{ method, path, body string }{
		{http.MethodPost, audit158LegalPath, create},
		{http.MethodPatch, audit158LegalPath + "/" + id, `{"contentMd":"must roll back"}`},
		{http.MethodDelete, audit158LegalPath + "/" + id, ""},
	} {
		t.Run(route.method, func(t *testing.T) {
			res := f.call(route.method, route.path, route.body, f.token)
			audit158LegalStatus(t, res, http.StatusInternalServerError)
			if strings.Contains(res.Body.String(), "audit158 audit failure") {
				t.Fatalf("database error leaked: %s", res.Body.String())
			}
			var content string
			if err := f.db.QueryRow(ctx, `SELECT content_md FROM legal.legal_policy WHERE id=$1`, id).Scan(&content); err != nil || content != body {
				t.Fatalf("mutation survived failed audit: content=%q err=%v", content, err)
			}
			var created, audits int
			if err := f.db.QueryRow(ctx, `SELECT count(*) FROM legal.legal_policy WHERE policy_key='legal_document' AND version=$1`, f.actorID[:32]).Scan(&created); err != nil || created != 0 {
				t.Fatalf("create survived failed audit: rows=%d err=%v", created, err)
			}
			if err := f.db.QueryRow(ctx, `SELECT count(*) FROM ops.admin_audit_log WHERE actor_id=$1`, f.actorID).Scan(&audits); err != nil || audits != 0 {
				t.Fatalf("failed mutation audit rows=%d err=%v", audits, err)
			}
		})
	}
	for _, route := range []struct{ method, action string }{
		{http.MethodPatch, "publish"},
		{http.MethodPatch, "archive"},
		{http.MethodPost, "duplicate"},
	} {
		t.Run(route.action, func(t *testing.T) {
			targetID := f.seed(t, route.action, "draft", &body)
			res := f.call(route.method, audit158LegalPath+"/"+targetID+"/"+route.action, "", f.token)
			audit158LegalStatus(t, res, http.StatusInternalServerError)
			var storedStatus string
			if err := f.db.QueryRow(ctx, `SELECT status FROM legal.legal_policy WHERE id=$1`, targetID).Scan(&storedStatus); err != nil || storedStatus != "draft" {
				t.Fatalf("audit failure left %s status=%q err=%v", route.action, storedStatus, err)
			}
			if route.action == "duplicate" {
				var copies int
				if err := f.db.QueryRow(ctx, `SELECT count(*) FROM legal.legal_policy WHERE policy_key=$1 AND version=$2`, f.key, route.action+"-draft").Scan(&copies); err != nil || copies != 0 {
					t.Fatalf("audit failure left %d duplicate row(s), err=%v", copies, err)
				}
			}
		})
	}
}

func TestAudit158LegalPolicyDELETE(t *testing.T) {
	f := audit158LegalSetup(t)
	id := f.seed(t, "v1", "draft", nil)
	res := f.call(http.MethodDelete, audit158LegalPath+"/"+id, "", f.token)
	audit158LegalStatus(t, res, http.StatusOK)
	if !strings.Contains(res.Body.String(), `"deleted":true`) {
		t.Fatalf("delete response: %s", res.Body.String())
	}
	var count int
	if err := f.db.QueryRow(context.Background(), `SELECT count(*) FROM legal.legal_policy WHERE id=$1`, id).Scan(&count); err != nil || count != 0 {
		t.Fatalf("DELETE persistence rows=%d err=%v", count, err)
	}
	f.audit(t, id, "legal.policy.deleted")
	audit158LegalStatus(t, f.call(http.MethodDelete, audit158LegalPath+"/"+id, "", f.token), http.StatusNotFound)
	audit158LegalStatus(t, f.call(http.MethodDelete, audit158LegalPath+"/invalid", "", f.token), http.StatusBadRequest)
	for _, state := range []string{"published", "archived"} {
		locked := f.seed(t, state, state, nil)
		audit158LegalStatus(t, f.call(http.MethodDelete, audit158LegalPath+"/"+locked, "", f.token), http.StatusBadRequest)
		if err := f.db.QueryRow(context.Background(), `SELECT count(*) FROM legal.legal_policy WHERE id=$1`, locked).Scan(&count); err != nil || count != 1 {
			t.Fatalf("protected policy rows=%d err=%v", count, err)
		}
	}
}

func TestAudit158LegalAuthorization(t *testing.T) {
	f := audit158LegalSetup(t)
	content := "legal fixture"
	id := f.seed(t, "auth", "draft", &content)
	sessions := session.NewStore(f.db)
	for _, permission := range []string{"", "admin.legal.read", "legal.admin", "iam.manage"} {
		actor := newUUID(t)
		seedAdminActor(t, f.db, actor, "audit158-auth-"+actor+"@example.test", "Legal auth")
		if permission != "" {
			grantAdminPermission(t, f.db, actor, permission)
		}
		token := createAdminSession(t, sessions, actor)
		duplicateSource := f.seed(t, "auth-"+actor[:8], "draft", &content)
		for _, route := range []struct{ method, path, body string }{
			{http.MethodGet, audit158LegalPath + "?policyKey=" + f.key, ""},
			{http.MethodPost, audit158LegalPath, `{}`},
			{http.MethodDelete, audit158LegalPath + "/" + newUUID(t), ""},
			{http.MethodGet, audit158LegalPath + "/" + id, ""},
			{http.MethodGet, audit158LegalPath + "/" + id + "/diff?against=" + id, ""},
			{http.MethodPatch, audit158LegalPath + "/" + id, `{}`},
			{http.MethodPatch, audit158LegalPath + "/" + id + "/publish", ""},
			{http.MethodPatch, audit158LegalPath + "/" + id + "/archive", ""},
			{http.MethodPost, audit158LegalPath + "/" + duplicateSource + "/duplicate", ""},
		} {
			t.Run(permission+route.method+route.path, func(t *testing.T) {
				audit158LegalStatus(t, f.call(route.method, route.path, route.body, ""), http.StatusUnauthorized)
				want := http.StatusForbidden
				if permission != "" && route.method == http.MethodGet {
					want = http.StatusOK
				}
				if permission == "legal.admin" || permission == "iam.manage" {
					if route.method == http.MethodDelete {
						want = http.StatusNotFound
					} else if route.method != http.MethodGet {
						want = http.StatusBadRequest
					}
					if strings.HasSuffix(route.path, "/publish") || strings.HasSuffix(route.path, "/archive") {
						want = http.StatusOK
					} else if strings.HasSuffix(route.path, "/duplicate") {
						want = http.StatusCreated
					}
				}
				audit158LegalStatus(t, f.call(route.method, route.path, route.body, token), want)
			})
		}
	}
}

func TestAudit158LegalMutationRejectsUntrustedOriginBeforeParsing(t *testing.T) {
	f := audit158LegalSetup(t)
	id := f.seed(t, "csrf", "draft", nil)
	for _, route := range []struct{ method, path string }{
		{http.MethodPost, audit158LegalPath},
		{http.MethodPatch, audit158LegalPath + "/" + id},
		{http.MethodPatch, audit158LegalPath + "/" + id + "/publish"},
		{http.MethodPatch, audit158LegalPath + "/" + id + "/archive"},
		{http.MethodPost, audit158LegalPath + "/" + id + "/duplicate"},
		{http.MethodDelete, audit158LegalPath + "/" + id},
	} {
		t.Run(route.method+route.path, func(t *testing.T) {
			res := f.callOrigin(route.method, route.path, "{", f.token, "https://attacker.invalid")
			if res.Code != http.StatusForbidden {
				t.Fatalf("csrf blocked an untrusted Origin before input validation: status=%d body=%s", res.Code, res.Body.String())
			}
		})
	}
}
