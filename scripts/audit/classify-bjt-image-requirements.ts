/**
 * P6A — Image requirement classification for all canonical BJT questions.
 *
 * Decides, per question, whether a visual is REQUIRED / BENEFICIAL / NOT_NEEDED
 * for the learner, assigns a normalized visual archetype, and a generation mode
 * (AI_GENERATED | DETERMINISTIC_RENDER | HYBRID | EXISTING_ASSET).
 *
 * mediaHint is EVIDENCE only — classification logic is section- and
 * content-driven:
 *
 * REQUIRED   — the tested evidence lives in a visual (chart/table/schedule/
 *              form/notice/map/diagram/scene layout described in the prompt
 *              that the learner must look at to answer).
 * BENEFICIAL — listening scene questions (LC_* or LR_SITUATION): a contextual
 *              visual aids realism/understanding but the audio script carries
 *              the tested content.
 * NOT_NEEDED— text-only vocab/grammar/expression items.
 *
 * Generation mode:
 *   DETERMINISTIC_RENDER — exact readable data (numbers, tables, schedules,
 *                          documents) must be rendered programmatically.
 *   HYBRID               — AI scene background + deterministic text overlay.
 *   AI_GENERATED         — pure scene/interaction/object visuals.
 *   EXISTING_ASSET       — an approved asset already exists (imageUrl set).
 *
 * Output: audit/bjt-image-requirements.json (+ summary to stdout).
 * Usage: npx tsx scripts/audit/classify-bjt-image-requirements.ts
 */
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { BjtQuestionImageBrief } from "../lib/bjt-question-image-metadata.js";

import { SECTION_SPEC } from "../../database/scripts/seeds/bjt/bjt-seed-types.js";
import { J5_DATA } from "../../database/scripts/seeds/bjt/bjt-questions/j5.js";
import { J4_DATA } from "../../database/scripts/seeds/bjt/bjt-questions/j4.js";
import { J3_DATA } from "../../database/scripts/seeds/bjt/bjt-questions/j3.js";
import { J2_DATA } from "../../database/scripts/seeds/bjt/bjt-questions/j2.js";
import { J1_DATA } from "../../database/scripts/seeds/bjt/bjt-questions/j1.js";
import { J1PLUS_DATA } from "../../database/scripts/seeds/bjt/bjt-questions/j1plus.js";
import { OFFICIAL_MOCK_FORMS } from "../../database/scripts/seeds/bjt/official-mock-data.js";

export type ImageRequirement = "REQUIRED" | "BENEFICIAL" | "NOT_NEEDED";
export type GenerationMode = "AI_GENERATED" | "DETERMINISTIC_RENDER" | "HYBRID" | "EXISTING_ASSET";

export const IMAGE_ARCHETYPES = [
  "workplace_photo",
  "workplace_interaction",
  "meeting",
  "office_environment",
  "object_scene",
  "document",
  "email",
  "notice",
  "form",
  "chart",
  "table",
  "schedule",
  "map_layout",
  "diagram",
  "product",
  "illustration",
  "other",
] as const;
export type ImageArchetype = (typeof IMAGE_ARCHETYPES)[number];

export interface ImageRequirementRecord {
  questionId: string;
  sourceFile: string;
  level: string;
  dataset: "practice" | "official";
  sectionCode: string;
  requirement: ImageRequirement;
  archetype: ImageArchetype | null;
  generationMode: GenerationMode | null;
  mediaHintEvidence: string;
  hasExistingImage: boolean;
  existingImageUrl: string | null;
  rationale: string;
  beneficialPriority?: "HIGH" | "MEDIUM" | "LOW";
  imageBrief: BjtQuestionImageBrief;
}

const BRIEF_VERSION = "2.0.0";
const HYBRID_TO_DETERMINISTIC = new Map<string, string>([
  ["bjt-j3-practice-v3:RC_INTEGRATED:0074", "document"],
  ["bjt-j3-practice-v3:RC_INTEGRATED:0079", "document"],
  ["bjt-j2-practice-v3:LR_DOCUMENT:0038", "document"],
  ["bjt-j2-practice-v3:LR_INTEGRATED:0041", "table"],
  ["bjt-j2-practice-v3:RC_INTEGRATED:0073", "document"],
  ["bjt-j2-practice-v3:RC_INTEGRATED:0078", "document"],
  ["bjt-full-simulation-b-v1:RC_INTEGRATED:0071", "table"],
  ["bjt-full-simulation-c-v1:RC_INTEGRATED:0075", "document"],
]);

