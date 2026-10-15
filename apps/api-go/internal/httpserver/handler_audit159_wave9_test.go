package httpserver

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/media"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/profile"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

const wave9Origin = "https://app.example.test"

func wave9Router(t *testing.T, withMedia bool) (*pgxpool.Pool, http.Handler, string, string, string) {
	t.Helper()
	db := testPool(t)
	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Wave 9 media learner", "wave9-"+userID+"@example.test", "")
	sessions := session.NewStore(db)
	token := createLearnerSession(t, sessions, userID)
	deps := Dependencies{
		Config:       &config.Config{CORSOrigins: []string{wave9Origin}},
		Logger:       testLogger(),
		DBPool:       db,
		SessionStore: sessions,
		ProfileStore: profile.NewStore(db),
	}
	mediaPath := t.TempDir()
	if withMedia {
		bucket, err := media.OpenBucket(mediaPath)
		if err != nil {
			t.Fatalf("open test media bucket: %v", err)
		}
		t.Cleanup(func() { media.CloseBucket(bucket) })
		deps.Config.MediaBasePath = mediaPath
		deps.MediaStore = media.NewStore(db)
		deps.MediaBucket = bucket
		deps.RateLimiter = testRateLimiter(t)
	}
	return db, NewRouter(deps), userID, token, mediaPath
}

func wave9Request(router http.Handler, method, path, body, token string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Origin", wave9Origin)
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: token})
	}
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	return w
}

func wave9Upload(t *testing.T, router http.Handler, token string, content []byte) mediaAssetResponse {
	t.Helper()
	var body bytes.Buffer
	form := multipart.NewWriter(&body)
	part, err := form.CreateFormFile("file", "wave9.txt")
	if err != nil {
		t.Fatalf("create upload fixture: %v", err)
	}
	if _, err := part.Write(content); err != nil {
		t.Fatalf("write upload fixture: %v", err)
	}
	if err := form.Close(); err != nil {
		t.Fatalf("close upload fixture: %v", err)
	}
	req := httptest.NewRequest(http.MethodPost, "/api/media/upload", &body)
	req.Header.Set("Origin", wave9Origin)
	req.Header.Set("Content-Type", fmt.Sprintf("multipart/form-data; boundary=%s", form.Boundary()))
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: token})
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("upload status=%d body=%s", w.Code, w.Body.String())
	}
	var got mediaAssetResponse
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode upload response: %v", err)
	}
	if got.ID == "" || got.SizeBytes != int64(len(content)) {
		t.Fatalf("upload response=%+v", got)
	}
	return got
}

func cleanupWave9Asset(t *testing.T, db *pgxpool.Pool, id string) {
	t.Helper()
	t.Cleanup(func() {
		if _, err := db.Exec(context.Background(), `DELETE FROM media.asset WHERE id=$1`, id); err != nil {
			t.Errorf("delete media fixture %s: %v", id, err)
		}
	})
}

func TestAudit159Wave9MediaUploadPersistsAndStreams(t *testing.T) {
	db, router, _, token, _ := wave9Router(t, true)
	content := []byte("safe wave9 media fixture")
	asset := wave9Upload(t, router, token, content)
	cleanupWave9Asset(t, db, asset.ID)
	var owner, mimeType string
	var size int64
	if err := db.QueryRow(context.Background(), `SELECT owner_user_id::text, mime_type, byte_size FROM media.asset WHERE id=$1`, asset.ID).Scan(&owner, &mimeType, &size); err != nil {
		t.Fatalf("read persisted media asset: %v", err)
	}
	if mimeType != "text/plain" || size != int64(len(content)) || owner == "" {
		t.Fatalf("persisted media owner/type/size=%q/%q/%d", owner, mimeType, size)
	}
	w := wave9Request(router, http.MethodGet, "/api/media/"+asset.ID+"/stream", "", "")
	if w.Code != http.StatusOK || !bytes.Equal(w.Body.Bytes(), content) {
		t.Fatalf("stream status=%d body=%q", w.Code, w.Body.Bytes())
	}
}

func TestAudit159Wave9MediaPresignRequiresConfiguredProvider(t *testing.T) {
	_, router, _, token, _ := wave9Router(t, false)
	w := wave9Request(router, http.MethodPost, "/api/media/presign-upload", `{"fileName":"lesson.png","mimeType":"image/png","userId":"ignored"}`, token)
	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("unconfigured presign status=%d body=%s; must not return a fake upload URL", w.Code, w.Body.String())
	}
}

