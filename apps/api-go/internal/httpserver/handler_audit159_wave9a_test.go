package httpserver

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/gamification"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/privacy"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

const audit159w9Origin = "https://audit159w9.example.test"

func audit159w9Router(t *testing.T, db *pgxpool.Pool) (http.Handler, string, *http.Cookie) {
	t.Helper()
	userID := newUUID(t)
	seedActiveUser(t, db, userID, "AUDIT-159 Wave 9 learner", "audit159w9-"+userID+"@example.test", "")
	sessions := session.NewStore(db)
	token := createLearnerSession(t, sessions, userID)
	router := NewRouter(Dependencies{
		Config: &config.Config{Port: "4001", CORSOrigins: []string{audit159w9Origin}},
		Logger: testLogger(), DBPool: db, SessionStore: sessions,
		PrivacyStore: privacy.NewStore(db), GamificationStore: gamification.NewStore(db),
	})
	return router, userID, &http.Cookie{Name: learnerCookieName, Value: token}
}

func audit159w9Request(t *testing.T, router http.Handler, method, path, body string, cookie *http.Cookie) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	if cookie != nil {
		req.AddCookie(cookie)
	}
	if method != http.MethodGet && cookie != nil {
		req.Header.Set("Origin", audit159w9Origin)
	}
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)
	return res
}

func TestAudit159Wave9AStreakGET(t *testing.T) {
	db := testPool(t)
	router, userID, cookie := audit159w9Router(t, db)
	configID := newUUID(t)
	if _, err := db.Exec(context.Background(), `INSERT INTO gamification.streak_config (id,name,activity_type,enabled,created_at,updated_at) VALUES ($1,'AUDIT-159 Wave 9 streak','any',true,now(),now())`, configID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if _, err := db.Exec(context.Background(), `DELETE FROM gamification.streak_config WHERE id=$1`, configID); err != nil {
			t.Errorf("cleanup streak fixture: %v", err)
		}
		if _, err := db.Exec(context.Background(), `DELETE FROM gamification.user_streak WHERE user_id=$1`, userID); err != nil {
			t.Errorf("cleanup streak state: %v", err)
		}
	})
	if got := audit159w9Request(t, router, http.MethodGet, "/api/gamification/streaks", "", nil); got.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous status=%d", got.Code)
	}
	if _, err := db.Exec(context.Background(), `INSERT INTO gamification.user_streak (user_id,streak_config_id,current_streak,longest_streak,last_activity_date,updated_at) VALUES ($1,$2,3,5,CURRENT_DATE,now())`, userID, configID); err != nil {
		t.Fatal(err)
	}
	res := audit159w9Request(t, router, http.MethodGet, "/api/gamification/streaks", "", cookie)
	if res.Code != http.StatusOK || !strings.Contains(res.Body.String(), `"currentStreak":3`) {
		t.Fatalf("GET streaks status=%d body=%s", res.Code, res.Body.String())
	}
}

func TestAudit159Wave9AStreakRecordPOST(t *testing.T) {
	db := testPool(t)
	router, userID, cookie := audit159w9Router(t, db)
	configID := newUUID(t)
	if _, err := db.Exec(context.Background(), `INSERT INTO gamification.streak_config (id,name,activity_type,enabled,created_at,updated_at) VALUES ($1,'AUDIT-159 Wave 9 review streak','review',true,now(),now())`, configID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if _, err := db.Exec(context.Background(), `DELETE FROM gamification.streak_config WHERE id=$1`, configID); err != nil {
			t.Errorf("cleanup streak fixture: %v", err)
		}
		if _, err := db.Exec(context.Background(), `DELETE FROM gamification.user_streak WHERE user_id=$1`, userID); err != nil {
			t.Errorf("cleanup streak state: %v", err)
		}
	})
	if got := audit159w9Request(t, router, http.MethodPost, "/api/gamification/streaks/record?activityType=review", "", nil); got.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous status=%d", got.Code)
	}
	if got := audit159w9Request(t, router, http.MethodPost, "/api/gamification/streaks/record", "", cookie); got.Code != http.StatusBadRequest {
		t.Fatalf("missing activityType status=%d", got.Code)
	}
	if got := audit159w9Request(t, router, http.MethodPost, "/api/gamification/streaks/record?activityType=made-up", "", cookie); got.Code != http.StatusBadRequest {
		t.Fatalf("invalid activityType status=%d", got.Code)
	}
	res := audit159w9Request(t, router, http.MethodPost, "/api/gamification/streaks/record?activityType=review", "", cookie)
	if res.Code != http.StatusOK {
		t.Fatalf("POST streak record status=%d body=%s", res.Code, res.Body.String())
	}
	var count int
	// The store stamps the activity with the API process's local calendar date, which
	// differs from the database's CURRENT_DATE (UTC) for part of every day in other zones.
	today := time.Now().Format("2006-01-02")
	if err := db.QueryRow(context.Background(), `SELECT count(*) FROM gamification.user_streak WHERE user_id=$1 AND streak_config_id=$2 AND last_activity_date=$3::date`, userID, configID, today).Scan(&count); err != nil || count != 1 {
		t.Fatalf("persisted streak count=%d err=%v", count, err)
	}
}

