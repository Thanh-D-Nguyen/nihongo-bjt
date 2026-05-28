import { Inject, Injectable, Logger } from "@nestjs/common";
import { shuffleArray } from "@nihongo-bjt/shared";

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

        const shuffled = shuffleArray([
          { text: point.meaningVi, correct: true },
          ...distractors.map((d) => ({
            text: d.meaningVi,
            correct: false
          }))
        ]);
        const options = shuffled.map((o, i) => ({ ...o, key: String.fromCharCode(65 + i) }));

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
          3,
          diff
        );

        const correctMeaning = sense.meaningVi || lex.shortMeaningVi || "";
        if (!correctMeaning) continue;

        const distractorMeanings = distractors
          .map((d) => d.senses[0]?.meaningVi)
          .filter(Boolean) as string[];

        if (distractorMeanings.length < 3) continue;

        const shuffled = shuffleArray([
          { text: correctMeaning, correct: true },
          ...distractorMeanings.slice(0, 3).map((text) => ({
            text,
            correct: false
          }))
        ]);
        const options = shuffled.map((o, i) => ({ ...o, key: String.fromCharCode(65 + i) }));

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
        12,
        diff
      );
      const distractorHeadwords = selectClozeDistractors(
        lex.headword,
        distractors.map((d) => d.headword).filter(Boolean)
      );

      if (distractorHeadwords.length < 3) continue;

      const shuffledCloze = shuffleArray([
        { text: lex.headword, correct: true },
        ...distractorHeadwords.map((text) => ({
          text,
          correct: false
        }))
      ]);
      const options = shuffledCloze.map((o, i) => ({ ...o, key: String.fromCharCode(65 + i) }));

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

      const distractorExamples = await this.repo.sentenceTranslationDistractors({
        count: 12,
        excludeExampleId: example.id,
        level: lex.jlptLevel,
        partOfSpeech: sense.partOfSpeech,
        translationVi: example.translationVi
      });
      const distractorSentences = selectTranslationDistractors(
        example.translationVi,
        distractorExamples.map((item) => item.translationVi).filter(Boolean) as string[]
      );
      if (distractorSentences.length < 3) continue;

      const shuffledTrans = shuffleArray([
        { text: example.translationVi, correct: true },
        ...distractorSentences.slice(0, 3).map((text) => ({
          text,
          correct: false
        }))
      ]);
      const options = shuffledTrans.map((o, i) => ({ ...o, key: String.fromCharCode(65 + i) }));

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

function selectClozeDistractors(target: string, candidates: string[]) {
  const targetProfile = scriptProfile(target);
  const strict = uniqueStrings(candidates).filter((candidate) => {
    return scriptProfile(candidate) === targetProfile && Math.abs(candidate.length - target.length) <= 2;
  });
  const relaxed = uniqueStrings(candidates).filter((candidate) => scriptProfile(candidate) === targetProfile);
  const fallback = uniqueStrings(candidates);
  return [...strict, ...relaxed, ...fallback].filter(uniqueByValue).slice(0, 3);
}

function selectTranslationDistractors(target: string, candidates: string[]) {
  const targetLength = target.length;
  const strict = uniqueStrings(candidates).filter((candidate) => isComparableLength(candidate.length, targetLength, 0.55, 1.75));
  const relaxed = uniqueStrings(candidates).filter((candidate) => isComparableLength(candidate.length, targetLength, 0.35, 2.4));
  const fallback = uniqueStrings(candidates);
  return [...strict, ...relaxed, ...fallback].filter(uniqueByValue).slice(0, 3);
}

function isComparableLength(candidateLength: number, targetLength: number, minRatio: number, maxRatio: number) {
  if (targetLength <= 0) return true;
  const ratio = candidateLength / targetLength;
  return ratio >= minRatio && ratio <= maxRatio;
}

function scriptProfile(value: string) {
  if (/^[\p{Script=Katakana}ー]+$/u.test(value)) return "katakana";
  if (/^[\p{Script=Hiragana}ー]+$/u.test(value)) return "hiragana";
  if (/^[\p{Script=Han}々〆ヵヶ]+$/u.test(value)) return "kanji";
  if (/[\p{Script=Han}]/u.test(value) && /[\p{Script=Hiragana}]/u.test(value)) return "kanji-kana";
  return "mixed";
}

function uniqueStrings(values: string[]) {
  return values.filter((value, index, arr) => Boolean(value) && arr.indexOf(value) === index);
}

function uniqueByValue<T>(value: T, index: number, arr: T[]) {
  return arr.indexOf(value) === index;
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
