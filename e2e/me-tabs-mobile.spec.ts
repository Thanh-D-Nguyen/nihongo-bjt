import { expect, test } from "@playwright/test";

test("profile tabs fit and remain tappable at 390px in every locale", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const me = {
      id: "11111111-1111-4111-8111-111111111111",
      email: "learner@example.test",
      displayName: "Mobile learner",
      status: "active",
      themeMode: "system",
      fontSizePreference: "medium",
      densityPreference: "comfortable",
      flashcardStyleSlug: null,
      coverAssetId: null,
      adsPersonalizationOptIn: false,
      sharePostcardOptIn: false,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z"
    };
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.includes("/api/auth/me")) return new Response(JSON.stringify(me), { status: 200 });
      if (url.includes("/api/learner/analytics")) {
        return new Response(JSON.stringify({ totals: {}, dueFlashcards: 0 }), { status: 200 });
      }
      return originalFetch(input, init);
    };
  });

  for (const locale of ["vi", "en", "ja"]) {
    await page.goto(`/${locale}/me?tab=settings`);
    const tablist = page.getByRole("tablist");
    await expect(tablist).toBeVisible();
    const layout = await tablist.evaluate((element) => {
      const row = element.firstElementChild as HTMLElement;
      const tabs = [...element.querySelectorAll<HTMLElement>("[role=tab]")];
      return {
        rowOverflow: row.scrollWidth > row.clientWidth,
        tabs: tabs.map((tab) => ({
          overflow: tab.scrollWidth > tab.clientWidth,
          height: tab.getBoundingClientRect().height,
          right: tab.getBoundingClientRect().right
        }))
      };
    });
    expect(layout.tabs).toHaveLength(4);
    expect(layout.rowOverflow).toBe(false);
    expect(layout.tabs.every((tab) => !tab.overflow && tab.height >= 48 && tab.right <= 390)).toBe(true);
    await expect(page.getByRole("tab", { selected: true })).toBeVisible();
  }
});