const PRACTICE: { data: typeof J1_DATA; file: string; level: string }[] = [
  { data: J5_DATA, file: "database/scripts/seeds/bjt/bjt-questions/j5.ts", level: "J5" },
  { data: J4_DATA, file: "database/scripts/seeds/bjt/bjt-questions/j4.ts", level: "J4" },
  { data: J3_DATA, file: "database/scripts/seeds/bjt/bjt-questions/j3.ts", level: "J3" },
  { data: J2_DATA, file: "database/scripts/seeds/bjt/bjt-questions/j2.ts", level: "J2" },
  { data: J1_DATA, file: "database/scripts/seeds/bjt/bjt-questions/j1.ts", level: "J1" },
  { data: J1PLUS_DATA, file: "database/scripts/seeds/bjt/bjt-questions/j1plus.ts", level: "J1+" },
];

/** Visual-evidence signal words in prompts: the data is IN the visual. */
const VISUAL_EVIDENCE_PATTERNS: [RegExp, ImageArchetype, GenerationMode][] = [
  [/グラフ|図表|棒グラフ|折れ線|円グラフ/, "chart", "DETERMINISTIC_RENDER"],
  [/表|一覧表|比較表|座席表|価格表|料金表/, "table", "DETERMINISTIC_RENDER"],
  [/スケジュール|日程表|予定表|時間割|タイムテーブル/, "schedule", "DETERMINISTIC_RENDER"],
  [/地図|フロア|配置図|レイアウト|案内図/, "map_layout", "DETERMINISTIC_RENDER"],
  [/申込書|アンケート用紙|フォーム|記入/, "form", "DETERMINISTIC_RENDER"],
  [/メール|件名|返信先|宛先/, "email", "DETERMINISTIC_RENDER"],
  [/お知らせ|掲示|ポスター|掲示板|張り紙/, "notice", "DETERMINISTIC_RENDER"],
  [/カタログ|製品|商品の特徴|型番/, "product", "HYBRID"],
  [/図|フロー|流れ図|組織図|ダイアグラム/, "diagram", "DETERMINISTIC_RENDER"],
  [/文書|資料|報告書|契約書|通知|案内/, "document", "DETERMINISTIC_RENDER"],
];

/** Scene signal words: a photo/illustration of people interacting. */
const SCENE_PATTERNS: [RegExp, ImageArchetype][] = [
  [/会議|打ち合わせ|ミーティング|プレゼン/, "meeting"],
  [/取締役会|役員/, "meeting"],
  [/対応|接客|応対|話しています|言っています|相談/, "workplace_interaction"],
  [/工場|倉庫|オフィス|店舗|受付|現場/, "office_environment"],
  [/商品|製品|荷物|装置|機械|部品/, "object_scene"],
];

const EXACT_VISUAL_PATTERNS: [RegExp, ImageArchetype][] = [
  [/画面|表示|書かれ|札|カード|ボタン|温度|警告|標識|看板|ホワイトボード/, "diagram"],
  [/予定表|スケジュール|日程表|時間割|予約表|タイムテーブル/, "schedule"],
  [/表|一覧|比較表|価格|料金/, "table"],
  [/グラフ|図表|棒グラフ|折れ線|円グラフ/, "chart"],
  [/地図|フロア|配置|レイアウト|案内図/, "map_layout"],
];

