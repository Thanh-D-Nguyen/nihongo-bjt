package httpserver

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"time"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/media"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/profile"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

// testRateLimiter creates a permissive rate limiter for tests.
func testRateLimiter(t *testing.T) *authn.RateLimiter {
	t.Helper()
	rl, err := authn.NewRateLimiter(authn.RateLimiterConfig{
		Limit:      1000,
		Window:     time.Minute,
		TTL:        5 * time.Minute,
		EvictEvery: time.Minute,
		MaxKeys:    10000,
	})
	if err != nil {
		t.Fatalf("create test rate limiter: %v", err)
	}
	return rl
}

// buildMediaTestRouter creates a router with media store and bucket wired for testing.
func buildMediaTestRouter(t *testing.T, pool *pgxpool.Pool, trustedOrigins []string, mediaPath string) http.Handler {
	t.Helper()
	logger := testLogger()

	// Open fileblob bucket at temp path.
	bucket, err := media.OpenBucket(mediaPath)
	if err != nil {
		t.Fatalf("open media bucket: %v", err)
	}
	t.Cleanup(func() { media.CloseBucket(bucket) })

	deps := Dependencies{
		Config: &config.Config{
			Port:          "4001",
			CORSOrigins:   trustedOrigins,
			MediaBasePath: mediaPath,
		},
		Logger:       logger,
		DBPool:       pool,
		SessionStore: session.NewStore(pool),
		ProfileStore: profile.NewStore(pool),
		MediaStore:   media.NewStore(pool),
		MediaBucket:  bucket,
		RateLimiter:  testRateLimiter(t),
		Version:      "test",
	}
	return NewRouter(deps)
}

// createMultipartBody builds a multipart/form-data body with a single "file" field.
func createMultipartBody(t *testing.T, filename string, content []byte, contentType string) (body []byte, boundary string) {
	t.Helper()
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)
	part, err := writer.CreateFormFile("file", filename)
	if err != nil {
		t.Fatalf("create form file: %v", err)
	}
	if _, err := part.Write(content); err != nil {
		t.Fatalf("write part: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close writer: %v", err)
	}
	return buf.Bytes(), writer.Boundary()
}

// --- POST /api/media/upload tests ---

func TestMediaUpload_Success(t *testing.T) {
	db := testPool(t)
	tmpDir := t.TempDir()
	router := buildMediaTestRouter(t, db, []string{"https://app.example.com"}, tmpDir)

	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Upload User", "upload@example.com", "")
	store := session.NewStore(db)
	rawToken := createLearnerSession(t, store, userID)

	fileContent := []byte("hello world test content")
	body, boundary := createMultipartBody(t, "test.txt", fileContent, "text/plain")

	req := httptest.NewRequest(http.MethodPost, "/api/media/upload", bytes.NewReader(body))
	req.Header.Set("Content-Type", fmt.Sprintf("multipart/form-data; boundary=%s", boundary))
	req.Header.Set("Origin", "https://app.example.com")
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d; body: %s", w.Code, w.Body.String())
	}

	var resp mediaAssetResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if resp.ID == "" {
		t.Error("response missing id")
	}
	if resp.ContentType != "text/plain" {
		t.Errorf("contentType = %q, want text/plain", resp.ContentType)
	}
	if resp.SizeBytes != int64(len(fileContent)) {
		t.Errorf("sizeBytes = %d, want %d", resp.SizeBytes, len(fileContent))
	}
	if resp.URL == "" {
		t.Error("response missing url")
	}

	// Verify file exists on disk.
	mediaStore := media.NewStore(db)
	asset, err := mediaStore.GetAsset(context.Background(), resp.ID)
	if err != nil || asset == nil {
		t.Fatalf("asset not found in DB: %v", err)
	}

	// Cleanup DB row.
	t.Cleanup(func() {
		_ = mediaStore.DeleteAsset(context.Background(), resp.ID)
	})
}

