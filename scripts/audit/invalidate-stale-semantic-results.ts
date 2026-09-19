import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const path = resolve(process.cwd(), "audit/bjt-semantic-judge-results.json");
const adjudication = JSON.parse(await readFile(resolve(process.cwd(), "audit/bjt-problem-adjudication.json"), "utf8")) as { reviews: Array<{ questionId: string }> };
const stale = new Set(adjudication.reviews.map((review) => review.questionId));
const current = JSON.parse(await readFile(path, "utf8")) as { rubricVersion: string; results: Array<{ questionId: string }> };
const results = current.results.filter((result) => !stale.has(result.questionId));
await writeFile(path, JSON.stringify({ ...current, updatedAt: new Date().toISOString(), invalidatedQuestionIds: [...stale], results }, null, 2));
console.log(JSON.stringify({ before: current.results.length, after: results.length, invalidated: stale.size }));
