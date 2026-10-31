package scenario

import (
	"context"
	"os"
	"testing"
)

func TestLifeCatalogMigration(t *testing.T) {
	db := scenarioTestPool(t)
	ctx := context.Background()
	tx, err := db.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(ctx)
	var deployed int
	if err := tx.QueryRow(ctx, `SELECT count(*) FROM content.business_scenario WHERE slug LIKE 'life101-%' AND active`).Scan(&deployed); err != nil {
		t.Fatal(err)
	}
	if deployed < 100 {
		t.Fatalf("provisioned schema contains %d active life scenarios; want at least 100", deployed)
	}
	if _, err := tx.Exec(ctx, `DELETE FROM content.user_scenario_attempt WHERE scenario_id IN (SELECT id FROM content.business_scenario WHERE slug LIKE 'life101-%')`); err != nil {
		t.Fatal(err)
	}
	if _, err := tx.Exec(ctx, `DELETE FROM content.business_scenario WHERE slug LIKE 'life101-%'`); err != nil {
		t.Fatal(err)
	}
	var existingID string
	err = tx.QueryRow(ctx, `INSERT INTO content.business_scenario (slug, title_vi, active) VALUES ('life101-find-product', 'Existing content', false) RETURNING id::text`).Scan(&existingID)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := tx.Exec(ctx, `INSERT INTO content.user_scenario_attempt (user_id, scenario_id) VALUES (gen_random_uuid(), $1)`, existingID); err != nil {
		t.Fatal(err)
	}
	sql, err := os.ReadFile("../../../../packages/database/prisma/migrations/20261101000000_life_scenarios/migration.sql")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := tx.Exec(ctx, string(sql)); err != nil {
		t.Fatalf("apply life catalog migration: %v", err)
	}
	var before [3]int
	counts := `SELECT (SELECT count(*) FROM content.business_scenario WHERE slug LIKE 'life101-%'), (SELECT count(*) FROM content.scenario_step st JOIN content.business_scenario s ON s.id=st.scenario_id WHERE s.slug LIKE 'life101-%'), (SELECT count(*) FROM content.scenario_choice c JOIN content.scenario_step st ON st.id=c.step_id JOIN content.business_scenario s ON s.id=st.scenario_id WHERE s.slug LIKE 'life101-%')`
	if err := tx.QueryRow(ctx, counts).Scan(&before[0], &before[1], &before[2]); err != nil {
		t.Fatal(err)
	}
	if _, err := tx.Exec(ctx, string(sql)); err != nil {
		t.Fatalf("repeat life catalog migration: %v", err)
	}
	var after [3]int
	if err := tx.QueryRow(ctx, counts).Scan(&after[0], &after[1], &after[2]); err != nil {
		t.Fatal(err)
	}
	if before != after {
		t.Errorf("repeat migration changed scenario/step/choice counts: got %v, want %v", after, before)
	}
	var preserved bool
	if err := tx.QueryRow(ctx, `SELECT title_vi='Existing content' AND NOT active AND (SELECT count(*) FROM content.user_scenario_attempt WHERE scenario_id=s.id)=1 AND NOT EXISTS (SELECT 1 FROM content.scenario_step WHERE scenario_id=s.id) FROM content.business_scenario s WHERE id=$1`, existingID).Scan(&preserved); err != nil {
		t.Fatal(err)
	}
	if !preserved {
		t.Error("migration changed a pre-existing scenario or its attempt")
	}
	var total, categories, incomplete, correctA, correctB int
	err = tx.QueryRow(ctx, `SELECT count(*), count(DISTINCT s.category), count(*) FILTER (WHERE COALESCE(BTRIM(s.title_ja),'') = '' OR BTRIM(s.title_vi) = '' OR NOT EXISTS (SELECT 1 FROM content.scenario_step st WHERE st.scenario_id=s.id) OR EXISTS (SELECT 1 FROM content.scenario_step st WHERE st.scenario_id=s.id AND (BTRIM(st.situation_vi) = '' OR COALESCE(BTRIM(st.situation_ja),'') = '' OR (SELECT count(*) FROM content.scenario_choice c WHERE c.step_id=st.id) <> 2 OR EXISTS (SELECT 1 FROM content.scenario_choice c WHERE c.step_id=st.id AND (BTRIM(c.text_vi) = '' OR COALESCE(BTRIM(c.text_ja),'') = '')) OR (SELECT count(*) FROM content.scenario_choice c WHERE c.step_id=st.id AND c.is_optimal AND c.text_ja IS NOT NULL) <> 1 OR (SELECT count(DISTINCT c.text_ja) FROM content.scenario_choice c WHERE c.step_id=st.id) <> 2))), count(*) FILTER (WHERE EXISTS (SELECT 1 FROM content.scenario_step st JOIN content.scenario_choice c ON c.step_id=st.id WHERE st.scenario_id=s.id AND c.is_optimal AND c.choice_key='A')), count(*) FILTER (WHERE EXISTS (SELECT 1 FROM content.scenario_step st JOIN content.scenario_choice c ON c.step_id=st.id WHERE st.scenario_id=s.id AND c.is_optimal AND c.choice_key='B')) FROM content.business_scenario s WHERE s.slug LIKE 'life101-%' AND s.active`).Scan(&total, &categories, &incomplete, &correctA, &correctB)
	if err != nil {
		t.Fatal(err)
	}
	if total < 100 || categories < 8 || incomplete != 0 || correctA == 0 || correctB == 0 {
		t.Errorf("life catalog incomplete: got %d scenarios, %d categories, %d unplayable, %d A and %d B answers", total, categories, incomplete, correctA, correctB)
	}
}
