package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/career"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

type attemptFlow struct {
	t                               *testing.T
	router                          http.Handler
	cookie                          *http.Cookie
	userID                          string
	rank1, rank2, rankHigh          string
	arcSlug, lockedArcSlug, npcSlug string
	ch1, ch2, lockedChapter         string
	draftChapter, inactiveNpcSlug   string
}

const attemptOrigin = "http://localhost:3000"

func newAttemptFlow(t *testing.T) *attemptFlow { return newAttemptFlowPool(t, 0) }

// newAttemptFlowPool serves the router from a pool capped at maxConns (0 keeps the default), because a
// transaction that waits on a second pooled connection while holding a lock only deadlocks on small pools.
func newAttemptFlowPool(t *testing.T, maxConns int32) *attemptFlow {
	t.Helper()
	db := testPool(t)
	ctx := context.Background()
	f := &attemptFlow{t: t, userID: newUUID(t), ch1: newUUID(t), ch2: newUUID(t), lockedChapter: newUUID(t), draftChapter: newUUID(t)}
	rankIDs := []string{newUUID(t), newUUID(t), newUUID(t)}
	arcID, lockedArcID, draftArcID, npcID, inactiveNpcID := newUUID(t), newUUID(t), newUUID(t), newUUID(t), newUUID(t)
	tag := rankIDs[0][:6]
	f.rank1, f.rank2, f.rankHigh = "FA"+tag, "FB"+tag, "FC"+tag
	f.arcSlug, f.lockedArcSlug, f.npcSlug = "flow-arc-"+tag, "flow-locked-"+tag, "flow_npc_"+tag
	f.inactiveNpcSlug = "flow_off_" + tag

	steps := []struct {
		sql  string
		args []any
	}{
		{`INSERT INTO career.career_rank (id,rank_code,title_ja,title_vi,bjt_band_target,xp_to_next,unlocked_scene_types,display_order,created_at,updated_at) VALUES
			($1,$4,'一','One','J5',15,'[]'::jsonb,900201,now(),now()),
			($2,$5,'二','Two','J4',100,'[]'::jsonb,900202,now(),now()),
			($3,$6,'高','High','J1',0,'[]'::jsonb,900299,now(),now())`, []any{rankIDs[0], rankIDs[1], rankIDs[2], f.rank1, f.rank2, f.rankHigh}},
		{`INSERT INTO career.mission_arc (id,slug,title_ja,title_vi,rank_code_entry,story_payload,status,display_order,created_at,updated_at) VALUES
			($1,$3,'流れ','Flow',$5,'{}'::jsonb,'published',900201,now(),now()),
			($2,$4,'高い','Locked',$6,'{}'::jsonb,'published',900202,now(),now()),
			($7,$8,'下書','Draft',$5,'{}'::jsonb,'draft',900203,now(),now())`, []any{arcID, lockedArcID, f.arcSlug, f.lockedArcSlug, f.rank1, f.rankHigh, draftArcID, "flow-draft-" + tag}},
		{`INSERT INTO career.story_npc (id,slug,name_ja,role_ja,default_relation,avatar_media,status)
			VALUES ($1,$2,'田中','先輩','uchi','{"avatarInitial":"T","avatarTint":"#059669"}'::jsonb,'active'),
			       ($3,$4,'休止','非表示','uchi',NULL,'draft')`, []any{npcID, f.npcSlug, inactiveNpcID, f.inactiveNpcSlug}},
		{`INSERT INTO career.mission_chapter (id,arc_id,slug,title_ja,title_vi,display_order,briefing_payload,scenario_payload,rewards_payload) VALUES ($1,$2,'one','一章','Chương 1',1,'{}'::jsonb,
			jsonb_build_object('scenarios', jsonb_build_array(jsonb_build_object('scenarioType','email','titleJa','件名','titleVi','Tiêu đề','goalVi','Viết tiêu đề',
			  'characters', jsonb_build_array(jsonb_build_object('npcSlug',$3::text)),
			  'question', jsonb_build_object('promptVi','Chọn tiêu đề','options', jsonb_build_array(
			    jsonb_build_object('optionKey','A','isCorrect',true,'textJa','【研修】ご連絡'),
			    jsonb_build_object('optionKey','B','isCorrect',false,'textJa','明日の件')))))),
			jsonb_build_object('rankXp',10,'skillGains',jsonb_build_object('keigo',4,'bogus',5),
			  'npcTrustGains', jsonb_build_array(jsonb_build_object('npcSlug',$3::text,'delta',5), jsonb_build_object('npcSlug','ghost-npc','delta',9), jsonb_build_object('npcSlug',$4::text,'delta',9)),
			  'npcReactionMontage', jsonb_build_array(jsonb_build_object('npcSlug',$3::text,'quoteJa','よし','sentiment','positive'))))`, []any{f.ch1, arcID, f.npcSlug, f.inactiveNpcSlug}},
		{`INSERT INTO career.mission_chapter (id,arc_id,slug,title_ja,title_vi,display_order,rewards_payload) VALUES ($1,$2,'two','二章','Chương 2',2,'{"rankXp":8,"skillGains":{"written":3}}'::jsonb)`, []any{f.ch2, arcID}},
		{`INSERT INTO career.mission_chapter (id,arc_id,slug,title_ja,title_vi,display_order) VALUES ($1,$2,'high','高章','Cao',1)`, []any{f.lockedChapter, lockedArcID}},
		{`INSERT INTO career.mission_chapter (id,arc_id,slug,title_ja,title_vi,display_order) VALUES ($1,$2,'draft','下書章','Nháp',1)`, []any{f.draftChapter, draftArcID}},
	}
	for _, step := range steps {
		if _, err := db.Exec(ctx, step.sql, step.args...); err != nil {
			t.Fatalf("attempt flow fixture: %v", err)
		}
	}
	seedActiveUser(t, db, f.userID, "Flow Learner", "flow-"+f.userID[:8]+"@example.com", "")
	for _, sql := range []string{
		`INSERT INTO career.user_career_state (user_id,current_rank_code,rank_xp,updated_at) VALUES ($1,$2,0,now())`,
	} {
		if _, err := db.Exec(ctx, sql, f.userID, f.rank1); err != nil {
			t.Fatalf("career state fixture: %v", err)
		}
	}
	if _, err := db.Exec(ctx, `INSERT INTO career.career_skill_stat (user_id,axis_code,value,updated_at) VALUES ($1,'keigo',99,now())`, f.userID); err != nil {
		t.Fatalf("skill fixture: %v", err)
	}
	f.cookie = &http.Cookie{Name: "bjt_web_session", Value: createLearnerSession(t, session.NewStore(db), f.userID)}
	servePool := db
	if maxConns > 0 {
		cfg, err := pgxpool.ParseConfig(os.Getenv("TEST_DATABASE_URL"))
		if err != nil {
			t.Fatalf("parse pool config: %v", err)
		}
		cfg.MaxConns = maxConns
		if servePool, err = pgxpool.NewWithConfig(ctx, cfg); err != nil {
			t.Fatalf("capped pool: %v", err)
		}
		t.Cleanup(servePool.Close)
	}
	f.router = NewRouter(Dependencies{
		Config: &config.Config{CORSOrigins: []string{attemptOrigin}}, Logger: testLogger(), DBPool: servePool,
		SessionStore: session.NewStore(servePool), CareerStore: career.NewStore(servePool),
	})
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, `DELETE FROM career.mission_arc WHERE id=ANY($1::uuid[])`, []string{arcID, lockedArcID, draftArcID})
		_, _ = db.Exec(ctx, `DELETE FROM career.story_npc WHERE id=ANY($1::uuid[])`, []string{npcID, inactiveNpcID})
		_, _ = db.Exec(ctx, `DELETE FROM career.career_rank WHERE id=ANY($1::uuid[])`, rankIDs)
	})
	return f
}

