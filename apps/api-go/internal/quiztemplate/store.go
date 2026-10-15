// Package quiztemplate provides access to BJT quiz templates and revenge mode queue.
package quiztemplate

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrNotFound is returned when a requested template does not exist.
var ErrNotFound = errors.New("quiztemplate: not found")

// ErrForbidden is returned when access is denied (e.g., official simulation printable).
var ErrForbidden = errors.New("quiztemplate: forbidden")

// TemplateSummary represents a quiz template list entry.
type TemplateSummary struct {
	ID               string          `json:"id"`
	Title            string          `json:"title"`
	TitleVi          string          `json:"titleVi"`
	TitleJa          *string         `json:"titleJa"`
	Slug             string          `json:"slug"`
	Type             string          `json:"type"`
	Status           string          `json:"status"`
	Level            *string         `json:"level"`
	TimeLimitSeconds *int            `json:"timeLimitSeconds"`
	Description      *string         `json:"description"`
	BlueprintMeta    json.RawMessage `json:"blueprintMeta"`
	SectionCount     int             `json:"sectionCount"`
	SessionCount     int             `json:"sessionCount"`
	CreatedAt        time.Time       `json:"createdAt"`
}

// TemplateDetail represents a single quiz template with sections.
type TemplateDetail struct {
	ID          string            `json:"id"`
	Title       string            `json:"title"`
	Type        string            `json:"type"`
	Status      string            `json:"status"`
	Description *string           `json:"description,omitempty"`
	Sections    []TemplateSection `json:"sections"`
	CreatedAt   time.Time         `json:"createdAt"`
}

// TemplateSection represents a section within a quiz template.
type TemplateSection struct {
	ID            string `json:"id"`
	Title         string `json:"title"`
	DisplayOrder  int    `json:"displayOrder"`
	QuestionCount int    `json:"questionCount"`
	SkillTag      string `json:"skillTag,omitempty"`
}

// PrintableTemplate represents a full practice exam with questions and answer key.
type PrintableTemplate struct {
	ID               string             `json:"id"`
	Title            string             `json:"title"`
	TitleVi          string             `json:"titleVi"`
	TitleJa          *string            `json:"titleJa"`
	Slug             string             `json:"slug"`
	Level            *string            `json:"level"`
	TimeLimitSeconds *int               `json:"timeLimitSeconds"`
	TotalQuestions   int                `json:"totalQuestions"`
	Type             string             `json:"type"`
	Sections         []PrintableSection `json:"sections"`
}

// PrintableSection contains questions for a printable exam section.
type PrintableSection struct {
	ID           string              `json:"id"`
	Title        string              `json:"title"`
	Code         string              `json:"code"`
	TitleVi      string              `json:"titleVi"`
	TitleJa      *string             `json:"titleJa"`
	DisplayOrder int                 `json:"displayOrder"`
	Questions    []PrintableQuestion `json:"questions"`
}

// PrintableQuestion is one question in a printable exam.
type PrintableQuestion struct {
	ID            string            `json:"id"`
	Number        int               `json:"number"`
	Prompt        string            `json:"prompt"`
	Scenario      *string           `json:"scenario,omitempty"`
	AudioScript   *string           `json:"audioScript,omitempty"`
	AudioURL      *string           `json:"audioUrl,omitempty"`
	ImageURL      *string           `json:"imageUrl,omitempty"`
	ImageAlt      *string           `json:"imageAlt,omitempty"`
	SkillTag      string            `json:"skillTag"`
	Difficulty    string            `json:"difficulty"`
	ExplanationVi string            `json:"explanationVi"`
	Options       []PrintableOption `json:"options"`
	CorrectAnswer string            `json:"correctAnswer"`
	CorrectKey    string            `json:"correctKey"`
}

// PrintableOption is one answer option.
type PrintableOption struct {
	Key  string `json:"key"`
	Text string `json:"text"`
}

