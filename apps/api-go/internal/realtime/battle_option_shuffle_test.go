package realtime

import (
	"context"
	"fmt"
	"reflect"
	"testing"
	"time"
)

func TestBattleOptionShuffleInMemoryDistributionAndStability(t *testing.T) {
	const numSeeds = 400
	var posCounts [4]int
	var baseline []BattleQuestionOption

	for i := 0; i < numSeeds; i++ {
		seed := fmt.Sprintf("battle-mem-seed-%04d", i)
		created := defaultInMemoryBattle(seed, 3)

		var q2 *BattleQuestionPayload
		for idx := range created.Questions {
			if created.Questions[idx].QuestionID == "q-2" {
				q2 = &created.Questions[idx]
				break
			}
		}
		if q2 == nil {
			t.Fatalf("seed %s missing q-2 in defaultInMemoryBattle", seed)
		}
		if q2.CorrectOptionKey() != "B" {
			t.Fatalf("seed %s q-2 CorrectOptionKey() = %q, want B", seed, q2.CorrectOptionKey())
		}
		if i == 0 {
			baseline = append([]BattleQuestionOption(nil), q2.Options...)
			again := defaultInMemoryBattle(seed, 3)
			var q2Again *BattleQuestionPayload
			for idx := range again.Questions {
				if again.Questions[idx].QuestionID == "q-2" {
					q2Again = &again.Questions[idx]
					break
				}
			}
			if q2Again == nil || !reflect.DeepEqual(q2Again.Options, baseline) {
				t.Fatalf("defaultInMemoryBattle same seed changed option order: got %+v, want %+v", q2Again, baseline)
			}
		}

		correctSlot := -1
		for slot, opt := range q2.Options {
			if opt.IsCorrect {
				if opt.OptionKey != "B" {
					t.Fatalf("seed %s q-2 renumbered correct option key to %q, want B", seed, opt.OptionKey)
				}
				correctSlot = slot
			}
		}
		if correctSlot < 0 {
			t.Fatalf("seed %s q-2 missing correct option", seed)
		}
		posCounts[correctSlot]++
	}

	t.Logf("battle_inmemory served correct-answer positions (N=%d): slot0=%d (%.1f%%) slot1=%d (%.1f%%) slot2=%d (%.1f%%) slot3=%d (%.1f%%)",
		numSeeds,
		posCounts[0], float64(posCounts[0])*100/numSeeds,
		posCounts[1], float64(posCounts[1])*100/numSeeds,
		posCounts[2], float64(posCounts[2])*100/numSeeds,
		posCounts[3], float64(posCounts[3])*100/numSeeds,
	)

	minBound := int(float64(numSeeds) * 0.15)
	maxBound := int(float64(numSeeds) * 0.35)
	for slot, count := range posCounts {
		if count < minBound || count > maxBound {
			t.Errorf("battle in-memory answer-position distribution out of uniform bounds: slot %d got %d/%d (%.1f%%), want [%d, %d] (15%%-35%%); full counts=%v",
				slot, count, numSeeds, float64(count)*100/numSeeds, minBound, maxBound, posCounts)
		}
	}
}

