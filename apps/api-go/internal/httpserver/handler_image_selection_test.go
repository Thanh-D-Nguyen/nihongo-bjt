package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/imagesearch"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/media"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

type selectionTracker struct {
	calls    int
	fail     bool
	location string
}

func (s *selectionTracker) TrackDownload(_ context.Context, location string) error {
	s.calls++
	s.location = location
	if s.fail {
		return errors.New("tracking failed")
	}
	return nil
}

type selectionTransport func(*http.Request) (*http.Response, error)

func (f selectionTransport) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

type selectionSessions struct{}

func (selectionSessions) LookupLearnerSession(context.Context, string) (*session.LearnerSession, error) {
	return &session.LearnerSession{ID: "session", UserID: "user-1"}, nil
}
func (selectionSessions) LookupAdminSession(context.Context, string) (*session.AdminSession, error) {
	return nil, nil
}

type selectionSearch struct{ image imagesearch.Image }

func (s selectionSearch) Search(context.Context, string) ([]imagesearch.Image, error) {
	return []imagesearch.Image{s.image}, nil
}

type selectionLimiter struct{}

func (selectionLimiter) Allow(context.Context, string) (bool, error) { return true, nil }

func TestImageSelectionSearchHTTP(t *testing.T) {
	signer, err := newImageSelectionSigner([]byte(strings.Repeat("k", 32)))
	if err != nil {
		t.Fatal(err)
	}
	limiter := selectionLimiter{}
	image := imagesearch.Image{Provider: "unsplash", URL: "https://images.unsplash.com/photo-1", SourceURL: "https://unsplash.com/photos/one", Author: "Alice", AuthorURL: "https://unsplash.com/@alice", License: "Unsplash License", DownloadLocation: "https://api.unsplash.com/photos/one/download"}
	handler := postImageSelectionSearchHandler(selectionSearch{image}, signer, limiter, testLogger())
	unauthenticated := httptest.NewRecorder()
	handler.ServeHTTP(unauthenticated, httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{"query":"cat"}`)))
	if unauthenticated.Code != http.StatusUnauthorized {
		t.Fatalf("unauthenticated status=%d", unauthenticated.Code)
	}
	guarded := authn.LearnerGuard(selectionSessions{}, authn.DefaultGuardConfig(testLogger()))(handler)
	request := func(body string) *httptest.ResponseRecorder {
		r := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		r.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: "test"})
		w := httptest.NewRecorder()
		guarded.ServeHTTP(w, r)
		return w
	}
	if w := request(`{"query":"cat","author":"forged"}`); w.Code != http.StatusBadRequest {
		t.Fatalf("client attribution accepted: %d", w.Code)
	}
	w := request(`{"query":"cat"}`)
	var payload struct {
		Results []imageSelectionResult `json:"results"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &payload); w.Code != http.StatusOK || err != nil || len(payload.Results) != 1 {
		t.Fatalf("search response status=%d body=%s error=%v", w.Code, w.Body.String(), err)
	}
	claims, err := signer.verify(payload.Results[0].Handle, "user-1", time.Now())
	if err != nil || claims.Image != selectionAttribution(image) || payload.Results[0].AuthorURL != selectionAttribution(image).AuthorURL {
		t.Fatalf("result handle claims=%+v err=%v", claims, err)
	}
	unsupported := postImageSelectionSearchHandler(selectionSearch{imagesearch.Image{Provider: "flickr"}}, signer, limiter, testLogger())
	guarded = authn.LearnerGuard(selectionSessions{}, authn.DefaultGuardConfig(testLogger()))(unsupported)
	if w := request(`{"query":"cat"}`); w.Code != http.StatusServiceUnavailable {
		t.Fatalf("unsupported provider status=%d body=%s", w.Code, w.Body.String())
	}
}

