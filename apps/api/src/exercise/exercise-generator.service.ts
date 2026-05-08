import { Inject, Injectable, Logger } from "@nestjs/common";

import { ExerciseRepository } from "./exercise.repository.js";

interface GeneratedExercise {
  exerciseType: string;
  sourceType: string;
  sourceId: string;
  level: string | null;
  prompt: unknown;
  choices: unknown;
  correctAnswer: unknown;
  explanation: string | null;
  difficulty: string;
  tags: string[];
}

@Injectable()
export class ExerciseGeneratorService {
  private readonly logger = new Logger(ExerciseGeneratorService.name);

  constructor(
    @Inject(ExerciseRepository) private readonly repo: ExerciseRepository
  ) {}

  async generate(params: {
    exerciseType: string;
    level?: string;
    count: number;
    sourceType?: string;
  }): Promise<GeneratedExercise[]> {
    const { exerciseType, level, count, sourceType } = params;

    switch (exerciseType) {
      case "meaning_match":
        return this.generateMeaningMatch(level, count, sourceType);
      case "cloze":
        return this.generateCloze(level, count);
      case "word_order":
        return this.generateWordOrder(level, count);
      case "translation":
        return this.generateTranslation(level, count);
      case "listening":
        return this.generateListening(level, count);
      default:
        return this.generateMeaningMatch(level, count, sourceType);
    }
  }

  /* ── Meaning Match ───────────────────────────────────────────────────── */

  private async generateMeaningMatch(
    level: string | undefined,
    count: number,
    sourceType?: string
  ): Promise<GeneratedExercise[]> {
    const effectiveSourceType = sourceType ?? "lexeme";
    const exercises: GeneratedExercise[] = [];

    if (effectiveSourceType === "grammar") {
      const points = await this.repo.randomGrammarPointsWithExamples(level, count);
      const shuffled = shuffleArray(points);

      for (const point of shuffled.slice(0, count)) {
        const distractors = await this.repo.grammarDistractors(
          point.id,
          point.jlptLevel,
          3
        );

        const options = shuffleArray([
          { key: "A", text: point.meaningVi, correct: true },
          ...distractors.map((d, i) => ({
            key: String.fromCharCode(66 + i),
            text: d.meaningVi,
            correct: false
          }))
        ]);

        exercises.push({
          exerciseType: "meaning_match",
          sourceType: "grammar",
          sourceId: point.id,
          level: point.jlptLevel ?? null,
          prompt: { text: point.pattern, type: "grammar_pattern" },
          choices: options.map((o) => ({ key: o.key, text: o.text })),
          correctAnswer: { key: options.find((o) => o.correct)!.key },
          explanation: `${point.pattern} → ${point.meaningVi}`,
          difficulty: "medium",
          tags: point.category ? [point.category] : []
        });
      }
    } else {
      // Lexeme meaning match
      const lexemes = await this.repo.randomLexemesWithExamples(level, count);
      const shuffled = shuffleArray(lexemes);

      for (const lex of shuffled.slice(0, count)) {
        const sense = lex.senses[0];
        if (!sense) continue;

        const distractors = await this.repo.lexemeDistractors(
          lex.id,
          lex.jlptLevel,
          sense.partOfSpeech,
          3
        );

        const correctMeaning = sense.meaningVi || lex.shortMeaningVi || "";
        if (!correctMeaning) continue;

        const distractorMeanings = distractors
          .map((d) => d.senses[0]?.meaningVi)
          .filter(Boolean) as string[];

        if (distractorMeanings.length < 3) continue;

        const options = shuffleArray([
          { key: "A", text: correctMeaning, correct: true },
          ...distractorMeanings.slice(0, 3).map((text, i) => ({
            key: String.fromCharCode(66 + i),
            text,
            correct: false
          }))
        ]);

        exercises.push({
          exerciseType: "meaning_match",
          sourceType: "lexeme",
          sourceId: lex.id,
          level: lex.jlptLevel ?? null,
          prompt: {
            text: lex.headword,
            reading: lex.reading,
            type: "vocabulary"
          },
          choices: options.map((o) => ({ key: o.key, text: o.text })),
          correctAnswer: { key: options.find((o) => o.correct)!.key },
          explanation: `${lex.headword}（${lex.reading ?? ""}）→ ${correctMeaning}`,
          difficulty: "medium",
          tags: sense.partOfSpeech ? [sense.partOfSpeech] : []
        });
      }
    }

    return exercises;
  }

  /* ── Cloze (fill-in-the-blank) ───────────────────────────────────────── */

  private async generateCloze(
    level: string | undefined,
    count: number
  ): Promise<GeneratedExercise[]> {
    const lexemes = await this.repo.randomLexemesWithExamples(level, count);
    const exercises: GeneratedExercise[] = [];

    for (const lex of shuffleArray(lexemes)) {
      if (exercises.length >= count) break;

      const sense = lex.senses[0];
      const exLink = sense?.exampleLinks[0];
      const example = exLink?.exampleSentence;
      if (!example?.japaneseText || !example.translationVi) continue;

      // Check that headword actually appears in the sentence
      if (!example.japaneseText.includes(lex.headword)) continue;

      const maskedText = example.japaneseText.replace(lex.headword, "＿＿＿");

      const distractors = await this.repo.lexemeDistractors(
        lex.id,
        lex.jlptLevel,
        sense?.partOfSpeech ?? null,
        3
      );
      const distractorHeadwords = distractors
        .map((d) => d.headword)
        .filter(Boolean)
        .slice(0, 3);

      if (distractorHeadwords.length < 3) continue;

      const options = shuffleArray([
        { key: "A", text: lex.headword, correct: true },
        ...distractorHeadwords.map((text, i) => ({
          key: String.fromCharCode(66 + i),
          text,
          correct: false
        }))
      ]);

      exercises.push({
        exerciseType: "cloze",
        sourceType: "lexeme",
        sourceId: lex.id,
        level: lex.jlptLevel ?? null,
        prompt: {
          maskedSentence: maskedText,
          hint: example.translationVi,
          type: "cloze"
        },
        choices: options.map((o) => ({ key: o.key, text: o.text })),
        correctAnswer: { key: options.find((o) => o.correct)!.key, text: lex.headword },
        explanation: `${example.japaneseText}\n→ ${example.translationVi}`,
        difficulty: "medium",
        tags: []
      });
    }

    return exercises;
  }

