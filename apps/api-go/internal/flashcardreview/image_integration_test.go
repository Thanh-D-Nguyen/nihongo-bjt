package flashcardreview

import (
	"context"
	"encoding/json"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kotobawork/nihongo-bjt/api-go/internal/flashcarddeck"
)

func TestDueImageMatchesDeckPrivacy(t *testing.T) {
	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL == "" {
		t.Fatal("TEST_DATABASE_URL required")
	}
	ctx := context.Background()
	db, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(db.Close)
	var owner, other string
	if err := db.QueryRow(ctx, `SELECT gen_random_uuid()::text,gen_random_uuid()::text`).Scan(&owner, &other); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if _, err := db.Exec(ctx, `DELETE FROM learning.user_flashcard WHERE user_id=$1`, other); err != nil {
			t.Errorf("cleanup: %v", err)
		}
		for _, q := range []string{
			`DELETE FROM learning.user_flashcard WHERE user_id=$1`,
			`DELETE FROM learning.deck_card WHERE deck_id IN (SELECT id FROM learning.deck WHERE owner_user_id=$1)`,
			`DELETE FROM learning.flashcard_variant WHERE source_type='custom' AND source_id IN (SELECT id FROM learning.deck WHERE owner_user_id=$1)`,
			`DELETE FROM learning.deck WHERE owner_user_id=$1`,
			`DELETE FROM media.asset WHERE owner_user_id=$1`,
		} {
			if _, err := db.Exec(ctx, q, owner); err != nil {
				t.Errorf("cleanup: %v", err)
			}
		}
	})
	cases := []struct{ name, provider, provenance, status string }{
		{"unsplash", "unsplash", `{"provider":"unsplash","delivery":"hotlink","imageUrl":"https://images.unsplash.com/photo-1","sourceUrl":"https://unsplash.com/photos/one","author":"Alice","authorUrl":"https://unsplash.com/@alice","license":"Unsplash License"}`, "pending_review"},
		{"unsafe", "unsplash", `{"provider":"unsplash","delivery":"hotlink","imageUrl":"https://images.unsplash.com.evil.test/photo","sourceUrl":"https://unsplash.com/photos/one","author":"Alice","authorUrl":"https://unsplash.com/@alice","license":"Unsplash License"}`, "pending_review"},
		{"pexels", "pexels", `{"provider":"pexels","delivery":"rehosted","imageUrl":"https://images.pexels.com/photos/1/a.jpeg","sourceUrl":"https://www.pexels.com/photo/a/","author":"Carol","license":"Pexels License"}`, "pending_review"},
		{"active", "local", `{}`, "active"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var asset string
			if err := db.QueryRow(ctx, `INSERT INTO media.asset(owner_user_id,object_key,mime_type,provider,provenance,status,rights_status,updated_at) VALUES ($1,gen_random_uuid()::text,'image/png',$2,$3::jsonb,$4,'pending_review',now()) RETURNING id::text`, owner, tc.provider, tc.provenance, tc.status).Scan(&asset); err != nil {
				t.Fatal(err)
			}
			decks := flashcarddeck.NewStore(db)
			deck, err := decks.CreateDeck(ctx, flashcarddeck.CreateDeckInput{UserID: owner, Name: tc.name, Cards: []flashcarddeck.DeckCardInput{{FrontText: tc.name, BackText: "back", PrimaryImageAssetID: &asset}}})
			if err != nil {
				t.Fatal(err)
			}
			detail, err := decks.GetDeck(ctx, owner, deck.ID)
			if err != nil {
				t.Fatal(err)
			}
			cards, err := NewStore(db).GetDueFlashcards(ctx, owner, 200)
			if err != nil {
				t.Fatal(err)
			}
			var found bool
			for _, card := range cards {
				if card.CardID == detail.Cards[0].Card.ID {
					found = true
					payload, err := json.Marshal(card)
					if err != nil {
						t.Fatal(err)
					}
					var response struct {
						PrimaryImage json.RawMessage `json:"primaryImage"`
					}
					if err := json.Unmarshal(payload, &response); err != nil {
						t.Fatal(err)
					}
					want, err := json.Marshal(detail.Cards[0].Card.PrimaryImage)
					if err != nil {
						t.Fatal(err)
					}
					if string(response.PrimaryImage) != string(want) {
						t.Fatalf("due image = %s, deck image = %s", response.PrimaryImage, want)
					}
				}
			}
			if !found {
				t.Fatal("due card missing")
			}
			if _, err := db.Exec(ctx, `UPDATE learning.deck SET visibility='public' WHERE id=$1`, deck.ID); err != nil {
				t.Fatal(err)
			}
			if _, err := db.Exec(ctx, `INSERT INTO learning.user_flashcard(user_id,card_id,updated_at) VALUES ($1,$2,NOW())`, other, detail.Cards[0].Card.ID); err != nil {
				t.Fatal(err)
			}
			otherDeck, err := decks.GetDeck(ctx, other, deck.ID)
			if err != nil {
				t.Fatal(err)
			}
			otherCards, err := NewStore(db).GetDueFlashcards(ctx, other, 200)
			if err != nil {
				t.Fatal(err)
			}
			for _, card := range otherCards {
				if card.CardID == detail.Cards[0].Card.ID {
					payload, _ := json.Marshal(card)
					var response struct {
						PrimaryImage json.RawMessage `json:"primaryImage"`
					}
					_ = json.Unmarshal(payload, &response)
					want, _ := json.Marshal(otherDeck.Cards[0].Card.PrimaryImage)
					if string(response.PrimaryImage) != string(want) {
						t.Fatalf("other due image = %s, deck image = %s", response.PrimaryImage, want)
					}
					return
				}
			}
			t.Fatal("other due card missing")
		})
	}
}
