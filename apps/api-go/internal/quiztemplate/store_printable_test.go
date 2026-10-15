package quiztemplate

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestGetPrintableTemplateUsesCanonicalAssessmentSchema(t *testing.T) {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Fatal("TEST_DATABASE_URL is required; run with scripts/quality/with-test-db.sh")
	}
	ctx := context.Background()
	db, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	cleanupIDs := make([]string, 0, 2)
	t.Cleanup(func() {
		for _, id := range cleanupIDs {
			if _, err := db.Exec(context.Background(), "DELETE FROM assessment.bjt_mock_test WHERE id = $1", id); err != nil {
				t.Errorf("clean up printable fixture %s: %v", id, err)
			}
		}
		db.Close()
	})

	suffix := fmt.Sprintf("%d", time.Now().UnixNano())
	var testID string
	err = db.QueryRow(ctx, `INSERT INTO assessment.bjt_mock_test
		(slug, title_vi, title_ja, type, status, level, time_limit_seconds, updated_at)
		VALUES ($1, 'Đề luyện', '練習問題', 'practice', 'published', 'J2', 2700, NOW())
		RETURNING id`, "printable-test-"+suffix).Scan(&testID)
	if err != nil {
		t.Fatal(err)
	}
	cleanupIDs = append(cleanupIDs, testID)

	var sectionID string
	err = db.QueryRow(ctx, `INSERT INTO assessment.bjt_test_section
		(test_id, code, title_vi, title_ja, display_order)
		VALUES ($1, 'RC_INTEGRATED', 'Đọc hiểu tổng hợp', '総合読解', 1) RETURNING id`, testID).Scan(&sectionID)
	if err != nil {
		t.Fatal(err)
	}
	var questionID string
	err = db.QueryRow(ctx, `INSERT INTO assessment.bjt_question
		(section_id, prompt, scenario, explanation_vi, skill_tag, difficulty, status, updated_at)
		VALUES ($1, '問題文', '状況', 'Giải thích', 'business_email', 'standard', 'published', NOW()) RETURNING id`, sectionID).Scan(&questionID)
	if err != nil {
		t.Fatal(err)
	}
	_, err = db.Exec(ctx, `INSERT INTO assessment.bjt_question_option (question_id, option_key, text, is_correct)
		VALUES ($1, 'A', '正解', true), ($1, 'B', '別の答え', false)`, questionID)
	if err != nil {
		t.Fatal(err)
	}

	got, err := NewStore(db).GetPrintableTemplate(ctx, testID)
	if err != nil {
		t.Fatalf("GetPrintableTemplate() error = %v", err)
	}
	if got.Title != "Đề luyện" || got.TitleVi != "Đề luyện" || got.TitleJa == nil || *got.TitleJa != "練習問題" || got.Slug == "" || got.Level == nil || *got.Level != "J2" || got.TimeLimitSeconds == nil || *got.TimeLimitSeconds != 2700 || got.TotalQuestions != 1 {
		t.Fatalf("printable metadata mismatch: %+v", got)
	}
	if len(got.Sections) != 1 || got.Sections[0].Code != "RC_INTEGRATED" || got.Sections[0].TitleVi != "Đọc hiểu tổng hợp" || got.Sections[0].TitleJa == nil || *got.Sections[0].TitleJa != "総合読解" || len(got.Sections[0].Questions) != 1 {
		t.Fatalf("printable section mismatch: %+v", got.Sections)
	}
	question := got.Sections[0].Questions[0]
	if question.Number != 1 || question.CorrectAnswer != "A" || question.CorrectKey != "A" || len(question.Options) != 2 || question.AudioScript != nil {
		t.Fatalf("printable question mismatch: %+v", question)
	}

	_, err = db.Exec(ctx, `INSERT INTO assessment.bjt_mock_test (slug, title_vi, type, status, updated_at)
		VALUES ($1, 'Đề chính thức', 'official', 'published', NOW())`, "printable-official-"+suffix)
	if err != nil {
		t.Fatal(err)
	}
	var officialID string
	if err := db.QueryRow(ctx, "SELECT id FROM assessment.bjt_mock_test WHERE slug = $1", "printable-official-"+suffix).Scan(&officialID); err != nil {
		t.Fatal(err)
	}
	cleanupIDs = append(cleanupIDs, officialID)
	if _, err := NewStore(db).GetPrintableTemplate(ctx, officialID); err != ErrForbidden {
		t.Fatalf("official printable error = %v, want ErrForbidden", err)
	}
}
