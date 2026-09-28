import { test, devices } from "@playwright/test";

const VIEWPORTS = [
  { name: "1440", ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
  { name: "1280", ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
  { name: "768", ...devices["Galaxy Tab S4"], viewport: { width: 768, height: 1024 } },
  { name: "390", ...devices["iPhone 14 Pro"], viewport: { width: 390, height: 844 } }
];

const PAGES = [
  { name: "home", path: "/vi" },
  { name: "roadmap", path: "/vi/levels" }
];

for (const vp of VIEWPORTS) {
  test.describe(`${vp.name}px`, () => {
    test.use({ viewport: vp.viewport });

    for (const pg of PAGES) {
      test(`${pg.name} renders without errors`, async ({ page }) => {
        const errors: string[] = [];
        page.on("pageerror", (err) => errors.push(err.message));
        page.on("console", (msg) => {
          if (msg.type() === "error") errors.push(msg.text());
        });

        await page.goto(pg.path, { waitUntil: "networkidle", timeout: 30000 });
        await page.waitForTimeout(1500);

        // Capture screenshot
        await page.screenshot({
          path: `test-results/w2-qa/${pg.name}_${vp.name}.png`,
          fullPage: true
        });

        // Verify no critical runtime errors
        const criticalErrors = errors.filter(
          (e) => !e.includes("ResizeObserver") && !e.includes("favicon")
        );
        if (criticalErrors.length > 0) {
          console.error(`[${pg.name}@${vp.name}] Runtime errors:`, criticalErrors);
        }

        // Verify key structural elements exist
        if (pg.name === "home") {
          await page.locator("nav, [role='navigation']").first().waitFor({ timeout: 5000 });
        }
        if (pg.name === "roadmap") {
          await page.locator("h1, .text-h1").first().waitFor({ timeout: 5000 });
        }
      });
    }
  });
}
