package httpserver

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestNHKBug260FeedFormats(t *testing.T) {
	feed := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/easy" {
			_, _ = w.Write([]byte(`[{"2026-10-26":[{"news_id":"k1001","title":"ニュース","news_prearranged_time":"2026-10-26 12:00:00","news_web_image_uri":"https://www3.nhk.or.jp/news/image.jpg"}]}]`))
			return
		}
		_, _ = w.Write([]byte(`<rss><channel><item><title>ニュース</title><link>https://news.web.nhk/news/articles/test</link><pubDate>Mon, 26 Oct 2026 12:00:00 +0900</pubDate><description><![CDATA[<p>本文 &amp; 要約</p><script>unsafe()</script>]]></description><enclosure type="image/jpeg" url="https://www3.nhk.or.jp/image.jpg" /></item></channel></rss>`))
	}))
	defer feed.Close()
	t.Run("dated Easy feed", func(t *testing.T) {
		articles, err := fetchNHKEasy(context.Background(), feed.Client(), feed.URL+"/easy")
		if err != nil || len(articles) != 1 {
			t.Fatalf("dated Easy feed must parse: articles=%v err=%v", articles, err)
		}
		if articles[0].PublishedAt.Hour() != 12 || articles[0].Title != "ニュース" {
			t.Fatalf("dated Easy article metadata=%+v", articles[0])
		}
	})
	t.Run("normal summary and migrated source", func(t *testing.T) {
		articles, err := fetchNHKNormal(context.Background(), feed.Client(), feed.URL+"/normal")
		if err != nil || len(articles) != 1 || articles[0].BodyPlain != "本文 & 要約" {
			t.Fatalf("normal feed must preserve readable summary: articles=%+v err=%v", articles, err)
		}
	})
}

func TestNHKBug260AvailabilityContract(t *testing.T) {
	db := testPool(t)
	ctx := context.Background()
	id := "bug260-" + newUUID(t)
	if _, err := db.Exec(ctx, `INSERT INTO content.nhk_article (id,source_type,title,url,body_plain,published_at) VALUES ($1,'normal','要約','https://www3.nhk.or.jp/news/test','本文',NOW())`, id); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = db.Exec(ctx, `DELETE FROM content.nhk_article WHERE id=$1`, id) })
	for _, endpoint := range []string{"list", "detail"} {
		t.Run(endpoint, func(t *testing.T) {
			res := httptest.NewRecorder()
			if endpoint == "list" {
				nhkNewsListHandler(db, testLogger()).ServeHTTP(res, httptest.NewRequest(http.MethodGet, "/api/nhk-news?type=normal", nil))
			} else {
				nhkArticleDetailHandler(db, testLogger()).ServeHTTP(res, withNHKRouteID(httptest.NewRequest(http.MethodGet, "/api/nhk-news/"+id, nil), id))
			}
			if res.Code != http.StatusOK || !strings.Contains(res.Body.String(), `"hasBody":true`) || !strings.Contains(res.Body.String(), `"canGenerateCards":false`) {
				t.Fatalf("availability contract missing: status=%d body=%s", res.Code, res.Body.String())
			}
		})
	}
	_, req := cardgenAuthenticatedRequest(t, db, http.MethodPost, "/api/nhk-news/"+id+"/flashcards", `{}`)
	res := httptest.NewRecorder()
	nhkFlashcardHandler(db, testLogger(), true).ServeHTTP(res, withNHKRouteID(req, id))
	var body map[string]any
	_ = json.Unmarshal(res.Body.Bytes(), &body)
	if res.Code != http.StatusUnprocessableEntity || body["error"] != "article vocabulary is unavailable" {
		t.Fatalf("missing vocabulary must be an actionable unavailable response: %d %s", res.Code, res.Body.String())
	}
}
