package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"math/rand"
	"net/http"
	"net/url"
	"strings"
	"unicode"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/authn"
)

type exerciseChoice struct {
	Key  string `json:"key"`
	Text string `json:"text"`
}

type generatedExercise struct {
	ID           string           `json:"id"`
	ExerciseType string           `json:"exerciseType"`
	Prompt       map[string]any   `json:"prompt"`
	Choices      []exerciseChoice `json:"choices"`
	Explanation  string           `json:"explanation"`
	Level        *string          `json:"level"`
}

type exerciseDraft struct {
	sourceType    string
	sourceID      string
	level         *string
	prompt        map[string]any
	choices       []exerciseChoice
	correctAnswer any
	explanation   string
}

type generateExercisesRequest struct {
	Type  string `json:"type"`
	Count int    `json:"count"`
	Level string `json:"level"`
}

type exerciseLexeme struct {
	ID       string
	Headword string
	Reading  string
	Meaning  string
	Level    *string
}

type exerciseSentence struct {
	ID          string
	Japanese    string
	Reading     string
	Translation string
	Level       *string
}

type clozeTarget struct {
	ID          string
	SentenceID  string
	Headword    string
	Japanese    string
	Translation string
	Level       *string
}

func generateExercisesHandler(db *pgxpool.Pool, logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := authn.GetLearnerIdentity(r.Context())
		if !ok {
			writeJSONError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req generateExercisesRequest
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxExerciseBodyBytes)).Decode(&req); err != nil {
			writeJSONError(w, "invalid request", http.StatusBadRequest)
			return
		}
		exerciseType := strings.TrimSpace(req.Type)
		if exerciseType != "meaning_match" && exerciseType != "cloze" && exerciseType != "word_order" && exerciseType != "translation" && exerciseType != "listening" {
			writeJSONError(w, "unsupported exercise type", http.StatusBadRequest)
			return
		}
		count := req.Count
		if count == 0 {
			count = 10
		}
		if count < 1 || count > 50 {
			writeJSONError(w, "count must be between 1 and 50", http.StatusBadRequest)
			return
		}
		level := strings.TrimSpace(req.Level)
		if level != "" && level != "N1" && level != "N2" && level != "N3" && level != "N4" && level != "N5" {
			writeJSONError(w, "invalid level", http.StatusBadRequest)
			return
		}

		drafts, err := buildExerciseDrafts(r.Context(), db, exerciseType, level, count)
		if err != nil {
			logger.Error("generate exercises", "error", err, "type", exerciseType, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		if len(drafts) == 0 {
			writeJSONError(w, "no suitable content is available for this exercise type and level", http.StatusNotFound)
			return
		}
		generated, err := persistExerciseDrafts(r.Context(), db, exerciseType, drafts)
		if err != nil {
			logger.Error("persist generated exercises", "error", err, "type", exerciseType, "user_id", identity.UserID)
			writeJSONError(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(generated)
	}
}

func buildExerciseDrafts(ctx context.Context, db *pgxpool.Pool, exerciseType, level string, count int) ([]exerciseDraft, error) {
	if exerciseType == "meaning_match" || exerciseType == "listening" {
		lexemes, err := selectExerciseLexemes(ctx, db, level, count*5)
		if err != nil {
			return nil, err
		}
		return lexemeExerciseDrafts(exerciseType, lexemes, count), nil
	}
	if exerciseType == "cloze" {
		targets, err := selectClozeTargets(ctx, db, level, count*5)
		if err != nil {
			return nil, err
		}
		distractors, err := selectExerciseLexemes(ctx, db, level, count*5+4)
		if err != nil {
			return nil, err
		}
		return clozeExerciseDrafts(targets, distractors, count), nil
	}
	needWhitespace := exerciseType == "word_order"
	sentences, err := selectExerciseSentences(ctx, db, level, count*5, needWhitespace)
	if err != nil {
		return nil, err
	}
	if exerciseType == "word_order" {
		return wordOrderDrafts(sentences, count), nil
	}
	return translationDrafts(sentences, count), nil
}

func lexemeExerciseDrafts(exerciseType string, lexemes []exerciseLexeme, count int) []exerciseDraft {
	letters := [...]string{"A", "B", "C", "D"}
	drafts := make([]exerciseDraft, 0, count)
	for i := 0; i+4 < len(lexemes) && len(drafts) < count; i += 5 {
		target := lexemes[i]
		values := []string{target.Meaning}
		seen := map[string]bool{strings.ToLower(target.Meaning): true}
		for _, candidate := range lexemes[i+1 : i+5] {
			key := strings.ToLower(candidate.Meaning)
			if !seen[key] {
				seen[key] = true
				values = append(values, candidate.Meaning)
			}
		}
		if len(values) < 4 {
			continue
		}
		choices, answer := multipleChoice(values, letters[:])
		prompt := map[string]any{"text": target.Headword, "reading": target.Reading}
		if exerciseType == "listening" {
			prompt = map[string]any{"audioUrl": "tts://speak?text=" + url.QueryEscape(target.Headword) + "&lang=ja-JP&rate=0.85"}
		}
		drafts = append(drafts, exerciseDraft{
			sourceType: "lexeme", sourceID: target.ID, level: target.Level,
			prompt: prompt, choices: choices, correctAnswer: answer, explanation: target.Meaning,
		})
	}
	return drafts
}

func clozeExerciseDrafts(targets []clozeTarget, lexemes []exerciseLexeme, count int) []exerciseDraft {
	letters := [...]string{"A", "B", "C", "D"}
	drafts := make([]exerciseDraft, 0, count)
	for _, target := range targets {
		values := []string{target.Headword}
		seen := map[string]bool{strings.ToLower(target.Headword): true}
		for _, candidate := range lexemes {
			key := strings.ToLower(candidate.Headword)
			if !seen[key] {
				seen[key] = true
				values = append(values, candidate.Headword)
			}
			if len(values) == 4 {
				break
			}
		}
		if len(values) < 4 {
			continue
		}
		choices, answer := multipleChoice(values, letters[:])
		masked := strings.Replace(target.Japanese, target.Headword, "＿＿", 1)
		drafts = append(drafts, exerciseDraft{
			sourceType: "example_sentence", sourceID: target.SentenceID, level: target.Level,
			prompt:  map[string]any{"maskedSentence": masked, "hint": target.Translation},
			choices: choices, correctAnswer: answer, explanation: target.Translation,
		})
		if len(drafts) == count {
			break
		}
	}
	return drafts
}

func translationDrafts(sentences []exerciseSentence, count int) []exerciseDraft {
	letters := [...]string{"A", "B", "C", "D"}
	drafts := make([]exerciseDraft, 0, count)
	for i := 0; i+4 < len(sentences) && len(drafts) < count; i += 5 {
		target := sentences[i]
		values := []string{target.Translation}
		seen := map[string]bool{strings.ToLower(target.Translation): true}
		for _, candidate := range sentences[i+1 : i+5] {
			key := strings.ToLower(candidate.Translation)
			if !seen[key] {
				seen[key] = true
				values = append(values, candidate.Translation)
			}
		}
		if len(values) < 4 {
			continue
		}
		choices, answer := multipleChoice(values, letters[:])
		drafts = append(drafts, exerciseDraft{
			sourceType: "example_sentence", sourceID: target.ID, level: target.Level,
			prompt:  map[string]any{"japaneseSentence": target.Japanese, "reading": target.Reading},
			choices: choices, correctAnswer: answer, explanation: target.Translation,
		})
	}
	return drafts
}

func wordOrderDrafts(sentences []exerciseSentence, count int) []exerciseDraft {
	drafts := make([]exerciseDraft, 0, min(count, len(sentences)))
	for _, sentence := range sentences {
		if strings.IndexFunc(sentence.Japanese, func(r rune) bool { return unicode.IsLetter(r) && unicode.Is(unicode.Latin, r) }) >= 0 {
			continue
		}
		tokens := strings.Fields(sentence.Japanese)
		if len(tokens) < 3 {
			continue
		}
		unique := make(map[string]struct{}, len(tokens))
		for _, token := range tokens {
			unique[token] = struct{}{}
		}
		if len(unique) != len(tokens) {
			continue
		}
		permutation := rand.Perm(len(tokens))
		shuffled := make([]string, len(tokens))
		for i, j := range permutation {
			shuffled[i] = tokens[j]
		}
		if strings.Join(shuffled, " ") == strings.Join(tokens, " ") {
			shuffled[0], shuffled[1] = shuffled[1], shuffled[0]
		}
		drafts = append(drafts, exerciseDraft{
			sourceType: "example_sentence", sourceID: sentence.ID, level: sentence.Level,
			prompt:  map[string]any{"hint": sentence.Translation, "shuffledTokens": shuffled},
			choices: []exerciseChoice{}, correctAnswer: map[string][]string{"orderedTokens": tokens}, explanation: sentence.Japanese,
		})
		if len(drafts) == count {
			break
		}
	}
	return drafts
}

func multipleChoice(values, letters []string) ([]exerciseChoice, map[string]string) {
	correctIndex := rand.Intn(len(letters))
	choices := make([]exerciseChoice, len(letters))
	valueIndex := 1
	for i, key := range letters {
		text := values[0]
		if i != correctIndex {
			text = values[valueIndex]
			valueIndex++
		}
		choices[i] = exerciseChoice{Key: key, Text: text}
	}
	return choices, map[string]string{"key": letters[correctIndex]}
}

func persistExerciseDrafts(ctx context.Context, db *pgxpool.Pool, exerciseType string, drafts []exerciseDraft) ([]generatedExercise, error) {
	tx, err := db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	generated := make([]generatedExercise, 0, len(drafts))
	for _, draft := range drafts {
		promptJSON, err := json.Marshal(draft.prompt)
		if err != nil {
			return nil, err
		}
		choicesJSON, err := json.Marshal(draft.choices)
		if err != nil {
			return nil, err
		}
		answerJSON, err := json.Marshal(draft.correctAnswer)
		if err != nil {
			return nil, err
		}
		generationKey := exerciseType + ":" + draft.sourceType + ":" + draft.sourceID
		if draft.sourceType == "lexeme" {
			// Keep assigned questions immutable while replacing cached, abbreviated gloss choices.
			generationKey += ":primary-senses-v2"
		}
		var id string
		var storedPrompt, storedChoices []byte
		var storedLevel *string
		err = tx.QueryRow(ctx, `INSERT INTO exercise.exercise
			(generation_key, exercise_type, source_type, source_id, level, prompt, choices, correct_answer, explanation)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
			ON CONFLICT (generation_key) DO NOTHING
			RETURNING id::text, prompt, choices, level`,
			generationKey, exerciseType, draft.sourceType, draft.sourceID, draft.level, promptJSON, choicesJSON, answerJSON, draft.explanation).
			Scan(&id, &storedPrompt, &storedChoices, &storedLevel)
		if errors.Is(err, pgx.ErrNoRows) {
			err = tx.QueryRow(ctx, `SELECT id::text, prompt, choices, level FROM exercise.exercise WHERE generation_key = $1`, generationKey).
				Scan(&id, &storedPrompt, &storedChoices, &storedLevel)
		}
		if err != nil {
			return nil, err
		}
		var prompt map[string]any
		var choices []exerciseChoice
		if err := json.Unmarshal(storedPrompt, &prompt); err != nil {
			return nil, err
		}
		if err := json.Unmarshal(storedChoices, &choices); err != nil {
			return nil, err
		}
		generated = append(generated, generatedExercise{
			ID: id, ExerciseType: exerciseType, Prompt: prompt, Choices: choices,
			Explanation: "", Level: storedLevel,
		})
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return generated, nil
}

func selectExerciseLexemes(ctx context.Context, db *pgxpool.Pool, level string, limit int) ([]exerciseLexeme, error) {
	rows, err := db.Query(ctx, `SELECT id::text, headword, COALESCE(reading, ''),
		COALESCE((SELECT NULLIF(trim(s.meaning_vi), '') FROM content.lexeme_sense s
			WHERE s.lexeme_id = l.id AND trim(s.meaning_vi) <> '' ORDER BY s.position LIMIT 1),
			NULLIF(kanji_meaning_vi, ''), short_meaning_vi), jlpt_level
		FROM content.lexeme l
		WHERE status = 'active'
			AND (EXISTS (SELECT 1 FROM content.lexeme_sense s WHERE s.lexeme_id = l.id AND trim(s.meaning_vi) <> '')
				OR COALESCE(NULLIF(kanji_meaning_vi, ''), NULLIF(short_meaning_vi, '')) IS NOT NULL)
			AND ($1 = '' OR jlpt_level ~ ('(^|,)' || $1 || '(,|$)'))
		ORDER BY random() LIMIT $2`, level, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	lexemes := make([]exerciseLexeme, 0, limit)
	for rows.Next() {
		var item exerciseLexeme
		if err := rows.Scan(&item.ID, &item.Headword, &item.Reading, &item.Meaning, &item.Level); err != nil {
			return nil, err
		}
		senses := strings.FieldsFunc(item.Meaning, func(r rune) bool { return r == ';' || r == '；' })
		for i := range senses {
			senses[i] = strings.TrimSpace(senses[i])
		}
		item.Meaning = strings.Join(senses[:min(2, len(senses))], "; ")
		lexemes = append(lexemes, item)
	}
	return lexemes, rows.Err()
}

func selectClozeTargets(ctx context.Context, db *pgxpool.Pool, level string, limit int) ([]clozeTarget, error) {
	rows, err := db.Query(ctx, `SELECT target_id, sentence_id, headword, japanese_text, translation_vi, jlpt_level FROM (
		SELECT DISTINCT ON (e.id) l.id::text AS target_id, e.id::text AS sentence_id, l.headword, e.japanese_text, e.translation_vi, l.jlpt_level
		FROM content.example_sentence e
		JOIN content.lexeme_sense_example x ON x.example_sentence_id = e.id
		JOIN content.lexeme_sense s ON s.id = x.sense_id
		JOIN content.lexeme l ON l.id = s.lexeme_id
		WHERE e.status = 'active' AND e.translation_vi IS NOT NULL AND e.translation_vi <> ''
			AND position(l.headword in e.japanese_text) > 0
			AND ($1 = '' OR l.jlpt_level ~ ('(^|,)' || $1 || '(,|$)'))
		ORDER BY e.id, random()) targets ORDER BY random() LIMIT $2`, level, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	targets := make([]clozeTarget, 0, limit)
	for rows.Next() {
		var target clozeTarget
		if err := rows.Scan(&target.ID, &target.SentenceID, &target.Headword, &target.Japanese, &target.Translation, &target.Level); err != nil {
			return nil, err
		}
		targets = append(targets, target)
	}
	return targets, rows.Err()
}

func selectExerciseSentences(ctx context.Context, db *pgxpool.Pool, level string, limit int, requireWhitespace bool) ([]exerciseSentence, error) {
	return selectLexemeSentences(ctx, db, level, limit, requireWhitespace)
}

func selectLexemeSentences(ctx context.Context, db *pgxpool.Pool, level string, limit int, requireWhitespace bool) ([]exerciseSentence, error) {
	rows, err := db.Query(ctx, `SELECT sentence_id, japanese_text, reading, translation, jlpt_level FROM (
		SELECT DISTINCT ON (e.id) e.id::text AS sentence_id, e.japanese_text, COALESCE(e.reading, '') AS reading,
		COALESCE(e.translation_vi, '') AS translation, l.jlpt_level
		FROM content.example_sentence e
		JOIN content.lexeme_sense_example x ON x.example_sentence_id = e.id
		JOIN content.lexeme_sense s ON s.id = x.sense_id
		JOIN content.lexeme l ON l.id = s.lexeme_id
		WHERE e.status = 'active' AND e.translation_vi IS NOT NULL AND e.translation_vi <> ''
			AND ($1 = '' OR l.jlpt_level ~ ('(^|,)' || $1 || '(,|$)'))
			AND (NOT $3 OR e.japanese_text ~ '[[:space:]]')
			AND (NOT $3 OR e.japanese_text !~ '[A-Za-z]')
		ORDER BY e.id, random()) sentences ORDER BY random() LIMIT $2`, level, limit, requireWhitespace)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	sentences := make([]exerciseSentence, 0, limit)
	for rows.Next() {
		var sentence exerciseSentence
		if err := rows.Scan(&sentence.ID, &sentence.Japanese, &sentence.Reading, &sentence.Translation, &sentence.Level); err != nil {
			return nil, err
		}
		sentences = append(sentences, sentence)
	}
	return sentences, rows.Err()
}
