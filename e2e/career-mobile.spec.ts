import { expect, test } from "@playwright/test";

test("Career uses persisted data honestly and fits a 390px viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const requests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/career/")) requests.push(`${request.method()} ${url.pathname}`);
  });
  await page.route("**/api/career/me", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({
      userId: "career-audit-learner",
      currentRankCode: "R1",
      rankXp: 0,
      jpWorkName: "",
      companyTheme: "",
      hireDate: "2026-10-08",
      streakDays: 0,
      skills: [{ axisCode: "keigo", value: 73 }]
    })
  }));
  await page.route("**/api/career/ranks", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify([])
  }));

  await page.goto("/vi/career");
  await expect(page.getByRole("heading", { name: "Hồ sơ sự nghiệp" })).toBeVisible();
  const skillCard = page.getByText("Bản đồ kỹ năng").locator("..");
  await expect(skillCard.getByText("73", { exact: true })).toBeVisible();
  await expect(skillCard.getByText("—", { exact: true })).toHaveCount(5);
  await expect(page.getByText("Chưa có dữ liệu thứ hạng.")).toBeVisible();
  const careerContent = page.getByRole("heading", { name: "Hồ sơ sự nghiệp" }).locator("xpath=../../..");
  const contentWidth = await careerContent.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth
  }));
  expect(contentWidth.scrollWidth).toBe(contentWidth.clientWidth);
  expect(requests).toContain("GET /api/career/me");
  expect(requests).toContain("GET /api/career/ranks");
});