func TestAudit159Wave9AKanjiSearchGET(t *testing.T) {
	db := testPool(t)
	router, _, _ := audit159w9Router(t, db)
	id, char := newUUID(t), "覺"+newUUID(t)[:4]
	if _, err := db.Exec(context.Background(), `INSERT INTO content.kanji (id,character,meaning_vi,status,created_at,updated_at) VALUES ($1,$2,'fixture search meaning','active',now(),now())`, id, char); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if _, err := db.Exec(context.Background(), `DELETE FROM content.kanji WHERE id=$1`, id); err != nil {
			t.Errorf("cleanup kanji fixture: %v", err)
		}
	})
	res := audit159w9Request(t, router, http.MethodGet, "/api/kanji/search?q="+char, "", nil)
	if res.Code != http.StatusOK || !strings.Contains(res.Body.String(), id) {
		t.Fatalf("GET kanji search status=%d body=%s", res.Code, res.Body.String())
	}
	if invalid := audit159w9Request(t, router, http.MethodGet, "/api/kanji/search?limit=bad", "", nil); invalid.Code != http.StatusBadRequest {
		t.Fatalf("invalid limit status=%d", invalid.Code)
	}
}

func TestAudit159Wave9AKanjiWordsGET(t *testing.T) {
	db := testPool(t)
	router, _, _ := audit159w9Router(t, db)
	kanjiID, lexemeID, char := newUUID(t), newUUID(t), "飃"+newUUID(t)[:4]
	if _, err := db.Exec(context.Background(), `INSERT INTO content.kanji (id,character,status,created_at,updated_at) VALUES ($1,$2,'active',now(),now())`, kanjiID, char); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(context.Background(), `INSERT INTO content.lexeme (id,headword,reading,short_meaning_vi,status,created_at,updated_at) VALUES ($1,$2,'ひょう','fixture word','active',now(),now())`, lexemeID, "お"+char+"前"); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if _, err := db.Exec(context.Background(), `DELETE FROM content.lexeme WHERE id=$1`, lexemeID); err != nil {
			t.Errorf("cleanup lexeme fixture: %v", err)
		}
		if _, err := db.Exec(context.Background(), `DELETE FROM content.kanji WHERE id=$1`, kanjiID); err != nil {
			t.Errorf("cleanup kanji fixture: %v", err)
		}
	})
	res := audit159w9Request(t, router, http.MethodGet, "/api/kanji/words/"+kanjiID, "", nil)
	if res.Code != http.StatusOK || !strings.Contains(res.Body.String(), lexemeID) {
		t.Fatalf("GET kanji words status=%d body=%s", res.Code, res.Body.String())
	}
	if invalid := audit159w9Request(t, router, http.MethodGet, "/api/kanji/words/not-a-uuid", "", nil); invalid.Code != http.StatusBadRequest {
		t.Fatalf("invalid kanji id status=%d", invalid.Code)
	}
}

func TestAudit159Wave9AKanjiByWordGET(t *testing.T) {
	db := testPool(t)
	router, _, _ := audit159w9Router(t, db)
	kanjiID, lexemeID, char := newUUID(t), newUUID(t), "戔"+newUUID(t)[:4]
	if _, err := db.Exec(context.Background(), `INSERT INTO content.kanji (id,character,meaning_vi,status,created_at,updated_at) VALUES ($1,$2,'fixture meaning','active',now(),now())`, kanjiID, char); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(context.Background(), `INSERT INTO content.lexeme (id,headword,reading,short_meaning_vi,status,created_at,updated_at) VALUES ($1,$2,'せん','fixture word','active',now(),now())`, lexemeID, "語"+char); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if _, err := db.Exec(context.Background(), `DELETE FROM content.lexeme WHERE id=$1`, lexemeID); err != nil {
			t.Errorf("cleanup lexeme fixture: %v", err)
		}
		if _, err := db.Exec(context.Background(), `DELETE FROM content.kanji WHERE id=$1`, kanjiID); err != nil {
			t.Errorf("cleanup kanji fixture: %v", err)
		}
	})
	res := audit159w9Request(t, router, http.MethodGet, "/api/kanji/by-word/"+lexemeID, "", nil)
	if res.Code != http.StatusOK || !strings.Contains(res.Body.String(), kanjiID) {
		t.Fatalf("GET kanji by word status=%d body=%s", res.Code, res.Body.String())
	}
	if invalid := audit159w9Request(t, router, http.MethodGet, "/api/kanji/by-word/not-a-uuid", "", nil); invalid.Code != http.StatusBadRequest {
		t.Fatalf("invalid word id status=%d", invalid.Code)
	}
}

