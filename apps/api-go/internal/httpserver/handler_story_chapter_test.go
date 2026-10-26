package httpserver

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/career"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

type storyChapterFixture struct {
	rankCode, arcSlug, plainArcSlug      string
	npcSlug, otherNpcSlug, hiddenNpcSlug string
	chapterID, draftChapterID            string
	sessionCookie                        *http.Cookie
}

func insertStoryChapterFixture(t *testing.T) storyChapterFixture {
	t.Helper()
	db := testPool(t)
	rankID, arcID, draftArcID, plainArcID, userID := newUUID(t), newUUID(t), newUUID(t), newUUID(t), newUUID(t)
	npcIDs := []string{newUUID(t), newUUID(t), newUUID(t)}
	f := storyChapterFixture{
		rankCode: "SC" + rankID[:6], arcSlug: "story-chapter-" + rankID[:8], plainArcSlug: "story-plain-" + rankID[:8],
		npcSlug: "npc_a" + npcIDs[0][:8], otherNpcSlug: "npc_b" + npcIDs[1][:8], hiddenNpcSlug: "npc_c" + npcIDs[2][:8],
		chapterID: newUUID(t), draftChapterID: newUUID(t),
	}
	ctx := context.Background()
	draftSlug := "story-chapter-draft-" + rankID[:8]
	steps := []struct {
		sql  string
		args []any
	}{
		{`INSERT INTO career.career_rank (id,rank_code,title_ja,title_vi,bjt_band_target,unlocked_scene_types,display_order,created_at,updated_at)
			VALUES ($1,$2,'章','Story chapter','J5','[]'::jsonb,900101,now(),now())`, []any{rankID, f.rankCode}},
		{`INSERT INTO career.mission_arc (id,slug,title_ja,title_vi,rank_code_entry,story_payload,status,display_order,created_at,updated_at)
			VALUES ($1,$2,'公開','Published',$3,'{"synopsisVi":"Tóm tắt","npcSlugs":["x_npc"],"artAccent":"#059669"}'::jsonb,'published',900101,now(),now()),
			       ($4,$5,'下書き','Draft',$3,'{}'::jsonb,'draft',900102,now(),now()),
			       ($6,$7,'素朴','Plain',$3,'{"synopsisVi":42,"npcSlugs":"oops"}'::jsonb,'published',900103,now(),now())`,
			[]any{arcID, f.arcSlug, f.rankCode, draftArcID, draftSlug, plainArcID, f.plainArcSlug}},
		{`INSERT INTO career.story_npc (id,slug,name_ja,role_ja,company_ja,default_relation,persona_prompt,avatar_media,status)
			VALUES ($1,$2,'田中','先輩','ミライ商事','uchi','SECRET PERSONA PROMPT','{"avatarInitial":"T","avatarTint":"#059669","bioVi":"Senpai thân thiện"}'::jsonb,'active'),
			       ($3,$4,'ミラー','VP',NULL,'soto','SECRET PERSONA PROMPT',NULL,'active'),
			       ($5,$6,'隠れ','非表示',NULL,'uchi',NULL,'{"avatarInitial":"H"}'::jsonb,'draft')`,
			[]any{npcIDs[0], f.npcSlug, npcIDs[1], f.otherNpcSlug, npcIDs[2], f.hiddenNpcSlug}},
		{`INSERT INTO career.mission_chapter (id,arc_id,slug,title_ja,title_vi,is_boss,display_order,briefing_payload,scenario_payload,rewards_payload)
			VALUES ($1,$2,'greeting','挨拶','Chào hỏi',true,3,
			 '{"briefingJa":"朝です","briefingVi":"Buổi sáng","yourRoleVi":"Nhân viên mới","estimatedMinutes":4}'::jsonb,
			 jsonb_build_object('scenarios', jsonb_build_array(jsonb_build_object('id','sc1','scenarioType','chat',
			   'characters', jsonb_build_array(jsonb_build_object('npcSlug',$3::text,'roleInScene','colleague')),
			   'question', jsonb_build_object('id','q1','options', jsonb_build_array(jsonb_build_object('optionKey','A','isCorrect',true,
			     'outcome', jsonb_build_object('affectedNpcSlug',$4::text))))))),
			 '{"rankXp":10}'::jsonb)`, []any{f.chapterID, arcID, f.npcSlug, f.otherNpcSlug}},
		{`INSERT INTO career.mission_chapter (id,arc_id,slug,title_ja,title_vi,display_order) VALUES ($1,$2,'hidden','隠し','Hidden',1)`, []any{f.draftChapterID, draftArcID}},
		{`INSERT INTO career.mission_chapter (id,arc_id,slug,title_ja,title_vi,display_order,briefing_payload) VALUES ($1,$2,'bare','素','Bare',1,'{}'::jsonb)`, []any{newUUID(t), plainArcID}},
	}
	for _, step := range steps {
		if _, err := db.Exec(ctx, step.sql, step.args...); err != nil {
			t.Fatalf("story chapter fixture: %v", err)
		}
	}
	email := "story-" + userID[:8] + "@example.com"
	seedActiveUser(t, db, userID, "Story Learner", email, "")
	raw, err := session.NewStore(db).CreateLearnerSession(ctx, userID, "test-agent", "127.0.0.1", time.Now().Add(time.Hour))
	if err != nil {
		t.Fatalf("create learner session: %v", err)
	}
	f.sessionCookie = &http.Cookie{Name: "bjt_web_session", Value: raw}
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, `DELETE FROM career.mission_arc WHERE id=ANY($1::uuid[])`, []string{arcID, draftArcID, plainArcID})
		_, _ = db.Exec(ctx, `DELETE FROM career.story_npc WHERE id=ANY($1::uuid[])`, npcIDs)
		_, _ = db.Exec(ctx, `DELETE FROM career.career_rank WHERE id=$1`, rankID)
	})
	return f
}