func (f *attemptFlow) do(method, path, body string, withCookie, withOrigin bool) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	if withOrigin {
		req.Header.Set("Origin", attemptOrigin)
	}
	if withCookie {
		req.AddCookie(f.cookie)
	}
	res := httptest.NewRecorder()
	f.router.ServeHTTP(res, req)
	return res
}

func (f *attemptFlow) start(chapterID string) *httptest.ResponseRecorder {
	return f.do(http.MethodPost, "/api/story/chapters/"+chapterID+"/attempts", "{}", true, true)
}

func (f *attemptFlow) complete(chapterID, body string) *httptest.ResponseRecorder {
	return f.do(http.MethodPost, "/api/story/chapters/"+chapterID+"/attempts/current/complete", body, true, true)
}

type completion struct {
	Career struct {
		CurrentRankCode string `json:"currentRankCode"`
		RankXP          int    `json:"rankXp"`
		RankXPToNext    int    `json:"rankXpToNext"`
		Skills          []struct {
			AxisCode string `json:"axisCode"`
			Value    int    `json:"value"`
		} `json:"skills"`
	} `json:"career"`
	Result struct {
		ChapterID      string         `json:"chapterId"`
		RankXPDelta    int            `json:"rankXpDelta"`
		SkillDeltas    map[string]int `json:"skillDeltas"`
		NpcTrustDeltas []struct {
			NpcSlug string `json:"npcSlug"`
			Delta   int    `json:"delta"`
		} `json:"npcTrustDeltas"`
		ContextMemoIDs     []string          `json:"contextMemoIds"`
		NpcReactionMontage []json.RawMessage `json:"npcReactionMontage"`
		CompletedAt        string            `json:"completedAt"`
	} `json:"result"`
	RankUp *struct {
		FromRankCode string `json:"fromRankCode"`
		ToRankCode   string `json:"toRankCode"`
	} `json:"rankUp"`
}