func TestPostgresBattleStore_OptionShuffleDistributionAndStability(t *testing.T) {
	db := realtimeTestPool(t)
	store := NewPostgresBattleStore(db)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	var testID, sectionID, questionID string
	slug := "battle-opt-shuffle-" + newTestUUID(t)
	if err := db.QueryRow(ctx, `INSERT INTO assessment.bjt_mock_test (slug, title_vi, status, updated_at)
		VALUES ($1, 'Battle option shuffle', 'published', now()) RETURNING id::text`, slug).Scan(&testID); err != nil {
		t.Fatal(err)
	}
	userID := newTestUUID(t)
	opponentID := newTestUUID(t)
	t.Cleanup(func() {
		cctx, ccancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer ccancel()
		_, _ = db.Exec(cctx, `DELETE FROM learning.battle_session WHERE user_id = $1::uuid`, userID)
		_, _ = db.Exec(cctx, `DELETE FROM assessment.bjt_mock_test WHERE id = $1::uuid`, testID)
	})
	if err := db.QueryRow(ctx, `INSERT INTO assessment.bjt_test_section (test_id, code, title_vi, display_order)
		VALUES ($1::uuid, 'S1', 'Section', 1) RETURNING id::text`, testID).Scan(&sectionID); err != nil {
		t.Fatal(err)
	}
	questionID = "00000000-0000-4000-8000-000000000450"
	_, _ = db.Exec(ctx, `DELETE FROM learning.battle_round WHERE question_id = $1::uuid`, questionID)
	_, _ = db.Exec(ctx, `DELETE FROM assessment.bjt_question WHERE id = $1::uuid`, questionID)
	if _, err := db.Exec(ctx, `INSERT INTO assessment.bjt_question (id, section_id, prompt, explanation_vi, skill_tag, status, updated_at)
		VALUES ($1::uuid, $2::uuid, 'Battle shuffle prompt', 'B is correct', 'keigo', 'published', now())`, questionID, sectionID); err != nil {
		t.Fatal(err)
	}
	expectedText := map[string]string{
		"A": "Battle Wrong A",
		"B": "Battle Correct B",
		"C": "Battle Wrong C",
		"D": "Battle Wrong D",
	}
	for _, key := range []string{"A", "B", "C", "D"} {
		if _, err := db.Exec(ctx, `INSERT INTO assessment.bjt_question_option (question_id, option_key, text, is_correct)
			VALUES ($1::uuid, $2, $3, $4)`, questionID, key, expectedText[key], key == "B"); err != nil {
			t.Fatal(err)
		}
	}

	findQ := func(questions []BattleQuestionPayload) *BattleQuestionPayload {
		for i := range questions {
			if questions[i].QuestionID == questionID {
				return &questions[i]
			}
		}
		return nil
	}

	const numSeeds = 400
	var posCounts [4]int

	for i := 0; i < numSeeds; i++ {
		seed := fmt.Sprintf("battle-pg-seed-%04d", i)
		created, err := store.CreateBotBattle(ctx, userID, "bot_j1", seed, 200)
		if err != nil {
			t.Fatalf("CreateBotBattle seed=%s: %v", seed, err)
		}
		q := findQ(created.Questions)
		if q == nil {
			t.Fatalf("seed %s omitted fixture question %s", seed, questionID)
		}
		if q.CorrectOptionKey() != "B" {
			t.Fatalf("seed %s CorrectOptionKey() = %q, want B", seed, q.CorrectOptionKey())
		}

		if i == 0 {
			// Same seed in PvP must yield the exact same deterministic option order.
			pvp, err := store.CreatePvpBattle(ctx, userID, opponentID, seed, 200)
			if err != nil {
				t.Fatalf("CreatePvpBattle seed=%s: %v", seed, err)
			}
			pvpQ := findQ(pvp.Questions)
			if pvpQ == nil || !reflect.DeepEqual(pvpQ.Options, q.Options) {
				t.Fatalf("CreatePvpBattle with same seed produced different option order: got %+v, want %+v", pvpQ, q.Options)
			}
		}

		correctSlot := -1
		for slot, opt := range q.Options {
			if expectedText[opt.OptionKey] != opt.Text {
				t.Fatalf("battle optionKey->text binding broken: %+v", opt)
			}
			if opt.IsCorrect {
				correctSlot = slot
			}
		}
		if correctSlot < 0 {
			t.Fatalf("seed %s missing correct option", seed)
		}
		posCounts[correctSlot]++
	}

	t.Logf("battle_store served correct-answer positions (N=%d): slot0=%d (%.1f%%) slot1=%d (%.1f%%) slot2=%d (%.1f%%) slot3=%d (%.1f%%)",
		numSeeds,
		posCounts[0], float64(posCounts[0])*100/numSeeds,
		posCounts[1], float64(posCounts[1])*100/numSeeds,
		posCounts[2], float64(posCounts[2])*100/numSeeds,
		posCounts[3], float64(posCounts[3])*100/numSeeds,
	)

	minBound := int(float64(numSeeds) * 0.15)
	maxBound := int(float64(numSeeds) * 0.35)
	for slot, count := range posCounts {
		if count < minBound || count > maxBound {
			t.Errorf("battle store answer-position distribution out of uniform bounds: slot %d got %d/%d (%.1f%%), want [%d, %d] (15%%-35%%); full counts=%v",
				slot, count, numSeeds, float64(count)*100/numSeeds, minBound, maxBound, posCounts)
		}
	}
}