// RevengeQuestion is one item in the revenge queue.
type RevengeQuestion struct {
	QuestionID      string          `json:"questionId"`
	Prompt          string          `json:"prompt"`
	Scenario        *string         `json:"scenario,omitempty"`
	SkillTag        string          `json:"skillTag"`
	Difficulty      string          `json:"difficulty"`
	Options         []RevengeOption `json:"options"`
	WrongAnswerDate time.Time       `json:"wrongAnswerDate"`
	YourAnswer      string          `json:"yourAnswer"`
}

// RevengeOption is a shuffled answer option for revenge mode.
type RevengeOption struct {
	Key         string `json:"key"`
	Text        string `json:"text"`
	OriginalKey string `json:"originalKey"`
}

// RevengeQueueResponse is the response for GET /api/quiz/revenge/queue.
type RevengeQueueResponse struct {
	Questions    []RevengeQuestion `json:"questions"`
	TotalPending int               `json:"totalPending"`
}

// RevengeAnswerResult is the response for POST /api/quiz/revenge/answer.
type RevengeAnswerResult struct {
	Correct       bool   `json:"correct"`
	CorrectKey    string `json:"correctKey,omitempty"`
	IsCorrect     bool   `json:"isCorrect"`
	CorrectOption string `json:"correctOption,omitempty"`
}

// Store provides read/write access to assessment.bjt_mock_test, assessment.bjt_question, and revenge attempts.
type Store struct {
	db *pgxpool.Pool
}

// NewStore creates a quiz template store backed by the given pool.
func NewStore(db *pgxpool.Pool) *Store {
	return &Store{db: db}
}

// ListTemplates returns all published quiz templates.
func (s *Store) ListTemplates(ctx context.Context) ([]TemplateSummary, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const q = `SELECT t.id, t.title_vi AS title, t.title_vi, t.title_ja, t.slug, t.type, t.status,
		t.level, t.time_limit_seconds, t.description, t.blueprint_meta, t.created_at,
		(SELECT COUNT(*) FROM assessment.bjt_test_section s WHERE s.test_id = t.id) as section_count,
		(SELECT COUNT(*) FROM assessment.quiz_session qs WHERE qs.test_id = t.id) as session_count
	FROM assessment.bjt_mock_test t
	WHERE t.status = 'published'
		AND EXISTS (
			SELECT 1 FROM assessment.bjt_test_section s
			JOIN assessment.bjt_question q ON q.section_id = s.id AND q.status = 'published'
			WHERE s.test_id = t.id
		)
	ORDER BY t.created_at DESC`

	rows, err := s.db.Query(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("quiztemplate: list templates: %w", err)
	}
	defer rows.Close()

	var templates []TemplateSummary
	for rows.Next() {
		var t TemplateSummary
		if err := rows.Scan(&t.ID, &t.Title, &t.TitleVi, &t.TitleJa, &t.Slug, &t.Type, &t.Status,
			&t.Level, &t.TimeLimitSeconds, &t.Description, &t.BlueprintMeta, &t.CreatedAt, &t.SectionCount, &t.SessionCount); err != nil {
			return nil, fmt.Errorf("quiztemplate: scan template: %w", err)
		}
		templates = append(templates, t)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("quiztemplate: iterate templates: %w", err)
	}
	if templates == nil {
		templates = []TemplateSummary{}
	}
	return templates, nil
}

