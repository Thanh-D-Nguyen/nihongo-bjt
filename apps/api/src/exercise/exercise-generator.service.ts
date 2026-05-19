import { Inject, Injectable, Logger } from "@nestjs/common";

import { tokenizeJapanese as morphTokenize } from "../reading-assist/japanese-morphology.js";
import { ExerciseRepository } from "./exercise.repository.js";
import { TtsService } from "./tts.service.js";

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
    @Inject(ExerciseRepository) private readonly repo: ExerciseRepository,
    @Inject(TtsService) private readonly tts: TtsService
  ) {}

  async generate(params: {
    exerciseType: string;
    level?: string;
    count: number;
    sourceType?: string;
    difficulty?: string;
  }): Promise<GeneratedExercise[]> {
    const { exerciseType, level, count, sourceType, difficulty } = params;

    switch (exerciseType) {
      case "meaning_match":
        return this.generateMeaningMatch(level, count, sourceType, difficulty);
      case "cloze":
        return this.generateCloze(level, count, difficulty);
      case "word_order":
        return this.generateWordOrder(level, count, difficulty);
      case "translation":
        return this.generateTranslation(level, count, difficulty);
      case "listening":
        return this.generateListening(level, count, difficulty);
      default:
        return this.generateMeaningMatch(level, count, sourceType, difficulty);
    }
  }

  /* ── Meaning Match ───────────────────────────────────────────────────── */

  private async generateMeaningMatch(
    level: string | undefined,
    count: number,
    sourceType?: string,
    difficulty?: string
  ): Promise<GeneratedExercise[]> {
    const diff = difficulty ?? "medium";
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
          difficulty: diff,
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
          difficulty: diff,
          tags: sense.partOfSpeech ? [sense.partOfSpeech] : []
        });
      }
    }

    return exercises;
  }

  /* ── Cloze (fill-in-the-blank) ───────────────────────────────────────── */

  private async generateCloze(
    level: string | undefined,
    count: number,
    difficulty?: string
  ): Promise<GeneratedExercise[]> {
    const diff = difficulty ?? "medium";
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
        difficulty: diff,
        tags: []
      });
    }

    return exercises;
  }

  /* ── Word Order ──────────────────────────────────────────────────────── */

  private async generateWordOrder(
    level: string | undefined,
    count: number,
    difficulty?: string
  ): Promise<GeneratedExercise[]> {
    const lexemes = await this.repo.randomLexemesWithExamples(level, count);
    const exercises: GeneratedExercise[] = [];

    for (const lex of shuffleArray(lexemes)) {
      if (exercises.length >= count) break;

      const sense = lex.senses[0];
      const exLink = sense?.exampleLinks[0];
      const example = exLink?.exampleSentence;
      if (!example?.japaneseText || !example.translationVi) continue;

      // Morphological tokenization via kuromoji
      const tokens = await tokenizeForWordOrder(example.japaneseText);
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
        difficulty: difficulty ?? (tokens.length <= 5 ? "easy" : tokens.length <= 8 ? "medium" : "hard"),
        tags: []
      });
    }

    return exercises;
  }

  /* ── Translation ─────────────────────────────────────────────────────── */

  private async generateTranslation(
    level: string | undefined,
    count: number,
    difficulty?: string
  ): Promise<GeneratedExercise[]> {
    const diff = difficulty ?? "medium";
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
        difficulty: diff,
        tags: []
      });
    }

    return exercises;
  }

  /* ── Listening ───────────────────────────────────────────────────────── */

  private async generateListening(
    level: string | undefined,
    count: number,
    difficulty?: string
  ): Promise<GeneratedExercise[]> {
    const baseExercises = await this.generateTranslation(level, count, difficulty);

    const listeningExercises: GeneratedExercise[] = [];
    for (const e of baseExercises) {
      const prompt = e.prompt as Record<string, unknown>;
      const jaText = (prompt.japaneseSentence as string) ?? "";

      // Generate TTS audio URL for the Japanese text
      let audioUrl: string | null = null;
      if (jaText) {
        try {
          const ttsResult = await this.tts.synthesize(jaText, {
            languageCode: "ja-JP",
            speakingRate: 0.85
          });
          audioUrl = ttsResult.audioUrl;
        } catch (err) {
          this.logger.warn(`TTS failed for listening exercise: ${err}`);
        }
      }

      listeningExercises.push({
        ...e,
        exerciseType: "listening",
        prompt: {
          ...prompt,
          type: "listening",
          audioUrl
        }
      });
    }

    return listeningExercises;
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
 * Tokenize Japanese text using kuromoji morphological analysis.
 * Merges particles onto preceding content words for natural chunking.
 */
async function tokenizeForWordOrder(text: string): Promise<string[]> {
  const { spans } = await morphTokenize(text);
  if (spans.length === 0) return [];

  // Merge single-char particles (助詞) onto preceding token for natural chunks
  const merged: string[] = [];
  for (const { token } of spans) {
    const surface = token.surface_form;
    if (!surface) continue;
    if (token.pos === "助詞" && merged.length > 0 && surface.length <= 2) {
      merged[merged.length - 1] += surface;
    } else {
      merged.push(surface);
    }
  }

  // Filter out whitespace-only tokens
  return merged.filter((t) => t.trim().length > 0);
}
