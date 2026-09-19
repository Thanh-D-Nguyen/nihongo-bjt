import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { renderDeterministicSvg, writeDeterministicRender, deterministicRenderProvenance } from "../lib/bjt-deterministic-renderer.js";
import type { BjtQuestionImageBrief } from "../lib/bjt-question-image-metadata.js";

const input = JSON.parse(await readFile(resolve(process.cwd(), "audit/bjt-image-requirements.json"), "utf8")) as { records: Array<{ questionId: string; requirement: string; generationMode: string | null; imageBrief: BjtQuestionImageBrief }> };
const semantic = JSON.parse(await readFile(resolve(process.cwd(), "audit/bjt-audit.json"), "utf8")) as { records: Array<{ questionId: string; recommendedAction: string }> };
const actionById = new Map(semantic.records.map((record) => [record.questionId, record.recommendedAction]));
const only = new Set(process.argv.includes("--only") ? (process.argv[process.argv.indexOf("--only") + 1] ?? "").split(",").filter(Boolean) : []);
const records = input.records.filter((record) => record.requirement === "REQUIRED" && record.generationMode === "DETERMINISTIC_RENDER" && !["REMOVE", "HUMAN_REVIEW"].includes(actionById.get(record.questionId) ?? "KEEP") && (only.size === 0 || only.has(record.questionId)));
const rendered = [];
for (const record of records) {
  const result = renderDeterministicSvg(record.imageBrief);
  await writeDeterministicRender(result);
  rendered.push(deterministicRenderProvenance(result));
}
await writeFile(resolve(process.cwd(), "audit/bjt-deterministic-render-manifest.json"), JSON.stringify({ rendererVersion: rendered[0]?.rendererVersion ?? "1.0.0", total: rendered.length, rendered }, null, 2));
console.log(JSON.stringify({ eligible: records.length, rendered: rendered.length, scoped: only.size > 0, excludedBySemanticAction: input.records.filter((record) => record.requirement === "REQUIRED" && record.generationMode === "DETERMINISTIC_RENDER" && actionById.get(record.questionId) !== undefined && actionById.get(record.questionId) !== "KEEP").length }, null, 2));
