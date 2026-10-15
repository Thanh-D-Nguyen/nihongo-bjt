package httpserver

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestAdminDailyRadarCardsListReturnsTypedFilteredRows(t *testing.T) {
	db := testPool(t)
	moduleKey := "audit-list-module-20261007"
	slug := "audit-list-card-20261007"
	var moduleID, cardID string
	if err := db.QueryRow(context.Background(), `INSERT INTO daily.daily_radar_module_config
		(module_key,title_vi,title_ja,description_vi,category,module_type,status,is_enabled,created_at,updated_at)
		VALUES($1,'Fixture','監査','Fixture','daily','reading','draft',true,NOW(),NOW()) RETURNING id::text`, moduleKey).Scan(&moduleID); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(context.Background(), `INSERT INTO daily.daily_radar_card
		(module_config_id,slug,title_vi,description_vi,category,module_type,cta_label_vi,status,created_at,updated_at)
		VALUES($1,$2,'Audit card title','Fixture description','daily','reading','Open','draft',NOW(),NOW()) RETURNING id::text`, moduleID, slug).Scan(&cardID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM daily.daily_radar_card WHERE id=$1`, cardID)
		_, _ = db.Exec(context.Background(), `DELETE FROM daily.daily_radar_module_config WHERE id=$1`, moduleID)
	})
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/admin/daily-radar/cards?limit=100&q=audit-list-card-20261007&moduleKey="+moduleKey+"&category=daily&status=draft", nil)
	adminDailyRadarCardsListHandler(db, testLogger()).ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s; want 200", recorder.Code, recorder.Body.String())
	}
	var result struct {
		Items    []map[string]any `json:"items"`
		PageSize int              `json:"pageSize"`
		Total    int              `json:"total"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	if result.Total != 1 || len(result.Items) != 1 {
		t.Fatalf("unexpected filtered list count: %+v", result)
	}
	module, _ := result.Items[0]["moduleConfig"].(map[string]any)
	if result.Items[0]["id"] != cardID || result.Items[0]["slug"] != slug || result.Items[0]["titleVi"] != "Audit card title" || module["moduleKey"] != moduleKey {
		t.Fatalf("unexpected filtered list contract: %+v", result)
	}
	if result.PageSize != 100 {
		t.Fatalf("pageSize=%d; limit=100 should be honored", result.PageSize)
	}
}
