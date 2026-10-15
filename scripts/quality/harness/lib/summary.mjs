// Suite execution-accounting summaries. Each canonical suite writes
// $QUALITY_SUMMARY_DIR/<suite>.json so the harness can record what actually
// executed (discovered/executed/passed/failed/skipped/unexpected skips) rather
// than trusting an exit code. Shared by check-go-test-report.mjs,
// check-frontend-debt.mjs and the harness self-test.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

export const SUMMARY_SCHEMA = "quality-suite-summary/1";

/** result: PASS | VIOLATION | TOOL_FAILURE. No-op unless QUALITY_SUMMARY_DIR is set. */
export function writeSuiteSummary(suite, result, accounting, message = "") {
  const dir = process.env.QUALITY_SUMMARY_DIR;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, `${suite}.json`), `${JSON.stringify({ schema: SUMMARY_SCHEMA, suite, result, accounting, message })}\n`);
}
