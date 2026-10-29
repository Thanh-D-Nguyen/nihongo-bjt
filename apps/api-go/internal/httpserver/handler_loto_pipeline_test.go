package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/authz"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/credential"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/loto"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

type stubLotoSource struct {
	draws []loto.Draw
	err   error
}

func (s stubLotoSource) Fetch(_ context.Context, _ loto.Game) ([]loto.Draw, string, error) {
	return s.draws, "https://loto7.thekyo.jp/data/loto7.csv", s.err
}

// lotoPipelineServer is the admin router with a stub result source wired in.
func lotoPipelineServer(t *testing.T, db *pgxpool.Pool, source loto.ResultSource) (*httptest.Server, *session.Store) {
	t.Helper()
	sessStore := session.NewStore(db)
	rateLimiter, err := authn.NewRateLimiter(authn.RateLimiterConfig{Limit: 100, Window: time.Minute, TTL: 5 * time.Minute, EvictEvery: time.Minute, MaxKeys: 1000})
	if err != nil {
		t.Fatalf("create rate limiter: %v", err)
	}
	router := NewRouter(Dependencies{
		Config: &config.Config{CORSOrigins: []string{"http://localhost:3000"}}, Logger: testLogger(), DBPool: db,
		SessionStore: sessStore, RBACStore: authz.NewStore(db), CredentialStore: credential.NewStore(db),
		RateLimiter: rateLimiter, LotoResultSource: source,
	})
	server := httptest.NewServer(router)
	t.Cleanup(server.Close)
	return server, sessStore
}

func lotoAdminCall(t *testing.T, server *httptest.Server, token, method, path, body string) (int, map[string]any) {
	t.Helper()
	req, err := http.NewRequest(method, server.URL+path, strings.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "http://localhost:3000")
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
	res, err := server.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	var decoded map[string]any
	_ = json.NewDecoder(res.Body).Decode(&decoded)
	return res.StatusCode, decoded
}