// GetTemplate returns a single template with section metadata.
// Official simulations expose section/count metadata only, never question content.
func (s *Store) GetTemplate(ctx context.Context, id string) (*TemplateDetail, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	// Check access and type
	const metaQ = `SELECT id, title_vi AS title, type, status, description, created_at FROM assessment.bjt_mock_test WHERE id = $1 AND status = 'published'`
	var t TemplateDetail
	if err := s.db.QueryRow(ctx, metaQ, id).Scan(&t.ID, &t.Title, &t.Type, &t.Status, &t.Description, &t.CreatedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("quiztemplate: get template meta: %w", err)
	}

	// Load sections with question counts
	const sectionQ = `SELECT id, title_vi, display_order, NULL::text AS skill_tag,
		(SELECT COUNT(*) FROM assessment.bjt_question q WHERE q.section_id = s.id) as question_count
	FROM assessment.bjt_test_section s
	WHERE s.test_id = $1
	ORDER BY s.display_order ASC`

	rows, err := s.db.Query(ctx, sectionQ, id)
	if err != nil {
		return nil, fmt.Errorf("quiztemplate: get sections: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var sec TemplateSection
		var skillTag *string
		if err := rows.Scan(&sec.ID, &sec.Title, &sec.DisplayOrder, &skillTag, &sec.QuestionCount); err != nil {
			return nil, fmt.Errorf("quiztemplate: scan section: %w", err)
		}
		if skillTag != nil {
			sec.SkillTag = *skillTag
		}
		t.Sections = append(t.Sections, sec)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("quiztemplate: iterate sections: %w", err)
	}
	if t.Sections == nil {
		t.Sections = []TemplateSection{}
	}
	return &t, nil
}

// GetPrintableTemplate returns full practice exam content with questions and answer key.
// Official simulations are denied — they are only available inside an active session.
func (s *Store) GetPrintableTemplate(ctx context.Context, id string) (*PrintableTemplate, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	// Check access and type
	const metaQ = `SELECT id, title_vi, title_ja, slug, type, level, time_limit_seconds
		FROM assessment.bjt_mock_test WHERE id = $1 AND status = 'published'`
	var testID, title, slug, testType string
	var titleJa, level *string
	var timeLimitSeconds *int
	if err := s.db.QueryRow(ctx, metaQ, id).Scan(&testID, &title, &titleJa, &slug, &testType, &level, &timeLimitSeconds); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("quiztemplate: get printable meta: %w", err)
	}

	if testType == "official" {
		return nil, ErrForbidden
	}

	// Load sections with full questions
	const sectionQ = `SELECT id, code, title_vi, title_ja, display_order FROM assessment.bjt_test_section WHERE test_id = $1 ORDER BY display_order ASC`
	rows, err := s.db.Query(ctx, sectionQ, id)
	if err != nil {
		return nil, fmt.Errorf("quiztemplate: get printable sections: %w", err)
	}
	defer rows.Close()

	var pt PrintableTemplate
	pt.ID = testID
	pt.Title = title
	pt.TitleVi = title
	pt.TitleJa = titleJa
	pt.Slug = slug
	pt.Level = level
	pt.TimeLimitSeconds = timeLimitSeconds
	pt.Type = testType

	questionNumber := 0
	for rows.Next() {
		var sec PrintableSection
		if err := rows.Scan(&sec.ID, &sec.Code, &sec.TitleVi, &sec.TitleJa, &sec.DisplayOrder); err != nil {
			return nil, fmt.Errorf("quiztemplate: scan printable section: %w", err)
		}
		sec.Title = sec.TitleVi

		// Load questions for this section
		const questionQ = `SELECT id, prompt, scenario, audio_script, audio_url, image_url, image_alt,
			skill_tag, difficulty, explanation_vi
		FROM assessment.bjt_question
		WHERE section_id = $1 AND status = 'published'
		ORDER BY created_at ASC, id ASC`

		qRows, err := s.db.Query(ctx, questionQ, sec.ID)
		if err != nil {
			return nil, fmt.Errorf("quiztemplate: get questions: %w", err)
		}

		for qRows.Next() {
			var q PrintableQuestion
			if err := qRows.Scan(&q.ID, &q.Prompt, &q.Scenario, &q.AudioScript, &q.AudioURL,
				&q.ImageURL, &q.ImageAlt, &q.SkillTag, &q.Difficulty, &q.ExplanationVi); err != nil {
				qRows.Close()
				return nil, fmt.Errorf("quiztemplate: scan question: %w", err)
			}
			questionNumber++
			q.Number = questionNumber

			// Load options
			const optQ = `SELECT option_key, text, is_correct FROM assessment.bjt_question_option
				WHERE question_id = $1 ORDER BY option_key ASC`
			oRows, err := s.db.Query(ctx, optQ, q.ID)
			if err != nil {
				qRows.Close()
				return nil, fmt.Errorf("quiztemplate: get options: %w", err)
			}
			for oRows.Next() {
				var opt PrintableOption
				var isCorrect bool
				if err := oRows.Scan(&opt.Key, &opt.Text, &isCorrect); err != nil {
					oRows.Close()
					qRows.Close()
					return nil, fmt.Errorf("quiztemplate: scan option: %w", err)
				}
				q.Options = append(q.Options, opt)
				if isCorrect {
					q.CorrectAnswer = opt.Key
					q.CorrectKey = opt.Key
				}
			}
			oRows.Close()
			if q.Options == nil {
				q.Options = []PrintableOption{}
			}
			sec.Questions = append(sec.Questions, q)
			pt.TotalQuestions++
		}
		qRows.Close()
		if sec.Questions == nil {
			sec.Questions = []PrintableQuestion{}
		}
		pt.Sections = append(pt.Sections, sec)
	}
	if pt.Sections == nil {
		pt.Sections = []PrintableSection{}
	}
	return &pt, nil
}

