package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/lifefeed"
)

func lifeEditorialFixture(now time.Time) lifefeed.Card {
	card := lifefeed.DateCard(now)
	card.ID = "transit:editorial-test"
	card.Topic = "transit"
	card.Scene = lifefeed.Scene{Kind: "transit"}
	card.Lesson.ID = card.ID
	card.Summary = lifefeed.Text{Vi: "Học cách hỏi giờ tàu chạy.", En: "Learn how to ask for train times."}
	card.Meta = lifefeed.Text{Vi: "Bài học biên tập", En: "Editorial lesson"}
	card.Lesson.Source.ProviderName = "KotobaWorks original editorial"
	card.Lesson.Source.LicenseStatus = "not_applicable"
	card.Lesson.Source.URL = ""
	card.Lesson.Source.AttributionText = ""
	card.Lesson.Title = lifefeed.Title{Japanese: "電車の時刻を確認します", Reading: "でんしゃのじこくをかくにんします", Vi: "Kiểm tra giờ tàu", En: "Check train times"}
	card.Lesson.Sentences = []lifefeed.Sentence{{ID: "s1", Basis: "advice", Japanese: "電車の時刻を確認します。", Reading: "でんしゃのじこくをかくにんします。", Translations: card.Summary, Explanation: lifefeed.Text{Vi: "確認 nghĩa là kiểm tra.", En: "確認 means to check."}}}
	card.Lesson.Vocabulary = []lifefeed.Vocabulary{{ID: "transit:jikoku", Japanese: "時刻", Reading: "じこく", Meanings: lifefeed.Text{Vi: "thời gian", En: "time"}, ExampleJapanese: "電車の時刻を確認します。"}}
	card.Lesson.Exercises = []lifefeed.Exercise{{ID: "r", Kind: "recall_text", SkillType: "recall", PromptJapanese: "電車の＿＿を確認します。", Prompt: lifefeed.Text{Vi: "Điền thời gian.", En: "Fill in the time word."}, AcceptedAnswers: []string{"時刻", "じこく"}, Explanation: lifefeed.Text{Vi: "Đáp án: 時刻", En: "Answer: 時刻"}}, {ID: "c", Kind: "choice", SkillType: "recognition", PromptJapanese: "時刻", Prompt: lifefeed.Text{Vi: "Cách đọc?", En: "Reading?"}, Choices: []lifefeed.Choice{{ID: "a", Text: "じこく"}, {ID: "b", Text: "じかん"}}, CorrectChoiceID: "a", Explanation: lifefeed.Text{Vi: "じこく", En: "じこく"}}}
	return card
}

func TestLifeFeedOnlyServesReviewedRightsClearedContent(t *testing.T) {
	db := testPool(t)
	now := time.Date(2026, 10, 24, 11, 0, 0, 0, lifefeed.JST)
	card := lifeEditorialFixture(now)
	key := fmt.Sprintf("transit:%s", newUUID(t))
	card.ID = key
	card.Lesson.ID = key
	raw, _ := json.Marshal(card)
	var id string
	err := db.QueryRow(context.Background(), `INSERT INTO daily.life_lesson(card_key,topic,valid_from,valid_until,source_expires_at,card) VALUES($1,'transit','2026-10-24','2026-10-24',$2,$3) RETURNING id::text`, key, card.Lesson.Source.ExpiresAt, raw).Scan(&id)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = db.Exec(context.Background(), `DELETE FROM daily.life_lesson WHERE id=$1`, id) })
	handler := lifeFeedHandler(db, slog.Default(), func() time.Time { return now })
	get := func(city string) *httptest.ResponseRecorder {
		t.Helper()
		res := httptest.NewRecorder()
		handler(res, httptest.NewRequest("GET", "/api/life/feed?city="+city, nil))
		return res
	}
	if got := get("berlin").Code; got != 400 {
		t.Fatalf("bad city status=%d", got)
	}
	if got := get("tokyo").Code; got != 404 {
		t.Fatalf("draft caused sample replacement status=%d", got)
	}
	_, err = db.Exec(context.Background(), `UPDATE daily.life_lesson SET status='reviewed',rights_status='cleared' WHERE id=$1`, id)
	if err != nil {
		t.Fatal(err)
	}
	if got := get("tokyo").Code; got != 404 {
		t.Fatalf("reviewed but unpublished card leaked status=%d", got)
	}
	actor := newUUID(t)
	seedAdminActor(t, db, actor, actor+"@life-test.example.com", "Life reviewer")
	_, err = db.Exec(context.Background(), `UPDATE daily.life_lesson SET status='published',reviewer_id=$2 WHERE id=$1`, id, actor)
	if err != nil {
		t.Fatal(err)
	}
	res := get("tokyo")
	if res.Code != 200 {
		t.Fatalf("published status=%d, body=%s", res.Code, res.Body.String())
	}
	var feed lifefeed.Feed
	if err = json.Unmarshal(res.Body.Bytes(), &feed); err != nil {
		t.Fatal(err)
	}
	if feed.CityID != "tokyo" || feed.SchemaVersion != 1 || len(feed.Cards) != 2 || feed.Cards[0].Topic != "date" || feed.Cards[1].ID != key {
		t.Fatalf("wrong feed: %+v", feed)
	}
	if res.Header().Get("Cache-Control") != "public, max-age=60" {
		t.Fatalf("cache header=%q", res.Header().Get("Cache-Control"))
	}
	if !feed.Cards[1].Lesson.Source.ExpiresAt.Equal(lifefeed.EndOfDay(now)) {
		t.Fatal("editorial expiry is not Japan midnight")
	}
	card.Lesson.Source.ExpiresAt = now.Add(-time.Minute)
	expiredJSON, _ := json.Marshal(card)
	if _, err = db.Exec(context.Background(), `UPDATE daily.life_lesson SET card=$2 WHERE id=$1`, id, expiredJSON); err != nil {
		t.Fatal(err)
	}
	if got := get("tokyo").Code; got != 404 {
		t.Fatalf("expired content leaked into feed: %d", got)
	}
}