func lotoAdminActor(t *testing.T, db *pgxpool.Pool, sessions *session.Store) (string, string) {
	t.Helper()
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, "loto-pipeline-"+actorID+"@example.test", "loto pipeline")
	grantAdminPermission(t, db, actorID, "admin.content.read")
	grantAdminPermission(t, db, actorID, "admin.content.write")
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM ops.admin_audit_log WHERE actor_id=$1`, actorID)
		_, _ = db.Exec(context.Background(), `DELETE FROM auth.admin_session WHERE actor_id=$1`, actorID)
	})
	return actorID, createAdminSession(t, sessions, actorID)
}

func lotoHistory(base, count int, firstDate string) []loto.Draw {
	start, _ := loto.ParseDateKey(firstDate)
	draws := make([]loto.Draw, 0, count)
	for i := 0; i < count; i++ {
		draws = append(draws, loto.Draw{
			Game: loto.Loto7, Number: base + i, DateKey: start.AddDate(0, 0, i).Format("2006-01-02"),
			Main: []int{1 + i%5, 6 + i%7, 13 + i%3, 16 + i%9, 25 + i%4, 29 + i%5, 34 + i%2}, Bonus: []int{36, 37},
		})
	}
	return draws
}

func TestAdminLotoSyncImportsFromTheConfiguredSource(t *testing.T) {
	db := testPool(t)
	ctx := context.Background()
	base := 9300000 + int(time.Now().UnixNano()%1000)*20
	draws := lotoHistory(base, 5, "1991-01-04")
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, `DELETE FROM daily.loto_draw WHERE game='loto7' AND draw_number >= $1 AND draw_number < $2`, base, base+20)
	})
	server, sessions := lotoPipelineServer(t, db, stubLotoSource{draws: draws})
	actorID, token := lotoAdminActor(t, db, sessions)

	status, body := lotoAdminCall(t, server, token, http.MethodPost, "/api/admin/magazine/loto/sync", `{"game":"loto7"}`)
	if status != http.StatusOK || body["status"] != "synced" || body["created"] != float64(5) || body["sourceProvider"] != loto.ProviderThekyo {
		t.Fatalf("sync status=%d body=%v, want 5 draws synced", status, body)
	}
	var stored int
	if err := db.QueryRow(ctx, `SELECT COUNT(*) FROM daily.loto_draw WHERE game='loto7' AND draw_number >= $1 AND draw_number < $2 AND source_provider=$3`, base, base+20, loto.ProviderThekyo).Scan(&stored); err != nil || stored != 5 {
		t.Fatalf("stored draws=%d err=%v, want 5 tagged with the source provider", stored, err)
	}
	assertAdminAuditEvent(t, db, actorID, "admin.magazine.loto.sync.completed", "daily.loto_draw", "loto7")

	status, body = lotoAdminCall(t, server, token, http.MethodPost, "/api/admin/magazine/loto/sync", `{"game":"loto7"}`)
	if status != http.StatusOK || body["created"] != float64(0) || body["updated"] != float64(3) {
		t.Fatalf("repeat sync status=%d body=%v, want only the last three draws re-checked", status, body)
	}

	failing, _ := lotoPipelineServer(t, db, stubLotoSource{err: fmt.Errorf("mirror down")})
	status, body = lotoAdminCall(t, failing, token, http.MethodPost, "/api/admin/magazine/loto/sync", `{"game":"loto7"}`)
	if status != http.StatusBadGateway {
		t.Fatalf("source outage status=%d body=%v, want 502", status, body)
	}
}

func TestAdminLotoGenerateUsesHistoryDeterministicallyAndAttachesLearningSentence(t *testing.T) {
	db := testPool(t)
	ctx := context.Background()
	base := 9400000 + int(time.Now().UnixNano()%1000)*40
	if _, _, err := loto.UpsertDraws(ctx, db, lotoHistory(base, 30, "1992-01-03"), "csv_import", ""); err != nil {
		t.Fatalf("seed history: %v", err)
	}
	var runIDs []string
	t.Cleanup(func() {
		for _, id := range runIDs {
			_, _ = db.Exec(ctx, `DELETE FROM daily.loto_generation_run WHERE id=$1`, id)
		}
		_, _ = db.Exec(ctx, `DELETE FROM daily.loto_draw WHERE game='loto7' AND draw_number >= $1 AND draw_number < $2`, base, base+40)
	})
	server, sessions := lotoPipelineServer(t, db, nil)
	_, token := lotoAdminActor(t, db, sessions)

	request := `{"game":"loto7","targetDrawDate":"2092-01-03","setCount":3,"seed":"pipeline","weights":{"gapPattern":0.1,"overdue":0.3},"pinnedNumbers":[5],"excludedNumbers":[6]}`
	type generated struct {
		ID               string `json:"id"`
		Seed             string `json:"seed"`
		JapaneseSentence struct {
			TextJP     string `json:"textJp"`
			VocabItems []any  `json:"vocabItems"`
		} `json:"japaneseSentence"`
		Sets []struct {
			ID          string  `json:"id"`
			MainNumbers []int   `json:"mainNumbers"`
			Score       float64 `json:"score"`
		} `json:"sets"`
	}
	call := func() generated {
		t.Helper()
		status, raw := lotoAdminCall(t, server, token, http.MethodPost, "/api/admin/magazine/loto/generate", request)
		encoded, _ := json.Marshal(raw)
		var out generated
		if status != http.StatusOK || json.Unmarshal(encoded, &out) != nil || out.ID == "" {
			t.Fatalf("generate status=%d body=%s", status, encoded)
		}
		runIDs = append(runIDs, out.ID)
		return out
	}
	first, second := call(), call()
	if first.Seed != "pipeline" || len(first.Sets) != 3 || first.JapaneseSentence.TextJP == "" || len(first.JapaneseSentence.VocabItems) < 3 {
		t.Fatalf("generated run = %+v", first)
	}
	for i, set := range first.Sets {
		if fmt.Sprint(set.MainNumbers) != fmt.Sprint(second.Sets[i].MainNumbers) {
			t.Fatalf("same seed produced different sets: %v vs %v", set.MainNumbers, second.Sets[i].MainNumbers)
		}
		if set.Score < 0 || set.Score > 1 || len(set.MainNumbers) != 7 {
			t.Fatalf("set %d malformed: %+v", i, set)
		}
		pinned, excluded := false, false
		for _, n := range set.MainNumbers {
			pinned = pinned || n == 5
			excluded = excluded || n == 6
		}
		if !pinned || excluded {
			t.Fatalf("set %v must contain 5 and not 6", set.MainNumbers)
		}
	}
	status, body := lotoAdminCall(t, server, token, http.MethodPost, "/api/admin/magazine/loto/generate", `{"game":"loto7","targetDrawDate":"2092-01-03","setCount":1,"pinnedNumbers":[99]}`)
	if status != http.StatusBadRequest {
		t.Fatalf("pinning an impossible number status=%d body=%v, want 400", status, body)
	}
}

func TestLotoFeedPrefersPublishedOverBacktestAndLabelsPlainResults(t *testing.T) {
	db := testPool(t)
	ctx := context.Background()
	base := 9500000 + int(time.Now().UnixNano()%1000)*10
	draws := []loto.Draw{
		{Game: loto.Loto7, Number: base, DateKey: "2090-01-05", Main: []int{1, 2, 3, 4, 5, 6, 7}, Bonus: []int{8, 9}},
		{Game: loto.Loto7, Number: base + 1, DateKey: "2090-01-12", Main: []int{10, 11, 12, 13, 14, 15, 16}, Bonus: []int{17, 18}},
	}
	if _, _, err := loto.UpsertDraws(ctx, db, draws, "csv_import", ""); err != nil {
		t.Fatalf("seed draws: %v", err)
	}
	backtest, published := newUUID(t), newUUID(t)
	for _, run := range []struct{ id, status string }{{backtest, "backtest"}, {published, "published"}} {
		if _, err := db.Exec(ctx, `INSERT INTO daily.loto_generation_run (id, game, target_draw_date, status, japanese_sentence_json)
			VALUES ($1,'loto7','2090-01-05',$2,'{"textJp":"確率","reading":"かくりつ","textVi":"xác suất","vocabItems":[]}')`, run.id, run.status); err != nil {
			t.Fatalf("insert run: %v", err)
		}
	}
	for _, set := range []struct{ run, numbers string }{{backtest, "{30,31,32,33,34,35,36}"}, {published, "{1,2,3,20,21,22,23}"}} {
		if _, err := db.Exec(ctx, `INSERT INTO daily.loto_generated_set (run_id, rank, main_numbers, bonus_numbers, score, selected_for_magazine)
			VALUES ($1,1,$2::integer[],ARRAY[]::integer[],0.5,true)`, set.run, set.numbers); err != nil {
			t.Fatalf("insert set: %v", err)
		}
	}
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, `DELETE FROM daily.loto_generation_run WHERE id=ANY($1::uuid[])`, []string{backtest, published})
		_, _ = db.Exec(ctx, `DELETE FROM daily.loto_draw WHERE game='loto7' AND draw_number >= $1 AND draw_number < $2`, base, base+10)
	})

	response := httptest.NewRecorder()
	lotoFeedHandler(db, testLogger()).ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/magazine/loto/feed?game=loto7&page=1&limit=2", nil))
	var got struct {
		Data []struct {
			DrawNumber int    `json:"drawNumber"`
			Kind       string `json:"kind"`
			HitCount   int    `json:"hitCount"`
			Matched    []int  `json:"matched"`
			DrawDayJP  string `json:"drawDayJp"`
			Sets       []struct {
				MainNumbers []int `json:"mainNumbers"`
			} `json:"sets"`
			JPSentence map[string]any `json:"jpSentence"`
		} `json:"data"`
	}
	if response.Code != http.StatusOK || json.Unmarshal(response.Body.Bytes(), &got) != nil || len(got.Data) != 2 {
		t.Fatalf("feed status=%d body=%s", response.Code, response.Body.String())
	}
	plain, predicted := got.Data[0], got.Data[1]
	if plain.DrawNumber != base+1 || plain.Kind != "result" || len(plain.Sets) != 0 || plain.JPSentence != nil {
		t.Fatalf("newest draw without a prediction = %+v, want a plain result", plain)
	}
	if predicted.DrawNumber != base || predicted.Kind != "published" || len(predicted.Sets) != 1 || predicted.HitCount != 3 || len(predicted.Matched) != 3 || predicted.DrawDayJP != "木曜日" {
		t.Fatalf("predicted draw = %+v, want the published set (3 hits) to win over the backtest", predicted)
	}
	if predicted.JPSentence["textJp"] != "確率" {
		t.Fatalf("jpSentence = %v", predicted.JPSentence)
	}
}

func TestLotoNextDrawMovesOnOnceTodaysResultIsImported(t *testing.T) {
	db := testPool(t)
	ctx := context.Background()
	jst := time.FixedZone("JST", 9*3600)
	today := time.Now().In(jst).Format("2006-01-02")
	tomorrow := time.Now().In(jst).AddDate(0, 0, 1).Format("2006-01-02")
	base := 9600000 + int(time.Now().UnixNano()%1000)*10
	runIDs := []string{newUUID(t), newUUID(t)}
	for i, target := range []string{today, tomorrow} {
		if _, err := db.Exec(ctx, `INSERT INTO daily.loto_generation_run (id, game, target_draw_date, status) VALUES ($1,'loto7',$2::date,'published')`, runIDs[i], target); err != nil {
			t.Fatalf("insert run: %v", err)
		}
		if _, err := db.Exec(ctx, `INSERT INTO daily.loto_generated_set (run_id, rank, main_numbers, bonus_numbers, score, selected_for_magazine)
			VALUES ($1,1,ARRAY[1,2,3,4,5,6,7],ARRAY[]::integer[],0.5,true)`, runIDs[i]); err != nil {
			t.Fatalf("insert set: %v", err)
		}
	}
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, `DELETE FROM daily.loto_generation_run WHERE id=ANY($1::uuid[])`, runIDs)
		_, _ = db.Exec(ctx, `DELETE FROM daily.loto_draw WHERE game='loto7' AND draw_number=$1`, base)
	})
	nextID := func() string {
		response := httptest.NewRecorder()
		lotoNextDrawHandler(db, testLogger()).ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/magazine/loto/next-draw?game=loto7", nil))
		var got struct {
			NextDraw *struct {
				ID string `json:"id"`
			} `json:"nextDraw"`
		}
		if response.Code != http.StatusOK || json.Unmarshal(response.Body.Bytes(), &got) != nil || got.NextDraw == nil {
			t.Fatalf("next draw status=%d body=%s", response.Code, response.Body.String())
		}
		return got.NextDraw.ID
	}
	if got := nextID(); got != runIDs[0] {
		t.Fatalf("before today's result next draw = %s, want today's run %s", got, runIDs[0])
	}
	if _, _, err := loto.UpsertDraws(ctx, db, []loto.Draw{{Game: loto.Loto7, Number: base, DateKey: today, Main: []int{1, 2, 3, 4, 5, 6, 7}, Bonus: []int{8, 9}}}, "csv_import", ""); err != nil {
		t.Fatalf("import today's result: %v", err)
	}
	if got := nextID(); got != runIDs[1] {
		t.Fatalf("after today's result next draw = %s, want tomorrow's run %s", got, runIDs[1])
	}
}
