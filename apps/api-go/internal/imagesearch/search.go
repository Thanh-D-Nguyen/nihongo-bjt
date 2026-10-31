// Package imagesearch searches image providers in priority order.
package imagesearch

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
	"unicode"

	"golang.org/x/net/html"
)

// Image describes a provider image and the metadata needed to credit its creator.
type Image struct {
	Provider, URL, SourceURL, Author, AuthorURL, License, LicenseURL, DownloadLocation string
}

// Cache must persist entries for at least the requested TTL and be shared across
// all instances using the same Pixabay API key. An empty slice is a valid hit.
// Callers must also coordinate concurrent cache misses across client instances.
// Pixabay's temporary image URLs may expire after 24 hours; a cache retained
// longer than that can return expired URLs.
type Cache interface {
	Get(context.Context, string) ([]Image, bool, error)
	Put(context.Context, string, []Image, time.Duration) error
}

type Client struct {
	http                    *http.Client
	unsplashKey, pixabayKey string
	pexelsKey               string
	cache                   Cache
	resultFilter            func(Image) bool
}

// Option configures optional providers.
type Option func(*Client)

// WithPexelsKey enables Pexels, searched after Unsplash and Pixabay.
func WithPexelsKey(key string) Option { return func(c *Client) { c.pexelsKey = key } }

// WithResultFilter rejects unusable images before deciding whether to fall back.
func WithResultFilter(filter func(Image) bool) Option {
	return func(c *Client) { c.resultFilter = filter }
}

// New constructs a client. Pixabay is disabled unless a compliant cache is supplied.
func New(client *http.Client, unsplashKey, pixabayKey string, cache Cache, opts ...Option) *Client {
	if client == nil {
		client = &http.Client{Timeout: 10 * time.Second}
	}
	copyClient := *client
	copyClient.CheckRedirect = func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }
	c := &Client{http: &copyClient, unsplashKey: unsplashKey, pixabayKey: pixabayKey, cache: cache}
	for _, opt := range opts {
		opt(c)
	}
	return c
}

// Search tries providers in priority order (Unsplash, Pixabay, Pexels, Wikimedia)
// and returns the first provider's non-empty results. Provider errors are
// returned only when no provider produces results; cancellation stops fallback.
func (c *Client) Search(ctx context.Context, query string) ([]Image, error) {
	query = strings.TrimSpace(query)
	if query == "" || len(query) > 200 {
		return nil, errors.New("image search query must contain 1 to 200 bytes")
	}
	var failures []error
	type provider struct {
		name   string
		search func(context.Context, string) ([]Image, error)
	}
	var providers []provider
	if c.unsplashKey != "" {
		providers = append(providers, provider{"unsplash", c.unsplash})
	}
	if c.pixabayKey != "" && c.cache != nil {
		providers = append(providers, provider{"pixabay", c.pixabay})
	}
	if c.pexelsKey != "" {
		providers = append(providers, provider{"pexels", c.pexels})
	}
	providers = append(providers, provider{"wikimedia", c.wikimedia})
	for _, p := range providers {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		images, err := p.search(ctx, query)
		if err != nil {
			failures = append(failures, fmt.Errorf("%s: %w", p.name, err))
			continue
		}
		if c.resultFilter != nil {
			filtered := make([]Image, 0, len(images))
			for _, image := range images {
				if c.resultFilter(image) {
					filtered = append(filtered, image)
				}
			}
			images = filtered
		}
		if len(images) > 0 {
			return images, nil
		}
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	return nil, errors.Join(failures...)
}

// get decodes a bounded JSON response; authorization, when set, is sent verbatim.
func (c *Client) get(ctx context.Context, endpoint string, params url.Values, authorization string, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint+"?"+params.Encode(), nil)
	if err != nil {
		return errors.New("invalid request")
	}
	req.Header.Set("User-Agent", "KotobaWorks/1.0 (+https://github.com/Thanh-D-Nguyen/nihongo-bjt/issues)")
	if authorization != "" {
		req.Header.Set("Authorization", authorization)
	}
	resp, err := c.http.Do(req)
	// URL errors may contain a provider key, so do not propagate them.
	if err != nil {
		return errors.New("request failed")
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("HTTP status %d", resp.StatusCode)
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 2<<20)).Decode(out); err != nil {
		return errors.New("invalid provider response")
	}
	return nil
}

