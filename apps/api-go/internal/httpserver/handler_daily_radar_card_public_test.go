package httpserver

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
)

func TestPublicDailyRadarCardListAndDetailReturnPublishedAt(t *testing.T) {
	db := testPool(t)
	moduleID, cardID := newUUID(t), newUUID(t)
	moduleKey := "audit-radar-detail-" + newUUID(t)
	slug := "audit-radar-card-" + newUUID(t)
	createdAt := time.Date(2026, 10, 1, 12, 0, 0, 0, time.UTC)
	if _, err := db.Exec(context.Background(), `INSERT INTO daily.daily_radar_module_config
		(id,module_key,title_vi,title_ja,description_vi,category,module_type,status,is_enabled,disclaimer_vi,created_at,updated_at)
		VALUES ($1,$2,'Radar fixture','レーダーの検証','Fixture','daily','reading','published',true,'Read the source carefully.',$3,$3)`,
		moduleID, moduleKey, createdAt); err != nil {
		t.Fatalf("insert radar module: %v", err)
	}
	t.Cleanup(func() {
		if _, err := db.Exec(context.Background(), `DELETE FROM daily.daily_radar_card WHERE id=$1`, cardID); err != nil {
			t.Errorf("delete radar fixture card: %v", err)
		}
		if _, err := db.Exec(context.Background(), `DELETE FROM daily.daily_radar_module_config WHERE id=$1`, moduleID); err != nil {
			t.Errorf("delete radar fixture module: %v", err)
		}
	})
	if _, err := db.Exec(context.Background(), `INSERT INTO daily.daily_radar_card
		(id,module_config_id,slug,title_vi,title_ja,description_vi,recommendation_reason_vi,category,module_type,badge_text_vi,
		 estimated_minutes,level_label,cta_label_vi,target_route,visual_theme,status,metadata,created_at,updated_at)
		VALUES ($1,$2,$3,'Đọc phiếu giảm giá','クーポンを読む','Điều kiện áp dụng','Nắm điều kiện sử dụng.','daily','reading','Từ vựng',
		 8,'N3','Đọc ngay','/vi/radar/coupon-terms','matcha','published','{"body":"Đọc kỹ điều kiện.","japaneseExpressions":[]}'::jsonb,$4,$4)`,
		cardID, moduleID, slug, createdAt); err != nil {
		t.Fatalf("insert radar card: %v", err)
	}
	router := NewRouter(Dependencies{Config: &config.Config{}, Logger: testLogger(), DBPool: db})

	t.Run("published list", func(t *testing.T) {
		response := httptest.NewRecorder()
		request := httptest.NewRequest(http.MethodGet, "/api/daily-radar/cards?moduleKey="+moduleKey, nil)
		router.ServeHTTP(response, request)
		if response.Code != http.StatusOK {
			t.Fatalf("list status=%d body=%s; want 200", response.Code, response.Body.String())
		}
		var cards []struct {
			Slug          string `json:"slug"`
			TitleVi       string `json:"titleVi"`
			DescriptionVi string `json:"descriptionVi"`
			CTALabelVi    string `json:"ctaLabelVi"`
			Module        struct {
				ModuleKey string `json:"moduleKey"`
			} `json:"module"`
			PublishedAt string `json:"publishedAt"`
		}
		if err := json.Unmarshal(response.Body.Bytes(), &cards); err != nil {
			t.Fatal(err)
		}
		if len(cards) != 1 || cards[0].Slug != slug || cards[0].TitleVi != "Đọc phiếu giảm giá" ||
			cards[0].DescriptionVi != "Điều kiện áp dụng" || cards[0].CTALabelVi != "Đọc ngay" ||
			cards[0].Module.ModuleKey != moduleKey || cards[0].PublishedAt == "" {
			t.Fatalf("unexpected list payload: %+v", cards)
		}
		if got, err := time.Parse(time.RFC3339Nano, cards[0].PublishedAt); err != nil || !got.Equal(createdAt) {
			t.Fatalf("publishedAt=%q, err=%v; want %s", cards[0].PublishedAt, err, createdAt.Format(time.RFC3339Nano))
		}
	})

	t.Run("detail by slug", func(t *testing.T) {
		response := httptest.NewRecorder()
		router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/daily-radar/cards/"+slug, nil))
		if response.Code != http.StatusOK {
			t.Fatalf("detail status=%d body=%s; want 200", response.Code, response.Body.String())
		}
		var card struct {
			ID                     string          `json:"id"`
			Slug                   string          `json:"slug"`
			TitleVi                string          `json:"titleVi"`
			TitleJa                string          `json:"titleJa"`
			DescriptionVi          string          `json:"descriptionVi"`
			RecommendationReasonVi string          `json:"recommendationReasonVi"`
			CTALabelVi             string          `json:"ctaLabelVi"`
			Metadata               json.RawMessage `json:"metadata"`
			Module                 struct {
				ModuleKey    string `json:"moduleKey"`
				TitleVi      string `json:"titleVi"`
				TitleJa      string `json:"titleJa"`
				DisclaimerVi string `json:"disclaimerVi"`
			} `json:"module"`
			PublishedAt string `json:"publishedAt"`
		}
		if err := json.Unmarshal(response.Body.Bytes(), &card); err != nil {
			t.Fatal(err)
		}
		if card.ID != cardID || card.Slug != slug || card.TitleVi != "Đọc phiếu giảm giá" ||
			card.TitleJa != "クーポンを読む" || card.DescriptionVi != "Điều kiện áp dụng" ||
			card.RecommendationReasonVi != "Nắm điều kiện sử dụng." || card.CTALabelVi != "Đọc ngay" ||
			card.Module.ModuleKey != moduleKey || card.Module.TitleVi != "Radar fixture" ||
			card.Module.TitleJa != "レーダーの検証" || card.Module.DisclaimerVi != "Read the source carefully." ||
			card.PublishedAt == "" || !json.Valid(card.Metadata) {
			t.Fatalf("unexpected detail payload: %+v", card)
		}
		if got, err := time.Parse(time.RFC3339Nano, card.PublishedAt); err != nil || !got.Equal(createdAt) {
			t.Fatalf("publishedAt=%q, err=%v; want %s", card.PublishedAt, err, createdAt.Format(time.RFC3339Nano))
		}
	})
}