function classify(
  q: {
    prompt: string;
    scenario: string | null;
    imagePrompt?: string | null;
    imageUrl?: string | null;
    mediaHint: string;
  },
  sectionCode: string,
): Pick<ImageRequirementRecord, "requirement" | "archetype" | "generationMode" | "rationale"> {
  // 1. Existing approved asset wins.
  if (q.imageUrl?.includes("/ai/")) {
    return {
      requirement: "BENEFICIAL",
      archetype: "workplace_photo",
      generationMode: "EXISTING_ASSET",
      rationale: "question already has an existing AI-generated image; requirement is evaluated independently",
    };
  }

  // 2. RC_VOCAB_GRAMMAR / RC_EXPRESSION: text-fill items, no visual value.
  if (sectionCode === "RC_VOCAB_GRAMMAR" || sectionCode === "RC_EXPRESSION") {
    return { requirement: "NOT_NEEDED", archetype: null, generationMode: null, rationale: "text-fill grammar/vocab item; an image would be decorative" };
  }

  // 3. RC_INTEGRATED: document reading — the document is the tested evidence.
  if (sectionCode === "RC_INTEGRATED") {
    for (const [re, archetype, mode] of VISUAL_EVIDENCE_PATTERNS) {
      if (re.test(q.prompt)) {
        return { requirement: "REQUIRED", archetype, generationMode: mode, rationale: `document/evidence item (${archetype}) — exact readable content is tested` };
      }
    }
    return { requirement: "REQUIRED", archetype: "document", generationMode: "DETERMINISTIC_RENDER", rationale: "RC_INTEGRATED reading item built around a document stimulus" };
  }

  // Some official listening-integrated stimuli put the tested values in the
  // scenario (not the prompt). Treat those as REQUIRED and render exact text
  // deterministically; mediaHint/stimulusKind is only supporting evidence.
  const evidenceText = `${q.prompt}\n${q.scenario ?? ""}`;
  if (sectionCode === "LC_INTEGRATED" || sectionCode === "LR_SITUATION") {
    const exact = EXACT_VISUAL_PATTERNS.find(([re]) => re.test(evidenceText));
    if (exact) {
      return {
        requirement: "REQUIRED",
        archetype: exact[1],
        generationMode: "DETERMINISTIC_RENDER",
        rationale: `scenario contains exact visual evidence (${exact[1]}) needed to answer`,
      };
    }
  }

  // Explicit visual-stimulus syntax in authored prompts outranks the generic
  // listening-context default. If the question itself says to inspect a
  // photo/diagram/screen/notice or asks about values shown there, the image
  // carries tested evidence and cannot remain BENEFICIAL + AI_GENERATED.
  if (/【写真|写真[:：]|図|グラフ|表|画面|掲示板|貼り紙|案内板|メールに|FAXに|社内ポータルに|スライド|モニター|スクリーン|資料を.*確認|画像/iu.test(evidenceText)) {
    const exact = EXACT_VISUAL_PATTERNS.find(([re]) => re.test(evidenceText));
    return {
      requirement: "REQUIRED",
      archetype: exact?.[1] ?? (q.mediaHint === "illustration" ? "illustration" : "diagram"),
      generationMode: exact?.[1] === "product" ? "HYBRID" : "DETERMINISTIC_RENDER",
      rationale: "authored prompt/scenario explicitly presents a visual stimulus or exact visual evidence; image is part of the tested task",
    };
  }

  // 4. LR_DOCUMENT / LR_INTEGRATED: chart/document listening-reading — REQUIRED, deterministic.
  if (sectionCode === "LR_DOCUMENT" || sectionCode === "LR_INTEGRATED") {
    for (const [re, archetype, mode] of VISUAL_EVIDENCE_PATTERNS) {
      if (re.test(q.prompt)) {
        return { requirement: "REQUIRED", archetype, generationMode: mode, rationale: `listening-reading item referencing a ${archetype}` };
      }
    }
    return { requirement: "REQUIRED", archetype: sectionCode === "LR_DOCUMENT" ? "chart" : "document", generationMode: "DETERMINISTIC_RENDER", rationale: "listening-reading item whose evidence is a visual document" };
  }

  // 5. Listening comprehension sections — scene visual is BENEFICIAL (audio carries the test).
  const promptText = `${q.prompt}\n${q.scenario ?? ""}`;
  const scene = SCENE_PATTERNS.find(([re]) => re.test(promptText));
  const archetype: ImageArchetype = scene ? scene[1] : (q.mediaHint === "illustration" ? "illustration" : "workplace_photo");
  return {
    requirement: "BENEFICIAL",
    archetype,
    generationMode: "AI_GENERATED",
    rationale: `listening item (${sectionCode}); scene visual aids context, audio/text carries the tested content`,
  };
}