// TrackDownload reports an Unsplash selection or other download-like event.
// Pass DownloadLocation from the selected Unsplash image, not its image URL.
func (c *Client) TrackDownload(ctx context.Context, location string) error {
	if c.unsplashKey == "" {
		return errors.New("unsplash not configured")
	}
	u, err := url.Parse(location)
	if err != nil || u.Scheme != "https" || u.Host != "api.unsplash.com" || u.User != nil || !strings.HasPrefix(u.Path, "/photos/") || !strings.HasSuffix(u.Path, "/download") {
		return errors.New("invalid Unsplash download location")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return errors.New("invalid Unsplash download location")
	}
	req.Header.Set("Authorization", "Client-ID "+c.unsplashKey)
	resp, err := c.http.Do(req)
	if err != nil {
		return errors.New("Unsplash download tracking failed")
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("Unsplash download tracking: HTTP status %d", resp.StatusCode)
	}
	return nil
}

func (c *Client) unsplash(ctx context.Context, q string) ([]Image, error) {
	var data struct {
		Results []struct {
			URLs struct {
				Regular string `json:"regular"`
			} `json:"urls"`
			Links struct {
				HTML     string `json:"html"`
				Download string `json:"download_location"`
			} `json:"links"`
			User struct {
				Name  string `json:"name"`
				Links struct {
					HTML string `json:"html"`
				} `json:"links"`
			} `json:"user"`
		} `json:"results"`
	}
	if err := c.get(ctx, "https://api.unsplash.com/search/photos", url.Values{"query": {q}, "per_page": {"10"}}, "Client-ID "+c.unsplashKey, &data); err != nil {
		return nil, err
	}
	var images []Image
	for _, v := range data.Results {
		if v.URLs.Regular != "" && v.User.Name != "" && v.User.Links.HTML != "" && v.Links.HTML != "" && v.Links.Download != "" {
			images = append(images, Image{Provider: "unsplash", URL: v.URLs.Regular, SourceURL: v.Links.HTML, Author: v.User.Name, AuthorURL: v.User.Links.HTML, License: "Unsplash License", LicenseURL: "https://unsplash.com/license", DownloadLocation: v.Links.Download})
		}
	}
	return images, nil
}

func (c *Client) pixabay(ctx context.Context, q string) ([]Image, error) {
	key := "imagesearch:pixabay:" + q
	images, ok, err := c.cache.Get(ctx, key)
	if err != nil {
		return nil, errors.New("cache read failed")
	}
	if ok {
		return append([]Image(nil), images...), nil
	}
	var data struct {
		Hits []struct {
			URL  string `json:"webformatURL"`
			Page string `json:"pageURL"`
			User string `json:"user"`
		} `json:"hits"`
	}
	params := url.Values{"key": {c.pixabayKey}, "q": {q}, "per_page": {"10"}, "safesearch": {"true"}}
	if strings.IndexFunc(q, func(r rune) bool { return unicode.In(r, unicode.Han, unicode.Hiragana, unicode.Katakana) }) >= 0 {
		params.Set("lang", "ja")
	}
	if err := c.get(ctx, "https://pixabay.com/api/", params, "", &data); err != nil {
		return nil, err
	}
	images = []Image{}
	for _, v := range data.Hits {
		if v.URL != "" && v.Page != "" && v.User != "" {
			images = append(images, Image{Provider: "pixabay", URL: v.URL, SourceURL: v.Page, Author: v.User, License: "Pixabay Content License", LicenseURL: "https://pixabay.com/service/license-summary/"})
		}
	}
	if err := c.cache.Put(ctx, key, images, 24*time.Hour); err != nil {
		return nil, errors.New("cache write failed")
	}
	return append([]Image(nil), images...), nil
}

func (c *Client) pexels(ctx context.Context, q string) ([]Image, error) {
	var data struct {
		Photos []struct {
			Page            string `json:"url"`
			Photographer    string `json:"photographer"`
			PhotographerURL string `json:"photographer_url"`
			Src             struct {
				Large string `json:"large"`
			} `json:"src"`
		} `json:"photos"`
	}
	if err := c.get(ctx, "https://api.pexels.com/v1/search", url.Values{"query": {q}, "per_page": {"10"}}, c.pexelsKey, &data); err != nil {
		return nil, err
	}
	var images []Image
	for _, v := range data.Photos {
		if v.Src.Large != "" && v.Page != "" && v.Photographer != "" {
			images = append(images, Image{Provider: "pexels", URL: v.Src.Large, SourceURL: v.Page, Author: v.Photographer, AuthorURL: v.PhotographerURL, License: "Pexels License", LicenseURL: "https://www.pexels.com/license/"})
		}
	}
	return images, nil
}

