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
	"time"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/authz"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/credential"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/search"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

func TestAdminOperationsWave5RequiresPermission(t *testing.T) {
	db := testPool(t)
	ctx := context.Background()
	var indexedDocuments [][]search.Document
	searchTaskID := int64(0)
	rejectSearchDocuments := false
	searchServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/indexes/content_search/documents":
			_, _ = w.Write([]byte(`{"results":[],"total":0}`))
		case r.Method == http.MethodPost && r.URL.Path == "/indexes/content_search/documents":
			if rejectSearchDocuments {
				http.Error(w, `{"message":"temporarily unavailable"}`, http.StatusServiceUnavailable)
				return
			}
			var documents []search.Document
			if err := json.NewDecoder(r.Body).Decode(&documents); err != nil {
				t.Errorf("decode indexed projection: %v", err)
			}
			indexedDocuments = append(indexedDocuments, documents)
			searchTaskID++
			w.WriteHeader(http.StatusAccepted)
			_, _ = fmt.Fprintf(w, `{"taskUid":%d,"status":"enqueued"}`, searchTaskID)
		case r.Method == http.MethodPost && r.URL.Path == "/indexes/content_search/documents/delete-batch":
			searchTaskID++
			w.WriteHeader(http.StatusAccepted)
			_, _ = fmt.Fprintf(w, `{"taskUid":%d,"status":"enqueued"}`, searchTaskID)
		default:
			t.Errorf("unexpected Meilisearch request: %s %s", r.Method, r.URL.RequestURI())
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(searchServer.Close)
	store := session.NewStore(db)
	rateLimiter, err := authn.NewRateLimiter(authn.RateLimiterConfig{Limit: 100, Window: time.Minute, TTL: time.Minute, EvictEvery: time.Minute, MaxKeys: 1000})
	if err != nil {
		t.Fatalf("create rate limiter: %v", err)
	}
	router := NewRouter(Dependencies{
		Config: &config.Config{CORSOrigins: []string{"http://localhost:3000"}}, Logger: slog.Default(),
		DBPool: db, SessionStore: store, RBACStore: authz.NewStore(db), CredentialStore: credential.NewStore(db),
		RateLimiter: rateLimiter, SearchClient: search.NewClient(searchServer.URL, ""),
	})
	srv := httptest.NewServer(router)
	t.Cleanup(srv.Close)

	deniedActor := newUUID(t)
	seedAdminActor(t, db, deniedActor, fmt.Sprintf("wave5-denied-%s@example.test", deniedActor[:8]), "Wave 5 denied")
	deniedSession := createAdminSession(t, store, deniedActor)
	allowedActor := newUUID(t)
	seedAdminActor(t, db, allowedActor, fmt.Sprintf("wave5-allowed-%s@example.test", allowedActor[:8]), "Wave 5 allowed")
	allowedSession := createAdminSession(t, store, allowedActor)
	grantAdminPermission(t, db, allowedActor, "iam.manage")
	key := "wave5." + strings.ReplaceAll(newUUID(t), "-", "")[:20]
	if _, err := db.Exec(ctx, `INSERT INTO ops.feature_flag (key,enabled,kill_switch,rules,created_at,updated_at) VALUES ($1,true,true,'{}',now(),now())`, key); err != nil {
		t.Fatalf("seed kill switch: %v", err)
	}
	var openBefore, failedBefore, errorsBefore int
	if err := db.QueryRow(ctx, `SELECT count(*) FILTER (WHERE status='open'),count(*) FILTER (WHERE status='failed') FROM ops.dead_letter_entry`).Scan(&openBefore, &failedBefore); err != nil {
		t.Fatalf("count existing dead letters: %v", err)
	}
	if err := db.QueryRow(ctx, `SELECT count(*) FROM content.content_import_error WHERE severity='error'`).Scan(&errorsBefore); err != nil {
		t.Fatalf("count existing import errors: %v", err)
	}
	openID, failedID, batchID, importErrorID := newUUID(t), newUUID(t), newUUID(t), newUUID(t)
	for id, status := range map[string]string{openID: "open", failedID: "failed"} {
		if _, err := db.Exec(ctx, `INSERT INTO ops.dead_letter_entry (id,source,queue_name,event_type,payload,status,retry_count) VALUES ($1,'wave5','wave5.queue','wave5.event','{"fixture":true}',$2,0)`, id, status); err != nil {
			t.Fatalf("seed %s dead letter: %v", status, err)
		}
	}
	if _, err := db.Exec(ctx, `INSERT INTO content.content_import_batch (id,source_type,source_dir,status,file_count,item_count,error_count,updated_at) VALUES ($1,'wave5','disposable','failed',1,1,1,now())`, batchID); err != nil {
		t.Fatalf("seed import batch: %v", err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO content.content_import_error (id,import_batch_id,phase,severity,code,message,sample) VALUES ($1,$2,'validate','error','WAVE5','disposable import error','{}')`, importErrorID, batchID); err != nil {
		t.Fatalf("seed import error: %v", err)
	}
	lexemeID, kanjiID := newUUID(t), newUUID(t)
	if _, err := db.Exec(ctx, `INSERT INTO content.lexeme (id,headword,reading,short_meaning_vi,status,created_at,updated_at) VALUES ($1,'wave5 lexeme','うぇーぶ','fixture','active',now(),now())`, lexemeID); err != nil {
		t.Fatalf("seed lexeme projection fixture: %v", err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO content.kanji (id,character,meaning_vi,status,created_at,updated_at) VALUES ($1,'波','fixture','active',now(),now())`, kanjiID); err != nil {
		t.Fatalf("seed kanji projection fixture: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, `DELETE FROM ops.feature_flag_audit WHERE flag_key=$1`, key)
		_, _ = db.Exec(ctx, `DELETE FROM ops.admin_audit_log WHERE actor_id=$1 OR target_id=$2`, allowedActor, key)
		_, _ = db.Exec(ctx, `DELETE FROM ops.dead_letter_entry WHERE id=ANY($1::uuid[])`, []string{openID, failedID})
		_, _ = db.Exec(ctx, `DELETE FROM content.content_import_error WHERE id=$1`, importErrorID)
		_, _ = db.Exec(ctx, `DELETE FROM content.content_import_batch WHERE id=$1`, batchID)
		_, _ = db.Exec(ctx, `DELETE FROM content.lexeme WHERE id=$1`, lexemeID)
		_, _ = db.Exec(ctx, `DELETE FROM content.kanji WHERE id=$1`, kanjiID)
		_, _ = db.Exec(ctx, `DELETE FROM ops.feature_flag WHERE key=$1`, key)
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
				req.Header.Set("X-CSRF-Token", "wave5-csrf")
			}
		}
		res := httptest.NewRecorder()
		router.ServeHTTP(res, req)
		return res
	}
	routes := []struct {
		method, path, body string
		write              bool
	}{
		{http.MethodPatch, "/api/admin/operations/kill-switches/" + key, `{"enabled":false,"reason":"Wave 5 validation"}`, true},
		{http.MethodGet, "/api/admin/operations/notifications", "", false},
		{http.MethodPatch, "/api/admin/operations/search-rebuild", `{"reason":"Wave 5 validation"}`, true},
		{http.MethodPost, "/api/admin/operations/search-rebuild/partial", `{"contentType":"lexeme","reason":"Wave 5 validation"}`, true},
	}
	for _, route := range routes {
		t.Run(route.method+" "+route.path, func(t *testing.T) {
			if got := call(route.method, route.path, route.body, "", true).Code; got != http.StatusUnauthorized {
				t.Fatalf("anonymous status=%d; want 401", got)
			}
			if got := call(route.method, route.path, route.body, deniedSession, true).Code; got != http.StatusForbidden {
				t.Fatalf("admin without iam.manage status=%d; want 403", got)
			}
			if route.write {
				if got := call(route.method, route.path, route.body, allowedSession, false).Code; got != http.StatusForbidden {
					t.Fatalf("missing CSRF status=%d; want 403", got)
				}
			}
		})
	}

	t.Run("kill switch confirmation, persistence, and both audits", func(t *testing.T) {
		unconfirmed := call(http.MethodPatch, "/api/admin/operations/kill-switches/"+key, `{"enabled":false,"reason":"disable safely"}`, allowedSession, true)
		if unconfirmed.Code != http.StatusBadRequest || !strings.Contains(unconfirmed.Body.String(), "high_risk_confirmation_required") {
			t.Fatalf("unconfirmed status=%d body=%s", unconfirmed.Code, unconfirmed.Body.String())
		}
		var enabled bool
		if err := db.QueryRow(ctx, `SELECT enabled FROM ops.feature_flag WHERE key=$1`, key).Scan(&enabled); err != nil || !enabled {
			t.Fatalf("unconfirmed update persisted enabled=%t err=%v", enabled, err)
		}
		res := call(http.MethodPatch, "/api/admin/operations/kill-switches/"+key, fmt.Sprintf(`{"enabled":false,"rules":{"rolloutPercent":0},"reason":" disable safely ","confirmation":%q}`, key), allowedSession, true)
		if res.Code != http.StatusOK {
			t.Fatalf("update status=%d body=%s", res.Code, res.Body.String())
		}
		if err := db.QueryRow(ctx, `SELECT enabled FROM ops.feature_flag WHERE key=$1`, key).Scan(&enabled); err != nil || enabled {
			t.Fatalf("enabled=%t err=%v", enabled, err)
		}
		var count int
		if err := db.QueryRow(ctx, `SELECT count(*) FROM ops.feature_flag_audit WHERE flag_key=$1 AND actor_id=$2 AND reason='disable safely'`, key, allowedActor).Scan(&count); err != nil || count != 1 {
			t.Fatalf("feature audit count=%d err=%v", count, err)
		}
		if err := db.QueryRow(ctx, `SELECT count(*) FROM ops.admin_audit_log WHERE target_id=$1 AND actor_id=$2 AND action='ops.feature_flag.update' AND reason='disable safely'`, key, allowedActor).Scan(&count); err != nil || count != 1 {
			t.Fatalf("admin audit count=%d err=%v", count, err)
		}
		for _, body := range []string{`{"enabled":true,"reason":" "}`, `{"enabled":true,"rules":[],"reason":"valid reason"}`} {
			if got := call(http.MethodPatch, "/api/admin/operations/kill-switches/"+key, body, allowedSession, true).Code; got != http.StatusBadRequest {
				t.Errorf("invalid kill switch body status=%d body=%s", got, body)
			}
		}
		if _, err := db.Exec(ctx, `ALTER TABLE ops.feature_flag_audit RENAME TO wave5_feature_flag_audit`); err != nil {
			t.Fatalf("rename feature audit table: %v", err)
		}
		failed := call(http.MethodPatch, "/api/admin/operations/kill-switches/"+key, fmt.Sprintf(`{"enabled":true,"reason":"rollback test","confirmation":%q}`, key), allowedSession, true)
		if _, err := db.Exec(ctx, `ALTER TABLE ops.wave5_feature_flag_audit RENAME TO feature_flag_audit`); err != nil {
			t.Fatalf("restore feature audit table: %v", err)
		}
		if failed.Code != http.StatusInternalServerError {
			t.Fatalf("audit failure status=%d body=%s; want 500", failed.Code, failed.Body.String())
		}
		if err := db.QueryRow(ctx, `SELECT enabled FROM ops.feature_flag WHERE key=$1`, key).Scan(&enabled); err != nil || enabled {
			t.Fatalf("failed update was not rolled back: enabled=%t err=%v", enabled, err)
		}
	})

	t.Run("notifications returns real status and database errors", func(t *testing.T) {
		res := call(http.MethodGet, "/api/admin/operations/notifications", "", allowedSession, true)
		var summary struct {
			OpenDeadLetters   int    `json:"openDeadLetters"`
			FailedDeadLetters int    `json:"failedDeadLetters"`
			ImportErrors      int    `json:"importErrorsHighSeverity"`
			Status            string `json:"status"`
			GeneratedAt       string `json:"generatedAt"`
		}
		if err := json.Unmarshal(res.Body.Bytes(), &summary); err != nil {
			t.Fatalf("decode notifications status=%d body=%s: %v", res.Code, res.Body.String(), err)
		}
		if res.Code != http.StatusOK || summary.OpenDeadLetters != openBefore+1 || summary.FailedDeadLetters != failedBefore+1 || summary.ImportErrors != errorsBefore+1 || summary.Status != "degraded" || summary.GeneratedAt == "" {
			t.Fatalf("notifications status=%d body=%s expected open=%d failed=%d errors=%d", res.Code, res.Body.String(), openBefore+1, failedBefore+1, errorsBefore+1)
		}
		if _, err := db.Exec(ctx, `ALTER TABLE ops.dead_letter_entry RENAME TO wave5_dead_letter_entry`); err != nil {
			t.Fatalf("rename table for query-error test: %v", err)
		}
		failed := call(http.MethodGet, "/api/admin/operations/notifications", "", allowedSession, true)
		if _, err := db.Exec(ctx, `ALTER TABLE ops.wave5_dead_letter_entry RENAME TO dead_letter_entry`); err != nil {
			t.Fatalf("restore table: %v", err)
		}
		if failed.Code != http.StatusInternalServerError {
			t.Fatalf("query failure status=%d body=%s; want 500", failed.Code, failed.Body.String())
		}
	})

	t.Run("search rebuild validates and persists audit", func(t *testing.T) {
		full := call(http.MethodPatch, "/api/admin/operations/search-rebuild", `{"reason":"full rebuild"}`, allowedSession, true)
		if full.Code != http.StatusOK || !strings.Contains(full.Body.String(), `"status":"rebuild_enqueued"`) {
			t.Fatalf("full rebuild status=%d body=%s", full.Code, full.Body.String())
		}
		if len(indexedDocuments) != 1 || !containsSearchDocument(indexedDocuments[0], lexemeID) || !containsSearchDocument(indexedDocuments[0], kanjiID) {
			t.Fatalf("full rebuild projection did not include canonical fixture documents: %+v", indexedDocuments)
		}
		partial := call(http.MethodPost, "/api/admin/operations/search-rebuild/partial", `{"contentType":"kanji","reason":"partial rebuild"}`, allowedSession, true)
		if partial.Code != http.StatusOK || !strings.Contains(partial.Body.String(), `"contentType":"kanji"`) || !strings.Contains(partial.Body.String(), `"status":"rebuild_enqueued"`) {
			t.Fatalf("partial rebuild status=%d body=%s", partial.Code, partial.Body.String())
		}
		if len(indexedDocuments) != 2 || len(indexedDocuments[1]) != 1 || indexedDocuments[1][0].ID != kanjiID || indexedDocuments[1][0].Kind != "kanji" {
			t.Fatalf("partial rebuild escaped requested kind: %+v", indexedDocuments)
		}
		for _, body := range []string{`{"reason":" "}`, `{"reason":"ok"}`} {
			if got := call(http.MethodPatch, "/api/admin/operations/search-rebuild", body, allowedSession, true).Code; got != http.StatusBadRequest {
				t.Errorf("invalid full rebuild body status=%d body=%s", got, body)
			}
		}
		for _, body := range []string{`{"contentType":"unknown","reason":"valid reason"}`, `{"contentType":"lexeme","reason":" "}`} {
			if got := call(http.MethodPost, "/api/admin/operations/search-rebuild/partial", body, allowedSession, true).Code; got != http.StatusBadRequest {
				t.Errorf("invalid partial rebuild body status=%d body=%s", got, body)
			}
		}
		beforeFailure := len(indexedDocuments)
		if _, err := db.Exec(ctx, `ALTER VIEW reporting.v_content_search_documents RENAME TO wave5_search_documents`); err != nil {
			t.Fatalf("rename projection view for DB error test: %v", err)
		}
		dbFailure := call(http.MethodPatch, "/api/admin/operations/search-rebuild", `{"reason":"projection failure"}`, allowedSession, true)
		if _, err := db.Exec(ctx, `ALTER VIEW reporting.wave5_search_documents RENAME TO v_content_search_documents`); err != nil {
			t.Fatalf("restore projection view: %v", err)
		}
		if dbFailure.Code != http.StatusInternalServerError || len(indexedDocuments) != beforeFailure {
			t.Fatalf("projection failure status=%d indexed=%d before=%d body=%s", dbFailure.Code, len(indexedDocuments), beforeFailure, dbFailure.Body.String())
		}
		rejectSearchDocuments = true
		meiliFailure := call(http.MethodPost, "/api/admin/operations/search-rebuild/partial", `{"contentType":"kanji","reason":"meili failure"}`, allowedSession, true)
		rejectSearchDocuments = false
		if meiliFailure.Code != http.StatusBadGateway || len(indexedDocuments) != beforeFailure {
			t.Fatalf("Meilisearch failure status=%d indexed=%d before=%d body=%s", meiliFailure.Code, len(indexedDocuments), beforeFailure, meiliFailure.Body.String())
		}
		var count int
		if err := db.QueryRow(ctx, `SELECT count(*) FROM ops.admin_audit_log WHERE actor_id=$1 AND action IN ('ops.search.rebuild','ops.search.rebuild.partial')`, allowedActor).Scan(&count); err != nil || count != 2 {
			t.Fatalf("search audit count=%d err=%v", count, err)
		}
		var auditAfter []byte
		if err := db.QueryRow(ctx, `SELECT after FROM ops.admin_audit_log WHERE actor_id=$1 AND action='ops.search.rebuild.partial' ORDER BY created_at DESC LIMIT 1`, allowedActor).Scan(&auditAfter); err != nil {
			t.Fatalf("read search audit result: %v", err)
		}
		var auditResult struct {
			Status        string  `json:"status"`
			DocumentCount int     `json:"documentCount"`
			TaskUIDs      []int64 `json:"taskUids"`
		}
		if err := json.Unmarshal(auditAfter, &auditResult); err != nil || auditResult.Status != "rebuild_enqueued" || auditResult.DocumentCount != 1 || len(auditResult.TaskUIDs) != 1 {
			t.Fatalf("audit does not describe the actual task: after=%s result=%+v err=%v", auditAfter, auditResult, err)
		}
		if _, err := db.Exec(ctx, `ALTER TABLE ops.admin_audit_log RENAME TO wave5_admin_audit_log`); err != nil {
			t.Fatalf("rename admin audit table: %v", err)
		}
		failed := call(http.MethodPatch, "/api/admin/operations/search-rebuild", `{"reason":"audit failure"}`, allowedSession, true)
		if _, err := db.Exec(ctx, `ALTER TABLE ops.wave5_admin_audit_log RENAME TO admin_audit_log`); err != nil {
			t.Fatalf("restore admin audit table: %v", err)
		}
		if failed.Code != http.StatusInternalServerError {
			t.Fatalf("audit failure status=%d body=%s; want 500", failed.Code, failed.Body.String())
		}
	})
}

