package career

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

var (
	// ErrChapterLocked means the learner's rank or an earlier chapter of the arc does not allow this chapter yet.
	ErrChapterLocked = errors.New("career: chapter locked")
	// ErrNoActiveAttempt means there is neither an in-progress attempt nor a completed snapshot to return.
	ErrNoActiveAttempt = errors.New("career: no in-progress chapter attempt")
	// ErrInvalidOption means the submitted option key does not belong to the chapter question.
	ErrInvalidOption = errors.New("career: invalid option")
)

// wrongAnswerPercent is the share of the chapter rewards earned by a wrong answer.
const wrongAnswerPercent = 25

// Skill axes a chapter may raise; anything else in a rewards payload is ignored.
var skillAxes = map[string]bool{"keigo": true, "written": true, "meeting": true, "customer": true, "chart": true, "nuance": true}

// ChapterAttempt is one learner run through a chapter.
type ChapterAttempt struct {
	ID        string    `json:"id"`
	ChapterID string    `json:"chapterId"`
	Status    string    `json:"status"`
	StartedAt time.Time `json:"startedAt"`
}

// NpcTrustDelta is one NPC trust change earned by a chapter.
type NpcTrustDelta struct {
	NpcSlug string `json:"npcSlug"`
	Delta   int    `json:"delta"`
}

// ChapterResult is what a completion awarded; it is also stored as the attempt's score snapshot.
type ChapterResult struct {
	ChapterID          string            `json:"chapterId"`
	RankXPDelta        int               `json:"rankXpDelta"`
	SkillDeltas        map[string]int    `json:"skillDeltas"`
	NpcTrustDeltas     []NpcTrustDelta   `json:"npcTrustDeltas"`
	ContextMemoIDs     []string          `json:"contextMemoIds"`
	NpcReactionMontage []json.RawMessage `json:"npcReactionMontage"`
	CompletedAt        string            `json:"completedAt"`
}

// RankUp reports a rank change caused by a completion.
type RankUp struct {
	FromRankCode string `json:"fromRankCode"`
	ToRankCode   string `json:"toRankCode"`
}

// ChapterCompletion is the response of completing a chapter attempt.
type ChapterCompletion struct {
	Career *CareerMe     `json:"career"`
	Result ChapterResult `json:"result"`
	RankUp *RankUp       `json:"rankUp"`
}

// StoryProgress is a learner's story progress for the arcs and chapters pages.
type StoryProgress struct {
	CurrentRankCode     string         `json:"currentRankCode"`
	CompletedChapterIDs []string       `json:"completedChapterIds"`
	Arcs                map[string]int `json:"arcs"`
}

type attemptSnapshot struct {
	ChapterResult
	OptionKey string `json:"optionKey,omitempty"`
	Correct   *bool  `json:"correct,omitempty"`
}

type chapterRow struct {
	arcID, titleJa, titleVi, entryRank string
	displayOrder                       int
	scenarioRaw, rewardsRaw            json.RawMessage
}

type rewardsDoc struct {
	RankXP        int            `json:"rankXp"`
	SkillGains    map[string]int `json:"skillGains"`
	NpcTrustGains []struct {
		NpcSlug string `json:"npcSlug"`
		Delta   int    `json:"delta"`
	} `json:"npcTrustGains"`
	NpcReactionMontage []json.RawMessage `json:"npcReactionMontage"`
}

type scenarioDoc struct {
	Scenarios []struct {
		ScenarioType     string `json:"scenarioType"`
		TitleJa          string `json:"titleJa"`
		TitleVi          string `json:"titleVi"`
		GoalJa           string `json:"goalJa"`
		GoalVi           string `json:"goalVi"`
		ContextSummaryVi string `json:"contextSummaryVi"`
		Characters       []struct {
			NpcSlug string `json:"npcSlug"`
		} `json:"characters"`
		Question struct {
			PromptVi string `json:"promptVi"`
			Options  []struct {
				OptionKey string `json:"optionKey"`
				IsCorrect bool   `json:"isCorrect"`
				TextJa    string `json:"textJa"`
			} `json:"options"`
		} `json:"question"`
	} `json:"scenarios"`
}

