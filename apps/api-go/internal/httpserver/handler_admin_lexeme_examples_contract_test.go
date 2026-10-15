package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

func TestAdminLexemeExampleCreateUsesCanonicalSchemaAndAppearsInList(t *testing.T) {
	db := testPool(t)
	srv, _, actorID, token, lexemeID, headword := adminLexemeExamplesFixture(t, db)
	defer srv.Close()
	japanese := "監査用の例文です。" + newUUID(t)
	body := fmt.Sprintf(`{"japaneseText":%q,"reading":"かんさよう","translationVi":"câu kiểm thử","reason":"admin dictionary fixture"}`, japanese)
	req := adminLexemeExampleRequest(t, http.MethodPost, "/api/admin/lexemes/"+lexemeID+"/examples", body, token)
	res := httptest.NewRecorder()
	srv.Config.Handler.ServeHTTP(res, req)
	if res.Code != http.StatusCreated {
		t.Fatalf("create status=%d body=%s; want 201", res.Code, res.Body.String())
	}
	var created struct {
		ID                string `json:"id"`
		ExampleSentenceID string `json:"exampleSentenceId"`
	}
	if err := json.Unmarshal(res.Body.Bytes(), &created); err != nil || created.ID == "" || created.ExampleSentenceID == "" {
		t.Fatalf("invalid create response %s err=%v", res.Body.String(), err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM content.lexeme WHERE id=$1`, lexemeID)
		_, _ = db.Exec(context.Background(), `DELETE FROM content.example_sentence WHERE id=$1`, created.ExampleSentenceID)
	})
	var storedJapanese, storedReading, storedTranslation string
	if err := db.QueryRow(context.Background(), `SELECT es.japanese_text, es.reading, es.translation_vi
		FROM content.lexeme_sense_example lse JOIN content.example_sentence es ON es.id=lse.example_sentence_id
		JOIN content.lexeme_sense ls ON ls.id=lse.sense_id WHERE lse.id=$1 AND ls.lexeme_id=$2`, created.ID, lexemeID).
		Scan(&storedJapanese, &storedReading, &storedTranslation); err != nil || storedJapanese != japanese || storedReading != "かんさよう" || storedTranslation != "câu kiểm thử" {
		t.Fatalf("created example values=%q/%q/%q err=%v", storedJapanese, storedReading, storedTranslation, err)
	}
	assertAdminAuditEvent(t, db, actorID, "admin.content.example.created", "content.lexeme_example", created.ID)
	list := httptest.NewRecorder()
	adminContentListHandler(db, testLogger()).ServeHTTP(list, httptest.NewRequest(http.MethodGet, "/api/admin/content?type=lexeme&q="+headword+"&page=1&pageSize=10", nil))
	if list.Code != http.StatusOK {
		t.Fatalf("list status=%d body=%s; want 200", list.Code, list.Body.String())
	}
	var page struct {
		Items []struct {
			LexemeExamples []map[string]any `json:"lexemeExamples"`
		} `json:"items"`
	}
	if err := json.Unmarshal(list.Body.Bytes(), &page); err != nil || len(page.Items) != 1 || len(page.Items[0].LexemeExamples) != 1 {
		t.Fatalf("list omitted saved example: body=%s err=%v", list.Body.String(), err)
	}
}

func TestAdminLexemeExamplePatchUpdatesCanonicalSentenceAndAudit(t *testing.T) {
	db := testPool(t)
	srv, _, actorID, token, lexemeID, _ := adminLexemeExamplesFixture(t, db)
	defer srv.Close()
	senseID, linkID, sentenceID := seedAdminLexemeExample(t, db, lexemeID)
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM content.lexeme WHERE id=$1`, lexemeID)
		_, _ = db.Exec(context.Background(), `DELETE FROM content.example_sentence WHERE id=$1`, sentenceID)
	})
	body := `{"japaneseText":"変更後の例文","reading":"へんこうご","translationVi":"câu đã sửa","reason":"admin example edit"}`
	req := adminLexemeExampleRequest(t, http.MethodPatch, "/api/admin/lexemes/"+lexemeID+"/examples/"+linkID, body, token)
	res := httptest.NewRecorder()
	srv.Config.Handler.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("patch status=%d body=%s; want 200", res.Code, res.Body.String())
	}
	var japanese, reading, translation string
	if err := db.QueryRow(context.Background(), `SELECT es.japanese_text, es.reading, es.translation_vi
		FROM content.example_sentence es JOIN content.lexeme_sense_example lse ON lse.example_sentence_id=es.id
		JOIN content.lexeme_sense ls ON ls.id=lse.sense_id WHERE lse.id=$1 AND ls.id=$2`, linkID, senseID).
		Scan(&japanese, &reading, &translation); err != nil || japanese != "変更後の例文" || reading != "へんこうご" || translation != "câu đã sửa" {
		t.Fatalf("patched example=%q/%q/%q err=%v", japanese, reading, translation, err)
	}
	assertAdminAuditEvent(t, db, actorID, "admin.content.example.updated", "content.lexeme_example", linkID)
}

