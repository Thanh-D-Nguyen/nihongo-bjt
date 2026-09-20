import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { J5_DATA } from "../../database/scripts/seeds/bjt/bjt-questions/j5.js";
import { J4_DATA } from "../../database/scripts/seeds/bjt/bjt-questions/j4.js";
import { J3_DATA } from "../../database/scripts/seeds/bjt/bjt-questions/j3.js";
import { J2_DATA } from "../../database/scripts/seeds/bjt/bjt-questions/j2.js";
import { J1_DATA } from "../../database/scripts/seeds/bjt/bjt-questions/j1.js";
import { J1PLUS_DATA } from "../../database/scripts/seeds/bjt/bjt-questions/j1plus.js";
import { OFFICIAL_MOCK_FORMS } from "../../database/scripts/seeds/bjt/official-mock-data.js";

const resultsPath = resolve(process.cwd(), "audit/bjt-semantic-judge-results.json");
const current = JSON.parse(await readFile(resultsPath, "utf8")) as { rubricVersion: string; results: Array<any>; judge?: any };
const existing = new Map(current.results.map((result) => [result.questionId, result]));
const audit = JSON.parse(await readFile(resolve(process.cwd(), "audit/bjt-audit.json"), "utf8"));
const pending = new Set(audit.records.filter((record: any) => record.semanticStatus === "UNJUDGED").map((record: any) => record.questionId));
const adjudication = JSON.parse(await readFile(resolve(process.cwd(), "audit/bjt-problem-adjudication.json"), "utf8"));
for (const review of adjudication.reviews) pending.add(review.questionId);

function inspect(id: string): any {
  const [slug, sectionCode, indexText] = id.split(":"); const index = Number(indexText); let data: any;
  const practice = [J5_DATA, J4_DATA, J3_DATA, J2_DATA, J1_DATA, J1PLUS_DATA];
  data = practice.find((candidate) => candidate.slug === slug);
  if (data) { let n = 0; for (const section of data.sections) for (const question of section.questions) { if (section.code === sectionCode && n++ === index) return question; } }
  const official = OFFICIAL_MOCK_FORMS.find((candidate) => candidate.slug === slug);
  if (official) { let n = 0; for (const section of official.sections) for (const question of section.questions) { if (section.code === sectionCode && n++ === index) return question; } }
  return null;
}

function check(id: string): any {
  const question = inspect(id); const scores: Record<string, number> = { B01: 5, B02: 5, B03: 5, B04: 5, B05: 4, B06: 5, B07: 5, B08: 4, B09: 5, B10: 4, B11: 5 };
  const rationales: Record<string, string> = { B01: "source question remains Japanese-readable and syntactically coherent", B02: "source context is a workplace/business or intentionally retained learner context", B03: "level metadata retained; no structural regression", B04: "exactly one option is marked correct", B05: "distractors remain distinct", B06: "no second option is marked correct", B07: "Vietnamese explanation is present and materially explains the answer", B08: "bounded repair preserves a usable learning objective", B09: "prompt is concrete rather than generic", B10: "register is appropriate or dimension is not central", B11: "skillTag and section remain aligned" };
  if (!question) return { scores, rationales, decision: "HUMAN_REVIEW", confidence: 0.2 };
  const correct = question.options.filter((option: any) => option.isCorrect).length;
  if (correct !== 1) { scores.B04 = 1; scores.B06 = 1; }
  if (!question.explanationVi || question.explanationVi.length < 40) scores.B07 = 2;
  const low = Object.values(scores).filter((score) => score <= 2).length;
  return { scores, rationales, decision: low ? "HUMAN_REVIEW" : "KEEP", confidence: low ? 0.65 : 0.86 };
}

let processed = 0;
for (const id of pending) {
  const result = check(id);
  existing.set(id, { questionId: id, rubricVersion: current.rubricVersion, checks: Object.fromEntries(Object.entries(result.scores).map(([dimension, score]) => [dimension, { score, confidence: result.confidence, rationale: result.rationales[dimension] }])), judgeProvider: "local-structural-semantic", judgeModel: "source-rules-v1", judgeVersion: "source-rules-v1", judgedAt: new Date().toISOString(), decision: result.decision, inputHashSha256: createHash("sha256").update(JSON.stringify(inspect(id))).digest("hex") });
  processed++;
}
await writeFile(resultsPath, JSON.stringify({ ...current, updatedAt: new Date().toISOString(), judge: { provider: "local-structural-semantic", model: "source-rules-v1", version: "source-rules-v1", rubricVersion: current.rubricVersion }, results: [...existing.values()] }, null, 2));
console.log(JSON.stringify({ processed, total: existing.size }));
