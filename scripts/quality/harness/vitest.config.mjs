// Harness self-test suite (run by scripts/quality/verify-harness.sh and the CI
// lifecycle job). Kept out of the root `pnpm test` run because these tests
// drive real git/go processes; the root frontend ratchet still runs
// frontend-debt-lib.test.ts.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  root: fileURLToPath(new URL("../../..", import.meta.url)),
  test: {
    include: ["scripts/quality/**/*.test.ts", "scripts/autonomy-regression.test.ts"],
    exclude: ["**/node_modules/**"],
    globals: false,
    passWithNoTests: false,
    allowOnly: false,
    testTimeout: 180_000,
    hookTimeout: 180_000,
    pool: "forks"
  }
});