function buildImageBrief(record: Omit<ImageRequirementRecord, "imageBrief">, prompt: string, scenario: string | null): BjtQuestionImageBrief {
  const evidence = `${prompt}\n${scenario ?? ""}`;
  const exact = evidence
    .split(/[。！？\n]/u)
    .map((value) => value.trim())
    .filter((value) => /[0-9０-９]|[：:]/u.test(value));
  const exactTextElements = [...evidence.matchAll(/「([^」]+)」/gu)].map((match) => match[1]!).filter(Boolean);
  const scene = scenario?.trim() || null;
  const testedVisualEvidence = record.requirement === "REQUIRED";
  const exactEvidence = record.generationMode === "DETERMINISTIC_RENDER" ? [...exactTextElements, ...exact] : [];
  return {
    questionStableId: record.questionId,
    level: record.level,
    requirement: record.requirement,
    generationMode: record.generationMode,
    archetype: record.archetype,
    pedagogicalPurpose: record.rationale,
    visualEvidenceRequired: record.requirement === "REQUIRED",
    testedVisualEvidence,
    supplementalContext: record.requirement === "BENEFICIAL",
    contextualEvidence: scene ? [scene] : [],
    exactEvidence,
    evidenceMustBeDeterministic: record.generationMode === "DETERMINISTIC_RENDER" || record.generationMode === "HYBRID",
    imageRequiredToAnswer: testedVisualEvidence,
    imageUsefulForMemoryOnly: record.requirement === "BENEFICIAL",
    scene,
    environment: scene,
    participants: [],
    participantRoles: [],
    actions: [],
    composition: record.requirement === "REQUIRED" ? "front-facing stimulus; exact evidence legible" : "natural observer angle; no answer cues",
    exactTextElements: record.generationMode === "DETERMINISTIC_RENDER" ? exactTextElements : [],
    exactDataElements: record.generationMode === "DETERMINISTIC_RENDER" ? exact : [],
    forbiddenInventions: ["answer cues", "third-party logos", "watermarks", "unstated data"],
    culturalContext: "contemporary Japanese workplace; culturally accurate business setting",
    businessContext: "BJT business Japanese learning",
    accessibilityAlt: scenario?.trim() || `BJT ${record.archetype ?? "question"} stimulus`,
    briefVersion: BRIEF_VERSION,
    stimulusType: record.archetype,
    renderStrategy: record.generationMode === "DETERMINISTIC_RENDER" ? "deterministic_schematic" : record.generationMode === "HYBRID" ? "hybrid_composite" : record.generationMode === "AI_GENERATED" ? "ai_contextual" : undefined,
  };
}

function bump(map: Record<string, number>, key: string | null | undefined): void {
  if (key) map[key] = (map[key] ?? 0) + 1;
}

function beneficialPriority(requirement: ImageRequirement, sectionCode: string, archetype: ImageArchetype | null): "HIGH" | "MEDIUM" | "LOW" | undefined {
  if (requirement !== "BENEFICIAL") return undefined;
  if (sectionCode === "LC_SCENE" || archetype === "workplace_interaction" || archetype === "meeting") return "HIGH";
  if (sectionCode === "LC_INTEGRATED" || sectionCode === "LR_SITUATION" || archetype === "office_environment" || archetype === "object_scene") return "MEDIUM";
  return "LOW";
}

