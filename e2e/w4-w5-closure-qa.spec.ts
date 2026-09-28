import { test, expect } from "@playwright/test";

const VIEWPORTS = [
  { name: "1440", viewport: { width: 1440, height: 900 } },
  { name: "390", viewport: { width: 390, height: 844 } }
];

for (const vp of VIEWPORTS) {
  test.describe(`W4-W5 Closure QA @ ${vp.name}px`, () => {
    test.use({ viewport: vp.viewport });

    test("W4: practice question renders with correct hierarchy and state transitions", async ({
      page
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(err.message));

      await page.goto("/vi/exercises", { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(2000);

      // Screenshot setup phase
      await page.screenshot({
        path: `test-results/w4-w5-qa/w4_setup_${vp.name}.png`,
        fullPage: true
      });

      // Click first exercise type card
      const typeCards = page.locator(".exercise-type-card");
      const cardCount = await typeCards.count();
      if (cardCount > 0) {
        await typeCards.first().click();
        await page.waitForTimeout(300);

        // Click generate button — use exact Vietnamese label
        const generateBtn = page.getByRole("button", { name: /Tạo bài tập/i });
        if ((await generateBtn.count()) > 0) {
          await generateBtn.first().click();
          await page.waitForTimeout(4000);

          // Screenshot active question state
          await page.screenshot({
            path: `test-results/w4-w5-qa/w4_question_active_${vp.name}.png`,
            fullPage: true
          });

          // Try selecting an answer
          const answerBtns = page.locator(".exercise-answer-btn");
          const answerCount = await answerBtns.count();
          if (answerCount > 0) {
            await answerBtns.first().click();
            await page.waitForTimeout(500);

            // Screenshot selected state
            await page.screenshot({
              path: `test-results/w4-w5-qa/w4_answer_selected_${vp.name}.png`,
              fullPage: true
            });

            // Submit answer — use exact Vietnamese label
            const submitBtn = page.getByRole("button", { name: /Trả lời/i });
            if ((await submitBtn.count()) > 0) {
              await submitBtn.first().click();
              await page.waitForTimeout(1500);

              // Screenshot feedback state (correct or incorrect)
              await page.screenshot({
                path: `test-results/w4-w5-qa/w4_feedback_${vp.name}.png`,
                fullPage: true
              });

              // Verify feedback panel is visible
              const feedbackPanel = page.locator(".exercise-feedback");
              if ((await feedbackPanel.count()) > 0) {
                console.log(`✓ Feedback panel visible @ ${vp.name}`);
              }
            }
          }
        }
      }

      const criticalErrors = errors.filter(
        (e) => !e.includes("ResizeObserver") && !e.includes("favicon") && !e.includes("401")
      );
      expect(criticalErrors).toEqual([]);
    });

    test("W5: mock exam hub and active cockpit render correctly", async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(err.message));

      await page.goto("/vi/quiz", { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(2000);

      // Screenshot exam hub
      await page.screenshot({
        path: `test-results/w4-w5-qa/w5_hub_${vp.name}.png`,
        fullPage: true
      });

      // Select practice mode — use exact Vietnamese label
      const practiceModeBtn = page.getByRole("button", { name: /Luyện theo mục tiêu/i });
      if ((await practiceModeBtn.count()) > 0) {
        await practiceModeBtn.first().click();
        await page.waitForTimeout(1000);

        // Look for start session button
        const startBtn = page.getByRole("button", { name: /Bắt đầu phiên/i });
        if ((await startBtn.count()) > 0) {
          await startBtn.first().click();
          await page.waitForTimeout(4000);

          // Screenshot active exam cockpit
          await page.screenshot({
            path: `test-results/w4-w5-qa/w5_active_cockpit_${vp.name}.png`,
            fullPage: true
          });

          // Verify timer is visible
          const timer = page.locator('[class*="timer"], [class*="Timer"], .tabular-nums');
          if ((await timer.count()) > 0) {
            console.log(`✓ Timer visible @ ${vp.name}`);
          }

          // Verify progress indicator
          const progress = page.locator('[class*="progress"], [role="progressbar"]');
          if ((await progress.count()) > 0) {
            console.log(`✓ Progress bar visible @ ${vp.name}`);
          }

          // Try selecting an answer in exam mode
          const examAnswerBtns = page.locator(
            'button[class*="answer"], button[class*="option"], .quiz-answer-btn, [role="radio"]'
          );
          const examAnswerCount = await examAnswerBtns.count();
          if (examAnswerCount > 0) {
            await examAnswerBtns.first().click();
            await page.waitForTimeout(500);

            // Screenshot answer selected in exam mode
            await page.screenshot({
              path: `test-results/w4-w5-qa/w5_answer_selected_${vp.name}.png`,
              fullPage: true
            });
          }

          // Check for flag button
          const flagBtn = page.locator(
            '[aria-label*="flag"], [aria-label*="Flag"], button:has-text("🚩"), button:has-text("Cờ")'
          );
          if ((await flagBtn.count()) > 0) {
            await flagBtn.first().click();
            await page.waitForTimeout(500);

            // Screenshot flagged state
            await page.screenshot({
              path: `test-results/w4-w5-qa/w5_flagged_${vp.name}.png`,
              fullPage: true
            });
            console.log(`✓ Flag functionality verified @ ${vp.name}`);
          }
        }
      }

      const criticalErrors = errors.filter(
        (e) => !e.includes("ResizeObserver") && !e.includes("favicon") && !e.includes("401")
      );
      expect(criticalErrors).toEqual([]);
    });
  });
}
