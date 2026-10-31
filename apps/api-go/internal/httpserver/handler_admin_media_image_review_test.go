package httpserver

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/flashcarddeck"
)

func TestIMG301AdminImageRightsReview(t *testing.T) {
	f := newAudit159MediaFixture(t)
	ctx := context.Background()
	for _, tc := range []struct{ name, provider, delivery, mime, initial, rights, want string }{
		{"pixabay", "pixabay", "rehosted", "image/jpeg", "pending_review", "cleared", "active"},
		{"pexels", "pexels", "rehosted", "image/png", "pending_review", "cleared", "active"},
		{"wikimedia", "wikimedia", "rehosted", "image/png", "pending_review", "cleared", "active"},
		{"unsplash cleared", "unsplash", "hotlink", "image/jpeg", "pending_review", "cleared", "active"},
		{"unsplash blocked", "unsplash", "hotlink", "image/jpeg", "pending_review", "blocked", "blocked"},
		{"unsplash revoked", "unsplash", "hotlink", "image/jpeg", "active", "blocked", "blocked"},
		{"unsplash recleared", "unsplash", "hotlink", "image/jpeg", "blocked", "cleared", "active"},
		{"unsplash wrong delivery", "unsplash", "rehosted", "image/jpeg", "pending_review", "cleared", "pending_review"},
		{"pending", "pixabay", "rehosted", "image/png", "pending_review", "pending_review", "pending_review"},
		{"blocked pending", "pexels", "rehosted", "image/png", "pending_review", "blocked", "blocked"},
		{"revoked", "pixabay", "rehosted", "image/png", "active", "blocked", "blocked"},
		{"recleared", "pixabay", "rehosted", "image/png", "blocked", "cleared", "active"},
		{"unrelated asset", "pixabay", "rehosted", "image/png", "pending_review", "cleared", "pending_review"},
		{"other provider", "other", "rehosted", "image/png", "pending_review", "cleared", "pending_review"},
		{"hotlink", "pixabay", "hotlink", "image/png", "pending_review", "cleared", "pending_review"},
		{"non-image", "pixabay", "rehosted", "text/plain", "pending_review", "cleared", "pending_review"},
		{"deleted", "pixabay", "rehosted", "image/png", "deleted", "cleared", "deleted"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			id := newUUID(t)
			key := "image-selection/" + id
			if tc.name == "unrelated asset" {
				key = "other/" + id
			}
			_, err := f.db.Exec(ctx, `INSERT INTO media.asset(id,object_key,mime_type,provider,provenance,status,rights_status,updated_at) VALUES($1,$2,$3,$4,jsonb_build_object('delivery',$5::text),$6,'pending_review',now())`, id, key, tc.mime, tc.provider, tc.delivery, tc.initial)
			if err != nil {
				t.Fatal(err)
			}
			t.Cleanup(func() {
				_, _ = f.db.Exec(ctx, `DELETE FROM ops.admin_audit_log WHERE target_id=$1`, id)
				_, _ = f.db.Exec(ctx, `DELETE FROM media.asset WHERE id=$1`, id)
			})
			res := f.call(t, http.MethodPatch, "/api/admin/media/"+id+"/metadata", fmt.Sprintf(`{"rightsStatus":%q,"reason":"review rights"}`, tc.rights))
			if res.Code != http.StatusOK {
				t.Fatalf("review status=%d body=%s", res.Code, res.Body.String())
			}
			var status, rights, before, after string
			err = f.db.QueryRow(ctx, `SELECT a.status,a.rights_status,COALESCE(l.before->>'status',''),COALESCE(l.after->>'status','') FROM media.asset a JOIN ops.admin_audit_log l ON l.target_id=a.id::text AND l.actor_id=$2 AND l.action='media.metadata.updated' WHERE a.id=$1`, id, f.actorID).Scan(&status, &rights, &before, &after)
			if err != nil || status != tc.want || rights != tc.rights || before != tc.initial || after != tc.want {
				t.Fatalf("review(%s) status=%q rights=%q audit=%q -> %q err=%v; want %q %q %q -> %q", tc.name, status, rights, before, after, err, tc.want, tc.rights, tc.initial, tc.want)
			}
		})
	}
}