func (c *Client) wikimedia(ctx context.Context, q string) ([]Image, error) {
	var data struct {
		Error json.RawMessage `json:"error"`
		Query struct {
			Pages []struct {
				Imageinfo []struct {
					URL            string `json:"url"`
					ThumbURL       string `json:"thumburl"`
					DescriptionURL string `json:"descriptionurl"`
					Metadata       map[string]struct {
						Value string `json:"value"`
					} `json:"extmetadata"`
				} `json:"imageinfo"`
			} `json:"pages"`
		} `json:"query"`
	}
	params := url.Values{"action": {"query"}, "format": {"json"}, "formatversion": {"2"}, "generator": {"search"}, "gsrsearch": {q}, "gsrnamespace": {"6"}, "gsrlimit": {"10"}, "prop": {"imageinfo"}, "iiprop": {"url|extmetadata"}, "iiurlwidth": {"1280"}, "iiextmetadatafilter": {"Artist|LicenseShortName|LicenseUrl"}}
	if err := c.get(ctx, "https://commons.wikimedia.org/w/api.php", params, "", &data); err != nil {
		return nil, err
	}
	if len(data.Error) > 0 && string(data.Error) != "null" {
		return nil, errors.New("Wikimedia API error")
	}
	var images []Image
	for _, page := range data.Query.Pages {
		for _, v := range page.Imageinfo {
			m := v.Metadata
			author := artistText(m["Artist"].Value)
			// Commons sometimes reports http:// license links; credit them over https.
			m["LicenseUrl"] = struct {
				Value string `json:"value"`
			}{strings.Replace(m["LicenseUrl"].Value, "http://creativecommons.org/", "https://creativecommons.org/", 1)}
			// Prefer the bounded thumbnail: originals can exceed the rehosting size limit.
			imageURL := v.ThumbURL
			if imageURL == "" {
				imageURL = v.URL
			}
			if imageURL != "" && v.DescriptionURL != "" && author != "" && allowedLicense(m["LicenseShortName"].Value, m["LicenseUrl"].Value) {
				images = append(images, Image{Provider: "wikimedia", URL: imageURL, SourceURL: v.DescriptionURL, Author: author, License: m["LicenseShortName"].Value, LicenseURL: m["LicenseUrl"].Value})
			}
		}
	}
	return images, nil
}

// LicenseAllowed reports whether a Creative Commons license name and URL pair
// is one this system accepts: CC0, CC BY or CC BY-SA with a matching license URL.
func LicenseAllowed(name, rawURL string) bool { return allowedLicense(name, rawURL) }

func allowedLicense(name, rawURL string) bool {
	u, err := url.Parse(rawURL)
	if err != nil || (u.Scheme != "https" && u.Scheme != "http") || u.Host != "creativecommons.org" || u.User != nil || u.RawQuery != "" || u.Fragment != "" {
		return false
	}
	path := strings.TrimSuffix(u.Path, "/")
	if name == "CC0" || name == "CC0 1.0" {
		return path == "/publicdomain/zero/1.0"
	}
	for _, version := range []string{"2.0", "2.5", "3.0", "4.0"} {
		if name == "CC BY "+version && path == "/licenses/by/"+version || name == "CC BY-SA "+version && path == "/licenses/by-sa/"+version {
			return true
		}
	}
	return false
}

// artistText strips markup and script/style content; the result is plain text.
func artistText(value string) string {
	z := html.NewTokenizer(strings.NewReader(value))
	var text strings.Builder
	suppressed := ""
	for {
		switch z.Next() {
		case html.ErrorToken:
			return strings.TrimSpace(text.String())
		case html.StartTagToken:
			tag := z.Token().Data
			if suppressed == "" && (tag == "script" || tag == "style") {
				suppressed = tag
			}
		case html.EndTagToken:
			if z.Token().Data == suppressed {
				suppressed = ""
			}
		case html.TextToken:
			if suppressed == "" {
				text.WriteString(strings.NewReplacer("<", "", ">", "").Replace(string(z.Text())))
			}
		}
	}
}
