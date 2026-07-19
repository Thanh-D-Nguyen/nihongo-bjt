import type {
  AnswerKey,
  ActivityOption,
  BjtLevel,
  FocusSeed,
  GrammarSeed,
  VocabularySeed
} from "../types.js";
import { ANSWER_KEYS } from "../types.js";

export function vocab(japanese: string, reading: string, meaningVi: string): VocabularySeed {
  return { japanese, reading, meaningVi };
}

export function focus(
  phraseJa: string,
  meaningVi: string,
  intentVi: string,
  nuanceVi: string
): FocusSeed {
  return { phraseJa, meaningVi, intentVi, nuanceVi };
}

export function grammar(pattern: string, explanationVi: string): GrammarSeed {
  return { pattern, explanationVi };
}

export function answerKeyAt(activityOrdinal: number): AnswerKey {
  return ANSWER_KEYS[activityOrdinal % ANSWER_KEYS.length] ?? "A";
}

export function placeCorrectOption(
  correctText: string,
  distractors: string[],
  correctKey: AnswerKey,
  correctRationaleVi: string,
  distractorRationales: string[]
): ActivityOption[] {
  const uniqueDistractors = Array.from(
    new Set(distractors.filter((value) => value !== correctText))
  );
  if (uniqueDistractors.length < 3) {
    throw new Error(`Need three unique distractors for ${correctText}`);
  }
  let distractorIndex = 0;
  return ANSWER_KEYS.map((key) => {
    if (key === correctKey) {
      return { key, text: correctText, isCorrect: true, rationaleVi: correctRationaleVi };
    }
    const text = uniqueDistractors[distractorIndex] ?? "—";
    const rationaleVi =
      distractorRationales[distractorIndex] ??
      "Không phù hợp với vai trò và mục tiêu giao tiếp trong tình huống này.";
    distractorIndex += 1;
    return { key, text, isCorrect: false, rationaleVi };
  });
}

export function previousSeedKey(level: BjtLevel, week: number, unitOrder: number): string[] {
  if (week === 1 && unitOrder === 1) return [];
  const previousWeek = unitOrder === 1 ? week - 1 : week;
  const previousUnit = unitOrder === 1 ? 7 : unitOrder - 1;
  return [`bjt-lessons:v1:${level}:w${String(previousWeek).padStart(2, "0")}:u${previousUnit}`];
}

export function rotate<T>(values: T[], offset: number): T[] {
  if (values.length === 0) return [];
  const normalized = offset % values.length;
  return [...values.slice(normalized), ...values.slice(0, normalized)];
}
