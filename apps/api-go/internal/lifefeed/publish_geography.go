package lifefeed

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"reflect"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PublishGeography creates today's reviewed snapshot once. Existing editorial work
// is authoritative; a draft/blocked/expired collision stops the batch for review.
func PublishGeography(ctx context.Context, db *pgxpool.Pool, actor, approvedTemplate string, cards map[string]Card, now time.Time) (int, error) {
	if approvedTemplate != GeographyTemplate || len(cards) != len(geographyPlaces) {
		return 0, fmt.Errorf("explicit template approval and all ten verified cities are required")
	}
	if _, err := uuid.Parse(actor); err != nil {
		return 0, fmt.Errorf("a valid approved publisher actor is required")
	}
	for _, place := range geographyPlaces {
		card := cards[place.city]
		source := card.Lesson.Source
		uri, err := url.Parse(source.URL)
		if err != nil || uri.Scheme != "https" || uri.Host != "www.wikidata.org" || uri.Path != "/w/index.php" || uri.User != nil || uri.Fragment != "" || uri.Query().Get("title") != place.entity || len(uri.Query()) != 2 {
			return 0, fmt.Errorf("unverified source URL for %s", place.city)
		}
		revision, err := strconv.ParseInt(uri.Query().Get("oldid"), 10, 64)
		if err != nil || revision <= 0 || source.ProviderName != "Wikidata CC0" || source.LicenseStatus != "commercial" || source.AttributionText != geographyAttribution || !source.ExpiresAt.Equal(source.FetchedAt.Add(48*time.Hour)) || source.FetchedAt.Before(now.Add(-10*time.Minute)) || source.FetchedAt.In(JST).Format("2006-01-02") != now.In(JST).Format("2006-01-02") {
			return 0, fmt.Errorf("unverified source freshness/license for %s", place.city)
		}
		if _, err := PreparePublishedCard(card, now); err != nil {
			return 0, fmt.Errorf("invalid lesson for %s: %w", place.city, err)
		}
		if !reflect.DeepEqual(card, geographyCard(place.city, place.english, source)) {
			return 0, fmt.Errorf("lesson differs from the approved Japanese template for %s", place.city)
		}
	}
	tx, err := db.Begin(ctx)
	if err != nil {
		return 0, fmt.Errorf("begin geography publication: %w", err)
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext('life-feed-geography-sync'))`); err != nil {
		return 0, err
	}
	var allowed bool
	if err = tx.QueryRow(ctx, `SELECT EXISTS (
SELECT 1 FROM authz.admin_actor a
JOIN authz.admin_actor_role ar ON ar.actor_id=a.id
JOIN authz.admin_role r ON r.id=ar.role_id AND r.status='active'
JOIN authz.admin_role_permission rp ON rp.role_id=r.id
JOIN authz.admin_permission p ON p.id=rp.permission_id
WHERE a.id=$1::uuid AND a.status='active' AND p.code IN ('*','admin.content.write'))`, actor).Scan(&allowed); err != nil || !allowed {
		return 0, fmt.Errorf("approved publisher is not active or lacks content-write permission")
	}
	inserted, keys := 0, make([]string, 0, len(cards))
	for _, place := range geographyPlaces {
		card := cards[place.city]
		raw, err := json.Marshal(card)
		if err != nil {
			return 0, err
		}
		source := card.Lesson.Source
		from := source.FetchedAt.In(JST).Format("2006-01-02")
		until := source.FetchedAt.In(JST).AddDate(0, 0, 1).Format("2006-01-02")
		result, err := tx.Exec(ctx, `INSERT INTO daily.life_lesson
(card_key,topic,city_id,valid_from,valid_until,status,rights_status,reviewer_id,source_url,card,source_expires_at,published_at,created_at,updated_at)
VALUES($1,'culture',$2,$3::date,$4::date,'published','cleared',$5::uuid,$6,$7,$8,NOW(),NOW(),NOW())
ON CONFLICT(card_key) DO NOTHING`, card.ID, place.city, from, until, actor, source.URL, raw, source.ExpiresAt)
		if err != nil {
			return 0, fmt.Errorf("publish geography for %s: %w", place.city, err)
		}
		if result.RowsAffected() == 0 {
			var existing []byte
			err := tx.QueryRow(ctx, `SELECT card FROM daily.life_lesson WHERE card_key=$1
AND status='published' AND rights_status='cleared' AND reviewer_id IS NOT NULL
AND city_id=$2 AND valid_from<=$3::date AND valid_until>=$3::date AND source_expires_at>$4`, card.ID, place.city, from, now).Scan(&existing)
			var published Card
			if err != nil || json.Unmarshal(existing, &published) != nil {
				return 0, fmt.Errorf("manual editorial hold or expired snapshot for %s; no existing content was overwritten", place.city)
			}
			if _, err := PreparePublishedCard(published, now); err != nil {
				return 0, fmt.Errorf("existing lesson requires editorial review for %s", place.city)
			}
		} else {
			inserted++
			keys = append(keys, card.ID)
		}
	}
	if inserted > 0 {
		after, _ := json.Marshal(map[string]any{"template": GeographyTemplate, "source": "Wikidata CC0", "inserted": inserted, "cardKeys": keys, "fetchedAt": cards["tokyo"].Lesson.Source.FetchedAt})
		_, err := tx.Exec(ctx, `INSERT INTO ops.admin_audit_log(action,actor_id,target_type,target_id,reason,after,created_at)
VALUES('life_lesson.source_sync',$1::uuid,'life_feed_source',$2,$3,$4,NOW())`, actor, GeographyTemplate+":"+now.In(JST).Format("2006-01-02"), "Operator-approved CC0 source and fixed Japanese template; all Japan-country claims checked", after)
		if err != nil {
			return 0, fmt.Errorf("audit geography publication: %w", err)
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return 0, fmt.Errorf("commit geography publication: %w", err)
	}
	return inserted, nil
}
