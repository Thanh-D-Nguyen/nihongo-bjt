package httpserver

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
)

func audit159Wave11Router(t *testing.T) http.Handler {
	t.Helper()
	db := testPool(t)
	return NewRouter(Dependencies{
		Config: &config.Config{Port: "4001"},
		Logger: testLogger(),
		DBPool: db,
	})
}

func audit159Wave11Get(t *testing.T, router http.Handler, path string) *httptest.ResponseRecorder {
	t.Helper()
	res := httptest.NewRecorder()
	router.ServeHTTP(res, httptest.NewRequest(http.MethodGet, path, nil))
	return res
}

func TestAudit159Wave11SearchSuggestRouteContract(t *testing.T) {
	db := testPool(t)
	router := audit159Wave11Router(t)
	activeID, inactiveID := newUUID(t), newUUID(t)
	term := "wave11-suggest-" + activeID[:8]
	if _, err := db.Exec(context.Background(), `INSERT INTO content.lexeme
		(id,headword,reading,short_meaning_vi,status,created_at,updated_at)
		VALUES ($1,$3,'うぇーぶ','wave 11 fixture','active',now(),now()),
		       ($2,$3 || '-hidden','ひみつ','inactive fixture','draft',now(),now())`, activeID, inactiveID, term); err != nil {
		t.Fatalf("insert search suggestion fixtures: %v", err)
	}
	t.Cleanup(func() {
		if _, err := db.Exec(context.Background(), `DELETE FROM content.lexeme WHERE id=ANY($1::uuid[])`, []string{activeID, inactiveID}); err != nil {
			t.Errorf("cleanup search suggestion fixtures: %v", err)
		}
	})

	res := audit159Wave11Get(t, router, "/api/search/suggest?q="+term+"&limit=6")
	if res.Code != http.StatusOK {
		t.Fatalf("GET /api/search/suggest status=%d body=%s, want 200", res.Code, res.Body.String())
	}
	var suggestions []struct {
		ID      string  `json:"id"`
		Kind    string  `json:"kind"`
		Reading *string `json:"reading"`
		Title   string  `json:"title"`
	}
	if err := json.Unmarshal(res.Body.Bytes(), &suggestions); err != nil {
		t.Fatalf("response must be a JSON suggestion array: %v body=%s", err, res.Body.String())
	}
	if len(suggestions) != 1 || suggestions[0].ID != activeID || suggestions[0].Kind != "lexeme" || suggestions[0].Title != term || suggestions[0].Reading == nil || *suggestions[0].Reading != "うぇーぶ" {
		t.Fatalf("suggestions=%+v body=%s; want active learner-dropdown suggestion {id,kind,reading,title}", suggestions, res.Body.String())
	}
	if strings.Contains(res.Body.String(), inactiveID) {
		t.Fatalf("inactive content leaked in public suggestions: %s", res.Body.String())
	}
	empty := audit159Wave11Get(t, router, "/api/search/suggest")
	if empty.Code != http.StatusOK || strings.TrimSpace(empty.Body.String()) != "[]" {
		t.Fatalf("empty query status=%d body=%s; want 200 []", empty.Code, empty.Body.String())
	}
}

func TestAudit159Wave11StoryArcsListRoute(t *testing.T) {
	db := testPool(t)
	router := audit159Wave11Router(t)
	rankID, arcID, draftID := newUUID(t), newUUID(t), newUUID(t)
	rankCode := "W11" + rankID[:5]
	if _, err := db.Exec(context.Background(), `INSERT INTO career.career_rank
		(id,rank_code,title_ja,title_vi,bjt_band_target,unlocked_scene_types,display_order,created_at,updated_at)
		VALUES ($1,$2,'波11','Wave 11','J5','[]'::jsonb,900001,now(),now())`, rankID, rankCode); err != nil {
		t.Fatalf("insert story rank fixture: %v", err)
	}
	if _, err := db.Exec(context.Background(), `INSERT INTO career.mission_arc
		(id,slug,title_ja,title_vi,rank_code_entry,story_payload,status,display_order,created_at,updated_at)
		VALUES ($1,$3,'会議','Wave 11 published',$2,'{}'::jsonb,'published',900001,now(),now()),
		       ($4,$3 || '-draft','草稿','Wave 11 draft',$2,'{}'::jsonb,'draft',900002,now(),now())`, arcID, rankCode, "wave11-arcs-"+rankID[:8], draftID); err != nil {
		t.Fatalf("insert story arc fixtures: %v", err)
	}
	t.Cleanup(func() {
		if _, err := db.Exec(context.Background(), `DELETE FROM career.mission_arc WHERE id=ANY($1::uuid[])`, []string{arcID, draftID}); err != nil {
			t.Errorf("cleanup story arc fixtures: %v", err)
		}
		if _, err := db.Exec(context.Background(), `DELETE FROM career.career_rank WHERE id=$1`, rankID); err != nil {
			t.Errorf("cleanup story rank fixture: %v", err)
		}
	})

	res := audit159Wave11Get(t, router, "/api/story/arcs")
	if res.Code != http.StatusOK {
		t.Fatalf("GET /api/story/arcs status=%d body=%s", res.Code, res.Body.String())
	}
	var arcs []struct {
		ID            string `json:"id"`
		Slug          string `json:"slug"`
		TitleJa       string `json:"titleJa"`
		TitleVi       string `json:"titleVi"`
		RankCodeEntry string `json:"rankCodeEntry"`
		Status        string `json:"status"`
		DisplayOrder  int    `json:"displayOrder"`
	}
	if err := json.Unmarshal(res.Body.Bytes(), &arcs); err != nil {
		t.Fatalf("decode arcs: %v body=%s", err, res.Body.String())
	}
	var found bool
	for _, arc := range arcs {
		if arc.ID == arcID {
			found = arc.Slug == "wave11-arcs-"+rankID[:8] && arc.TitleJa == "会議" && arc.TitleVi == "Wave 11 published" && arc.RankCodeEntry == rankCode && arc.Status == "published" && arc.DisplayOrder == 900001
		}
		if arc.ID == draftID {
			t.Fatalf("unpublished arc leaked from public list: %+v", arc)
		}
	}
	if !found {
		t.Fatalf("published fixture %s missing or malformed from response: %s", arcID, res.Body.String())
	}
}

