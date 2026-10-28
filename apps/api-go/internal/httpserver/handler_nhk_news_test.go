package httpserver

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
)

func TestNhkArticleListAndDetailReadPersistedArticles(t *testing.T) {
	db := testPool(t)
	id := "audit-nhk-" + time.Now().Format("20060102150405.000000000")
	_, err := db.Exec(context.Background(), `INSERT INTO content.nhk_article
		(id,source_type,title,title_with_ruby,url,difficulty,body_html,body_plain,vocabulary,published_at)
		VALUES ($1,'easy','監査記事','<ruby>監査<rt>かんさ</rt></ruby>記事','https://example.test/article','N4','<p>本文</p>','本文','[{"word":"監査","reading":"かんさ","meaning":"kiểm toán","pos":"noun"}]',NOW())`, id)
	if err != nil {
		t.Fatalf("insert NHK fixture: %v", err)
	}
	defer db.Exec(context.Background(), `DELETE FROM content.nhk_article WHERE id=$1`, id)

	list := httptest.NewRecorder()
	nhkNewsListHandler(db, testLogger()).ServeHTTP(list, httptest.NewRequest(http.MethodGet, "/api/nhk-news?type=easy&limit=12&offset=0", nil))
	if list.Code != http.StatusOK || !strings.Contains(list.Body.String(), id) {
		t.Fatalf("list status=%d body=%s", list.Code, list.Body.String())
	}

	detail := httptest.NewRecorder()
	detailReq := withNHKRouteID(httptest.NewRequest(http.MethodGet, "/api/nhk-news/"+id, nil), id)
	nhkArticleDetailHandler(db, testLogger()).ServeHTTP(detail, detailReq)
	if detail.Code != http.StatusOK || !strings.Contains(detail.Body.String(), `"bodyPlain":"本文"`) || !strings.Contains(detail.Body.String(), `"vocabulary":[`) {
		t.Fatalf("detail status=%d body=%s", detail.Code, detail.Body.String())
	}

	missing := httptest.NewRecorder()
	missingReq := withNHKRouteID(httptest.NewRequest(http.MethodGet, "/api/nhk-news/missing-audit-article", nil), "missing-audit-article")
	nhkArticleDetailHandler(db, testLogger()).ServeHTTP(missing, missingReq)
	if missing.Code != http.StatusNotFound {
		t.Fatalf("missing article status=%d body=%s", missing.Code, missing.Body.String())
	}
	emptyID := "audit-nhk-empty-" + time.Now().Format("20060102150405.000000000")
	if _, err := db.Exec(context.Background(), `INSERT INTO content.nhk_article (id,source_type,title,url,published_at) VALUES ($1,'easy','Headline only','https://example.test/headline',NOW())`, emptyID); err != nil {
		t.Fatalf("insert headline-only article: %v", err)
	}
	defer db.Exec(context.Background(), `DELETE FROM content.nhk_article WHERE id=$1`, emptyID)
	emptyDetail := httptest.NewRecorder()
	emptyReq := withNHKRouteID(httptest.NewRequest(http.MethodGet, "/api/nhk-news/"+emptyID, nil), emptyID)
	nhkArticleDetailHandler(db, testLogger()).ServeHTTP(emptyDetail, emptyReq)
	if emptyDetail.Code != http.StatusOK || !strings.Contains(emptyDetail.Body.String(), `"bodyHtml":null`) || !strings.Contains(emptyDetail.Body.String(), `"bodyPlain":null`) {
		t.Fatalf("headline-only detail status=%d body=%s", emptyDetail.Code, emptyDetail.Body.String())
	}

	userID, progressReq := cardgenAuthenticatedRequest(t, db, http.MethodPost, "/api/nhk-news/"+id+"/reading", `{"readTimeSec":35,"completed":true}`)
	progressReq = withNHKRouteID(progressReq, id)
	progress := httptest.NewRecorder()
	nhkReadingProgressHandler(db, testLogger()).ServeHTTP(progress, progressReq)
	if progress.Code != http.StatusOK || !strings.Contains(progress.Body.String(), `"saved":true`) {
		t.Fatalf("save reading progress status=%d body=%s", progress.Code, progress.Body.String())
	}
	var completed bool
	if err := db.QueryRow(context.Background(), `SELECT completed FROM learning.nhk_reading_progress WHERE user_id=$1 AND article_id=$2`, userID, id).Scan(&completed); err != nil || !completed {
		t.Fatalf("reading progress was not persisted: completed=%v err=%v", completed, err)
	}
	defer db.Exec(context.Background(), `DELETE FROM learning.nhk_reading_progress WHERE user_id=$1 AND article_id=$2`, userID, id)
	_, missingProgressReq := cardgenAuthenticatedRequest(t, db, http.MethodPost, "/api/nhk-news/missing-audit-article/reading", `{"readTimeSec":10,"completed":false}`)
	missingProgressReq = withNHKRouteID(missingProgressReq, "missing-audit-article")
	missingProgress := httptest.NewRecorder()
	nhkReadingProgressHandler(db, testLogger()).ServeHTTP(missingProgress, missingProgressReq)
	if missingProgress.Code != http.StatusNotFound {
		t.Fatalf("missing article progress status=%d body=%s", missingProgress.Code, missingProgress.Body.String())
	}

	_, bookmarkReq := cardgenAuthenticatedRequest(t, db, http.MethodPost, "/api/nhk-news/"+id+"/bookmark", "")
	bookmarkReq = withNHKRouteID(bookmarkReq, id)
	bookmark := httptest.NewRecorder()
	nhkBookmarkHandler(db, testLogger()).ServeHTTP(bookmark, bookmarkReq)
	if bookmark.Code != http.StatusOK || !strings.Contains(bookmark.Body.String(), `"bookmarked":true`) {
		t.Fatalf("toggle bookmark status=%d body=%s", bookmark.Code, bookmark.Body.String())
	}
	defer db.Exec(context.Background(), `DELETE FROM learning.nhk_bookmark WHERE article_id=$1`, id)

	flashcardUser, cardReq := cardgenAuthenticatedRequest(t, db, http.MethodPost, "/api/nhk-news/"+id+"/flashcard", `{"word":"監査","reading":"ignored","meaning":"ignored"}`)
	cardReq = withNHKRouteID(cardReq, id)
	cardResult := httptest.NewRecorder()
	nhkFlashcardHandler(db, testLogger(), false).ServeHTTP(cardResult, cardReq)
	if cardResult.Code != http.StatusCreated || !strings.Contains(cardResult.Body.String(), `"saved":1`) {
		t.Fatalf("save article word status=%d body=%s", cardResult.Code, cardResult.Body.String())
	}
	var savedDeck struct {
		DeckID string `json:"deckId"`
	}
	if err := json.Unmarshal([]byte(cardResult.Body.String()), &savedDeck); err != nil {
		t.Fatalf("decode saved deck id: %v", err)
	}
	deckID := savedDeck.DeckID
	defer db.Exec(context.Background(), `DELETE FROM learning.user_flashcard WHERE user_id=$1 AND card_id IN (SELECT id FROM learning.flashcard_variant WHERE source_type='custom' AND source_id=$2)`, flashcardUser, deckID)
	defer db.Exec(context.Background(), `DELETE FROM learning.flashcard_variant WHERE source_type='custom' AND source_id=$1`, deckID)
	defer db.Exec(context.Background(), `DELETE FROM learning.deck WHERE id=$1`, deckID)
	allCardsUser, allCardsReq := cardgenAuthenticatedRequest(t, db, http.MethodPost, "/api/nhk-news/"+id+"/flashcards", `{"deckTitle":"NHK fixture deck"}`)
	allCardsReq = withNHKRouteID(allCardsReq, id)
	allCards := httptest.NewRecorder()
	nhkFlashcardHandler(db, testLogger(), true).ServeHTTP(allCards, allCardsReq)
	if allCards.Code != http.StatusCreated || !strings.Contains(allCards.Body.String(), `"saved":1`) {
		t.Fatalf("save article deck status=%d body=%s", allCards.Code, allCards.Body.String())
	}
	var allSavedDeck struct {
		DeckID string `json:"deckId"`
	}
	if err := json.Unmarshal([]byte(allCards.Body.String()), &allSavedDeck); err != nil {
		t.Fatalf("decode article deck id: %v", err)
	}
	defer db.Exec(context.Background(), `DELETE FROM learning.user_flashcard WHERE user_id=$1 AND card_id IN (SELECT id FROM learning.flashcard_variant WHERE source_type='custom' AND source_id=$2)`, allCardsUser, allSavedDeck.DeckID)
	defer db.Exec(context.Background(), `DELETE FROM learning.flashcard_variant WHERE source_type='custom' AND source_id=$1`, allSavedDeck.DeckID)
	defer db.Exec(context.Background(), `DELETE FROM learning.deck WHERE id=$1`, allSavedDeck.DeckID)
	var cardCount int
	if err := db.QueryRow(context.Background(), `SELECT count(*)::int FROM learning.deck_card WHERE deck_id=$1`, deckID).Scan(&cardCount); err != nil || cardCount != 1 {
		t.Fatalf("article deck card count=%d err=%v", cardCount, err)
	}
	var deckTitle string
	if err := db.QueryRow(context.Background(), `SELECT title_vi FROM learning.deck WHERE id=$1`, allSavedDeck.DeckID).Scan(&deckTitle); err != nil || deckTitle != "NHK fixture deck" {
		t.Fatalf("article deck title=%q err=%v", deckTitle, err)
	}
}

