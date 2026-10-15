package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"log/slog"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/authz"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/profile"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

func TestAdminFlashcardDeckReadContractsIncludeOwnerAndDescriptions(t *testing.T) {
	db := testPool(t)
	ownerID := newUUID(t)
	deckID := newUUID(t)
	seedActiveUser(t, db, ownerID, "Deck Owner", fmt.Sprintf("deck-owner-%s@example.test", ownerID[:8]), "")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err := db.Exec(ctx, `INSERT INTO learning.deck
		(id, owner_user_id, title_vi, title_ja, description_vi, description_ja, visibility, status, created_at, updated_at)
		VALUES ($1, $2, 'Deck fixture', 'デッキ', 'Mô tả tiếng Việt', '日本語の説明', 'private', 'draft', now(), now())`, deckID, ownerID)
	if err != nil {
		t.Fatalf("insert deck fixture: %v", err)
	}
	t.Cleanup(func() {
		cleanupCtx, cleanupCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cleanupCancel()
		_, _ = db.Exec(cleanupCtx, `DELETE FROM learning.deck WHERE id=$1`, deckID)
	})

	logger := slog.New(slog.NewTextHandler(httptest.NewRecorder(), nil))
	listRequest := httptest.NewRequest(http.MethodGet, "/api/admin/flashcards/decks?page=1&pageSize=50", nil)
	listResponse := httptest.NewRecorder()
	adminFlashcardDecksListHandler(db, logger)(listResponse, listRequest)
	if listResponse.Code != http.StatusOK {
		t.Fatalf("list status = %d, want 200: %s", listResponse.Code, listResponse.Body.String())
	}
	var list struct {
		Items []map[string]any `json:"items"`
	}
	if err := json.Unmarshal(listResponse.Body.Bytes(), &list); err != nil {
		t.Fatalf("decode list response: %v", err)
	}
	var listed map[string]any
	for _, item := range list.Items {
		if item["id"] == deckID {
			listed = item
			break
		}
	}
	if listed == nil || listed["ownerUserId"] != ownerID {
		t.Fatalf("list ownerUserId = %v, want %s", listed["ownerUserId"], ownerID)
	}

	detailRequest := httptest.NewRequest(http.MethodGet, "/api/admin/flashcards/decks/"+deckID, nil)
	detailResponse := httptest.NewRecorder()
	adminFlashcardDeckDetailHandler(db, logger)(detailResponse, detailRequest)
	if detailResponse.Code != http.StatusOK {
		t.Fatalf("detail status = %d, want 200: %s", detailResponse.Code, detailResponse.Body.String())
	}
	var detail map[string]any
	if err := json.Unmarshal(detailResponse.Body.Bytes(), &detail); err != nil {
		t.Fatalf("decode detail response: %v", err)
	}
	if detail["ownerUserId"] != ownerID || detail["descriptionVi"] != "Mô tả tiếng Việt" || detail["descriptionJa"] != "日本語の説明" {
		t.Fatalf("detail owner/descriptions = %v/%v/%v", detail["ownerUserId"], detail["descriptionVi"], detail["descriptionJa"])
	}
}

