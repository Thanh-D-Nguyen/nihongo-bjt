package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestAdminFlashcardVariantFiveAPIContracts(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()

	readWriteActor, readOnlyActor, rolelessActor := newUUID(t), newUUID(t), newUUID(t)
	seedAdminActor(t, db, readWriteActor, readWriteActor+"@variants.example.test", "Variant Editor")
	seedAdminActor(t, db, readOnlyActor, readOnlyActor+"@variants.example.test", "Variant Reader")
	seedAdminActor(t, db, rolelessActor, rolelessActor+"@variants.example.test", "Variant Roleless")
	readWriteToken := createAdminSession(t, sessions, readWriteActor)
	readOnlyToken := createAdminSession(t, sessions, readOnlyActor)
	rolelessToken := createAdminSession(t, sessions, rolelessActor)
	grantAdminPermission(t, db, readWriteActor, "admin.content.read")
	grantAdminPermission(t, db, readWriteActor, "admin.content.write")
	grantAdminPermission(t, db, readOnlyActor, "admin.content.read")

	lexemeID, grammarID, variantID := newUUID(t), newUUID(t), newUUID(t)
	if _, err := db.Exec(context.Background(), `INSERT INTO content.lexeme (id,headword,reading,jlpt_level,short_meaning_vi,status,created_at,updated_at)
		VALUES ($1,'variants fixture','へんこう','N5','fixture','active',NOW(),NOW())`, lexemeID); err != nil {
		t.Fatalf("seed lexeme: %v", err)
	}
	if _, err := db.Exec(context.Background(), `INSERT INTO content.grammar_point (id,pattern,meaning_vi,jlpt_level,status,created_at,updated_at)
		VALUES ($1,'〜 variants','fixture','N5','active',NOW(),NOW())`, grammarID); err != nil {
		t.Fatalf("seed grammar: %v", err)
	}
	if _, err := db.Exec(context.Background(), `INSERT INTO learning.flashcard_variant
		(id,source_type,source_id,front_text,back_text,reading,status,created_at,updated_at)
		VALUES ($1,'lexeme',$2,'before front','before back','before reading','draft',NOW(),NOW())`, variantID, lexemeID); err != nil {
		t.Fatalf("seed variant: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.flashcard_variant WHERE id=$1`, variantID)
		_, _ = db.Exec(context.Background(), `DELETE FROM content.lexeme WHERE id=$1`, lexemeID)
		_, _ = db.Exec(context.Background(), `DELETE FROM content.grammar_point WHERE id=$1`, grammarID)
	})

	do := func(method, path, body, token string, origin bool) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		if token != "" {
			req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		}
		if origin {
			req.Header.Set("Origin", "http://localhost:3000")
		}
		res := httptest.NewRecorder()
		srv.Config.Handler.ServeHTTP(res, req)
		return res
	}

	t.Run("GET /api/admin/flashcards/variants", func(t *testing.T) {
		if got := do(http.MethodGet, "/api/admin/flashcards/variants", "", "", false).Code; got != http.StatusUnauthorized {
			t.Fatalf("anonymous list status=%d; want 401", got)
		}
		roleless := do(http.MethodGet, "/api/admin/flashcards/variants", "", rolelessToken, false)
		if roleless.Code != http.StatusForbidden {
			t.Fatalf("roleless list status=%d; want 403", roleless.Code)
		}
		res := do(http.MethodGet, "/api/admin/flashcards/variants?q=before&status=draft&sourceType=lexeme&page=1&pageSize=10", "", readOnlyToken, false)
		var page struct {
			Items []struct {
				ID         string `json:"id"`
				SourceType string `json:"sourceType"`
				SourceID   string `json:"sourceId"`
				FrontText  string `json:"frontText"`
				BackText   string `json:"backText"`
				Status     string `json:"status"`
			} `json:"items"`
			Total    int `json:"total"`
			Page     int `json:"page"`
			PageSize int `json:"pageSize"`
		}
		if res.Code != http.StatusOK || json.Unmarshal(res.Body.Bytes(), &page) != nil || page.Total != 1 || page.Page != 1 || page.PageSize != 10 || len(page.Items) != 1 || page.Items[0].ID != variantID || page.Items[0].SourceType != "lexeme" || page.Items[0].SourceID != lexemeID || page.Items[0].FrontText != "before front" || page.Items[0].BackText != "before back" || page.Items[0].Status != "draft" {
			t.Fatalf("list status=%d body=%s", res.Code, res.Body.String())
		}
	})

	t.Run("GET /api/admin/flashcards/variants/{id}", func(t *testing.T) {
		if got := do(http.MethodGet, "/api/admin/flashcards/variants/not-a-uuid", "", readOnlyToken, false).Code; got != http.StatusBadRequest {
			t.Fatalf("invalid detail ID status=%d; want 400", got)
		}
		roleless := do(http.MethodGet, "/api/admin/flashcards/variants/"+variantID, "", rolelessToken, false)
		if roleless.Code != http.StatusForbidden {
			t.Fatalf("roleless detail status=%d; want 403", roleless.Code)
		}
		res := do(http.MethodGet, "/api/admin/flashcards/variants/"+variantID, "", readOnlyToken, false)
		var detail map[string]json.RawMessage
		if res.Code != http.StatusOK || json.Unmarshal(res.Body.Bytes(), &detail) != nil {
			t.Fatalf("detail status=%d body=%s", res.Code, res.Body.String())
		}
		for _, key := range []string{"audit", "canonical", "canonicalCandidates", "examples", "lexemeExamples"} {
			if _, ok := detail[key]; !ok {
				t.Fatalf("detail omitted %q: %s", key, res.Body.String())
			}
		}
		missing := do(http.MethodGet, "/api/admin/flashcards/variants/"+newUUID(t), "", readOnlyToken, false)
		if missing.Code != http.StatusNotFound {
			t.Fatalf("missing detail status=%d; want 404", missing.Code)
		}
	})

	t.Run("PATCH /api/admin/flashcards/variants/{id}", func(t *testing.T) {
		path := "/api/admin/flashcards/variants/" + variantID
		missingPath := "/api/admin/flashcards/variants/" + newUUID(t)
		if got := do(http.MethodPatch, missingPath, `{"frontText":"updated front","reason":"valid update"}`, readWriteToken, true).Code; got != http.StatusNotFound {
			t.Fatalf("missing patch target status=%d; want 404", got)
		}
		if got := do(http.MethodPatch, path, `{"frontText":"updated front","reason":"valid update"}`, readWriteToken, false).Code; got != http.StatusForbidden {
			t.Fatalf("untrusted-origin patch status=%d; want 403", got)
		}
		if got := do(http.MethodPatch, path, `{"frontText":"updated front","reason":"valid update"}`, rolelessToken, true).Code; got != http.StatusForbidden {
			t.Fatalf("roleless patch status=%d; want 403", got)
		}
		if got := do(http.MethodPatch, path, `{"frontText":"updated front","reason":"valid update"}`, readOnlyToken, true).Code; got != http.StatusForbidden {
			t.Fatalf("read-only patch status=%d; want 403", got)
		}
		if got := do(http.MethodPatch, path, `{"frontText":" ","reason":"valid update"}`, readWriteToken, true).Code; got != http.StatusBadRequest {
			t.Fatalf("blank patch status=%d; want 400", got)
		}
		if got := do(http.MethodPatch, path, `{"reading":17,"reason":"invalid reading"}`, readWriteToken, true).Code; got != http.StatusBadRequest {
			t.Fatalf("non-string reading status=%d; want 400", got)
		}
		res := do(http.MethodPatch, path, `{"frontText":"updated front","reading":"updated reading","reason":"valid update"}`, readWriteToken, true)
		if res.Code != http.StatusOK {
			t.Fatalf("patch status=%d body=%s", res.Code, res.Body.String())
		}
		var front, reading string
		if err := db.QueryRow(context.Background(), `SELECT front_text,reading FROM learning.flashcard_variant WHERE id=$1`, variantID).Scan(&front, &reading); err != nil || front != "updated front" || reading != "updated reading" {
			t.Fatalf("patch persistence=%q/%q err=%v", front, reading, err)
		}
		assertAdminAuditEvent(t, db, readWriteActor, "admin.flashcards.variant.updated", "learning.flashcard_variant", variantID)
		clear := do(http.MethodPatch, path, `{"reading":null,"reason":"clear reading"}`, readWriteToken, true)
		if clear.Code != http.StatusOK {
			t.Fatalf("clear reading status=%d body=%s", clear.Code, clear.Body.String())
		}
		var clearedReading *string
		if err := db.QueryRow(context.Background(), `SELECT reading FROM learning.flashcard_variant WHERE id=$1`, variantID).Scan(&clearedReading); err != nil || clearedReading != nil {
			t.Fatalf("reading after explicit clear=%v err=%v; want SQL NULL", clearedReading, err)
		}
	})

	t.Run("PATCH /api/admin/flashcards/variants/{id}/source", func(t *testing.T) {
		path := "/api/admin/flashcards/variants/" + variantID + "/source"
		payload := fmt.Sprintf(`{"sourceId":%q,"sourceType":"grammar","reason":"remap source"}`, grammarID)
		missingSource := fmt.Sprintf(`{"sourceId":%q,"sourceType":"grammar","reason":"remap source"}`, newUUID(t))
		if got := do(http.MethodPatch, path, missingSource, readWriteToken, true).Code; got != http.StatusNotFound {
			t.Fatalf("missing canonical source status=%d; want 404", got)
		}
		missingTarget := "/api/admin/flashcards/variants/" + newUUID(t) + "/source"
		if got := do(http.MethodPatch, missingTarget, payload, readWriteToken, true).Code; got != http.StatusNotFound {
			t.Fatalf("missing source-remap target status=%d; want 404", got)
		}
		if got := do(http.MethodPatch, path, `{"sourceId":"invalid","sourceType":"grammar","reason":"remap source"}`, readWriteToken, true).Code; got != http.StatusBadRequest {
			t.Fatalf("invalid source ID status=%d; want 400", got)
		}
		if got := do(http.MethodPatch, path, payload, rolelessToken, true).Code; got != http.StatusForbidden {
			t.Fatalf("roleless source patch status=%d; want 403", got)
		}
		if got := do(http.MethodPatch, path, payload, readWriteToken, false).Code; got != http.StatusForbidden {
			t.Fatalf("untrusted-origin source patch status=%d; want 403", got)
		}
		res := do(http.MethodPatch, path, payload, readWriteToken, true)
		if res.Code != http.StatusOK {
			t.Fatalf("source patch status=%d body=%s", res.Code, res.Body.String())
		}
		var sourceType, sourceID string
		if err := db.QueryRow(context.Background(), `SELECT source_type,source_id FROM learning.flashcard_variant WHERE id=$1`, variantID).Scan(&sourceType, &sourceID); err != nil || sourceType != "grammar" || sourceID != grammarID {
			t.Fatalf("source remap=%q/%q err=%v", sourceType, sourceID, err)
		}
		assertAdminAuditEvent(t, db, readWriteActor, "admin.flashcards.variant.source_remapped", "learning.flashcard_variant", variantID)
	})

	t.Run("POST /api/admin/flashcards/variants/{id}/transition", func(t *testing.T) {
		path := "/api/admin/flashcards/variants/" + variantID + "/transition"
		missingPath := "/api/admin/flashcards/variants/" + newUUID(t) + "/transition"
		if got := do(http.MethodPost, missingPath, `{"next":"archived","reason":"archive variant"}`, readWriteToken, true).Code; got != http.StatusNotFound {
			t.Fatalf("missing transition target status=%d; want 404", got)
		}
		if got := do(http.MethodPost, path, `{"next":"archived","reason":"archive variant"}`, rolelessToken, true).Code; got != http.StatusForbidden {
			t.Fatalf("roleless transition status=%d; want 403", got)
		}
		if got := do(http.MethodPost, path, `{"next":"archived","reason":"archive variant"}`, readWriteToken, false).Code; got != http.StatusForbidden {
			t.Fatalf("untrusted-origin transition status=%d; want 403", got)
		}
		if got := do(http.MethodPost, path, `{"next":"removed","reason":"invalid status"}`, readWriteToken, true).Code; got != http.StatusBadRequest {
			t.Fatalf("invalid transition status=%d; want 400", got)
		}
		res := do(http.MethodPost, path, `{"next":"archived","reason":"archive variant"}`, readWriteToken, true)
		if res.Code != http.StatusOK {
			t.Fatalf("transition status=%d body=%s", res.Code, res.Body.String())
		}
		var status string
		if err := db.QueryRow(context.Background(), `SELECT status FROM learning.flashcard_variant WHERE id=$1`, variantID).Scan(&status); err != nil || status != "archived" {
			t.Fatalf("transition persisted status=%q err=%v", status, err)
		}
		assertAdminAuditEvent(t, db, readWriteActor, "admin.flashcards.variant.archived", "learning.flashcard_variant", variantID)
	})
}