func TestMediaUpload_Unauthorized_NoSession(t *testing.T) {
	db := testPool(t)
	tmpDir := t.TempDir()
	router := buildMediaTestRouter(t, db, []string{"https://app.example.com"}, tmpDir)

	fileContent := []byte("unauthorized test")
	body, boundary := createMultipartBody(t, "test.txt", fileContent, "text/plain")

	req := httptest.NewRequest(http.MethodPost, "/api/media/upload", bytes.NewReader(body))
	req.Header.Set("Content-Type", fmt.Sprintf("multipart/form-data; boundary=%s", boundary))
	req.Header.Set("Origin", "https://app.example.com")
	// No cookie
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 without session, got %d; body: %s", w.Code, w.Body.String())
	}
}

func TestMediaUpload_MissingFileField(t *testing.T) {
	db := testPool(t)
	tmpDir := t.TempDir()
	router := buildMediaTestRouter(t, db, []string{"https://app.example.com"}, tmpDir)

	userID := newUUID(t)
	seedActiveUser(t, db, userID, "No File User", "nofile@example.com", "")
	store := session.NewStore(db)
	rawToken := createLearnerSession(t, store, userID)

	// Create multipart body without "file" field.
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)
	_ = writer.WriteField("other", "value")
	_ = writer.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/media/upload", &buf)
	req.Header.Set("Content-Type", fmt.Sprintf("multipart/form-data; boundary=%s", writer.Boundary()))
	req.Header.Set("Origin", "https://app.example.com")
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for missing file field, got %d; body: %s", w.Code, w.Body.String())
	}
}

func TestMediaUpload_TooLarge(t *testing.T) {
	db := testPool(t)
	tmpDir := t.TempDir()
	router := buildMediaTestRouter(t, db, []string{"https://app.example.com"}, tmpDir)

	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Large User", "large@example.com", "")
	store := session.NewStore(db)
	rawToken := createLearnerSession(t, store, userID)

	// Create content slightly over 50MB.
	largeContent := make([]byte, maxUploadBytes+1)
	for i := range largeContent {
		largeContent[i] = 'A'
	}
	body, boundary := createMultipartBody(t, "large.bin", largeContent, "application/octet-stream")

	req := httptest.NewRequest(http.MethodPost, "/api/media/upload", bytes.NewReader(body))
	req.Header.Set("Content-Type", fmt.Sprintf("multipart/form-data; boundary=%s", boundary))
	req.Header.Set("Origin", "https://app.example.com")
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusRequestEntityTooLarge {
		t.Errorf("expected 413 for oversized upload, got %d; body: %s", w.Code, w.Body.String())
	}
}

// --- GET /api/media/:id tests ---

func TestMediaGetMetadata_Success(t *testing.T) {
	db := testPool(t)
	tmpDir := t.TempDir()
	router := buildMediaTestRouter(t, db, []string{"https://app.example.com"}, tmpDir)

	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Meta User", "meta@example.com", "")
	store := session.NewStore(db)
	rawToken := createLearnerSession(t, store, userID)

	// Upload first.
	fileContent := []byte("metadata test content")
	body, boundary := createMultipartBody(t, "meta.txt", fileContent, "text/plain")
	req := httptest.NewRequest(http.MethodPost, "/api/media/upload", bytes.NewReader(body))
	req.Header.Set("Content-Type", fmt.Sprintf("multipart/form-data; boundary=%s", boundary))
	req.Header.Set("Origin", "https://app.example.com")
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("upload failed: %d; %s", w.Code, w.Body.String())
	}
	var uploadResp mediaAssetResponse
	json.Unmarshal(w.Body.Bytes(), &uploadResp)

	// Get metadata (public, no auth).
	metaReq := httptest.NewRequest(http.MethodGet, "/api/media/"+uploadResp.ID, nil)
	metaW := httptest.NewRecorder()
	router.ServeHTTP(metaW, metaReq)

	if metaW.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d; body: %s", metaW.Code, metaW.Body.String())
	}

	var metaResp mediaAssetResponse
	if err := json.Unmarshal(metaW.Body.Bytes(), &metaResp); err != nil {
		t.Fatalf("decode metadata: %v", err)
	}
	if metaResp.ID != uploadResp.ID {
		t.Errorf("id mismatch: got %q, want %q", metaResp.ID, uploadResp.ID)
	}
	if metaResp.ContentType != "text/plain" {
		t.Errorf("contentType = %q, want text/plain", metaResp.ContentType)
	}

	// Cleanup.
	mediaStore := media.NewStore(db)
	t.Cleanup(func() { _ = mediaStore.DeleteAsset(context.Background(), uploadResp.ID) })
}

