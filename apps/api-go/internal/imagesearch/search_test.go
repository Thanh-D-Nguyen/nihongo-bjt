package imagesearch

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"
)

type transportFunc func(*http.Request) (*http.Response, error)

func (f transportFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

type testCache struct {
	entries map[string][]Image
	ttl     time.Duration
}

func (c *testCache) Get(_ context.Context, k string) ([]Image, bool, error) {
	v, ok := c.entries[k]
	return v, ok, nil
}
func (c *testCache) Put(_ context.Context, k string, v []Image, ttl time.Duration) error {
	c.entries[k] = v
	c.ttl = ttl
	return nil
}
func response(s string) *http.Response {
	return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(s)), Header: make(http.Header)}
}

type uncachedConcurrentTestCache struct{}

func (uncachedConcurrentTestCache) Get(context.Context, string) ([]Image, bool, error) {
	return nil, false, nil
}
func (uncachedConcurrentTestCache) Put(context.Context, string, []Image, time.Duration) error {
	return nil
}

func TestIndependentPixabayQueriesDoNotBlock(t *testing.T) {
	started, release := make(chan struct{}), make(chan struct{})
	client := &http.Client{Transport: transportFunc(func(r *http.Request) (*http.Response, error) {
		if r.URL.Query().Get("q") == "slow" {
			close(started)
			<-release
		}
		return response(`{"hits":[{"webformatURL":"https://pixabay.com/img.jpg","pageURL":"https://pixabay.com/photos/a","user":"Alice"}]}`), nil
	})}
	s := New(client, "", "key", uncachedConcurrentTestCache{})
	done := make(chan struct{})
	go func() { defer close(done); _, _ = s.Search(context.Background(), "slow") }()
	<-started
	ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel()
	result := make(chan error, 1)
	go func() { _, err := s.Search(ctx, "fast"); result <- err }()
	select {
	case err := <-result:
		if err != nil {
			t.Errorf("independent search: %v", err)
		}
	case <-ctx.Done():
		t.Error("independent search blocked behind a different query")
	}
	close(release)
	<-done
}
func TestFallbackAndPixabayCache(t *testing.T) {
	calls := map[string]int{}
	client := &http.Client{Transport: transportFunc(func(r *http.Request) (*http.Response, error) {
		calls[r.URL.Host]++
		switch r.URL.Host {
		case "api.unsplash.com":
			return response(`{"results":[]}`), nil
		case "pixabay.com":
			return response(`{"hits":[{"webformatURL":"https://pixabay.com/img.jpg","pageURL":"https://pixabay.com/photos/a","user":"Alice"}]}`), nil
		}
		t.Errorf("unexpected provider %s", r.URL.Host)
		return response(`{}`), nil
	})}
	cache := &testCache{entries: map[string][]Image{}}
	s := New(client, "unsplash-key", "pixabay-key", cache)
	for i := 0; i < 2; i++ {
		got, err := s.Search(context.Background(), "cat")
		if err != nil || len(got) != 1 || got[0].Provider != "pixabay" || got[0].Author != "Alice" {
			t.Fatalf("Search(cat) = %v, %v, want Pixabay image", got, err)
		}
	}
	if calls["pixabay.com"] != 1 || cache.ttl != 24*time.Hour {
		t.Fatalf("Pixabay calls=%d ttl=%v, want 1 and 24h", calls["pixabay.com"], cache.ttl)
	}
}
func TestUnsplashAttributionAndHotlink(t *testing.T) {
	client := &http.Client{Transport: transportFunc(func(r *http.Request) (*http.Response, error) {
		if r.Header.Get("Authorization") != "Client-ID secret" {
			t.Error("missing authentication")
		}
		return response(`{"results":[{"urls":{"regular":"https://images.unsplash.com/photo"},"links":{"html":"https://unsplash.com/photos/a","download_location":"https://api.unsplash.com/photos/a/download"},"user":{"name":"Alice","links":{"html":"https://unsplash.com/@alice"}}}]}`), nil
	})}
	got, err := New(client, "secret", "", nil).Search(context.Background(), "cat")
	if err != nil || len(got) != 1 || got[0].URL != "https://images.unsplash.com/photo" || got[0].Author != "Alice" || got[0].AuthorURL == "" || got[0].DownloadLocation == "" {
		t.Fatalf("Search(cat) = %v, %v, want attributed hotlink", got, err)
	}
}