func (s *Store) loadPublishedChapter(ctx context.Context, tx pgx.Tx, chapterID string) (*chapterRow, error) {
	var c chapterRow
	const q = `SELECT c.arc_id::text, c.display_order, c.title_ja, c.title_vi, a.rank_code_entry, c.scenario_payload, c.rewards_payload
		FROM career.mission_chapter c JOIN career.mission_arc a ON a.id = c.arc_id
		WHERE c.id = $1::uuid AND a.status = 'published'`
	if err := tx.QueryRow(ctx, q, chapterID).Scan(&c.arcID, &c.displayOrder, &c.titleJa, &c.titleVi, &c.entryRank, &c.scenarioRaw, &c.rewardsRaw); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("career: load chapter: %w", err)
	}
	return &c, nil
}

func ensureCareerState(ctx context.Context, tx pgx.Tx, userID string) error {
	_, err := tx.Exec(ctx, insertDefaultCareerStateSQL, userID)
	if err != nil {
		return fmt.Errorf("career: ensure state: %w", err)
	}
	return nil
}

func lockStoryKey(ctx context.Context, tx pgx.Tx, userID, chapterID string) error {
	_, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext($1))`, "story-chapter:"+userID+":"+chapterID)
	return err
}

// chapterUnlocked requires the arc's entry rank to be reached and every earlier chapter of the arc to be completed.
func chapterUnlocked(ctx context.Context, tx pgx.Tx, userID string, c *chapterRow) (bool, error) {
	const q = `SELECT COALESCE(
			(SELECT display_order FROM career.career_rank WHERE rank_code = $1) <=
			(SELECT r.display_order FROM career.user_career_state s JOIN career.career_rank r ON r.rank_code = s.current_rank_code WHERE s.user_id = $2), false)
		AND NOT EXISTS (
			SELECT 1 FROM career.mission_chapter prev WHERE prev.arc_id = $3::uuid AND prev.display_order < $4
			AND NOT EXISTS (SELECT 1 FROM career.chapter_attempt a WHERE a.chapter_id = prev.id AND a.user_id = $2 AND a.status = 'completed'))`
	var ok bool
	if err := tx.QueryRow(ctx, q, c.entryRank, userID, c.arcID, c.displayOrder).Scan(&ok); err != nil {
		return false, fmt.Errorf("career: check chapter unlock: %w", err)
	}
	return ok, nil
}

// StartChapterAttempt returns the learner's in-progress attempt for the chapter or creates one.
func (s *Store) StartChapterAttempt(ctx context.Context, userID, chapterID string) (*ChapterAttempt, bool, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, false, fmt.Errorf("career: begin start attempt: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	chapter, err := s.loadPublishedChapter(ctx, tx, chapterID)
	if err != nil {
		return nil, false, err
	}
	if err := lockStoryKey(ctx, tx, userID, chapterID); err != nil {
		return nil, false, fmt.Errorf("career: lock attempt: %w", err)
	}
	if err := ensureCareerState(ctx, tx, userID); err != nil {
		return nil, false, err
	}
	unlocked, err := chapterUnlocked(ctx, tx, userID, chapter)
	if err != nil {
		return nil, false, err
	}
	if !unlocked {
		return nil, false, ErrChapterLocked
	}

	var a ChapterAttempt
	const existingQ = `SELECT id::text, chapter_id::text, status, started_at FROM career.chapter_attempt
		WHERE user_id = $1 AND chapter_id = $2::uuid AND status = 'in_progress' ORDER BY started_at DESC LIMIT 1`
	err = tx.QueryRow(ctx, existingQ, userID, chapterID).Scan(&a.ID, &a.ChapterID, &a.Status, &a.StartedAt)
	created := false
	if errors.Is(err, pgx.ErrNoRows) {
		const insertQ = `INSERT INTO career.chapter_attempt (user_id, chapter_id) VALUES ($1, $2::uuid)
			RETURNING id::text, chapter_id::text, status, started_at`
		if err = tx.QueryRow(ctx, insertQ, userID, chapterID).Scan(&a.ID, &a.ChapterID, &a.Status, &a.StartedAt); err != nil {
			return nil, false, fmt.Errorf("career: create attempt: %w", err)
		}
		created = true
	} else if err != nil {
		return nil, false, fmt.Errorf("career: load attempt: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, false, fmt.Errorf("career: commit start attempt: %w", err)
	}
	return &a, created, nil
}

// CompleteChapterAttempt completes the learner's in-progress attempt and applies its rewards in one transaction.
// A correct or absent optionKey earns the chapter rewards, a wrong one a quarter of them; later completions only pay
// what earlier ones have not yet awarded. Without an in-progress attempt it returns the last completed snapshot.
func (s *Store) CompleteChapterAttempt(ctx context.Context, userID, chapterID, optionKey string) (*ChapterCompletion, error) {
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("career: begin complete attempt: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	chapter, err := s.loadPublishedChapter(ctx, tx, chapterID)
	if err != nil {
		return nil, err
	}
	if err := lockStoryKey(ctx, tx, userID, chapterID); err != nil {
		return nil, fmt.Errorf("career: lock attempt: %w", err)
	}
	if err := ensureCareerState(ctx, tx, userID); err != nil {
		return nil, err
	}

	var attemptID string
	err = tx.QueryRow(ctx, `SELECT id::text FROM career.chapter_attempt
		WHERE user_id = $1 AND chapter_id = $2::uuid AND status = 'in_progress' ORDER BY started_at DESC LIMIT 1 FOR UPDATE`, userID, chapterID).Scan(&attemptID)
	if errors.Is(err, pgx.ErrNoRows) {
		var snapshot []byte
		err = tx.QueryRow(ctx, `SELECT score_snapshot FROM career.chapter_attempt
			WHERE user_id = $1 AND chapter_id = $2::uuid AND status = 'completed' AND score_snapshot IS NOT NULL
			ORDER BY completed_at DESC LIMIT 1`, userID, chapterID).Scan(&snapshot)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNoActiveAttempt
		}
		if err != nil {
			return nil, fmt.Errorf("career: load completed snapshot: %w", err)
		}
		var prior attemptSnapshot
		if err := json.Unmarshal(snapshot, &prior); err != nil {
			return nil, fmt.Errorf("career: decode completed snapshot: %w", err)
		}
		// End the transaction first: GetMe needs pooled connections of its own, and this one holds a connection
		// and the per-chapter lock that every concurrent completion is waiting on.
		if err := tx.Rollback(ctx); err != nil {
			return nil, fmt.Errorf("career: release replay transaction: %w", err)
		}
		me, err := s.GetMe(ctx, userID)
		if err != nil {
			return nil, err
		}
		return &ChapterCompletion{Career: me, Result: normalizeResult(prior.ChapterResult)}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("career: load attempt: %w", err)
	}

	var rewards rewardsDoc
	if err := json.Unmarshal(chapter.rewardsRaw, &rewards); err != nil {
		return nil, fmt.Errorf("career: chapter %s has a malformed rewards payload: %w", chapterID, err)
	}
	var scenarios scenarioDoc
	if err := json.Unmarshal(chapter.scenarioRaw, &scenarios); err != nil {
		return nil, fmt.Errorf("career: chapter %s has a malformed scenario payload: %w", chapterID, err)
	}

	factor := 100
	var correct *bool
	if optionKey != "" {
		found := false
		if len(scenarios.Scenarios) > 0 {
			for _, option := range scenarios.Scenarios[0].Question.Options {
				if option.OptionKey == optionKey {
					found = true
					isCorrect := option.IsCorrect
					correct = &isCorrect
					if !isCorrect {
						factor = wrongAnswerPercent
					}
				}
			}
		}
		if !found {
			return nil, ErrInvalidOption
		}
	}

	prev, firstCompletion, err := previouslyAwarded(ctx, tx, userID, chapterID)
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	result := ChapterResult{
		ChapterID: chapterID, SkillDeltas: map[string]int{}, NpcTrustDeltas: []NpcTrustDelta{}, ContextMemoIDs: []string{},
		NpcReactionMontage: rewards.NpcReactionMontage, CompletedAt: now.Format(time.RFC3339),
	}
	if d := rewards.RankXP*factor/100 - prev.RankXPDelta; d > 0 {
		result.RankXPDelta = d
	}
	for axis, gain := range rewards.SkillGains {
		if !skillAxes[axis] || gain <= 0 {
			continue
		}
		if d := gain*factor/100 - prev.SkillDeltas[axis]; d > 0 {
			result.SkillDeltas[axis] = d
		}
	}
	activeNpcs, err := activeNpcSet(ctx, tx)
	if err != nil {
		return nil, err
	}
	prevTrust := map[string]int{}
	for _, t := range prev.NpcTrustDeltas {
		prevTrust[t.NpcSlug] += t.Delta
	}
	for _, gain := range rewards.NpcTrustGains {
		if !activeNpcs[gain.NpcSlug] || gain.Delta <= 0 {
			continue
		}
		if d := gain.Delta*factor/100 - prevTrust[gain.NpcSlug]; d > 0 {
			result.NpcTrustDeltas = append(result.NpcTrustDeltas, NpcTrustDelta{NpcSlug: gain.NpcSlug, Delta: d})
		}
	}

	var currentRank string
	var xp int
	if err := tx.QueryRow(ctx, `SELECT current_rank_code, rank_xp FROM career.user_career_state WHERE user_id = $1 FOR UPDATE`, userID).Scan(&currentRank, &xp); err != nil {
		return nil, fmt.Errorf("career: lock state: %w", err)
	}
	newXP := xp + result.RankXPDelta
	// At most one rank per completion: XP banked elsewhere (daily clock-ins) must not skip rank-gated arcs.
	newRank := currentRank
	var xpToNext, order int
	switch err := tx.QueryRow(ctx, `SELECT xp_to_next, display_order FROM career.career_rank WHERE rank_code = $1`, currentRank).Scan(&xpToNext, &order); {
	case errors.Is(err, pgx.ErrNoRows):
	case err != nil:
		return nil, fmt.Errorf("career: load rank: %w", err)
	case xpToNext > 0 && newXP >= xpToNext:
		var next string
		switch err := tx.QueryRow(ctx, `SELECT rank_code FROM career.career_rank WHERE display_order > $1 ORDER BY display_order ASC LIMIT 1`, order).Scan(&next); {
		case errors.Is(err, pgx.ErrNoRows):
		case err != nil:
			return nil, fmt.Errorf("career: load next rank: %w", err)
		default:
			newRank = next
		}
	}
	if _, err := tx.Exec(ctx, `UPDATE career.user_career_state SET current_rank_code = $2, rank_xp = $3, updated_at = NOW() WHERE user_id = $1`, userID, newRank, newXP); err != nil {
		return nil, fmt.Errorf("career: update state: %w", err)
	}
	for axis, delta := range result.SkillDeltas {
		if _, err := tx.Exec(ctx, `INSERT INTO career.career_skill_stat (user_id, axis_code, value, updated_at)
			VALUES ($1, $2, LEAST(100, GREATEST(0, $3)), NOW())
			ON CONFLICT (user_id, axis_code) DO UPDATE SET value = LEAST(100, GREATEST(0, career.career_skill_stat.value + $3)), updated_at = NOW()`, userID, axis, delta); err != nil {
			return nil, fmt.Errorf("career: update skill %s: %w", axis, err)
		}
	}
	for _, trust := range result.NpcTrustDeltas {
		if _, err := tx.Exec(ctx, `INSERT INTO career.npc_relation (user_id, npc_slug, trust_score, last_interaction_at)
			VALUES ($1, $2, LEAST(100, GREATEST(0, 50 + $3)), $4)
			ON CONFLICT (user_id, npc_slug) DO UPDATE SET trust_score = LEAST(100, GREATEST(0, career.npc_relation.trust_score + $3)), last_interaction_at = $4`,
			userID, trust.NpcSlug, trust.Delta, now); err != nil {
			return nil, fmt.Errorf("career: update npc trust %s: %w", trust.NpcSlug, err)
		}
	}
	var rankUp *RankUp
	if newRank != currentRank {
		rankUp = &RankUp{FromRankCode: currentRank, ToRankCode: newRank}
		snapshot, _ := json.Marshal(map[string]any{"attemptId": attemptID, "chapterId": chapterID, "newXp": newXP})
		if _, err := tx.Exec(ctx, `INSERT INTO career.rank_progression_event (user_id, from_rank_code, to_rank_code, trigger_event, snapshot)
			VALUES ($1, $2, $3, 'chapter_completed', $4::jsonb)`, userID, currentRank, newRank, string(snapshot)); err != nil {
			return nil, fmt.Errorf("career: record rank progression: %w", err)
		}
	}
	if firstCompletion {
		memoID, err := insertChapterMemo(ctx, tx, userID, chapterID, chapter, &scenarios, &rewards)
		if err != nil {
			return nil, err
		}
		result.ContextMemoIDs = append(result.ContextMemoIDs, memoID)
	}
	result = normalizeResult(result)
	stored, err := json.Marshal(attemptSnapshot{ChapterResult: result, OptionKey: optionKey, Correct: correct})
	if err != nil {
		return nil, fmt.Errorf("career: encode snapshot: %w", err)
	}
	if _, err := tx.Exec(ctx, `UPDATE career.chapter_attempt SET status = 'completed', completed_at = $2, score_snapshot = $3::jsonb WHERE id = $1::uuid`, attemptID, now, string(stored)); err != nil {
		return nil, fmt.Errorf("career: complete attempt: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("career: commit complete attempt: %w", err)
	}
	me, err := s.GetMe(ctx, userID)
	if err != nil {
		return nil, err
	}
	return &ChapterCompletion{Career: me, Result: normalizeResult(result), RankUp: rankUp}, nil
}

// previouslyAwarded sums what earlier completions of this chapter already paid.
func previouslyAwarded(ctx context.Context, tx pgx.Tx, userID, chapterID string) (ChapterResult, bool, error) {
	total := ChapterResult{SkillDeltas: map[string]int{}}
	rows, err := tx.Query(ctx, `SELECT score_snapshot FROM career.chapter_attempt
		WHERE user_id = $1 AND chapter_id = $2::uuid AND status = 'completed' AND score_snapshot IS NOT NULL`, userID, chapterID)
	if err != nil {
		return total, false, fmt.Errorf("career: load prior completions: %w", err)
	}
	defer rows.Close()
	first := true
	for rows.Next() {
		first = false
		var raw []byte
		if err := rows.Scan(&raw); err != nil {
			return total, false, fmt.Errorf("career: scan prior completion: %w", err)
		}
		var prior ChapterResult
		if err := json.Unmarshal(raw, &prior); err != nil {
			return total, false, fmt.Errorf("career: decode prior completion: %w", err)
		}
		total.RankXPDelta += prior.RankXPDelta
		for axis, delta := range prior.SkillDeltas {
			total.SkillDeltas[axis] += delta
		}
		total.NpcTrustDeltas = append(total.NpcTrustDeltas, prior.NpcTrustDeltas...)
	}
	return total, first, rows.Err()
}

func activeNpcSet(ctx context.Context, tx pgx.Tx) (map[string]bool, error) {
	rows, err := tx.Query(ctx, `SELECT slug FROM career.story_npc WHERE status = 'active'`)
	if err != nil {
		return nil, fmt.Errorf("career: list npcs: %w", err)
	}
	defer rows.Close()
	set := map[string]bool{}
	for rows.Next() {
		var slug string
		if err := rows.Scan(&slug); err != nil {
			return nil, fmt.Errorf("career: scan npc: %w", err)
		}
		set[slug] = true
	}
	return set, rows.Err()
}

func normalizeResult(r ChapterResult) ChapterResult {
	if r.SkillDeltas == nil {
		r.SkillDeltas = map[string]int{}
	}
	if r.NpcTrustDeltas == nil {
		r.NpcTrustDeltas = []NpcTrustDelta{}
	}
	if r.ContextMemoIDs == nil {
		r.ContextMemoIDs = []string{}
	}
	if r.NpcReactionMontage == nil {
		r.NpcReactionMontage = []json.RawMessage{}
	}
	return r
}

func memoKindForScenario(scenarioType string) string {
	switch scenarioType {
	case "complaint":
		return "soft_refusal"
	case "meeting":
		return "discourse_marker"
	case "chat", "deadline":
		return "nuance_pattern"
	case "email":
		return "keigo_register"
	}
	return "scene_pattern"
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if v != "" {
			return v
		}
	}
	return ""
}

// insertChapterMemo records the review note a first completion adds to the learner's inbox.
func insertChapterMemo(ctx context.Context, tx pgx.Tx, userID, chapterID string, chapter *chapterRow, scenarios *scenarioDoc, rewards *rewardsDoc) (string, error) {
	var scenarioType, titleJa, titleVi, goalJa, goalVi, contextVi, prompt, correctText, characterSlug string
	if len(scenarios.Scenarios) > 0 {
		sc := scenarios.Scenarios[0]
		scenarioType, titleJa, titleVi, goalJa, goalVi, contextVi, prompt = sc.ScenarioType, sc.TitleJa, sc.TitleVi, sc.GoalJa, sc.GoalVi, sc.ContextSummaryVi, sc.Question.PromptVi
		for _, option := range sc.Question.Options {
			if option.IsCorrect {
				correctText = option.TextJa
				break
			}
		}
		if len(sc.Characters) > 0 {
			characterSlug = sc.Characters[0].NpcSlug
		}
	}
	npcSlug := characterSlug
	if len(rewards.NpcTrustGains) > 0 && rewards.NpcTrustGains[0].NpcSlug != "" {
		npcSlug = rewards.NpcTrustGains[0].NpcSlug
	}
	if npcSlug == "" {
		npcSlug = "tanaka_senpai"
	}
	axes := make([]string, 0, len(rewards.SkillGains))
	for axis, gain := range rewards.SkillGains {
		if skillAxes[axis] && gain > 0 {
			axes = append(axes, axis)
		}
	}
	sort.Strings(axes)
	skills := strings.Join(axes, ", ")
	payload := contextMemoPayload{
		CardKind:         memoKindForScenario(scenarioType),
		ExpressionJa:     firstNonEmpty(correctText, goalJa, chapter.titleJa),
		SurfaceMeaningVi: firstNonEmpty(titleVi, chapter.titleVi),
		RealIntentVi:     firstNonEmpty(goalVi, contextVi, fmt.Sprintf("Ghi chú ôn tập từ chapter \"%s\".", chapter.titleVi)),
		SceneJa:          firstNonEmpty(titleJa, chapter.titleJa),
		ToneVi:           "Ngữ cảnh công sở Nhật",
		BJTTrapVi:        firstNonEmpty(prompt, "Ôn lại bối cảnh BJT của chapter này để tránh hiểu sai ý định, sắc thái và hành động tiếp theo."),
		FromNPCSlug:      npcSlug,
	}
	if skills != "" {
		payload.ToneVi = "Trọng tâm: " + skills
	}
	var nameJa string
	var avatar []byte
	if err := tx.QueryRow(ctx, `SELECT name_ja, avatar_media FROM career.story_npc WHERE slug = $1 AND status = 'active'`, npcSlug).Scan(&nameJa, &avatar); err == nil {
		var media struct {
			AvatarInitial string `json:"avatarInitial"`
			AvatarTint    string `json:"avatarTint"`
		}
		_ = json.Unmarshal(avatar, &media)
		payload.FromNPCNameJa = nameJa
		payload.FromNPCAvatarInitial = media.AvatarInitial
		payload.FromNPCAvatarTint = media.AvatarTint
	}
	encoded, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("career: encode memo: %w", err)
	}
	var id string
	if err := tx.QueryRow(ctx, `INSERT INTO career.context_memo (user_id, memo_type, payload) VALUES ($1, $2, $3::jsonb) RETURNING id::text`,
		userID, payload.CardKind, string(encoded)).Scan(&id); err != nil {
		return "", fmt.Errorf("career: insert memo: %w", err)
	}
	return id, nil
}

// GetStoryProgress returns the learner's rank and completed chapters (only chapters of published arcs).
func (s *Store) GetStoryProgress(ctx context.Context, userID string) (*StoryProgress, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	progress := &StoryProgress{CurrentRankCode: "R1", CompletedChapterIDs: []string{}, Arcs: map[string]int{}}
	err := s.db.QueryRow(ctx, `SELECT current_rank_code FROM career.user_career_state WHERE user_id = $1`, userID).Scan(&progress.CurrentRankCode)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("career: story progress rank: %w", err)
	}
	rows, err := s.db.Query(ctx, `SELECT DISTINCT c.id::text, a.slug FROM career.chapter_attempt t
		JOIN career.mission_chapter c ON c.id = t.chapter_id JOIN career.mission_arc a ON a.id = c.arc_id
		WHERE t.user_id = $1 AND t.status = 'completed' AND a.status = 'published' ORDER BY a.slug, c.id::text`, userID)
	if err != nil {
		return nil, fmt.Errorf("career: story progress chapters: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var id, slug string
		if err := rows.Scan(&id, &slug); err != nil {
			return nil, fmt.Errorf("career: scan story progress: %w", err)
		}
		progress.CompletedChapterIDs = append(progress.CompletedChapterIDs, id)
		progress.Arcs[slug]++
	}
	return progress, rows.Err()
}
