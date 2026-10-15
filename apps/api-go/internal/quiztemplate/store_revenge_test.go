package quiztemplate

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type quizTemplateFixture struct {
	store      *Store
	db         *pgxpool.Pool
	testID     string
	sectionID  string
	questionID string
	userID     string
}

func newQuizTemplateFixture(t *testing.T) quizTemplateFixture {
	t.Helper()
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Fatal("TEST_DATABASE_URL is required; run with scripts/quality/with-test-db.sh")
	}
	db, err := pgxpool.New(context.Background(), databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	f := quizTemplateFixture{db: db, store: NewStore(db)}
	if err := db.QueryRow(context.Background(), `SELECT gen_random_uuid()::text, gen_random_uuid()::text, gen_random_uuid()::text, gen_random_uuid()::text`).Scan(&f.testID, &f.sectionID, &f.questionID, &f.userID); err != nil {
		t.Fatal(err)
	}
	_, err = db.Exec(context.Background(), `INSERT INTO assessment.bjt_mock_test(id,slug,title_vi,type,status,updated_at)
		VALUES($1,$2,'Bài kiểm tra fixture','practice','published',NOW())`, f.testID, "quiztemplate-fixture-"+f.testID)
	if err != nil {
		db.Close()
		t.Fatal(err)
	}
	_, err = db.Exec(context.Background(), `INSERT INTO assessment.bjt_test_section(id,test_id,code,title_vi,display_order)
		VALUES($1,$2,'fixture','Phần fixture',1)`, f.sectionID, f.testID)
	if err != nil {
		db.Close()
		t.Fatal(err)
	}
	_, err = db.Exec(context.Background(), `INSERT INTO assessment.bjt_question(id,section_id,prompt,explanation_vi,skill_tag,status,updated_at)
		VALUES($1,$2,'Prompt fixture','Giải thích','business','published',NOW())`, f.questionID, f.sectionID)
	if err != nil {
		db.Close()
		t.Fatal(err)
	}
	_, err = db.Exec(context.Background(), `INSERT INTO assessment.bjt_question_option(question_id,option_key,text,is_correct)
		VALUES($1,'A','Đáp án đúng',true),($1,'B','Đáp án sai',false)`, f.questionID)
	if err != nil {
		db.Close()
		t.Fatal(err)
	}
	_, err = db.Exec(context.Background(), `INSERT INTO assessment.quiz_session(id,user_id,test_id,status,total_questions,started_at)
		VALUES(gen_random_uuid(),$1,$2,'completed',1,NOW())`, f.userID, f.testID)
	if err != nil {
		db.Close()
		t.Fatal(err)
	}
	_, err = db.Exec(context.Background(), `INSERT INTO assessment.quiz_answer(session_id,question_id,selected_option,is_correct,answered_at)
		SELECT id,$2,'B',false,NOW() FROM assessment.quiz_session WHERE test_id=$1 AND user_id=$3`, f.testID, f.questionID, f.userID)
	if err != nil {
		db.Close()
		t.Fatal(err)
	}
	t.Cleanup(func() {
		ctx := context.Background()
		if _, err := db.Exec(ctx, `DELETE FROM learning.revenge_attempt WHERE user_id=$1`, f.userID); err != nil {
			t.Errorf("clean revenge fixture: %v", err)
		}
		if _, err := db.Exec(ctx, `DELETE FROM assessment.quiz_session WHERE test_id=$1`, f.testID); err != nil {
			t.Errorf("clean quiz-session fixture: %v", err)
		}
		if _, err := db.Exec(ctx, `DELETE FROM assessment.bjt_mock_test WHERE id=$1`, f.testID); err != nil {
			t.Errorf("clean quiz-template fixture: %v", err)
		}
		db.Close()
	})
	return f
}

func TestSubmitRevengeAnswerPersistsUsingPrismaColumns(t *testing.T) {
	f := newQuizTemplateFixture(t)
	wrong, err := f.store.SubmitRevengeAnswer(context.Background(), f.userID, f.questionID, "B")
	if err != nil {
		t.Fatalf("submit wrong answer: %v", err)
	}
	if wrong.Correct || wrong.IsCorrect || wrong.CorrectKey != "A" || wrong.CorrectOption != "A" {
		t.Fatalf("wrong-answer result=%+v, want false and key A in both response contracts", wrong)
	}
	right, err := f.store.SubmitRevengeAnswer(context.Background(), f.userID, f.questionID, "A")
	if err != nil {
		t.Fatalf("submit correct answer: %v", err)
	}
	if !right.Correct || !right.IsCorrect || right.CorrectKey != "A" || right.CorrectOption != "A" {
		t.Fatalf("correct-answer result=%+v, want true and key A in both response contracts", right)
	}
	var count int
	var correctCount int
	var lastAnswered time.Time
	if err := f.db.QueryRow(context.Background(), `SELECT count(*),count(*) FILTER (WHERE is_correct),max(answered_at)
		FROM learning.revenge_attempt WHERE user_id=$1 AND question_id=$2`, f.userID, f.questionID).Scan(&count, &correctCount, &lastAnswered); err != nil {
		t.Fatal(err)
	}
	if count != 2 || correctCount != 1 || lastAnswered.IsZero() {
		t.Fatalf("revenge attempts count=%d correct=%d lastAnswered=%v", count, correctCount, lastAnswered)
	}
}

func TestGetRevengeQueueOmitsSolvedQuestion(t *testing.T) {
	f := newQuizTemplateFixture(t)
	queue, err := f.store.GetRevengeQueue(context.Background(), f.userID, 5)
	if err != nil {
		t.Fatalf("get initial revenge queue: %v", err)
	}
	if queue.TotalPending != 1 || len(queue.Questions) != 1 || queue.Questions[0].QuestionID != f.questionID {
		t.Fatalf("initial queue=%+v, want one fixture question", queue)
	}
	if _, err := f.store.SubmitRevengeAnswer(context.Background(), f.userID, f.questionID, "A"); err != nil {
		t.Fatalf("submit correct revenge answer: %v", err)
	}
	queue, err = f.store.GetRevengeQueue(context.Background(), f.userID, 5)
	if err != nil {
		t.Fatalf("get solved revenge queue: %v", err)
	}
	if queue.TotalPending != 0 || len(queue.Questions) != 0 {
		t.Fatalf("solved question remains in queue: %+v", queue)
	}
}

func TestGetRevengeQueuePropagatesQueryErrors(t *testing.T) {
	f := newQuizTemplateFixture(t)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := f.store.GetRevengeQueue(ctx, f.userID, 5); err == nil || !errors.Is(err, context.Canceled) {
		t.Fatalf("canceled queue query error=%v, want context.Canceled", err)
	}
}

func TestGetTemplateReadsCanonicalSectionTitle(t *testing.T) {
	f := newQuizTemplateFixture(t)
	template, err := f.store.GetTemplate(context.Background(), f.testID)
	if err != nil {
		t.Fatalf("get template: %v", err)
	}
	if len(template.Sections) != 1 || template.Sections[0].ID != f.sectionID || template.Sections[0].Title != "Phần fixture" || template.Sections[0].QuestionCount != 1 {
		t.Fatalf("template sections=%+v", template.Sections)
	}
}
