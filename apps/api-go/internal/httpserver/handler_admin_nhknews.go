package httpserver

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/net/html"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
)

const (
	nhkEasyFeedDefault       = "https://nhkeasier.com/feed/"
	nhkNormalFeedDefault     = "https://news.web.nhk/n-data/conf/na/rss/cat0.xml"
	nhkLegacyEasyFeedURL     = "https://www3.nhk.or.jp/news/easy/news-list.json"
	nhkLegacyEasyWebFeedURL  = "https://news.web.nhk/news/easy/news-list.json"
	nhkLegacyNormalFeedURL   = "https://www3.nhk.or.jp/rss/news/cat0.xml"
	nhkFeedMaxBytes          = 8 << 20
)

type nhkNewsConfig struct {
	Locale        string `json:"locale"`
	DefaultType   string `json:"defaultType"`
	EasyEnabled   bool   `json:"easyEnabled"`
	EasyFeedURL   string `json:"easyFeedUrl"`
	NormalEnabled bool   `json:"normalEnabled"`
	NormalFeedURL string `json:"normalFeedUrl"`
}

func defaultNHKNewsConfig(locale string) nhkNewsConfig {
	return nhkNewsConfig{
		Locale: locale, DefaultType: "easy", EasyEnabled: true, EasyFeedURL: nhkEasyFeedDefault,
		NormalEnabled: true, NormalFeedURL: nhkNormalFeedDefault,
	}
}

func resolveNHKFeedConfig(cfg nhkNewsConfig) nhkNewsConfig {
	resolved := cfg
	switch strings.TrimSpace(resolved.EasyFeedURL) {
	case "", nhkLegacyEasyFeedURL, nhkLegacyEasyWebFeedURL:
		resolved.EasyFeedURL = nhkEasyFeedDefault
	}
	switch strings.TrimSpace(resolved.NormalFeedURL) {
	case "", nhkLegacyNormalFeedURL:
		resolved.NormalFeedURL = nhkNormalFeedDefault
	}
	return resolved
}

func nhkNewsLocale(r *http.Request) (string, error) {
	locale := r.URL.Query().Get("locale")
	if locale == "" {
		return "vi", nil
	}
	switch locale {
	case "en", "ja", "vi":
		return locale, nil
	default:
		return "", fmt.Errorf("unsupported locale")
	}
}

func readNHKNewsConfig(ctx context.Context, db *pgxpool.Pool, locale string) (nhkNewsConfig, error) {
	cfg := defaultNHKNewsConfig(locale)
	err := db.QueryRow(ctx, `SELECT default_type, easy_enabled, easy_feed_url, normal_enabled, normal_feed_url
		FROM content.nhk_news_config WHERE locale=$1`, locale).
		Scan(&cfg.DefaultType, &cfg.EasyEnabled, &cfg.EasyFeedURL, &cfg.NormalEnabled, &cfg.NormalFeedURL)
	if errors.Is(err, pgx.ErrNoRows) {
		return cfg, nil
	}
	return cfg, err
}

func adminNhkNewsConfigHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		locale, err := nhkNewsLocale(r)
		if err != nil {
			writeJSONError(w, err.Error(), http.StatusBadRequest)
			return
		}
		cfg, err := readNHKNewsConfig(r.Context(), db, locale)
		if err != nil {
			logger.Error("read nhk news config", "locale", locale, "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, cfg)
	}
}

func adminNhkNewsConfigPatchHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		locale, err := nhkNewsLocale(r)
		if err != nil {
			writeJSONError(w, err.Error(), http.StatusBadRequest)
			return
		}
		var req struct {
			DefaultType   *string `json:"defaultType"`
			EasyEnabled   *bool   `json:"easyEnabled"`
			EasyFeedURL   *string `json:"easyFeedUrl"`
			NormalEnabled *bool   `json:"normalEnabled"`
			NormalFeedURL *string `json:"normalFeedUrl"`
		}
		decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64<<10))
		decoder.DisallowUnknownFields()
		if err := decoder.Decode(&req); err != nil {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		var trailing any
		if err := decoder.Decode(&trailing); !errors.Is(err, io.EOF) {
			writeJSONError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.DefaultType == nil && req.EasyEnabled == nil && req.EasyFeedURL == nil && req.NormalEnabled == nil && req.NormalFeedURL == nil {
			writeJSONError(w, "at least one config field is required", http.StatusBadRequest)
			return
		}
		if req.DefaultType != nil && *req.DefaultType != "easy" && *req.DefaultType != "normal" {
			writeJSONError(w, "defaultType must be easy or normal", http.StatusBadRequest)
			return
		}
		if req.EasyFeedURL != nil && !validNHKFeedURL(*req.EasyFeedURL) {
			writeJSONError(w, "easyFeedUrl must be an absolute HTTP or HTTPS URL", http.StatusBadRequest)
			return
		}
		if req.NormalFeedURL != nil && !validNHKFeedURL(*req.NormalFeedURL) {
			writeJSONError(w, "normalFeedUrl must be an absolute HTTP or HTTPS URL", http.StatusBadRequest)
			return
		}

		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin nhk config update", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(r.Context())

		before, err := readNHKNewsConfigTx(r.Context(), tx, locale)
		if err != nil {
			logger.Error("read nhk config before update", "locale", locale, "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		var after nhkNewsConfig
		err = tx.QueryRow(r.Context(), `INSERT INTO content.nhk_news_config
			(locale, default_type, easy_enabled, easy_feed_url, normal_enabled, normal_feed_url, created_at, updated_at)
			VALUES ($1, COALESCE($2,'easy'), COALESCE($3,true), COALESCE($4,$5), COALESCE($6,false), COALESCE($7,$8), NOW(), NOW())
			ON CONFLICT (locale) DO UPDATE SET
			default_type=COALESCE($2, content.nhk_news_config.default_type),
			easy_enabled=COALESCE($3, content.nhk_news_config.easy_enabled),
			easy_feed_url=COALESCE($4, content.nhk_news_config.easy_feed_url),
			normal_enabled=COALESCE($6, content.nhk_news_config.normal_enabled),
			normal_feed_url=COALESCE($7, content.nhk_news_config.normal_feed_url), updated_at=NOW()
			RETURNING locale, default_type, easy_enabled, easy_feed_url, normal_enabled, normal_feed_url`,
			locale, req.DefaultType, req.EasyEnabled, req.EasyFeedURL, nhkEasyFeedDefault,
			req.NormalEnabled, req.NormalFeedURL, nhkNormalFeedDefault).
			Scan(&after.Locale, &after.DefaultType, &after.EasyEnabled, &after.EasyFeedURL, &after.NormalEnabled, &after.NormalFeedURL)
		if err != nil {
			logger.Error("update nhk news config", "locale", locale, "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		beforeJSON, _ := json.Marshal(before)
		afterJSON, _ := json.Marshal(after)
		if _, err := tx.Exec(r.Context(), `INSERT INTO ops.admin_audit_log
			(action, actor_id, target_id, target_type, reason, before, after, created_at)
			VALUES ('nhk_news.config.updated',$1,$2,'nhk_news_config','config patch',$3,$4,NOW())`,
			identity.ActorID, locale, beforeJSON, afterJSON); err != nil {
			logger.Error("audit nhk config update", "locale", locale, "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			logger.Error("commit nhk config update", "locale", locale, "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, after)
	}
}

func readNHKNewsConfigTx(ctx context.Context, tx pgx.Tx, locale string) (nhkNewsConfig, error) {
	cfg := defaultNHKNewsConfig(locale)
	err := tx.QueryRow(ctx, `SELECT default_type, easy_enabled, easy_feed_url, normal_enabled, normal_feed_url
		FROM content.nhk_news_config WHERE locale=$1 FOR UPDATE`, locale).
		Scan(&cfg.DefaultType, &cfg.EasyEnabled, &cfg.EasyFeedURL, &cfg.NormalEnabled, &cfg.NormalFeedURL)
	if errors.Is(err, pgx.ErrNoRows) {
		return cfg, nil
	}
	return cfg, err
}

func validNHKFeedURL(raw string) bool {
	u, err := url.ParseRequestURI(strings.TrimSpace(raw))
	if err != nil || u.Hostname() == "" || u.Scheme != "https" || u.User != nil || u.Fragment != "" {
		return false
	}
	return isNHKHost(strings.ToLower(u.Hostname()))
}

func validNHKArticleURL(raw string) bool {
	u, err := url.ParseRequestURI(strings.TrimSpace(raw))
	return err == nil && u.Hostname() != "" && (u.Scheme == "https" || u.Scheme == "http") && u.User == nil && u.Fragment == "" && isNHKHost(strings.ToLower(u.Hostname()))
}

func isNHKHost(host string) bool {
	return host == "nhk.or.jp" ||
		strings.HasSuffix(host, ".nhk.or.jp") ||
		host == "news.web.nhk" ||
		strings.HasSuffix(host, ".web.nhk") ||
		host == "nhkeasier.com" ||
		strings.HasSuffix(host, ".nhkeasier.com")
}

type nhkFeedArticle struct {
	ID             string
	SourceType     string
	Title          string
	TitleWithRuby  string
	URL            string
	PublishedAt    time.Time
	BodyHTML       string
	BodyPlain      string
	ImageURL       string
	AudioURL       string
	Difficulty     string
	VocabularyJSON []byte
}

type nhkEasyFeedItem struct {
	NewsID              string `json:"news_id"`
	Title               string `json:"title"`
	TitleWithRuby       string `json:"title_with_ruby"`
	NewsPrearrangedTime string `json:"news_prearranged_time"`
	URL                 string `json:"url"`
	NewsWebURL          string `json:"news_web_url"`
	ImageURL            string `json:"news_web_image_uri"`
	AudioURL            string `json:"news_easy_voice_uri"`
	BodyHTML            string `json:"body_html"`
	BodyPlain           string `json:"body_plain"`
}

type nhkRSS struct {
	XMLName xml.Name       `xml:"rss"`
	Channel *nhkRSSChannel `xml:"channel"`
}

type nhkRSSChannel struct {
	Items []nhkRSSItem `xml:"item"`
}

type nhkRSSItem struct {
	Title       string `xml:"title"`
	Link        string `xml:"link"`
	GUID        string `xml:"guid"`
	PubDate     string `xml:"pubDate"`
	Description string `xml:"description"`
	Enclosures  []struct {
		URL  string `xml:"url,attr"`
		Type string `xml:"type,attr"`
	} `xml:"enclosure"`
	Thumbnails []struct {
		URL string `xml:"url,attr"`
	} `xml:"http://search.yahoo.com/mrss/ thumbnail"`
}

func newNHKFeedHTTPClient() *http.Client {
	return &http.Client{Timeout: 15 * time.Second, CheckRedirect: func(req *http.Request, via []*http.Request) error {
		if len(via) >= 3 || !validNHKFeedURL(req.URL.String()) {
			return fmt.Errorf("unsafe NHK redirect")
		}
		return nil
	}}
}

func adminNhkNewsRefreshHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	client := newNHKFeedHTTPClient()
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetAdminIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		locale, err := nhkNewsLocale(r)
		if err != nil {
			writeJSONError(w, err.Error(), http.StatusBadRequest)
			return
		}
		cfg, err := readNHKNewsConfig(r.Context(), db, locale)
		if err != nil {
			logger.Error("read nhk config for refresh", "locale", locale, "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		cfg = resolveNHKFeedConfig(cfg)
		var easy, normal []nhkFeedArticle
		feedErrors := map[string]string{}
		if cfg.EasyEnabled {
			easy, err = fetchNHKEasy(r.Context(), client, cfg.EasyFeedURL)
			if err != nil {
				logger.Warn("fetch NHK Easy feed", "error", err)
				feedErrors["easy"] = "NHK feed unavailable"
			}
		}
		if cfg.NormalEnabled {
			normal, err = fetchNHKNormal(r.Context(), client, cfg.NormalFeedURL)
			if err != nil {
				logger.Warn("fetch NHK normal feed", "error", err)
				feedErrors["normal"] = "NHK feed unavailable"
			}
		}
		if len(feedErrors) > 0 && len(easy)+len(normal) == 0 {
			writeJSONError(w, "NHK feed refresh failed", http.StatusBadGateway)
			return
		}
		counts := map[string]map[string]int{"easy": {"count": len(easy)}, "normal": {"count": len(normal)}}
		articles := append(easy, normal...)
		enrichNHKArticlesWithLexemes(r.Context(), db, articles)
		tx, err := db.Begin(r.Context())
		if err != nil {
			logger.Error("begin nhk feed refresh", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(r.Context())
		if err := persistNHKFeedArticles(r.Context(), tx, articles); err != nil {
			logger.Error("persist nhk feed articles", "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		after, _ := json.Marshal(map[string]any{"locale": locale, "feeds": counts, "errors": feedErrors})
		if _, err := tx.Exec(r.Context(), `INSERT INTO ops.admin_audit_log
			(action, actor_id, target_id, target_type, reason, after, created_at)
			VALUES ('nhk_news.feed.refreshed',$1,$2,'nhk_news_config','feed refresh',$3,NOW())`, identity.ActorID, locale, after); err != nil {
			logger.Error("audit nhk feed refresh", "locale", locale, "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			logger.Error("commit nhk feed refresh", "locale", locale, "error", err)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if len(feedErrors) > 0 {
			writeJSON(w, http.StatusMultiStatus, map[string]any{"easy": counts["easy"], "normal": counts["normal"], "errors": feedErrors})
			return
		}
		writeJSON(w, http.StatusOK, counts)
	}
}

// SyncNHKNewsFeeds heals stale NHK feed URLs in content.nhk_news_config and refreshes both Easy and Normal feeds.
func SyncNHKNewsFeeds(ctx context.Context, db *pgxpool.Pool, logger *slog.Logger) (int, error) {
	if db == nil {
		return 0, nil
	}
	if logger == nil {
		logger = slog.Default()
	}
	_, _ = db.Exec(ctx, `UPDATE content.nhk_news_config
		SET easy_feed_url = CASE
				WHEN easy_feed_url IN ($1, $2, '') THEN $3
				ELSE easy_feed_url
			END,
			normal_feed_url = CASE
				WHEN normal_feed_url IN ($4, '') THEN $5
				ELSE normal_feed_url
			END,
			normal_enabled = true,
			easy_enabled = true,
			updated_at = NOW()
		WHERE easy_feed_url IN ($1, $2, '') OR normal_feed_url IN ($4, '') OR NOT normal_enabled`,
		nhkLegacyEasyFeedURL, nhkLegacyEasyWebFeedURL, nhkEasyFeedDefault, nhkLegacyNormalFeedURL, nhkNormalFeedDefault)

	cfg, err := readNHKNewsConfig(ctx, db, "vi")
	if err != nil {
		return 0, err
	}
	cfg = resolveNHKFeedConfig(cfg)
	client := newNHKFeedHTTPClient()
	var articles []nhkFeedArticle
	var easyErr, normalErr error
	if cfg.EasyEnabled {
		easy, err := fetchNHKEasy(ctx, client, cfg.EasyFeedURL)
		if err != nil {
			easyErr = err
			logger.Warn("nhk_news_sync: easy feed failed", "error", err)
		} else {
			articles = append(articles, easy...)
		}
	}
	if cfg.NormalEnabled {
		normal, err := fetchNHKNormal(ctx, client, cfg.NormalFeedURL)
		if err != nil {
			normalErr = err
			logger.Warn("nhk_news_sync: normal feed failed", "error", err)
		} else {
			articles = append(articles, normal...)
		}
	}
	if len(articles) == 0 {
		if easyErr != nil {
			return 0, easyErr
		}
		if normalErr != nil {
			return 0, normalErr
		}
		return 0, nil
	}
	enrichNHKArticlesWithLexemes(ctx, db, articles)
	tx, err := db.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)
	if err := persistNHKFeedArticles(ctx, tx, articles); err != nil {
		return 0, err
	}
	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}
	return len(articles), nil
}

func persistNHKFeedArticles(ctx context.Context, tx pgx.Tx, articles []nhkFeedArticle) error {
	for _, article := range articles {
		vocabStr := "[]"
		if len(article.VocabularyJSON) > 0 && string(article.VocabularyJSON) != "[]" {
			vocabStr = string(article.VocabularyJSON)
		}
		if _, err := tx.Exec(ctx, `INSERT INTO content.nhk_article
			(id, source_type, title, title_with_ruby, url, difficulty, body_html, body_plain, published_at, image_url, audio_url, vocabulary, fetched_at, updated_at)
			VALUES ($1,$2,$3,NULLIF($4,''),$5,NULLIF($6,''),NULLIF($7,''),NULLIF($8,''),$9,NULLIF($10,''),NULLIF($11,''),$12::jsonb,NOW(),NOW())
			ON CONFLICT (id) DO UPDATE SET
				source_type=EXCLUDED.source_type,
				title=EXCLUDED.title,
				title_with_ruby=COALESCE(EXCLUDED.title_with_ruby,content.nhk_article.title_with_ruby),
				url=EXCLUDED.url,
				difficulty=COALESCE(EXCLUDED.difficulty,content.nhk_article.difficulty),
				body_html=COALESCE(EXCLUDED.body_html,content.nhk_article.body_html),
				body_plain=COALESCE(EXCLUDED.body_plain,content.nhk_article.body_plain),
				image_url=COALESCE(EXCLUDED.image_url,content.nhk_article.image_url),
				audio_url=COALESCE(EXCLUDED.audio_url,content.nhk_article.audio_url),
				vocabulary=CASE
					WHEN EXCLUDED.vocabulary IS NOT NULL AND EXCLUDED.vocabulary != '[]'::jsonb THEN EXCLUDED.vocabulary
					ELSE COALESCE(content.nhk_article.vocabulary,'[]'::jsonb)
				END,
				published_at=EXCLUDED.published_at,
				fetched_at=NOW(),
				updated_at=NOW()`,
			article.ID, article.SourceType, article.Title, article.TitleWithRuby,
			article.URL, article.Difficulty, article.BodyHTML, article.BodyPlain,
			article.PublishedAt, article.ImageURL, article.AudioURL, vocabStr); err != nil {
			return err
		}
	}
	return nil
}

func fetchNHKFeed(ctx context.Context, client *http.Client, feedURL string) ([]byte, error) {
	if !validNHKFeedFetchURL(feedURL) {
		return nil, fmt.Errorf("invalid feed URL")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, feedURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "KotobaWorks-NHK-Feed/1.0")
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("feed returned HTTP %d", resp.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, nhkFeedMaxBytes+1))
	if err != nil {
		return nil, err
	}
	if len(body) > nhkFeedMaxBytes {
		return nil, fmt.Errorf("feed exceeds %d bytes", nhkFeedMaxBytes)
	}
	return body, nil
}

func validNHKFeedFetchURL(raw string) bool {
	if validNHKFeedURL(raw) {
		return true
	}
	u, err := url.ParseRequestURI(strings.TrimSpace(raw))
	if err != nil || u.Scheme != "http" || u.User != nil || u.Fragment != "" {
		return false
	}
	ip := net.ParseIP(u.Hostname())
	return ip != nil && ip.IsLoopback()
}

var (
	nhkEasierStoryPathRe = regexp.MustCompile(`/story/([0-9]+)/?`)
	nhkNormalWebKeyRe    = regexp.MustCompile(`/newsweb/na/([a-z0-9-]+)`)
	nhkRubyPairRe        = regexp.MustCompile(`<ruby>\s*([^<]+?)\s*(?:<rp>[^<]*</rp>)?<rt>\s*([^<]+?)\s*</rt>(?:<rp>[^<]*</rp>)?\s*</ruby>`)
	nhkKanjiSeqRe        = regexp.MustCompile(`[\p{Han}][\p{Han}ヶヵ々]*`)
)

func fetchNHKEasy(ctx context.Context, client *http.Client, feedURL string) ([]nhkFeedArticle, error) {
	body, err := fetchNHKFeed(ctx, client, feedURL)
	if err != nil {
		return nil, err
	}
	trimmed := bytes.TrimSpace(body)
	if len(trimmed) > 0 && trimmed[0] == '<' {
		return parseNHKEasyRSS(body)
	}
	var items []nhkEasyFeedItem
	if err := json.Unmarshal(body, &items); err != nil {
		return nil, fmt.Errorf("decode easy feed: %w", err)
	}
	if items == nil {
		return nil, fmt.Errorf("decode easy feed: expected a JSON array")
	}
	// NHK also serves a list of date-keyed maps rather than a flat list.
	if len(items) > 0 && items[0].NewsID == "" {
		var dated []map[string][]nhkEasyFeedItem
		if err := json.Unmarshal(body, &dated); err != nil {
			return nil, fmt.Errorf("decode dated easy feed: %w", err)
		}
		items = nil
		for _, group := range dated {
			for _, daily := range group {
				items = append(items, daily...)
			}
		}
	}
	articles := make([]nhkFeedArticle, 0, len(items))
	for _, item := range items {
		id := strings.TrimSpace(item.NewsID)
		title := strings.TrimSpace(item.Title)
		if id == "" || title == "" {
			return nil, fmt.Errorf("easy feed item lacks news_id or title")
		}
		if len("easy:")+len(id) > 64 {
			return nil, fmt.Errorf("easy feed item id is too long")
		}
		published, err := time.ParseInLocation("20060102150405", item.NewsPrearrangedTime, time.FixedZone("JST", 9*60*60))
		if err != nil {
			published, err = time.ParseInLocation("2006-01-02 15:04:05", item.NewsPrearrangedTime, time.FixedZone("JST", 9*60*60))
		}
		if err != nil {
			return nil, fmt.Errorf("parse easy feed date for %s: %w", id, err)
		}
		articleURL := strings.TrimSpace(item.NewsWebURL)
		if articleURL == "" {
			articleURL = strings.TrimSpace(item.URL)
		}
		if articleURL == "" {
			articleURL = "https://www3.nhk.or.jp/news/easy/" + url.PathEscape(id) + "/" + url.PathEscape(id) + ".html"
		}
		if !validNHKArticleURL(articleURL) {
			return nil, fmt.Errorf("easy feed item %s has invalid URL", id)
		}
		imageURL := strings.TrimSpace(item.ImageURL)
		if imageURL != "" && !validNHKArticleURL(imageURL) {
			imageURL = ""
		}
		audioURL := strings.TrimSpace(item.AudioURL)
		if audioURL != "" && !validNHKArticleURL(audioURL) {
			audioURL = ""
		}
		bodyPlain := strings.TrimSpace(item.BodyPlain)
		if bodyPlain == "" && strings.TrimSpace(item.BodyHTML) != "" {
			bodyPlain = nhkSummaryText(item.BodyHTML)
		}
		articles = append(articles, nhkFeedArticle{
			ID: "easy:" + id, SourceType: "easy", Title: title, TitleWithRuby: strings.TrimSpace(item.TitleWithRuby),
			URL: articleURL, PublishedAt: published, BodyHTML: strings.TrimSpace(item.BodyHTML),
			BodyPlain: bodyPlain, ImageURL: imageURL, AudioURL: audioURL, Difficulty: "N4",
		})
	}
	return articles, nil
}

func parseNHKEasyRSS(body []byte) ([]nhkFeedArticle, error) {
	var feed nhkRSS
	if err := xml.Unmarshal(body, &feed); err != nil {
		return nil, fmt.Errorf("decode easy RSS feed: %w", err)
	}
	if feed.Channel == nil {
		return nil, fmt.Errorf("decode easy RSS feed: missing channel")
	}
	articles := make([]nhkFeedArticle, 0, len(feed.Channel.Items))
	for _, item := range feed.Channel.Items {
		title := strings.TrimSpace(item.Title)
		articleURL := strings.TrimSpace(item.Link)
		if articleURL == "" {
			articleURL = strings.TrimSpace(item.GUID)
		}
		if title == "" || !validNHKArticleURL(articleURL) {
			return nil, fmt.Errorf("easy RSS item lacks title or valid URL")
		}
		published, err := parseNHKDate(item.PubDate)
		if err != nil {
			return nil, fmt.Errorf("parse easy RSS date for %s: %w", articleURL, err)
		}
		id := ""
		if m := nhkEasierStoryPathRe.FindStringSubmatch(articleURL); len(m) == 2 {
			id = "easy:nhkeasier-" + m[1]
		} else {
			idSource := strings.TrimSpace(item.GUID)
			if idSource == "" {
				idSource = articleURL
			}
			hash := sha256.Sum256([]byte(idSource))
			id = "easy:" + hex.EncodeToString(hash[:])[:56]
		}
		imageURL, bodyHTML := extractNHKEasierDescription(item.Description)
		for _, image := range item.Thumbnails {
			if imageURL == "" && validNHKArticleURL(image.URL) {
				imageURL = image.URL
			}
		}
		audioURL := ""
		for _, enclosure := range item.Enclosures {
			if imageURL == "" && strings.HasPrefix(enclosure.Type, "image/") && validNHKArticleURL(enclosure.URL) {
				imageURL = enclosure.URL
			}
			if audioURL == "" && strings.HasPrefix(enclosure.Type, "audio/") && validNHKArticleURL(enclosure.URL) {
				audioURL = enclosure.URL
			}
		}
		bodyPlain := nhkSummaryText(bodyHTML)
		titleWithRuby := annotateTextWithRubyPairs(title, extractRubyPairsFromHTML(bodyHTML))
		articles = append(articles, nhkFeedArticle{
			ID: id, SourceType: "easy", Title: title, TitleWithRuby: titleWithRuby,
			URL: articleURL, PublishedAt: published, BodyHTML: bodyHTML, BodyPlain: bodyPlain,
			ImageURL: imageURL, AudioURL: audioURL, Difficulty: "N4",
		})
	}
	return articles, nil
}

func extractNHKEasierDescription(raw string) (imageURL string, bodyHTML string) {
	tokenizer := html.NewTokenizer(strings.NewReader(raw))
	var out strings.Builder
	for {
		tt := tokenizer.Next()
		if tt == html.ErrorToken {
			break
		}
		tok := tokenizer.Token()
		switch tt {
		case html.SelfClosingTagToken, html.StartTagToken:
			if tok.Data == "img" {
				for _, attr := range tok.Attr {
					if strings.EqualFold(attr.Key, "src") {
						src := strings.TrimSpace(attr.Val)
						if strings.HasPrefix(src, "/") {
							src = "https://nhkeasier.com" + src
						}
						if imageURL == "" && validNHKArticleURL(src) {
							imageURL = src
						}
					}
				}
				continue
			}
			out.WriteString(tok.String())
		case html.EndTagToken:
			if tok.Data == "img" {
				continue
			}
			out.WriteString(tok.String())
		case html.TextToken:
			out.WriteString(html.EscapeString(tok.Data))
		}
	}
	return imageURL, strings.TrimSpace(out.String())
}

func extractRubyPairsFromHTML(bodyHTML string) map[string]string {
	pairs := make(map[string]string)
	for _, m := range nhkRubyPairRe.FindAllStringSubmatch(bodyHTML, -1) {
		if len(m) == 3 {
			base := strings.TrimSpace(html.UnescapeString(m[1]))
			rt := strings.TrimSpace(html.UnescapeString(m[2]))
			if base != "" && rt != "" && base != rt {
				if _, exists := pairs[base]; !exists {
					pairs[base] = rt
				}
			}
		}
	}
	return pairs
}

func annotateTextWithRubyPairs(text string, rubyMap map[string]string) string {
	if text == "" || len(rubyMap) == 0 {
		return ""
	}
	escaped := html.EscapeString(text)
	annotated := nhkKanjiSeqRe.ReplaceAllStringFunc(escaped, func(kanjiWord string) string {
		if rt, ok := rubyMap[kanjiWord]; ok && rt != "" && rt != kanjiWord {
			return "<ruby>" + kanjiWord + "<rt>" + html.EscapeString(rt) + "</rt></ruby>"
		}
		return kanjiWord
	})
	if annotated == escaped {
		return ""
	}
	return annotated
}

func fetchNHKNormal(ctx context.Context, client *http.Client, feedURL string) ([]nhkFeedArticle, error) {
	body, err := fetchNHKFeed(ctx, client, feedURL)
	if err != nil {
		return nil, err
	}
	var feed nhkRSS
	if err := xml.Unmarshal(body, &feed); err != nil {
		return nil, fmt.Errorf("decode normal feed: %w", err)
	}
	if feed.Channel == nil {
		return nil, fmt.Errorf("decode normal feed: missing RSS channel")
	}
	articles := make([]nhkFeedArticle, 0, len(feed.Channel.Items))
	for idx, item := range feed.Channel.Items {
		title := strings.TrimSpace(item.Title)
		articleURL := strings.TrimSpace(item.Link)
		if articleURL == "" {
			articleURL = strings.TrimSpace(item.GUID)
		}
		if title == "" || !validNHKArticleURL(articleURL) {
			return nil, fmt.Errorf("normal feed item lacks title or valid URL")
		}
		published, err := parseNHKDate(item.PubDate)
		if err != nil {
			return nil, fmt.Errorf("parse normal feed date for %s: %w", articleURL, err)
		}
		idSource := strings.TrimSpace(item.GUID)
		if idSource == "" {
			idSource = articleURL
		}
		hash := sha256.Sum256([]byte(idSource))
		imageURL := ""
		for _, image := range item.Thumbnails {
			if validNHKArticleURL(image.URL) {
				imageURL = image.URL
				break
			}
		}
		for _, enclosure := range item.Enclosures {
			if imageURL == "" && strings.HasPrefix(enclosure.Type, "image/") && validNHKArticleURL(enclosure.URL) {
				imageURL = enclosure.URL
			}
		}
		summary := nhkSummaryText(item.Description)
		if idx < 16 {
			if detailImg, detailSummary := fetchNHKWebArticleMeta(ctx, client, articleURL); detailImg != "" || detailSummary != "" {
				if imageURL == "" && detailImg != "" {
					imageURL = detailImg
				}
				if len(detailSummary) > len(summary) {
					summary = detailSummary
				}
			}
		}
		articles = append(articles, nhkFeedArticle{
			ID: "normal:" + hex.EncodeToString(hash[:])[:56], SourceType: "normal", Title: title, URL: articleURL,
			PublishedAt: published, BodyPlain: summary, ImageURL: imageURL, Difficulty: "N2",
		})
	}
	return articles, nil
}

func fetchNHKWebArticleMeta(ctx context.Context, client *http.Client, articleURL string) (imageURL string, summary string) {
	u, err := url.Parse(articleURL)
	if err != nil || !strings.EqualFold(u.Hostname(), "news.web.nhk") {
		return "", ""
	}
	m := nhkNormalWebKeyRe.FindStringSubmatch(u.Path)
	if len(m) != 2 {
		return "", ""
	}
	metaURL := "https://api.web.nhk/r8/t/newsarticle/na/" + m[1] + ".json"
	reqCtx, cancel := context.WithTimeout(ctx, 4*time.Second)
	defer cancel()
	payload, err := fetchNHKFeed(reqCtx, client, metaURL)
	if err != nil {
		return "", ""
	}
	var doc struct {
		Description string `json:"description"`
		Abstract    string `json:"abstract"`
		Image       struct {
			Medium struct {
				URL string `json:"url"`
			} `json:"medium"`
			Icon struct {
				URL string `json:"url"`
			} `json:"icon"`
		} `json:"image"`
	}
	if err := json.Unmarshal(payload, &doc); err != nil {
		return "", ""
	}
	img := strings.TrimSpace(doc.Image.Medium.URL)
	if img == "" {
		img = strings.TrimSpace(doc.Image.Icon.URL)
	}
	if validNHKArticleURL(img) {
		imageURL = img
	}
	desc := strings.TrimSpace(doc.Description)
	abs := strings.TrimSpace(doc.Abstract)
	if abs != "" && !strings.Contains(desc, abs) {
		if desc != "" {
			summary = desc + "\n\n" + abs
		} else {
			summary = abs
		}
	} else {
		summary = desc
	}
	return imageURL, strings.TrimSpace(summary)
}

func enrichNHKArticlesWithLexemes(ctx context.Context, db *pgxpool.Pool, articles []nhkFeedArticle) {
	if db == nil || len(articles) == 0 {
		return
	}
	candidateSet := make(map[string]struct{})
	for i := range articles {
		for _, w := range nhkKanjiSeqRe.FindAllString(articles[i].Title, -1) {
			if len([]rune(w)) >= 1 && len([]rune(w)) <= 10 {
				candidateSet[w] = struct{}{}
			}
		}
		for _, w := range nhkKanjiSeqRe.FindAllString(articles[i].BodyPlain, -1) {
			if len([]rune(w)) >= 1 && len([]rune(w)) <= 10 {
				candidateSet[w] = struct{}{}
			}
		}
		for w := range extractRubyPairsFromHTML(articles[i].BodyHTML) {
			candidateSet[w] = struct{}{}
		}
	}
	if len(candidateSet) == 0 {
		return
	}
	candidates := make([]string, 0, len(candidateSet))
	for w := range candidateSet {
		candidates = append(candidates, w)
	}
	rows, err := db.Query(ctx, `SELECT headword, COALESCE(reading,'')
		FROM content.lexeme
		WHERE status='active' AND headword = ANY($1) AND COALESCE(btrim(reading),'') != ''
		ORDER BY frequency_rank ASC NULLS LAST`, candidates)
	if err != nil {
		return
	}
	defer rows.Close()
	lexemeReadings := make(map[string]string)
	for rows.Next() {
		var hw, reading string
		if err := rows.Scan(&hw, &reading); err == nil && hw != "" && reading != "" {
			if _, exists := lexemeReadings[hw]; !exists {
				lexemeReadings[hw] = reading
			}
		}
	}
	for i := range articles {
		rubyMap := make(map[string]string, len(lexemeReadings))
		for k, v := range lexemeReadings {
			rubyMap[k] = v
		}
		for k, v := range extractRubyPairsFromHTML(articles[i].BodyHTML) {
			rubyMap[k] = v
		}
		if articles[i].TitleWithRuby == "" {
			articles[i].TitleWithRuby = annotateTextWithRubyPairs(articles[i].Title, rubyMap)
		}
		if articles[i].BodyHTML == "" && strings.TrimSpace(articles[i].BodyPlain) != "" {
			paragraphs := strings.Split(strings.TrimSpace(articles[i].BodyPlain), "\n")
			var htmlBuf strings.Builder
			for _, p := range paragraphs {
				p = strings.TrimSpace(p)
				if p == "" {
					continue
				}
				annotated := annotateTextWithRubyPairs(p, rubyMap)
				if annotated == "" {
					annotated = html.EscapeString(p)
				}
				htmlBuf.WriteString("<p>")
				htmlBuf.WriteString(annotated)
				htmlBuf.WriteString("</p>")
			}
			articles[i].BodyHTML = htmlBuf.String()
		}
	}
}

func nhkSummaryText(value string) string {
	tokenizer := html.NewTokenizer(strings.NewReader(value))
	var text strings.Builder
	ignoredDepth := 0
	for {
		switch tokenizer.Next() {
		case html.ErrorToken:
			return strings.Join(strings.Fields(text.String()), " ")
		case html.StartTagToken:
			token := tokenizer.Token()
			if token.Data == "script" || token.Data == "style" || token.Data == "rt" || token.Data == "rp" {
				ignoredDepth++
			}
			if token.Data == "p" || token.Data == "br" {
				text.WriteByte(' ')
			}
		case html.EndTagToken:
			token := tokenizer.Token()
			if (token.Data == "script" || token.Data == "style" || token.Data == "rt" || token.Data == "rp") && ignoredDepth > 0 {
				ignoredDepth--
			}
			if token.Data == "p" || token.Data == "br" {
				text.WriteByte(' ')
			}
		case html.TextToken:
			if ignoredDepth == 0 {
				text.Write(tokenizer.Text())
			}
		}
	}
}

func parseNHKDate(value string) (time.Time, error) {
	value = strings.TrimSpace(value)
	for _, layout := range []string{
		time.RFC1123Z,
		time.RFC1123,
		time.RFC3339,
		"2006-01-02 15:04:05 -0700",
		"2006-01-02 15:04:05 MST",
	} {
		if parsed, err := time.Parse(layout, value); err == nil {
			return parsed, nil
		}
	}
	return time.Time{}, fmt.Errorf("unsupported date %q", value)
}