func TestFallbackWhenUnsplashResultCannotBeSelected(t *testing.T) {
	client := &http.Client{Transport: transportFunc(func(r *http.Request) (*http.Response, error) {
		switch r.URL.Host {
		case "api.unsplash.com":
			return response(`{"results":[{"urls":{"regular":"https://images.unsplash.com/photo"},"links":{"html":"https://unsplash.com/photos/a"},"user":{"name":"Alice","links":{"html":"https://unsplash.com/@alice"}}}]}`), nil
		case "commons.wikimedia.org":
			return response(`{"query":{"pages":[{"imageinfo":[{"url":"https://upload.wikimedia.org/cat.jpg","descriptionurl":"https://commons.wikimedia.org/wiki/File:Cat.jpg","extmetadata":{"Artist":{"value":"Alice"},"LicenseShortName":{"value":"CC BY 4.0"},"LicenseUrl":{"value":"https://creativecommons.org/licenses/by/4.0/"}}}]}]}}`), nil
		default:
			t.Fatalf("unexpected provider: %s", r.URL.Host)
			return nil, nil
		}
	})}
	got, err := New(client, "key", "", nil).Search(context.Background(), "cat")
	if err != nil || len(got) != 1 || got[0].Provider != "wikimedia" {
		t.Fatalf("Search(cat) = %v, %v, want selectable Wikimedia result", got, err)
	}
}

func TestFallbackWhenProviderResultsFailFilter(t *testing.T) {
	client := &http.Client{Transport: transportFunc(func(r *http.Request) (*http.Response, error) {
		if r.URL.Host == "api.unsplash.com" {
			return response(`{"results":[{"urls":{"regular":"https://images.unsplash.com/photo"},"links":{"html":"https://unsplash.com/photos/a","download_location":"https://api.unsplash.com/photos/a/download"},"user":{"name":"Alice","links":{"html":"https://unsplash.com/@alice"}}}]}`), nil
		}
		return response(`{"query":{"pages":[{"imageinfo":[{"url":"https://upload.wikimedia.org/cat.jpg","descriptionurl":"https://commons.wikimedia.org/wiki/File:Cat.jpg","extmetadata":{"Artist":{"value":"Alice"},"LicenseShortName":{"value":"CC BY 4.0"},"LicenseUrl":{"value":"https://creativecommons.org/licenses/by/4.0/"}}}]}]}}`), nil
	})}
	got, err := New(client, "key", "", nil, WithResultFilter(func(image Image) bool { return image.Provider != "unsplash" })).Search(context.Background(), "cat")
	if err != nil || len(got) != 1 || got[0].Provider != "wikimedia" {
		t.Fatalf("Search(cat) = %v, %v, want filtered Wikimedia result", got, err)
	}
}
func TestWikimediaFallbackAndNoCacheNoPixabay(t *testing.T) {
	client := &http.Client{Transport: transportFunc(func(r *http.Request) (*http.Response, error) {
		if r.URL.Host != "commons.wikimedia.org" {
			t.Fatalf("unexpected request to %s", r.URL.Host)
		}
		return response(`{"query":{"pages":[{"title":"File:Cat.jpg","imageinfo":[{"url":"https://upload.wikimedia.org/cat.jpg","descriptionurl":"https://commons.wikimedia.org/wiki/File:Cat.jpg","extmetadata":{"Artist":{"value":"Alice"},"LicenseShortName":{"value":"CC BY 4.0"},"LicenseUrl":{"value":"https://creativecommons.org/licenses/by/4.0/"}}}]}]}}`), nil
	})}
	got, err := New(client, "", "pixabay-key", nil).Search(context.Background(), "cat")
	if err != nil || len(got) != 1 || got[0].Provider != "wikimedia" || got[0].License != "CC BY 4.0" {
		t.Fatalf("Search(cat) = %v, %v, want licensed Wikimedia image", got, err)
	}
}