// GetRevengeQueue returns wrong answers from last 7 days not yet correctly re-answered.
func (s *Store) GetRevengeQueue(ctx context.Context, userID string, limit int) (*RevengeQueueResponse, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	if limit <= 0 || limit > 10 {
		limit = 5
	}

	sevenDaysAgo := time.Now().AddDate(0, 0, -7)

	// Get wrong answers from recent quiz sessions
	const wrongQ = `SELECT qa.question_id, qa.selected_option, qa.answered_at,
		q.prompt, q.scenario, q.skill_tag, q.difficulty
	FROM assessment.quiz_answer qa
	JOIN assessment.quiz_session qs ON qs.id = qa.session_id
	JOIN assessment.bjt_question q ON q.id = qa.question_id
	WHERE qa.is_correct = false
		AND qa.answered_at >= $2
		AND qs.user_id = $1
	ORDER BY qa.answered_at DESC
	LIMIT 20`

	rows, err := s.db.Query(ctx, wrongQ, userID, sevenDaysAgo)
	if err != nil {
		return nil, fmt.Errorf("quiztemplate: query revenge queue: %w", err)
	}
	defer rows.Close()

	type wrongAnswer struct {
		questionID     string
		selectedOption string
		answeredAt     time.Time
		prompt         string
		scenario       *string
		skillTag       string
		difficulty     string
	}
	var wrongs []wrongAnswer
	for rows.Next() {
		var w wrongAnswer
		if err := rows.Scan(&w.questionID, &w.selectedOption, &w.answeredAt,
			&w.prompt, &w.scenario, &w.skillTag, &w.difficulty); err != nil {
			return nil, fmt.Errorf("quiztemplate: scan revenge queue: %w", err)
		}
		wrongs = append(wrongs, w)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("quiztemplate: iterate revenge queue: %w", err)
	}

	if len(wrongs) == 0 {
		return &RevengeQueueResponse{Questions: []RevengeQuestion{}, TotalPending: 0}, nil
	}

	// Filter out already correctly revenged questions
	questionIDs := make([]string, len(wrongs))
	for i, w := range wrongs {
		questionIDs[i] = w.questionID
	}

	const revengedQ = `SELECT question_id FROM learning.revenge_attempt
		WHERE user_id = $1 AND is_correct = true AND question_id = ANY($2)`
	rRows, err := s.db.Query(ctx, revengedQ, userID, questionIDs)
	if err != nil {
		return nil, fmt.Errorf("quiztemplate: query solved revenge attempts: %w", err)
	}
	defer rRows.Close()
	revengedSet := make(map[string]bool)
	for rRows.Next() {
		var qid string
		if err := rRows.Scan(&qid); err != nil {
			return nil, fmt.Errorf("quiztemplate: scan solved revenge attempt: %w", err)
		}
		revengedSet[qid] = true
	}
	if err := rRows.Err(); err != nil {
		return nil, fmt.Errorf("quiztemplate: iterate solved revenge attempts: %w", err)
	}

	// Deduplicate and filter
	seen := make(map[string]bool)
	var pending []wrongAnswer
	for _, w := range wrongs {
		if !revengedSet[w.questionID] && !seen[w.questionID] {
			seen[w.questionID] = true
			pending = append(pending, w)
		}
	}

	selected := pending
	if len(selected) > limit {
		selected = selected[:limit]
	}

	// Load options for each selected question and build response
	var questions []RevengeQuestion
	keys := []string{"A", "B", "C", "D", "E", "F", "G", "H"}
	for _, w := range selected {
		const optQ = `SELECT option_key, text FROM assessment.bjt_question_option
			WHERE question_id = $1 ORDER BY RANDOM()`
		oRows, err := s.db.Query(ctx, optQ, w.questionID)
		if err != nil {
			return nil, fmt.Errorf("quiztemplate: query revenge options: %w", err)
		}
		var opts []RevengeOption
		idx := 0
		for oRows.Next() {
			var origKey, text string
			if err := oRows.Scan(&origKey, &text); err != nil {
				oRows.Close()
				return nil, fmt.Errorf("quiztemplate: scan revenge option: %w", err)
			}
			key := fmt.Sprintf("%d", idx+1)
			if idx < len(keys) {
				key = keys[idx]
			}
			opts = append(opts, RevengeOption{Key: key, Text: text, OriginalKey: origKey})
			idx++
		}
		if err := oRows.Err(); err != nil {
			oRows.Close()
			return nil, fmt.Errorf("quiztemplate: iterate revenge options: %w", err)
		}
		oRows.Close()
		if opts == nil {
			opts = []RevengeOption{}
		}
		questions = append(questions, RevengeQuestion{
			QuestionID:      w.questionID,
			Prompt:          w.prompt,
			Scenario:        w.scenario,
			SkillTag:        w.skillTag,
			Difficulty:      w.difficulty,
			Options:         opts,
			WrongAnswerDate: w.answeredAt,
			YourAnswer:      w.selectedOption,
		})
	}
	if questions == nil {
		questions = []RevengeQuestion{}
	}
	return &RevengeQueueResponse{Questions: questions, TotalPending: len(pending)}, nil
}

// SubmitRevengeAnswer records a revenge attempt and returns whether it was correct.
func (s *Store) SubmitRevengeAnswer(ctx context.Context, userID, questionID, selectedOption string) (*RevengeAnswerResult, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	// Find the correct option key
	const correctQ = `SELECT option_key FROM assessment.bjt_question_option
		WHERE question_id = $1 AND is_correct = true LIMIT 1`
	var correctKey string
	if err := s.db.QueryRow(ctx, correctQ, questionID).Scan(&correctKey); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("quiztemplate: find correct option: %w", err)
	}

	isCorrect := selectedOption == correctKey

	// Record the revenge attempt
	const insertQ = `INSERT INTO learning.revenge_attempt (user_id, question_id, is_correct, answered_at)
		VALUES ($1, $2, $3, NOW())`
	if _, err := s.db.Exec(ctx, insertQ, userID, questionID, isCorrect); err != nil {
		return nil, fmt.Errorf("quiztemplate: record revenge attempt: %w", err)
	}

	return &RevengeAnswerResult{
		Correct:       isCorrect,
		CorrectKey:    correctKey,
		IsCorrect:     isCorrect,
		CorrectOption: correctKey,
	}, nil
}

// Ensure json import is used.
var _ = json.RawMessage{}
