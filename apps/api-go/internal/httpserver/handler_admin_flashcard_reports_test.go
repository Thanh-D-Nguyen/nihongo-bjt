package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/flashcarddeck"
)

func TestAdminFlashcardReportsReviewEnforcesPermissionAndRemovesDeck(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	reporter, _ := cardgenAuthenticatedRequest(t, db, http.MethodGet, "/api/flashcards/decks", "")
	author := newUUID(t)
	seedActiveUser(t, db, author, "Flagged author", fmt.Sprintf("flagged-%s@example.test", author), "")
	var deckID, reportID string
	if err := db.QueryRow(context.Background(), `INSERT INTO learning.deck(owner_user_id,title_vi,visibility,status,updated_at) VALUES ($1,'Reported deck','public','active',NOW()) RETURNING id::text`, author).Scan(&deckID); err != nil {
		t.Fatal(err)
	}
	if err := flashcarddeck.NewStore(db).ReportDeck(context.Background(), reporter, deckID, "spam"); err != nil {
		t.Fatal(err)
	}
	reporter2 := newUUID(t)
	seedActiveUser(t, db, reporter2, "Second reporter", fmt.Sprintf("reporter-%s@example.test", reporter2), "")
	if err := flashcarddeck.NewStore(db).ReportDeck(context.Background(), reporter2, deckID, "abuse"); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(context.Background(), `SELECT id::text FROM ops.deck_report WHERE deck_id=$1 AND reporter_user_id=$2`, deckID, reporter).Scan(&reportID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM ops.admin_audit_log WHERE target_id IN (SELECT id::text FROM ops.deck_report WHERE deck_id=$1) AND target_type='ops.deck_report'`, deckID)
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.deck WHERE id=$1`, deckID)
	})

	request := func(method, path, body, token string) *http.Response {
		t.Helper()
		req, err := http.NewRequest(method, srv.URL+path, strings.NewReader(body))
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Origin", "http://localhost:3000")
		req.Header.Set("Content-Type", "application/json")
		if token != "" {
			req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		}
		res, err := srv.Client().Do(req)
		if err != nil {
			t.Fatal(err)
		}
		return res
	}
	path := "/api/admin/flashcards/reports/" + reportID + "/review"
	res := request(http.MethodPost, path, `{"action":"remove","note":"confirmed spam"}`, "")
	res.Body.Close()
	if res.StatusCode != http.StatusUnauthorized {
		t.Fatalf("anonymous status %d", res.StatusCode)
	}

	roleless := newUUID(t)
	seedAdminActor(t, db, roleless, fmt.Sprintf("roleless-%s@example.test", roleless[:8]), "Roleless")
	res = request(http.MethodPost, path, `{"action":"remove","note":"confirmed spam"}`, createAdminSession(t, sessions, roleless))
	res.Body.Close()
	if res.StatusCode != http.StatusForbidden {
		t.Fatalf("roleless status %d", res.StatusCode)
	}

	actor := newUUID(t)
	seedAdminActor(t, db, actor, fmt.Sprintf("moderator-%s@example.test", actor[:8]), "Moderator")
	grantAdminPermission(t, db, actor, "admin.content.write")
	token := createAdminSession(t, sessions, actor)
	res = request(http.MethodPost, path, `{"action":"remove","note":""}`, token)
	res.Body.Close()
	if res.StatusCode != http.StatusBadRequest {
		t.Fatalf("empty note status %d", res.StatusCode)
	}

	res = request(http.MethodPost, path, `{"action":"remove","note":"confirmed spam"}`, token)
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("review status %d", res.StatusCode)
	}
	var payload struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	if payload.Status != "resolved" {
		t.Fatalf("report status %s", payload.Status)
	}
	var deckStatus, reportStatus string
	if err := db.QueryRow(context.Background(), `SELECT status FROM learning.deck WHERE id=$1`, deckID).Scan(&deckStatus); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(context.Background(), `SELECT status FROM ops.deck_report WHERE id=$1`, reportID).Scan(&reportStatus); err != nil {
		t.Fatal(err)
	}
	if deckStatus != "archived" || reportStatus != "resolved" {
		t.Fatalf("after review: deck=%s report=%s", deckStatus, reportStatus)
	}
	var pending, resolved int
	if err := db.QueryRow(context.Background(), `SELECT COUNT(*) FILTER (WHERE status='pending'), COUNT(*) FILTER (WHERE status='resolved') FROM ops.deck_report WHERE deck_id=$1`, deckID).Scan(&pending, &resolved); err != nil {
		t.Fatal(err)
	}
	if pending != 0 || resolved != 2 {
		t.Fatalf("related reports: pending=%d resolved=%d, want 0/2", pending, resolved)
	}
	var audits int
	if err := db.QueryRow(context.Background(), `SELECT COUNT(*) FROM ops.admin_audit_log WHERE target_id IN (SELECT id::text FROM ops.deck_report WHERE deck_id=$1) AND actor_id=$2 AND action='admin.flashcards.report.removed'`, deckID, actor).Scan(&audits); err != nil {
		t.Fatal(err)
	}
	if audits != 2 {
		t.Fatalf("audit count=%d", audits)
	}
	res = request(http.MethodPost, path, `{"action":"remove","note":"duplicate"}`, token)
	res.Body.Close()
	if res.StatusCode != http.StatusConflict {
		t.Fatalf("duplicate review status %d", res.StatusCode)
	}
}