func TestAudit159Wave11StoryArcDetailRoute(t *testing.T) {
	db := testPool(t)
	router := audit159Wave11Router(t)
	rankID, arcID := newUUID(t), newUUID(t)
	rankCode := "W11" + rankID[:5]
	slug := "wave11-detail-" + rankID[:8]
	if _, err := db.Exec(context.Background(), `INSERT INTO career.career_rank
		(id,rank_code,title_ja,title_vi,bjt_band_target,unlocked_scene_types,display_order,created_at,updated_at)
		VALUES ($1,$2,'波11','Wave 11','J5','[]'::jsonb,900003,now(),now())`, rankID, rankCode); err != nil {
		t.Fatalf("insert story rank fixture: %v", err)
	}
	if _, err := db.Exec(context.Background(), `INSERT INTO career.mission_arc
		(id,slug,title_ja,title_vi,rank_code_entry,story_payload,status,display_order,created_at,updated_at)
		VALUES ($1,$2,'会議の物語','A meeting story',$3,'{"theme":"negotiation"}'::jsonb,'published',900003,now(),now())`, arcID, slug, rankCode); err != nil {
		t.Fatalf("insert story arc fixture: %v", err)
	}
	chapterIDs := []string{newUUID(t), newUUID(t)}
	for i, chapter := range []struct{ id, slug, ja, vi string }{
		{chapterIDs[0], "second", "第二章", "Second"},
		{chapterIDs[1], "first", "第一章", "First"},
	} {
		if _, err := db.Exec(context.Background(), `INSERT INTO career.mission_chapter
			(id,arc_id,slug,title_ja,title_vi,display_order) VALUES ($1,$2,$3,$4,$5,$6)`, chapter.id, arcID, chapter.slug, chapter.ja, chapter.vi, i+1); err != nil {
			t.Fatalf("insert story chapter fixture: %v", err)
		}
	}
	t.Cleanup(func() {
		if _, err := db.Exec(context.Background(), `DELETE FROM career.mission_arc WHERE id=$1`, arcID); err != nil {
			t.Errorf("cleanup story arc fixture: %v", err)
		}
		if _, err := db.Exec(context.Background(), `DELETE FROM career.career_rank WHERE id=$1`, rankID); err != nil {
			t.Errorf("cleanup story rank fixture: %v", err)
		}
	})

	res := audit159Wave11Get(t, router, "/api/story/arcs/"+slug)
	if res.Code != http.StatusOK {
		t.Fatalf("GET /api/story/arcs/{slug} status=%d body=%s", res.Code, res.Body.String())
	}
	var detail struct {
		ID            string          `json:"id"`
		Slug          string          `json:"slug"`
		TitleJa       string          `json:"titleJa"`
		TitleVi       string          `json:"titleVi"`
		RankCodeEntry string          `json:"rankCodeEntry"`
		StoryPayload  json.RawMessage `json:"storyPayload"`
		Status        string          `json:"status"`
		Chapters      []struct {
			ID      string `json:"id"`
			Slug    string `json:"slug"`
			TitleJa string `json:"titleJa"`
			TitleVi string `json:"titleVi"`
		} `json:"chapters"`
	}
	if err := json.Unmarshal(res.Body.Bytes(), &detail); err != nil {
		t.Fatalf("decode story detail: %v body=%s", err, res.Body.String())
	}
	if detail.ID != arcID || detail.Slug != slug || detail.TitleJa != "会議の物語" || detail.TitleVi != "A meeting story" || detail.RankCodeEntry != rankCode || detail.Status != "published" || string(detail.StoryPayload) != `{"theme":"negotiation"}` || len(detail.Chapters) != 2 {
		t.Fatalf("story detail=%+v body=%s", detail, res.Body.String())
	}
	if detail.Chapters[0].ID != chapterIDs[0] || detail.Chapters[1].ID != chapterIDs[1] || detail.Chapters[0].Slug != "second" || detail.Chapters[1].Slug != "first" {
		t.Fatalf("chapter order/content=%+v", detail.Chapters)
	}
	missing := audit159Wave11Get(t, router, "/api/story/arcs/does-not-exist-wave11")
	if missing.Code != http.StatusNotFound || !strings.Contains(missing.Body.String(), "arc not found") {
		t.Fatalf("missing arc status=%d body=%s, want 404 arc not found", missing.Code, missing.Body.String())
	}
	trailing := audit159Wave11Get(t, router, "/api/story/arcs/")
	if trailing.Code != http.StatusNotFound {
		t.Fatalf("empty slug route status=%d body=%s; want router 404", trailing.Code, trailing.Body.String())
	}
}