func TestAudit159Wave9MediaSignedLocalUploadFlowPersistsOwnedAsset(t *testing.T) {
	db, router, userID, token, _ := wave9Router(t, true)
	presign := wave9Request(router, http.MethodPost, "/api/media/presign-upload", `{"fileName":"lesson.png","mimeType":"image/png","userId":"attacker-value"}`, token)
	if presign.Code != http.StatusCreated {
		t.Fatalf("presign status=%d body=%s", presign.Code, presign.Body.String())
	}
	var signed struct {
		AssetID     string `json:"assetId"`
		UploadURL   string `json:"uploadUrl"`
		UploadToken string `json:"uploadToken"`
	}
	if err := json.Unmarshal(presign.Body.Bytes(), &signed); err != nil || !isValidUUID(signed.AssetID) || signed.UploadURL == "" || signed.UploadToken == "" {
		t.Fatalf("presign response=%s err=%v", presign.Body.String(), err)
	}
	cleanupWave9Asset(t, db, signed.AssetID)
	if w := wave9Request(router, http.MethodGet, "/api/media/"+signed.AssetID, "", ""); w.Code != http.StatusNotFound {
		t.Fatalf("pending asset must not be public: status=%d body=%s", w.Code, w.Body.String())
	}
	content := []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n', 1, 2, 3}
	otherID := newUUID(t)
	seedActiveUser(t, db, otherID, "Other Wave 9 learner", "other-wave9-"+otherID+"@example.test", "")
	otherToken := createLearnerSession(t, session.NewStore(db), otherID)
	otherReq := httptest.NewRequest(http.MethodPut, signed.UploadURL, bytes.NewReader(content))
	otherReq.Header.Set("Origin", wave9Origin)
	otherReq.Header.Set("Content-Type", "image/png")
	otherReq.Header.Set("X-Media-Upload-Token", signed.UploadToken)
	otherReq.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: otherToken})
	otherPut := httptest.NewRecorder()
	router.ServeHTTP(otherPut, otherReq)
	if otherPut.Code != http.StatusNotFound {
		t.Fatalf("another learner upload status=%d body=%s, want 404", otherPut.Code, otherPut.Body.String())
	}
	putReq := httptest.NewRequest(http.MethodPut, signed.UploadURL, bytes.NewReader(content))
	putReq.Header.Set("Origin", wave9Origin)
	putReq.Header.Set("Content-Type", "image/png")
	putReq.Header.Set("X-Media-Upload-Token", signed.UploadToken)
	putReq.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: token})
	put := httptest.NewRecorder()
	router.ServeHTTP(put, putReq)
	if put.Code != http.StatusCreated {
		t.Fatalf("direct PUT status=%d body=%s", put.Code, put.Body.String())
	}
	if w := wave9Request(router, http.MethodGet, "/api/media/"+signed.AssetID, "", ""); w.Code != http.StatusNotFound {
		t.Fatalf("uncompleted asset must not be public: status=%d body=%s", w.Code, w.Body.String())
	}
	replayReq := httptest.NewRequest(http.MethodPut, signed.UploadURL, bytes.NewReader(content))
	replayReq.Header.Set("Origin", wave9Origin)
	replayReq.Header.Set("Content-Type", "image/png")
	replayReq.Header.Set("X-Media-Upload-Token", signed.UploadToken)
	replayReq.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: token})
	replay := httptest.NewRecorder()
	router.ServeHTTP(replay, replayReq)
	if replay.Code != http.StatusForbidden {
		t.Fatalf("upload token replay status=%d body=%s, want 403", replay.Code, replay.Body.String())
	}
	wrongSize := wave9Request(router, http.MethodPost, "/api/media/complete-upload", fmt.Sprintf(`{"assetId":%q,"byteSize":%d}`, signed.AssetID, len(content)+1), token)
	if wrongSize.Code != http.StatusBadRequest {
		t.Fatalf("wrong completion size status=%d body=%s, want 400", wrongSize.Code, wrongSize.Body.String())
	}
	complete := wave9Request(router, http.MethodPost, "/api/media/complete-upload", fmt.Sprintf(`{"assetId":%q,"byteSize":%d,"userId":"attacker-value"}`, signed.AssetID, len(content)), token)
	if complete.Code != http.StatusOK {
		t.Fatalf("complete status=%d body=%s", complete.Code, complete.Body.String())
	}
	var persisted struct {
		OwnerUserID  string
		ObjectKey    string
		MIMEType     string
		ByteSize     int64
		OriginalFile string
		Status       string
	}
	if err := db.QueryRow(context.Background(), `SELECT owner_user_id::text, object_key, mime_type, byte_size, original_filename, status FROM media.asset WHERE id=$1`, signed.AssetID).
		Scan(&persisted.OwnerUserID, &persisted.ObjectKey, &persisted.MIMEType, &persisted.ByteSize, &persisted.OriginalFile, &persisted.Status); err != nil {
		t.Fatalf("read completed asset: %v", err)
	}
	if persisted.OwnerUserID != userID || persisted.ObjectKey != signed.AssetID || persisted.MIMEType != "image/png" || persisted.ByteSize != int64(len(content)) || persisted.OriginalFile != "lesson.png" || persisted.Status != "active" {
		t.Fatalf("persisted metadata=%+v", persisted)
	}
	meta := wave9Request(router, http.MethodGet, "/api/media/"+signed.AssetID, "", "")
	if meta.Code != http.StatusOK {
		t.Fatalf("completed asset metadata status=%d body=%s", meta.Code, meta.Body.String())
	}
	stream := wave9Request(router, http.MethodGet, "/api/media/"+signed.AssetID+"/stream", "", "")
	if stream.Code != http.StatusOK || !bytes.Equal(stream.Body.Bytes(), content) {
		t.Fatalf("completed asset stream status=%d body=%v", stream.Code, stream.Body.Bytes())
	}
}

