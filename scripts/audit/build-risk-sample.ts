import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const audit = JSON.parse(await readFile(resolve(process.cwd(), "audit/bjt-audit.json"), "utf8")) as { records: Array<Record<string, unknown> & { questionId: string; level: string; sectionCode: string; semanticChecks: Record<string, { score: number; confidence: number }>; promptDigest?: string }> };
const req = JSON.parse(await readFile(resolve(process.cwd(), "audit/bjt-image-requirements.json"), "utf8")) as { records: Array<{ questionId: string; requirement: string; archetype: string | null; imageBrief: { scene: string | null } }> };
const reqById = new Map(req.records.map((record) => [record.questionId, record]));
const ranked = audit.records.map((record) => {
  const checks = Object.values(record.semanticChecks ?? {});
  let score = 0;
  if (checks.some((check) => check.confidence < 0.75)) score += 5;
  if (checks.some((check) => check.score <= 3)) score += 4;
  if (record.finalDecision !== "KEEP") score += 5;
  if (["J1", "J1+", "J2"].includes(record.level)) score += 2;
  if (["LC_INTEGRATED", "LR_SITUATION"].includes(record.sectionCode)) score += 2;
  const image = reqById.get(record.questionId);
  if (image?.imageBrief.scene && image.imageBrief.scene.length > 40) score += 1;
  return { score, ...record, imageRequirement: image?.requirement, imageArchetype: image?.archetype };
}).sort((a, b) => b.score - a.score);
const selected: typeof ranked = [];
for (const level of ["J5", "J4", "J3", "J2", "J1", "J1+"]) {
  selected.push(...ranked.filter((record) => record.level === level).slice(0, 4));
}
await writeFile(resolve(process.cwd(), "audit/risk-sample-v1.json"), JSON.stringify({ version: "risk-sample-v1", sampleSize: selected.length, selectionPolicy: "top 4 per level by low-confidence/low-score/semantic-risk/visual-interpretation signals", records: selected }, null, 2));
console.log(JSON.stringify({ sampleSize: selected.length, levels: Object.fromEntries(["J5", "J4", "J3", "J2", "J1", "J1+"].map((level) => [level, selected.filter((record) => record.level === level).length])) }));