func TestAudit159Wave9AKanjiStrokeGET(t *testing.T) {
	db := testPool(t)
	router, _, _ := audit159w9Router(t, db)
	id, char := newUUID(t), "嬋"+newUUID(t)[:4]
	if _, err := db.Exec(context.Background(), `INSERT INTO content.kanji (id,character,stroke_svg_source,stroke_svg_path,status,created_at,updated_at) VALUES ($1,$2,'<svg/>','/fixtures/stroke.svg','active',now(),now())`, id, char); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if _, err := db.Exec(context.Background(), `DELETE FROM content.kanji WHERE id=$1`, id); err != nil {
			t.Errorf("cleanup kanji fixture: %v", err)
		}
	})
	res := audit159w9Request(t, router, http.MethodGet, "/api/kanji/"+id+"/stroke", "", nil)
	var stroke struct {
		SVGSource *string `json:"svgSource"`
		SVGPath   *string `json:"svgPath"`
	}
	if err := json.Unmarshal(res.Body.Bytes(), &stroke); err != nil {
		t.Fatal(err)
	}
	if res.Code != http.StatusOK || stroke.SVGSource == nil || *stroke.SVGSource != "<svg/>" || stroke.SVGPath == nil || *stroke.SVGPath != "/fixtures/stroke.svg" {
		t.Fatalf("GET kanji stroke status=%d body=%s", res.Code, res.Body.String())
	}
	if invalid := audit159w9Request(t, router, http.MethodGet, "/api/kanji/not-a-uuid/stroke", "", nil); invalid.Code != http.StatusBadRequest {
		t.Fatalf("invalid kanji id status=%d", invalid.Code)
	}
}

func TestAudit159Wave9APrivacyRequestsGET(t *testing.T) {
	db := testPool(t)
	router, userID, cookie := audit159w9Router(t, db)
	requestID := newUUID(t)
	if _, err := db.Exec(context.Background(), `INSERT INTO profile.privacy_request (id,user_id,kind,status) VALUES ($1,$2,'export','pending')`, requestID, userID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if _, err := db.Exec(context.Background(), `DELETE FROM profile.privacy_request WHERE id=$1`, requestID); err != nil {
			t.Errorf("cleanup privacy request fixture: %v", err)
		}
	})
	if got := audit159w9Request(t, router, http.MethodGet, "/api/learner/privacy/requests", "", nil); got.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous status=%d", got.Code)
	}
	res := audit159w9Request(t, router, http.MethodGet, "/api/learner/privacy/requests?userId="+newUUID(t), "", cookie)
	if res.Code != http.StatusOK || !strings.Contains(res.Body.String(), requestID) || !strings.Contains(res.Body.String(), userID) {
		t.Fatalf("GET privacy requests status=%d body=%s", res.Code, res.Body.String())
	}
}