func TestTrackDownload(t *testing.T) {
	calls := 0
	client := &http.Client{Transport: transportFunc(func(r *http.Request) (*http.Response, error) {
		calls++
		if r.Header.Get("Authorization") != "Client-ID secret" {
			t.Error("TrackDownload missing authorization")
		}
		return response(`{}`), nil
	})}
	s := New(client, "secret", "", nil)
	if err := s.TrackDownload(context.Background(), "https://api.unsplash.com/photos/abc/download?x=1"); err != nil {
		t.Fatalf("TrackDownload valid location: %v", err)
	}
	if err := s.TrackDownload(context.Background(), "https://evil.example/photos/abc/download"); err == nil || calls != 1 {
		t.Fatalf("TrackDownload invalid location: err=%v calls=%d, want rejection", err, calls)
	}
}

func TestErrorsDoNotExposePixabayKey(t *testing.T) {
	client := &http.Client{Transport: transportFunc(func(r *http.Request) (*http.Response, error) {
		return nil, &url.Error{Op: "Get", URL: r.URL.String(), Err: errors.New("network failed")}
	})}
	cache := &testCache{entries: map[string][]Image{}}
	_, err := New(client, "", "secret-pixabay-key", cache).Search(context.Background(), "cat")
	if err == nil || strings.Contains(err.Error(), "secret-pixabay-key") {
		t.Fatalf("Search error = %v, want sanitized error", err)
	}
}

func TestWikimediaLicenseAndArtistSafety(t *testing.T) {
	cases := []struct {
		name, license, licenseURL, artist string
		want                              bool
		author                            string
	}{
		{"valid", "CC BY 4.0", "https://creativecommons.org/licenses/by/4.0/", `<a href="https://example.org">Alice &amp; Bob</a><script>alert(1)</script>`, true, "Alice & Bob"},
		{"encoded markup", "CC BY 4.0", "https://creativecommons.org/licenses/by/4.0/", `Alice &lt;img src=x onerror=alert(1)&gt;`, true, "Alice img src=x onerror=alert(1)"},
		{"noncommercial", "CC BY-NC 4.0", "https://creativecommons.org/licenses/by-nc/4.0/", "Alice", false, ""},
		{"unknown", "custom", "https://creativecommons.org/licenses/by/4.0/", "Alice", false, ""},
		{"wrong license URL", "CC BY 4.0", "https://creativecommons.org/licenses/by-nc/4.0/", "Alice", false, ""},
		{"malicious URL", "CC BY 4.0", "javascript:alert(1)", "Alice", false, ""},
	}
	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			client := &http.Client{Transport: transportFunc(func(r *http.Request) (*http.Response, error) {
				if !strings.Contains(r.UserAgent(), "https://github.com/Thanh-D-Nguyen/nihongo-bjt/issues") {
					t.Errorf("User-Agent = %q, want issue tracker contact", r.UserAgent())
				}
				data := map[string]any{"query": map[string]any{"pages": []any{map[string]any{"imageinfo": []any{map[string]any{"url": "https://upload.wikimedia.org/cat.jpg", "descriptionurl": "https://commons.wikimedia.org/wiki/File:Cat.jpg", "extmetadata": map[string]any{"Artist": map[string]string{"value": tt.artist}, "LicenseShortName": map[string]string{"value": tt.license}, "LicenseUrl": map[string]string{"value": tt.licenseURL}}}}}}}}
				b, _ := json.Marshal(data)
				return response(string(b)), nil
			})}
			got, err := New(client, "", "", nil).Search(context.Background(), "cat")
			if err != nil || (len(got) > 0) != tt.want {
				t.Fatalf("Search(%s) = %v, %v, want result=%v", tt.name, got, err, tt.want)
			}
			if tt.want && got[0].Author != tt.author {
				t.Errorf("Author = %q, want %q", got[0].Author, tt.author)
			}
		})
	}
}