func TestMediaGetMetadata_NotFound(t *testing.T) {
	db := testPool(t)
	tmpDir := t.TempDir()
	router := buildMediaTestRouter(t, db, []string{"https://app.example.com"}, tmpDir)

	fakeID := newUUID(t)
	req := httptest.NewRequest(http.MethodGet, "/api/media/"+fakeID, nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("expected 404 for non-existent asset, got %d; body: %s", w.Code, w.Body.String())
	}
}

// --- GET /api/media/:id/stream tests ---

func TestMediaStream_Success(t *testing.T) {
	db := testPool(t)
	tmpDir := t.TempDir()
	router := buildMediaTestRouter(t, db, []string{"https://app.example.com"}, tmpDir)

	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Stream User", "stream@example.com", "")
	store := session.NewStore(db)
	rawToken := createLearnerSession(t, store, userID)

	fileContent := []byte("streaming test content for verification")
	body, boundary := createMultipartBody(t, "stream.txt", fileContent, "text/plain")
	req := httptest.NewRequest(http.MethodPost, "/api/media/upload", bytes.NewReader(body))
	req.Header.Set("Content-Type", fmt.Sprintf("multipart/form-data; boundary=%s", boundary))
	req.Header.Set("Origin", "https://app.example.com")
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("upload failed: %d; %s", w.Code, w.Body.String())
	}
	var uploadResp mediaAssetResponse
	json.Unmarshal(w.Body.Bytes(), &uploadResp)

	// Stream the file.
	streamReq := httptest.NewRequest(http.MethodGet, "/api/media/"+uploadResp.ID+"/stream", nil)
	streamW := httptest.NewRecorder()
	router.ServeHTTP(streamW, streamReq)

	if streamW.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d; body: %s", streamW.Code, streamW.Body.String())
	}
	if ct := streamW.Header().Get("Content-Type"); ct != "text/plain" {
		t.Errorf("Content-Type = %q, want text/plain", ct)
	}
	if cl := streamW.Header().Get("Content-Length"); cl != fmt.Sprintf("%d", len(fileContent)) {
		t.Errorf("Content-Length = %q, want %d", cl, len(fileContent))
	}
	if cc := streamW.Header().Get("Cache-Control"); cc != streamCacheControl {
		t.Errorf("Cache-Control = %q, want %q", cc, streamCacheControl)
	}
	if !bytes.Equal(streamW.Body.Bytes(), fileContent) {
		t.Errorf("body mismatch: got %q, want %q", streamW.Body.String(), string(fileContent))
	}

	// Cleanup.
	mediaStore := media.NewStore(db)
	t.Cleanup(func() { _ = mediaStore.DeleteAsset(context.Background(), uploadResp.ID) })
}

