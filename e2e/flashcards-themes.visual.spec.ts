import { expect, test, type Locator, type Page } from "@playwright/test";

import { FLASHCARD_THEME_DEFINITIONS } from "../packages/shared/src/flashcard-theme";

const viewports = [
  { height: 812, name: "mobile-375x812", width: 375 },
  { height: 1024, name: "tablet-768x1024", width: 768 },
  { height: 900, name: "desktop-1440x900", width: 1440 }
] as const;

const colorModes = ["light", "dark"] as const;

async function setColorMode(page: Page, mode: (typeof colorModes)[number]) {
  await setAppearance(page, mode, "default");
}

async function setAppearance(
  page: Page,
  mode: (typeof colorModes)[number],
  fontSize: "small" | "default" | "large" | "xl"
) {
  await page.addInitScript(
    (selectedMode) => {
      window.localStorage.setItem(
        "nihongo-appearance",
        JSON.stringify({
          density: "comfortable",
          fontSize: selectedMode.fontSize,
          theme: selectedMode.mode
        })
      );
    },
    { fontSize, mode }
  );
}

async function settle(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  await page.evaluate(() => document.fonts.ready);
}

async function capture(locator: Locator, snapshotName: string, artifactPath?: string) {
  await expect(locator).toBeVisible();
  const screenshot = await locator.screenshot({
    animations: "disabled",
    caret: "hide",
    path: artifactPath
  });
  expect(screenshot).toMatchSnapshot(snapshotName);
}

