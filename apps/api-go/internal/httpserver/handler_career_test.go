package httpserver

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/career"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/config"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

func TestCareerGetMeDoesNotInventJapaneseWorkName(t *testing.T) {
	db := testPool(t)
	userID := newUUID(t)
	seedActiveUser(t, db, userID, "Career Audit", fmt.Sprintf("career-%s@example.test", userID[:8]), "")
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM auth.user WHERE id = $1`, userID)
	})

	me, err := career.NewStore(db).GetMe(context.Background(), userID)
	if err != nil {
		t.Fatalf("get career state: %v", err)
	}
	if me.JPWorkName != "" || me.CompanyTheme != "" {
		t.Fatalf("new learner career profile has invented jpWorkName/companyTheme: jpWorkName=%q companyTheme=%q", me.JPWorkName, me.CompanyTheme)
	}
}

func TestCareerInboxPersistsTypedMemoAndScopesFeedbackToOwner(t *testing.T) {
	db := testPool(t)
	userID := newUUID(t)
	otherUserID := newUUID(t)
	seedActiveUser(t, db, userID, "Inbox Owner", fmt.Sprintf("inbox-%s@example.test", userID[:8]), "")
	seedActiveUser(t, db, otherUserID, "Other Learner", fmt.Sprintf("inbox-other-%s@example.test", otherUserID[:8]), "")
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM auth.user WHERE id = ANY($1::uuid[])`, []string{userID, otherUserID})
	})

	var memoID string
	payload := `{"expressionJa":"少々お時間をいただけますか","reading":"しょうしょうおじかんをいただけますか","surfaceMeaningVi":"Xin chút thời gian","realIntentVi":"Tôi cần thêm thời gian","sceneJa":"会議","toneVi":"Lịch sự","bjtTrapVi":"Không phải từ chối","fromNpcSlug":"sato","fromNpcNameJa":"佐藤"}`
	if err := db.QueryRow(context.Background(), `INSERT INTO career.context_memo (user_id, memo_type, payload) VALUES ($1, 'expression_pair', $2::jsonb) RETURNING id`, userID, payload).Scan(&memoID); err != nil {
		t.Fatalf("insert context memo: %v", err)
	}
	var otherMemoID string
	if err := db.QueryRow(context.Background(), `INSERT INTO career.context_memo (user_id, memo_type, payload) VALUES ($1, 'expression_pair', '{}'::jsonb) RETURNING id`, otherUserID).Scan(&otherMemoID); err != nil {
		t.Fatalf("insert other learner context memo: %v", err)
	}
	store := career.NewStore(db)
	memos, err := store.GetInbox(context.Background(), userID)
	if err != nil {
		t.Fatalf("get inbox: %v", err)
	}
	if len(memos) != 1 || memos[0].ID != memoID || memos[0].CardKind != "expression_pair" || memos[0].ExpressionJa != "少々お時間をいただけますか" || memos[0].Status != "unread" || memos[0].FromNPCNameJa != "佐藤" {
		t.Fatalf("inbox DTO does not map the persisted memo payload: %+v", memos)
	}
	otherMemos, err := store.GetInbox(context.Background(), otherUserID)
	if err != nil || len(otherMemos) != 1 || otherMemos[0].ID != otherMemoID {
		t.Fatalf("other learner must only read their own memo: memos=%+v err=%v", otherMemos, err)
	}
	updated, err := store.SetInboxFeedback(context.Background(), otherUserID, memoID, "useful")
	if err != nil || updated {
		t.Fatalf("other learner must not update memo: updated=%v err=%v", updated, err)
	}
	updated, err = store.SetInboxFeedback(context.Background(), userID, memoID, "fuzzy")
	if err != nil || !updated {
		t.Fatalf("owner feedback update failed: updated=%v err=%v", updated, err)
	}
	memos, err = store.GetInbox(context.Background(), userID)
	if err != nil || memos[0].Status != "read" || memos[0].Feedback == nil || *memos[0].Feedback != "fuzzy" {
		t.Fatalf("feedback was not persisted: memos=%+v err=%v", memos, err)
	}
}

func TestCareerInboxFeedbackRouteEnforcesSessionCSRFAndOwnership(t *testing.T) {
	db := testPool(t)
	ownerID := newUUID(t)
	otherID := newUUID(t)
	seedActiveUser(t, db, ownerID, "Inbox Route Owner", fmt.Sprintf("inbox-route-%s@example.test", ownerID[:8]), "")
	seedActiveUser(t, db, otherID, "Inbox Route Other", fmt.Sprintf("inbox-route-other-%s@example.test", otherID[:8]), "")
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM auth.user WHERE id = ANY($1::uuid[])`, []string{ownerID, otherID})
	})
	var memoID string
	if err := db.QueryRow(context.Background(), `INSERT INTO career.context_memo (user_id, memo_type, payload) VALUES ($1, 'expression_pair', '{}'::jsonb) RETURNING id`, ownerID).Scan(&memoID); err != nil {
		t.Fatalf("insert memo: %v", err)
	}
	sessions := session.NewStore(db)
	ownerToken := createLearnerSession(t, sessions, ownerID)
	otherToken := createLearnerSession(t, sessions, otherID)
	router := NewRouter(Dependencies{
		Config:       &config.Config{CORSOrigins: []string{"http://localhost:3000"}},
		Logger:       testLogger(),
		DBPool:       db,
		SessionStore: sessions,
		CareerStore:  career.NewStore(db),
	})
	path := "/api/career/inbox/" + memoID
	request := func(token, origin, feedback string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodPatch, path, strings.NewReader(fmt.Sprintf(`{"feedback":%q}`, feedback)))
		req.Header.Set("Content-Type", "application/json")
		if origin != "" {
			req.Header.Set("Origin", origin)
		}
		if token != "" {
			req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: token})
		}
		res := httptest.NewRecorder()
		router.ServeHTTP(res, req)
		return res
	}

	if got := request("", "http://localhost:3000", "useful").Code; got != http.StatusUnauthorized {
		t.Fatalf("anonymous feedback status=%d; want 401", got)
	}
	if got := request(ownerToken, "", "useful").Code; got != http.StatusForbidden {
		t.Fatalf("feedback without Origin status=%d; want 403", got)
	}
	if got := request(ownerToken, "http://untrusted.example", "useful").Code; got != http.StatusForbidden {
		t.Fatalf("feedback from untrusted Origin status=%d; want 403", got)
	}
	if got := request(ownerToken, "http://localhost:3000", "invalid").Code; got != http.StatusBadRequest {
		t.Fatalf("invalid feedback status=%d; want 400", got)
	}
	if got := request(otherToken, "http://localhost:3000", "useful").Code; got != http.StatusNotFound {
		t.Fatalf("foreign memo feedback status=%d; want 404", got)
	}
	if got := request(ownerToken, "http://localhost:3000", "useful").Code; got != http.StatusOK {
		t.Fatalf("owner feedback status=%d; want 200", got)
	}
}
