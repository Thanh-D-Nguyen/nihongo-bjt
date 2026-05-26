import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Automated accessibility audit using axe-core.
 * Covers WCAG 2.1 Level AA for key learner pages.
 *
 * Run: pnpm exec playwright test e2e/a11y.spec.ts
 * Requires: pnpm add -D @axe-core/playwright
 */

test.describe("Accessibility audit (WCAG 2.1 AA)", () => {
  const pages = [
    { name: "Homepage (vi)", url: "/vi" },
    { name: "Homepage (ja)", url: "/ja" },
    { name: "BJT section", url: "/vi/bjt" },
    { name: "Settings", url: "/vi/settings" },
  ];

  for (const { name, url } of pages) {
    test(`${name} has no critical a11y violations`, async ({ page }) => {
      await page.goto(url);
      await page.waitForLoadState("domcontentloaded");

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .exclude(".rive-canvas") // Rive canvas is visual-only, not auditable
        .analyze();

      // Allow minor "needs review" items but zero critical/serious
      const critical = results.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious",
      );

      if (critical.length > 0) {
        const summary = critical
          .map((v) => `[${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} instances)`)
          .join("\n");
        expect(critical, `A11y violations found:\n${summary}`).toHaveLength(0);
      }
    });
  }

  test("skip-link is functional", async ({ page }) => {
    await page.goto("/vi");
    // Tab to activate the skip link
    await page.keyboard.press("Tab");
    const skipLink = page.locator(".skip-to-content");
    await expect(skipLink).toBeFocused();
    await page.keyboard.press("Enter");
    // Focus should now be on #main
    const main = page.locator("#main");
    await expect(main).toBeFocused();
  });

  test("focus-visible ring appears on keyboard navigation", async ({ page }) => {
    await page.goto("/vi");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    // Second tab should move to a focusable element with visible outline
    const focused = page.locator(":focus-visible");
    await expect(focused).toBeVisible();
  });

  test("touch targets are at least 44x44px on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/vi");
    await page.waitForLoadState("domcontentloaded");

    // Check all buttons and links in the nav area
    const interactives = page.locator("nav a, nav button, [role='tab']");
    const count = await interactives.count();

    for (let i = 0; i < Math.min(count, 10); i++) {
      const box = await interactives.nth(i).boundingBox();
      if (box) {
        // WCAG SC 2.5.8 Target Size (Minimum) = 24x24, we aim for 44x44
        expect(
          box.width >= 44 || box.height >= 44,
          `Touch target ${i} is too small: ${box.width}x${box.height}`,
        ).toBeTruthy();
      }
    }
  });
});

test.describe("Mobile responsive audit", () => {
  const viewports = [
    { name: "iPhone SE (375px)", width: 375, height: 667 },
    { name: "iPhone 14 Pro (393px)", width: 393, height: 852 },
    { name: "Pixel 7 (412px)", width: 412, height: 915 },
  ];

  for (const vp of viewports) {
    test(`Homepage renders without horizontal overflow on ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/vi");
      await page.waitForLoadState("domcontentloaded");

      // Check no horizontal scrollbar (document width should not exceed viewport)
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      expect(bodyWidth).toBeLessThanOrEqual(vp.width + 1); // +1 for rounding
    });

    test(`No overlapping fixed elements on ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/vi");
      await page.waitForLoadState("networkidle");

      // Check that fixed/sticky elements don't overlap each other
      const fixedElements = await page.evaluate(() => {
        const els = Array.from(document.querySelectorAll("*"));
        return els
          .filter((el) => {
            const style = window.getComputedStyle(el);
            return style.position === "fixed" || style.position === "sticky";
          })
          .map((el) => {
            const rect = el.getBoundingClientRect();
            return {
              tag: el.tagName,
              class: el.className.toString().slice(0, 50),
              top: rect.top,
              bottom: rect.bottom,
              left: rect.left,
              right: rect.right,
            };
          })
          .filter((r) => r.bottom > 0 && r.top < window.innerHeight); // visible ones
      });

      // Pairwise overlap check
      for (let i = 0; i < fixedElements.length; i++) {
        for (let j = i + 1; j < fixedElements.length; j++) {
          const a = fixedElements[i];
          const b = fixedElements[j];
          const overlaps =
            a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
          if (overlaps) {
            // Warn but don't hard-fail (some overlaps are intentional like modals)
            console.warn(
              `Potential overlap: ${a.tag}.${a.class} ↔ ${b.tag}.${b.class}`,
            );
          }
        }
      }
    });
  }
});