func storyRouter(t *testing.T) http.Handler {
	t.Helper()
	db := testPool(t)
	return NewRouter(Dependencies{
		Config: &config.Config{Port: "4001"}, Logger: testLogger(), DBPool: db,
		SessionStore: session.NewStore(db), CareerStore: career.NewStore(db),
	})
}

func storyGet(router http.Handler, path string, cookie *http.Cookie) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, path, nil)
	if cookie != nil {
		req.AddCookie(cookie)
	}
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)
	return res
}

func TestStoryChapterDetailRoute(t *testing.T) {
	f := insertStoryChapterFixture(t)
	router := storyRouter(t)

	if anon := storyGet(router, "/api/story/chapters/"+f.chapterID, nil); anon.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous chapter read status=%d body=%s; answer keys must require a learner session", anon.Code, anon.Body.String())
	}

	res := storyGet(router, "/api/story/chapters/"+f.chapterID, f.sessionCookie)
	if res.Code != http.StatusOK {
		t.Fatalf("GET chapter status=%d body=%s", res.Code, res.Body.String())
	}
	var body struct {
		Chapter struct {
			ID               string `json:"id"`
			ArcSlug          string `json:"arcSlug"`
			Slug             string `json:"slug"`
			DisplayOrder     int    `json:"displayOrder"`
			TitleJa          string `json:"titleJa"`
			TitleVi          string `json:"titleVi"`
			BriefingJa       string `json:"briefingJa"`
			BriefingVi       string `json:"briefingVi"`
			YourRoleVi       string `json:"yourRoleVi"`
			IsBoss           bool   `json:"isBoss"`
			EstimatedMinutes int    `json:"estimatedMinutes"`
			Scenarios        []struct {
				ID       string `json:"id"`
				Question struct {
					Options []struct {
						OptionKey string `json:"optionKey"`
					} `json:"options"`
				} `json:"question"`
			} `json:"scenarios"`
		} `json:"chapter"`
		Npcs []struct {
			Slug            string  `json:"slug"`
			NameJa          string  `json:"nameJa"`
			RoleJa          string  `json:"roleJa"`
			CompanyJa       *string `json:"companyJa"`
			DefaultRelation string  `json:"defaultRelation"`
			AvatarInitial   string  `json:"avatarInitial"`
			AvatarTint      string  `json:"avatarTint"`
			BioVi           string  `json:"bioVi"`
		} `json:"npcs"`
		RewardsPayload struct {
			RankXP int `json:"rankXp"`
		} `json:"rewardsPayload"`
	}
	if err := json.Unmarshal(res.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode chapter: %v body=%s", err, res.Body.String())
	}
	c := body.Chapter
	if c.ID != f.chapterID || c.ArcSlug != f.arcSlug || c.Slug != "greeting" || c.DisplayOrder != 3 || c.TitleJa != "挨拶" || c.TitleVi != "Chào hỏi" ||
		c.BriefingJa != "朝です" || c.BriefingVi != "Buổi sáng" || c.YourRoleVi != "Nhân viên mới" || !c.IsBoss || c.EstimatedMinutes != 4 {
		t.Fatalf("chapter fields wrong: %+v", c)
	}
	if len(c.Scenarios) != 1 || c.Scenarios[0].ID != "sc1" || len(c.Scenarios[0].Question.Options) != 1 || c.Scenarios[0].Question.Options[0].OptionKey != "A" {
		t.Fatalf("scenarios not served from scenario_payload: %+v", c.Scenarios)
	}

	byslug := map[string]int{}
	for i, n := range body.Npcs {
		byslug[n.Slug] = i
	}
	a, hasA := byslug[f.npcSlug]
	b, hasB := byslug[f.otherNpcSlug]
	if !hasA || !hasB {
		t.Fatalf("every active NPC must be returned so outcome-only NPCs resolve; got %+v", body.Npcs)
	}
	if _, leaked := byslug[f.hiddenNpcSlug]; leaked {
		t.Fatalf("inactive NPC leaked: %+v", body.Npcs)
	}
	na := body.Npcs[a]
	if na.NameJa != "田中" || na.RoleJa != "先輩" || na.CompanyJa == nil || *na.CompanyJa != "ミライ商事" || na.DefaultRelation != "uchi" ||
		na.AvatarInitial != "T" || na.AvatarTint != "#059669" || na.BioVi != "Senpai thân thiện" {
		t.Fatalf("avatar_media must supply avatarInitial/avatarTint/bioVi: %+v", na)
	}
	nb := body.Npcs[b]
	if nb.AvatarInitial != "ミ" || nb.BioVi != "" || nb.CompanyJa != nil || nb.DefaultRelation != "soto" {
		t.Fatalf("NPC without avatar_media must fall back to the name's first character and empty bio: %+v", nb)
	}
	if strings.Contains(res.Body.String(), "SECRET PERSONA PROMPT") || strings.Contains(strings.ToLower(res.Body.String()), "personaprompt") {
		t.Fatalf("persona prompt leaked: %s", res.Body.String())
	}
	if body.RewardsPayload.RankXP != 10 {
		t.Fatalf("rewardsPayload=%+v", body.RewardsPayload)
	}

	upper := storyGet(router, "/api/story/chapters/"+strings.ToUpper(f.chapterID), f.sessionCookie)
	if upper.Code != http.StatusOK {
		t.Fatalf("uppercase canonical UUID status=%d body=%s", upper.Code, upper.Body.String())
	}
	for name, path := range map[string]string{
		"unpublished arc": "/api/story/chapters/" + f.draftChapterID,
		"unknown id":      "/api/story/chapters/" + newUUID(t),
		"not a uuid":      "/api/story/chapters/not-a-uuid",
		"urn form":        "/api/story/chapters/urn:uuid:" + f.chapterID,
		"padded form":     "/api/story/chapters/" + "x" + f.chapterID + "y",
		"braced form":     "/api/story/chapters/%7B" + f.chapterID + "%7D",
		"unhyphenated":    "/api/story/chapters/" + strings.ReplaceAll(f.chapterID, "-", ""),
	} {
		miss := storyGet(router, path, f.sessionCookie)
		if miss.Code != http.StatusNotFound || !strings.Contains(miss.Body.String(), "chapter not found") {
			t.Fatalf("%s: status=%d body=%s; want 404 chapter not found", name, miss.Code, miss.Body.String())
		}
	}
}