func TestIMG301UnsplashRightsReviewDeckVisibility(t *testing.T) {
	f := newAudit159MediaFixture(t)
	ctx := context.Background()
	owner, viewer := newUUID(t), newUUID(t)
	provenance := `{"provider":"unsplash","delivery":"hotlink","imageUrl":"https://images.unsplash.com/photo-1","sourceUrl":"https://unsplash.com/photos/one","author":"Alice","authorUrl":"https://unsplash.com/@alice","license":"Unsplash License"}`
	_, err := f.db.Exec(ctx, `UPDATE media.asset SET owner_user_id=$2, object_key=$3, provider='unsplash', provenance=$4::jsonb, status='pending_review', rights_status='pending_review' WHERE id=$1`, f.assetID, owner, "image-selection/"+f.assetID, provenance)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		for _, q := range []string{
			`DELETE FROM learning.user_flashcard WHERE user_id=$1`,
			`DELETE FROM learning.deck_card WHERE deck_id IN (SELECT id FROM learning.deck WHERE owner_user_id=$1)`,
			`DELETE FROM learning.flashcard_variant WHERE source_type='custom' AND source_id IN (SELECT id FROM learning.deck WHERE owner_user_id=$1)`,
			`DELETE FROM learning.deck WHERE owner_user_id=$1`,
		} {
			if _, err := f.db.Exec(ctx, q, owner); err != nil {
				t.Errorf("cleanup: %v", err)
			}
		}
	})
	store := flashcarddeck.NewStore(f.db)
	deck, err := store.CreateDeck(ctx, flashcarddeck.CreateDeckInput{UserID: owner, Name: "rights review", Cards: []flashcarddeck.DeckCardInput{{FrontText: "front", BackText: "back", PrimaryImageAssetID: &f.assetID}}})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := f.db.Exec(ctx, `UPDATE learning.deck SET visibility='public' WHERE id=$1`, deck.ID); err != nil {
		t.Fatal(err)
	}
	check := func(viewerID string, visible bool) {
		t.Helper()
		detail, err := store.GetDeck(ctx, viewerID, deck.ID)
		if err != nil || len(detail.Cards) != 1 {
			t.Fatalf("get deck: detail=%#v err=%v", detail, err)
		}
		image := detail.Cards[0].Card.PrimaryImage
		if visible && (image == nil || image.ReadURL == nil || *image.ReadURL != "https://images.unsplash.com/photo-1") {
			t.Fatalf("viewer %s: expected Unsplash image, got %#v", viewerID, image)
		}
		if !visible && image != nil {
			t.Fatalf("viewer %s: expected no image, got %#v", viewerID, image)
		}
	}
	check(owner, true)
	check(viewer, false)
	for _, step := range []struct {
		rights, before, after string
		visible               bool
	}{{"cleared", "pending_review", "active", true}, {"blocked", "active", "blocked", false}, {"cleared", "blocked", "active", true}} {
		res := f.call(t, http.MethodPatch, "/api/admin/media/"+f.assetID+"/metadata", fmt.Sprintf(`{"rightsStatus":%q,"reason":"review rights"}`, step.rights))
		if res.Code != http.StatusOK {
			t.Fatalf("review %s status=%d body=%s", step.rights, res.Code, res.Body.String())
		}
		var status string
		var count int
		err := f.db.QueryRow(ctx, `SELECT status, (SELECT count(*) FROM ops.admin_audit_log WHERE target_id=($1::uuid)::text AND actor_id=$2 AND action='media.metadata.updated' AND reason='review rights' AND before->>'status'=$3 AND after->>'status'=$4 AND after->>'rights_status'=$5) FROM media.asset WHERE id=$1::uuid`, f.assetID, f.actorID, step.before, step.after, step.rights).Scan(&status, &count)
		if err != nil || status != step.after || count != 1 {
			t.Errorf("review %s status=%q audit count=%d err=%v", step.rights, status, count, err)
		}
		check(owner, step.visible)
		check(viewer, step.visible)
	}
	res := f.call(t, http.MethodDelete, "/api/admin/media/"+f.assetID, `{"reason":"remove asset"}`)
	if res.Code != http.StatusOK {
		t.Fatalf("delete status=%d body=%s", res.Code, res.Body.String())
	}
	res = f.call(t, http.MethodPatch, "/api/admin/media/"+f.assetID+"/metadata", `{"rightsStatus":"cleared","reason":"review rights"}`)
	if res.Code != http.StatusOK {
		t.Fatalf("review deleted status=%d body=%s", res.Code, res.Body.String())
	}
	var status string
	var count int
	err = f.db.QueryRow(ctx, `SELECT status, (SELECT count(*) FROM ops.admin_audit_log WHERE target_id=($1::uuid)::text AND actor_id=$2 AND action='media.metadata.updated' AND before->>'status'='deleted' AND after->>'status'='deleted' AND after->>'rights_status'='cleared') FROM media.asset WHERE id=$1::uuid`, f.assetID, f.actorID).Scan(&status, &count)
	if err != nil || status != "deleted" || count != 1 {
		t.Fatalf("review deleted status=%q audit count=%d err=%v", status, count, err)
	}
	check(owner, false)
	check(viewer, false)
}

func TestIMG301ImageRightsAuditFailureRollsBack(t *testing.T) {
	for _, tc := range []struct{ provider, delivery string }{{"pexels", "rehosted"}, {"unsplash", "hotlink"}} {
		t.Run(tc.provider, func(t *testing.T) {
			f := newAudit159MediaFixture(t)
			ctx := context.Background()
			_, err := f.db.Exec(ctx, `UPDATE media.asset SET object_key=$2, provider=$3, provenance=jsonb_build_object('delivery',$4::text), status='pending_review', rights_status='pending_review' WHERE id=$1`, f.assetID, "image-selection/"+f.assetID, tc.provider, tc.delivery)
			if err != nil {
				t.Fatal(err)
			}
			res := f.call(t, http.MethodPatch, "/api/admin/media/"+f.assetID+"/metadata", `{"rightsStatus":"cleared","reason":"bad\u0000reason"}`)
			if res.Code != http.StatusInternalServerError {
				t.Fatalf("audit failure status=%d body=%s", res.Code, res.Body.String())
			}
			var status, rights string
			var count int
			err = f.db.QueryRow(ctx, `SELECT status,rights_status,(SELECT count(*) FROM ops.admin_audit_log WHERE target_id=($1::uuid)::text) FROM media.asset WHERE id=$1::uuid`, f.assetID).Scan(&status, &rights, &count)
			if err != nil || status != "pending_review" || rights != "pending_review" || count != 0 {
				t.Fatalf("rollback status=%q rights=%q audits=%d err=%v", status, rights, count, err)
			}
		})
	}
}