func TestAdminLexemeExampleDeleteRemovesLinkAndAuditsAtomically(t *testing.T) {
	db := testPool(t)
	srv, _, actorID, token, lexemeID, _ := adminLexemeExamplesFixture(t, db)
	defer srv.Close()
	_, linkID, sentenceID := seedAdminLexemeExample(t, db, lexemeID)
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM content.lexeme WHERE id=$1`, lexemeID)
		_, _ = db.Exec(context.Background(), `DELETE FROM content.example_sentence WHERE id=$1`, sentenceID)
	})
	req := adminLexemeExampleRequest(t, http.MethodDelete, "/api/admin/lexemes/"+lexemeID+"/examples/"+linkID, `{"reason":"remove admin example"}`, token)
	res := httptest.NewRecorder()
	srv.Config.Handler.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("delete status=%d body=%s; want 200", res.Code, res.Body.String())
	}
	var links int
	if err := db.QueryRow(context.Background(), `SELECT COUNT(*) FROM content.lexeme_sense_example WHERE id=$1`, linkID).Scan(&links); err != nil || links != 0 {
		t.Fatalf("link count=%d err=%v; want 0", links, err)
	}
	assertAdminAuditEvent(t, db, actorID, "admin.content.example.deleted", "content.lexeme_example", linkID)
}

func adminLexemeExamplesFixture(t *testing.T, db *pgxpool.Pool) (*httptest.Server, *session.Store, string, string, string, string) {
	t.Helper()
	srv, sessions := adminRBACTestServerWithPool(t, db)
	actorID := newUUID(t)
	seedAdminActor(t, db, actorID, actorID+"@lexeme-example.example.com", "Lexeme Example Admin")
	grantAdminPermission(t, db, actorID, "admin.content.write")
	token := createAdminSession(t, sessions, actorID)
	lexemeID := newUUID(t)
	headword := "AUDIT-EXAMPLE-" + lexemeID
	if _, err := db.Exec(context.Background(), `INSERT INTO content.lexeme
		(id,headword,short_meaning_vi,status,created_at,updated_at) VALUES ($1,$2,'meaning fixture','needs_review',NOW(),NOW())`, lexemeID, headword); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = db.Exec(context.Background(), `DELETE FROM content.lexeme WHERE id=$1`, lexemeID) })
	return srv, sessions, actorID, token, lexemeID, headword
}

func adminLexemeExampleRequest(t *testing.T, method, path, body, token string) *http.Request {
	t.Helper()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("X-CSRF-Token", "test-csrf")
	req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
	return req
}

func seedAdminLexemeExample(t *testing.T, db *pgxpool.Pool, lexemeID string) (string, string, string) {
	t.Helper()
	var senseID, sentenceID, linkID string
	if err := db.QueryRow(context.Background(), `INSERT INTO content.lexeme_sense (lexeme_id,position,meaning_vi)
		VALUES ($1,1,'meaning fixture') RETURNING id::text`, lexemeID).Scan(&senseID); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(context.Background(), `INSERT INTO content.example_sentence (japanese_text,reading,translation_vi,status,updated_at)
		VALUES ('既存の例文','きそん','existing example','active',NOW()) RETURNING id::text`).Scan(&sentenceID); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(context.Background(), `INSERT INTO content.lexeme_sense_example (sense_id,example_sentence_id,source_example_key)
		VALUES ($1,$2,$3) RETURNING id::text`, senseID, sentenceID, "admin:"+sentenceID).Scan(&linkID); err != nil {
		t.Fatal(err)
	}
	return senseID, linkID, sentenceID
}
