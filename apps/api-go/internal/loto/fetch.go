package loto

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

const (
	// ProviderThekyo labels draws imported from the third-party CSV mirror.
	ProviderThekyo = "thekyo_csv_third_party"
	// OfficialVerificationURL is where learners can verify any result.
	OfficialVerificationURL = "https://www.mizuhobank.co.jp/takarakuji/check/loto/index.html"

	maxCSVBytes = 5 * 1024 * 1024
)

var defaultCSVURLs = map[Game]string{
	Loto6: "https://loto6.thekyo.jp/data/loto6.csv",
	Loto7: "https://loto7.thekyo.jp/data/loto7.csv",
}

var defaultAllowedHosts = []string{"loto6.thekyo.jp", "loto7.thekyo.jp"}

// ErrSourceNotAllowed is returned when a configured CSV URL leaves the allowlist.
var ErrSourceNotAllowed = errors.New("loto: CSV source is not allowlisted")

// Fetcher downloads and parses the official-result CSV mirror.
type Fetcher struct {
	Client  *http.Client
	URLs    map[Game]string
	Allowed map[string]struct{}
}

// NewFetcher builds a fetcher from LOTO6_CSV_URL, LOTO7_CSV_URL and
// LOTO_CSV_ALLOWED_HOSTS (comma separated extra hosts).
func NewFetcher() *Fetcher {
	f := &Fetcher{URLs: map[Game]string{}, Allowed: map[string]struct{}{}}
	for game, fallback := range defaultCSVURLs {
		f.URLs[game] = fallback
	}
	if v := strings.TrimSpace(os.Getenv("LOTO6_CSV_URL")); v != "" {
		f.URLs[Loto6] = v
	}
	if v := strings.TrimSpace(os.Getenv("LOTO7_CSV_URL")); v != "" {
		f.URLs[Loto7] = v
	}
	for _, host := range defaultAllowedHosts {
		f.Allowed[host] = struct{}{}
	}
	for _, host := range strings.Split(os.Getenv("LOTO_CSV_ALLOWED_HOSTS"), ",") {
		if host = strings.ToLower(strings.TrimSpace(host)); host != "" {
			f.Allowed[host] = struct{}{}
		}
	}
	f.Client = &http.Client{
		Timeout: 25 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 3 {
				return errors.New("too many redirects")
			}
			return f.checkURL(req.URL)
		},
	}
	return f
}

func (f *Fetcher) checkURL(u *url.URL) error {
	if u.Scheme != "https" || u.User != nil || u.Port() != "" {
		return fmt.Errorf("%w: %s", ErrSourceNotAllowed, u.Redacted())
	}
	if _, ok := f.Allowed[strings.ToLower(u.Hostname())]; !ok {
		return fmt.Errorf("%w: host %s", ErrSourceNotAllowed, u.Hostname())
	}
	return nil
}

// Fetch downloads, decodes and validates the CSV for a game. It returns the
// parsed draws (ascending by draw number) and the resolved source URL.
func (f *Fetcher) Fetch(ctx context.Context, game Game) ([]Draw, string, error) {
	raw, ok := f.URLs[game]
	if !ok {
		return nil, "", fmt.Errorf("%w: no CSV source for %s", ErrInvalidInput, game)
	}
	source, err := url.Parse(raw)
	if err != nil {
		return nil, "", fmt.Errorf("%w: %v", ErrSourceNotAllowed, err)
	}
	if err := f.checkURL(source); err != nil {
		return nil, "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, source.String(), nil)
	if err != nil {
		return nil, "", err
	}
	req.Header.Set("Accept", "text/csv,application/octet-stream;q=0.9")
	req.Header.Set("User-Agent", "KotobaWorks-LotoLab/1.0 (+https://kiokoto.com)")
	resp, err := f.Client.Do(req)
	if err != nil {
		return nil, "", fmt.Errorf("download %s CSV: %w", game, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, "", fmt.Errorf("download %s CSV: source returned HTTP %d", game, resp.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, maxCSVBytes+1))
	if err != nil {
		return nil, "", fmt.Errorf("read %s CSV: %w", game, err)
	}
	if len(body) > maxCSVBytes {
		return nil, "", fmt.Errorf("%w: %s CSV exceeds %d bytes", ErrInvalidInput, game, maxCSVBytes)
	}
	text, err := DecodeCSVBytes(body)
	if err != nil {
		return nil, "", err
	}
	draws, skipped, err := ParseCSVLenient(text, game)
	if err != nil {
		return nil, "", err
	}
	if len(skipped) > 0 {
		slog.Warn("loto csv: skipped invalid mirror rows", "game", game, "skipped", len(skipped), "first", skipped[0].Error())
	}
	if len(draws) == 0 {
		return nil, "", fmt.Errorf("%w: %s CSV has no valid rows", ErrInvalidInput, game)
	}
	for i := range draws {
		if draws[i].Game != game {
			return nil, "", fmt.Errorf("%w: %s CSV contained %s rows", ErrInvalidInput, game, draws[i].Game)
		}
	}
	return draws, resp.Request.URL.String(), nil
}
