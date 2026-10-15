package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
)

func TestLotoFeedReturnsPagedEnvelope(t *testing.T) {
	db := testPool(t)
	game := "loto6"
	var baseline int
	if err := db.QueryRow(context.Background(), `SELECT COUNT(*) FROM daily.loto_draw WHERE game=$1`, game).Scan(&baseline); err != nil {
		t.Fatalf("count loto draws: %v", err)
	}
	ids := []string{newUUID(t), newUUID(t), newUUID(t)}
	for i, id := range ids {
		_, err := db.Exec(context.Background(), `INSERT INTO daily.loto_draw
			(id, game, draw_number, draw_date, main_numbers, bonus_numbers)
			VALUES ($1, $2, $3, CURRENT_DATE + 10000 + $4::integer, ARRAY[1,2,3,4,5,6], ARRAY[7])`,
			id, game, 900000+i, i+1)
		if err != nil {
			t.Fatalf("insert disposable loto draw: %v", err)
		}
	}
	runID := newUUID(t)
	if _, err := db.Exec(context.Background(), `INSERT INTO daily.loto_generation_run (id, game, target_draw_date, status)
		VALUES ($1, $2, CURRENT_DATE + 10003, 'published')`, runID, game); err != nil {
		t.Fatalf("insert disposable published loto run: %v", err)
	}
	for rank, numbers := range [][]int{{1, 20, 21, 22, 23, 24}, {1, 2, 3, 4, 5, 6}} {
		bonus := []int{8}
		if rank == 1 {
			bonus = []int{7}
		}
		_, err := db.Exec(context.Background(), `INSERT INTO daily.loto_generated_set
			(run_id, rank, main_numbers, bonus_numbers, score, selected_for_magazine)
			VALUES ($1, $2, $3, $4, 90, true)`, runID, rank+1, numbers, bonus)
		if err != nil {
			t.Fatalf("insert disposable published loto set: %v", err)
		}
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM daily.loto_draw WHERE id=ANY($1::uuid[])`, ids)
		_, _ = db.Exec(context.Background(), `DELETE FROM daily.loto_generation_run WHERE id=$1`, runID)
	})

	router := NewRouter(Dependencies{Config: &config.Config{}, Logger: testLogger(), DBPool: db})
	request := func(page int) *httptest.ResponseRecorder {
		response := httptest.NewRecorder()
		router.ServeHTTP(response, httptest.NewRequest(http.MethodGet,
			fmt.Sprintf("/api/magazine/loto/feed?game=%s&page=%d&limit=1", game, page), nil))
		return response
	}
	type feed struct {
		Data []struct {
			ID         string           `json:"id"`
			Sets       []map[string]any `json:"sets"`
			Result     map[string]any   `json:"result"`
			HitCount   int              `json:"hitCount"`
			BonusHit   bool             `json:"bonusHit"`
			JPSentence any              `json:"jpSentence"`
		} `json:"data"`
		Total int `json:"total"`
		Page  int `json:"page"`
		Limit int `json:"limit"`
	}
	for page, wantID := range []string{ids[2], ids[1]} {
		response := request(page + 1)
		var got feed
		if response.Code != http.StatusOK {
			t.Fatalf("page %d status=%d body=%s", page+1, response.Code, response.Body.String())
		}
		if err := json.Unmarshal(response.Body.Bytes(), &got); err != nil {
			t.Fatalf("decode paged feed envelope: %v", err)
		}
		if got.Total != baseline+3 || got.Page != page+1 || got.Limit != 1 || len(got.Data) != 1 || got.Data[0].ID != wantID || got.Data[0].Sets == nil || got.Data[0].Result == nil {
			t.Fatalf("page %d envelope=%+v, want total %d and id %s", page+1, got, baseline+3, wantID)
		}
		if page == 0 && (got.Data[0].HitCount != 1 || got.Data[0].BonusHit) {
			t.Fatalf("history hit summary=%+v, want first set only (1 hit, no bonus)", got.Data[0])
		}
	}
	lastPage := request(999)
	var last feed
	if lastPage.Code != http.StatusOK || json.Unmarshal(lastPage.Body.Bytes(), &last) != nil || last.Page != last.Total || len(last.Data) != 1 {
		t.Fatalf("out-of-range page should clamp to the last page, status=%d body=%s", lastPage.Code, lastPage.Body.String())
	}
}

func TestLotoFeedReportsDatabaseFailure(t *testing.T) {
	db := testPool(t)
	db.Close()
	response := httptest.NewRecorder()
	lotoFeedHandler(db, testLogger()).ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/magazine/loto/feed", nil))
	if response.Code != http.StatusInternalServerError {
		t.Fatalf("closed database feed status=%d body=%s, want 500", response.Code, response.Body.String())
	}
}

func TestLotoFeedRejectsUnknownGame(t *testing.T) {
	db := testPool(t)
	response := httptest.NewRecorder()
	lotoFeedHandler(db, testLogger()).ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/magazine/loto/feed?game=other", nil))
	if response.Code != http.StatusBadRequest {
		t.Fatalf("unknown game status=%d body=%s, want 400", response.Code, response.Body.String())
	}
}

func TestLotoStatsReportsDatabaseFailure(t *testing.T) {
	db := testPool(t)
	db.Close()
	response := httptest.NewRecorder()
	lotoStatsHandler(db, testLogger()).ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/magazine/loto/stats", nil))
	if response.Code != http.StatusInternalServerError {
		t.Fatalf("closed database stats status=%d body=%s, want 500", response.Code, response.Body.String())
	}
}

func TestLotoStatsRejectsUnknownGame(t *testing.T) {
	db := testPool(t)
	response := httptest.NewRecorder()
	lotoStatsHandler(db, testLogger()).ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/magazine/loto/stats?game=other", nil))
	if response.Code != http.StatusBadRequest {
		t.Fatalf("unknown game stats status=%d body=%s, want 400", response.Code, response.Body.String())
	}
}

func TestLotoNextDrawReturnsGeneratedSets(t *testing.T) {
	db := testPool(t)
	game := "loto7"
	runID := newUUID(t)
	emptyRunID := newUUID(t)
	if _, err := db.Exec(context.Background(), `INSERT INTO daily.loto_generation_run (id, game, target_draw_date, status, created_at)
		VALUES ($1, $2, CURRENT_DATE + 1, 'published', NOW() - INTERVAL '1 minute')`, emptyRunID, game); err != nil {
		t.Fatalf("insert earlier published loto run without a selected set: %v", err)
	}
	if _, err := db.Exec(context.Background(), `INSERT INTO daily.loto_generation_run (id, game, target_draw_date, status, created_at)
		VALUES ($1, $2, CURRENT_DATE + 2, 'published', NOW())`, runID, game); err != nil {
		t.Fatalf("insert disposable loto generation run: %v", err)
	}
	if _, err := db.Exec(context.Background(), `INSERT INTO daily.loto_generated_set (run_id, rank, main_numbers, bonus_numbers, score, selected_for_magazine)
		VALUES ($1, 1, ARRAY[2,4,6,8,10,12,14], ARRAY[16,18], 92.5, true)`, runID); err != nil {
		t.Fatalf("insert disposable loto set: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM daily.loto_generation_run WHERE id=ANY($1::uuid[])`, []string{runID, emptyRunID})
	})
	response := httptest.NewRecorder()
	lotoNextDrawHandler(db, testLogger()).ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/magazine/loto/next-draw?game=loto7", nil))
	var got struct {
		NextDraw *struct {
			ID   string `json:"id"`
			Game string `json:"game"`
			Sets []struct {
				MainNumbers  []int   `json:"mainNumbers"`
				BonusNumbers []int   `json:"bonusNumbers"`
				Score        float64 `json:"score"`
			} `json:"sets"`
			VocabItems []any `json:"vocabItems"`
		} `json:"nextDraw"`
	}
	if response.Code != http.StatusOK {
		t.Fatalf("next draw status=%d, want 200: %s", response.Code, response.Body.String())
	}
	if err := json.Unmarshal(response.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode next draw envelope: %v", err)
	}
	if got.NextDraw == nil || got.NextDraw.ID != runID || got.NextDraw.Game != game || len(got.NextDraw.Sets) != 1 || len(got.NextDraw.Sets[0].MainNumbers) != 7 || len(got.NextDraw.Sets[0].BonusNumbers) != 2 || got.NextDraw.Sets[0].Score != 92.5 || got.NextDraw.VocabItems == nil {
		t.Fatalf("next draw envelope=%+v, expected complete generated set", got.NextDraw)
	}
}