func containsSearchDocument(documents []search.Document, id string) bool {
	for _, document := range documents {
		if document.ID == id {
			return true
		}
	}
	return false
}

func TestReindexRouteUsesCanonicalProjection(t *testing.T) {
	db := testPool(t)
	ctx := context.Background()
	fixtureID := newUUID(t)
	if _, err := db.Exec(ctx, `INSERT INTO content.lexeme (id,headword,reading,short_meaning_vi,status,created_at,updated_at) VALUES ($1,'route fixture','るーと','fixture','active',now(),now())`, fixtureID); err != nil {
		t.Fatalf("seed search projection fixture: %v", err)
	}
	t.Cleanup(func() { _, _ = db.Exec(ctx, `DELETE FROM content.lexeme WHERE id=$1`, fixtureID) })
	var indexed []search.Document
	meili := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/indexes/content_search/documents":
			_, _ = w.Write([]byte(`{"results":[],"total":0}`))
		case r.Method == http.MethodPost && r.URL.Path == "/indexes/content_search/documents":
			if r.URL.Query().Get("primaryKey") != "id" {
				t.Errorf("primaryKey=%q", r.URL.Query().Get("primaryKey"))
			}
			if err := json.NewDecoder(r.Body).Decode(&indexed); err != nil {
				t.Errorf("decode submitted documents: %v", err)
			}
			w.WriteHeader(http.StatusAccepted)
			_, _ = w.Write([]byte(`{"taskUid":77}`))
		default:
			t.Errorf("unexpected Meilisearch request: %s %s", r.Method, r.URL.RequestURI())
			http.NotFound(w, r)
		}
	}))
	defer meili.Close()
	store := session.NewStore(db)
	rateLimiter, err := authn.NewRateLimiter(authn.RateLimiterConfig{Limit: 100, Window: time.Minute, TTL: time.Minute, EvictEvery: time.Minute, MaxKeys: 1000})
	if err != nil {
		t.Fatalf("create rate limiter: %v", err)
	}
	router := NewRouter(Dependencies{
		Config: &config.Config{CORSOrigins: []string{"http://localhost:3000"}}, Logger: slog.Default(),
		DBPool: db, SessionStore: store, RBACStore: authz.NewStore(db), CredentialStore: credential.NewStore(db),
		RateLimiter: rateLimiter, SearchClient: search.NewClient(meili.URL, ""),
	})
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, fmt.Sprintf("search-route-%s@example.test", actorID[:8]), "Search route admin")
	grantAdminPermission(t, db, actorID, "iam.manage")
	token := createAdminSession(t, store, actorID)
	req := httptest.NewRequest(http.MethodPost, "/api/search/index", nil)
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("X-CSRF-Token", "search-route-csrf")
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)
	if res.Code != http.StatusOK || !strings.Contains(res.Body.String(), `"taskUids":[77]`) {
		t.Fatalf("POST /api/search/index status=%d body=%s", res.Code, res.Body.String())
	}
	if !containsSearchDocument(indexed, fixtureID) {
		t.Fatalf("POST /api/search/index omitted canonical fixture: %+v", indexed)
	}
}