  /* ── Word Order ──────────────────────────────────────────────────────── */

  private async generateWordOrder(
    level: string | undefined,
    count: number
  ): Promise<GeneratedExercise[]> {
    const lexemes = await this.repo.randomLexemesWithExamples(level, count);
    const exercises: GeneratedExercise[] = [];

    for (const lex of shuffleArray(lexemes)) {
      if (exercises.length >= count) break;

      const sense = lex.senses[0];
      const exLink = sense?.exampleLinks[0];
      const example = exLink?.exampleSentence;
      if (!example?.japaneseText || !example.translationVi) continue;

      // Simple tokenization by common particles and boundaries
      const tokens = tokenizeJapanese(example.japaneseText);
      if (tokens.length < 3 || tokens.length > 12) continue;

      const shuffledTokens = shuffleArray([...tokens]);

      exercises.push({
        exerciseType: "word_order",
        sourceType: "lexeme",
        sourceId: lex.id,
        level: lex.jlptLevel ?? null,
        prompt: {
          shuffledTokens,
          hint: example.translationVi,
          type: "word_order"
        },
        choices: shuffledTokens,
        correctAnswer: { orderedTokens: tokens },
        explanation: `${example.japaneseText}\n→ ${example.translationVi}`,
        difficulty: tokens.length <= 5 ? "easy" : tokens.length <= 8 ? "medium" : "hard",
        tags: []
      });
    }

    return exercises;
  }

  /* ── Translation ─────────────────────────────────────────────────────── */

  private async generateTranslation(
    level: string | undefined,
    count: number
  ): Promise<GeneratedExercise[]> {
    const lexemes = await this.repo.randomLexemesWithExamples(level, count);
    const exercises: GeneratedExercise[] = [];
    const usedSentences: Set<string> = new Set();

    for (const lex of shuffleArray(lexemes)) {
      if (exercises.length >= count) break;

      const sense = lex.senses[0];
      const exLink = sense?.exampleLinks[0];
      const example = exLink?.exampleSentence;
      if (!example?.japaneseText || !example.translationVi) continue;
      if (usedSentences.has(example.id)) continue;
      usedSentences.add(example.id);

      // Get distractor sentences at similar level
      const distractorLexemes = await this.repo.lexemeDistractors(
        lex.id,
        lex.jlptLevel,
        null,
        3
      );
      const distractorSentences: string[] = [];
      for (const d of distractorLexemes) {
        const dSense = d.senses[0];
        if (!dSense) continue;
        // We need example sentences from distractors, fetch them
        const dMeaning = dSense.meaningVi;
        if (dMeaning && dMeaning !== example.translationVi) {
          distractorSentences.push(dMeaning);
        }
      }
      if (distractorSentences.length < 3) continue;

      const options = shuffleArray([
        { key: "A", text: example.translationVi, correct: true },
        ...distractorSentences.slice(0, 3).map((text, i) => ({
          key: String.fromCharCode(66 + i),
          text,
          correct: false
        }))
      ]);

      exercises.push({
        exerciseType: "translation",
        sourceType: "lexeme",
        sourceId: lex.id,
        level: lex.jlptLevel ?? null,
        prompt: {
          japaneseSentence: example.japaneseText,
          reading: example.reading,
          type: "translation"
        },
        choices: options.map((o) => ({ key: o.key, text: o.text })),
        correctAnswer: { key: options.find((o) => o.correct)!.key },
        explanation: `${example.japaneseText}\n→ ${example.translationVi}`,
        difficulty: "medium",
        tags: []
      });
    }

    return exercises;
  }

  /* ── Listening ───────────────────────────────────────────────────────── */

  private async generateListening(
    level: string | undefined,
    count: number
  ): Promise<GeneratedExercise[]> {
    // Listening exercises use the same structure as meaning_match but prompt is audio-oriented.
    // Without TTS, we show the sentence and ask for the correct translation.
    // When audio is available, the prompt would include an audioUrl.
    return this.generateTranslation(level, count).then((exercises) =>
      exercises.map((e) => ({
        ...e,
        exerciseType: "listening",
        prompt: {
          ...(e.prompt as Record<string, unknown>),
          type: "listening",
          audioUrl: null // placeholder until TTS is available
        }
      }))
    );
  }
}

/* ── Helpers ──────────────────────────────────────────────────────────── */

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Simple Japanese tokenizer that splits on common particle boundaries.
 * Uses regex to split around particles (は, が, を, に, で, と, も, の, へ, から, まで, より).
 * For production, this should be replaced by kuromoji/ReadingTextAnalysis.
 */
function tokenizeJapanese(text: string): string[] {
  // Split around particles while keeping them as separate tokens
  const particlePattern = /(は|が|を|に|で|と|も|の|へ|から|まで|より|けど|ので|のに|ながら|て|た|ます|です|ました|ません)/g;
  const parts = text.split(particlePattern).filter((p) => p.length > 0);

  // If split produced too few tokens, try character-level chunking
  if (parts.length < 3) {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += 2) {
      chunks.push(text.slice(i, Math.min(i + 2, text.length)));
    }
    return chunks;
  }

  return parts;
}
