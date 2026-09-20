import { config } from "dotenv"; config();
import { createPrismaClient } from "../../packages/database/src/index.js";
import { J5_DATA } from "../../database/scripts/seeds/bjt/bjt-questions/j5.js";
import { J4_DATA } from "../../database/scripts/seeds/bjt/bjt-questions/j4.js";
import { J3_DATA } from "../../database/scripts/seeds/bjt/bjt-questions/j3.js";
import { J2_DATA } from "../../database/scripts/seeds/bjt/bjt-questions/j2.js";
import { J1_DATA } from "../../database/scripts/seeds/bjt/bjt-questions/j1.js";
import { J1PLUS_DATA } from "../../database/scripts/seeds/bjt/bjt-questions/j1plus.js";
import { OFFICIAL_MOCK_FORMS } from "../../database/scripts/seeds/bjt/official-mock-data.js";
import fs from "node:fs";

const p = createPrismaClient(process.env.DATABASE_URL!);
const briefs = JSON.parse(fs.readFileSync("audit/bjt-image-requirements.json", "utf8"));
const oldPilot = new Set(
  JSON.parse(fs.readFileSync("audit/p6c-beneficial-pilot-v2-qa.json", "utf8")).assets.map((a: any) => a.stableQuestionId)
);

// HIGH-priority BENEFICIAL + AI_GENERATED, excluding the already-generated pilot.
const pool = briefs.records.filter(
  (r: any) =>
    r.beneficialPriority === "HIGH" &&
    r.requirement === "BENEFICIAL" &&
    r.generationMode === "AI_GENERATED" &&
    !oldPilot.has(r.questionId)
);

// diversity: round-robin over levels
const byLevel = new Map<string, any[]>();
for (const r of pool) {
  if (!byLevel.has(r.level)) byLevel.set(r.level, []);
  byLevel.get(r.level)!.push(r);
}
const levels = [...byLevel.keys()].sort();
const selected: any[] = [];
let added = true;
while (selected.length < 10 && added) {
  added = false;
  for (const lv of levels) {
    const next = byLevel.get(lv)!.shift();
    if (next && selected.length < 10) { selected.push(next); added = true; }
  }
}

// resolve DB ids via source prompt (same method as resolve-pilot-db-ids.mts)
const source = new Map<string, string>();
for (const d of [J5_DATA, J4_DATA, J3_DATA, J2_DATA, J1_DATA, J1PLUS_DATA]) {
  let n = 0;
  for (const s of (d as any).sections) for (const q of s.questions)
    source.set(`${(d as any).slug}:${s.code}:${String(n++).padStart(4, "0")}`, q.prompt);
}
for (const d of OFFICIAL_MOCK_FORMS as any[]) {
  let n = 0;
  for (const s of d.sections) for (const q of s.questions)
    source.set(`${d.slug}:${s.code}:${String(n++).padStart(4, "0")}`, q.prompt);
}

const candidates = [];
for (const r of selected) {
  const prompt = source.get(r.questionId);
  if (!prompt) throw new Error(`source missing ${r.questionId}`);
  const q = await p.bjtQuestion.findFirst({
    where: { prompt, section: { code: r.sectionCode, test: { slug: r.questionId.split(":")[0] } } },
    select: { id: true, imageUrl: true }
  });
  if (!q) throw new Error(`DB missing ${r.questionId}`);
  if (q.imageUrl) throw new Error(`${r.questionId} already has image ${q.imageUrl}`);
  candidates.push({
    questionId: r.questionId,
    level: r.level,
    dataset: r.dataset,
    section: r.sectionCode,
    reason: r.rationale,
    dbQuestionId: q.id,
    prompt
  });
}
fs.writeFileSync(
  "audit/p6c-beneficial-pilot-v3-db-scope.json",
  JSON.stringify({ version: "p6c-beneficial-pilot-v3-db-scope", textPolicy: "NO_READABLE_TEXT", promptCompilerVersion: "bjt-image-generation-prompt-v2.1.0", candidates }, null, 2)
);
console.log(JSON.stringify({ selected: candidates.length, levels: [...new Set(candidates.map((c) => c.level))], ids: candidates.map((c) => c.questionId) }, null, 2));
await p.$disconnect();