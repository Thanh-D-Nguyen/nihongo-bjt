package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/flashcarddeck"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

func TestGetMagazineBySlugIncludesVocabularyAndQuiz(t *testing.T) {
	db := testPool(t)
	id, slug := insertMagazineFixture(t, db)
	_, err := db.Exec(context.Background(), `INSERT INTO daily.magazine_vocab_item
		(article_id, word_jp, reading, meaning_vi, jlpt_level, sentence_jp, sentence_vi, display_order)
		VALUES ($1, '会議', 'かいぎ', 'cuộc họp', 'N4', '会議があります。', 'Có cuộc họp.', 0)`, id)
	if err != nil {
		t.Fatalf("insert magazine vocabulary fixture: %v", err)
	}
	_, err = db.Exec(context.Background(), `INSERT INTO daily.magazine_quiz
		(article_id, question_jp, question_vi, options, correct_answer, explanation_jp, explanation_vi, display_order)
		VALUES ($1, '会議の読み方は？', 'Cách đọc là gì?', '["かいぎ","かいき"]', 'かいぎ', '正しい読み方です。', 'Đây là cách đọc đúng.', 0)`, id)
	if err != nil {
		t.Fatalf("insert magazine quiz fixture: %v", err)
	}

	response := httptest.NewRecorder()
	getMagazineBySlugHandler(db, testLogger()).ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/magazine/"+slug, nil))
	if response.Code != http.StatusOK {
		t.Fatalf("detail status=%d body=%s", response.Code, response.Body.String())
	}
	var got struct {
		PublishedAt string `json:"publishedAt"`
		VocabItems  []struct {
			ID        string `json:"id"`
			WordJp    string `json:"wordJp"`
			Reading   string `json:"reading"`
			MeaningVi string `json:"meaningVi"`
			ExampleJp string `json:"exampleJp"`
			ExampleVi string `json:"exampleVi"`
		} `json:"vocabItems"`
		Quizzes []struct {
			QuestionJp string `json:"questionJp"`
			Options    []struct {
				Label     string `json:"label"`
				IsCorrect bool   `json:"isCorrect"`
			} `json:"options"`
		} `json:"quizzes"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode magazine detail: %v body=%s", err, response.Body.String())
	}
	if _, err := time.Parse(time.RFC3339, got.PublishedAt); err != nil {
		t.Fatalf("publishedAt %q is not RFC3339: %v", got.PublishedAt, err)
	}
	if len(got.VocabItems) != 1 || got.VocabItems[0].ID == "" || got.VocabItems[0].WordJp != "会議" || got.VocabItems[0].ExampleVi != "Có cuộc họp." {
		t.Fatalf("detail omitted vocabulary contract: %+v body=%s", got.VocabItems, response.Body.String())
	}
	if len(got.Quizzes) != 1 || got.Quizzes[0].QuestionJp != "会議の読み方は？" || len(got.Quizzes[0].Options) != 2 || !got.Quizzes[0].Options[0].IsCorrect || got.Quizzes[0].Options[1].IsCorrect {
		t.Fatalf("detail omitted quiz contract: %+v body=%s", got.Quizzes, response.Body.String())
	}
}

func TestMagazineVocabularyCanBeAddedToLearnerFlashcards(t *testing.T) {
	db := testPool(t)
	articleID, _ := insertMagazineFixture(t, db)
	userID, _ := cardgenAuthenticatedRequest(t, db, http.MethodPost, "/unused", "{}")
	var vocabID, deckID string
	if err := db.QueryRow(context.Background(), `INSERT INTO daily.magazine_vocab_item
		(article_id, word_jp, reading, meaning_vi, display_order)
		VALUES ($1, '会議', 'かいぎ', 'cuộc họp', 0) RETURNING id::text`, articleID).Scan(&vocabID); err != nil {
		t.Fatalf("insert magazine vocabulary fixture: %v", err)
	}
	if err := db.QueryRow(context.Background(), `INSERT INTO learning.deck (owner_user_id, title_vi, visibility, status, created_at, updated_at)
		VALUES ($1, 'Audit deck', 'private', 'active', NOW(), NOW()) RETURNING id::text`, userID).Scan(&deckID); err != nil {
		t.Fatalf("insert learner deck fixture: %v", err)
	}
	card, err := flashcarddeck.NewStore(db).CreateCardFromContent(context.Background(), flashcarddeck.CreateCardFromContentInput{
		UserID: userID, DeckID: deckID, SourceType: "magazine_vocab", SourceID: vocabID,
		FrontText: "会議", BackText: "cuộc họp",
	})
	if err != nil {
		t.Fatalf("add magazine vocabulary to learner deck: %v", err)
	}
	if card.SourceType != "custom" || card.SourceID != deckID || card.FrontText != "会議" {
		t.Fatalf("unexpected learner card: %+v", card)
	}
	var linked, learnerCard int
	if err := db.QueryRow(context.Background(), `SELECT COUNT(*) FROM learning.deck_card WHERE deck_id=$1 AND card_id=$2`, deckID, card.VariantID).Scan(&linked); err != nil {
		t.Fatalf("verify deck link: %v", err)
	}
	if err := db.QueryRow(context.Background(), `SELECT COUNT(*) FROM learning.user_flashcard WHERE user_id=$1 AND card_id=$2`, userID, card.VariantID).Scan(&learnerCard); err != nil {
		t.Fatalf("verify learner card: %v", err)
	}
	if linked != 1 || learnerCard != 1 {
		t.Fatalf("persisted deck link/user card = %d/%d, want 1/1", linked, learnerCard)
	}
	if _, err := db.Exec(context.Background(), `UPDATE daily.magazine_article SET status='draft' WHERE id=$1`, articleID); err != nil {
		t.Fatalf("hide magazine source fixture: %v", err)
	}
	_, err = flashcarddeck.NewStore(db).CreateCardFromContent(context.Background(), flashcarddeck.CreateCardFromContentInput{
		UserID: userID, DeckID: deckID, SourceType: "magazine_vocab", SourceID: vocabID,
		FrontText: "会議", BackText: "cuộc họp",
	})
	if !errors.Is(err, flashcarddeck.ErrNotFound) {
		t.Fatalf("unpublished vocabulary source must be rejected, got %v", err)
	}
}

func TestMarkMagazineReadPersistsQuizScore(t *testing.T) {
	db := testPool(t)
	id, slug := insertMagazineFixture(t, db)
	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Magazine route learner", "magazine-route-"+userID+"@example.test", "")
	sessions := session.NewStore(db)
	token := createLearnerSession(t, sessions, userID)
	router := NewRouter(Dependencies{
		Config:       &config.Config{CORSOrigins: []string{"http://localhost:18081"}},
		Logger:       testLogger(),
		DBPool:       db,
		SessionStore: sessions,
	})
	request := func(authenticated bool, origin string, body string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodPost, "/api/magazine/"+slug+"/read", strings.NewReader(body))
		if origin != "" {
			req.Header.Set("Origin", origin)
		}
		if authenticated {
			req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: token})
		}
		response := httptest.NewRecorder()
		router.ServeHTTP(response, req)
		return response
	}
	if anonymous := request(false, "http://localhost:18081", `{"quizScore":1,"quizTotal":2}`); anonymous.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous magazine read status=%d body=%s, want 401", anonymous.Code, anonymous.Body.String())
	}
	if missingOrigin := request(true, "", `{"quizScore":1,"quizTotal":2}`); missingOrigin.Code != http.StatusForbidden {
		t.Fatalf("authenticated magazine read without origin status=%d body=%s, want 403", missingOrigin.Code, missingOrigin.Body.String())
	}
	response := request(true, "http://localhost:18081", `{"quizScore":1,"quizTotal":2}`)
	if response.Code != http.StatusOK {
		t.Fatalf("save quiz result status=%d body=%s", response.Code, response.Body.String())
	}
	var score, total int
	if err := db.QueryRow(context.Background(), `SELECT quiz_score, quiz_total FROM daily.magazine_user_read WHERE user_id=$1 AND article_id=$2`, userID, id).Scan(&score, &total); err != nil {
		t.Fatalf("quiz result was not persisted: %v", err)
	}
	if score != 1 || total != 2 {
		t.Fatalf("persisted quiz result=%d/%d, want 1/2", score, total)
	}

	updated := request(true, "http://localhost:18081", `{"quizScore":0,"quizTotal":2}`)
	if updated.Code != http.StatusOK {
		t.Fatalf("idempotent score update status=%d body=%s", updated.Code, updated.Body.String())
	}
	var count int
	if err := db.QueryRow(context.Background(), `SELECT COUNT(*) FROM daily.magazine_user_read WHERE user_id=$1 AND article_id=$2`, userID, id).Scan(&count); err != nil {
		t.Fatalf("count magazine reads: %v", err)
	}
	if count != 1 {
		t.Fatalf("read rows=%d, want one idempotent user/article row", count)
	}
	if err := db.QueryRow(context.Background(), `SELECT quiz_score, quiz_total FROM daily.magazine_user_read WHERE user_id=$1 AND article_id=$2`, userID, id).Scan(&score, &total); err != nil {
		t.Fatalf("read updated quiz result: %v", err)
	}
	if score != 0 || total != 2 {
		t.Fatalf("updated quiz result=%d/%d, want 0/2", score, total)
	}

	invalid := request(true, "http://localhost:18081", `{"quizScore":2,"quizTotal":1}`)
	if invalid.Code != http.StatusBadRequest {
		t.Fatalf("invalid quiz score status=%d body=%s, want 400", invalid.Code, invalid.Body.String())
	}
	if err := db.QueryRow(context.Background(), `SELECT quiz_score, quiz_total FROM daily.magazine_user_read WHERE user_id=$1 AND article_id=$2`, userID, id).Scan(&score, &total); err != nil {
		t.Fatalf("read result after invalid update: %v", err)
	}
	if score != 0 || total != 2 {
		t.Fatalf("invalid update changed persisted result=%d/%d", score, total)
	}
}

func TestListMagazineReturnsPublishedPagedVocabulary(t *testing.T) {
	db := testPool(t)
	var baseline int
	if err := db.QueryRow(context.Background(), `SELECT COUNT(*) FROM daily.magazine_article WHERE status='published' AND widget_kind='magazine_vocab'`).Scan(&baseline); err != nil {
		t.Fatalf("count existing published vocabulary articles: %v", err)
	}
	ids := []string{newUUID(t), newUUID(t), newUUID(t)}
	slugs := []string{"audit-mag-vocab-new-" + ids[0], "audit-mag-vocab-old-" + ids[1], "audit-mag-vocab-draft-" + ids[2]}
	for i, fixture := range []struct {
		dayOffset int
		slug      string
		title     string
		status    string
	}{
		{dayOffset: 2, slug: slugs[0], title: "Latest vocab article", status: "published"},
		{dayOffset: 1, slug: slugs[1], title: "Earlier vocab article", status: "published"},
		{dayOffset: -1, slug: slugs[2], title: "Draft vocab article", status: "draft"},
	} {
		if _, err := db.Exec(context.Background(), `INSERT INTO daily.magazine_article
			(id, slug, widget_kind, content_date, locale, title_jp, title_vi, summary_vi, content_json, status, published_at)
			VALUES ($1, $2, 'magazine_vocab', CURRENT_DATE + $3::integer, 'vi', '語彙', $4, 'Vocabulary summary', '{}', $5, NOW())`, ids[i], fixture.slug, fixture.dayOffset, fixture.title, fixture.status); err != nil {
			t.Fatalf("insert magazine list fixture %q: %v", fixture.slug, err)
		}
	}
	if _, err := db.Exec(context.Background(), `INSERT INTO daily.magazine_vocab_item (article_id, word_jp, reading, meaning_vi, display_order)
		VALUES ($1, '傘', 'かさ', 'cái ô', 0), ($1, '駅', 'えき', 'nhà ga', 1)`, ids[0]); err != nil {
		t.Fatalf("insert list vocabulary fixture: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM daily.magazine_article WHERE id=ANY($1::uuid[])`, ids)
	})
	router := NewRouter(Dependencies{Config: &config.Config{}, Logger: testLogger(), DBPool: db})
	request := func(target string) *httptest.ResponseRecorder {
		response := httptest.NewRecorder()
		router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, target, nil))
		return response
	}
	pageOne := request("/api/magazine?kind=vocab&page=1&limit=1")
	if pageOne.Code != http.StatusOK {
		t.Fatalf("list status=%d body=%s", pageOne.Code, pageOne.Body.String())
	}
	var got struct {
		Data []struct {
			Slug        string `json:"slug"`
			TitleVi     string `json:"titleVi"`
			SummaryVi   string `json:"summaryVi"`
			PublishDate string `json:"publishDate"`
			PublishedAt string `json:"publishedAt"`
			VocabWords  []struct {
				Word    string `json:"word"`
				Reading string `json:"reading"`
				Meaning string `json:"meaning"`
			} `json:"vocabWords"`
		} `json:"data"`
		Total int `json:"total"`
		Page  int `json:"page"`
		Limit int `json:"limit"`
	}
	if err := json.Unmarshal(pageOne.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode magazine list envelope: %v body=%s", err, pageOne.Body.String())
	}
	if got.Total != baseline+2 || got.Page != 1 || got.Limit != 1 || len(got.Data) != 1 {
		t.Fatalf("page metadata total/page/limit/data=%d/%d/%d/%d, want %d/1/1/1", got.Total, got.Page, got.Limit, len(got.Data), baseline+2)
	}
	article := got.Data[0]
	if article.Slug != slugs[0] || article.TitleVi != "Latest vocab article" || article.SummaryVi != "Vocabulary summary" || article.PublishDate == "" || article.PublishedAt == "" {
		t.Fatalf("list article omitted web/mobile fields: %+v", article)
	}
	if len(article.VocabWords) != 2 || article.VocabWords[0].Word != "傘" || article.VocabWords[1].Word != "駅" || article.VocabWords[0].Reading != "かさ" || article.VocabWords[0].Meaning != "cái ô" {
		t.Fatalf("list vocabulary preview=%+v, want ordered vocabulary contract", article.VocabWords)
	}
	pageTwo := request("/api/magazine?widgetKind=magazine_vocab&page=2&limit=1")
	var next struct {
		Data []struct {
			Slug string `json:"slug"`
		} `json:"data"`
		Total int `json:"total"`
		Page  int `json:"page"`
	}
	if pageTwo.Code != http.StatusOK || json.Unmarshal(pageTwo.Body.Bytes(), &next) != nil || next.Total != baseline+2 || next.Page != 2 || len(next.Data) != 1 || next.Data[0].Slug != slugs[1] {
		t.Fatalf("widgetKind page two status=%d body=%s", pageTwo.Code, pageTwo.Body.String())
	}
	outOfRange := request("/api/magazine?kind=vocab&page=999&limit=1")
	if outOfRange.Code != http.StatusOK || json.Unmarshal(outOfRange.Body.Bytes(), &next) != nil || next.Total != baseline+2 || next.Page != next.Total || len(next.Data) != 1 {
		t.Fatalf("out-of-range page should clamp to the last published page, status=%d body=%s", outOfRange.Code, outOfRange.Body.String())
	}
}

func TestListMagazineReportsDatabaseFailures(t *testing.T) {
	db := testPool(t)
	db.Close()
	response := httptest.NewRecorder()
	listMagazineHandler(db, testLogger()).ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/magazine", nil))
	if response.Code != http.StatusInternalServerError {
		t.Fatalf("closed database list status=%d body=%s, want 500", response.Code, response.Body.String())
	}
}

func insertMagazineFixture(t *testing.T, db *pgxpool.Pool) (string, string) {
	t.Helper()
	id := newUUID(t)
	slug := "audit-magazine-" + id
	_, err := db.Exec(context.Background(), `INSERT INTO daily.magazine_article
		(id, slug, widget_kind, content_date, locale, title_jp, title_vi, content_json, status, published_at)
		VALUES ($1, $2, 'magazine_bjt_phrase', CURRENT_DATE, 'vi', '記事の見出し', 'Tiêu đề fixture',
		'{"dialogue":[{"speaker":"Khách","textJp":"お願いします。","textVi":"Làm ơn."}]}', 'published', NOW())`, id, slug)
	if err != nil {
		t.Fatalf("insert magazine article fixture: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM daily.magazine_article WHERE id=$1`, id)
	})
	return id, slug
}
