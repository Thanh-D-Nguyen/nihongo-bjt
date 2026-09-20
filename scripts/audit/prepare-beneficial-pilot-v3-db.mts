import { config } from "dotenv"; config();
import { createPrismaClient } from "../../packages/database/src/index.js";
import fs from "node:fs";
const p = createPrismaClient(process.env.DATABASE_URL!);
const scope = JSON.parse(fs.readFileSync("audit/p6c-beneficial-pilot-v3-db-scope.json", "utf8"));
const briefs = JSON.parse(fs.readFileSync("audit/bjt-image-requirements.json", "utf8"));
for (const candidate of scope.candidates) {
  const brief = briefs.records.find((record: any) => record.questionId === candidate.questionId)?.imageBrief;
  if (!brief || brief.requirement !== "BENEFICIAL" || brief.generationMode !== "AI_GENERATED") throw new Error(`invalid pilot brief ${candidate.questionId}`);
  const scenePrompt = `Supplemental contextual scene only; it must not carry tested answer evidence. Scene: ${brief.scene ?? brief.accessibilityAlt}.`;
  await p.bjtQuestion.update({ where: { id: candidate.dbQuestionId }, data: { imageAlt: brief.accessibilityAlt, imagePrompt: scenePrompt, qualityFlags: { bjtBriefVersion: brief.briefVersion, stimulusType: brief.stimulusType ?? brief.archetype, renderStrategy: "ai_contextual", testedVisualEvidence: false, imageRequiredToAnswer: false, promptCompilerVersion: "bjt-image-generation-prompt-v2.1.0", contextualStyleContractVersion: "contextual-style-contract-v1.1", textPolicy: "NO_READABLE_TEXT", pilot: "p6c-beneficial-pilot-v3", contentFingerprint: "f7425e27ebff022d506829450ade9cb07fd24cd915b29a8d4f911ff1891af0d1" } } });
}
console.log(JSON.stringify({ prepared: scope.candidates.length, promptCompilerVersion: "bjt-image-generation-prompt-v2.1.0", briefVersion: "2.0.0", textPolicy: "NO_READABLE_TEXT" }));
await p.$disconnect();
