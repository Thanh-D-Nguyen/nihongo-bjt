package lifefeed

import (
	"context"
	"encoding/json"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

func geographyPublisherFixture(t *testing.T) (*pgxpool.Pool, string, string) {
	t.Helper()
	connection := os.Getenv("TEST_DATABASE_URL")
	if connection == "" {
		t.Fatal("TEST_DATABASE_URL required; run with scripts/quality/with-test-db.sh")
	}
	db, err := pgxpool.New(context.Background(), connection)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(db.Close)
	actor, role := uuid.NewString(), uuid.NewString()
	ctx := context.Background()
	for _, statement := range []struct {
		sql  string
		args []any
	}{
		{`INSERT INTO authz.admin_actor(id,email,display_name,status,updated_at) VALUES($1,$2,'Geography reviewer','active',NOW())`, []any{actor, actor + "@example.test"}},
		{`INSERT INTO authz.admin_role(id,code,name,status) VALUES($1,$2,'Geography publisher test','active')`, []any{role, role}},
		{`INSERT INTO authz.admin_permission(code) VALUES('admin.content.write') ON CONFLICT(code) DO NOTHING`, nil},
		{`INSERT INTO authz.admin_actor_role(actor_id,role_id) VALUES($1,$2)`, []any{actor, role}},
		{`INSERT INTO authz.admin_role_permission(role_id,permission_id) SELECT $1,id FROM authz.admin_permission WHERE code='admin.content.write'`, []any{role}},
	} {
		if _, err := db.Exec(ctx, statement.sql, statement.args...); err != nil {
			t.Fatal(err)
		}
	}
	t.Cleanup(func() {
		for _, statement := range []struct {
			sql string
			id  string
		}{
			{`DELETE FROM daily.life_lesson WHERE reviewer_id=$1`, actor},
			{`DELETE FROM ops.admin_audit_log WHERE actor_id=$1`, actor},
			{`DELETE FROM authz.admin_actor WHERE id=$1`, actor},
			{`DELETE FROM authz.admin_role WHERE id=$1`, role},
		} {
			if _, err := db.Exec(ctx, statement.sql, statement.id); err != nil {
				t.Error(err)
			}
		}
	})
	return db, actor, role
}

func geographyCardsForTest(now time.Time) map[string]Card {
	cards := map[string]Card{}
	for _, place := range geographyPlaces {
		cards[place.city] = geographyCard(place.city, place.english, Source{
			ProviderName: "Wikidata CC0", URL: "https://www.wikidata.org/w/index.php?title=" + place.entity + "&oldid=12345",
			AttributionText: geographyAttribution, LicenseStatus: "commercial",
			ObservedAt: now.Add(-time.Hour), FetchedAt: now, ExpiresAt: now.Add(48 * time.Hour), Freshness: "live",
		})
	}
	return cards
}

func TestPublishGeographyRequiresApprovalAndPreservesManualHold(t *testing.T) {
	db, actor, role := geographyPublisherFixture(t)
	ctx := context.Background()
	now := time.Date(2040, 2, 20, 23, 0, 0, 0, JST)
	cards := geographyCardsForTest(now)
	if _, err := PublishGeography(ctx, db, actor, "", cards, now); err == nil {
		t.Fatal("source template was published without explicit approval")
	}
	if _, err := db.Exec(ctx, `UPDATE authz.admin_role SET status='disabled' WHERE id=$1`, role); err != nil {
		t.Fatal(err)
	}
	if _, err := PublishGeography(ctx, db, actor, GeographyTemplate, cards, now); err == nil {
		t.Fatal("inactive role authorized publication")
	}
	if _, err := db.Exec(ctx, `UPDATE authz.admin_role SET status='active' WHERE id=$1`, role); err != nil {
		t.Fatal(err)
	}
	bad := geographyCardsForTest(now)
	card := bad["tokyo"]
	card.Lesson.Sentences[0].Reading = ""
	bad["tokyo"] = card
	if _, err := PublishGeography(ctx, db, actor, GeographyTemplate, bad, now); err == nil {
		t.Fatal("invalid reading passed the publication boundary")
	}
	card = geographyCardsForTest(now)["naha"]
	card.Lesson.Sentences[0].Translations.Vi = "Nội dung đang chờ biên tập."
	raw, _ := json.Marshal(card)
	if _, err := db.Exec(ctx, `INSERT INTO daily.life_lesson(card_key,topic,city_id,valid_from,valid_until,source_expires_at,card,reviewer_id,updated_at) VALUES($1,'culture','naha','2040-02-20','2040-02-21',$2,$3,$4,NOW())`, card.ID, card.Lesson.Source.ExpiresAt, raw, actor); err != nil {
		t.Fatal(err)
	}
	if _, err := PublishGeography(ctx, db, actor, GeographyTemplate, cards, now); err == nil || !strings.Contains(err.Error(), "manual editorial hold or expired snapshot for naha") {
		t.Fatalf("expected the database editorial hold after preceding inserts, got %v", err)
	}
	var count int
	if err := db.QueryRow(ctx, `SELECT count(*) FROM daily.life_lesson WHERE reviewer_id=$1`, actor).Scan(&count); err != nil || count != 1 {
		t.Fatalf("failed batch was not rolled back: count=%d err=%v", count, err)
	}
	var preserved []byte
	if err := db.QueryRow(ctx, `SELECT card FROM daily.life_lesson WHERE card_key=$1`, card.ID).Scan(&preserved); err != nil {
		t.Fatal(err)
	}
	var got Card
	if err := json.Unmarshal(preserved, &got); err != nil || got.Lesson.Sentences[0].Translations.Vi != card.Lesson.Sentences[0].Translations.Vi {
		t.Fatal("manual content changed")
	}
}

func TestPublishGeographyIsAuditedIdempotentAndValidAcrossMidnight(t *testing.T) {
	db, actor, _ := geographyPublisherFixture(t)
	ctx := context.Background()
	now := time.Date(2040, 2, 22, 23, 0, 0, 0, JST)
	cards := geographyCardsForTest(now)
	for attempt, expected := range []int{10, 0} {
		inserted, err := PublishGeography(ctx, db, actor, GeographyTemplate, cards, now)
		if err != nil || inserted != expected {
			t.Fatalf("attempt %d: inserted=%d want=%d err=%v", attempt, inserted, expected, err)
		}
	}
	var auditCount, rowCount int
	if err := db.QueryRow(ctx, `SELECT count(*) FROM ops.admin_audit_log WHERE actor_id=$1 AND action='life_lesson.source_sync'`, actor).Scan(&auditCount); err != nil || auditCount != 1 {
		t.Fatalf("audit count=%d err=%v", auditCount, err)
	}
	if err := db.QueryRow(ctx, `SELECT count(*) FROM daily.life_lesson WHERE reviewer_id=$1 AND status='published' AND rights_status='cleared' AND valid_until='2040-02-23' AND source_expires_at>$2`, actor, now.Add(2*time.Hour)).Scan(&rowCount); err != nil || rowCount != 10 {
		t.Fatalf("midnight creates an availability gap: rows=%d err=%v", rowCount, err)
	}
	card := geographyCardsForTest(now)["tokyo"]
	card.Lesson.Sentences[0].Translations.Vi = "Biên tập viên đã cập nhật bản dịch."
	raw, _ := json.Marshal(card)
	if _, err := db.Exec(ctx, `UPDATE daily.life_lesson SET card=$2 WHERE card_key=$1`, card.ID, raw); err != nil {
		t.Fatal(err)
	}
	if n, err := PublishGeography(ctx, db, actor, GeographyTemplate, cards, now); err != nil || n != 0 {
		t.Fatalf("valid manual publication must take precedence: inserted=%d err=%v", n, err)
	}
	var preserved []byte
	if err := db.QueryRow(ctx, `SELECT card FROM daily.life_lesson WHERE card_key=$1`, card.ID).Scan(&preserved); err != nil {
		t.Fatal(err)
	}
	var got Card
	if err := json.Unmarshal(preserved, &got); err != nil || got.Lesson.Sentences[0].Translations.Vi != card.Lesson.Sentences[0].Translations.Vi {
		t.Fatal("manual published translation was overwritten")
	}
}
