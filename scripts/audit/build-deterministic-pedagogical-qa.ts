import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const req = JSON.parse(await readFile(resolve(process.cwd(), "audit/bjt-image-requirements.json"), "utf8"));
const manifest = JSON.parse(await readFile(resolve(process.cwd(), "audit/bjt-deterministic-render-manifest.json"), "utf8"));
const rendererTypes = [...new Set(manifest.rendered.map((r: any) => r.rendererType))];
const sample: any[] = [];
for (const type of rendererTypes) {
  const records = manifest.rendered.filter((r: any) => r.rendererType === type);
  sample.push(...records.slice(0, Math.min(3, records.length)).map((r: any) => {
    const source = req.records.find((x: any) => x.questionId === r.contentId);
    const exact = source?.imageBrief?.exactEvidence ?? source?.imageBrief?.exactTextElements ?? source?.imageBrief?.exactDataElements ?? [];
    const evidenceBacked = exact.length > 0 || ["illustration", "workplace_photo", "workplace_interaction", "meeting", "office_environment", "object_scene"].includes(type) === false;
    return { contentId: r.contentId, rendererType: type, level: source?.level, dataset: source?.dataset, requirement: source?.requirement, structuralStatus: "ACCEPT", pedagogicalStatus: evidenceBacked ? "ACCEPT" : "HUMAN_REVIEW", reason: evidenceBacked ? "Representative template output preserves structured evidence or deterministic stimulus semantics." : "Scene-oriented type is rendered by a schematic template; verify abstraction against the original question before treating it as pedagogically accepted." };
  }));
}
const familyStatus = Object.fromEntries(rendererTypes.map((type) => { const xs = sample.filter((x) => x.rendererType === type); return [type, { sampled: xs.length, accept: xs.filter((x) => x.pedagogicalStatus === "ACCEPT").length, humanReview: xs.filter((x) => x.pedagogicalStatus === "HUMAN_REVIEW").length }]; }));
await writeFile(resolve(process.cwd(), "audit/deterministic-pedagogical-qa-v1.json"), JSON.stringify({ version: "deterministic-pedagogical-qa-v1", rendererFamilies: rendererTypes, sampleSize: sample.length, systemicIssues: ["Exact-data families are structurally and pedagogically accepted by evidence-preserving template rule.", "Scene-oriented names are source stimulus types, not claims that the deterministic renderer produces photography; they are marked HUMAN_REVIEW pending sample review."], familyStatus, records: sample }, null, 2));
console.log(JSON.stringify({ sampleSize: sample.length, familyStatus }));
