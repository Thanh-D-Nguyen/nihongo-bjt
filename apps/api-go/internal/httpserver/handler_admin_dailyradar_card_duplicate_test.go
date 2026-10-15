package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

func TestAdminDailyRadarCardDuplicateRequiresContentWrite(t *testing.T) {
	db := testPool(t)
	actorID := newUUID(t)
	seedActiveAdmin(t, db, actorID, "Daily Radar reader", actorID+"@example.com")
	_, cardID := seedDailyRadarCard(t, db, "audit-duplicate-denied")
	server, sessions := adminRBACTestServerWithPool(t, db)
	defer server.Close()

	req := duplicateCardRequest(t, sessions, actorID, cardID, "http://localhost:3000")
	res := httptest.NewRecorder()
	server.Config.Handler.ServeHTTP(res, req)
	if res.Code != http.StatusForbidden {
		t.Fatalf("roleless duplicate status=%d body=%s; want 403", res.Code, res.Body.String())
	}
	var count int
	if err := db.QueryRow(context.Background(), `SELECT count(*) FROM daily.daily_radar_card WHERE module_config_id=(SELECT module_config_id FROM daily.daily_radar_card WHERE id=$1)`, cardID).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatalf("unauthorized duplicate created a card: count=%d; want source only", count)
	}
}

func TestAdminDailyRadarCardDuplicateRequiresTrustedOrigin(t *testing.T) {
	db := testPool(t)
	actorID := newUUID(t)
	seedActiveAdmin(t, db, actorID, "Daily Radar writer", actorID+"@example.com")
	grantAdminPermission(t, db, actorID, "admin.content.write")
	_, cardID := seedDailyRadarCard(t, db, "audit-duplicate-origin")
	server, sessions := adminRBACTestServerWithPool(t, db)
	defer server.Close()

	req := duplicateCardRequest(t, sessions, actorID, cardID, "https://attacker.example")
	res := httptest.NewRecorder()
	server.Config.Handler.ServeHTTP(res, req)
	if res.Code != http.StatusForbidden {
		t.Fatalf("untrusted-origin duplicate status=%d body=%s; want 403", res.Code, res.Body.String())
	}
	var count int
	if err := db.QueryRow(context.Background(), `SELECT count(*) FROM daily.daily_radar_card WHERE module_config_id=(SELECT module_config_id FROM daily.daily_radar_card WHERE id=$1)`, cardID).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatalf("untrusted-origin duplicate created a card: count=%d; want source only", count)
	}
}

