/**
 * Layer A - deterministic BJT content audit.
 *
 * Walks ALL practice level files and ALL official mock forms, runs static
 * checks A01..A23 from docs/CONTENT_QUALITY_RUBRIC.md, and writes:
 *   audit/bjt-audit-layer-a.json   (records + summary)
 *
 * Deterministic, offline, safe to re-run. No DB access - the TS seed files are
 * the source of truth for canonical content.
 *
 * Usage: npx tsx scripts/audit/run-bjt-layer-audit.ts [--sample N]
 */
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { SECTION_SPEC } from "../../database/scripts/seeds/bjt/bjt-seed-types.js";
import { J5_DATA } from "../../database/scripts/seeds/bjt/bjt-questions/j5.js";
import { J4_DATA } from "../../database/scripts/seeds/bjt/bjt-questions/j4.js";
import { J3_DATA } from "../../database/scripts/seeds/bjt/bjt-questions/j3.js";
import { J2_DATA } from "../../database/scripts/seeds/bjt/bjt-questions/j2.js";
import { J1_DATA } from "../../database/scripts/seeds/bjt/bjt-questions/j1.js";
import { J1PLUS_DATA } from "../../database/scripts/seeds/bjt/bjt-questions/j1plus.js";
import { OFFICIAL_MOCK_FORMS } from "../../database/scripts/seeds/bjt/official-mock-data.js";

import {
  AUDIT_RUBRIC_VERSION,
  cjkRatio,
  looksVietnamese,
  normalizeForNearDuplicate,
  type AuditOutput,
  type QuestionAuditRecord,
  type RecommendedAction,
  type StaticCheckFinding,
} from "./bjt-audit-types.js";

interface FlatQuestion {
  questionId: string;
  sourceFile: string;
  level: string;
  dataset: "practice" | "official";
  sectionCode: string;
  prompt: string;
  scenario: string | null;
  imageAlt?: string | null;
  mediaHint?: string;
  imagePrompt?: string | null;
  explanationVi: string;
  skillTag: string;
  difficulty: string;
  options: { key: string; text: string; isCorrect: boolean }[];
}

const PRACTICE_LEVELS: { data: (typeof J1_DATA); file: string }[] = [
  { data: J5_DATA, file: "database/scripts/seeds/bjt/bjt-questions/j5.ts" },
  { data: J4_DATA, file: "database/scripts/seeds/bjt/bjt-questions/j4.ts" },
  { data: J3_DATA, file: "database/scripts/seeds/bjt/bjt-questions/j3.ts" },
  { data: J2_DATA, file: "database/scripts/seeds/bjt/bjt-questions/j2.ts" },
  { data: J1_DATA, file: "database/scripts/seeds/bjt/bjt-questions/j1.ts" },
  { data: J1PLUS_DATA, file: "database/scripts/seeds/bjt/bjt-questions/j1plus.ts" },
];

function flattenPractice(): FlatQuestion[] {
  const out: FlatQuestion[] = [];
  for (const { data, file } of PRACTICE_LEVELS) {
    let idx = 0;
    for (const section of data.sections) {
      for (const q of section.questions) {
        out.push({
          questionId: `${data.slug}:${section.code}:${String(idx).padStart(4, "0")}`,
          sourceFile: file,
          level: data.level,
          dataset: "practice",
          sectionCode: section.code,
          prompt: q.prompt,
          scenario: q.scenario,
          imageAlt: q.imageAlt ?? null,
          mediaHint: q.mediaHint ?? SECTION_SPEC[section.code as keyof typeof SECTION_SPEC]?.defaultMedia,
          imagePrompt: null,
          explanationVi: q.explanationVi,
          skillTag: q.skillTag,
          difficulty: q.difficulty,
          options: q.options,
        });
        idx++;
      }
    }
  }
  return out;
}

/** Map official-mock stimulusKind to the practice MediaHint vocabulary. */
function stimulusKindToMediaHint(kind: string): string {
  switch (kind) {
    case "text":
      return "text_fill";
    case "audio":
      return "none";
    case "photo":
    case "illustration":
    case "chart":
    case "document":
      return kind;
    default:
      return kind; // let A14 flag genuinely unknown kinds
  }
}

