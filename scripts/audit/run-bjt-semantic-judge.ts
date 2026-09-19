/**
 * Layer B - semantic audit judge runner.
 *
 * Runs the versioned semantic rubric (semantic-judge-contract.ts) over BJT
 * questions via any OpenAI-compatible chat API. Resumable: results are
 * appended to audit/bjt-semantic-judge-results.json keyed by questionId +
 * rubricVersion, so interrupted runs continue where they stopped and a rubric
 * bump forces re-judging.
 *
 * Usage:
 *   npx tsx scripts/audit/run-bjt-semantic-judge.ts --sample 12          # calibration
 *   npx tsx scripts/audit/run-bjt-semantic-judge.ts --only-file FILE     # one source file
 *   npx tsx scripts/audit/run-bjt-semantic-judge.ts --dry-run            # no API calls
 *
 * Env:
 *   SEMANTIC_JUDGE_BASE_URL    (default https://api.openai.com/v1)
 *   SEMANTIC_JUDGE_MODEL       (default gpt-4o-mini)
 *   SEMANTIC_JUDGE_API_KEY     (fallback OPENAI_API_KEY)
 *   SEMANTIC_JUDGE_CONCURRENCY (default 3)
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: resolve(process.cwd(), ".env") });

import { J5_DATA } from "../../database/scripts/seeds/bjt/bjt-questions/j5.js";
import { J4_DATA } from "../../database/scripts/seeds/bjt/bjt-questions/j4.js";
import { J3_DATA } from "../../database/scripts/seeds/bjt/bjt-questions/j3.js";
import { J2_DATA } from "../../database/scripts/seeds/bjt/bjt-questions/j2.js";
import { J1_DATA } from "../../database/scripts/seeds/bjt/bjt-questions/j1.js";
import { J1PLUS_DATA } from "../../database/scripts/seeds/bjt/bjt-questions/j1plus.js";
import { OFFICIAL_MOCK_FORMS } from "../../database/scripts/seeds/bjt/official-mock-data.js";

import {
  SEMANTIC_JUDGE_RUBRIC_VERSION,
  buildSemanticJudgeSystemPrompt,
  type SemanticJudgeInput,
  type SemanticJudgeResult,
} from "./semantic-judge-contract.js";

interface JudgeItem extends SemanticJudgeInput {
  sourceFile: string;
}

const RESULTS_PATH = resolve(process.cwd(), "audit/bjt-semantic-judge-results.json");

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function buildItems(): JudgeItem[] {
  const items: JudgeItem[] = [];
  const practice: { data: typeof J1_DATA; file: string; level: string }[] = [
    { data: J5_DATA, file: "database/scripts/seeds/bjt/bjt-questions/j5.ts", level: "J5" },
    { data: J4_DATA, file: "database/scripts/seeds/bjt/bjt-questions/j4.ts", level: "J4" },
    { data: J3_DATA, file: "database/scripts/seeds/bjt/bjt-questions/j3.ts", level: "J3" },
    { data: J2_DATA, file: "database/scripts/seeds/bjt/bjt-questions/j2.ts", level: "J2" },
    { data: J1_DATA, file: "database/scripts/seeds/bjt/bjt-questions/j1.ts", level: "J1" },
    { data: J1PLUS_DATA, file: "database/scripts/seeds/bjt/bjt-questions/j1plus.ts", level: "J1+" },
  ];
  for (const { data, file, level } of practice) {
    let idx = 0;
    for (const section of data.sections) {
      for (const q of section.questions) {
        items.push({
          rubricVersion: SEMANTIC_JUDGE_RUBRIC_VERSION,
          questionId: `${data.slug}:${section.code}:${String(idx).padStart(4, "0")}`,
          sourceFile: file,
          level,
          sectionCode: section.code,
          dataset: "practice",
          prompt: q.prompt,
          scenario: q.scenario,
          explanationVi: q.explanationVi,
          options: q.options,
        });
        idx++;
      }
    }
  }
  for (const form of OFFICIAL_MOCK_FORMS) {
    let idx = 0;
    for (const section of form.sections) {
      for (const q of section.questions) {
        items.push({
          rubricVersion: SEMANTIC_JUDGE_RUBRIC_VERSION,
          questionId: `${form.slug}:${section.code}:${String(idx).padStart(4, "0")}`,
          sourceFile: "database/scripts/seeds/bjt/official-mock-data.ts",
          level: "ALL",
          sectionCode: section.code,
          dataset: "official",
          prompt: q.prompt,
          scenario: q.scenario,
          explanationVi: q.explanationVi,
          options: q.options.map((o) => ({ key: o.key, text: o.text, isCorrect: o.isCorrect })),
        });
        idx++;
      }
    }
  }
  return items;
}

async function loadExisting(): Promise<Map<string, SemanticJudgeResult>> {
  try {
    const raw = JSON.parse(await readFile(RESULTS_PATH, "utf8")) as { results: SemanticJudgeResult[] };
    return new Map(
      raw.results
        .filter((r) => r.rubricVersion === SEMANTIC_JUDGE_RUBRIC_VERSION)
        .map((r) => [r.questionId, r]),
    );
  } catch {
    return new Map();
  }
}

function extractJson(text: string): unknown {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fence ? fence[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no JSON object in judge response");
  return JSON.parse(body.slice(start, end + 1));
}

async function judgeOne(
  item: JudgeItem,
  config: { baseUrl: string; apiKey: string; model: string },
): Promise<SemanticJudgeResult> {
  const response = await fetch(`${config.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({
      model: config.model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: buildSemanticJudgeSystemPrompt() },
        { role: "user", content: JSON.stringify(item) },
      ],
    }),
  });
  if (!response.ok) {
    throw new Error(`judge HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`);
  }
  const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("judge returned no content");
  const parsed = extractJson(content) as SemanticJudgeResult & {
    checks?: unknown;
  };
  // Some models return checks as [{dimension:"B01",score,confidence,rationale}]
  // instead of {"B01":{...}} — normalize to the contract shape.
  if (Array.isArray(parsed.checks)) {
    const obj: Record<string, { score: number; confidence: number; rationale: string }> = {};
    for (const c of parsed.checks as { dimension?: string; score?: number; confidence?: number; rationale?: string }[]) {
      if (c?.dimension && typeof c.score === "number") {
        obj[c.dimension] = { score: c.score, confidence: c.confidence ?? 0.5, rationale: c.rationale ?? "" };
      }
    }
    parsed.checks = obj as SemanticJudgeResult["checks"];
  }
  if (parsed.questionId !== item.questionId) parsed.questionId = item.questionId;
  parsed.rubricVersion = SEMANTIC_JUDGE_RUBRIC_VERSION;
  return parsed;
}

async function saveResults(
  fresh: SemanticJudgeResult[],
  existing: Map<string, SemanticJudgeResult>,
): Promise<void> {
  const merged = new Map(existing);
  for (const r of fresh) merged.set(r.questionId, r);
  await mkdir(resolve(process.cwd(), "audit"), { recursive: true });
  await writeFile(
    RESULTS_PATH,
    JSON.stringify(
      { rubricVersion: SEMANTIC_JUDGE_RUBRIC_VERSION, updatedAt: new Date().toISOString(), results: [...merged.values()] },
      null,
      2,
    ),
  );
}

async function main() {
  let items = buildItems();

  const onlyFile = arg("only-file");
  if (onlyFile) items = items.filter((i) => i.sourceFile.endsWith(onlyFile));

  const sampleArg = arg("sample");
  if (sampleArg) {
    const n = Number(sampleArg);
    // stratified: evenly spaced across the ordered dataset -> covers all levels/sections
    const step = Math.max(1, Math.floor(items.length / n));
    items = items.filter((_, i) => i % step === 0).slice(0, n);
  }

  const existing = await loadExisting();
  const pending = items.filter((i) => !existing.has(i.questionId));
  console.log(JSON.stringify({ total: items.length, alreadyJudged: items.length - pending.length, pending: pending.length }));
  if (pending.length === 0) return;

  if (hasFlag("dry-run")) {
    console.log("dry-run: first 2 pending items:");
    for (const i of pending.slice(0, 2)) console.log(JSON.stringify(i).slice(0, 300));
    return;
  }

  const apiKey = process.env.SEMANTIC_JUDGE_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("No API key: set SEMANTIC_JUDGE_API_KEY or OPENAI_API_KEY");
    process.exitCode = 1;
    return;
  }
  const config = {
    baseUrl: process.env.SEMANTIC_JUDGE_BASE_URL ?? "https://api.openai.com/v1",
    apiKey,
    model: process.env.SEMANTIC_JUDGE_MODEL ?? "gpt-4o-mini",
  };
  const concurrency = Number(process.env.SEMANTIC_JUDGE_CONCURRENCY ?? 3);

  const results: SemanticJudgeResult[] = [];
  let done = 0;
  let failures = 0;
  const queue = [...pending];
  async function worker() {
    for (;;) {
      const item = queue.shift();
      if (!item) return;
      try {
        const r = await judgeOne(item, config);
        results.push(r);
        done++;
      } catch (e) {
        failures++;
        console.error(`FAIL ${item.questionId}: ${String(e).slice(0, 160)}`);
      }
      if (done % 10 === 0) {
        console.log(`progress: ${done}/${pending.length} (failures: ${failures})`);
        await saveResults(results, existing); // incremental save: interrupts never lose paid judgments
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  await saveResults(results, existing);
  console.log(JSON.stringify({ judged: results.length, failures }));
}

await main();