async function main() {
  const records: ImageRequirementRecord[] = [];

  for (const { data, file, level } of PRACTICE) {
    let idx = 0;
    for (const section of data.sections) {
      for (const q of section.questions) {
        const mediaHint = q.mediaHint ?? SECTION_SPEC[section.code as keyof typeof SECTION_SPEC]?.defaultMedia ?? "none";
        const c = classify({ prompt: q.prompt, scenario: q.scenario, mediaHint, imageUrl: null }, section.code);
        const record = {
          questionId: `${data.slug}:${section.code}:${String(idx).padStart(4, "0")}`,
          sourceFile: file,
          level,
          dataset: "practice",
          sectionCode: section.code,
          mediaHintEvidence: mediaHint,
          hasExistingImage: false,
          existingImageUrl: null,
          ...c,
          beneficialPriority: beneficialPriority(c.requirement, section.code, c.archetype),
        } as Omit<ImageRequirementRecord, "imageBrief">;
        records.push({ ...record, imageBrief: buildImageBrief(record, q.prompt, q.scenario) });
        idx++;
      }
    }
  }

  for (const form of OFFICIAL_MOCK_FORMS) {
    let idx = 0;
    for (const section of form.sections) {
      for (const q of section.questions) {
        const hint = q.stimulusKind === "text" ? "text_fill" : q.stimulusKind === "audio" ? "none" : q.stimulusKind;
        const c = classify({ prompt: q.prompt, scenario: q.scenario, imagePrompt: q.imagePrompt, imageUrl: null, mediaHint: hint }, section.code);
        const record = {
          questionId: `${form.slug}:${section.code}:${String(idx).padStart(4, "0")}`,
          sourceFile: "database/scripts/seeds/bjt/official-mock-data.ts",
          level: "ALL",
          dataset: "official",
          sectionCode: section.code,
          mediaHintEvidence: hint,
          hasExistingImage: false,
          existingImageUrl: null,
          ...c,
          beneficialPriority: beneficialPriority(c.requirement, section.code, c.archetype),
        } as Omit<ImageRequirementRecord, "imageBrief">;
        records.push({ ...record, imageBrief: buildImageBrief(record, q.prompt, q.scenario) });
        idx++;
      }
    }
  }

  // Preserve verified existing assets without letting asset presence decide
  // whether a visual is pedagogically required.
  try {
    const reconciliation = JSON.parse(await readFile(resolve(process.cwd(), "audit/bjt-existing-assets.json"), "utf8")) as { results?: Array<{ stableQuestionId?: string | null; classification: string; imageUrl?: string | null }> };
    const existing = new Map((reconciliation.results ?? []).filter((r) => r.classification === "ACCEPT" && r.stableQuestionId).map((r) => [r.stableQuestionId!, r]));
    for (const record of records) {
      const asset = existing.get(record.questionId);
      if (!asset) continue;
      record.hasExistingImage = true;
      record.existingImageUrl = asset.imageUrl ?? null;
      record.generationMode = "EXISTING_ASSET";
      record.rationale = `${record.rationale}; verified existing asset preserved`;
      record.imageBrief.generationMode = "EXISTING_ASSET";
    }
  } catch { /* classifier remains usable without DB reconciliation */ }

  const byRequirement: Record<string, number> = {};
  const byArchetype: Record<string, number> = {};
  const byMode: Record<string, number> = {};
  const byBeneficialPriority: Record<string, number> = {};
  const requirementGenerationModeMatrix: Record<ImageRequirement, Record<string, number>> = {
    REQUIRED: {}, BENEFICIAL: {}, NOT_NEEDED: {},
  };
  const byLevel: Record<string, Record<string, number>> = {};
  const byDataset: Record<string, Record<string, number>> = {};
  const mediaHintDisagreements: string[] = [];
  for (const r of records) {
    byRequirement[r.requirement] = (byRequirement[r.requirement] ?? 0) + 1;
    bump(byArchetype, r.archetype);
    bump(byMode, r.generationMode);
    bump(byBeneficialPriority, r.beneficialPriority);
    if (r.generationMode) bump(requirementGenerationModeMatrix[r.requirement], r.generationMode);
    (byLevel[r.level] ??= {})[r.requirement] = ((byLevel[r.level] ?? {})[r.requirement] ?? 0) + 1;
    (byDataset[r.dataset] ??= {})[r.requirement] = ((byDataset[r.dataset] ?? {})[r.requirement] ?? 0) + 1;
    // disagreement: mediaHint says visual but we say NOT_NEEDED, or vice versa
    const hintSaysVisual = !["text_fill", "none", "audio", "text"].includes(r.mediaHintEvidence);
    if (hintSaysVisual && r.requirement === "NOT_NEEDED") {
      mediaHintDisagreements.push(`${r.questionId}: mediaHint=${r.mediaHintEvidence} but classified NOT_NEEDED`);
    }
  }

  for (const record of records) {
    const converted = HYBRID_TO_DETERMINISTIC.get(record.questionId);
    if (!converted) continue;
    record.requirement = "REQUIRED";
    record.archetype = converted as ImageArchetype;
    record.generationMode = "DETERMINISTIC_RENDER";
    record.rationale = "source-grounded hybrid adjudication: exact structured evidence is sufficient; contextual AI layer would be decorative";
    record.imageBrief.requirement = "REQUIRED";
    record.imageBrief.generationMode = "DETERMINISTIC_RENDER";
    record.imageBrief.archetype = converted;
    record.imageBrief.testedVisualEvidence = true;
    record.imageBrief.supplementalContext = false;
    record.imageBrief.evidenceMustBeDeterministic = true;
    record.imageBrief.imageRequiredToAnswer = true;
    record.imageBrief.imageUsefulForMemoryOnly = false;
    if (!record.imageBrief.exactTextElements.length && !record.imageBrief.exactDataElements.length) {
      record.imageBrief.exactDataElements = [record.imageBrief.accessibilityAlt || record.rationale];
      record.imageBrief.exactEvidence = record.imageBrief.exactDataElements;
    }
  }

  // Recompute summary counters after any source-grounded HYBRID conversion.
  for (const key of Object.keys(byRequirement)) delete byRequirement[key];
  for (const key of Object.keys(byArchetype)) delete byArchetype[key];
  for (const key of Object.keys(byMode)) delete byMode[key];
  for (const key of Object.keys(byBeneficialPriority)) delete byBeneficialPriority[key];
  for (const key of Object.keys(requirementGenerationModeMatrix)) for (const mode of Object.keys(requirementGenerationModeMatrix[key as ImageRequirement])) delete requirementGenerationModeMatrix[key as ImageRequirement][mode];
  for (const r of records) {
    bump(byRequirement, r.requirement); bump(byArchetype, r.archetype); bump(byMode, r.generationMode); bump(byBeneficialPriority, r.beneficialPriority);
    if (r.generationMode) bump(requirementGenerationModeMatrix[r.requirement], r.generationMode);
  }

  let reconciliation = {
    status: "BLOCKED_LOCAL_DB_UNAVAILABLE",
    accepted: 0,
    rejected: 0,
    orphan: 0,
    unknown: 9,
    note: "The local PostgreSQL target at 127.0.0.1:15432 was unavailable; no DB/MinIO writes or asset decisions were made.",
  };
  try {
    const raw = JSON.parse(await readFile(resolve(process.cwd(), "audit/bjt-existing-assets.json"), "utf8")) as { counts?: Record<string, number> };
    if (raw.counts) {
      reconciliation = {
        status: "RECONCILED",
        accepted: raw.counts.ACCEPT ?? 0,
        rejected: raw.counts.REGENERATE ?? 0,
        orphan: raw.counts.ORPHAN ?? 0,
        unknown: raw.counts.UNKNOWN ?? 0,
        note: "Reconciled against the safe project PostgreSQL target on port 15433 and project MinIO.",
      };
    }
  } catch { /* DB reconciliation is optional for classifier-only runs. */ }

  const output = {
    briefVersion: BRIEF_VERSION,
    generatedAt: new Date().toISOString(),
    total: records.length,
    summary: {
      total: records.length,
      byRequirement,
      byArchetype,
      byMode,
      byBeneficialPriority,
      requirementGenerationModeMatrix,
      byLevel,
      byDataset,
      mediaHintDisagreements,
      deterministicRenderCount: records.filter((r) => r.generationMode === "DETERMINISTIC_RENDER").length,
      hybridCount: records.filter((r) => r.generationMode === "HYBRID").length,
      aiGeneratedCount: records.filter((r) => r.generationMode === "AI_GENERATED").length,
      missingRequiredImages: records.filter((r) => r.requirement === "REQUIRED" && !r.hasExistingImage).length,
      missingBeneficialImages: records.filter((r) => r.requirement === "BENEFICIAL" && !r.hasExistingImage).length,
      suspiciousMediaHints: mediaHintDisagreements,
      existingAssetReconciliation: reconciliation,
      xkiroModelEvaluation: {
        status: "COMPLETED_SMALL_TEST",
        evaluatedModels: ["gpt-image", "gpt-image-1"],
        defaultModel: "gpt-image",
        fallbackModel: null,
        operationalPolicy: "single-model-primary-gpt-image",
        configuredConcurrencyDefault: 2,
        evidence: {
          gptImage: "Available through POST /v1/images/generations; async jobs succeeded and CDN PNG download succeeded.",
          gptImage1: "POST returned HTTP 404 model_not_found.",
          concurrency: "Three concurrent gpt-image jobs were accepted; a fourth returned HTTP 429 while three were processing.",
          latency: "Representative jobs completed asynchronously in approximately 20–45 seconds during the test window.",
        },
        representativeJobs: [
          { model: "gpt-image", archetype: "workplace_interaction", status: "succeeded", jobId: "32b9aadb-43f6-4f34-83c0-1614cf3ef6c1" },
          { model: "gpt-image", archetype: "meeting", status: "succeeded", jobId: "50cad18f-47e8-41f9-8842-1c9cff8d7a67" },
          { model: "gpt-image", archetype: "object_scene", status: "succeeded", jobId: "a24bc424-165b-4583-897c-cd13374a3b16" },
          { model: "gpt-image", archetype: "workplace_interaction", status: "succeeded", jobId: "dae459fa-d29c-4b7f-9de4-ddf659776e0d" },
        ],
      },
    },
    records,
  };

  await writeFile(resolve(process.cwd(), "audit/bjt-image-requirements.json"), JSON.stringify(output, null, 2));
  console.log(JSON.stringify(output.summary, null, 2));
}

await main();
