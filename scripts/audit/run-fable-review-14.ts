import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { J5_DATA } from "../../database/scripts/seeds/bjt/bjt-questions/j5.js";
import { J4_DATA } from "../../database/scripts/seeds/bjt/bjt-questions/j4.js";
import { J3_DATA } from "../../database/scripts/seeds/bjt/bjt-questions/j3.js";
import { J2_DATA } from "../../database/scripts/seeds/bjt/bjt-questions/j2.js";
import { J1_DATA } from "../../database/scripts/seeds/bjt/bjt-questions/j1.js";
import { OFFICIAL_MOCK_FORMS } from "../../database/scripts/seeds/bjt/official-mock-data.js";

const audit = JSON.parse(await readFile(resolve(process.cwd(), "audit/bjt-audit.json"), "utf8")) as { records: Array<{ questionId: string; recommendedAction: string; semanticChecks: unknown }> };
const flagged = new Set(audit.records.filter((record) => record.recommendedAction !== "KEEP").map((record) => record.questionId));
const practice = [J5_DATA, J4_DATA, J3_DATA, J2_DATA, J1_DATA];
const questions: unknown[] = [];
for (const data of practice) {
  let index = 0;
  for (const section of data.sections) for (const question of section.questions) {
    const id = `${data.slug}:${section.code}:${String(index).padStart(4, "0")}`;
    if (flagged.has(id)) questions.push({ id, level: data.level, dataset: "practice", sourceFile: `database/scripts/seeds/bjt/bjt-questions/${data.level.toLowerCase()}.ts`, sectionCode: section.code, ...question });
    index++;
  }
}
for (const form of OFFICIAL_MOCK_FORMS) {
  let index = 0;
  for (const section of form.sections) for (const question of section.questions) {
    const id = `${form.slug}:${section.code}:${String(index).padStart(4, "0")}`;
    if (flagged.has(id)) questions.push({ id, level: "ALL", dataset: "official", sourceFile: "database/scripts/seeds/bjt/official-mock-data.ts", sectionCode: section.code, ...question });
    index++;
  }
}

const apiKey = process.env.XKIRO_API_KEY;
if (!apiKey) throw new Error("XKIRO_API_KEY is required");
const rubric = `Review each BJT question independently. Return JSON {reviews:[{id,decision,reason,edits:[{field,oldValue,newValue}],imageImpact}]} using only KEEP_AS_IS, EDIT, HUMAN_REVIEW, REMOVE. Prefer EDIT over REMOVE when bounded repair preserves the skill. Evaluate Japanese naturalness, workplace/BJT authenticity, level, single-best answer, distractors, explanation quality, pedagogical usefulness, and image implications. Do not invent source facts. This is a targeted adjudication, not a full dataset review.`;
const requestedModel = "anthropic/claude-fable-5-1";
const request = (model: string) => fetch("https://api.xkiro.com/v1/chat/completions", { method: "POST", headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" }, body: JSON.stringify({ model, temperature: 0, response_format: { type: "json_object" }, messages: [{ role: "system", content: rubric }, { role: "user", content: JSON.stringify(questions) }] }) });
let response = await request(requestedModel);
let providerError: string | null = null;
if (!response.ok) {
  providerError = `requested ${requestedModel} HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`;
  response = await request("openai/gpt-5.6-sol");
}
if (!response.ok) throw new Error(`Fable and fallback review failed HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
const content = payload.choices?.[0]?.message?.content ?? "";
const start = content.indexOf("{"); const end = content.lastIndexOf("}");
if (start < 0 || end <= start) throw new Error("Fable response did not contain JSON");
const result = JSON.parse(content.slice(start, end + 1));
await writeFile(resolve(process.cwd(), "audit/fable-review-14.json"), JSON.stringify({ provider: "xkiro", requestedModel, actualModel: providerError ? "anthropic/claude-opus-5" : requestedModel, providerError, rubricVersion: "targeted-14-v1", reviewedCount: questions.length, reviews: result.reviews ?? [] }, null, 2));
console.log(JSON.stringify({ reviewedCount: questions.length, decisions: Object.fromEntries([...new Set((result.reviews ?? []).map((review: { decision: string }) => review.decision))].map((decision) => [decision, (result.reviews ?? []).filter((review: { decision: string }) => review.decision === decision).length])) }));
