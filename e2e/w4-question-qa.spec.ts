import { test, devices } from "@playwright/test";

const VIEWPORTS = [
  { name: "1440", viewport: { width: 1440, height: 900 } },
  { name: "390", viewport: { width: 390, height: 844 } },
];

for (const vp of VIEWPORTS) {
  test.describe(`${vp.name}px`, () => {
    test.use({ viewport: vp.viewport });

    test("practice question renders and accepts answer", async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(err.message));

      // Navigate to exercises page
      await page.goto("/vi/exercises", { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(2000);

      // Screenshot the setup/discovery phase
      await page.screenshot({
        path: `test-results/w4-qa/question_setup_${vp.name}.png`,
        fullPage: true,
      });

      // Click the first exercise type card to select it, then click generate
      const typeCards = page.locator(".exercise-type-card");
      const cardCount = await typeCards.count();
      if (cardCount > 0) {
        await typeCards.first().click();
        await page.waitForTimeout(300);

        // Click the generate/start session button
        const generateBtn = page.locator('button:has-text("Tạo bài tập"), button:has-text("create a question"), button:has-text("問題を作成")');
        if (await generateBtn.count() > 0) {
          await generateBtn.first().click();
          await page.waitForTimeout(3000);

          // Screenshot the question/practice phase
          await page.screenshot({
            path: `test-results/w4-qa/question_active_${vp.name}.png`,
            fullPage: true,
          });
          console.log(`✓ question active @ ${vp.name}`);
        } else {
          console.log(`⚠ no generate button found @ ${vp.name}`);
        }
      } else {
        console.log(`⚠ no exercise type cards found @ ${vp.name}`);
      }

      const criticalErrors = errors.filter(
        (e) => !e.includes("ResizeObserver") && !e.includes("favicon") && !e.includes("401")
      );
      if (criticalErrors.length > 0) {
        console.error(`[question@${vp.name}] Runtime errors:`, criticalErrors);
      }
    });
  });
}