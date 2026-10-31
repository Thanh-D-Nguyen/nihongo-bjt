package flashcarddeck

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestForkWaitsForConcurrentReviewBeforeCopyingProgress(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	db, err := pgxpool.New(ctx, os.Getenv("TEST_DATABASE_URL"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	var user, source, target string
	if err := db.QueryRow(ctx, `SELECT gen_random_uuid()::text`).Scan(&user); err != nil {
		t.Fatal(err)
	}
	for _, id := range []*string{&source, &target} {
		if err := db.QueryRow(ctx, `INSERT INTO learning.flashcard_variant(source_type,source_id,front_text,back_text,status,updated_at) VALUES('custom',gen_random_uuid(),'front','back','active',NOW()) RETURNING id::text`).Scan(id); err != nil {
			t.Fatal(err)
		}
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.user_flashcard WHERE user_id=$1`, user)
		_, _ = db.Exec(context.Background(), `DELETE FROM learning.flashcard_variant WHERE id=ANY($1::uuid[])`, []string{source, target})
	})
	if _, err := db.Exec(ctx, `INSERT INTO learning.user_flashcard(user_id,card_id,repetitions,updated_at) VALUES($1,$2,1,NOW())`, user, source); err != nil {
		t.Fatal(err)
	}
	review, err := db.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer review.Rollback(context.Background())
	if _, err = review.Exec(ctx, `UPDATE learning.user_flashcard SET repetitions=7 WHERE user_id=$1 AND card_id=$2`, user, source); err != nil {
		t.Fatal(err)
	}
	started := make(chan struct{})
	done := make(chan error, 1)
	go func() {
		tx, err := db.Begin(ctx)
		if err != nil {
			done <- err
			return
		}
		defer tx.Rollback(context.Background())
		close(started)
		if err = copyReviewProgress(ctx, tx, user, source, target); err == nil {
			err = tx.Commit(ctx)
		}
		done <- err
	}()
	<-started
	var early bool
	select {
	case err := <-done:
		early = true
		if err != nil {
			t.Errorf("copy failed: %v", err)
		}
	case <-time.After(250 * time.Millisecond):
	}
	if err = review.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	if !early {
		if err := <-done; err != nil {
			t.Fatal(err)
		}
	}
	if early {
		t.Fatal("copy did not wait for in-flight review")
	}
	var repetitions int
	if err := db.QueryRow(ctx, `SELECT repetitions FROM learning.user_flashcard WHERE user_id=$1 AND card_id=$2`, user, target).Scan(&repetitions); err != nil || repetitions != 7 {
		t.Fatalf("copied repetitions=%d, err=%v, want 7", repetitions, err)
	}
}

func TestDeckImagePersistence(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Fatal("TEST_DATABASE_URL required; run with scripts/quality/with-test-db.sh")
	}
	ctx := context.Background()
	db, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(db.Close)
	var user, other, asset, foreign string
	if err := db.QueryRow(ctx, `SELECT gen_random_uuid()::text,gen_random_uuid()::text`).Scan(&user, &other); err != nil {
		t.Fatal(err)
	}
	for _, row := range []struct {
		owner string
		id    *string
	}{{user, &asset}, {other, &foreign}} {
		if err := db.QueryRow(ctx, `INSERT INTO media.asset (owner_user_id,object_key,mime_type,status,updated_at) VALUES ($1,gen_random_uuid()::text,'image/png','active',now()) RETURNING id::text`, row.owner).Scan(row.id); err != nil {
			t.Fatal(err)
		}
	}
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, `DELETE FROM learning.user_flashcard WHERE user_id=$1`, user)
		_, _ = db.Exec(ctx, `DELETE FROM learning.deck_card WHERE deck_id IN (SELECT id FROM learning.deck WHERE owner_user_id=$1)`, user)
		_, _ = db.Exec(ctx, `DELETE FROM learning.flashcard_variant WHERE source_type='custom' AND source_id IN (SELECT id FROM learning.deck WHERE owner_user_id=$1)`, user)
		_, _ = db.Exec(ctx, `DELETE FROM learning.deck WHERE owner_user_id=$1`, user)
		_, _ = db.Exec(ctx, `DELETE FROM media.asset WHERE id=ANY($1::uuid[])`, []string{asset, foreign})
	})
	var card DeckCardInput
	if err := json.Unmarshal([]byte(`{"frontText":"front","backText":"back","primaryImageAssetId":"`+asset+`"}`), &card); err != nil {
		t.Fatal(err)
	}
	store := NewStore(db)
	deck, err := store.CreateDeck(ctx, CreateDeckInput{UserID: user, Name: "test", Cards: []DeckCardInput{card}})
	if err != nil {
		t.Fatal(err)
	}
	var count int
	if err := db.QueryRow(ctx, `SELECT count(*) FROM learning.card_media_link ml JOIN learning.deck_card dc ON dc.card_id=ml.card_id WHERE dc.deck_id=$1 AND ml.asset_id=$2`, deck.ID, asset).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatalf("image link missing: got %d, want 1", count)
	}
	detail, err := store.GetDeck(ctx, user, deck.ID)
	if err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(detail)
	if err != nil {
		t.Fatal(err)
	}
	var response struct {
		Cards []struct {
			Card struct {
				PrimaryImage *struct {
					AssetID string  `json:"assetId"`
					ReadURL *string `json:"readUrl"`
				} `json:"primaryImage"`
			} `json:"card"`
		} `json:"cards"`
	}
	if err := json.Unmarshal(data, &response); err != nil {
		t.Fatal(err)
	}
	if len(response.Cards) != 1 || response.Cards[0].Card.PrimaryImage == nil || response.Cards[0].Card.PrimaryImage.AssetID != asset || response.Cards[0].Card.PrimaryImage.ReadURL == nil {
		t.Fatalf("missing image metadata: %s", data)
	}
	cardID := detail.Cards[0].Card.ID
	updated := []DeckCardInput{{CardID: cardID, FrontText: "updated", BackText: "back"}}
	if _, err := store.UpdateDeck(ctx, user, deck.ID, UpdateDeckInput{Cards: &updated}); err != nil {
		t.Fatal(err)
	}
	detail, err = store.GetDeck(ctx, user, deck.ID)
	if err != nil || detail.Cards[0].Card.PrimaryImage == nil || detail.Cards[0].Card.PrimaryImage.AssetID != asset {
		t.Fatalf("image lost after text edit: %#v, %v", detail, err)
	}
	updated[0].PrimaryImageAssetID = &foreign
	updated[0].FrontText = "must roll back"
	if _, err := store.UpdateDeck(ctx, user, deck.ID, UpdateDeckInput{Cards: &updated}); !errors.Is(err, ErrNotOwner) {
		t.Fatalf("foreign asset: got %v, want ErrNotOwner", err)
	}
	detail, err = store.GetDeck(ctx, user, deck.ID)
	if err != nil || detail.Cards[0].Card.FrontText != "updated" || detail.Cards[0].Card.PrimaryImage.AssetID != asset {
		t.Fatalf("failed update did not roll back: %#v, %v", detail, err)
	}
	if _, err := store.UpdateDeck(ctx, other, deck.ID, UpdateDeckInput{Cards: &updated}); !errors.Is(err, ErrNotOwner) {
		t.Fatalf("foreign deck update: got %v, want ErrNotOwner", err)
	}
	token, err := store.ShareDeck(ctx, user, deck.ID)
	if err != nil {
		t.Fatal(err)
	}
	clone, err := store.CloneDeck(ctx, user, *token)
	if err != nil {
		t.Fatal(err)
	}
	updated = []DeckCardInput{{CardID: cardID, FrontText: "after clone", BackText: "back"}}
	if _, err := store.UpdateDeck(ctx, user, deck.ID, UpdateDeckInput{Cards: &updated}); err != nil {
		t.Fatal(err)
	}
	clonedDetail, err := store.GetDeck(ctx, user, clone.ID)
	if err != nil || len(clonedDetail.Cards) != 1 || clonedDetail.Cards[0].Card.FrontText != "updated" || clonedDetail.Cards[0].Card.PrimaryImage == nil || clonedDetail.Cards[0].Card.PrimaryImage.AssetID != asset {
		t.Fatalf("shared card changed: %#v, %v", clonedDetail, err)
	}
	// Removing an image from the clone must leave the source card untouched.
	remove := []DeckCardInput{{CardID: clonedDetail.Cards[0].Card.ID, RemovePrimaryImage: true}}
	if _, err := store.UpdateDeck(ctx, user, clone.ID, UpdateDeckInput{Cards: &remove}); err != nil {
		t.Fatal(err)
	}
	clonedDetail, err = store.GetDeck(ctx, user, clone.ID)
	if err != nil || clonedDetail.Cards[0].Card.PrimaryImage != nil {
		t.Fatalf("image remains on clone: %#v, %v", clonedDetail, err)
	}
	detail, err = store.GetDeck(ctx, user, deck.ID)
	if err != nil || detail.Cards[0].Card.PrimaryImage == nil {
		t.Fatalf("source image lost: %#v, %v", detail, err)
	}
}

// Attaching an image to a canonical card forks it into a deck-owned copy; the
// learner must keep their review progress on that copy.
func TestImageForkKeepsReviewProgress(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Fatal("TEST_DATABASE_URL required; run with scripts/quality/with-test-db.sh")
	}
	ctx := context.Background()
	db, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(db.Close)
	var user, lexeme, canonical, asset string
	if err := db.QueryRow(ctx, `SELECT gen_random_uuid()::text,gen_random_uuid()::text`).Scan(&user, &lexeme); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO content.lexeme (id, headword, short_meaning_vi, jlpt_level, created_at, updated_at) VALUES ($1, '画像', 'hình ảnh', 'N5', NOW(), NOW())`, lexeme); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(ctx, `INSERT INTO learning.flashcard_variant (source_type, source_id, front_text, back_text, status, updated_at) VALUES ('lexeme', $1, '画像', 'hình ảnh', 'active', NOW()) RETURNING id::text`, lexeme).Scan(&canonical); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(ctx, `INSERT INTO media.asset (owner_user_id,object_key,mime_type,status,updated_at) VALUES ($1,gen_random_uuid()::text,'image/png','active',now()) RETURNING id::text`, user).Scan(&asset); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, `DELETE FROM learning.user_flashcard WHERE user_id=$1`, user)
		_, _ = db.Exec(ctx, `DELETE FROM learning.deck_card WHERE deck_id IN (SELECT id FROM learning.deck WHERE owner_user_id=$1)`, user)
		_, _ = db.Exec(ctx, `DELETE FROM learning.flashcard_variant WHERE (source_type='custom' AND source_id IN (SELECT id FROM learning.deck WHERE owner_user_id=$1)) OR id=$2`, user, canonical)
		_, _ = db.Exec(ctx, `DELETE FROM learning.deck WHERE owner_user_id=$1`, user)
		_, _ = db.Exec(ctx, `DELETE FROM content.lexeme WHERE id=$1`, lexeme)
		_, _ = db.Exec(ctx, `DELETE FROM media.asset WHERE id=$1`, asset)
	})
	store := NewStore(db)
	deck, err := store.CreateDeck(ctx, CreateDeckInput{UserID: user, Name: "canonical", Cards: []DeckCardInput{{CardID: canonical}}})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `UPDATE learning.user_flashcard SET state='review',interval_days=9,ease_factor=2.1,repetitions=4,lapses=1 WHERE user_id=$1 AND card_id=$2`, user, canonical); err != nil {
		t.Fatal(err)
	}
	updated := []DeckCardInput{{CardID: canonical, FrontText: "画像", BackText: "hình ảnh", PrimaryImageAssetID: &asset}}
	if _, err := store.UpdateDeck(ctx, user, deck.ID, UpdateDeckInput{Cards: &updated}); err != nil {
		t.Fatal(err)
	}
	detail, err := store.GetDeck(ctx, user, deck.ID)
	if err != nil || len(detail.Cards) != 1 || detail.Cards[0].Card.ID == canonical || detail.Cards[0].Card.PrimaryImage == nil || detail.Cards[0].Card.PrimaryImage.AssetID != asset {
		t.Fatalf("image did not fork the canonical card: %#v, %v", detail, err)
	}
	var state string
	var interval, repetitions, lapses int
	var ease float64
	if err := db.QueryRow(ctx, `SELECT state,interval_days,repetitions,lapses,ease_factor FROM learning.user_flashcard WHERE user_id=$1 AND card_id=$2`, user, detail.Cards[0].Card.ID).Scan(&state, &interval, &repetitions, &lapses, &ease); err != nil {
		t.Fatal(err)
	}
	if state != "review" || interval != 9 || repetitions != 4 || lapses != 1 || ease != 2.1 {
		t.Fatalf("review progress lost after image change: state=%s interval=%d repetitions=%d lapses=%d ease=%v", state, interval, repetitions, lapses, ease)
	}
}