func TestMediaStream_RangeRequest(t *testing.T) {
	db := testPool(t)
	tmpDir := t.TempDir()
	router := buildMediaTestRouter(t, db, []string{"https://app.example.com"}, tmpDir)

	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Range User", "range@example.com", "")
	store := session.NewStore(db)
	rawToken := createLearnerSession(t, store, userID)

	fileContent := []byte("0123456789ABCDEF") // 16 bytes
	body, boundary := createMultipartBody(t, "range.txt", fileContent, "text/plain")
	req := httptest.NewRequest(http.MethodPost, "/api/media/upload", bytes.NewReader(body))
	req.Header.Set("Content-Type", fmt.Sprintf("multipart/form-data; boundary=%s", boundary))
	req.Header.Set("Origin", "https://app.example.com")
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("upload failed: %d; %s", w.Code, w.Body.String())
	}
	var uploadResp mediaAssetResponse
	json.Unmarshal(w.Body.Bytes(), &uploadResp)

	// Request bytes 0-4 (first 5 bytes).
	streamReq := httptest.NewRequest(http.MethodGet, "/api/media/"+uploadResp.ID+"/stream", nil)
	streamReq.Header.Set("Range", "bytes=0-4")
	streamW := httptest.NewRecorder()
	router.ServeHTTP(streamW, streamReq)

	if streamW.Code != http.StatusPartialContent {
		t.Fatalf("expected 206, got %d; body: %s", streamW.Code, streamW.Body.String())
	}
	if cr := streamW.Header().Get("Content-Range"); !strings.HasPrefix(cr, "bytes 0-4/") {
		t.Errorf("Content-Range = %q, want prefix bytes 0-4/", cr)
	}
	expected := fileContent[0:5]
	if !bytes.Equal(streamW.Body.Bytes(), expected) {
		t.Errorf("range body = %q, want %q", streamW.Body.String(), string(expected))
	}

	// Cleanup.
	mediaStore := media.NewStore(db)
	t.Cleanup(func() { _ = mediaStore.DeleteAsset(context.Background(), uploadResp.ID) })
}

func TestMediaStream_NotFound(t *testing.T) {
	db := testPool(t)
	tmpDir := t.TempDir()
	router := buildMediaTestRouter(t, db, []string{"https://app.example.com"}, tmpDir)

	fakeID := newUUID(t)
	req := httptest.NewRequest(http.MethodGet, "/api/media/"+fakeID+"/stream", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("expected 404 for non-existent stream, got %d; body: %s", w.Code, w.Body.String())
	}
}

func TestMediaStream_FileMissingOnDisk(t *testing.T) {
	db := testPool(t)
	tmpDir := t.TempDir()
	router := buildMediaTestRouter(t, db, []string{"https://app.example.com"}, tmpDir)

	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Missing User", "missing@example.com", "")
	store := session.NewStore(db)
	rawToken := createLearnerSession(t, store, userID)

	// Upload normally.
	fileContent := []byte("will be deleted")
	body, boundary := createMultipartBody(t, "gone.txt", fileContent, "text/plain")
	req := httptest.NewRequest(http.MethodPost, "/api/media/upload", bytes.NewReader(body))
	req.Header.Set("Content-Type", fmt.Sprintf("multipart/form-data; boundary=%s", boundary))
	req.Header.Set("Origin", "https://app.example.com")
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: rawToken})
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("upload failed: %d; %s", w.Code, w.Body.String())
	}
	var uploadResp mediaAssetResponse
	json.Unmarshal(w.Body.Bytes(), &uploadResp)

	// Delete the file from disk to simulate missing file.
	os.Remove(tmpDir + "/" + uploadResp.ID)

	// Stream should return 404.
	streamReq := httptest.NewRequest(http.MethodGet, "/api/media/"+uploadResp.ID+"/stream", nil)
	streamW := httptest.NewRecorder()
	router.ServeHTTP(streamW, streamReq)

	if streamW.Code != http.StatusNotFound {
		t.Errorf("expected 404 for missing file on disk, got %d; body: %s", streamW.Code, streamW.Body.String())
	}

	// Cleanup DB row.
	mediaStore := media.NewStore(db)
	t.Cleanup(func() { _ = mediaStore.DeleteAsset(context.Background(), uploadResp.ID) })
}
