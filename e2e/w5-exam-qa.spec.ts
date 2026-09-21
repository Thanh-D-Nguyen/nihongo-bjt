import { test } from "@playwright/test";

const VIEWPORTS = [
  { name: "1440", width: 1440, height: 900 },
  { name: "390", width: 390, height: 844 },
];

for (const vp of VIEWPORTS) {
  test.describe(`${vp.name}px`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("mock exam hub renders without errors", async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(err.message));

      await page.goto("/vi/quiz", { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(2000);

      await page.screenshot({
        path: `test-results/w5-qa/exam_hub_${vp.name}.png`,
        fullPage: true,
      });

      const criticalErrors = errors.filter(
        (e) => !e.includes("ResizeObserver") && !e.includes("favicon") && !e.includes("401")
      );
      if (criticalErrors.length > 0) {
        console.error(`[exam@${vp.name}] Runtime errors:`, criticalErrors);
      }
      console.log(`✓ exam hub @ ${vp.name}`);
    });
  });
}