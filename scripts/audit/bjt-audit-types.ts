/**
 * Shared types for the BJT content audit (Layer A deterministic + Layer B semantic).
 *
 * Output schema is documented in docs/CONTENT_QUALITY_RUBRIC.md. Records are
 * written to audit/bjt-audit.json and consumed by the cleanup ledger.
 */

export const AUDIT_RUBRIC_VERSION = "1.0.0";

export type AuditSeverity = "none" | "low" | "medium" | "high";
export type AuditConfidence = number; // 0..1
export type RecommendedAction = "KEEP" | "EDIT" | "HUMAN_REVIEW" | "REMOVE";
export type SemanticStatus = "JUDGED" | "UNJUDGED" | "FAILED" | "NOT_REQUIRED";
export type AuditDecision = RecommendedAction | "STATIC_KEEP_ONLY" | "UNRESOLVED";

export interface StaticCheckFinding {
  rule: string; // A01..A23
  severity: "error" | "warn";
  message: string;
}

export interface SemanticDimensionFinding {
  score: 1 | 2 | 3 | 4 | 5;
  confidence: AuditConfidence;
  rationale: string;
}

export type SemanticChecks = Partial<Record<string, SemanticDimensionFinding>>; // keyed B01..B11

export interface ProposedFix {
  field: string;
  value: unknown;
  reason?: string;
  rule?: string;
}

export interface QuestionAuditRecord {
  questionId: string; // <test-slug>:<section-code>:<4-digit index>
  sourceFile: string;
  level: string;
  dataset: "practice" | "official";
  sectionCode: string;
  staticChecks: StaticCheckFinding[];
  semanticChecks: SemanticChecks;
  issues: string[];
  severity: AuditSeverity;
  confidence: AuditConfidence;
  recommendedAction: RecommendedAction;
  staticDecision: RecommendedAction;
  semanticStatus: SemanticStatus;
  semanticDecision: RecommendedAction | null;
  finalDecision: AuditDecision;
  adjudicationDecision?: RecommendedAction | null;
  proposedFix?: ProposedFix;
  promptDigest?: string; // first 60 chars, for human scanning
}

export interface AuditSummary {
  rubricVersion: string;
  generatedAt: string;
  totalQuestions: number;
  byLevel: Record<string, { total: number; keep: number; edit: number; review: number; remove: number }>;
  byDataset: Record<string, { total: number; keep: number; edit: number; review: number; remove: number }>;
  actionCounts: Record<RecommendedAction, number>;
  issueCategories: Record<string, number>;
  semanticCoverage: { judged: number; total: number };
  decisionCounts: Record<string, number>;
}

export interface AuditOutput {
  summary: AuditSummary;
  records: QuestionAuditRecord[];
}

/** Normalize Japanese text for near-duplicate detection. */
export function normalizeForNearDuplicate(text: string): string {
  return text
    // katakana→hiragana
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    // full-width ascii → half-width
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    // strip digits, spaces, punctuation, keep CJK + latin letters
    .replace(/[0-9０-９\s。、.!?,;:"'「」『』（）()\-—~・…]/g, "")
    .toLowerCase();
}

/** Heuristic: share of CJK characters in a string. */
export function cjkRatio(text: string): number {
  if (!text) return 0;
  const cjk = text.match(/[぀-ヿ一-鿿ｦ-ﾟ]/g)?.length ?? 0;
  return cjk / text.length;
}

/** Heuristic: does the text look Vietnamese (target learner language)? */
export function looksVietnamese(text: string): boolean {
  if (!text.trim()) return false;
  const vi = text.match(/[ăâđêôơưĂÂĐÊÔƠƯáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/g)?.length ?? 0;
  const words = text.split(/\s+/).length;
  return words > 3 && vi / words > 0.15;
}