func withNHKRouteID(r *http.Request, id string) *http.Request {
	routeContext := chi.NewRouteContext()
	routeContext.URLParams.Add("id", id)
	return r.WithContext(context.WithValue(r.Context(), chi.RouteCtxKey, routeContext))
}

func TestParseNHKEasyRSSExtractsBodyRubyAndImage(t *testing.T) {
	rss := []byte(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<item>
<title>総理大臣が会議を開いた</title>
<link>https://nhkeasier.com/story/10065/</link>
<guid>https://nhkeasier.com/story/10065/</guid>
<pubDate>Fri, 9 Oct 2026 20:10:00 +0900</pubDate>
<description><![CDATA[<img src="/media/jpg/2026-10-27_test.jpg"/><p><ruby>総理大臣<rt>そうりだいじん</rt></ruby>が<ruby>会議<rt>かいぎ</rt></ruby>を<ruby>開<rt>ひら</rt></ruby>いた。</p>]]></description>
</item>
</channel></rss>`)
	articles, err := parseNHKEasyRSS(rss)
	if err != nil {
		t.Fatalf("parseNHKEasyRSS error: %v", err)
	}
	if len(articles) != 1 {
		t.Fatalf("expected 1 article, got %d", len(articles))
	}
	got := articles[0]
	if got.ID != "easy:nhkeasier-10065" {
		t.Fatalf("unexpected ID %q", got.ID)
	}
	if got.ImageURL != "https://nhkeasier.com/media/jpg/2026-10-27_test.jpg" {
		t.Fatalf("unexpected ImageURL %q", got.ImageURL)
	}
	if !strings.Contains(got.BodyHTML, "<ruby>総理大臣<rt>そうりだいじん</rt></ruby>") {
		t.Fatalf("expected ruby in BodyHTML, got %q", got.BodyHTML)
	}
	if got.BodyPlain != "総理大臣が会議を開いた。" {
		t.Fatalf("expected clean BodyPlain without rt readings, got %q", got.BodyPlain)
	}
	if !strings.Contains(got.TitleWithRuby, "<ruby>総理大臣<rt>そうりだいじん</rt></ruby>") {
		t.Fatalf("expected TitleWithRuby to annotate title kanji, got %q", got.TitleWithRuby)
	}
	enrichNHKArticlesWithLexemes(context.Background(), nil, articles)
	if len(articles[0].VocabularyJSON) == 0 || !strings.Contains(string(articles[0].VocabularyJSON), `"word":"総理大臣"`) {
		t.Fatalf("expected extracted vocabulary JSON, got %s", string(articles[0].VocabularyJSON))
	}
}
