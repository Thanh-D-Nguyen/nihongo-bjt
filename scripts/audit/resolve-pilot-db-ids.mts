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
const manifest = JSON.parse(fs.readFileSync("audit/p6c-beneficial-pilot-v2.json", "utf8"));
const source = new Map<string, string>();
for (const d of [J5_DATA, J4_DATA, J3_DATA, J2_DATA, J1_DATA, J1PLUS_DATA]) { let n = 0; for (const s of d.sections) for (const q of s.questions) source.set(`${d.slug}:${s.code}:${String(n++).padStart(4, "0")}`, q.prompt); }
for (const d of OFFICIAL_MOCK_FORMS) { let n = 0; for (const s of d.sections) for (const q of s.questions) source.set(`${d.slug}:${s.code}:${String(n++).padStart(4, "0")}`, q.prompt); }
const out = [];
for (const c of manifest.candidates) {
  const prompt = source.get(c.questionId); if (!prompt) throw new Error(`source missing ${c.questionId}`);
  const q = await p.bjtQuestion.findFirst({ where: { prompt, section: { code: c.section, test: { slug: c.questionId.split(":")[0] } } }, select: { id: true, prompt: true } });
  if (!q) throw new Error(`DB missing ${c.questionId}`);
  out.push({ ...c, dbQuestionId: q.id, prompt: q.prompt });
}
fs.writeFileSync("audit/p6c-beneficial-pilot-v2-db-scope.json", JSON.stringify({ version: "p6c-beneficial-pilot-v2-db-scope", candidates: out }, null, 2));
console.log(JSON.stringify(out.map((x) => ({ stable: x.questionId, db: x.dbQuestionId })), null, 2));
await p.$disconnect();
