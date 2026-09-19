/**
 * Merge Layer A (deterministic) and Layer B (semantic judge) audit results
 * into the final audit output: audit/bjt-audit.json
 *
 * Decision rules (docs/CONTENT_QUALITY_RUBRIC.md):
 *   - static error          -> EDIT (auto-fixable) or HUMAN_REVIEW
 *   - semantic score <= 2, confidence >= 0.7 -> EDIT with proposedFix
 *   - semantic score <= 2, confidence <  0.7 -> HUMAN_REVIEW
 *   - >= 2 independent high-severity findings -> REMOVE
 *   - otherwise KEEP
 *
 * Usage: npx tsx scripts/audit/merge-bjt-audit.ts
 */
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  type AuditOutput,
  type QuestionAuditRecord,
  type RecommendedAction,
  type SemanticChecks,
  type SemanticStatus,
} from "./bjt-audit-types.js";

const LAYER_A_PATH = resolve(process.cwd(), "audit/bjt-audit-layer-a.json");
const SEMANTIC_PATH = resolve(process.cwd(), "audit/bjt-semantic-judge-results.json");
const OUTPUT_PATH = resolve(process.cwd(), "audit/bjt-audit.json");
const ADJUDICATION_PATH = resolve(process.cwd(), "audit/bjt-problem-adjudication.json");

interface SemanticResult {
  questionId: string;
  rubricVersion: string;
  checks: Record<string, { score: number; confidence: number; rationale: string }>;
  proposedFix?: { field: string; value: string; reason: string };
}

function combine(
  record: QuestionAuditRecord,
  semantic: SemanticResult | undefined,
): QuestionAuditRecord {
  if (!semantic) {
    return { ...record, semanticStatus: "UNJUDGED", semanticDecision: null, finalDecision: "STATIC_KEEP_ONLY" };
  }

  const semanticChecks: SemanticChecks = {};
  let lowScores = 0;
  let confidentLows = 0;
  for (const [dim, c] of Object.entries(semantic.checks)) {
    semanticChecks[dim] = { score: c.score as 1 | 2 | 3 | 4 | 5, confidence: c.confidence, rationale: c.rationale };
    if (c.score <= 2) {
      lowScores++;
      if (c.confidence >= 0.7) confidentLows++;
    }
  }

  const staticErrors = record.staticChecks.filter((s) => s.severity === "error").length;
  const highSeverity = record.severity === "high" || lowScores >= 2 || (staticErrors >= 2 && lowScores >= 1);

  let action: RecommendedAction = record.recommendedAction;
  let severity = record.severity;
  const issues = [...record.issues];

  if (highSeverity && (staticErrors >= 2 || lowScores >= 2)) {
    action = "REMOVE";
    severity = "high";
    issues.push("multiple-high-severity-findings");
  } else if (confidentLows >= 1) {
    action = "EDIT";
    severity = "medium";
  } else if (lowScores >= 1) {
    action = "HUMAN_REVIEW";
    severity = "medium";
  } else if (action === "KEEP" && Object.values(semantic.checks).some((c) => c.score === 3)) {
    // notable concern, judge unsure -> worth a look but not blocking
    severity = "low";
  }

  const semanticDecision = action;
  return {
    ...record,
    semanticChecks,
    issues,
    severity,
    recommendedAction: action,
    semanticStatus: "JUDGED",
    semanticDecision,
    finalDecision: action,
    proposedFix:
      semantic.proposedFix && action === "EDIT"
        ? { field: semantic.proposedFix.field, value: semantic.proposedFix.value, reason: semantic.proposedFix.reason }
        : record.proposedFix,
  };
}

async function main() {
  const layerA = JSON.parse(await readFile(LAYER_A_PATH, "utf8")) as AuditOutput;
  let semanticResults: SemanticResult[] = [];
  try {
    const raw = JSON.parse(await readFile(SEMANTIC_PATH, "utf8")) as { results: SemanticResult[] };
    semanticResults = raw.results;
  } catch {
    // no semantic results yet - merge is still useful (static-only)
  }
  const semanticByQuestion = new Map(semanticResults.map((r) => [r.questionId, r]));
  let adjudicationByQuestion = new Map<string, RecommendedAction>();
  try {
    const adjudication = JSON.parse(await readFile(ADJUDICATION_PATH, "utf8")) as { reviews?: Array<{ questionId: string; finalDecision: RecommendedAction }> };
    adjudicationByQuestion = new Map((adjudication.reviews ?? []).map((r) => [r.questionId, r.finalDecision]));
  } catch { /* targeted adjudication is optional */ }

  const records = layerA.records.map((r) => {
    const combined = combine(r, semanticByQuestion.get(r.questionId));
    const adjudication = adjudicationByQuestion.get(r.questionId);
    return adjudication
      ? { ...combined, adjudicationDecision: adjudication, finalDecision: adjudication, recommendedAction: adjudication }
      : combined;
  });

  const actionCounts = { KEEP: 0, EDIT: 0, HUMAN_REVIEW: 0, REMOVE: 0 } as Record<RecommendedAction, number>;
  const decisionCounts: Record<string, number> = {};
  const issueCategories: Record<string, number> = {};
  const byLevel: Record<string, { total: number; keep: number; edit: number; review: number; remove: number }> = {};
  const byDataset: Record<string, { total: number; keep: number; edit: number; review: number; remove: number }> = {};
  for (const r of records) {
    actionCounts[r.recommendedAction]++;
    decisionCounts[r.finalDecision] = (decisionCounts[r.finalDecision] ?? 0) + 1;
    decisionCounts[r.semanticStatus] = (decisionCounts[r.semanticStatus] ?? 0) + 1;
    for (const i of r.issues) issueCategories[i] = (issueCategories[i] ?? 0) + 1;
    const bump = (b: { total: number; keep: number; edit: number; review: number; remove: number }) => {
      b.total++;
      if (r.recommendedAction === "KEEP") b.keep++;
      else if (r.recommendedAction === "EDIT") b.edit++;
      else if (r.recommendedAction === "HUMAN_REVIEW") b.review++;
      else b.remove++;
    };
    bump((byLevel[r.level] ??= { total: 0, keep: 0, edit: 0, review: 0, remove: 0 }));
    bump((byDataset[r.dataset] ??= { total: 0, keep: 0, edit: 0, review: 0, remove: 0 }));
  }

  const output: AuditOutput = {
    summary: {
      ...layerA.summary,
      generatedAt: new Date().toISOString(),
      totalQuestions: records.length,
      byLevel,
      byDataset,
      actionCounts,
      issueCategories,
      semanticCoverage: { judged: semanticResults.length, total: records.length },
      decisionCounts,
    },
    records,
  };
  await writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2));
  console.log(JSON.stringify(output.summary, null, 2));
}

await main();
