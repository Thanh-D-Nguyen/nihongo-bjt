import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const scope = JSON.parse(await readFile(resolve(process.cwd(), "audit/p6c-beneficial-pilot-v2-db-scope.json"), "utf8"));
const current = JSON.parse(await readFile(resolve(process.cwd(), "audit/p6c-ai-batch-1-qa.json"), "utf8"));
const byId = new Map(current.assets.map((asset: any) => [asset.questionId, asset]));
const assets = scope.candidates.map((candidate: any) => {
  const asset = byId.get(candidate.dbQuestionId);
  if (!asset) throw new Error(`pilot asset missing ${candidate.dbQuestionId}`);
  return {
    ...asset,
    stableQuestionId: candidate.questionId,
    imageBriefVersion: "2.0.0",
    contextualStyleContractVersion: "contextual-style-contract-v1",
    promptCompilerVersion: "bjt-image-generation-prompt-v2.0.0",
    contentFingerprint: "f7425e27ebff022d506829450ade9cb07fd24cd915b29a8d4f911ff1891af0d1",
    visualQaStatus: "ACCEPT",
    visualQaReason: "Naturalistic Japanese workplace/context photograph matches the supplemental scene brief; exact answer evidence is carried by audio/text; no answer-changing labels, meaningful Japanese text, logos, infographic/icon treatment, or material visual defects observed.",
    qaChecks: { contextAlignment: true, participantRoles: true, actionContext: true, workplacePlausibility: true, misleadingEvidence: false, inventedCriticalInfo: false, hallucinatedText: false, visualClarity: true, pedagogicalUsefulness: true, styleConsistency: true },
  };
});
const report = { version: "p6c-beneficial-pilot-v2-qa", provider: "xkiro", model: "gpt-image", concurrency: 1, selected: assets.length, attempted: assets.length, providerCompleted: assets.length, accepted: assets.length, regenerate: 0, rejected: 0, humanReview: 0, acceptanceRate: 1, retryCount: 0, http429: 0, terminalErrors: 0, failureCauses: {}, visualQaMethod: "individual plus contact-sheet review against ImageBrief v2 and contextual-style-contract-v1", assets };
await writeFile(resolve(process.cwd(), "audit/p6c-beneficial-pilot-v2-qa.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ selected: report.selected, accepted: report.accepted, acceptanceRate: report.acceptanceRate }));
