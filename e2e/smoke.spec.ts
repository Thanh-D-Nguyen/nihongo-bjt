import { expect, test } from "@playwright/test";

test.describe("learner web smoke", () => {
  test("home vi renders hero", async ({ page }) => {
    await page.goto("/vi");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("home ja renders", async ({ page }) => {
    await page.goto("/ja");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("BJT levels fit mobile viewport and expose all canonical level links", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];
    const unexpectedResponses: string[] = [];
    const anonymousAuthResponses: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("requestfailed", (request) => failedRequests.push(request.url()));
    page.on("response", (response) => {
      if (response.status() === 401) {
        anonymousAuthResponses.push(new URL(response.url()).pathname);
      } else if (response.status() >= 400) {
        unexpectedResponses.push(`${response.status()} ${response.url()}`);
      }
    });

    const levelsResponse = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/levels");
    await page.goto("/vi/levels");
    await expect(page.getByRole("heading", { name: "Trình độ BJT" })).toBeVisible();
    expect((await levelsResponse).status()).toBe(200);

    const links = page.locator('a[href^="/vi/levels/J"]');
    await expect(links).toHaveCount(6);
    for (const link of await links.all()) {
      await link.scrollIntoViewIfNeeded();
      await expect(link).toBeVisible();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    expect(anonymousAuthResponses.every((path) => ["/api/auth/me", "/api/analytics/learner"].includes(path))).toBe(true);
    expect(consoleErrors.filter((message) => !message.includes("status of 401 (Unauthorized)"))).toEqual([]);
    expect(consoleErrors.filter((message) => message.includes("status of 401 (Unauthorized)")).length).toBe(anonymousAuthResponses.length);
    expect(failedRequests).toEqual([]);
    expect(unexpectedResponses).toEqual([]);
  });

  test("anonymous settings access is redirected to login", async ({ page }) => {
    await page.goto("/vi/settings");
    await expect(page).toHaveURL(/\/vi\/login/);
    await expect(page.locator("form")).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test("privacy settings and public share route keep private tokens hidden", async ({ page }) => {
    await page.goto("/vi/share/test-token");
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("test-token");
  });
});

test.describe("admin web smoke", () => {
  test("admin protected routes show authentication gate without session", async ({ page }) => {
    await page.goto("/admin/vi");
    await expect(page.getByText("Đang xác thực phiên quản trị…")).toBeVisible();

    await page.goto("/admin/vi/ops/feature-flags");
    await expect(page.getByText("Đang xác thực phiên quản trị…")).toBeVisible();

    await page.goto("/admin/vi/ops/dead-letters");
    await expect(page.getByText("Đang xác thực phiên quản trị…")).toBeVisible();
  });

  test("access denied page does not expose personal identifiers", async ({ page }) => {
    await page.goto("/admin/vi/access-denied");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/\S+@\S+\.\S+/);
  });
});
