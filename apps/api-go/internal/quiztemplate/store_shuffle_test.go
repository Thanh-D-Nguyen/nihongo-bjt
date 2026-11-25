package quiztemplate

import (
	"context"
	"fmt"
	"os"
	"reflect"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestGetPrintableTemplateOptionShuffleDistributionAndStability(t *testing.T) {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Fatal("TEST_DATABASE_URL is required; run with scripts/quality/with-test-db.sh")
	}
	ctx := context.Background()
	db, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatal(err)
	}

	suffix := fmt.Sprintf("%d", time.Now().UnixNano())
	var testID string
	if err := db.QueryRow(ctx, `INSERT INTO assessment.bjt_mock_test
		(slug, title_vi, title_ja, type, status, level, time_limit_seconds, updated_at)
		VALUES ($1, 'Đề luyện shuffle', 'シャッフル練習', 'practice', 'published', 'J2', 2700, NOW())
		RETURNING id::text`, "printable-shuffle-"+suffix).Scan(&testID); err != nil {
		db.Close()
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if _, err := db.Exec(context.Background(), `DELETE FROM assessment.bjt_mock_test WHERE id = $1`, testID); err != nil {
			t.Errorf("clean up printable shuffle fixture %s: %v", testID, err)
		}
		db.Close()
	})

	var sectionID string
	if err := db.QueryRow(ctx, `INSERT INTO assessment.bjt_test_section
		(test_id, code, title_vi, title_ja, display_order)
		VALUES ($1, 'RC_INTEGRATED', 'Đọc hiểu', '読解', 1) RETURNING id::text`, testID).Scan(&sectionID); err != nil {
		t.Fatal(err)
	}

	const numQuestions = 400
	expectedText := map[string]string{
		"A": "選択肢A（誤り）",
		"B": "選択肢B（正解）",
		"C": "選択肢C（誤り）",
		"D": "選択肢D（誤り）",
	}

	tx, err := db.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	for i := 0; i < numQuestions; i++ {
		var qid string
		if err := tx.QueryRow(ctx, `INSERT INTO assessment.bjt_question
			(section_id, prompt, explanation_vi, skill_tag, difficulty, status, updated_at)
			VALUES ($1, $2, 'Giải thích', 'keigo', 'standard', 'published', NOW()) RETURNING id::text`,
			sectionID, fmt.Sprintf("問題 %d", i+1)).Scan(&qid); err != nil {
			_ = tx.Rollback(ctx)
			t.Fatal(err)
		}
		if _, err := tx.Exec(ctx, `INSERT INTO assessment.bjt_question_option (question_id, option_key, text, is_correct)
			VALUES ($1,'A',$2,false),($1,'B',$3,true),($1,'C',$4,false),($1,'D',$5,false)`,
			qid, expectedText["A"], expectedText["B"], expectedText["C"], expectedText["D"]); err != nil {
			_ = tx.Rollback(ctx)
			t.Fatal(err)
		}
	}
	if err := tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}

	store := NewStore(db)
	first, err := store.GetPrintableTemplate(ctx, testID)
	if err != nil {
		t.Fatalf("GetPrintableTemplate() first call error = %v", err)
	}
	second, err := store.GetPrintableTemplate(ctx, testID)
	if err != nil {
		t.Fatalf("GetPrintableTemplate() second call error = %v", err)
	}
	if !reflect.DeepEqual(first, second) {
		t.Fatalf("GetPrintableTemplate() is not deterministic across identical calls")
	}
	if len(first.Sections) != 1 || len(first.Sections[0].Questions) != numQuestions {
		t.Fatalf("got %d sections / %d questions, want 1 / %d", len(first.Sections), len(first.Sections[0].Questions), numQuestions)
	}

	var posCounts [4]int
	for _, q := range first.Sections[0].Questions {
		if q.CorrectKey != "B" || q.CorrectAnswer != "B" {
			t.Fatalf("question %s correctKey=%q correctAnswer=%q, want B/B", q.ID, q.CorrectKey, q.CorrectAnswer)
		}
		if len(q.Options) != 4 {
			t.Fatalf("question %s options len = %d, want 4", q.ID, len(q.Options))
		}
		correctSlot := -1
		for slot, opt := range q.Options {
			if expectedText[opt.Key] != opt.Text {
				t.Fatalf("question %s broke option key->text binding: %+v", q.ID, opt)
			}
			if opt.Key == "B" {
				correctSlot = slot
			}
		}
		if correctSlot < 0 {
			t.Fatalf("question %s omitted correct option B", q.ID)
		}
		posCounts[correctSlot]++
	}

	t.Logf("quiztemplate_printable served correct-answer positions (N=%d): slot0=%d (%.1f%%) slot1=%d (%.1f%%) slot2=%d (%.1f%%) slot3=%d (%.1f%%)",
		numQuestions,
		posCounts[0], float64(posCounts[0])*100/numQuestions,
		posCounts[1], float64(posCounts[1])*100/numQuestions,
		posCounts[2], float64(posCounts[2])*100/numQuestions,
		posCounts[3], float64(posCounts[3])*100/numQuestions,
	)

	minBound := int(float64(numQuestions) * 0.15)
	maxBound := int(float64(numQuestions) * 0.35)
	for slot, count := range posCounts {
		if count < minBound || count > maxBound {
			t.Errorf("printable template answer-position distribution out of uniform bounds: slot %d got %d/%d (%.1f%%), want [%d, %d] (15%%-35%%); full counts=%v",
				slot, count, numQuestions, float64(count)*100/numQuestions, minBound, maxBound, posCounts)
		}
	}
}