func TestAdminFlashcardVariantMutationsRollBackWhenAuditFails(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()

	actorID, lexemeID, grammarID, variantID := newUUID(t), newUUID(t), newUUID(t), newUUID(t)
	seedAdminActor(t, db, actorID, actorID+"@variant-rollback.example.test", "Variant Rollback")
	grantAdminPermission(t, db, actorID, "admin.content.read")
	grantAdminPermission(t, db, actorID, "admin.content.write")
	token := createAdminSession(t, sessions, actorID)
	if _, err := db.Exec(context.Background(), `INSERT INTO content.lexeme (id,headword,reading,jlpt_level,short_meaning_vi,status,created_at,updated_at)
		VALUES ($1,'rollback fixture','へんこう','N5','fixture','active',NOW(),NOW())`, lexemeID); err != nil {
		t.Fatalf("seed lexeme: %v", err)
	}
	if _, err := db.Exec(context.Background(), `INSERT INTO content.grammar_point (id,pattern,meaning_vi,jlpt_level,status,created_at,updated_at)
		VALUES ($1,'〜 rollback','fixture','N5','active',NOW(),NOW())`, grammarID); err != nil {
		t.Fatalf("seed grammar: %v", err)
	}
	if _, err := db.Exec(context.Background(), `INSERT INTO learning.flashcard_variant
		(id,source_type,source_id,front_text,back_text,status,created_at,updated_at)
		VALUES ($1,'lexeme',$2,'original front','original back','draft',NOW(),NOW())`, variantID, lexemeID); err != nil {
		t.Fatalf("seed variant: %v", err)
	}
	triggerName := "fail_variant_audit_" + strings.ReplaceAll(variantID, "-", "")
	functionName := triggerName + "_fn"
	if _, err := db.Exec(context.Background(), fmt.Sprintf(`CREATE FUNCTION public.%s() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	IF NEW.target_type='learning.flashcard_variant' AND NEW.target_id='%s' THEN
		RAISE EXCEPTION 'injected variant audit failure';
	END IF;
	RETURN NEW;
END $$`, functionName, variantID)); err != nil {
		t.Fatalf("create audit failure function: %v", err)
	}
	if _, err := db.Exec(context.Background(), fmt.Sprintf(`CREATE TRIGGER %s BEFORE INSERT ON ops.admin_audit_log FOR EACH ROW EXECUTE FUNCTION public.%s()`, triggerName, functionName)); err != nil {
		t.Fatalf("create audit failure trigger: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), fmt.Sprintf(`DROP TRIGGER IF EXISTS %s ON ops.admin_audit_log`, triggerName))
		_, _ = db.Exec(context.Background(), fmt.Sprintf(`DROP FUNCTION IF EXISTS public.%s()`, functionName))
		_, _ = db.Exec(context.Background(), `DELETE FROM ops.admin_audit_log WHERE target_type='learning.flashcard_variant' AND target_id=$1`, variantID)
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.flashcard_variant WHERE id=$1`, variantID)
		_, _ = db.Exec(context.Background(), `DELETE FROM content.lexeme WHERE id=$1`, lexemeID)
		_, _ = db.Exec(context.Background(), `DELETE FROM content.grammar_point WHERE id=$1`, grammarID)
	})

	for _, test := range []struct{ method, path, body string }{
		{http.MethodPatch, "/api/admin/flashcards/variants/" + variantID, `{"frontText":"changed front","reason":"rollback patch"}`},
		{http.MethodPost, "/api/admin/flashcards/variants/" + variantID + "/transition", `{"next":"active","reason":"rollback transition"}`},
		{http.MethodPatch, "/api/admin/flashcards/variants/" + variantID + "/source", fmt.Sprintf(`{"sourceId":%q,"sourceType":"grammar","reason":"rollback source"}`, grammarID)},
	} {
		req := httptest.NewRequest(test.method, test.path, strings.NewReader(test.body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Origin", "http://localhost:3000")
		req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		res := httptest.NewRecorder()
		srv.Config.Handler.ServeHTTP(res, req)
		if res.Code != http.StatusInternalServerError {
			t.Fatalf("%s %s status=%d body=%s; want 500", test.method, test.path, res.Code, res.Body.String())
		}
	}
	var sourceType, sourceID, front, back, status string
	if err := db.QueryRow(context.Background(), `SELECT source_type,source_id,front_text,back_text,status FROM learning.flashcard_variant WHERE id=$1`, variantID).
		Scan(&sourceType, &sourceID, &front, &back, &status); err != nil {
		t.Fatalf("read variant after failed audits: %v", err)
	}
	if sourceType != "lexeme" || sourceID != lexemeID || front != "original front" || back != "original back" || status != "draft" {
		t.Fatalf("audit failure partially persisted variant: %q/%q/%q/%q/%q", sourceType, sourceID, front, back, status)
	}
}

func TestAdminFlashcardVariantReadHandlersSurfaceDatabaseErrors(t *testing.T) {
	db := testPool(t)
	db.Close()
	logger := slog.New(slog.NewTextHandler(httptest.NewRecorder(), nil))
	for _, test := range []struct {
		name, path string
		handler    http.HandlerFunc
	}{
		{"list", "/api/admin/flashcards/variants", adminFlashcardVariantsListHandler(db, logger)},
		{"detail", "/api/admin/flashcards/variants/" + newUUID(t), adminFlashcardVariantDetailHandler(db, logger)},
	} {
		t.Run(test.name, func(t *testing.T) {
			res := httptest.NewRecorder()
			test.handler.ServeHTTP(res, httptest.NewRequest(http.MethodGet, test.path, nil))
			if res.Code != http.StatusInternalServerError {
				t.Fatalf("%s database error status=%d body=%s; want 500", test.name, res.Code, res.Body.String())
			}
		})
	}
}