function flattenOfficial(): FlatQuestion[] {
  const out: FlatQuestion[] = [];
  for (const form of OFFICIAL_MOCK_FORMS) {
    let idx = 0;
    for (const section of form.sections) {
      for (const q of section.questions) {
        out.push({
          questionId: `${form.slug}:${section.code}:${String(idx).padStart(4, "0")}`,
          sourceFile: "database/scripts/seeds/bjt/official-mock-data.ts",
          level: "ALL",
          dataset: "official",
          sectionCode: section.code,
          prompt: q.prompt,
          scenario: q.scenario ?? null,
          imageAlt: q.imageAlt ?? null,
          mediaHint: stimulusKindToMediaHint(q.stimulusKind),
          imagePrompt: q.imagePrompt ?? null,
          explanationVi: q.explanationVi,
          skillTag: q.skillTag,
          difficulty: q.difficulty ?? "standard",
          options: q.options,
        });
        idx++;
      }
    }
  }
  return out;
}

function staticChecks(q: FlatQuestion): StaticCheckFinding[] {
  const f: StaticCheckFinding[] = [];
  const E = (rule: string, message: string) => f.push({ rule, severity: "error", message });
  const W = (rule: string, message: string) => f.push({ rule, severity: "warn", message });

  if (!q.prompt?.trim()) E("A01 prompt-empty", "prompt is empty");
  if (q.options.length !== 4) E("A02 option-count", `expected 4 options, got ${q.options.length}`);
  if (new Set(q.options.map((o) => o.text)).size !== q.options.length)
    E("A03 option-duplicate-text", "two options share identical text");
  const correctCount = q.options.filter((o) => o.isCorrect).length;
  if (correctCount !== 1) E("A04 answer-count", `${correctCount} options marked correct`);
  const keys = q.options.map((o) => o.key);
  if (keys.join("") !== "ABCD") E("A05 answer-key-format", `option keys are ${keys.join(",")}`);
  if (!q.explanationVi?.trim()) E("A06 explanation-empty", "explanationVi is empty");
  else if (q.explanationVi.trim().length < 40) W("A07 explanation-length", "explanation shorter than 40 chars");
  const hint = q.mediaHint ?? "none";
  if ((hint === "photo" || hint === "illustration") && !q.scenario?.trim())
    W("A08 scenario-empty", `mediaHint=${hint} but scenario is empty`);
  if (q.scenario && cjkRatio(q.scenario) < 0.3)
    W("A09 scenario-foreign", "scenario does not look Japanese");
  if (q.explanationVi && !looksVietnamese(q.explanationVi))
    W("A10 explanation-language", "explanationVi may not be Vietnamese");
  if (!q.skillTag?.trim()) E("A11 skilltag-missing", "skillTag empty");
  if (!["easy", "standard", "hard"].includes(q.difficulty))
    E("A12 difficulty-invalid", `difficulty=${q.difficulty}`);
  if (!(q.sectionCode in SECTION_SPEC)) E("A13 section-code-unknown", `unknown section ${q.sectionCode}`);
  // Accept the runtime's broader media vocabulary (resolveBjtImageMediaHint):
  // practice MediaHint union plus official-mock stimulusKind values.
  if (!["photo", "illustration", "chart", "diagram", "document", "text_fill", "audio", "text", "none"].includes(String(hint)))
    E("A14 mediahint-invalid", `mediaHint=${hint}`);
  if (hint === "none" && q.imagePrompt)
    W("A15 mediahint-prompt-mismatch", `mediaHint=${hint}, imagePrompt present`);
  if (q.prompt && cjkRatio(q.prompt) < 0.25 && q.prompt.length > 30)
    W("A20 prompt-foreign", "prompt contains little Japanese");
  if (q.options.some((o) => !o.text?.trim())) E("A22 option-empty", "an option has empty text");
  return f;
}

function crossDatasetChecks(all: FlatQuestion[]): Map<string, StaticCheckFinding[]> {
  const extra = new Map<string, StaticCheckFinding[]>();
  const byExact = new Map<string, string[]>();
  const byNear = new Map<string, string[]>();
  for (const q of all) {
    const exact = q.prompt.trim();
    const list = byExact.get(exact) ?? [];
    list.push(q.questionId);
    byExact.set(exact, list);
    const near = normalizeForNearDuplicate(q.prompt);
    if (near.length >= 12) {
      const nl = byNear.get(near) ?? [];
      nl.push(q.questionId);
      byNear.set(near, nl);
    }
  }
  for (const ids of byExact.values()) {
    if (ids.length > 1)
      for (const id of ids.slice(1)) {
        const arr = extra.get(id) ?? [];
        arr.push({ rule: "A17 duplicate-prompt-exact", severity: "error", message: `exact prompt also used by ${ids.filter((x) => x !== id).join(", ")}` });
        extra.set(id, arr);
      }
  }
  for (const ids of byNear.values()) {
    if (ids.length > 1)
      for (const id of ids.slice(1)) {
        const arr = extra.get(id) ?? [];
        arr.push({ rule: "A18 duplicate-prompt-near", severity: "warn", message: `near-duplicate prompt with ${ids.filter((x) => x !== id).join(", ")}` });
        extra.set(id, arr);
      }
  }
  return extra;
}

