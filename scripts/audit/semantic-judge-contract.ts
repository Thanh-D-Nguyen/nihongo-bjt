/**
 * Layer B — semantic audit contract (versioned).
 *
 * An LLM judge implementing this contract receives one question at a time plus
 * this rubric version and must return strict JSON matching SemanticJudgeResult.
 * The judge is pluggable: any provider/model can implement it; results are
 * stored keyed by rubricVersion so a rubric bump forces re-judging.
 *
 * Judges must NOT rewrite content here — they only assess and propose fixes.
 */

export const SEMANTIC_JUDGE_RUBRIC_VERSION = "1.1.0";

export interface SemanticJudgeInput {
  rubricVersion: string;
  questionId: string;
  level: string; // J5 | J4 | J3 | J2 | J1 | J1+
  sectionCode: string;
  dataset: "practice" | "official";
  prompt: string;
  scenario: string | null;
  explanationVi: string;
  options: { key: string; text: string; isCorrect: boolean }[];
}

export const SEMANTIC_DIMENSIONS = {
  B01: "japanese-naturalness",
  B02: "business-authenticity",
  B03: "level-fit",
  B04: "single-best-answer",
  B05: "distractor-plausibility",
  B06: "distractor-no-second-correct",
  B07: "explanation-quality",
  B08: "pedagogical-value",
  B09: "artificiality",
  B10: "keigo-register",
  B11: "bjt-skill-alignment",
} as const;

export type SemanticDimensionId = keyof typeof SEMANTIC_DIMENSIONS;

export interface SemanticJudgeResult {
  questionId: string;
  rubricVersion: string;
  checks: Partial<Record<SemanticDimensionId, {
    score: 1 | 2 | 3 | 4 | 5;
    confidence: number; // 0..1
    rationale: string;
  }>>;
  proposedFix?: {
    field: string;
    value: string;
    reason: string;
  };
}

/** Build the system prompt handed to a judge implementation. */
export function buildSemanticJudgeSystemPrompt(): string {
  return [
    "You are a strict BJT (Business Japanese Test) content auditor.",
    "For each question, score dimensions on a 1-5 scale (5 = excellent).",
    "Dimensions:",
    ...Object.entries(SEMANTIC_DIMENSIONS).map(([id, name]) => `- ${id} ${name}`),
    "Scoring: 5=clearly good, 4=minor concerns, 3=notable concern, 2=poor, 1=broken.",
    "Always answer with strict JSON matching SemanticJudgeResult: questionId, rubricVersion,",
    "checks (each with score/confidence/rationale), optional proposedFix.",
    "confidence is 0..1 — use below 0.7 when you are genuinely unsure.",
    "explanationVi is INTENTIONALLY Vietnamese (the learners are Vietnamese): do not",
    "penalize it for not being Japanese; judge whether it correctly teaches the reasoning.",
    "Return checks as a JSON object keyed by dimension id (B01..B11).",
    "Assess only; never return rewritten content except as proposedFix.value.",
  ].join("\n");
}
