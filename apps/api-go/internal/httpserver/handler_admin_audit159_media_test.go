package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

type audit159MediaFixture struct {
	db      *pgxpool.Pool
	server  *httptest.Server
	token   string
	actorID string
	assetID string
}

func newAudit159MediaFixture(t *testing.T) audit159MediaFixture {
	t.Helper()
	db := testPool(t)
	server, sessions := adminRBACTestServerWithPool(t, db)
	actorID, assetID := newUUID(t), newUUID(t)
	seedAdminActor(t, db, actorID, "audit159-media-"+actorID+"@example.test", "AUDIT-159 media")
	grantAdminPermission(t, db, actorID, "admin.content.read")
	grantAdminPermission(t, db, actorID, "admin.content.write")
	if _, err := db.Exec(context.Background(), `INSERT INTO media.asset (id,object_key,source_url,mime_type,byte_size,rights_status,license,provenance,accessibility,status,updated_at) VALUES ($1,$2,NULL,'image/png',NULL,'pending_review','CC-BY', '{"source":"audit159"}','{"alt":"fixture"}','active',NOW())`, assetID, "audit159/"+assetID+".png"); err != nil {
		t.Fatal(err)
	}
	f := audit159MediaFixture{db: db, server: server, actorID: actorID, assetID: assetID, token: createAdminSession(t, sessions, actorID)}
	t.Cleanup(func() {
		server.Close()
		_, _ = db.Exec(context.Background(), `DELETE FROM ops.admin_audit_log WHERE actor_id=$1 OR target_id=$2`, actorID, assetID)
		_, _ = db.Exec(context.Background(), `DELETE FROM media.asset WHERE id=$1`, assetID)
	})
	return f
}

func (f audit159MediaFixture) call(t *testing.T, method, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "http://localhost:3000")
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: f.token})
	res := httptest.NewRecorder()
	f.server.Config.Handler.ServeHTTP(res, req)
	return res
}

func TestAudit159MediaListAndDetailReturnPersistedMetadata(t *testing.T) {
	f := newAudit159MediaFixture(t)
	list := f.call(t, http.MethodGet, "/api/admin/media?status=active&q=audit159", "")
	if list.Code != http.StatusOK || !strings.Contains(list.Body.String(), `"total":1`) || !strings.Contains(list.Body.String(), f.assetID) || !strings.Contains(list.Body.String(), `"rightsStatus":"pending_review"`) || !strings.Contains(list.Body.String(), `"sourceUrl":null`) || !strings.Contains(list.Body.String(), `"byteSize":null`) {
		t.Fatalf("media list status=%d body=%s", list.Code, list.Body.String())
	}
	detail := f.call(t, http.MethodGet, "/api/admin/media/"+f.assetID, "")
	if detail.Code != http.StatusOK {
		t.Fatalf("media detail status=%d body=%s", detail.Code, detail.Body.String())
	}
	var asset map[string]any
	if err := json.Unmarshal(detail.Body.Bytes(), &asset); err != nil {
		t.Fatal(err)
	}
	if asset["id"] != f.assetID || asset["mimeType"] != "image/png" || asset["status"] != "active" || asset["sourceUrl"] != nil || asset["sizeBytes"] != nil || asset["provenance"] == nil || asset["accessibility"] == nil {
		t.Fatalf("media detail missing stored fields: %s", detail.Body.String())
	}
}

func TestAudit159MediaListUsesClientByteSizeField(t *testing.T) {
	f := newAudit159MediaFixture(t)
	list := f.call(t, http.MethodGet, "/api/admin/media?status=active&q=audit159", "")
	if list.Code != http.StatusOK || !strings.Contains(list.Body.String(), `"byteSize":null`) {
		t.Fatalf("media byteSize contract status=%d body=%s", list.Code, list.Body.String())
	}
}

func TestAudit159MediaMetadataPatchAndSoftDeletePersistAndAudit(t *testing.T) {
	f := newAudit159MediaFixture(t)
	patch := f.call(t, http.MethodPatch, "/api/admin/media/"+f.assetID+"/metadata", fmt.Sprintf(`{"license":"CC0","rightsStatus":"cleared","provenance":{"source":"audit159-updated"},"reason":"audit fixture update"}`))
	if patch.Code != http.StatusOK || !strings.Contains(patch.Body.String(), `"updated":true`) {
		t.Fatalf("metadata patch status=%d body=%s", patch.Code, patch.Body.String())
	}
	var license, rights string
	if err := f.db.QueryRow(context.Background(), `SELECT license,rights_status FROM media.asset WHERE id=$1`, f.assetID).Scan(&license, &rights); err != nil || license != "CC0" || rights != "cleared" {
		t.Fatalf("metadata not persisted: license=%q rights=%q err=%v", license, rights, err)
	}
	var auditCount int
	if err := f.db.QueryRow(context.Background(), `SELECT count(*) FROM ops.admin_audit_log WHERE actor_id=$1 AND target_id=$2 AND action='media.metadata.updated'`, f.actorID, f.assetID).Scan(&auditCount); err != nil || auditCount != 1 {
		t.Fatalf("metadata audit count=%d err=%v", auditCount, err)
	}
	deleted := f.call(t, http.MethodDelete, "/api/admin/media/"+f.assetID, `{"reason":"audit fixture cleanup"}`)
	if deleted.Code != http.StatusOK || !strings.Contains(deleted.Body.String(), `"status":"deleted"`) {
		t.Fatalf("media delete status=%d body=%s", deleted.Code, deleted.Body.String())
	}
	var status string
	if err := f.db.QueryRow(context.Background(), `SELECT status FROM media.asset WHERE id=$1`, f.assetID).Scan(&status); err != nil || status != "deleted" {
		t.Fatalf("media soft delete state=%q err=%v", status, err)
	}
	if err := f.db.QueryRow(context.Background(), `SELECT count(*) FROM ops.admin_audit_log WHERE actor_id=$1 AND target_id=$2 AND action='media.soft_deleted'`, f.actorID, f.assetID).Scan(&auditCount); err != nil || auditCount != 1 {
		t.Fatalf("delete audit count=%d err=%v", auditCount, err)
	}
}

func TestAudit159MediaInvalidAndMissingIDsReturnClientErrors(t *testing.T) {
	f := newAudit159MediaFixture(t)
	for _, tc := range []struct {
		method string
		path   string
		body   string
		status int
	}{
		{http.MethodGet, "/api/admin/media/not-a-uuid", "", http.StatusBadRequest},
		{http.MethodGet, "/api/admin/media/" + newUUID(t), "", http.StatusNotFound},
		{http.MethodPatch, "/api/admin/media/" + newUUID(t) + "/metadata", `{"license":"CC0","reason":"valid reason"}`, http.StatusNotFound},
		{http.MethodDelete, "/api/admin/media/" + newUUID(t), `{"reason":"valid reason"}`, http.StatusNotFound},
	} {
		res := f.call(t, tc.method, tc.path, tc.body)
		if res.Code != tc.status {
			t.Errorf("%s %s status=%d want=%d body=%s", tc.method, tc.path, res.Code, tc.status, res.Body.String())
		}
	}
}
