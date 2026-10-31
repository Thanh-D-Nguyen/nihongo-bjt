import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "real-stack.spec.ts",
  timeout: 90_000,
  workers: 1,
  outputDir: process.env.IMG301_OUTPUT_DIR,
  use: { ...devices["Desktop Chrome"], baseURL: process.env.IMG301_WEB_URL, trace: "off" },
  reporter: "list"
});