func TestStoryCatalogueExposesPayloadFields(t *testing.T) {
	f := insertStoryChapterFixture(t)
	router := audit159Wave11Router(t)

	list := audit159Wave11Get(t, router, "/api/story/arcs")
	var arcs []struct {
		Slug       string   `json:"slug"`
		SynopsisVi string   `json:"synopsisVi"`
		NpcSlugs   []string `json:"npcSlugs"`
		ArtAccent  string   `json:"artAccent"`
	}
	if err := json.Unmarshal(list.Body.Bytes(), &arcs); err != nil {
		t.Fatalf("decode list: %v", err)
	}
	var found, plainFound bool
	for _, arc := range arcs {
		switch arc.Slug {
		case f.arcSlug:
			found = arc.SynopsisVi == "Tóm tắt" && len(arc.NpcSlugs) == 1 && arc.NpcSlugs[0] == "x_npc" && arc.ArtAccent == "#059669"
		case f.plainArcSlug:
			plainFound = arc.SynopsisVi == "" && arc.NpcSlugs != nil && len(arc.NpcSlugs) == 0 && arc.ArtAccent == ""
		}
	}
	if !found {
		t.Fatalf("list lacks synopsisVi/npcSlugs/artAccent for %s: %s", f.arcSlug, list.Body.String())
	}
	if !plainFound {
		t.Fatalf("malformed story_payload must fall back to empty synopsis, [] npcSlugs and empty accent: %s", list.Body.String())
	}

	detail := audit159Wave11Get(t, router, "/api/story/arcs/"+f.arcSlug)
	var d struct {
		Chapters []struct {
			DisplayOrder     int  `json:"displayOrder"`
			IsBoss           bool `json:"isBoss"`
			EstimatedMinutes int  `json:"estimatedMinutes"`
		} `json:"chapters"`
	}
	if err := json.Unmarshal(detail.Body.Bytes(), &d); err != nil || len(d.Chapters) != 1 || d.Chapters[0].DisplayOrder != 3 || !d.Chapters[0].IsBoss || d.Chapters[0].EstimatedMinutes != 4 {
		t.Fatalf("detail chapters lack displayOrder/isBoss/estimatedMinutes: err=%v body=%s", err, detail.Body.String())
	}
	bare := audit159Wave11Get(t, router, "/api/story/arcs/"+f.plainArcSlug)
	var bd struct {
		Chapters []struct {
			EstimatedMinutes int `json:"estimatedMinutes"`
		} `json:"chapters"`
	}
	if err := json.Unmarshal(bare.Body.Bytes(), &bd); err != nil || len(bd.Chapters) != 1 || bd.Chapters[0].EstimatedMinutes != 0 {
		t.Fatalf("chapter without briefing must default estimatedMinutes to 0: err=%v body=%s", err, bare.Body.String())
	}
}