func TestAdminFlashcardDeckRoutesEnforceContentRBAC(t *testing.T) {
	db := testPool(t)
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, fmt.Sprintf("deck-reader-%s@example.test", actorID[:8]), "Deck Reader")
	grantDeckPermission(t, db, actorID, "admin.content.read")
	deckID := newUUID(t)
	if _, err := db.Exec(context.Background(), `INSERT INTO learning.deck (id,title_vi,status,visibility,created_at,updated_at)
		VALUES ($1,'RBAC disposable deck','draft','private',now(),now())`, deckID); err != nil {
		t.Fatalf("insert disposable deck: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.deck WHERE id=$1`, deckID)
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.deck WHERE title_vi='RBAC generated disposable deck'`)
	})
	store := session.NewStore(db)
	router := NewRouter(Dependencies{
		Config:       &config.Config{CORSOrigins: []string{"http://localhost:18081"}},
		Logger:       slog.New(slog.NewTextHandler(httptest.NewRecorder(), nil)),
		DBPool:       db,
		SessionStore: store,
		ProfileStore: profile.NewStore(db),
		RBACStore:    authz.NewStore(db),
		Version:      "test",
	})
	request := func(method, path, body string) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: createAdminSession(t, store, actorID)})
		req.Header.Set("Origin", "http://localhost:18081")
		if body != "" {
			req.Header.Set("Content-Type", "application/json")
		}
		response := httptest.NewRecorder()
		router.ServeHTTP(response, req)
		return response
	}

	if response := request(http.MethodGet, "/api/admin/flashcards/decks?page=1&pageSize=50", ""); response.Code != http.StatusOK {
		t.Fatalf("read-only list status=%d body=%s; want 200", response.Code, response.Body.String())
	}
	if response := request(http.MethodPost, "/api/admin/flashcards/decks/generate", `{"titleVi":"RBAC generated disposable deck"}`); response.Code != http.StatusForbidden {
		t.Fatalf("read-only generate status=%d body=%s; want 403", response.Code, response.Body.String())
	}
	if response := request(http.MethodPost, "/api/admin/flashcards/decks/"+deckID+"/transition", `{"next":"active","reason":"permission check"}`); response.Code != http.StatusForbidden {
		t.Fatalf("read-only transition status=%d body=%s; want 403", response.Code, response.Body.String())
	}
	var status string
	if err := db.QueryRow(context.Background(), `SELECT status FROM learning.deck WHERE id=$1`, deckID).Scan(&status); err != nil || status != "draft" {
		t.Fatalf("read-only transition persisted status=%q err=%v; want draft", status, err)
	}
	var exists bool
	if err := db.QueryRow(context.Background(), `SELECT EXISTS(SELECT 1 FROM learning.deck WHERE id=$1)`, deckID).Scan(&exists); err != nil || !exists {
		t.Fatalf("fixture deck exists=%v err=%v before detail request", exists, err)
	}
	if response := request(http.MethodGet, "/api/admin/flashcards/decks/"+deckID, ""); response.Code != http.StatusOK {
		t.Fatalf("read-only detail status=%d body=%s; want 200", response.Code, response.Body.String())
	}
}

func TestAdminFlashcardDeckGeneratePersistsCanonicalDeckColumns(t *testing.T) {
	db := testPool(t)
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, fmt.Sprintf("deck-writer-%s@example.test", actorID[:8]), "Deck Writer")
	grantDeckPermission(t, db, actorID, "admin.content.write")
	store := session.NewStore(db)
	router := NewRouter(Dependencies{
		Config:       &config.Config{CORSOrigins: []string{"http://localhost:18081"}},
		Logger:       slog.New(slog.NewTextHandler(httptest.NewRecorder(), nil)),
		DBPool:       db,
		SessionStore: store,
		ProfileStore: profile.NewStore(db),
		RBACStore:    authz.NewStore(db),
		Version:      "test",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/admin/flashcards/decks/generate", strings.NewReader(`{"titleVi":"Generated deck contract","titleJa":"生成デッキ"}`))
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: createAdminSession(t, store, actorID)})
	req.Header.Set("Origin", "http://localhost:18081")
	req.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, req)
	if response.Code != http.StatusCreated {
		t.Fatalf("generate status=%d body=%s; want 201", response.Code, response.Body.String())
	}
	var result struct {
		ID     string `json:"id"`
		Status string `json:"status"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil || result.ID == "" || result.Status != "draft" {
		t.Fatalf("generate response=%s err=%v", response.Body.String(), err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM ops.admin_audit_log WHERE target_type='learning.deck' AND target_id=$1`, result.ID)
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.deck WHERE id=$1`, result.ID)
	})
	var titleVi, titleJa, visibility, status string
	if err := db.QueryRow(context.Background(), `SELECT title_vi,title_ja,visibility,status FROM learning.deck WHERE id=$1`, result.ID).Scan(&titleVi, &titleJa, &visibility, &status); err != nil {
		t.Fatalf("read generated deck: %v", err)
	}
	if titleVi != "Generated deck contract" || titleJa != "生成デッキ" || visibility != "private" || status != "draft" {
		t.Fatalf("generated deck=%q/%q/%q/%q", titleVi, titleJa, visibility, status)
	}
	var auditCount int
	if err := db.QueryRow(context.Background(), `SELECT COUNT(*) FROM ops.admin_audit_log WHERE target_type='learning.deck' AND target_id=$1 AND action='admin.flashcards.deck.generated'`, result.ID).Scan(&auditCount); err != nil || auditCount != 1 {
		t.Fatalf("generated deck audit count=%d err=%v; want one durable audit event", auditCount, err)
	}
}

