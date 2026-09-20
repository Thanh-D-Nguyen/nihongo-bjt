import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const path = resolve(process.cwd(), "audit/bjt-problem-adjudication.json");
const data = JSON.parse(await readFile(path, "utf8"));
const final = JSON.parse(await readFile(resolve(process.cwd(), "audit/final-edit-adjudication-v1.json"), "utf8"));
const byId = new Map(final.records.map((record: any) => [record.questionId, record]));
for (const record of data.reviews) {
  const adjudication = byId.get(record.questionId);
  if (!adjudication) continue;
  record.currentDecision = adjudication.currentDecision;
  record.finalDecision = adjudication.finalAction === "APPROVE" ? "KEEP" : adjudication.finalAction;
  record.finalAction = adjudication.finalAction;
  record.checklist = adjudication.checklist;
  record.remainingRisks = adjudication.remainingRisks;
  record.evidence = adjudication.evidence;
  record.reviewerMode = adjudication.reviewerMode;
}
await writeFile(path, JSON.stringify(data, null, 2));
console.log(JSON.stringify({ approved: final.records.filter((r: any) => r.finalAction === "APPROVE").length, reviseAgain: final.records.filter((r: any) => r.finalAction !== "APPROVE").length }));