func TestAudit159Wave9APrivacyRequestsPOST(t *testing.T) {
	db := testPool(t)
	router, userID, cookie := audit159w9Router(t, db)
	if got := audit159w9Request(t, router, http.MethodPost, "/api/learner/privacy/requests", `{"kind":"data_export"}`, nil); got.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous status=%d", got.Code)
	}
	spoofedUserID := newUUID(t)
	for _, tc := range []struct {
		body, want string
		status     int
	}{{`{"kind":"data_export","userId":"` + spoofedUserID + `"}`, "export", http.StatusCreated}, {`{"kind":"account_deletion"}`, "delete", http.StatusCreated}, {`{"kind":"invalid"}`, "", http.StatusBadRequest}} {
		res := audit159w9Request(t, router, http.MethodPost, "/api/learner/privacy/requests", tc.body, cookie)
		if res.Code != tc.status {
			t.Fatalf("POST privacy request %s status=%d body=%s", tc.body, res.Code, res.Body.String())
		}
		if tc.want != "" && (!strings.Contains(res.Body.String(), `"kind":"`+tc.want+`"`) || strings.Contains(res.Body.String(), spoofedUserID)) {
			t.Fatalf("privacy kind/session identity contract body=%s", res.Body.String())
		}
	}
	var count int
	if err := db.QueryRow(context.Background(), `SELECT count(*) FROM profile.privacy_request WHERE user_id=$1`, userID).Scan(&count); err != nil || count != 2 {
		t.Fatalf("persisted privacy requests=%d err=%v", count, err)
	}
	t.Cleanup(func() {
		if _, err := db.Exec(context.Background(), `DELETE FROM profile.privacy_request WHERE user_id=$1`, userID); err != nil {
			t.Errorf("cleanup privacy request fixtures: %v", err)
		}
	})
}

func TestAudit159Wave9AShareTemplatesGET(t *testing.T) {
	db := testPool(t)
	router, _, cookie := audit159w9Router(t, db)
	id, slug := newUUID(t), "audit159w9-"+strings.ReplaceAll(newUUID(t), "-", "")
	if _, err := db.Exec(context.Background(), `INSERT INTO growth.share_template (id,slug,kind,config,active,created_at,updated_at) VALUES ($1,$2,'postcard_achievement','{}',true,now(),now())`, id, slug); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if _, err := db.Exec(context.Background(), `DELETE FROM growth.share_template WHERE id=$1`, id); err != nil {
			t.Errorf("cleanup share template: %v", err)
		}
	})
	res := audit159w9Request(t, router, http.MethodGet, "/api/learner/share/templates?kind=achievement", "", cookie)
	if res.Code != http.StatusOK || !strings.Contains(res.Body.String(), slug) {
		t.Fatalf("GET share templates status=%d body=%s", res.Code, res.Body.String())
	}
}

func TestAudit159Wave9ASharePreviewGET(t *testing.T) {
	db := testPool(t)
	router, _, cookie := audit159w9Router(t, db)
	id, slug := newUUID(t), "audit159w9-preview-"+strings.ReplaceAll(newUUID(t), "-", "")
	if _, err := db.Exec(context.Background(), `INSERT INTO growth.share_template (id,slug,kind,config,active,created_at,updated_at) VALUES ($1,$2,'postcard_achievement',$3,true,now(),now())`, id, slug, `{"brandBg":"#123456"}`); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if _, err := db.Exec(context.Background(), `DELETE FROM growth.share_template WHERE id=$1`, id); err != nil {
			t.Errorf("cleanup share template: %v", err)
		}
	})
	path := "/api/learner/share/preview?templateId=" + id + "&kind=achievement&headline=Achievement&sub=Great+work"
	res := audit159w9Request(t, router, http.MethodGet, path, "", cookie)
	if res.Code != http.StatusOK || !strings.Contains(res.Header().Get("Content-Type"), "image/svg+xml") || !strings.Contains(res.Body.String(), "<svg") || !strings.Contains(res.Body.String(), "Great work") {
		t.Fatalf("GET share preview status=%d type=%q body=%s", res.Code, res.Header().Get("Content-Type"), res.Body.String())
	}
	if invalid := audit159w9Request(t, router, http.MethodGet, "/api/learner/share/preview?templateId=bad&kind=achievement&headline=x&sub=y", "", cookie); invalid.Code != http.StatusBadRequest {
		t.Fatalf("invalid preview status=%d body=%s", invalid.Code, invalid.Body.String())
	}
}