func TestImageSelectionHandleSecurity(t *testing.T) {
	signer, err := newImageSelectionSigner([]byte(strings.Repeat("k", 32)))
	if err != nil {
		t.Fatal(err)
	}
	image := imagesearch.Image{Provider: "unsplash", URL: "https://images.unsplash.com/photo-1", SourceURL: "https://unsplash.com/photos/one", Author: "Alice", AuthorURL: "https://unsplash.com/@alice", License: "Unsplash License", DownloadLocation: "https://api.unsplash.com/photos/one/download?ixid=abc"}
	now := time.Unix(1800000000, 0)
	token, err := signer.issue("user-1", image, now)
	if err != nil {
		t.Fatal(err)
	}
	selected, err := signer.verify(token, "user-1", now.Add(time.Minute))
	if err != nil || selected.Image != selectionAttribution(image) {
		t.Fatalf("valid selection: %#v %v", selected, err)
	}
	if _, err := signer.verify(token, "user-2", now); err == nil {
		t.Fatal("cross-user handle accepted")
	}
	if _, err := signer.verify(token, "user-1", now.Add(16*time.Minute)); err == nil {
		t.Fatal("expired handle accepted")
	}
	if _, err := signer.verify(token+"x", "user-1", now); err == nil {
		t.Fatal("tampered handle accepted")
	}
	if _, err := newImageSelectionSigner([]byte("short")); err == nil {
		t.Fatal("weak key accepted")
	}
}

func TestImageSelectionProviderValidation(t *testing.T) {
	image := imagesearch.Image{Provider: "unsplash", URL: "https://images.unsplash.com/photo-1", SourceURL: "https://unsplash.com/photos/one", Author: "Alice", AuthorURL: "https://unsplash.com/@alice", License: "Unsplash License", DownloadLocation: "https://api.unsplash.com/photos/one/download?ixid=abc"}
	if !validSelectionImage(image) {
		t.Fatal("valid Unsplash image rejected")
	}
	image.URL = "https://images.unsplash.com.evil.test/photo"
	if validSelectionImage(image) {
		t.Fatal("untrusted image host accepted")
	}
	image.URL = "https://images.unsplash.com/photo"
	image.DownloadLocation = "https://evil.test/photos/one/download"
	if validSelectionImage(image) {
		t.Fatal("untrusted tracking URL accepted")
	}
	pixabay := imagesearch.Image{Provider: "pixabay", URL: "https://cdn.pixabay.com/photo/a.jpg", SourceURL: "https://pixabay.com/photos/a", Author: "Alice", License: "Pixabay Content License"}
	if !validSelectionImage(pixabay) {
		t.Fatal("valid Pixabay image rejected")
	}
	pixabay.URL = "https://127.0.0.1/image.jpg"
	if validSelectionImage(pixabay) {
		t.Fatal("private host accepted")
	}
}

func TestImageSelectionFallbackProviderValidation(t *testing.T) {
	pexels := imagesearch.Image{Provider: "pexels", URL: "https://images.pexels.com/photos/1/cat.jpeg?auto=compress", SourceURL: "https://www.pexels.com/photo/cat-1/", Author: "Alice", AuthorURL: "https://www.pexels.com/@alice", License: "Pexels License", LicenseURL: "https://www.pexels.com/license/"}
	wikimedia := imagesearch.Image{Provider: "wikimedia", URL: "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b6/Cat.jpg/1280px-Cat.jpg", SourceURL: "https://commons.wikimedia.org/wiki/File:Cat.jpg", Author: "Alice", License: "CC BY 4.0", LicenseURL: "https://creativecommons.org/licenses/by/4.0/"}
	for name, image := range map[string]imagesearch.Image{"pexels": pexels, "wikimedia": wikimedia} {
		if !validSelectionImage(image) {
			t.Fatalf("valid %s image rejected", name)
		}
	}
	for name, mutate := range map[string]func(*imagesearch.Image){
		"pexels foreign image host":  func(i *imagesearch.Image) { i.Provider, i.URL = "pexels", "https://images.pexels.com.evil.test/a.jpg" },
		"pexels wrong license":       func(i *imagesearch.Image) { i.Provider, i.License = "pexels", "Pexels License 2" },
		"pexels foreign author URL":  func(i *imagesearch.Image) { i.Provider, i.AuthorURL = "pexels", "https://evil.test/@alice" },
		"pexels cross-provider host": func(i *imagesearch.Image) { i.Provider, i.URL = "pexels", "https://cdn.pixabay.com/a.jpg" },
		"wikimedia foreign host":     func(i *imagesearch.Image) { i.Provider, i.URL = "wikimedia", "https://127.0.0.1/a.jpg" },
		"wikimedia NC license": func(i *imagesearch.Image) {
			i.Provider, i.License, i.LicenseURL = "wikimedia", "CC BY-NC 4.0", "https://creativecommons.org/licenses/by-nc/4.0/"
		},
		"wikimedia foreign source": func(i *imagesearch.Image) { i.Provider, i.SourceURL = "wikimedia", "https://evil.test/File:Cat.jpg" },
	} {
		image := pexels
		if strings.HasPrefix(name, "wikimedia") {
			image = wikimedia
		}
		mutate(&image)
		if validSelectionImage(image) {
			t.Errorf("%s accepted: %+v", name, image)
		}
	}
}

