import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "apps/**/*.{test,spec}.{ts,tsx}",
      "packages/**/*.{test,spec}.{ts,tsx}",
      "archive/phase-00-data-import/scripts/import/__tests__/**/*.test.ts"
    ],
    exclude: ["**/node_modules/**", "packages/database/generated/**"],
    globals: false,
    passWithNoTests: true
  }
});
