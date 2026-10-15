package httpserver

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestAdminDailyRadarCardDetailReturnsPersistedCard(t *testing.T) {
	db := testPool(t)
	moduleKey := "audit-card-detail-module-20261007"
	slug := "audit-card-detail-card-20261007"
	var moduleID, cardID string
	if err := db.QueryRow(context.Background(), `INSERT INTO daily.daily_radar_module_config
		(module_key,title_vi,title_ja,description_vi,category,module_type,status,is_enabled,created_at,updated_at)
		VALUES($1,'Detail fixture','監査','Fixture','daily','reading','draft',true,NOW(),NOW()) RETURNING id::text`, moduleKey).Scan(&moduleID); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(context.Background(), `INSERT INTO daily.daily_radar_card
		(module_config_id,slug,title_vi,description_vi,category,module_type,cta_label_vi,status,metadata,created_at,updated_at)
		VALUES($1,$2,'Audit detail title','Audit detail summary','daily','reading','Open','draft','{"body":"Detail body"}'::jsonb,NOW(),NOW()) RETURNING id::text`, moduleID, slug).Scan(&cardID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM daily.daily_radar_card WHERE id=$1`, cardID)
		_, _ = db.Exec(context.Background(), `DELETE FROM daily.daily_radar_module_config WHERE id=$1`, moduleID)
	})

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/admin/daily-radar/cards/"+cardID, nil)
	adminDailyRadarCardDetailHandler(db, testLogger()).ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s; want 200", recorder.Code, recorder.Body.String())
	}
	var result map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	if result["id"] != cardID || result["slug"] != slug || result["title"] != "Audit detail title" || result["summary"] != "Audit detail summary" || result["body"] != "Detail body" || result["status"] != "draft" {
		t.Fatalf("unexpected detail contract: %+v", result)
	}

	missing := httptest.NewRecorder()
	missingRequest := httptest.NewRequest(http.MethodGet, "/api/admin/daily-radar/cards/00000000-0000-4000-8000-000000000000", nil)
	adminDailyRadarCardDetailHandler(db, testLogger()).ServeHTTP(missing, missingRequest)
	if missing.Code != http.StatusNotFound {
		t.Fatalf("missing card status=%d body=%s; want 404", missing.Code, missing.Body.String())
	}
}
