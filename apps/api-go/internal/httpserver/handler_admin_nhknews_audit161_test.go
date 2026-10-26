package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestAdminNHKNewsAUDIT161Routes(t *testing.T) {
	db := testPool(t)
	ctx := context.Background()
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, fmt.Sprintf("audit161-nhk-%s@example.com", actorID[:8]), "AUDIT-161 NHK Admin")
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	token := createAdminSession(t, sessions, actorID)
	var original nhkNewsConfig
	if err := db.QueryRow(ctx, `SELECT locale,default_type,easy_enabled,easy_feed_url,normal_enabled,normal_feed_url
		FROM content.nhk_news_config WHERE locale='vi'`).Scan(&original.Locale, &original.DefaultType, &original.EasyEnabled,
		&original.EasyFeedURL, &original.NormalEnabled, &original.NormalFeedURL); err != nil {
		t.Fatalf("load original config: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, `DELETE FROM ops.admin_audit_log WHERE actor_id=$1`, actorID)
		_, _ = db.Exec(ctx, `DELETE FROM content.nhk_article WHERE id LIKE 'easy:audit161-%' OR url='https://www3.nhk.or.jp/news/audit161'`)
		_, _ = db.Exec(ctx, `UPDATE content.nhk_news_config SET default_type=$1,easy_enabled=$2,easy_feed_url=$3,
			normal_enabled=$4,normal_feed_url=$5,updated_at=NOW() WHERE locale='vi'`, original.DefaultType,
			original.EasyEnabled, original.EasyFeedURL, original.NormalEnabled, original.NormalFeedURL)
	})
	call := func(method, path, body, session string, trustedOrigin bool) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		if session != "" {
			req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: session})
		}
		if trustedOrigin {
			req.Header.Set("Origin", "http://localhost:3000")
		}
		if method != http.MethodGet {
			req.Header.Set("Content-Type", "application/json")
		}
		res := httptest.NewRecorder()
		srv.Config.Handler.ServeHTTP(res, req)
		return res
	}
	const configPath = "/api/admin/nhk-news/config?locale=vi"
	const refreshPath = "/api/admin/nhk-news/refresh?locale=vi"

	t.Run("session and permission boundaries", func(t *testing.T) {
		for _, route := range []struct{ method, path string }{
			{http.MethodGet, configPath}, {http.MethodPatch, configPath}, {http.MethodPost, refreshPath},
		} {
			if got := call(route.method, route.path, `{}`, "", true).Code; got != http.StatusUnauthorized {
				t.Errorf("anonymous %s status=%d; want 401", route.method, got)
			}
		}
		if got := call(http.MethodGet, configPath, "", token, true).Code; got != http.StatusForbidden {
			t.Fatalf("read without permission status=%d; want 403", got)
		}
		if got := call(http.MethodPatch, configPath, `{}`, token, true).Code; got != http.StatusForbidden {
			t.Fatalf("write without permission status=%d; want 403", got)
		}
	})
	grantAdminPermission(t, db, actorID, "admin.content.read")
	grantAdminPermission(t, db, actorID, "admin.content.write")
	for _, route := range []struct{ method, path string }{
		{http.MethodPatch, configPath}, {http.MethodPost, refreshPath},
	} {
		if got := call(route.method, route.path, `{}`, token, false).Code; got != http.StatusForbidden {
			t.Errorf("missing Origin %s status=%d; want 403", route.method, got)
		}
	}

	t.Run("config validation, update response and persistence", func(t *testing.T) {
		if got := call(http.MethodGet, "/api/admin/nhk-news/config?locale=unknown", "", token, true).Code; got != http.StatusBadRequest {
			t.Fatalf("unsupported locale status=%d; want 400", got)
		}
		for _, body := range []string{"{", `{}`, `{"defaultType":"bad"}`, `{"easyFeedUrl":"file:///etc/passwd"}`, `{"easyFeedUrl":"https://example.com/feed"}`, `{"easyFeedUrl":"http://127.0.0.1:1234/feed"}`} {
			if got := call(http.MethodPatch, configPath, body, token, true).Code; got != http.StatusBadRequest {
				t.Errorf("invalid patch %q status=%d; want 400", body, got)
			}
		}
		body := `{"defaultType":"normal","easyEnabled":true,"normalEnabled":true}`
		res := call(http.MethodPatch, configPath, body, token, true)
		if res.Code != http.StatusOK {
			t.Fatalf("patch status=%d body=%s", res.Code, res.Body.String())
		}
		var got nhkNewsConfig
		if err := json.Unmarshal(res.Body.Bytes(), &got); err != nil {
			t.Fatalf("decode patch response: %v", err)
		}
		if got.Locale != "vi" || got.DefaultType != "normal" || !got.EasyEnabled || !got.NormalEnabled {
			t.Fatalf("patch response=%+v", got)
		}
		getRes := call(http.MethodGet, configPath, "", token, true)
		var readBack nhkNewsConfig
		if getRes.Code != http.StatusOK || json.Unmarshal(getRes.Body.Bytes(), &readBack) != nil || readBack != got {
			t.Fatalf("config read-back status=%d body=%s; want %+v", getRes.Code, getRes.Body.String(), got)
		}
		var persisted string
		if err := db.QueryRow(ctx, `SELECT default_type FROM content.nhk_news_config WHERE locale='vi'`).Scan(&persisted); err != nil || persisted != "normal" {
			t.Fatalf("persisted default_type=%q err=%v", persisted, err)
		}
		assertAdminAuditEvent(t, db, actorID, "nhk_news.config.updated", "nhk_news_config", "vi")
	})

	t.Run("feed refresh fetches and persists both feeds idempotently", func(t *testing.T) {
		var easyRequests, normalRequests int
		feeds := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			switch r.URL.Path {
			case "/easy.json":
				easyRequests++
				w.Header().Set("Content-Type", "application/json")
				_, _ = w.Write([]byte(`[{"news_id":"audit161-1","title":"やさしい記事","news_prearranged_time":"20261015130000","news_web_image_uri":"https://www3.nhk.or.jp/news/easy-image.jpg"}]`))
			case "/normal.xml":
				normalRequests++
				w.Header().Set("Content-Type", "application/xml")
				_, _ = w.Write([]byte(`<rss><channel><item><title>通常ニュース</title><link>https://www3.nhk.or.jp/news/audit161</link><guid>audit161-normal-1</guid><pubDate>Thu, 15 Oct 2026 13:00:00 +0900</pubDate><description>速報</description><enclosure type="image/jpeg" url="https://www3.nhk.or.jp/news/image.jpg" /></item></channel></rss>`))
			default:
				http.NotFound(w, r)
			}
		}))
		defer feeds.Close()
		if _, err := db.Exec(ctx, `UPDATE content.nhk_news_config SET easy_feed_url=$1,normal_feed_url=$2 WHERE locale='vi'`, feeds.URL+"/easy.json", feeds.URL+"/normal.xml"); err != nil {
			t.Fatalf("set disposable fixture feed URLs: %v", err)
		}
		for i := 0; i < 2; i++ {
			if i == 1 {
				if _, err := db.Exec(ctx, `UPDATE content.nhk_article SET body_plain='保存した本文' WHERE id='easy:audit161-1'`); err != nil {
					t.Fatal(err)
				}
			}
			res := call(http.MethodPost, refreshPath, "", token, true)
			if res.Code != http.StatusOK {
				t.Fatalf("refresh status=%d body=%s", res.Code, res.Body.String())
			}
			var counts map[string]map[string]int
			if err := json.Unmarshal(res.Body.Bytes(), &counts); err != nil || counts["easy"]["count"] != 1 || counts["normal"]["count"] != 1 {
				t.Fatalf("refresh response=%s err=%v", res.Body.String(), err)
			}
		}
		if easyRequests != 2 || normalRequests != 2 {
			t.Fatalf("feed requests easy=%d normal=%d; want 2 each", easyRequests, normalRequests)
		}
		var retainedBody, image string
		if err := db.QueryRow(ctx, `SELECT body_plain FROM content.nhk_article WHERE id='easy:audit161-1'`).Scan(&retainedBody); err != nil || retainedBody != "保存した本文" {
			t.Fatalf("refresh must retain existing body: %q err=%v", retainedBody, err)
		}
		if err := db.QueryRow(ctx, `SELECT image_url FROM content.nhk_article WHERE url='https://www3.nhk.or.jp/news/audit161'`).Scan(&image); err != nil || image != "https://www3.nhk.or.jp/news/image.jpg" {
			t.Fatalf("normal feed image must persist: %q err=%v", image, err)
		}
		if err := db.QueryRow(ctx, `SELECT image_url FROM content.nhk_article WHERE id='easy:audit161-1'`).Scan(&image); err != nil || image != "https://www3.nhk.or.jp/news/easy-image.jpg" {
			t.Fatalf("Easy feed image must persist: %q err=%v", image, err)
		}
		var articles int
		if err := db.QueryRow(ctx, `SELECT count(*) FROM content.nhk_article WHERE id IN ('easy:audit161-1') OR id LIKE 'normal:%' AND url='https://www3.nhk.or.jp/news/audit161'`).Scan(&articles); err != nil || articles != 2 {
			t.Fatalf("persisted articles=%d err=%v; want 2", articles, err)
		}
		var refreshAuditCount int
		if err := db.QueryRow(ctx, `SELECT count(*) FROM ops.admin_audit_log WHERE actor_id=$1 AND action='nhk_news.feed.refreshed' AND target_id='vi'`, actorID).Scan(&refreshAuditCount); err != nil || refreshAuditCount != 2 {
			t.Fatalf("refresh audit entries=%d err=%v; want 2", refreshAuditCount, err)
		}
	})

	t.Run("one failed feed does not prevent the other refreshing", func(t *testing.T) {
		feeds := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/easy" {
				http.Error(w, "unavailable", http.StatusServiceUnavailable)
				return
			}
			_, _ = w.Write([]byte(`<rss><channel><item><title>通常ニュース</title><link>https://www3.nhk.or.jp/news/audit161</link><pubDate>Thu, 15 Oct 2026 13:00:00 +0900</pubDate><description>更新した要約</description><guid>audit161-normal-1</guid></item></channel></rss>`))
		}))
		defer feeds.Close()
		if _, err := db.Exec(ctx, `UPDATE content.nhk_news_config SET easy_feed_url=$1,normal_feed_url=$2 WHERE locale='vi'`, feeds.URL+"/easy", feeds.URL+"/normal"); err != nil {
			t.Fatal(err)
		}
		res := call(http.MethodPost, refreshPath, "", token, true)
		if res.Code != http.StatusMultiStatus || !strings.Contains(res.Body.String(), `"errors"`) {
			t.Fatalf("partial refresh must report failed feed: status=%d body=%s", res.Code, res.Body.String())
		}
		var summary string
		if err := db.QueryRow(ctx, `SELECT body_plain FROM content.nhk_article WHERE url='https://www3.nhk.or.jp/news/audit161'`).Scan(&summary); err != nil || summary != "更新した要約" {
			t.Fatalf("healthy normal feed must refresh: %q err=%v", summary, err)
		}
	})

	t.Run("upstream failures are reported and do not fake success", func(t *testing.T) {
		unavailable := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			http.Error(w, "unavailable", http.StatusServiceUnavailable)
		}))
		defer unavailable.Close()
		if _, err := db.Exec(ctx, `UPDATE content.nhk_news_config SET easy_feed_url=$1,normal_enabled=false WHERE locale='vi'`, unavailable.URL); err != nil {
			t.Fatalf("set unavailable feed fixture URL: %v", err)
		}
		if got := call(http.MethodPost, refreshPath, "", token, true).Code; got != http.StatusBadGateway {
			t.Fatalf("refresh failure status=%d; want 502", got)
		}
	})
}
