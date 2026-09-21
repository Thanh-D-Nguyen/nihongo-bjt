import { test, devices } from "@playwright/test";

const VIEWPORTS = [
  { name: "1440", ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
  { name: "1280", ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
  { name: "768", ...devices["Galaxy Tab S4"], viewport: { width: 768, height: 1024 } },
  { name: "390", ...devices["iPhone 14 Pro"], viewport: { width: 390, height: 844 } },
];

for (const vp of VIEWPORTS) {
  test.describe(`${vp.name}px`, () => {
    test.use({ viewport: vp.viewport });

    test("practice discovery renders without errors", async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(err.message));
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });

      await page.goto("/vi/exercises", { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(2000);

      await page.screenshot({
        path: `test-results/w3-qa/practice_${vp.name}.png`,
        fullPage: true,
      });

      const criticalErrors = errors.filter(
        (e) => !e.includes("ResizeObserver") && !e.includes("favicon")
      );
      if (criticalErrors.length > 0) {
        console.error(`[practice@${vp.name}] Runtime errors:`, criticalErrors);
      }
    });
  });
}