func TestPublicDailyRadarCardListHonorsLimit(t *testing.T) {
	db := testPool(t)
	moduleID := newUUID(t)
	fixtureKey := newUUID(t)[:8]
	moduleKey := "radar-limit-" + fixtureKey
	category := "limit-" + fixtureKey
	if _, err := db.Exec(context.Background(), `INSERT INTO daily.daily_radar_module_config
		(id,module_key,title_vi,title_ja,description_vi,category,module_type,status,is_enabled,created_at,updated_at)
		VALUES ($1,$2,'Radar fixture','レーダーの検証','Fixture','daily','reading','published',true,NOW(),NOW())`,
		moduleID, moduleKey); err != nil {
		t.Fatalf("insert radar module: %v", err)
	}
	if _, err := db.Exec(context.Background(), `INSERT INTO daily.daily_radar_card
		(module_config_id,slug,title_vi,description_vi,category,module_type,cta_label_vi,status,created_at,updated_at)
		SELECT $1,'limit-' || $2 || '-' || n,'Radar card','Fixture',$3,'reading','Open','published',NOW(),NOW()
		FROM generate_series(1,3) AS n`, moduleID, fixtureKey, category); err != nil {
		t.Fatalf("insert radar cards: %v", err)
	}
	t.Cleanup(func() {
		if _, err := db.Exec(context.Background(), `DELETE FROM daily.daily_radar_card WHERE module_config_id=$1`, moduleID); err != nil {
			t.Errorf("delete radar fixture cards: %v", err)
		}
		if _, err := db.Exec(context.Background(), `DELETE FROM daily.daily_radar_module_config WHERE id=$1`, moduleID); err != nil {
			t.Errorf("delete radar fixture module: %v", err)
		}
	})
	router := NewRouter(Dependencies{Config: &config.Config{}, Logger: testLogger(), DBPool: db})

	for _, test := range []struct {
		name  string
		query string
		want  int
	}{
		{name: "unfiltered", query: "limit=2", want: 2},
		{name: "module", query: "moduleKey=" + moduleKey + "&limit=2", want: 2},
		{name: "category", query: "category=" + category + "&limit=2", want: 2},
		{name: "malformed falls back", query: "moduleKey=" + moduleKey + "&limit=2bad", want: 3},
		{name: "nonpositive falls back", query: "moduleKey=" + moduleKey + "&limit=0", want: 3},
		{name: "negative falls back", query: "moduleKey=" + moduleKey + "&limit=-1", want: 3},
		{name: "above maximum falls back", query: "moduleKey=" + moduleKey + "&limit=101", want: 3},
	} {
		t.Run(test.name, func(t *testing.T) {
			response := httptest.NewRecorder()
			router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/daily-radar/cards?"+test.query, nil))
			if response.Code != http.StatusOK {
				t.Fatalf("status=%d body=%s; want 200", response.Code, response.Body.String())
			}
			var cards []publicDailyRadarCard
			if err := json.Unmarshal(response.Body.Bytes(), &cards); err != nil {
				t.Fatal(err)
			}
			if len(cards) != test.want {
				t.Fatalf("got %d cards; want %d", len(cards), test.want)
			}
		})
	}
}