func TestLifeFeedDoesNotLoseValidCardAfterThirtyExpiredRows(t *testing.T) {
	db := testPool(t)
	now := time.Date(2026, 10, 24, 11, 0, 0, 0, lifefeed.JST)
	prefix := "transit:overflow:" + newUUID(t)
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM daily.life_lesson WHERE card_key LIKE $1`, prefix+":%")
	})
	for i := 0; i < 33; i++ {
		card := lifeEditorialFixture(now)
		card.ID = fmt.Sprintf("%s:%02d", prefix, i)
		card.Lesson.ID = card.ID
		updatedAt := "2026-10-24T10:00:00+09:00"
		if i < 31 {
			card.Lesson.Source.ExpiresAt = now.Add(-time.Minute)
		} else if i == 31 {
			updatedAt = "2026-10-24T09:00:00+09:00"
		} else {
			card.Lesson.Title.Japanese = "" // Newer malformed publication must not hide a valid older candidate.
		}
		raw, err := json.Marshal(card)
		if err != nil {
			t.Fatal(err)
		}
		_, err = db.Exec(context.Background(), `INSERT INTO daily.life_lesson (card_key,topic,valid_from,valid_until,status,rights_status,reviewer_id,card,source_expires_at,updated_at)
			VALUES ($1,'transit','2026-10-24','2026-10-24','published','cleared',$2,$3,$4,$5)`, card.ID, newUUID(t), raw, card.Lesson.Source.ExpiresAt, updatedAt)
		if err != nil {
			t.Fatal(err)
		}
	}
	handler := lifeFeedHandler(db, slog.Default(), func() time.Time { return now })
	res := httptest.NewRecorder()
	handler(res, httptest.NewRequest("GET", "/api/life/feed?city=tokyo", nil))
	if res.Code != http.StatusOK {
		t.Fatalf("valid card lost behind expired rows: status=%d, body=%s", res.Code, res.Body.String())
	}
	var feed lifefeed.Feed
	if err := json.Unmarshal(res.Body.Bytes(), &feed); err != nil {
		t.Fatal(err)
	}
	if len(feed.Cards) != 2 || feed.Cards[1].ID != prefix+":31" {
		t.Fatalf("unexpected feed cards: %+v", feed.Cards)
	}
}

func TestLifeFeedWeatherLicenseDoesNotHideSeventeenthValidCard(t *testing.T) {
	db := testPool(t)
	now := time.Date(2026, 10, 24, 11, 0, 0, 0, lifefeed.JST)
	prefix := "weather:license:" + newUUID(t)
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM daily.life_lesson WHERE card_key LIKE $1`, prefix+":%")
	})
	weatherCode := 1
	for i := 0; i < 17; i++ {
		card := lifeEditorialFixture(now)
		card.ID = fmt.Sprintf("%s:%02d", prefix, i)
		card.Lesson.ID = card.ID
		card.Topic = "weather"
		card.Scene = lifefeed.Scene{Kind: "weather", WeatherCode: &weatherCode}
		if i == 16 {
			card.Lesson.Source.LicenseStatus = "commercial"
		}
		raw, err := json.Marshal(card)
		if err != nil {
			t.Fatal(err)
		}
		_, err = db.Exec(context.Background(), `INSERT INTO daily.life_lesson (card_key,topic,valid_from,valid_until,status,rights_status,reviewer_id,card,source_expires_at,updated_at)
			VALUES ($1,'weather','2026-10-24','2026-10-24','published','cleared',$2,$3,$4,$5)`, card.ID, newUUID(t), raw, card.Lesson.Source.ExpiresAt, now.Add(-time.Duration(i)*time.Minute))
		if err != nil {
			t.Fatal(err)
		}
	}
	res := httptest.NewRecorder()
	lifeFeedHandler(db, slog.Default(), func() time.Time { return now })(res, httptest.NewRequest("GET", "/api/life/feed?city=tokyo", nil))
	if res.Code != http.StatusOK {
		t.Fatalf("valid weather card lost after 16 candidates: %d %s", res.Code, res.Body.String())
	}
	var feed lifefeed.Feed
	if err := json.Unmarshal(res.Body.Bytes(), &feed); err != nil {
		t.Fatal(err)
	}
	if len(feed.Cards) != 2 || feed.Cards[1].ID != prefix+":16" {
		t.Fatalf("unexpected weather card selection: %+v", feed.Cards)
	}
}