func TestAdminFlashcardDeckTransitionRollsBackWhenAuditFails(t *testing.T) {
	db := testPool(t)
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, fmt.Sprintf("deck-transition-%s@example.test", actorID[:8]), "Deck Transition")
	grantDeckPermission(t, db, actorID, "admin.content.write")
	deckID := newUUID(t)
	if _, err := db.Exec(context.Background(), `INSERT INTO learning.deck (id,title_vi,status,visibility,created_at,updated_at)
		VALUES ($1,'Transition audit failure fixture','draft','private',now(),now())`, deckID); err != nil {
		t.Fatalf("insert transition fixture: %v", err)
	}
	triggerName := "fail_deck_audit_" + strings.ReplaceAll(deckID, "-", "")
	functionName := triggerName + "_fn"
	if _, err := db.Exec(context.Background(), fmt.Sprintf(`CREATE FUNCTION public.%s() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	IF NEW.target_type='learning.deck' AND NEW.action LIKE 'admin.flashcards.deck.%%' THEN
		RAISE EXCEPTION 'injected deck audit failure';
	END IF;
	RETURN NEW;
END $$`, functionName)); err != nil {
		t.Fatalf("create audit failure trigger function: %v", err)
	}
	if _, err := db.Exec(context.Background(), fmt.Sprintf(`CREATE TRIGGER %s BEFORE INSERT ON ops.admin_audit_log FOR EACH ROW EXECUTE FUNCTION public.%s()`, triggerName, functionName)); err != nil {
		t.Fatalf("create audit failure trigger: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), fmt.Sprintf(`DROP TRIGGER IF EXISTS %s ON ops.admin_audit_log`, triggerName))
		_, _ = db.Exec(context.Background(), fmt.Sprintf(`DROP FUNCTION IF EXISTS public.%s()`, functionName))
		_, _ = db.Exec(context.Background(), `DELETE FROM ops.admin_audit_log WHERE target_type='learning.deck' AND target_id=$1`, deckID)
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.deck WHERE id=$1`, deckID)
	})
	store := session.NewStore(db)
	router := NewRouter(Dependencies{
		Config:       &config.Config{CORSOrigins: []string{"http://localhost:18081"}},
		Logger:       slog.New(slog.NewTextHandler(httptest.NewRecorder(), nil)),
		DBPool:       db,
		SessionStore: store,
		ProfileStore: profile.NewStore(db),
		RBACStore:    authz.NewStore(db),
		Version:      "test",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/admin/flashcards/decks/"+deckID+"/transition", strings.NewReader(`{"next":"archived","reason":"audit failure rollback"}`))
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: createAdminSession(t, store, actorID)})
	req.Header.Set("Origin", "http://localhost:18081")
	req.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, req)
	if response.Code != http.StatusInternalServerError {
		t.Fatalf("transition status=%d body=%s; want 500 when audit persistence fails", response.Code, response.Body.String())
	}
	var status string
	if err := db.QueryRow(context.Background(), `SELECT status FROM learning.deck WHERE id=$1`, deckID).Scan(&status); err != nil || status != "draft" {
		t.Fatalf("deck status after audit failure=%q err=%v; want unchanged draft", status, err)
	}
}

func grantDeckPermission(t *testing.T, db *pgxpool.Pool, actorID, permissionCode string) {
	t.Helper()
	var permissionID string
	if err := db.QueryRow(context.Background(), `SELECT id FROM authz.admin_permission WHERE code=$1`, permissionCode).Scan(&permissionID); err == pgx.ErrNoRows {
		permissionID = newUUID(t)
		if _, err := db.Exec(context.Background(), `INSERT INTO authz.admin_permission (id,code) VALUES ($1,$2)`, permissionID, permissionCode); err != nil {
			t.Fatalf("create deck permission %s: %v", permissionCode, err)
		}
		t.Cleanup(func() {
			_, _ = db.Exec(context.Background(), `DELETE FROM authz.admin_permission WHERE id=$1`, permissionID)
		})
	} else if err != nil {
		t.Fatalf("find permission %s: %v", permissionCode, err)
	}
	roleID := newUUID(t)
	roleCode := "test-deck-" + roleID[:8]
	if _, err := db.Exec(context.Background(), `INSERT INTO authz.admin_role (id,code,name) VALUES ($1,$2,'Deck test role')`, roleID, roleCode); err != nil {
		t.Fatalf("insert deck role: %v", err)
	}
	if _, err := db.Exec(context.Background(), `INSERT INTO authz.admin_role_permission (role_id,permission_id) VALUES ($1,$2)`, roleID, permissionID); err != nil {
		t.Fatalf("grant deck permission: %v", err)
	}
	if _, err := db.Exec(context.Background(), `INSERT INTO authz.admin_actor_role (actor_id,role_id) VALUES ($1,$2)`, actorID, roleID); err != nil {
		t.Fatalf("assign deck role: %v", err)
	}
	t.Cleanup(func() { _, _ = db.Exec(context.Background(), `DELETE FROM authz.admin_role WHERE id=$1`, roleID) })
}