func TestDownloadSelectionImageHostsFollowProvider(t *testing.T) {
	client := &http.Client{Transport: selectionTransport(func(r *http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: 200, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(mediaAuditFixturePNG)), Request: r}, nil
	})}
	for _, tc := range []struct{ provider, url string }{
		{"pixabay", "https://cdn.pixabay.com/photo/a.png"},
		{"pexels", "https://images.pexels.com/photos/1/a.png"},
		{"wikimedia", "https://thumb.wikimedia.org/a.png"},
		{"wikimedia", "https://upload.wikimedia.org/a.png"},
	} {
		if _, _, err := downloadSelectionImage(context.Background(), tc.provider, tc.url, client); err != nil {
			t.Errorf("download %s %s: %v", tc.provider, tc.url, err)
		}
	}
	for _, tc := range []struct{ provider, url string }{
		{"pexels", "https://cdn.pixabay.com/photo/a.png"},
		{"pixabay", "https://images.pexels.com/a.png"},
		{"wikimedia", "https://images.pexels.com/a.png"},
		{"unsplash", "https://images.unsplash.com/a.png"},
		{"pexels", "http://images.pexels.com/a.png"},
	} {
		if _, _, err := downloadSelectionImage(context.Background(), tc.provider, tc.url, client); err == nil {
			t.Errorf("download %s %s accepted", tc.provider, tc.url)
		}
	}
}

