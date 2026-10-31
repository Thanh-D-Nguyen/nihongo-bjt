package httpserver

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/flashcarddeck"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/media"
)

func TestFlashcardUploadPrivateBeforeLinkAndAfterRevocation(t *testing.T) {
	db, router, _, token, _ := wave9Router(t, true)
	presign := wave9Request(router, http.MethodPost, "/api/media/presign-upload", `{"fileName":"card.png","mimeType":"image/png","purpose":"flashcard"}`, token)
	if presign.Code != http.StatusCreated {
		t.Fatalf("presign=%d", presign.Code)
	}
	var signed struct{ AssetID, UploadURL, UploadToken string }
	if err := json.Unmarshal(presign.Body.Bytes(), &signed); err != nil {
		t.Fatal(err)
	}
	cleanupWave9Asset(t, db, signed.AssetID)
	content := []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n', 1, 2, 3}
	req := httptest.NewRequest(http.MethodPut, signed.UploadURL, bytes.NewReader(content))
	req.Header.Set("Origin", wave9Origin)
	req.Header.Set("Content-Type", "image/png")
	req.Header.Set("X-Media-Upload-Token", signed.UploadToken)
	req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: token})
	put := httptest.NewRecorder()
	router.ServeHTTP(put, req)
	if put.Code != http.StatusCreated {
		t.Fatalf("upload=%d", put.Code)
	}
	completed := wave9Request(router, http.MethodPost, "/api/media/complete-upload", fmt.Sprintf(`{"assetId":%q,"byteSize":%d}`, signed.AssetID, len(content)), token)
	if completed.Code != http.StatusOK {
		t.Fatalf("complete=%d", completed.Code)
	}
	path := "/api/media/" + signed.AssetID + "/stream"
	if w := wave9Request(router, http.MethodGet, path, "", ""); w.Code != http.StatusNotFound {
		t.Fatalf("unlinked pending stream=%d cache=%q", w.Code, w.Header().Get("Cache-Control"))
	}
	if w := wave9Request(router, http.MethodGet, "/api/media/"+signed.AssetID+"/private-preview", "", token); w.Code != http.StatusOK {
		t.Fatalf("owner preview=%d", w.Code)
	}
	if _, err := db.Exec(context.Background(), `UPDATE media.asset SET rights_status='cleared' WHERE id=$1`, signed.AssetID); err != nil {
		t.Fatal(err)
	}
	if w := wave9Request(router, http.MethodGet, path, "", ""); w.Code != http.StatusOK || w.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("cleared stream=%d cache=%q", w.Code, w.Header().Get("Cache-Control"))
	}
	if _, err := db.Exec(context.Background(), `UPDATE media.asset SET rights_status='blocked' WHERE id=$1`, signed.AssetID); err != nil {
		t.Fatal(err)
	}
	if w := wave9Request(router, http.MethodGet, path, "", ""); w.Code != http.StatusNotFound {
		t.Fatalf("revoked stream=%d", w.Code)
	}
}