func TestPixabayJapaneseLanguage(t *testing.T) {
	for _, tt := range []struct{ q, lang string }{{"猫", "ja"}, {"ひらがな", "ja"}, {"カタカナ", "ja"}, {"cat", ""}} {
		t.Run(tt.q, func(t *testing.T) {
			client := &http.Client{Transport: transportFunc(func(r *http.Request) (*http.Response, error) {
				if got := r.URL.Query().Get("lang"); got != tt.lang {
					t.Errorf("lang(%q) = %q, want %q", tt.q, got, tt.lang)
				}
				return response(`{"hits":[{"webformatURL":"https://pixabay.com/a","pageURL":"https://pixabay.com/p","user":"Alice"}]}`), nil
			})}
			_, err := New(client, "", "key", &testCache{entries: map[string][]Image{}}).Search(context.Background(), tt.q)
			if err != nil {
				t.Fatal(err)
			}
		})
	}
}

func TestAllowedLicense(t *testing.T) {
	for _, tt := range []struct {
		name, url string
		want      bool
	}{
		{"CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0/", true},
		{"CC0", "https://creativecommons.org/publicdomain/zero/1.0/", true},
		{"CC BY-ND 4.0", "https://creativecommons.org/licenses/by-nd/4.0/", false},
		{"CC BY 4.0", "https://creativecommons.org.evil.example/licenses/by/4.0/", false},
		{"CC BY 4.0", "https://creativecommons.org/licenses/by/4.0/?redirect=evil", false},
		{"CC BY 4.0", "", false},
	} {
		if got := allowedLicense(tt.name, tt.url); got != tt.want {
			t.Errorf("allowedLicense(%q,%q) = %v, want %v", tt.name, tt.url, got, tt.want)
		}
	}
}

func TestPexelsFallbackAfterRateLimit(t *testing.T) {
	var order []string
	client := &http.Client{Transport: transportFunc(func(r *http.Request) (*http.Response, error) {
		order = append(order, r.URL.Host)
		switch r.URL.Host {
		case "api.unsplash.com":
			return &http.Response{StatusCode: 403, Body: io.NopCloser(strings.NewReader(`Rate Limit Exceeded`)), Header: make(http.Header)}, nil
		case "pixabay.com":
			return &http.Response{StatusCode: 429, Body: io.NopCloser(strings.NewReader(`rate limit`)), Header: make(http.Header)}, nil
		case "api.pexels.com":
			if got := r.Header.Get("Authorization"); got != "pexels-secret" {
				t.Errorf("Pexels Authorization = %q, want the raw API key", got)
			}
			if r.URL.Query().Get("query") != "cat" {
				t.Errorf("Pexels query = %q, want cat", r.URL.Query().Get("query"))
			}
			return response(`{"photos":[{"url":"https://www.pexels.com/photo/cat-1/","photographer":"Alice","photographer_url":"https://www.pexels.com/@alice","src":{"large":"https://images.pexels.com/photos/1/cat.jpeg?auto=compress"}}]}`), nil
		}
		t.Errorf("unexpected provider %s", r.URL.Host)
		return response(`{}`), nil
	})}
	s := New(client, "unsplash-key", "pixabay-key", &testCache{entries: map[string][]Image{}}, WithPexelsKey("pexels-secret"))
	got, err := s.Search(context.Background(), "cat")
	if err != nil || len(got) != 1 {
		t.Fatalf("Search(cat) = %v, %v, want one Pexels image", got, err)
	}
	want := Image{Provider: "pexels", URL: "https://images.pexels.com/photos/1/cat.jpeg?auto=compress", SourceURL: "https://www.pexels.com/photo/cat-1/", Author: "Alice", AuthorURL: "https://www.pexels.com/@alice", License: "Pexels License", LicenseURL: "https://www.pexels.com/license/"}
	if got[0] != want {
		t.Fatalf("image = %+v, want %+v", got[0], want)
	}
	if strings.Join(order, ",") != "api.unsplash.com,pixabay.com,api.pexels.com" {
		t.Fatalf("provider order = %v, want unsplash, pixabay, pexels", order)
	}
}