test.describe("flashcard theme visual matrix", () => {
  for (const viewport of viewports) {
    for (const colorMode of colorModes) {
      for (const theme of FLASHCARD_THEME_DEFINITIONS) {
        test(`${theme.slug} front/back · ${viewport.name} · ${colorMode}`, async ({ page }) => {
          await page.setViewportSize(viewport);
          await setColorMode(page, colorMode);
          await page.goto(`/visual-tests/flashcards?theme=${theme.slug}`);
          await settle(page);

          const card = page.getByTestId("theme-audit-card");
          const contentSurface = card.locator(".flashcard-theme-content").first();
          expect(
            await contentSurface.evaluate(
              (element) => element.scrollWidth <= element.clientWidth + 1
            )
          ).toBe(true);
          await capture(
            card,
            `${theme.slug}-${viewport.name}-${colorMode}-front.png`,
            viewport.name === "tablet-768x1024"
              ? undefined
              : `artifacts/flashcards-audit/after/${theme.slug}-${viewport.name}-${colorMode}-front.png`
          );

          const flipButton = card.locator(".flashcard-theme-control[aria-pressed]");
          await flipButton.focus();
          await expect(flipButton).toBeFocused();
          await flipButton.press("Enter");
          await expect(flipButton).toHaveAttribute("aria-pressed", "true");
          await expect(flipButton).toBeFocused();
          await capture(
            card,
            `${theme.slug}-${viewport.name}-${colorMode}-back.png`,
            viewport.name === "tablet-768x1024"
              ? undefined
              : `artifacts/flashcards-audit/after/${theme.slug}-${viewport.name}-${colorMode}-back.png`
          );
        });
      }

      test(`picker selected state · ${viewport.name} · ${colorMode}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await setColorMode(page, colorMode);
        await page.goto("/visual-tests/flashcards?view=picker&theme=sakura-bloom");
        await settle(page);
        const picker = page.getByTestId("theme-picker-matrix");
        await expect(picker.getByRole("button", { name: "Select sakura-bloom" })).toHaveAttribute(
          "aria-pressed",
          "true"
        );
        await capture(picker, `picker-${viewport.name}-${colorMode}-selected.png`);
      });

      for (const state of ["loading", "empty", "error"] as const) {
        test(`${state} state · ${viewport.name} · ${colorMode}`, async ({ page }) => {
          await page.setViewportSize(viewport);
          await setColorMode(page, colorMode);
          await page.goto(`/visual-tests/flashcards?view=${state}`);
          await settle(page);
          await capture(
            page.getByTestId("flashcard-visual-harness"),
            `${state}-${viewport.name}-${colorMode}.png`
          );
        });
      }
    }
  }

  test("picker hover and keyboard focus are visible", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await setColorMode(page, "light");
    await page.goto("/visual-tests/flashcards?view=picker&theme=minimal-ink");
    await settle(page);

    const ocean = page.getByRole("button", { name: "Select ocean-calm" });
    await ocean.hover();
    await capture(page.getByTestId("theme-picker-matrix"), "picker-desktop-hover.png");
    await ocean.focus();
    await expect(ocean).toBeFocused();
    await capture(page.getByTestId("theme-picker-matrix"), "picker-desktop-keyboard-focus.png");
  });

  test("reduced motion removes card flip transition", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/visual-tests/flashcards?theme=neon-tokyo");
    await settle(page);
    const flipLayer = page
      .locator("[data-testid='theme-audit-card'] [class*='motion-reduce:transition-none']")
      .first();
    const transitionSeconds = await flipLayer.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).transitionDuration)
    );
    expect(transitionSeconds).toBeLessThanOrEqual(0.001);
  });

  for (const viewport of [viewports[0], viewports[2]]) {
    test(`compact short-content hierarchy · ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await setColorMode(page, "light");
      await page.goto("/visual-tests/flashcards?theme=ocean-calm&content=short");
      await settle(page);

      const workspace = page.getByTestId("deck-study-workspace");
      await expect(workspace).toBeVisible();
      expect(
        await workspace.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)
      ).toBe(true);
      await capture(
        workspace,
        `layout-short-content-${viewport.name}.png`,
        `artifacts/flashcards-layout/after/layout-short-content-${viewport.name}.png`
      );
    });
  }

  for (const preference of [
    { fontSize: "small", minimumPx: 33 },
    { fontSize: "default", minimumPx: 39 },
    { fontSize: "large", minimumPx: 43 },
    { fontSize: "xl", minimumPx: 47 }
  ] as const) {
    test(`study typography preserves hierarchy with global ${preference.fontSize} setting`, async ({
      page
    }) => {
      await page.setViewportSize(viewports[0]);
      await setAppearance(page, "light", preference.fontSize);
      await page.goto("/visual-tests/flashcards?theme=ocean-calm&content=short");
      await settle(page);

      const term = page.locator(".flashcard-study-term").first();
      const reading = page.locator(".flashcard-study-reading").first();
      const termPx = await term.evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).fontSize)
      );
      const readingPx = await reading.evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).fontSize)
      );

      expect(termPx).toBeGreaterThanOrEqual(preference.minimumPx);
      expect(readingPx).toBeGreaterThanOrEqual(17);
      expect(termPx).toBeGreaterThan(readingPx * 1.65);
    });
  }

  for (const viewport of [viewports[0], viewports[2]]) {
    test(`deck library hierarchy · ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await setColorMode(page, "light");
      await page.goto("/visual-tests/flashcards?view=library");
      await settle(page);

      const library = page.getByTestId("flashcard-library-fixture");
      await expect(library).toBeVisible();
      expect(
        await library.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)
      ).toBe(true);
      await capture(
        library,
        `library-${viewport.name}.png`,
        `artifacts/flashcards-layout/after/library-${viewport.name}.png`
      );
    });
  }
});

test.describe("legacy contrast audit evidence", () => {
  for (const viewport of [viewports[0], viewports[2]]) {
    for (const theme of FLASHCARD_THEME_DEFINITIONS) {
      test(`${theme.slug} legacy reconstruction · ${viewport.name}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await setColorMode(page, "light");
        await page.goto(`/visual-tests/flashcards?view=legacy&theme=${theme.slug}`);
        await settle(page);
        await page.getByTestId("legacy-theme-card").screenshot({
          animations: "disabled",
          path: `artifacts/flashcards-audit/before/legacy-${theme.slug}-${viewport.name}.png`
        });
      });
    }
  }
});