func decodeCompletion(t *testing.T, res *httptest.ResponseRecorder) completion {
	t.Helper()
	if res.Code != http.StatusOK {
		t.Fatalf("complete status=%d body=%s", res.Code, res.Body.String())
	}
	var c completion
	if err := json.Unmarshal(res.Body.Bytes(), &c); err != nil {
		t.Fatalf("decode completion: %v body=%s", err, res.Body.String())
	}
	return c
}

func TestStoryAttemptFlowGuardsAndLocks(t *testing.T) {
	f := newAttemptFlow(t)

	if res := f.do(http.MethodPost, "/api/story/chapters/"+f.ch1+"/attempts", "{}", false, true); res.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous start status=%d; want 401", res.Code)
	}
	if res := f.do(http.MethodPost, "/api/story/chapters/"+f.ch1+"/attempts", "{}", true, false); res.Code != http.StatusForbidden {
		t.Fatalf("start without trusted Origin status=%d; want 403 (CSRF)", res.Code)
	}
	if res := f.do(http.MethodGet, "/api/story/progress", "", false, false); res.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous progress status=%d; want 401", res.Code)
	}
	for name, path := range map[string]string{
		"unknown chapter": "/api/story/chapters/" + newUUID(t) + "/attempts",
		"not a uuid":      "/api/story/chapters/not-a-uuid/attempts",
		"urn form":        "/api/story/chapters/urn:uuid:" + f.ch1 + "/attempts",
	} {
		res := f.do(http.MethodPost, path, "{}", true, true)
		if res.Code != http.StatusNotFound || !strings.Contains(res.Body.String(), "chapter not found") {
			t.Fatalf("%s: status=%d body=%s; want 404 chapter not found", name, res.Code, res.Body.String())
		}
	}
	if res := f.start(f.ch2); res.Code != http.StatusForbidden || !strings.Contains(res.Body.String(), "chapter locked") {
		t.Fatalf("chapter 2 before chapter 1 status=%d body=%s; want 403 chapter locked", res.Code, res.Body.String())
	}
	if res := f.start(f.lockedChapter); res.Code != http.StatusForbidden || !strings.Contains(res.Body.String(), "chapter locked") {
		t.Fatalf("chapter of a higher-rank arc status=%d body=%s; want 403 chapter locked", res.Code, res.Body.String())
	}
	if res := f.complete(f.ch1, "{}"); res.Code != http.StatusNotFound || !strings.Contains(res.Body.String(), "no in-progress chapter attempt") {
		t.Fatalf("complete without start status=%d body=%s; want 404 no in-progress chapter attempt", res.Code, res.Body.String())
	}
}