func TestPexelsDisabledWithoutKeyAndSkipsIncompleteHits(t *testing.T) {
	client := &http.Client{Transport: transportFunc(func(r *http.Request) (*http.Response, error) {
		if r.URL.Host == "api.pexels.com" {
			t.Fatal("Pexels must not be called without a key")
		}
		return response(`{"query":{"pages":[]}}`), nil
	})}
	if got, err := New(client, "", "", nil).Search(context.Background(), "cat"); err != nil || len(got) != 0 {
		t.Fatalf("Search without keys = %v, %v, want empty", got, err)
	}
	client = &http.Client{Transport: transportFunc(func(r *http.Request) (*http.Response, error) {
		return response(`{"photos":[{"url":"https://www.pexels.com/photo/a/","photographer":"","photographer_url":"https://www.pexels.com/@a","src":{"large":"https://images.pexels.com/a.jpeg"}},{"url":"","photographer":"B","src":{"large":"https://images.pexels.com/b.jpeg"}}]}`), nil
	})}
	got, err := New(client, "", "", nil, WithPexelsKey("k")).pexels(context.Background(), "cat")
	if err != nil || len(got) != 0 {
		t.Fatalf("pexels incomplete hits = %v, %v, want none", got, err)
	}
}

func TestErrorsDoNotExposePexelsKey(t *testing.T) {
	client := &http.Client{Transport: transportFunc(func(r *http.Request) (*http.Response, error) {
		return nil, &url.Error{Op: "Get", URL: r.URL.String(), Err: errors.New("pexels-secret failed")}
	})}
	_, err := New(client, "", "", nil, WithPexelsKey("pexels-secret")).Search(context.Background(), "cat")
	if err == nil || strings.Contains(err.Error(), "pexels-secret") {
		t.Fatalf("Search error = %v, want sanitized error", err)
	}
}

func TestWikimediaPrefersBoundedThumbnail(t *testing.T) {
	client := &http.Client{Transport: transportFunc(func(r *http.Request) (*http.Response, error) {
		if r.URL.Query().Get("iiurlwidth") == "" {
			t.Error("Wikimedia request must ask for a bounded thumbnail width")
		}
		return response(`{"query":{"pages":[{"imageinfo":[{"url":"https://upload.wikimedia.org/orig.jpg","thumburl":"https://thumb.wikimedia.org/t.jpg","descriptionurl":"https://commons.wikimedia.org/wiki/File:Cat.jpg","extmetadata":{"Artist":{"value":"Alice"},"LicenseShortName":{"value":"CC BY 4.0"},"LicenseUrl":{"value":"https://creativecommons.org/licenses/by/4.0/"}}}]}]}}`), nil
	})}
	got, err := New(client, "", "", nil).Search(context.Background(), "cat")
	if err != nil || len(got) != 1 || got[0].URL != "https://thumb.wikimedia.org/t.jpg" {
		t.Fatalf("Search(cat) = %v, %v, want thumbnail URL", got, err)
	}
}

func TestWikimediaHTTPLicenseLinkIsCreditedOverHTTPS(t *testing.T) {
	client := &http.Client{Transport: transportFunc(func(r *http.Request) (*http.Response, error) {
		return response(`{"query":{"pages":[{"imageinfo":[{"url":"https://upload.wikimedia.org/a.jpg","descriptionurl":"https://commons.wikimedia.org/wiki/File:A.jpg","extmetadata":{"Artist":{"value":"Alice"},"LicenseShortName":{"value":"CC BY 4.0"},"LicenseUrl":{"value":"http://creativecommons.org/licenses/by/4.0"}}}]}]}}`), nil
	})}
	got, err := New(client, "", "", nil).Search(context.Background(), "cat")
	if err != nil || len(got) != 1 || got[0].LicenseURL != "https://creativecommons.org/licenses/by/4.0" {
		t.Fatalf("Search(cat) = %+v, %v, want https license URL", got, err)
	}
}
