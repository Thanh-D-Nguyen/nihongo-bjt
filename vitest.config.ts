import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./apps/web", import.meta.url))
    }
  },
  test: {
    include: [
      "apps/**/*.{test,spec}.{ts,tsx}",
      "packages/**/*.{test,spec}.{ts,tsx}",
      "database/scripts/seeds/bjt-lessons/**/*.test.ts",
      "archive/phase-00-data-import/scripts/import/__tests__/**/*.test.ts"
    ],
    exclude: ["**/node_modules/**", "packages/database/generated/**"],
    globals: false,
    passWithNoTests: true
  }
});
