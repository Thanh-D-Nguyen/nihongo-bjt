/**
 * Shared types for BJT production question seed data.
 *
 * Each level exam has 80 questions across 9 sections:
 *   Part I  聴解:     LC_SCENE(12) + LC_STATEMENT(10) + LC_INTEGRATED(8) = 30
 *   Part II 聴読解:   LR_SITUATION(5) + LR_DOCUMENT(5) + LR_INTEGRATED(5) = 15
 *   Part III 読解:    RC_VOCAB_GRAMMAR(15) + RC_EXPRESSION(10) + RC_INTEGRATED(10) = 35
 *   Total: 80
 *
 * Levels (BJT scaled score ranges):
 *   J5:  0-199   (basic)
 *   J4:  200-319  (elementary)
 *   J3:  320-419  (intermediate)
 *   J2:  420-529  (upper-intermediate)
 *   J1:  530-599  (advanced)
 *   J1+: 600-800  (expert)
 */

export interface SeedOption {
  /** A, B, C, or D */
  key: string;
  /** Japanese text of the option */
  text: string;
  /** Exactly one option per question must be true */
  isCorrect: boolean;
}

/**
 * What type of visual the question requires.
 * - photo:        Real-world business scene photograph (LC_SCENE, LC_STATEMENT, LR_SITUATION)
 * - illustration: Drawn scene/diagram (LC_INTEGRATED)
 * - chart:        Graph, table, schedule, form (LR_DOCUMENT, LR_INTEGRATED)
 * - document:     Email, letter, article, report (RC_INTEGRATED)
 * - text_fill:    Sentence with blank (___) rendered as styled text (RC_VOCAB_GRAMMAR, RC_EXPRESSION)
 * - none:         No visual needed
 */
export type MediaHint = "photo" | "illustration" | "chart" | "document" | "text_fill" | "none";

export interface SeedQuestion {
  /** The main question prompt (Japanese) */
  prompt: string;
  /** Scene/context description (Japanese, nullable) */
  scenario: string | null;
  /**
   * Alt-text describing what the image should depict (Japanese).
   * Optional — seed script auto-generates from scenario + section code when null.
   */
  imageAlt?: string | null;
  /**
   * What type of visual this question requires.
   * Optional — seed script auto-infers from section code when omitted.
   */
  mediaHint?: MediaHint;
  /** Vietnamese explanation of the correct answer */
  explanationVi: string;
  /** Operational skill being tested */
  skillTag: string;
  /** Difficulty within the level */
  difficulty: "easy" | "standard" | "hard";
  /** Exactly 4 options, one correct */
  options: [SeedOption, SeedOption, SeedOption, SeedOption];
}

export interface SeedSectionData {
  code: string;
  titleVi: string;
  titleJa: string;
  questions: SeedQuestion[];
}

export interface SeedLevelData {
  level: string;
  slug: string;
  titleVi: string;
  titleJa: string;
  sections: SeedSectionData[];
}

/** Helper to create an option tuple */
export function opts(
  a: string,
  b: string,
  c: string,
  d: string,
  correct: "A" | "B" | "C" | "D"
): [SeedOption, SeedOption, SeedOption, SeedOption] {
  return [
    { key: "A", text: a, isCorrect: correct === "A" },
    { key: "B", text: b, isCorrect: correct === "B" },
    { key: "C", text: c, isCorrect: correct === "C" },
    { key: "D", text: d, isCorrect: correct === "D" },
  ];
}

/** Section codes and their expected question counts + default media hint */
export const SECTION_SPEC = {
  LC_SCENE: { count: 12, titleVi: "Nắm bắt tình huống", titleJa: "場面把握問題", defaultMedia: "photo" as MediaHint },
  LC_STATEMENT: { count: 10, titleVi: "Nghe hiểu phát ngôn", titleJa: "発言聴解問題", defaultMedia: "photo" as MediaHint },
  LC_INTEGRATED: { count: 8, titleVi: "Nghe hiểu tổng hợp", titleJa: "総合聴解問題", defaultMedia: "illustration" as MediaHint },
  LR_SITUATION: { count: 5, titleVi: "Nắm bắt tình huống (nghe-đọc)", titleJa: "状況把握問題", defaultMedia: "photo" as MediaHint },
  LR_DOCUMENT: { count: 5, titleVi: "Đọc tài liệu kết hợp nghe", titleJa: "資料聴読解問題", defaultMedia: "chart" as MediaHint },
  LR_INTEGRATED: { count: 5, titleVi: "Nghe-đọc tổng hợp", titleJa: "総合聴読解問題", defaultMedia: "chart" as MediaHint },
  RC_VOCAB_GRAMMAR: { count: 15, titleVi: "Từ vựng - Ngữ pháp", titleJa: "語彙・文法問題", defaultMedia: "text_fill" as MediaHint },
  RC_EXPRESSION: { count: 10, titleVi: "Biểu đạt - Đọc hiểu", titleJa: "表現読解問題", defaultMedia: "text_fill" as MediaHint },
  RC_INTEGRATED: { count: 10, titleVi: "Đọc hiểu tổng hợp", titleJa: "総合読解問題", defaultMedia: "document" as MediaHint },
} as const;
