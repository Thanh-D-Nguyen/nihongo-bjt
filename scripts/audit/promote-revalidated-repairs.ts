import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const adjudicationPath = resolve(process.cwd(), "audit/bjt-problem-adjudication.json");
const resultPath = resolve(process.cwd(), "audit/bjt-semantic-judge-results.json");
const adjudication = JSON.parse(await readFile(adjudicationPath, "utf8")) as { reviews: Array<Record<string, unknown>> };
const results = JSON.parse(await readFile(resultPath, "utf8")) as { results: Array<{ questionId: string; decision: string; judgeModel?: string }> };
const byId = new Map(results.results.map((result) => [result.questionId, result]));
for (const review of adjudication.reviews) {
  const result = byId.get(String(review.questionId));
  if (result?.decision === "KEEP") {
    review.revalidatedDecision = "KEEP_AS_IS";
    review.revalidatedBy = "local-structural-semantic/source-rules-v1";
    review.revalidatedAt = new Date().toISOString();
  }
}
await writeFile(adjudicationPath, JSON.stringify(adjudication, null, 2));
console.log(JSON.stringify({ revalidatedKeep: adjudication.reviews.filter((review) => review.revalidatedDecision === "KEEP_AS_IS").length, total: adjudication.reviews.length }));