func TestImageSelectionPersistence(t *testing.T) {
	db := testPool(t)
	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Selection learner", "selection-"+userID+"@example.test", "")
	bucket, err := media.OpenBucket(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { media.CloseBucket(bucket) })
	tracker := &selectionTracker{}
	image := imagesearch.Image{Provider: "unsplash", URL: "https://images.unsplash.com/photo-1", SourceURL: "https://unsplash.com/photos/one", Author: "Alice", AuthorURL: "https://unsplash.com/@alice", License: "Unsplash License", DownloadLocation: "https://api.unsplash.com/photos/one/download?ixid=abc"}
	claims := imageSelectionClaims{UserID: userID, Nonce: strings.Repeat("a", 32), Image: selectionAttribution(image)}
	t.Cleanup(func() { _, _ = db.Exec(context.Background(), `DELETE FROM media.asset WHERE owner_user_id=$1`, userID) })
	tracker.fail = true
	if _, err := persistImageSelection(context.Background(), db, bucket, tracker, claims, nil); err == nil {
		t.Fatal("tracking failure accepted")
	}
	var count int
	if err := db.QueryRow(context.Background(), `SELECT count(*) FROM media.asset WHERE owner_user_id=$1`, userID).Scan(&count); err != nil || count != 0 {
		t.Fatalf("failed tracking persisted asset count=%d err=%v", count, err)
	}
	tracker.fail = false
	id, err := persistImageSelection(context.Background(), db, bucket, tracker, claims, nil)
	if err != nil {
		t.Fatal(err)
	}
	again, err := persistImageSelection(context.Background(), db, bucket, tracker, claims, nil)
	if err != nil || again != id || tracker.calls != 2 || tracker.location != image.DownloadLocation {
		t.Fatalf("retry id=%q calls=%d err=%v", again, tracker.calls, err)
	}
	var owner, status, rights, provenance string
	if err := db.QueryRow(context.Background(), `SELECT owner_user_id::text,status,rights_status,provenance::text FROM media.asset WHERE id=$1`, id).Scan(&owner, &status, &rights, &provenance); err != nil {
		t.Fatal(err)
	}
	if owner != userID || status != "pending_review" || rights != "pending_review" || !strings.Contains(provenance, image.URL) || !strings.Contains(provenance, image.Author) || !strings.Contains(provenance, "utm_source=kotobaworks") || !strings.Contains(provenance, `"delivery": "hotlink"`) || strings.Contains(provenance, "download_location") {
		t.Fatalf("invalid asset owner=%s status=%s rights=%s provenance=%s", owner, status, rights, provenance)
	}
	claims.Nonce = strings.Repeat("b", 32)
	claims.Image = imagesearch.Image{Provider: "pixabay", URL: "https://cdn.pixabay.com/photo/a.png", SourceURL: "https://pixabay.com/photos/a", Author: "Bob", License: "Pixabay Content License"}
	client := &http.Client{Transport: selectionTransport(func(r *http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: 200, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(mediaAuditFixturePNG)), Request: r}, nil
	})}
	id, err = persistImageSelection(context.Background(), db, bucket, tracker, claims, client)
	if err != nil {
		t.Fatal(err)
	}
	data, err := bucket.ReadAll(context.Background(), "image-selection/"+claims.Nonce)
	if err != nil || string(data) != mediaAuditFixturePNG {
		t.Fatalf("Pixabay blob=%q err=%v", data, err)
	}
	if err := db.QueryRow(context.Background(), `SELECT status,rights_status FROM media.asset WHERE id=$1`, id).Scan(&status, &rights); err != nil || status != "pending_review" || rights != "pending_review" {
		t.Fatalf("Pixabay status=%s rights=%s err=%v", status, rights, err)
	}
	for i, image := range []imagesearch.Image{
		{Provider: "pexels", URL: "https://images.pexels.com/photos/1/a.png", SourceURL: "https://www.pexels.com/photo/a/", Author: "Carol", AuthorURL: "https://www.pexels.com/@carol", License: "Pexels License", LicenseURL: "https://www.pexels.com/license/"},
		{Provider: "wikimedia", URL: "https://thumb.wikimedia.org/a.png", SourceURL: "https://commons.wikimedia.org/wiki/File:A.png", Author: "Dave", License: "CC BY 4.0", LicenseURL: "https://creativecommons.org/licenses/by/4.0/"},
	} {
		claims.Nonce = strings.Repeat(string(rune('c'+i)), 32)
		claims.Image = image
		id, err = persistImageSelection(context.Background(), db, bucket, tracker, claims, client)
		if err != nil {
			t.Fatalf("%s: %v", image.Provider, err)
		}
		var provider, provenance string
		if err := db.QueryRow(context.Background(), `SELECT provider,status,rights_status,provenance::text FROM media.asset WHERE id=$1`, id).Scan(&provider, &status, &rights, &provenance); err != nil || provider != image.Provider || status != "pending_review" || rights != "pending_review" || !strings.Contains(provenance, `"delivery": "rehosted"`) || !strings.Contains(provenance, image.Author) {
			t.Fatalf("%s asset provider=%s status=%s rights=%s provenance=%s err=%v", image.Provider, provider, status, rights, provenance, err)
		}
		if data, err := bucket.ReadAll(context.Background(), "image-selection/"+claims.Nonce); err != nil || string(data) != mediaAuditFixturePNG {
			t.Fatalf("%s blob=%q err=%v", image.Provider, data, err)
		}
	}
}

type failingSelectionLimiter struct{}

func (failingSelectionLimiter) Allow(context.Context, string) (bool, error) {
	return false, errors.New("redis unavailable")
}

func TestImageSelectionLimiterOutageIsServiceUnavailable(t *testing.T) {
	signer, err := newImageSelectionSigner([]byte(strings.Repeat("k", 32)))
	if err != nil {
		t.Fatal(err)
	}
	handler := authn.LearnerGuard(selectionSessions{}, authn.DefaultGuardConfig(testLogger()))(postImageSelectionSearchHandler(selectionSearch{}, signer, failingSelectionLimiter{}, testLogger()))
	r := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{"query":"cat"}`))
	r.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: "test"})
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)
	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("limiter outage status=%d, want 503", w.Code)
	}
}