func TestStoryAttemptFullFlowRewardsRankUpAndProgress(t *testing.T) {
	f := newAttemptFlow(t)
	db := testPool(t)
	ctx := context.Background()

	first := f.start(f.ch1)
	if first.Code != http.StatusCreated {
		t.Fatalf("first start status=%d body=%s; want 201", first.Code, first.Body.String())
	}
	var attempt struct {
		ID, ChapterID, Status string
	}
	_ = json.Unmarshal(first.Body.Bytes(), &attempt)
	again := f.start(f.ch1)
	var attempt2 struct{ ID string }
	_ = json.Unmarshal(again.Body.Bytes(), &attempt2)
	if again.Code != http.StatusOK || attempt.ID == "" || attempt2.ID != attempt.ID || attempt.Status != "in_progress" {
		t.Fatalf("second start must reuse the in-progress attempt: code=%d first=%+v second=%+v", again.Code, attempt, attempt2)
	}

	if res := f.complete(f.ch1, `{"optionKey":"Z"}`); res.Code != http.StatusBadRequest {
		t.Fatalf("unknown optionKey status=%d body=%s; want 400", res.Code, res.Body.String())
	}

	// A wrong answer pays 25% (floored): 2 XP, keigo +1 (99 -> 100), trust +1; unknown axis/NPC are ignored.
	wrong := decodeCompletion(t, f.complete(f.ch1, `{"optionKey":"B"}`))
	if wrong.Result.RankXPDelta != 2 || wrong.Result.SkillDeltas["keigo"] != 1 || len(wrong.Result.SkillDeltas) != 1 ||
		len(wrong.Result.NpcTrustDeltas) != 1 || wrong.Result.NpcTrustDeltas[0].NpcSlug != f.npcSlug || wrong.Result.NpcTrustDeltas[0].Delta != 1 ||
		len(wrong.Result.NpcReactionMontage) != 1 || len(wrong.Result.ContextMemoIDs) != 1 || wrong.Result.ChapterID != f.ch1 || wrong.Result.CompletedAt == "" {
		t.Fatalf("wrong-answer result=%+v", wrong.Result)
	}
	if wrong.Career.RankXP != 2 || wrong.Career.CurrentRankCode != f.rank1 || wrong.Career.RankXPToNext != 15 || wrong.RankUp != nil {
		t.Fatalf("wrong-answer career=%+v rankUp=%+v", wrong.Career, wrong.RankUp)
	}

	// Retrying complete without a new start is idempotent: same snapshot, nothing awarded twice.
	retry := decodeCompletion(t, f.complete(f.ch1, `{"optionKey":"B"}`))
	if retry.Result.RankXPDelta != 2 || retry.Career.RankXP != 2 || retry.RankUp != nil {
		t.Fatalf("idempotent retry result=%+v career=%+v", retry.Result, retry.Career)
	}

	// Chapter 2 is open now; the user improves chapter 1 by replaying it correctly and receives only the remaining 75%.
	if res := f.start(f.ch1); res.Code != http.StatusCreated {
		t.Fatalf("replay start status=%d body=%s", res.Code, res.Body.String())
	}
	improved := decodeCompletion(t, f.complete(f.ch1, `{"optionKey":"A"}`))
	if improved.Result.RankXPDelta != 8 || improved.Result.SkillDeltas["keigo"] != 3 || improved.Career.RankXP != 10 || len(improved.Result.ContextMemoIDs) != 0 {
		t.Fatalf("improvement must pay only the remainder and no second memo: %+v career=%+v", improved.Result, improved.Career)
	}
	if res := f.start(f.ch1); res.Code != http.StatusCreated {
		t.Fatalf("third start status=%d", res.Code)
	}
	if third := decodeCompletion(t, f.complete(f.ch1, `{"optionKey":"A"}`)); third.Result.RankXPDelta != 0 || len(third.Result.SkillDeltas) != 0 || len(third.Result.NpcTrustDeltas) != 0 || third.Career.RankXP != 10 {
		t.Fatalf("a perfect replay must award nothing: %+v career=%+v", third.Result, third.Career)
	}

	// Chapter 2 with no body earns full rewards, reaches 18 >= 15 XP and ranks up.
	if res := f.start(f.ch2); res.Code != http.StatusCreated {
		t.Fatalf("chapter 2 start status=%d body=%s", res.Code, res.Body.String())
	}
	done := decodeCompletion(t, f.complete(f.ch2, ""))
	if done.Result.RankXPDelta != 8 || done.Result.SkillDeltas["written"] != 3 || done.Career.RankXP != 18 || done.Career.CurrentRankCode != f.rank2 ||
		done.RankUp == nil || done.RankUp.FromRankCode != f.rank1 || done.RankUp.ToRankCode != f.rank2 || done.Career.RankXPToNext != 100 {
		t.Fatalf("rank-up result=%+v career=%+v rankUp=%+v", done.Result, done.Career, done.RankUp)
	}

	var keigo, trust, memos, events, completed int
	if err := db.QueryRow(ctx, `SELECT value FROM career.career_skill_stat WHERE user_id=$1 AND axis_code='keigo'`, f.userID).Scan(&keigo); err != nil || keigo != 100 {
		t.Fatalf("keigo must clamp at 100: value=%d err=%v", keigo, err)
	}
	if err := db.QueryRow(ctx, `SELECT trust_score FROM career.npc_relation WHERE user_id=$1 AND npc_slug=$2`, f.userID, f.npcSlug).Scan(&trust); err != nil || trust != 55 {
		t.Fatalf("npc trust must be 50+1+4: value=%d err=%v", trust, err)
	}
	var bogus, ghost, inactive int
	if err := db.QueryRow(ctx, `SELECT count(*) FROM career.career_skill_stat WHERE user_id=$1 AND axis_code='bogus'`, f.userID).Scan(&bogus); err != nil {
		t.Fatalf("count bogus skill rows: %v", err)
	}
	if err := db.QueryRow(ctx, `SELECT count(*) FROM career.npc_relation WHERE user_id=$1 AND npc_slug='ghost-npc'`, f.userID).Scan(&ghost); err != nil {
		t.Fatalf("count ghost npc rows: %v", err)
	}
	if err := db.QueryRow(ctx, `SELECT count(*) FROM career.npc_relation WHERE user_id=$1 AND npc_slug=$2`, f.userID, f.inactiveNpcSlug).Scan(&inactive); err != nil {
		t.Fatalf("count inactive npc rows: %v", err)
	}
	if bogus != 0 || ghost != 0 || inactive != 0 {
		t.Fatalf("unknown skill axes, unknown NPCs and inactive NPCs must not create rows: bogus=%d ghost=%d inactive=%d", bogus, ghost, inactive)
	}
	_ = db.QueryRow(ctx, `SELECT count(*) FROM career.context_memo WHERE user_id=$1`, f.userID).Scan(&memos)
	_ = db.QueryRow(ctx, `SELECT count(*) FROM career.rank_progression_event WHERE user_id=$1 AND from_rank_code=$2 AND to_rank_code=$3`, f.userID, f.rank1, f.rank2).Scan(&events)
	_ = db.QueryRow(ctx, `SELECT count(*) FROM career.chapter_attempt WHERE user_id=$1 AND status='completed' AND score_snapshot IS NOT NULL`, f.userID).Scan(&completed)
	if memos != 2 || events != 1 || completed != 4 {
		t.Fatalf("persistence: memos=%d (one per chapter) rankEvents=%d completedAttempts=%d; want 2/1/4", memos, events, completed)
	}

	progress := f.do(http.MethodGet, "/api/story/progress", "", true, false)
	var p struct {
		CurrentRankCode     string         `json:"currentRankCode"`
		CompletedChapterIDs []string       `json:"completedChapterIds"`
		Arcs                map[string]int `json:"arcs"`
	}
	if err := json.Unmarshal(progress.Body.Bytes(), &p); err != nil || progress.Code != http.StatusOK {
		t.Fatalf("progress status=%d err=%v body=%s", progress.Code, err, progress.Body.String())
	}
	if p.CurrentRankCode != f.rank2 || len(p.CompletedChapterIDs) != 2 || p.Arcs[f.arcSlug] != 2 {
		t.Fatalf("progress=%+v", p)
	}

	inbox := f.do(http.MethodGet, "/api/career/inbox", "", true, false)
	var memos2 []struct {
		ID           string `json:"id"`
		ExpressionJa string `json:"expressionJa"`
		FromNPCSlug  string `json:"fromNpcSlug"`
		Status       string `json:"status"`
	}
	if err := json.Unmarshal(inbox.Body.Bytes(), &memos2); err != nil || len(memos2) != 2 {
		t.Fatalf("completed chapters must appear in the learner inbox: err=%v body=%s", err, inbox.Body.String())
	}
	var chapterOneMemo bool
	for _, m := range memos2 {
		if m.ID == wrong.Result.ContextMemoIDs[0] {
			chapterOneMemo = m.ExpressionJa == "【研修】ご連絡" && m.FromNPCSlug == f.npcSlug && m.Status == "unread"
		}
	}
	if !chapterOneMemo {
		t.Fatalf("chapter 1 memo must carry the correct answer text, the rewarding NPC and be unread: %s", inbox.Body.String())
	}

	me := f.do(http.MethodGet, "/api/career/me", "", true, false)
	if !strings.Contains(me.Body.String(), `"rankXpToNext":100`) {
		t.Fatalf("career/me must expose rankXpToNext of the current rank: %s", me.Body.String())
	}
	list := f.do(http.MethodGet, "/api/story/arcs", "", false, false)
	var arcs []struct {
		Slug       string   `json:"slug"`
		ChapterIDs []string `json:"chapterIds"`
	}
	if err := json.Unmarshal(list.Body.Bytes(), &arcs); err != nil {
		t.Fatalf("decode arc list: %v", err)
	}
	var ordered bool
	for _, a := range arcs {
		if a.Slug == f.arcSlug {
			ordered = len(a.ChapterIDs) == 2 && a.ChapterIDs[0] == f.ch1 && a.ChapterIDs[1] == f.ch2
		}
	}
	if !ordered {
		t.Fatalf("arc list must expose chapterIds in chapter order so clients can pick the next chapter: %s", list.Body.String())
	}
}