// Editing a cloned custom card must preserve the editor's schedule without changing the source owner.
func TestCloneEditKeepsReviewProgress(t *testing.T) {
	for _, keepOriginal := range []bool{false, true} {
		name := "no other owned deck"
		if keepOriginal {
			name = "another owned deck"
		}
		t.Run(name, func(t *testing.T) { testCloneEditKeepsReviewProgress(t, keepOriginal) })
	}
}

func testCloneEditKeepsReviewProgress(t *testing.T, keepOriginal bool) {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Fatal("TEST_DATABASE_URL required; run with scripts/quality/with-test-db.sh")
	}
	ctx := context.Background()
	db, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(db.Close)
	var owner, learner string
	if err := db.QueryRow(ctx, `SELECT gen_random_uuid()::text,gen_random_uuid()::text`).Scan(&owner, &learner); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		for _, q := range []string{
			`DELETE FROM learning.user_flashcard WHERE user_id IN ($1,$2)`,
			`DELETE FROM learning.deck_card WHERE deck_id IN (SELECT id FROM learning.deck WHERE owner_user_id IN ($1,$2))`,
			`DELETE FROM learning.flashcard_variant WHERE source_type='custom' AND source_id IN (SELECT id FROM learning.deck WHERE owner_user_id IN ($1,$2))`,
			`DELETE FROM learning.deck WHERE owner_user_id IN ($1,$2)`,
		} {
			if _, err := db.Exec(ctx, q, owner, learner); err != nil {
				t.Errorf("cleanup: %v", err)
			}
		}
	})
	store := NewStore(db)
	source, err := store.CreateDeck(ctx, CreateDeckInput{UserID: owner, Name: "source", Visibility: "public", Cards: []DeckCardInput{{FrontText: "front", BackText: "back"}}})
	if err != nil {
		t.Fatal(err)
	}
	token, err := store.ShareDeck(ctx, owner, source.ID)
	if err != nil {
		t.Fatal(err)
	}
	clone, err := store.CloneDeck(ctx, learner, *token)
	if err != nil {
		t.Fatal(err)
	}
	if keepOriginal {
		if _, err := store.CloneDeck(ctx, learner, *token); err != nil {
			t.Fatal(err)
		}
	}
	detail, err := store.GetDeck(ctx, learner, clone.ID)
	if err != nil || len(detail.Cards) != 1 {
		t.Fatalf("clone detail = %#v, %v", detail, err)
	}
	original := detail.Cards[0].Card.ID
	// A card ID alone must not grant access to another owner's custom card.
	unrelated, err := store.CreateDeck(ctx, CreateDeckInput{UserID: learner, Name: "unrelated"})
	if err != nil {
		t.Fatal(err)
	}
	stolen := []DeckCardInput{{CardID: original, FrontText: "stolen", BackText: "back"}}
	if _, err := store.UpdateDeck(ctx, learner, unrelated.ID, UpdateDeckInput{Cards: &stolen}); !errors.Is(err, ErrNotOwner) {
		t.Fatalf("unlinked foreign card update = %v, want ErrNotOwner", err)
	}
	unchanged := []DeckCardInput{{CardID: original}}
	if _, err := store.UpdateDeck(ctx, learner, clone.ID, UpdateDeckInput{Cards: &unchanged}); err != nil {
		t.Fatalf("retain cloned card: %v", err)
	}
	if _, err := db.Exec(ctx, `UPDATE learning.user_flashcard SET state='review', due_at='2031-01-02 03:04:05+00', interval_days=9,ease_factor=2.1,repetitions=4,lapses=1,leeched=true,comeback_mode=true WHERE user_id=$1 AND card_id=$2`, learner, original); err != nil {
		t.Fatal(err)
	}
	var originalSRS, eventID string
	if err := db.QueryRow(ctx, `SELECT id::text FROM learning.user_flashcard WHERE user_id=$1 AND card_id=$2`, learner, original).Scan(&originalSRS); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(ctx, `INSERT INTO learning.review_event (user_id,user_flashcard_id,rating,previous_due_at,next_due_at) VALUES ($1,$2,'good',NOW(),NOW()) RETURNING id::text`, learner, originalSRS).Scan(&eventID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `UPDATE learning.user_flashcard SET state='learning',interval_days=3 WHERE user_id=$1 AND card_id=$2`, owner, original); err != nil {
		t.Fatal(err)
	}
	cards := []DeckCardInput{{CardID: original, FrontText: "edited", BackText: "back"}}
	if _, err := store.UpdateDeck(ctx, learner, clone.ID, UpdateDeckInput{Cards: &cards}); err != nil {
		t.Fatalf("edit cloned card: %v", err)
	}
	detail, err = store.GetDeck(ctx, learner, clone.ID)
	if err != nil || len(detail.Cards) != 1 || detail.Cards[0].Card.ID == original || detail.Cards[0].Card.FrontText != "edited" {
		t.Fatalf("edited clone = %#v, %v", detail, err)
	}
	// The public source remains studyable even when no other clone exists.
	historyCard := original
	var historyOK bool
	if err := db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM learning.review_event e JOIN learning.user_flashcard uf ON uf.id=e.user_flashcard_id WHERE e.id=$1 AND e.user_id=$2 AND uf.id=$3 AND uf.user_id=$2 AND uf.card_id=$4 AND e.rating='good')`, eventID, learner, originalSRS, historyCard).Scan(&historyOK); err != nil || !historyOK {
		t.Fatalf("review event %s linked to original SRS %s and card %s = %v, err = %v", eventID, originalSRS, historyCard, historyOK, err)
	}
	var matches bool
	if err := db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM learning.user_flashcard WHERE user_id=$1 AND card_id=$2 AND state='review' AND due_at='2031-01-02 03:04:05+00' AND interval_days=9 AND ease_factor=2.1 AND repetitions=4 AND lapses=1 AND leeched AND comeback_mode)`, learner, detail.Cards[0].Card.ID).Scan(&matches); err != nil || !matches {
		t.Fatalf("edited clone progress preserved = %v, err = %v", matches, err)
	}
	if err := db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM learning.user_flashcard WHERE user_id=$1 AND card_id=$2 AND state='review' AND interval_days=9 AND repetitions=4)`, learner, original).Scan(&matches); err != nil || !matches {
		t.Fatalf("original learner progress present = %v, want true, err = %v", matches, err)
	}
	var originalCount int
	if err := db.QueryRow(ctx, `SELECT count(*) FROM learning.user_flashcard WHERE user_id=$1 AND card_id=$2`, learner, original).Scan(&originalCount); err != nil || originalCount != 1 {
		t.Fatalf("original learner SRS count = %d, want 1, err = %v", originalCount, err)
	}
	if err := db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM learning.user_flashcard WHERE user_id=$1 AND card_id=$2 AND state='learning' AND interval_days=3)`, owner, original).Scan(&matches); err != nil || !matches {
		t.Fatalf("source owner progress unchanged = %v, err = %v", matches, err)
	}
	sourceDetail, err := store.GetDeck(ctx, learner, source.ID)
	if err != nil || len(sourceDetail.Cards) != 1 || sourceDetail.Cards[0].Card.ID != original || sourceDetail.Cards[0].Card.FrontText != "front" {
		t.Fatalf("source card changed: %#v, %v", sourceDetail, err)
	}
}

