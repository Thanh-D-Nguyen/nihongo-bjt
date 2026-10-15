package httpserver

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
)

func TestGetAnnouncementsReturnsPublishedAnnouncements(t *testing.T) {
	db := testPool(t)
	ids := []string{newUUID(t), newUUID(t), newUUID(t), newUUID(t)}
	_, err := db.Exec(context.Background(), `
		INSERT INTO content.announcement (id, type, message, active, format, target, priority, sort_order, starts_at, ends_at, updated_at)
		VALUES
			($1, 'info', 'Visible announcement', TRUE, 'banner', 'all', 8, 2, NOW() - INTERVAL '1 day', NOW() + INTERVAL '1 day', NOW()),
			($2, 'event', 'Inactive announcement', FALSE, 'banner', 'all', 10, 1, NULL, NULL, NOW()),
			($3, 'promo', 'Future announcement', TRUE, 'modal', 'all', 10, 1, NOW() + INTERVAL '1 day', NULL, NOW()),
			($4, 'info', 'Expired announcement', TRUE, 'banner', 'all', 10, 1, NULL, NOW() - INTERVAL '1 day', NOW())`, ids[0], ids[1], ids[2], ids[3])
	if err != nil {
		t.Fatalf("seed announcements: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM content.announcement WHERE id = ANY($1::uuid[])`, ids)
	})

	router := NewRouter(Dependencies{Config: &config.Config{}, Logger: testLogger(), DBPool: db})
	w := httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/announcements", nil))
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200: %s", w.Code, w.Body.String())
	}
	var got []map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("got %d announcements, want 1: %s", len(got), w.Body.String())
	}
	if got[0]["id"] != ids[0] || got[0]["message"] != "Visible announcement" || got[0]["format"] != "banner" {
		t.Fatalf("response does not match learner announcement contract: %#v", got[0])
	}
	if _, ok := got[0]["titleVi"]; !ok {
		t.Fatalf("response omitted titleVi contract field: %#v", got[0])
	}
}
