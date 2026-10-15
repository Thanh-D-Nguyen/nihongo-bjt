import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@/app/_components/admin-auto-fill": fileURLToPath(new URL("./apps/admin/app/_components/admin-auto-fill.tsx", import.meta.url)),
      "@/app/_components/admin-client-utils": fileURLToPath(new URL("./apps/admin/app/_components/admin-client-utils.ts", import.meta.url)),
      "@/lib/admin-api": fileURLToPath(new URL("./apps/admin/lib/admin-api.ts", import.meta.url)),
      "@": fileURLToPath(new URL("./apps/web", import.meta.url))
    }
  },
  test: {
    include: [
      "apps/**/*.{test,spec}.{ts,tsx}",
      "packages/**/*.{test,spec}.{ts,tsx}",
      "scripts/**/*.{test,spec}.ts",
      "database/scripts/seeds/bjt-lessons/**/*.test.ts",
      "database/scripts/seeds/bjt/**/*.test.ts",
      "archive/phase-00-data-import/scripts/import/__tests__/**/*.test.ts"
    ],
    // The harness suite drives real git/go processes; it runs via scripts/quality/verify-harness.sh.
    exclude: ["**/node_modules/**", "packages/database/generated/**", "scripts/quality/harness/**"],
    globals: false,
    passWithNoTests: true
  }
});
