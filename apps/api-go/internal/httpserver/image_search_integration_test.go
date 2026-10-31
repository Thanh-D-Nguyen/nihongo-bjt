package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"sync"
	"sync/atomic"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/media"
	"github.com/redis/go-redis/v9"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

type imageSearchSessions struct{ userID string }

func (s imageSearchSessions) LookupLearnerSession(context.Context, string) (*session.LearnerSession, error) {
	return &session.LearnerSession{ID: "session", UserID: s.userID}, nil
}
func (imageSearchSessions) LookupAdminSession(context.Context, string) (*session.AdminSession, error) {
	return nil, session.ErrSessionNotFound
}

func TestImageSearchRejectsOversizedQuery(t *testing.T) {
	handler := authn.LearnerGuard(imageSearchSessions{}, authn.DefaultGuardConfig(slog.Default()))(postMediaSearchImagesHandler(nil, slog.Default()))
	req := httptest.NewRequest(http.MethodPost, "/api/media/search-images", strings.NewReader(`{"query":"`+strings.Repeat("a", 201)+`"}`))
	req.Header.Set("Authorization", "Bearer session")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("oversized query status = %d, want 400", w.Code)
	}
}

func TestImageSearchRedisCoordinationAndUserLimits(t *testing.T) {
	redisURL := os.Getenv("TEST_REDIS_URL")
	if redisURL == "" {
		t.Fatal("TEST_REDIS_URL is required; run with scripts/quality/with-test-db.sh or provide a test Redis URL")
	}
	redisOptions, err := redis.ParseURL(redisURL)
	if err != nil {
		t.Fatalf("parse TEST_REDIS_URL: %v", err)
	}
	redisClient := redis.NewClient(redisOptions)
	t.Cleanup(func() { _ = redisClient.Close() })
	ctx := context.Background()
	db, err := pgxpool.New(ctx, os.Getenv("TEST_DATABASE_URL"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(db.Close)
	if err := redisClient.Ping(ctx).Err(); err != nil {
		t.Fatalf("ping TEST_REDIS_URL: %v", err)
	}
	// Redis may be shared and long-lived: the Pixabay cache (24h), per-query lock and
	// per-user limiter are namespaced by random values so reruns never see old state.
	runID := newUUID(t)
	pixabayKey, query := "test-key-"+runID, "cat-"+runID
	userA, userB := "user-a-"+runID, "user-b-"+runID
	requestUser := "request-user-" + runID
	var calls atomic.Int32
	transport := imageSearchTestTransport(func(r *http.Request) (*http.Response, error) {
		if r.URL.Host != "pixabay.com" {
			return nil, fmt.Errorf("unexpected provider")
		}
		calls.Add(1)
		time.Sleep(150 * time.Millisecond)
		return &http.Response{StatusCode: 200, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(`{"hits":[{"webformatURL":"https://pixabay.com/a","pageURL":"https://pixabay.com/p","user":"Alice"}]}`))}, nil
	})
	a := newImageSearchService(redisClient, db, "", pixabayKey, "", &http.Client{Transport: transport}, 15*time.Second)
	b := newImageSearchService(redisClient, db, "", pixabayKey, "", &http.Client{Transport: transport}, 15*time.Second)
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM media.image_search_cache WHERE namespace IN ($1,$2)`, a.namespace, imageSearchHash("private-pixabay-test-"+runID))
		keys := []string{}
		for _, user := range []string{userA, userB, requestUser} {
			keys = append(keys, "image-search:limit:"+imageSearchHash(user))
		}
		if err := redisClient.Del(context.Background(), keys...).Err(); err != nil {
			t.Errorf("clean up image search test keys: %v", err)
		}
	})
	var wg sync.WaitGroup
	for _, svc := range []*ImageSearchService{a, b} {
		wg.Add(1)
		go func(s *ImageSearchService) {
			defer wg.Done()
			images, err := s.Search(ctx, query)
			if err != nil || len(images) != 1 {
				t.Errorf("Search(query) = %v, %v, want one image", images, err)
			}
		}(svc)
	}
	wg.Wait()
	if got := calls.Load(); got != 1 {
		t.Fatalf("concurrent Pixabay calls = %d, want 1", got)
	}
	var seconds float64
	err = db.QueryRow(ctx, `SELECT EXTRACT(EPOCH FROM (expires_at-NOW())) FROM media.image_search_cache WHERE namespace=$1 AND cache_key=$2`, a.namespace, imageSearchHash("imagesearch:pixabay:"+query)).Scan(&seconds)
	if err != nil || seconds < (23*time.Hour+59*time.Minute).Seconds() || seconds > (24*time.Hour).Seconds() {
		t.Fatalf("cache TTL = %v seconds, %v, want approximately 24h", seconds, err)
	}
	for i := 0; i < imageSearchLimit; i++ {
		ok, err := a.Allow(ctx, userA)
		if !ok || err != nil {
			t.Fatalf("Allow(userA, %d) = %t, %v, want allowed", i, ok, err)
		}
	}
	if ok, err := b.Allow(ctx, userA); ok || err != nil {
		t.Fatalf("Allow(user-a, over limit) = %t, %v, want denied", ok, err)
	}
	if ok, err := b.Allow(ctx, userB); !ok || err != nil {
		t.Fatalf("Allow(user-b) = %t, %v, want allowed", ok, err)
	}

	providerBucket, err := media.OpenBucket(t.TempDir())
	if err != nil {
		t.Fatalf("open media bucket: %v", err)
	}
	t.Cleanup(func() { media.CloseBucket(providerBucket) })
	deps := Dependencies{Config: &config.Config{ImageSelectionSigningKey: strings.Repeat("k", 32)}, Logger: testLogger(), DBPool: &pgxpool.Pool{}, MediaBucket: providerBucket, ImageSearch: a}
	searchHandler, _ := imageSelectionHandlers(deps)
	guarded := authn.LearnerGuard(imageSearchSessions{userID: requestUser}, authn.DefaultGuardConfig(testLogger()))(searchHandler)
	request := httptest.NewRequest(http.MethodPost, "/api/media/search-images", strings.NewReader(`{"query":"`+query+`"}`))
	request.Header.Set("Authorization", "Bearer session")
	response := httptest.NewRecorder()
	guarded.ServeHTTP(response, request)
	var payload struct {
		Results []imageSelectionResult `json:"results"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil || response.Code != http.StatusOK || len(payload.Results) != 1 || payload.Results[0].Handle == "" || payload.Results[0].Provider != "pixabay" || payload.Results[0].URL == "" {
		t.Fatalf("wired search status=%d results=%+v decode=%v, want selectable Pixabay result", response.Code, payload.Results, err)
	}
	for _, disabled := range []Dependencies{
		{Config: &config.Config{}, Logger: testLogger(), ImageSearch: a, MediaBucket: providerBucket},
		{Config: &config.Config{ImageSelectionSigningKey: "short"}, Logger: testLogger(), ImageSearch: a, MediaBucket: providerBucket},
		{Config: deps.Config, Logger: testLogger(), ImageSearch: NewImageSearchService(nil, nil, "", "", "", 15*time.Second), MediaBucket: providerBucket},
		{Config: deps.Config, Logger: testLogger(), ImageSearch: a},
	} {
		disabledHandler, disabledSelection := imageSelectionHandlers(disabled)
		guarded := authn.LearnerGuard(imageSearchSessions{}, authn.DefaultGuardConfig(testLogger()))(disabledHandler)
		req := httptest.NewRequest(http.MethodPost, "/api/media/search-images", strings.NewReader(`{"query":"cat"}`))
		req.Header.Set("Authorization", "Bearer session")
		w := httptest.NewRecorder()
		guarded.ServeHTTP(w, req)
		if w.Code != http.StatusServiceUnavailable {
			t.Fatalf("disabled image search status=%d, want 503", w.Code)
		}
		guardedSelection := authn.LearnerGuard(imageSearchSessions{}, authn.DefaultGuardConfig(testLogger()))(disabledSelection)
		selectionReq := httptest.NewRequest(http.MethodPost, "/api/media/image-selections", strings.NewReader(`{"handle":"x"}`))
		selectionReq.Header.Set("Authorization", "Bearer session")
		selectionResponse := httptest.NewRecorder()
		guardedSelection.ServeHTTP(selectionResponse, selectionReq)
		if selectionResponse.Code != http.StatusServiceUnavailable {
			t.Fatalf("disabled selection status=%d, want 503", selectionResponse.Code)
		}
	}
	var providerCalls atomic.Int32
	fallbackTransport := imageSearchTestTransport(func(r *http.Request) (*http.Response, error) {
		providerCalls.Add(1)
		switch r.URL.Host {
		case "api.unsplash.com":
			<-r.Context().Done()
			return nil, r.Context().Err()
		case "pixabay.com":
			return nil, fmt.Errorf("upstream request failed: %s", r.URL.String())
		case "commons.wikimedia.org":
			return &http.Response{StatusCode: 200, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(`{"query":{"pages":[{"imageinfo":[{"url":"https://upload.wikimedia.org/cat.jpg","descriptionurl":"https://commons.wikimedia.org/cat","extmetadata":{"Artist":{"value":"Alice"},"LicenseShortName":{"value":"CC BY 4.0"},"LicenseUrl":{"value":"https://creativecommons.org/licenses/by/4.0/"}}}]}]}}`))}, nil
		}
		return nil, errors.New("unexpected provider")
	})
	privateKey := "private-pixabay-test-" + runID
	fallback := newImageSearchService(redisClient, db, "unsplash-test", privateKey, "", &http.Client{Transport: fallbackTransport, Timeout: 50 * time.Millisecond}, 15*time.Second)
	dogQuery := "dog-" + runID
	images, err := fallback.Search(ctx, dogQuery)
	if err != nil || len(images) != 1 || images[0].Provider != "wikimedia" || providerCalls.Load() != 3 {
		t.Fatalf("fallback after provider timeout = %v, %v, calls %d; want Wikimedia", images, err, providerCalls.Load())
	}
	if fallback.timeout >= 15*time.Second || fallback.client == nil {
		t.Fatal("search timeout must be below the write timeout")
	}

	failure := newImageSearchService(redisClient, db, "", privateKey, "", &http.Client{Transport: imageSearchTestTransport(func(r *http.Request) (*http.Response, error) {
		return nil, fmt.Errorf("request failed: %s", r.URL.String())
	})}, 15*time.Second)
	_, failureErr := failure.Search(ctx, "error-test-"+runID)
	if failureErr == nil || strings.Contains(failureErr.Error(), privateKey) || strings.Contains(failureErr.Error(), "http") {
		t.Fatalf("provider failure error = %v, want sanitized error", failureErr)
	}
	cancelled, cancel := context.WithCancel(ctx)
	cancel()
	if _, err := fallback.Search(cancelled, dogQuery); !errors.Is(err, context.Canceled) {
		t.Fatalf("cancelled search error = %v, want sanitized cancellation", err)
	}
}

type imageSearchTestTransport func(*http.Request) (*http.Response, error)

func (f imageSearchTestTransport) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func TestImageSelectionRouteRequiresAuthentication(t *testing.T) {
	router := NewRouter(Dependencies{Config: &config.Config{}, Logger: testLogger(), DBPool: &pgxpool.Pool{}, SessionStore: &session.Store{}})
	req := httptest.NewRequest(http.MethodPost, "/api/media/image-selections", strings.NewReader(`{}`))
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("image-selections anonymous status = %d, want 401", w.Code)
	}
}
