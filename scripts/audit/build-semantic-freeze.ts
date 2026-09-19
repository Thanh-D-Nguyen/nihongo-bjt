import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const files = [
  "database/scripts/seeds/bjt/bjt-questions/j5.ts",
  "database/scripts/seeds/bjt/bjt-questions/j4.ts",
  "database/scripts/seeds/bjt/bjt-questions/j3.ts",
  "database/scripts/seeds/bjt/bjt-questions/j2.ts",
  "database/scripts/seeds/bjt/bjt-questions/j1.ts",
  "database/scripts/seeds/bjt/bjt-questions/j1plus.ts",
  "database/scripts/seeds/bjt/official-mock-data.ts",
];
const hash = createHash("sha256");
for (const file of files) hash.update(file).update(await readFile(resolve(process.cwd(), file)));
const audit = JSON.parse(await readFile(resolve(process.cwd(), "audit/bjt-audit.json"), "utf8"));
const freeze = JSON.parse(await readFile(resolve(process.cwd(), "audit/semantic-freeze-v1.json"), "utf8"));
freeze.datasetFingerprint = hash.digest("hex");
freeze.auditRubricVersion = audit.summary.rubricVersion;
freeze.semanticStatus = { JUDGED: audit.summary.semanticCoverage.judged, UNJUDGED: audit.summary.decisionCounts.UNJUDGED ?? 0, FAILED: 0, NOT_REQUIRED: 0 };
freeze.semanticDecision = { KEEP: audit.summary.decisionCounts.KEEP ?? 0, EDIT: audit.summary.decisionCounts.EDIT ?? 0, HUMAN_REVIEW: audit.summary.decisionCounts.HUMAN_REVIEW ?? 0, REMOVE: audit.summary.decisionCounts.REMOVE ?? 0, UNRESOLVED: audit.summary.decisionCounts.UNJUDGED ?? 0 };
freeze.freezeStatus = "NOT_FROZEN";
await writeFile(resolve(process.cwd(), "audit/semantic-freeze-v1.json"), JSON.stringify(freeze, null, 2));
console.log(JSON.stringify({ datasetFingerprint: freeze.datasetFingerprint, semanticStatus: freeze.semanticStatus, semanticDecision: freeze.semanticDecision }));