func TestAdminFlashcardReportsListAndDismiss(t *testing.T) {
	db := testPool(t)
	srv, sessions := adminRBACTestServerWithPool(t, db)
	defer srv.Close()
	reporter, _ := cardgenAuthenticatedRequest(t, db, http.MethodGet, "/api/flashcards/decks", "")
	author := newUUID(t)
	seedActiveUser(t, db, author, "Dismissed author", fmt.Sprintf("dismissed-%s@example.test", author), "")
	var deckID, reportID string
	if err := db.QueryRow(context.Background(), `INSERT INTO learning.deck(owner_user_id,title_vi,visibility,status,updated_at) VALUES ($1,'Dismissed report deck','public','active',NOW()) RETURNING id::text`, author).Scan(&deckID); err != nil {
		t.Fatal(err)
	}
	if err := flashcarddeck.NewStore(db).ReportDeck(context.Background(), reporter, deckID, "abuse"); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(context.Background(), `SELECT id::text FROM ops.deck_report WHERE deck_id=$1`, deckID).Scan(&reportID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM ops.admin_audit_log WHERE target_id=$1 AND target_type='ops.deck_report'`, reportID)
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.deck WHERE id=$1`, deckID)
	})
	actor := newUUID(t)
	seedAdminActor(t, db, actor, fmt.Sprintf("moderator2-%s@example.test", actor[:8]), "Moderator")
	grantAdminPermission(t, db, actor, "admin.content.read")
	readToken := createAdminSession(t, sessions, actor)
	request := func(method, path, body, token string) *http.Response {
		t.Helper()
		req, _ := http.NewRequest(method, srv.URL+path, strings.NewReader(body))
		req.Header.Set("Origin", "http://localhost:3000")
		req.Header.Set("Content-Type", "application/json")
		req.AddCookie(&http.Cookie{Name: "bjt_admin_session", Value: token})
		res, err := srv.Client().Do(req)
		if err != nil {
			t.Fatal(err)
		}
		return res
	}
	res := request(http.MethodGet, "/api/admin/flashcards/reports?status=pending", "", readToken)
	var listing struct {
		Items []struct {
			ID      string `json:"id"`
			TitleVi string `json:"titleVi"`
		} `json:"items"`
	}
	if res.StatusCode != http.StatusOK {
		t.Fatalf("list status %d", res.StatusCode)
	}
	if err := json.NewDecoder(res.Body).Decode(&listing); err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	found := false
	for _, item := range listing.Items {
		if item.ID == reportID && item.TitleVi == "Dismissed report deck" {
			found = true
		}
	}
	if !found {
		t.Fatal("pending report missing from queue")
	}
	res = request(http.MethodPost, "/api/admin/flashcards/reports/"+reportID+"/review", `{"action":"dismiss","note":"reviewed and safe"}`, readToken)
	res.Body.Close()
	if res.StatusCode != http.StatusForbidden {
		t.Fatalf("read-only actor write status %d", res.StatusCode)
	}
	grantAdminPermission(t, db, actor, "admin.content.write")
	res = request(http.MethodPost, "/api/admin/flashcards/reports/"+reportID+"/review", `{"action":"dismiss","note":"reviewed and safe"}`, readToken)
	res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("dismiss status %d", res.StatusCode)
	}
	var deckStatus string
	if err := db.QueryRow(context.Background(), `SELECT status FROM learning.deck WHERE id=$1`, deckID).Scan(&deckStatus); err != nil {
		t.Fatal(err)
	}
	if deckStatus != "active" {
		t.Fatalf("dismiss changed deck to %s", deckStatus)
	}
	var reportStatus, reviewNote string
	var reviewedBy *string
	var reviewedAtSet bool
	if err := db.QueryRow(context.Background(), `SELECT status, reviewed_by::text, reviewed_at IS NOT NULL, COALESCE(review_note,'') FROM ops.deck_report WHERE id=$1`, reportID).Scan(&reportStatus, &reviewedBy, &reviewedAtSet, &reviewNote); err != nil {
		t.Fatal(err)
	}
	if reportStatus != "dismissed" || reviewedBy == nil || *reviewedBy != actor || !reviewedAtSet || reviewNote != "reviewed and safe" {
		t.Fatalf("dismissed report: status=%s reviewedBy=%v reviewedAtSet=%v note=%q", reportStatus, reviewedBy, reviewedAtSet, reviewNote)
	}
	var audits int
	if err := db.QueryRow(context.Background(), `SELECT count(*) FROM ops.admin_audit_log WHERE action='admin.flashcards.report.dismissed' AND target_type='ops.deck_report' AND target_id=$1 AND actor_id=$2`, reportID, actor).Scan(&audits); err != nil || audits != 1 {
		t.Fatalf("dismiss audit count=%d err=%v", audits, err)
	}
}