func TestAudit159Wave9MediaCompleteUploadValidatesAndRequiresProvider(t *testing.T) {
	_, router, _, token, _ := wave9Router(t, false)
	if w := wave9Request(router, http.MethodPost, "/api/media/complete-upload", `{}`, token); w.Code != http.StatusBadRequest {
		t.Fatalf("empty completion status=%d body=%s, want 400", w.Code, w.Body.String())
	}
	w := wave9Request(router, http.MethodPost, "/api/media/complete-upload", `{"assetId":"`+newUUID(t)+`","byteSize":12}`, token)
	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("unconfigured completion status=%d body=%s; must not claim persistence", w.Code, w.Body.String())
	}
}

func TestAudit159Wave9MediaProxyImageRequiresConfiguredProvider(t *testing.T) {
	_, router, _, token, _ := wave9Router(t, false)
	if w := wave9Request(router, http.MethodPost, "/api/media/proxy-image", `{"url":"http://127.0.0.1/admin"}`, token); w.Code != http.StatusBadRequest {
		t.Fatalf("unsafe image URL status=%d body=%s, want 400", w.Code, w.Body.String())
	}
	w := wave9Request(router, http.MethodPost, "/api/media/proxy-image", `{"url":"https://images.example.test/a.png"}`, token)
	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("unconfigured proxy status=%d body=%s; must not echo a URL as a proxied asset", w.Code, w.Body.String())
	}
}

func TestAudit159Wave9MediaSearchImagesRequiresConfiguredProvider(t *testing.T) {
	_, router, _, token, _ := wave9Router(t, false)
	if w := wave9Request(router, http.MethodPost, "/api/media/search-images", `{"query":" "}`, token); w.Code != http.StatusBadRequest {
		t.Fatalf("blank image query status=%d body=%s, want 400", w.Code, w.Body.String())
	}
	w := wave9Request(router, http.MethodPost, "/api/media/search-images", `{"query":"会議","limit":6}`, token)
	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("unconfigured image search status=%d body=%s; must not report an empty successful search", w.Code, w.Body.String())
	}
}

func TestAudit159Wave9MediaMetadataIsPublicAndMatchesAsset(t *testing.T) {
	db, router, _, token, _ := wave9Router(t, true)
	asset := wave9Upload(t, router, token, []byte("metadata"))
	cleanupWave9Asset(t, db, asset.ID)
	w := wave9Request(router, http.MethodGet, "/api/media/"+asset.ID, "", "")
	if w.Code != http.StatusOK {
		t.Fatalf("metadata status=%d body=%s", w.Code, w.Body.String())
	}
	var got mediaAssetResponse
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode metadata response: %v", err)
	}
	if got.ID != asset.ID || got.URL != "/api/media/"+asset.ID+"/stream" || got.SizeBytes != asset.SizeBytes || got.ContentType != "text/plain" {
		t.Fatalf("metadata response=%+v, upload=%+v", got, asset)
	}
}

func TestAudit159Wave9MediaStreamSupportsRange(t *testing.T) {
	db, router, _, token, _ := wave9Router(t, true)
	content := []byte("0123456789abcdef")
	asset := wave9Upload(t, router, token, content)
	cleanupWave9Asset(t, db, asset.ID)
	req := httptest.NewRequest(http.MethodGet, "/api/media/"+asset.ID+"/stream", nil)
	req.Header.Set("Range", "bytes=3-7")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusPartialContent || string(w.Body.Bytes()) != "34567" || w.Header().Get("Content-Range") != "bytes 3-7/16" {
		t.Fatalf("range status=%d range=%q body=%q", w.Code, w.Header().Get("Content-Range"), w.Body.String())
	}
}
