import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
/** Set to `1` when learner web is already running (e.g. `pnpm --filter @nihongo-bjt/web dev` on :3000). */
const skipWebServer = process.env.PLAYWRIGHT_SKIP_SERVER === "1";

/**
 * Phase 10 — smoke E2E against the learner app (Next.js).
 * Run `pnpm exec playwright install chromium` once after install.
 */
export default defineConfig({
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: true,
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ],
  reporter: process.env.CI ? "github" : "list",
  retries: process.env.CI ? 1 : 0,
  testDir: "./e2e",
  timeout: 60_000,
  use: {
    baseURL,
    trace: "on-first-retry"
  },
  webServer: skipWebServer
    ? undefined
    : [
        {
          command: "pnpm --filter @nihongo-bjt/web run dev",
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          url: baseURL
        },
        {
          command: "pnpm --filter @nihongo-bjt/admin run dev",
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          url: "http://127.0.0.1:3001"
        }
      ],
  workers: process.env.CI ? 1 : undefined
});