func TestStoryAttemptCompleteIsConcurrencySafe(t *testing.T) {
	// 3 connections for 8 simultaneous completes: the lock holder must never wait for a second pooled connection.
	f := newAttemptFlowPool(t, 3)
	if res := f.start(f.ch1); res.Code != http.StatusCreated {
		t.Fatalf("start status=%d", res.Code)
	}
	var wg sync.WaitGroup
	codes := make([]int, 8)
	deltas := make([]int, 8)
	for i := range codes {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			res := f.complete(f.ch1, `{"optionKey":"A"}`)
			codes[i] = res.Code
			var c completion
			_ = json.Unmarshal(res.Body.Bytes(), &c)
			deltas[i] = c.Result.RankXPDelta
		}(i)
	}
	wg.Wait()
	var xp int
	if err := testPool(t).QueryRow(context.Background(), `SELECT rank_xp FROM career.user_career_state WHERE user_id=$1`, f.userID).Scan(&xp); err != nil {
		t.Fatalf("load xp: %v", err)
	}
	if xp != 10 {
		t.Fatalf("concurrent completes must award the chapter once: xp=%d codes=%v deltas=%v", xp, codes, fmt.Sprint(deltas))
	}
	for _, code := range codes {
		if code != http.StatusOK {
			t.Fatalf("every concurrent complete must succeed idempotently: codes=%v", codes)
		}
	}
}

