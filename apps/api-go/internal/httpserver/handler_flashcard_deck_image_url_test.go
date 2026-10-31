package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/flashcarddeck"
)

func TestDeckHandlersRejectDirectImageURL(t *testing.T) {
	db := testPool(t)
	ctx := context.Background()
	user := newUUID(t)
	seedActiveUser(t, db, user, "Image URL test", fmt.Sprintf("image-url-%s@example.test", user), "")
	var asset string
	if err := db.QueryRow(ctx, `INSERT INTO media.asset(owner_user_id,object_key,mime_type,status,updated_at) VALUES($1,gen_random_uuid()::text,'image/png','active',now()) RETURNING id::text`, user).Scan(&asset); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, `DELETE FROM learning.user_flashcard WHERE user_id=$1`, user)
		_, _ = db.Exec(ctx, `DELETE FROM learning.deck_card WHERE deck_id IN (SELECT id FROM learning.deck WHERE owner_user_id=$1)`, user)
		_, _ = db.Exec(ctx, `DELETE FROM learning.flashcard_variant WHERE source_type='custom' AND source_id IN (SELECT id FROM learning.deck WHERE owner_user_id=$1)`, user)
		_, _ = db.Exec(ctx, `DELETE FROM learning.deck WHERE owner_user_id=$1`, user)
		_, _ = db.Exec(ctx, `DELETE FROM media.asset WHERE id=$1`, asset)
	})
	store := flashcarddeck.NewStore(db)
	serve := func(method, path, body string) *httptest.ResponseRecorder {
		var handler http.Handler = createDeckHandler(store, testLogger())
		if method == http.MethodPatch {
			handler = updateDeckHandler(store, testLogger())
		}
		handler = authn.LearnerGuard(privateAssetSessions{user}, authn.DefaultGuardConfig(testLogger()))(handler)
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		req.AddCookie(&http.Cookie{Name: "bjt_web_session", Value: "test"})
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, req)
		return response
	}
	created := serve(http.MethodPost, "/api/flashcards/decks", `{"name":"test","cards":[{"frontText":"a","backText":"b","imageUrl":"","primaryImageAssetId":"`+asset+`"}]}`)
	if created.Code != http.StatusCreated {
		t.Fatalf("create with asset: got %d %s, want 201", created.Code, created.Body)
	}
	var deck struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(created.Body.Bytes(), &deck); err != nil || deck.ID == "" {
		t.Fatalf("decode deck: %v, body=%s", err, created.Body)
	}
	path := "/api/flashcards/decks/" + deck.ID
	for _, tc := range []struct{ name, method, path, body string }{
		{"create", http.MethodPost, "/api/flashcards/decks", `{"name":"test","cards":[{"frontText":"a","backText":"b","imageUrl":"https://example.test/secret"}]}`},
		{"patch", http.MethodPatch, path, `{"cards":[{"frontText":"a","backText":"b","imageUrl":"https://example.test/secret","primaryImageAssetId":"` + asset + `"}]}`},
		{"patch existing card", http.MethodPatch, path, `{"cards":[{"cardId":"` + newUUID(t) + `","imageUrl":"https://example.test/secret"}]}`},
		{"second card", http.MethodPost, "/api/flashcards/decks", `{"name":"test","cards":[{"frontText":"a","backText":"b"},{"frontText":"c","backText":"d","imageUrl":"https://example.test/secret"}]}`},
		{"whitespace", http.MethodPost, "/api/flashcards/decks", `{"name":"test","cards":[{"frontText":"a","backText":"b","imageUrl":" "}]}`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			response := serve(tc.method, tc.path, tc.body)
			var payload struct {
				Error string `json:"error"`
			}
			if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
				t.Fatalf("decode error response: %v", err)
			}
			if response.Code != http.StatusBadRequest || payload.Error != "direct_image_url_not_supported" {
				t.Errorf("%s with imageUrl: got %d %s, want 400 direct_image_url_not_supported", tc.method, response.Code, response.Body)
			}
			if strings.Contains(response.Body.String(), "example.test") {
				t.Errorf("response exposed image URL: %s", response.Body)
			}
		})
	}
	var links int
	if err := db.QueryRow(ctx, `SELECT count(*) FROM learning.card_media_link ml JOIN learning.deck_card dc ON dc.card_id=ml.card_id WHERE dc.deck_id=$1 AND ml.asset_id=$2`, deck.ID, asset).Scan(&links); err != nil || links != 1 {
		t.Errorf("asset link after rejected PATCH: got %d, err=%v, want 1", links, err)
	}
	plain := serve(http.MethodPost, "/api/flashcards/decks", `{"name":"no image","cards":[{"frontText":"a","backText":"b"}]}`)
	if plain.Code != http.StatusCreated {
		t.Errorf("create without image: got %d %s, want 201", plain.Code, plain.Body)
	}
	for _, card := range []string{`{"frontText":"c","backText":"d"}`, `{"frontText":"c","backText":"d","imageUrl":null}`, `{"frontText":"c","backText":"d","imageUrl":"","primaryImageAssetId":"` + asset + `"}`} {
		response := serve(http.MethodPatch, path, `{"cards":[`+card+`]}`)
		if response.Code != http.StatusOK {
			t.Errorf("patch %s: got %d %s, want 200", card, response.Code, response.Body)
		}
	}
	if err := db.QueryRow(ctx, `SELECT count(*) FROM learning.card_media_link ml JOIN learning.deck_card dc ON dc.card_id=ml.card_id WHERE dc.deck_id=$1 AND ml.asset_id=$2`, deck.ID, asset).Scan(&links); err != nil || links != 1 {
		t.Errorf("asset link after accepted PATCH: got %d, err=%v, want 1", links, err)
	}
}
