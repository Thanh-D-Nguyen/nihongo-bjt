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

  test("settings hub lists notification and privacy routes", async ({ page }) => {
    await page.goto("/vi/settings");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator('a[href="/vi/settings/notifications"]')).toBeVisible();
    await expect(page.locator('a[href="/vi/settings/privacy"]')).toBeVisible();
  });

  test("privacy settings and public share route keep private tokens hidden", async ({ page }) => {
    await page.goto("/vi/share/test-token");
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("test-token");
  });
});

test.describe("admin web smoke", () => {
  test("admin protected routes show authentication gate without session", async ({ page }) => {
    await page.goto("http://127.0.0.1:3001/vi");
    await expect(page.getByText("Đang xác thực phiên quản trị…")).toBeVisible();

    await page.goto("http://127.0.0.1:3001/vi/ops/feature-flags");
    await expect(page.getByText("Đang xác thực phiên quản trị…")).toBeVisible();

    await page.goto("http://127.0.0.1:3001/vi/ops/dead-letters");
    await expect(page.getByText("Đang xác thực phiên quản trị…")).toBeVisible();
  });

  test("access denied page does not expose personal identifiers", async ({ page }) => {
    await page.goto("http://127.0.0.1:3001/vi/access-denied");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/\S+@\S+\.\S+/);
  });
});