function decide(statics: StaticCheckFinding[]): { action: RecommendedAction; severity: "none" | "low" | "medium" | "high" } {
  const errors = statics.filter((s) => s.severity === "error");
  const warns = statics.filter((s) => s.severity === "warn");
  if (errors.length === 0 && warns.length === 0) return { action: "KEEP", severity: "none" };
  if (errors.length > 0) return { action: "EDIT", severity: errors.length >= 2 ? "high" : "medium" };
  return { action: warns.length >= 3 ? "HUMAN_REVIEW" : "KEEP", severity: "low" };
}

async function main() {
  const all = [...flattenPractice(), ...flattenOfficial()];
  let records: QuestionAuditRecord[] = [];
  const cross = crossDatasetChecks(all);
  for (const q of all) {
    const statics = [...staticChecks(q), ...(cross.get(q.questionId) ?? [])];
    const { action, severity } = decide(statics);
    records.push({
      questionId: q.questionId,
      sourceFile: q.sourceFile,
      level: q.level,
      dataset: q.dataset,
      sectionCode: q.sectionCode,
      staticChecks: statics,
      semanticChecks: {},
      issues: statics.map((s) => s.rule.split(" ")[0]),
      severity,
      confidence: 1,
      recommendedAction: action,
      staticDecision: action,
      semanticStatus: "UNJUDGED",
      semanticDecision: null,
      finalDecision: "STATIC_KEEP_ONLY",
      promptDigest: q.prompt.slice(0, 60),
    });
  }
  if (process.argv.includes("--sample")) {
    const n = Number(process.argv[process.argv.indexOf("--sample") + 1] ?? 20);
    records = records.filter((_, i) => i % Math.max(1, Math.floor(records.length / n)) === 0).slice(0, n);
  }

  const actionCounts = { KEEP: 0, EDIT: 0, HUMAN_REVIEW: 0, REMOVE: 0 } as Record<RecommendedAction, number>;
  const issueCategories: Record<string, number> = {};
  const byLevel: Record<string, { total: number; keep: number; edit: number; review: number; remove: number }> = {};
  const byDataset: Record<string, { total: number; keep: number; edit: number; review: number; remove: number }> = {};
  for (const r of records) {
    actionCounts[r.recommendedAction]++;
    for (const i of r.issues) issueCategories[i] = (issueCategories[i] ?? 0) + 1;
    const lv = byLevel[r.level] ?? { total: 0, keep: 0, edit: 0, review: 0, remove: 0 };
    lv.total++;
    if (r.recommendedAction === "KEEP") lv.keep++;
    else if (r.recommendedAction === "EDIT") lv.edit++;
    else if (r.recommendedAction === "HUMAN_REVIEW") lv.review++;
    else lv.remove++;
    byLevel[r.level] = lv;
    const ds = byDataset[r.dataset] ?? { total: 0, keep: 0, edit: 0, review: 0, remove: 0 };
    ds.total++;
    if (r.recommendedAction === "KEEP") ds.keep++;
    else if (r.recommendedAction === "EDIT") ds.edit++;
    else if (r.recommendedAction === "HUMAN_REVIEW") ds.review++;
    else ds.remove++;
    byDataset[r.dataset] = ds;
  }

  const output: AuditOutput = {
    summary: {
      rubricVersion: AUDIT_RUBRIC_VERSION,
      generatedAt: new Date().toISOString(),
      totalQuestions: records.length,
      byLevel,
      byDataset,
      actionCounts,
      issueCategories,
      semanticCoverage: { judged: 0, total: records.length },
      decisionCounts: { STATIC_KEEP_ONLY: records.filter((r) => r.recommendedAction === "KEEP").length, UNJUDGED: records.length },
    },
    records,
  };
  await mkdir(resolve(process.cwd(), "audit"), { recursive: true });
  await writeFile(resolve(process.cwd(), "audit/bjt-audit-layer-a.json"), JSON.stringify(output, null, 2));
  console.log(JSON.stringify(output.summary, null, 2));
}

await main();
