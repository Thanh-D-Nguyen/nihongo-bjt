package httpserver

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/career"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

func TestAudit159Wave7LearnerAPIs(t *testing.T) {
	db := testPool(t)
	userID, otherID, kanjiID := newUUID(t), newUUID(t), newUUID(t)
	seedActiveUser(t, db, userID, "Wave 7 learner", fmt.Sprintf("w7-%s@example.test", userID[:8]), "")
	seedActiveUser(t, db, otherID, "Wave 7 other", fmt.Sprintf("w7o-%s@example.test", otherID[:8]), "")
	sessions := session.NewStore(db)
	token := createLearnerSession(t, sessions, userID)
	router := NewRouter(Dependencies{
		Config: &config.Config{CORSOrigins: []string{"http://localhost:3000"}}, Logger: testLogger(),
		DBPool: db, SessionStore: sessions, CareerStore: career.NewStore(db),
	})
	call := func(method, path, body, sessionToken string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		if sessionToken != "" {
			req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: sessionToken})
		}
		if method != http.MethodGet {
			req.Header.Set("Origin", "http://localhost:3000")
			req.Header.Set("X-CSRF-Token", "test-csrf")
		}
		res := httptest.NewRecorder()
		router.ServeHTTP(res, req)
		return res
	}
	t.Cleanup(func() {
		ctx := context.Background()
		_, _ = db.Exec(ctx, `DELETE FROM content.kanji WHERE id=$1`, kanjiID)
		_, _ = db.Exec(ctx, `DELETE FROM learner.bookmark WHERE user_id=ANY($1::uuid[])`, []string{userID, otherID})
		_, _ = db.Exec(ctx, `DELETE FROM learning.study_session WHERE user_id=ANY($1::uuid[])`, []string{userID, otherID})
		_, _ = db.Exec(ctx, `DELETE FROM exercise.exercise_session WHERE user_id=ANY($1::uuid[])`, []string{userID, otherID})
	})

	t.Run("GET check and POST toggle bookmark enforce learner ownership and persist", func(t *testing.T) {
		path := "/api/bookmarks/kanji/" + kanjiID
		if got := call(http.MethodGet, "/api/bookmarks/check/kanji/"+kanjiID, "", "").Code; got != http.StatusUnauthorized {
			t.Fatalf("anonymous check=%d; want 401", got)
		}
		if got := call(http.MethodPost, path, "", "").Code; got != http.StatusUnauthorized {
			t.Fatalf("anonymous toggle=%d; want 401", got)
		}
		created := call(http.MethodPost, path, "", token)
		if created.Code != http.StatusOK || !strings.Contains(created.Body.String(), `"bookmarked":true`) {
			t.Fatalf("create status=%d body=%s", created.Code, created.Body.String())
		}
		var ownerCount, otherCount int
		if err := db.QueryRow(context.Background(), `SELECT count(*) FROM learner.bookmark WHERE user_id=$1 AND target_type='kanji' AND target_id=$2`, userID, kanjiID).Scan(&ownerCount); err != nil || ownerCount != 1 {
			t.Fatalf("owner bookmark count=%d err=%v", ownerCount, err)
		}
		if err := db.QueryRow(context.Background(), `SELECT count(*) FROM learner.bookmark WHERE user_id=$1 AND target_id=$2`, otherID, kanjiID).Scan(&otherCount); err != nil || otherCount != 0 {
			t.Fatalf("other learner bookmark count=%d err=%v", otherCount, err)
		}
		checked := call(http.MethodGet, "/api/bookmarks/check/kanji/"+kanjiID, "", token)
		if checked.Code != http.StatusOK || !strings.Contains(checked.Body.String(), `"bookmarked":true`) {
			t.Fatalf("check status=%d body=%s", checked.Code, checked.Body.String())
		}
		deleted := call(http.MethodPost, path, "", token)
		if deleted.Code != http.StatusOK || !strings.Contains(deleted.Body.String(), `"bookmarked":false`) {
			t.Fatalf("delete toggle status=%d body=%s", deleted.Code, deleted.Body.String())
		}
		if got := call(http.MethodPost, "/api/bookmarks/unknown/"+kanjiID, "", token).Code; got != http.StatusBadRequest {
			t.Fatalf("invalid bookmark type status=%d; want 400", got)
		}
	})

	t.Run("POST clock-in requires CSRF and persists career reward", func(t *testing.T) {
		if got := call(http.MethodPost, "/api/career/clock-in", "", "").Code; got != http.StatusUnauthorized {
			t.Fatalf("anonymous clock-in=%d; want 401", got)
		}
		withoutCSRF := httptest.NewRequest(http.MethodPost, "/api/career/clock-in", nil)
		withoutCSRF.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: token})
		csrfResponse := httptest.NewRecorder()
		router.ServeHTTP(csrfResponse, withoutCSRF)
		if csrfResponse.Code != http.StatusForbidden {
			t.Fatalf("clock-in without CSRF=%d; want 403", csrfResponse.Code)
		}
		if _, err := career.NewStore(db).GetMe(context.Background(), userID); err != nil {
			t.Fatalf("initialize career state: %v", err)
		}
		response := call(http.MethodPost, "/api/career/clock-in", "", token)
		if response.Code != http.StatusOK {
			t.Fatalf("clock-in status=%d body=%s", response.Code, response.Body.String())
		}
		var hasClockIn bool
		var xp int
		if err := db.QueryRow(context.Background(), `SELECT last_clock_in_at IS NOT NULL, rank_xp FROM career.user_career_state WHERE user_id=$1`, userID).Scan(&hasClockIn, &xp); err != nil || !hasClockIn || xp < 10 {
			t.Fatalf("clock-in not persisted: hasClockIn=%v xp=%d err=%v", hasClockIn, xp, err)
		}
	})

	t.Run("GET companion hint validates range and scopes recent activity", func(t *testing.T) {
		if got := call(http.MethodGet, "/api/companion/hint", "", "").Code; got != http.StatusUnauthorized {
			t.Fatalf("anonymous hint=%d; want 401", got)
		}
		for _, days := range []string{"invalid", "0", "366"} {
			if got := call(http.MethodGet, "/api/companion/hint?days="+days, "", token).Code; got != http.StatusBadRequest {
				t.Fatalf("days=%s status=%d; want 400", days, got)
			}
		}
		if _, err := db.Exec(context.Background(), `INSERT INTO learning.study_session (user_id,duration_minutes) VALUES ($1,12)`, otherID); err != nil {
			t.Fatalf("insert foreign study session: %v", err)
		}
		response := call(http.MethodGet, "/api/companion/hint?days=7", "", token)
		if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), `"hints"`) || strings.Contains(response.Body.String(), `"progression"`) {
			t.Fatalf("foreign activity leaked into hint: status=%d body=%s", response.Code, response.Body.String())
		}
		if _, err := db.Exec(context.Background(), `INSERT INTO learning.study_session (user_id,duration_minutes) VALUES ($1,12)`, userID); err != nil {
			t.Fatalf("insert own study session: %v", err)
		}
		response = call(http.MethodGet, "/api/companion/hint?days=7", "", token)
		if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), `"progression"`) {
			t.Fatalf("own activity hint: status=%d body=%s", response.Code, response.Body.String())
		}
	})

	t.Run("public Kanji list/detail honor query, validation, and fixture contract", func(t *testing.T) {
		character := "測" + kanjiID[:4]
		if _, err := db.Exec(context.Background(), `INSERT INTO content.kanji (id,character,meaning_vi,status,created_at,updated_at) VALUES ($1,$2,'wave7 fixture','active',NOW(),NOW())`, kanjiID, character); err != nil {
			t.Fatalf("insert disposable kanji: %v", err)
		}
		list := call(http.MethodGet, "/api/content/kanji?limit=1&offset=0&q="+character, "", "")
		if list.Code != http.StatusOK || !strings.Contains(list.Body.String(), kanjiID) {
			t.Fatalf("list status=%d body=%s", list.Code, list.Body.String())
		}
		for _, query := range []string{"?limit=0", "?limit=bad", "?offset=-1"} {
			if got := call(http.MethodGet, "/api/content/kanji"+query, "", "").Code; got != http.StatusBadRequest {
				t.Fatalf("query %s status=%d; want 400", query, got)
			}
		}
		detail := call(http.MethodGet, "/api/content/kanji/"+kanjiID, "", "")
		if detail.Code != http.StatusOK || !strings.Contains(detail.Body.String(), "wave7 fixture") {
			t.Fatalf("detail status=%d body=%s", detail.Code, detail.Body.String())
		}
		if got := call(http.MethodGet, "/api/content/kanji/"+newUUID(t), "", "").Code; got != http.StatusNotFound {
			t.Fatalf("missing Kanji status=%d; want 404", got)
		}
		if got := call(http.MethodGet, "/api/content/kanji/not-a-uuid", "", "").Code; got != http.StatusBadRequest {
			t.Fatalf("malformed Kanji ID status=%d; want 400", got)
		}
	})

	t.Run("GET exercise history requires auth and hides other learner rows", func(t *testing.T) {
		if got := call(http.MethodGet, "/api/exercises/sessions/history", "", "").Code; got != http.StatusUnauthorized {
			t.Fatalf("anonymous history=%d; want 401", got)
		}
		var ownID, foreignID string
		for _, row := range []struct {
			userID string
			result *string
		}{{userID, &ownID}, {otherID, &foreignID}} {
			if err := db.QueryRow(context.Background(), `INSERT INTO exercise.exercise_session (user_id,session_type,exercise_type,status,total_questions,score) VALUES ($1,'practice_tab','mixed','completed',2,1) RETURNING id::text`, row.userID).Scan(row.result); err != nil {
				t.Fatalf("insert disposable exercise session: %v", err)
			}
		}
		response := call(http.MethodGet, "/api/exercises/sessions/history", "", token)
		if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), ownID) || strings.Contains(response.Body.String(), foreignID) {
			t.Fatalf("history status=%d own=%v foreign=%v body=%s", response.Code, strings.Contains(response.Body.String(), ownID), strings.Contains(response.Body.String(), foreignID), response.Body.String())
		}
	})
}