func TestLifeAdminRequiresRBACAndAuditsPublishing(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	actor := newUUID(t)
	seedAdminActor(t, db, actor, actor+"@life-admin.example.com", "Life admin")
	token := createAdminSession(t, sessions, actor)
	card := lifeEditorialFixture(time.Now())
	card.ID = "transit:" + newUUID(t)
	card.Lesson.ID = card.ID
	payload, _ := json.Marshal(map[string]any{"validFrom": "2026-01-01", "validUntil": "2027-12-31", "card": card})
	makeRequest := func(method, path string, body string) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		req.Header.Set("Origin", "http://localhost:3000")
		req.Header.Set("X-CSRF-Token", "test-csrf")
		req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		res := httptest.NewRecorder()
		srv.Config.Handler.ServeHTTP(res, req)
		return res
	}
	path := "/api/admin/life/lessons"
	if got := makeRequest("POST", path, string(payload)).Code; got != 403 {
		t.Fatalf("RBAC allowed unauthorized editor: %d", got)
	}
	grantAdminPermission(t, db, actor, "admin.content.write")
	res := makeRequest("POST", path, string(payload))
	if res.Code != 201 {
		t.Fatalf("create=%d %s", res.Code, res.Body.String())
	}
	var created struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(res.Body.Bytes(), &created); err != nil {
		t.Fatal(err)
	}
	id := created.ID
	t.Cleanup(func() { _, _ = db.Exec(context.Background(), `DELETE FROM daily.life_lesson WHERE id=$1`, id) })
	var persistedExpiry time.Time
	if err := db.QueryRow(context.Background(), `SELECT source_expires_at FROM daily.life_lesson WHERE id=$1`, id).Scan(&persistedExpiry); err != nil || !persistedExpiry.Equal(card.Lesson.Source.ExpiresAt) {
		t.Fatalf("source expiry not persisted: got %s, want %s, err %v", persistedExpiry, card.Lesson.Source.ExpiresAt, err)
	}
	if got := makeRequest("POST", path+"/"+id+"/publish", `{}`).Code; got != 409 {
		t.Fatalf("unreviewed publish=%d", got)
	}
	if got := makeRequest("POST", path+"/"+id+"/review", `{"rightsStatus":"blocked","reason":"Provider rights not yet verified"}`).Code; got != 200 {
		t.Fatalf("blocked review=%d", got)
	}
	if got := makeRequest("POST", path+"/"+id+"/publish", `{}`).Code; got != 409 {
		t.Fatalf("blocked publish=%d", got)
	}
	if got := makeRequest("POST", path+"/"+id+"/review", `{"rightsStatus":"cleared","reason":"Original authored lesson, JP readings checked"}`).Code; got != 200 {
		t.Fatalf("cleared review=%d", got)
	}
	if got := makeRequest("POST", path+"/"+id+"/publish", `{}`).Code; got != 200 {
		t.Fatalf("published after review=%d", got)
	}
	var count int
	if err := db.QueryRow(context.Background(), `SELECT COUNT(*) FROM ops.admin_audit_log WHERE target_id=$1 AND action IN ('life_lesson.created','life_lesson.reviewed','life_lesson.published')`, id).Scan(&count); err != nil || count != 4 {
		t.Fatalf("audit count=%d error=%v", count, err)
	}
	if got := makeRequest("PUT", path+"/"+id, string(payload)).Code; got != 200 {
		t.Fatalf("reset draft failed=%d", got)
	}
	var status, rights string
	var reviewer *string
	if err := db.QueryRow(context.Background(), `SELECT status,rights_status,reviewer_id::text FROM daily.life_lesson WHERE id=$1`, id).Scan(&status, &rights, &reviewer); err != nil || status != "draft" || rights != "unknown" || reviewer != nil {
		t.Fatalf("edit didn't revoke review: %s %s %v %v", status, rights, reviewer, err)
	}
}
