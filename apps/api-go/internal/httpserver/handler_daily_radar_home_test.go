package httpserver

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
)

func TestDailyRadarHomeReturnsPublishedDatabaseContent(t *testing.T) {
	db := testPool(t)
	moduleID, disabledModuleID := newUUID(t), newUUID(t)
	_, err := db.Exec(context.Background(), `INSERT INTO daily.daily_radar_module_config
		(id,module_key,title_vi,title_ja,description_vi,category,module_type,status,is_enabled,is_spotlight_eligible,default_priority,visual_theme,created_at,updated_at)
		VALUES ($1,'audit_daily_home','Học tiếng Nhật mỗi ngày','毎日の日本語','Nội dung hữu ích','work','content','published',true,true,1,'matcha',NOW(),NOW()),
		($2,'audit_daily_hidden','Ẩn','非表示','Không hiển thị','study','content','published',false,false,2,'sakura',NOW(),NOW())`, moduleID, disabledModuleID)
	if err != nil {
		t.Fatalf("insert Daily Radar modules: %v", err)
	}
	defer db.Exec(context.Background(), `DELETE FROM daily.daily_radar_module_config WHERE id=ANY($1::uuid[])`, []string{moduleID, disabledModuleID})
	_, err = db.Exec(context.Background(), `INSERT INTO daily.daily_radar_card
		(id,module_config_id,slug,title_vi,title_ja,description_vi,category,module_type,cta_label_vi,target_route,target_entity_id,
		 priority,status,is_spotlight,is_pinned,metadata,starts_at,ends_at,created_at,updated_at)
		VALUES
		($1,$2,'audit-daily-home-card','Một câu ở công sở','職場の一言','Câu dùng khi vào văn phòng.','work','content','Học ngay','/vi/daily/sample',NULL,10,'published',true,true,'{"source":"fixture"}',NULL,NULL,NOW(),NOW()),
		($3,$2,'audit-daily-home-draft','Bản nháp',NULL,'Không hiển thị','work','content','Học ngay',NULL,NULL,9,'draft',false,false,'{}',NULL,NULL,NOW(),NOW()),
		($4,$2,'audit-daily-home-future','Nội dung tương lai',NULL,'Chưa bắt đầu','work','content','Học ngay',NULL,NULL,8,'published',false,false,'{}',NOW()+INTERVAL '1 day',NULL,NOW(),NOW()),
		($5,$2,'audit-daily-home-expired','Nội dung hết hạn',NULL,'Đã hết hạn','work','content','Học ngay',NULL,NULL,7,'published',false,false,'{}',NULL,NOW()-INTERVAL '1 day',NOW(),NOW()),
		($6,$7,'audit-daily-hidden-card','Nội dung module tắt',NULL,'Không hiển thị','study','content','Học ngay',NULL,NULL,6,'published',false,false,'{}',NULL,NULL,NOW(),NOW())`,
		newUUID(t), moduleID, newUUID(t), newUUID(t), newUUID(t), newUUID(t), disabledModuleID)
	if err != nil {
		t.Fatalf("insert Daily Radar cards: %v", err)
	}
	router := NewRouter(Dependencies{Config: &config.Config{}, Logger: testLogger(), DBPool: db})
	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/daily-radar/home?locale=vi", nil))
	if response.Code != http.StatusOK {
		t.Fatalf("daily radar home status=%d body=%s", response.Code, response.Body.String())
	}
	var payload struct {
		Modules []struct {
			ModuleKey   string `json:"moduleKey"`
			IsEnabled   bool   `json:"isEnabled"`
			VisualTheme string `json:"visualTheme"`
		} `json:"modules"`
		Cards []struct {
			ID          string `json:"id"`
			IsSpotlight bool   `json:"isSpotlight"`
			IsPinned    bool   `json:"isPinned"`
			Metadata    struct {
				Source string `json:"source"`
			} `json:"metadata"`
			Module struct {
				TitleVi string `json:"titleVi"`
			} `json:"module"`
		} `json:"cards"`
		Categories []string `json:"categories"`
		Spotlight  *struct {
			ID string `json:"id"`
		} `json:"spotlight"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode Daily Radar home: %v body=%s", err, response.Body.String())
	}
	if len(payload.Modules) != 1 || payload.Modules[0].ModuleKey != "audit_daily_home" || !payload.Modules[0].IsEnabled || payload.Modules[0].VisualTheme != "matcha" {
		t.Fatalf("published modules contract: %+v", payload.Modules)
	}
	if len(payload.Cards) != 1 || payload.Cards[0].ID == "" || !payload.Cards[0].IsSpotlight || !payload.Cards[0].IsPinned || payload.Cards[0].Metadata.Source != "fixture" || payload.Cards[0].Module.TitleVi != "Học tiếng Nhật mỗi ngày" {
		t.Fatalf("published cards contract: %+v", payload.Cards)
	}
	if len(payload.Categories) != 1 || payload.Categories[0] != "work" || payload.Spotlight == nil || payload.Spotlight.ID != payload.Cards[0].ID {
		t.Fatalf("categories/spotlight contract: %+v", payload)
	}
}

func TestDailyRadarHomeUnavailableWithoutDatabase(t *testing.T) {
	router := NewRouter(Dependencies{Config: &config.Config{}, Logger: testLogger()})
	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/daily-radar/home?locale=vi", nil))
	if response.Code != http.StatusServiceUnavailable {
		t.Fatalf("daily radar home without database status=%d body=%s", response.Code, response.Body.String())
	}
}