func TestSelectedImageMetadata(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Fatal("TEST_DATABASE_URL required; run with scripts/quality/with-test-db.sh")
	}
	ctx := context.Background()
	db, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(db.Close)
	var user string
	if err := db.QueryRow(ctx, `SELECT gen_random_uuid()::text`).Scan(&user); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(ctx, `DELETE FROM learning.user_flashcard WHERE user_id=$1`, user)
		_, _ = db.Exec(ctx, `DELETE FROM learning.deck_card WHERE deck_id IN (SELECT id FROM learning.deck WHERE owner_user_id=$1)`, user)
		_, _ = db.Exec(ctx, `DELETE FROM learning.flashcard_variant WHERE source_type='custom' AND source_id IN (SELECT id FROM learning.deck WHERE owner_user_id=$1)`, user)
		_, _ = db.Exec(ctx, `DELETE FROM learning.deck WHERE owner_user_id=$1`, user)
		_, _ = db.Exec(ctx, `DELETE FROM media.asset WHERE owner_user_id=$1`, user)
	})
	// wantURL "owner-preview" means the owner-only private preview route; "" means no image URL.
	cases := []struct {
		name, provider, provenance string
		wantURL, wantAuthor        string
	}{
		{"unsplash", "unsplash", `{"provider":"unsplash","delivery":"hotlink","imageUrl":"https://images.unsplash.com/photo-1","sourceUrl":"https://unsplash.com/photos/one?utm_source=kotobaworks&utm_medium=referral","author":"Alice","authorUrl":"https://unsplash.com/@alice?utm_source=kotobaworks&utm_medium=referral","license":"Unsplash License","licenseUrl":"https://unsplash.com/license"}`, "https://images.unsplash.com/photo-1", "Alice"},
		{"unsafe host", "unsplash", `{"provider":"unsplash","delivery":"hotlink","imageUrl":"https://images.unsplash.com.evil.test/photo","sourceUrl":"https://unsplash.com/photos/one","author":"Alice","authorUrl":"https://unsplash.com/@alice","license":"Unsplash License","licenseUrl":"https://unsplash.com/license"}`, "", ""},
		{"pixabay", "pixabay", `{"provider":"pixabay","delivery":"rehosted","imageUrl":"https://cdn.pixabay.com/photo/a.png","sourceUrl":"https://pixabay.com/photos/a","author":"Bob","license":"Pixabay Content License","licenseUrl":"https://pixabay.com/service/license-summary/"}`, "owner-preview", "Bob"},
		{"pexels", "pexels", `{"provider":"pexels","delivery":"rehosted","imageUrl":"https://images.pexels.com/photos/1/a.jpeg","sourceUrl":"https://www.pexels.com/photo/a/","author":"Carol","license":"Pexels License"}`, "owner-preview", "Carol"},
		{"wikimedia", "wikimedia", `{"provider":"wikimedia","delivery":"rehosted","imageUrl":"https://thumb.wikimedia.org/a.jpg","sourceUrl":"https://commons.wikimedia.org/wiki/File:A.jpg","author":"Dave","license":"CC BY 4.0","licenseUrl":"https://creativecommons.org/licenses/by/4.0/"}`, "owner-preview", "Dave"},
		{"invalid rehosted provenance stays hidden", "pexels", `{"provider":"pexels","delivery":"rehosted","imageUrl":"https://evil.test/a.jpeg","sourceUrl":"https://www.pexels.com/photo/a/","author":"Carol","license":"Pexels License"}`, "", ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var asset string
			if err := db.QueryRow(ctx, `INSERT INTO media.asset(owner_user_id,object_key,mime_type,provider,provenance,status,rights_status,updated_at) VALUES ($1,gen_random_uuid()::text,'image/png',$2,$3::jsonb,'pending_review','pending_review',now()) RETURNING id::text`, user, tc.provider, tc.provenance).Scan(&asset); err != nil {
				t.Fatal(err)
			}
			s := NewStore(db)
			deck, err := s.CreateDeck(ctx, CreateDeckInput{UserID: user, Name: tc.name, Cards: []DeckCardInput{{FrontText: "front", BackText: "back", PrimaryImageAssetID: &asset}}})
			if err != nil {
				t.Fatal(err)
			}
			detail, err := s.GetDeck(ctx, user, deck.ID)
			if err != nil {
				t.Fatal(err)
			}
			data, err := json.Marshal(detail.Cards[0].Card.PrimaryImage)
			if err != nil {
				t.Fatal(err)
			}
			var got struct {
				ReadURL *string `json:"readUrl"`
				Author  string  `json:"author"`
			}
			if err := json.Unmarshal(data, &got); err != nil {
				t.Fatal(err)
			}
			readURL := ""
			if got.ReadURL != nil {
				readURL = *got.ReadURL
			}
			wantURL := tc.wantURL
			if wantURL == "owner-preview" {
				wantURL = "/api/media/" + asset + "/private-preview"
			}
			if readURL != wantURL || got.Author != tc.wantAuthor {
				t.Fatalf("image metadata = %s, want URL %q author %q", data, wantURL, tc.wantAuthor)
			}
			var status string
			if err := db.QueryRow(ctx, `SELECT status FROM media.asset WHERE id=$1`, asset).Scan(&status); err != nil || status != "pending_review" {
				t.Fatalf("status=%q err=%v", status, err)
			}
		})
	}
}

func TestSelectedImageRejectsUntrustedAttribution(t *testing.T) {
	for _, raw := range []string{
		`{"provider":"unsplash","delivery":"hotlink","imageUrl":"https://images.unsplash.com/photo","sourceUrl":"https://unsplash.com.evil.test/photos/a","author":"Alice","authorUrl":"https://unsplash.com/@alice","license":"Unsplash License"}`,
		`{"provider":"unsplash","delivery":"hotlink","imageUrl":"https://images.unsplash.com/photo","sourceUrl":"https://unsplash.com/photos/a","author":"Alice","authorUrl":"https://unsplash.com/@alice","license":"Unsplash License","licenseUrl":"https://attacker.example/"}`,
		`{"provider":"unsplash","delivery":"hotlink","imageUrl":"https://user@images.unsplash.com/photo","sourceUrl":"https://unsplash.com/photos/a","author":"Alice","authorUrl":"https://unsplash.com/@alice","license":"Unsplash License"}`,
	} {
		image := &DeckCardImage{}
		PopulateSelectedImage(image, "unsplash", []byte(raw))
		if image.ReadURL != nil || image.Author != "" || image.SourceURL != "" {
			t.Fatalf("untrusted attribution exposed: %#v", image)
		}
	}
}