func TestAudit159Wave9ASharePOST(t *testing.T) {
	db := testPool(t)
	router, userID, cookie := audit159w9Router(t, db)
	if _, err := db.Exec(context.Background(), `UPDATE profile.user_profile SET share_postcard_opt_in=true WHERE id=$1`, userID); err != nil {
		t.Fatal(err)
	}
	if got := audit159w9Request(t, router, http.MethodPost, "/api/learner/share", `{"kind":"achievement","payload":{"headline":"Level up"}}`, nil); got.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous status=%d", got.Code)
	}
	res := audit159w9Request(t, router, http.MethodPost, "/api/learner/share", `{"kind":"achievement","payload":{"headline":"Level up"}}`, cookie)
	if res.Code != http.StatusCreated || !strings.Contains(res.Body.String(), `"shareUrl":"/vi/share/`) {
		t.Fatalf("POST share status=%d body=%s", res.Code, res.Body.String())
	}
	var got struct {
		ID       string `json:"id"`
		ShareURL string `json:"shareUrl"`
	}
	if err := json.Unmarshal(res.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	defer func() {
		if _, err := db.Exec(context.Background(), `DELETE FROM growth.share_item WHERE id=$1`, got.ID); err != nil {
			t.Errorf("cleanup share item: %v", err)
		}
	}()
	var persistedUser, kind, payload string
	if err := db.QueryRow(context.Background(), `SELECT user_id::text,kind,summary_payload::text FROM growth.share_item WHERE id=$1`, got.ID).Scan(&persistedUser, &kind, &payload); err != nil || persistedUser != userID || kind != "postcard_achievement" || !strings.Contains(payload, "Level up") {
		t.Fatalf("persisted share user=%q kind=%q payload=%q err=%v", persistedUser, kind, payload, err)
	}
	if invalid := audit159w9Request(t, router, http.MethodPost, "/api/learner/share", `{"kind":"unknown","payload":{}}`, cookie); invalid.Code != http.StatusBadRequest {
		t.Fatalf("invalid share status=%d", invalid.Code)
	}
}

func TestAudit159Wave9APetEvolutionSharePOST(t *testing.T) {
	db := testPool(t)
	router, userID, cookie := audit159w9Router(t, db)
	if _, err := db.Exec(context.Background(), `UPDATE profile.user_profile SET share_postcard_opt_in=true WHERE id=$1`, userID); err != nil {
		t.Fatal(err)
	}
	if got := audit159w9Request(t, router, http.MethodPost, "/api/learner/shares/pet-evolution", `{}`, nil); got.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous status=%d", got.Code)
	}
	res := audit159w9Request(t, router, http.MethodPost, "/api/learner/shares/pet-evolution", `{"stage":"adult"}`, cookie)
	if res.Code != http.StatusCreated || !strings.Contains(res.Body.String(), `"shareUrl":"/vi/share/`) {
		t.Fatalf("POST pet evolution share status=%d body=%s", res.Code, res.Body.String())
	}
	var got struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(res.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if _, err := db.Exec(context.Background(), `DELETE FROM growth.share_item WHERE id=$1`, got.ID); err != nil {
			t.Errorf("cleanup pet share item: %v", err)
		}
	})
	var kind string
	if err := db.QueryRow(context.Background(), `SELECT kind FROM growth.share_item WHERE id=$1`, got.ID).Scan(&kind); err != nil || kind != "pet-evolution" {
		t.Fatalf("persisted pet share kind=%q err=%v", kind, err)
	}
}

func TestAudit159Wave9AMagazineTodayGET(t *testing.T) {
	db := testPool(t)
	router, _, _ := audit159w9Router(t, db)
	id := newUUID(t)
	slug := "audit159w9-magazine-" + strings.ReplaceAll(id, "-", "")
	today := time.Now().Format("2006-01-02")
	if _, err := db.Exec(context.Background(), `INSERT INTO daily.magazine_article
		(id,slug,widget_kind,content_date,locale,title_jp,title_vi,content_json,status,published_at)
		VALUES ($1,$2,'magazine_bjt_phrase',$3::date,'vi','今日の学習','Luyện tập hôm nay','{}','published',NOW())`, id, slug, today); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if _, err := db.Exec(context.Background(), `DELETE FROM daily.magazine_article WHERE id=$1`, id); err != nil {
			t.Errorf("cleanup magazine fixture: %v", err)
		}
	})
	res := audit159w9Request(t, router, http.MethodGet, "/api/magazine/today", "", nil)
	var articles []struct {
		ID         string `json:"id"`
		Slug       string `json:"slug"`
		WidgetKind string `json:"widgetKind"`
		TitleJp    string `json:"titleJp"`
		TitleVi    string `json:"titleVi"`
	}
	if err := json.Unmarshal(res.Body.Bytes(), &articles); err != nil || res.Code != http.StatusOK {
		t.Fatalf("GET magazine today status=%d body=%s decodeErr=%v", res.Code, res.Body.String(), err)
	}
	for _, article := range articles {
		if article.ID == id && article.Slug == slug && article.WidgetKind == "magazine_bjt_phrase" && article.TitleJp == "今日の学習" && article.TitleVi == "Luyện tập hôm nay" {
			return
		}
	}
	t.Fatalf("GET magazine today omitted persisted fixture: %+v", articles)
}
