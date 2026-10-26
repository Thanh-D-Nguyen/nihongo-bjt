package httpserver

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/search"
)

func TestBUG264SearchDeduplicatesContentIdentity(t *testing.T) {
	db := testPool(t)
	ctx := context.Background()
	ids := []string{newUUID(t), newUUID(t), newUUID(t), newUUID(t)}
	for _, id := range ids {
		if _, err := db.Exec(ctx, `INSERT INTO content.lexeme (id,headword,status,updated_at) VALUES ($1,'ありがとう大統領閣下','active',NOW())`, id); err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { _, _ = db.Exec(ctx, `DELETE FROM content.lexeme WHERE id=$1`, id) })
	}
	reading, otherReading := "ありがとうだいとうりょうかっか", "べつのよみ"
	badGloss := "Sorry; I cannot provide a translation for this term."
	results := []search.SearchResult{
		{ID: ids[0], Kind: "lexeme", Title: "ありがとう大統領閣下", Reading: &reading},
		{ID: ids[1], Kind: "lexeme", Title: " ありがとう大統領閣下 ", Reading: &reading},
		{ID: ids[2], Kind: "lexeme", Title: "ありがとう大統領閣下", Reading: &otherReading},
		{ID: ids[3], Kind: "lexeme", Title: "invalid gloss", Description: &badGloss},
	}
	if err := enrichSearchResultLevels(ctx, db, &results); err != nil {
		t.Fatal(err)
	}
	if len(results) != 2 || results[0].ID != ids[0] || results[1].ID != ids[2] {
		t.Fatalf("search content duplicates or invalid gloss remain: %+v", results)
	}
}

func TestBUG264DailyRadarDeduplicatesContentIdentity(t *testing.T) {
	db := testPool(t)
	ctx := context.Background()
	moduleID, originalID := seedDailyRadarCard(t, db, "bug264")
	title := "催促メールが来た — " + newUUID(t)
	if _, err := db.Exec(ctx, `UPDATE daily.daily_radar_module_config SET status='published' WHERE id=$1`, moduleID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `UPDATE daily.daily_radar_card SET title_vi=$2,status='published',priority=100,is_spotlight=true,target_route='/vi/story/arcs' WHERE id=$1`, originalID, title); err != nil {
		t.Fatal(err)
	}
	// A separately imported copy has a different ID and slug; navigation alone is not identity.
	for i := 0; i < 2; i++ {
		id := newUUID(t)
		nextTitle := title
		if i == 1 {
			nextTitle = "別の内容 — " + title
		}
		if _, err := db.Exec(ctx, `INSERT INTO daily.daily_radar_card
   (id,module_config_id,slug,title_vi,description_vi,category,module_type,cta_label_vi,status,priority,target_route,updated_at)
   VALUES ($1,$2,$4,$3,'Original description','daily','reading','Open','published',10,'/vi/story/arcs',NOW())`, id, moduleID, nextTitle, id); err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { _, _ = db.Exec(ctx, `DELETE FROM daily.daily_radar_card WHERE id=$1`, id) })
	}
	for _, route := range []string{"home?locale=vi", "cards?limit=100"} {
		t.Run(route, func(t *testing.T) {
			response := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodGet, "/api/daily-radar/"+route, nil)
			if route == "home?locale=vi" {
				dailyRadarHomeHandler(db, testLogger()).ServeHTTP(response, request)
			} else {
				listDailyRadarCardsHandler(db, testLogger()).ServeHTTP(response, request)
			}
			if response.Code != http.StatusOK {
				t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
			}
			var cards []struct {
				ID    string `json:"id"`
				Title string `json:"titleVi"`
			}
			if route == "home?locale=vi" {
				var payload struct {
					Cards json.RawMessage `json:"cards"`
				}
				if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
					t.Fatal(err)
				}
				if err := json.Unmarshal(payload.Cards, &cards); err != nil {
					t.Fatal(err)
				}
			} else if err := json.Unmarshal(response.Body.Bytes(), &cards); err != nil {
				t.Fatal(err)
			}
			count, distinct := 0, false
			for _, c := range cards {
				if c.Title == title {
					count++
					if c.ID != originalID {
						t.Errorf("lost highest-ranked representative: %+v", c)
					}
				}
				if c.Title == "別の内容 — "+title {
					distinct = true
				}
			}
			if count != 1 || !distinct {
				t.Fatalf("daily radar content duplicates remain or distinct card lost: copies=%d distinct=%v", count, distinct)
			}
		})
	}
}