func TestUploadedDeckImageRequiresRightsClearance(t *testing.T) {
	db, ctx := testPool(t), context.Background()
	owner, viewer := newUUID(t), newUUID(t)
	seedActiveUser(t, db, owner, "owner", "upload-rights-"+owner+"@example.test", "")
	seedActiveUser(t, db, viewer, "viewer", "upload-rights-"+viewer+"@example.test", "")
	bucket, err := media.OpenBucket(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { media.CloseBucket(bucket) })
	var id string
	err = db.QueryRow(ctx, `INSERT INTO media.asset(owner_user_id,object_key,mime_type,byte_size,provider,status,rights_status,updated_at) VALUES($1,gen_random_uuid()::text,'image/png',$2,'local','active','pending_review',NOW()) RETURNING id::text`, owner, len(mediaAuditFixturePNG)).Scan(&id)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(ctx, `UPDATE media.asset SET object_key=$1 WHERE id=$1`, id); err != nil {
		t.Fatal(err)
	}
	if err = bucket.WriteAll(ctx, id, []byte(mediaAuditFixturePNG), nil); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, `DELETE FROM learning.user_flashcard WHERE user_id=$1`, owner)
		_, _ = db.Exec(ctx, `DELETE FROM learning.deck_card WHERE deck_id IN (SELECT id FROM learning.deck WHERE owner_user_id=$1)`, owner)
		_, _ = db.Exec(ctx, `DELETE FROM learning.flashcard_variant WHERE source_id IN (SELECT id FROM learning.deck WHERE owner_user_id=$1) AND source_type='custom'`, owner)
		_, _ = db.Exec(ctx, `DELETE FROM learning.deck WHERE owner_user_id=$1`, owner)
		_, _ = db.Exec(ctx, `DELETE FROM media.asset WHERE id=$1`, id)
	})
	store := flashcarddeck.NewStore(db)
	deck, err := store.CreateDeck(ctx, flashcarddeck.CreateDeckInput{UserID: owner, Name: "upload", Visibility: "public", Cards: []flashcarddeck.DeckCardInput{{FrontText: "front", BackText: "back", PrimaryImageAssetID: &id}}})
	if err != nil {
		t.Fatal(err)
	}
	router := chi.NewRouter()
	router.Get("/api/media/{id}/stream", streamMediaHandler(media.NewStore(db), bucket, testLogger()))
	router.With(authn.LearnerGuard(privateAssetSessions{owner}, authn.DefaultGuardConfig(testLogger()))).Get("/api/media/{id}/private-preview", getPrivateImageAssetHandler(db, bucket, testLogger()))
	get := func(path string, authenticated bool) int {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		if authenticated {
			req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: "test"})
		}
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		return w.Code
	}
	check := func(user string, visible bool) {
		t.Helper()
		detail, err := store.GetDeck(ctx, user, deck.ID)
		if err != nil {
			t.Fatal(err)
		}
		if (detail.Cards[0].Card.PrimaryImage != nil) != visible {
			t.Fatalf("image visible to %s = %v, want %v", user, detail.Cards[0].Card.PrimaryImage != nil, visible)
		}
	}
	check(viewer, false)
	check(owner, true)
	if got := get("/api/media/"+id+"/stream", false); got != 404 {
		t.Fatalf("pending public stream=%d", got)
	}
	if got := get("/api/media/"+id+"/private-preview", true); got != 200 {
		t.Fatalf("owner preview=%d", got)
	}
	detail, err := store.GetDeck(ctx, owner, deck.ID)
	if err != nil {
		t.Fatal(err)
	}
	cardID := detail.Cards[0].Card.ID
	remove := []flashcarddeck.DeckCardInput{{CardID: cardID, RemovePrimaryImage: true}}
	if _, err := store.UpdateDeck(ctx, owner, deck.ID, flashcarddeck.UpdateDeckInput{Cards: &remove}); err != nil {
		t.Fatal(err)
	}
	if got := get("/api/media/"+id+"/stream", false); got != 404 {
		t.Fatalf("removed pending image became public: %d", got)
	}
	restore := []flashcarddeck.DeckCardInput{{CardID: cardID, PrimaryImageAssetID: &id}}
	if _, err := store.UpdateDeck(ctx, owner, deck.ID, flashcarddeck.UpdateDeckInput{Cards: &restore}); err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(ctx, `UPDATE media.asset SET rights_status='cleared' WHERE id=$1`, id); err != nil {
		t.Fatal(err)
	}
	check(viewer, true)
	if got := get("/api/media/"+id+"/stream", false); got != 200 {
		t.Fatalf("cleared public stream=%d", got)
	}
}

func TestPrivatePreviewPublicDeckDoesNotExposePendingAsset(t *testing.T) {
	db := testPool(t)
	ctx := context.Background()
	owner, other := newUUID(t), newUUID(t)
	seedActiveUser(t, db, owner, "owner", "preview-"+owner+"@example.test", "")
	seedActiveUser(t, db, other, "other", "preview-"+other+"@example.test", "")
	var asset string
	err := db.QueryRow(ctx, `INSERT INTO media.asset(owner_user_id,object_key,mime_type,provider,provenance,status,rights_status,updated_at) VALUES($1,$2,'image/png','pixabay',$3::jsonb,'pending_review','pending_review',now()) RETURNING id::text`, owner, "image-selection/"+strings.Repeat("a", 32), `{"provider":"pixabay","delivery":"rehosted","imageUrl":"https://cdn.pixabay.com/photo/a.png","sourceUrl":"https://pixabay.com/photos/a","author":"Bob","license":"Pixabay Content License"}`).Scan(&asset)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, `DELETE FROM learning.user_flashcard WHERE user_id=$1`, owner)
		_, _ = db.Exec(ctx, `DELETE FROM learning.deck_card WHERE deck_id IN (SELECT id FROM learning.deck WHERE owner_user_id=$1)`, owner)
		_, _ = db.Exec(ctx, `DELETE FROM learning.flashcard_variant WHERE source_type='custom' AND source_id IN (SELECT id FROM learning.deck WHERE owner_user_id=$1)`, owner)
		_, _ = db.Exec(ctx, `DELETE FROM learning.deck WHERE owner_user_id=$1`, owner)
		_, _ = db.Exec(ctx, `DELETE FROM media.asset WHERE id=$1`, asset)
	})
	store := flashcarddeck.NewStore(db)
	deck, err := store.CreateDeck(ctx, flashcarddeck.CreateDeckInput{UserID: owner, Name: "preview", Visibility: "public", Cards: []flashcarddeck.DeckCardInput{{FrontText: "front", BackText: "back", PrimaryImageAssetID: &asset}}})
	if err != nil {
		t.Fatal(err)
	}
	detail, err := store.GetDeck(ctx, other, deck.ID)
	if err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(detail)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(data), asset) || strings.Contains(string(data), "Bob") {
		t.Fatalf("pending asset exposed in public deck: %s", data)
	}
}
