// Vitest reporter used by check-frontend-debt.mjs.
//
// The built-in JSON reporter does not record unhandled errors or whether the
// run was interrupted, so a known failing test could mask a crashed run. This
// reporter uses the public Reporter API (onTestRunEnd) to write everything the
// ratchet needs to decide KNOWN_DEBT vs NEW_DEBT vs TOOL_FAILURE.
import { writeFileSync } from "node:fs";
import path from "node:path";

export default class FrontendDebtReporter {
  onInit(vitest) {
    this.root = vitest.config.root;
  }

  onTestRunEnd(testModules, unhandledErrors, reason) {
    const out = process.env.FRONTEND_DEBT_VITEST_REPORT;
    if (!out) return;
    const modules = testModules.map((mod) => ({
      file: path.relative(this.root, mod.moduleId).split(path.sep).join("/"),
      state: mod.state(),
      errors: mod.errors().map((e) => e.message ?? String(e)),
      tests: [...mod.children.allTests()].map((test) => ({
        name: test.fullName,
        state: test.result().state,
        mode: test.options.mode
      }))
    }));
    writeFileSync(
      out,
      JSON.stringify({
        schema: "frontend-debt-vitest/1",
        reason,
        unhandledErrors: unhandledErrors.map((e) => e.message ?? String(e)),
        modules
      })
    );
  }
}
