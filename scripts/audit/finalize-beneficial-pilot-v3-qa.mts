import { config } from "dotenv"; config();
import { createPrismaClient } from "../../packages/database/src/index.js";
import fs from "node:fs";
const p = createPrismaClient(process.env.DATABASE_URL!);
const scope = JSON.parse(fs.readFileSync("audit/p6c-beneficial-pilot-v3-db-scope.json", "utf8"));
// textRisk classifications come from manual visual inspection; see QA record below.
const manualQa = JSON.parse(fs.readFileSync("audit/p6c-beneficial-pilot-v3-manual-qa.json", "utf8"));
const assets = [];
for (const c of scope.candidates) {
  const q = await p.bjtQuestion.findUnique({ where: { id: c.dbQuestionId }, select: { imageUrl: true, qualityFlags: true } });
  const gen = ((q?.qualityFlags ?? {}) as any).imageGeneration ?? null;
  const qa = manualQa.assets.find((a: any) => a.questionId === c.questionId);
  if (!qa) throw new Error(`missing manual QA for ${c.questionId}`);
  assets.push({
    questionId: c.questionId,
    testSlug: c.questionId.split(":")[0],
    sectionCode: c.section,
    level: c.level,
    model: "gpt-image",
    provider: "xkiro",
    objectKey: gen?.objectKey ?? null,
    imageUrl: q?.imageUrl,
    generated: Boolean(q?.imageUrl),
    promptCompilerVersion: "bjt-image-generation-prompt-v2.1.0",
    contextualStyleContractVersion: "contextual-style-contract-v1.1",
    textPolicy: "NO_READABLE_TEXT",
    visualQaStatus: qa.visualQaStatus,
    textRisk: qa.textRisk,
    notes: qa.notes ?? null
  });
}
const accepted = assets.filter((a) => a.visualQaStatus === "ACCEPT").length;
const out = {
  version: "p6c-beneficial-pilot-v3-qa",
  provider: "xkiro",
  model: "gpt-image",
  concurrency: 1,
  textPolicy: "NO_READABLE_TEXT",
  promptCompilerVersion: "bjt-image-generation-prompt-v2.1.0",
  generated: assets.filter((a) => a.generated).length,
  accepted,
  regenerate: assets.filter((a) => a.visualQaStatus === "REGENERATE").length,
  rejected: assets.filter((a) => a.visualQaStatus === "REJECT").length,
  textRiskCounts: {
    NONE: assets.filter((a) => a.textRisk === "NONE").length,
    INCIDENTAL_UNREADABLE: assets.filter((a) => a.textRisk === "INCIDENTAL_UNREADABLE").length,
    READABLE_BUT_IRRELEVANT: assets.filter((a) => a.textRisk === "READABLE_BUT_IRRELEVANT").length,
    PROBLEMATIC: assets.filter((a) => a.textRisk === "PROBLEMATIC").length
  },
  acceptanceRate: assets.length ? accepted / assets.length : 0,
  assets
};
fs.writeFileSync("audit/p6c-beneficial-pilot-v3-qa.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify({ ...out, assets: out.assets.length }, null, 2));
await p.$disconnect();