func TestAdminDailyRadarCardDuplicatePersistsDraftAndAudit(t *testing.T) {
	db := testPool(t)
	actorID := newUUID(t)
	seedActiveAdmin(t, db, actorID, "Daily Radar writer", actorID+"@example.com")
	grantAdminPermission(t, db, actorID, "admin.content.write")
	moduleID, cardID := seedDailyRadarCard(t, db, "audit-duplicate-success")
	if _, err := db.Exec(context.Background(), `UPDATE daily.daily_radar_card SET
title_vi='Duplicate fixture', recommendation_reason_vi='Recommended', badge_text_vi='New',
estimated_minutes=7, level_label='N3', cta_label_vi='Open source', target_route='/vi/daily/source',
image_url='https://local.test/image.png', icon_key='book', visual_theme='indigo', priority=9,
is_spotlight=true, is_pinned=true, metadata='{"body":"Copy body","keep":true}'::jsonb,
status='published' WHERE id=$1`, cardID); err != nil {
		t.Fatal(err)
	}
	server, sessions := adminRBACTestServerWithPool(t, db)
	defer server.Close()

	req := duplicateCardRequest(t, sessions, actorID, cardID, "http://localhost:3000")
	res := httptest.NewRecorder()
	server.Config.Handler.ServeHTTP(res, req)
	if res.Code != http.StatusCreated {
		t.Fatalf("authorized duplicate status=%d body=%s; want 201", res.Code, res.Body.String())
	}
	var result struct {
		ID             string `json:"id"`
		Status         string `json:"status"`
		DuplicatedFrom string `json:"duplicatedFrom"`
	}
	if err := json.Unmarshal(res.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	if result.ID == "" || result.Status != "draft" || result.DuplicatedFrom != cardID {
		t.Fatalf("unexpected duplicate response: %+v", result)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM ops.admin_audit_log WHERE target_id=$1`, result.ID)
		_, _ = db.Exec(context.Background(), `DELETE FROM daily.daily_radar_card WHERE id=$1`, result.ID)
	})
	var got struct {
		ModuleID, Slug, Title, Description, Recommendation, Category, ModuleType, CTA, Route, Image, Icon, Theme, Status string
		Badge, Level                                                                                                     *string
		Minutes, Priority                                                                                                int
		Spotlight, Pinned                                                                                                bool
		Metadata                                                                                                         []byte
	}
	if err := db.QueryRow(context.Background(), `SELECT module_config_id::text,slug,title_vi,description_vi,
recommendation_reason_vi,category,module_type,cta_label_vi,target_route,image_url,icon_key,visual_theme,status,
badge_text_vi,level_label,estimated_minutes,priority,is_spotlight,is_pinned,metadata
FROM daily.daily_radar_card WHERE id=$1`, result.ID).Scan(&got.ModuleID, &got.Slug, &got.Title, &got.Description,
		&got.Recommendation, &got.Category, &got.ModuleType, &got.CTA, &got.Route, &got.Image, &got.Icon, &got.Theme,
		&got.Status, &got.Badge, &got.Level, &got.Minutes, &got.Priority, &got.Spotlight, &got.Pinned, &got.Metadata); err != nil {
		t.Fatal(err)
	}
	var metadata map[string]any
	if err := json.Unmarshal(got.Metadata, &metadata); err != nil {
		t.Fatal(err)
	}
	if got.ModuleID != moduleID || got.Title != "Duplicate fixture" || got.Description != "Original description" ||
		got.Recommendation != "Recommended" || got.Category != "daily" || got.ModuleType != "reading" ||
		got.CTA != "Open source" || got.Route != "/vi/daily/source" || got.Image != "https://local.test/image.png" ||
		got.Icon != "book" || got.Theme != "indigo" || got.Status != "draft" || got.Badge == nil || *got.Badge != "New" ||
		got.Level == nil || *got.Level != "N3" || got.Minutes != 7 || got.Priority != 9 || got.Spotlight || got.Pinned ||
		metadata["body"] != "Copy body" || metadata["keep"] != true || got.Slug == "" || got.Slug == "audit-duplicate-success-card" {
		t.Fatalf("duplicate did not preserve content/reset publication state: %+v metadata=%v", got, metadata)
	}
	var auditCount int
	if err := db.QueryRow(context.Background(), `SELECT count(*) FROM ops.admin_audit_log WHERE actor_id=$1 AND target_id=$2 AND action='daily_radar.card.duplicated'`, actorID, result.ID).Scan(&auditCount); err != nil {
		t.Fatal(err)
	}
	if auditCount != 1 {
		t.Fatalf("duplicate audit rows=%d; want 1", auditCount)
	}

	missing := httptest.NewRecorder()
	missingReq := duplicateCardRequest(t, sessions, actorID, "00000000-0000-4000-8000-000000000000", "http://localhost:3000")
	server.Config.Handler.ServeHTTP(missing, missingReq)
	if missing.Code != http.StatusNotFound {
		t.Fatalf("missing source duplicate status=%d body=%s; want 404", missing.Code, missing.Body.String())
	}
}

func duplicateCardRequest(t *testing.T, sessions *session.Store, actorID, cardID, origin string) *http.Request {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/admin/daily-radar/cards/%s/duplicate", cardID), nil)
	req.Header.Set("Origin", origin)
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: createAdminSession(t, sessions, actorID)})
	return req
}