func TestStoryAttemptRejectsUnpublishedAndGuardsComplete(t *testing.T) {
	f := newAttemptFlow(t)
	for name, res := range map[string]*httptest.ResponseRecorder{
		"start unpublished arc":    f.start(f.draftChapter),
		"complete unpublished arc": f.complete(f.draftChapter, "{}"),
	} {
		if res.Code != http.StatusNotFound || !strings.Contains(res.Body.String(), "chapter not found") {
			t.Fatalf("%s: status=%d body=%s; want 404 chapter not found", name, res.Code, res.Body.String())
		}
	}
	if res := f.do(http.MethodPost, "/api/story/chapters/"+f.ch1+"/attempts/current/complete", "{}", false, true); res.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous complete status=%d; want 401", res.Code)
	}
	if res := f.do(http.MethodPost, "/api/story/chapters/"+f.ch1+"/attempts/current/complete", "{}", true, false); res.Code != http.StatusForbidden {
		t.Fatalf("complete without trusted Origin status=%d; want 403 (CSRF)", res.Code)
	}
	if res := f.complete(f.ch1, "not json"); res.Code != http.StatusBadRequest {
		t.Fatalf("malformed body status=%d; want 400", res.Code)
	}
}

func TestStoryAttemptAdvancesOneRankAndClampsTrust(t *testing.T) {
	f := newAttemptFlow(t)
	db := testPool(t)
	ctx := context.Background()
	// Banked XP (e.g. from daily clock-ins) well above two thresholds must still advance only one rank per completion.
	if _, err := db.Exec(ctx, `UPDATE career.user_career_state SET rank_xp = 500 WHERE user_id = $1`, f.userID); err != nil {
		t.Fatalf("bank xp: %v", err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO career.npc_relation (user_id,npc_slug,trust_score) VALUES ($1,$2,98)`, f.userID, f.npcSlug); err != nil {
		t.Fatalf("seed trust: %v", err)
	}
	if res := f.start(f.ch1); res.Code != http.StatusCreated {
		t.Fatalf("start status=%d body=%s", res.Code, res.Body.String())
	}
	done := decodeCompletion(t, f.complete(f.ch1, `{"optionKey":"A"}`))
	if done.RankUp == nil || done.RankUp.ToRankCode != f.rank2 || done.Career.CurrentRankCode != f.rank2 || done.Career.RankXP != 510 {
		t.Fatalf("exactly one rank step expected: rankUp=%+v career=%+v", done.RankUp, done.Career)
	}
	var trust int
	if err := db.QueryRow(ctx, `SELECT trust_score FROM career.npc_relation WHERE user_id=$1 AND npc_slug=$2`, f.userID, f.npcSlug).Scan(&trust); err != nil || trust != 100 {
		t.Fatalf("npc trust must clamp at 100: value=%d err=%v", trust, err)
	}
}

// A chapter whose rewards have no reaction montage or trust gains must still serialize empty lists, never null:
// the completion screen maps over them (found by playing the real UI against the seeded content).
func TestStoryAttemptCompletionNeverReturnsNullLists(t *testing.T) {
	f := newAttemptFlow(t)
	for _, chapter := range []string{f.ch1, f.ch2} {
		if res := f.start(chapter); res.Code != http.StatusCreated {
			t.Fatalf("start %s status=%d body=%s", chapter, res.Code, res.Body.String())
		}
		res := f.complete(chapter, "")
		if res.Code != http.StatusOK {
			t.Fatalf("complete %s status=%d body=%s", chapter, res.Code, res.Body.String())
		}
		var raw struct {
			Result map[string]json.RawMessage `json:"result"`
		}
		if err := json.Unmarshal(res.Body.Bytes(), &raw); err != nil {
			t.Fatalf("decode: %v", err)
		}
		for _, key := range []string{"skillDeltas", "npcTrustDeltas", "contextMemoIds", "npcReactionMontage"} {
			if v, ok := raw.Result[key]; !ok || string(v) == "null" {
				t.Fatalf("result.%s must be an empty collection, not %q: %s", key, string(v), res.Body.String())
			}
		}
	}
}
