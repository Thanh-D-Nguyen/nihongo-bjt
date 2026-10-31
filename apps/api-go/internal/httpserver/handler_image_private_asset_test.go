package httpserver

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/flashcarddeck"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/media"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/session"
)

type privateAssetSessions struct{ userID string }

func (s privateAssetSessions) LookupLearnerSession(context.Context, string) (*session.LearnerSession, error) {
	return &session.LearnerSession{ID: "session", UserID: s.userID}, nil
}
func (privateAssetSessions) LookupAdminSession(context.Context, string) (*session.AdminSession, error) {
	return nil, session.ErrSessionNotFound
}

func TestPrivateImageAssetServedOnlyToOwner(t *testing.T) {
	db := testPool(t)
	ctx := context.Background()
	owner, other := newUUID(t), newUUID(t)
	seedActiveUser(t, db, owner, "owner", "private-asset-"+owner+"@example.test", "")
	seedActiveUser(t, db, other, "other", "private-asset-"+other+"@example.test", "")
	bucket, err := media.OpenBucket(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { media.CloseBucket(bucket) })
	t.Cleanup(func() { _, _ = db.Exec(ctx, `DELETE FROM media.asset WHERE owner_user_id IN ($1,$2)`, owner, other) })

	insert := func(provider, status, mime string) string {
		key := "image-selection/" + strings.ReplaceAll(newUUID(t), "-", "")
		var id string
		if err := db.QueryRow(ctx, `INSERT INTO media.asset(owner_user_id,object_key,mime_type,byte_size,provider,provenance,status,rights_status,updated_at) VALUES($1,$2,$3,$4,$5,'{}'::jsonb,$6,'pending_review',now()) RETURNING id::text`, owner, key, mime, len(mediaAuditFixturePNG), provider, status).Scan(&id); err != nil {
			t.Fatal(err)
		}
		if err := bucket.WriteAll(ctx, key, []byte(mediaAuditFixturePNG), nil); err != nil {
			t.Fatal(err)
		}
		return id
	}
	pending := insert("pexels", "pending_review", "image/png")
	hotlink := insert("unsplash", "pending_review", "image/jpeg")
	active := insert("pixabay", "active", "image/png")
	notImage := insert("pixabay", "pending_review", "text/html")

	serve := func(userID, id string, authenticated bool) *httptest.ResponseRecorder {
		router := chi.NewRouter()
		router.With(authn.LearnerGuard(privateAssetSessions{userID}, authn.DefaultGuardConfig(testLogger()))).Get("/api/media/{id}/private-preview", getPrivateImageAssetHandler(db, bucket, testLogger()))
		r := httptest.NewRequest(http.MethodGet, "/api/media/"+id+"/private-preview", nil)
		if authenticated {
			r.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: "test"})
		}
		w := httptest.NewRecorder()
		router.ServeHTTP(w, r)
		return w
	}
	if w := serve(owner, pending, true); w.Code != http.StatusOK || w.Body.String() != mediaAuditFixturePNG || w.Header().Get("Content-Type") != "image/png" || !strings.Contains(w.Header().Get("Cache-Control"), "private") || w.Header().Get("X-Content-Type-Options") != "nosniff" {
		t.Fatalf("owner preview status=%d type=%q cache=%q", w.Code, w.Header().Get("Content-Type"), w.Header().Get("Cache-Control"))
	}
	if w := serve(owner, pending, false); w.Code != http.StatusUnauthorized {
		t.Fatalf("unauthenticated status=%d, want 401", w.Code)
	}
	for name, tc := range map[string]struct{ user, id string }{
		"other user":        {other, pending},
		"hotlinked asset":   {owner, hotlink},
		"active asset":      {owner, active},
		"non-image content": {owner, notImage},
		"missing asset":     {owner, newUUID(t)},
	} {
		if w := serve(tc.user, tc.id, true); w.Code != http.StatusNotFound || strings.Contains(w.Body.String(), "PNG") {
			t.Errorf("%s status=%d, want 404", name, w.Code)
		}
	}
	if w := serve(owner, "not-a-uuid", true); w.Code != http.StatusBadRequest {
		t.Fatalf("invalid id status=%d, want 400", w.Code)
	}
}

func TestCreateDeckWithForeignImageIsForbidden(t *testing.T) {
	db := testPool(t)
	ctx := context.Background()
	owner, other := newUUID(t), newUUID(t)
	seedActiveUser(t, db, owner, "owner", "create-deck-"+owner+"@example.test", "")
	seedActiveUser(t, db, other, "other", "create-deck-"+other+"@example.test", "")
	var foreign string
	if err := db.QueryRow(ctx, `INSERT INTO media.asset(owner_user_id,object_key,mime_type,status,updated_at) VALUES($1,gen_random_uuid()::text,'image/png','active',now()) RETURNING id::text`, other).Scan(&foreign); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, `DELETE FROM learning.user_flashcard WHERE user_id=$1`, owner)
		_, _ = db.Exec(ctx, `DELETE FROM learning.deck_card WHERE deck_id IN (SELECT id FROM learning.deck WHERE owner_user_id=$1)`, owner)
		_, _ = db.Exec(ctx, `DELETE FROM learning.flashcard_variant WHERE source_type='custom' AND source_id IN (SELECT id FROM learning.deck WHERE owner_user_id=$1)`, owner)
		_, _ = db.Exec(ctx, `DELETE FROM learning.deck WHERE owner_user_id=$1`, owner)
		_, _ = db.Exec(ctx, `DELETE FROM media.asset WHERE id=$1`, foreign)
	})
	handler := authn.LearnerGuard(privateAssetSessions{owner}, authn.DefaultGuardConfig(testLogger()))(createDeckHandler(flashcarddeck.NewStore(db), testLogger()))
	r := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{"name":"x","cards":[{"frontText":"a","backText":"b","primaryImageAssetId":"`+foreign+`"}]}`))
	r.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: "test"})
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)
	if w.Code != http.StatusForbidden {
		t.Fatalf("foreign image status=%d body=%s, want 403", w.Code, w.Body.String())
	}
}
