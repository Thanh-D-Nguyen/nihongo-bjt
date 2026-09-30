import { expect, test, type Page } from "@playwright/test";

/**
 * REAL_BROWSER_AUTHENTICATED_PARITY — Linux staging gate.
 *
 * Validates anonymous + authenticated learner flows against the Go-backend
 * staging deployment via Caddy. Parameterized by PLAYWRIGHT_BASE_URL so the
 * LAN IP is never hardcoded in source.
 */

const STAGING = process.env.PLAYWRIGHT_BASE_URL ?? "http://192.168.1.8:18080";

// Unique staging-only identity per run to avoid collisions.
const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const TEST_USERNAME = `stg_${RUN_ID.replace(/[^a-z0-9]/gi, "").slice(0, 12)}`;
const TEST_EMAIL = `staging-${RUN_ID}@kotobawork.test`;
const TEST_PASSWORD = `Staging!Pass-${RUN_ID}`;

test.describe.configure({ mode: "serial", timeout: 120_000 });

async function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  return errors;
}

test.describe("anonymous", () => {
  test("/vi renders Vietnamese home without errors", async ({ page }) => {
    const errors = await collectErrors(page);
    await page.goto(`${STAGING}/vi`, { waitUntil: "networkidle", timeout: 30_000 });

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("body")).toContainText(/KotobaWorks|Học tiếng Nhật/i);

    // No unexpected errors on public page (401 from /api/auth/me is expected for anonymous)
    const critical = errors.filter(
      (e) =>
        !e.includes("ResizeObserver") &&
        !e.includes("favicon") &&
        !e.includes("hydration") &&
        !e.includes("401") &&
        !e.includes("Unauthorized")
    );
    expect(critical).toEqual([]);
  });

  test("login page renders with email/password form", async ({ page }) => {
    await page.goto(`${STAGING}/vi/login`, { waitUntil: "networkidle", timeout: 30_000 });

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /đăng nhập|sign in|login/i })).toBeVisible();
  });

  test("register page renders with required fields", async ({ page }) => {
    await page.goto(`${STAGING}/vi/register`, { waitUntil: "networkidle", timeout: 30_000 });

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("/api/auth/me returns 401 for anonymous", async ({ request }) => {
    const res = await request.get(`${STAGING}/api/auth/me`);
    expect(res.status()).toBe(401);
  });
});

test.describe("authenticated lifecycle", () => {
  test("register → authenticated session → refresh → logout → relogin", async ({
    page,
  }) => {
    const errors = await collectErrors(page);

    // ── REGISTER ──────────────────────────────────────────────
    await page.goto(`${STAGING}/vi/register`, { waitUntil: "networkidle", timeout: 30_000 });
    await page.screenshot({ path: "test-results/staging-auth/register-form.png", fullPage: true });

    // Fill registration form — staging renders English labels; adapt to actual DOM
    const displayNameInput = page.getByLabel(/display name|tên hiển thị/i);
    const emailInput = page.getByLabel(/email/i);
    const passwordInput = page.getByLabel(/^password$|^mật khẩu$/i);
    const confirmInput = page.getByLabel(/confirm|xác nhận|nhập lại/i);
    const createBtn = page.getByRole("button", { name: /create account|đăng ký|sign up|tạo tài khoản/i });

    if ((await displayNameInput.count()) > 0) {
      await displayNameInput.first().fill(TEST_USERNAME);
    }
    await emailInput.fill(TEST_EMAIL);
    await passwordInput.first().fill(TEST_PASSWORD);
    if ((await confirmInput.count()) > 0) {
      await confirmInput.first().fill(TEST_PASSWORD);
    }

    await page.screenshot({ path: "test-results/staging-auth/register-filled.png", fullPage: true });

    // Submit registration
    const submitBtn = createBtn;
    await submitBtn.click();

    // Wait for navigation or success indicator
    await page.waitForURL((url) => !url.pathname.includes("/register"), { timeout: 15_000 }).catch(() => {
      // Some apps stay on same page but show success — check for auth state instead
    });

    await page.screenshot({ path: "test-results/staging-auth/after-register.png", fullPage: true });

    // Verify authenticated session — use page.evaluate(fetch) to share browser cookies
    const meAfterRegister = await page.evaluate(async (url) => {
      const res = await fetch(url, { credentials: "same-origin" });
      const body = await res.json().catch(() => ({}));
      return { status: res.status, email: body.email ?? body.user?.email };
    }, `${STAGING}/api/auth/me`);
    expect(meAfterRegister.status, "/api/auth/me should return 200 after register").toBe(200);
    expect(meAfterRegister.email).toBeTruthy();

    // ── HOME AUTHENTICATED ────────────────────────────────────
    await page.goto(`${STAGING}/vi`, { waitUntil: "networkidle", timeout: 30_000 });
    await page.screenshot({ path: "test-results/staging-auth/home-authenticated.png", fullPage: true });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // ── REFRESH PERSISTENCE ───────────────────────────────────
    await page.reload({ waitUntil: "networkidle", timeout: 30_000 });
    const meAfterRefreshStatus = await page.evaluate(async (url) => {
      const res = await fetch(url, { credentials: "same-origin" });
      return res.status;
    }, `${STAGING}/api/auth/me`);
    expect(meAfterRefreshStatus, "Session must persist after refresh").toBe(200);

    // ── PROFILE PAGE ──────────────────────────────────────────
    await page.goto(`${STAGING}/vi/profile`, { waitUntil: "networkidle", timeout: 30_000 }).catch(() => {});
    await page.screenshot({ path: "test-results/staging-auth/profile.png", fullPage: true });

    // ── LOGOUT ────────────────────────────────────────────────
    // Use fetch() in browser context so Set-Cookie clearing applies to the page's cookie jar
    const logoutStatus = await page.evaluate(async (url) => {
      const res = await fetch(url, { method: "POST", credentials: "same-origin" });
      return res.status;
    }, `${STAGING}/api/auth/logout`);
    expect(logoutStatus, "POST /api/auth/logout should return 200").toBe(200);
    await page.goto(`${STAGING}/vi`, { waitUntil: "networkidle", timeout: 30_000 });

    await page.screenshot({ path: "test-results/staging-auth/after-logout.png", fullPage: true });

    // Verify logged out — use page.evaluate(fetch) to share browser cookies
    const meAfterLogoutStatus = await page.evaluate(async (url) => {
      const res = await fetch(url, { credentials: "same-origin" });
      return res.status;
    }, `${STAGING}/api/auth/me`);
    expect(meAfterLogoutStatus, "Must be 401 after logout").toBe(401);

    // ── RELOGIN ───────────────────────────────────────────────
    await page.goto(`${STAGING}/vi/login`, { waitUntil: "networkidle", timeout: 30_000 });
    await page.locator('input[type="email"]').fill(TEST_EMAIL);
    await page.locator('input[type="password"]').first().fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /đăng nhập|sign in|login/i }).click();

    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15_000 }).catch(() => {});
    await page.screenshot({ path: "test-results/staging-auth/after-relogin.png", fullPage: true });

    const meAfterReloginStatus = await page.evaluate(async (url) => {
      const res = await fetch(url, { credentials: "same-origin" });
      return res.status;
    }, `${STAGING}/api/auth/me`);
    expect(meAfterReloginStatus, "Must be 200 after relogin").toBe(200);

    // ── CRITICAL ERRORS CHECK ─────────────────────────────────
    const critical = errors.filter(
      (e) =>
        !e.includes("ResizeObserver") &&
        !e.includes("favicon") &&
        !e.includes("hydration") &&
        !e.includes("Third-party cookie") &&
        !e.includes("401") &&
        !e.includes("Unauthorized") &&
        !e.includes("404") &&
        !e.includes("Not Found")
    );
    expect(critical).toEqual([]);
  });
});

test.describe("negative cases", () => {
  test("wrong password shows error", async ({ page }) => {
    await page.goto(`${STAGING}/vi/login`, { waitUntil: "networkidle", timeout: 30_000 });
    await page.locator('input[type="email"]').fill("nonexistent@kotobawork.test");
    await page.locator('input[type="password"]').first().fill("WrongPassword123!");
    await page.getByRole("button", { name: /đăng nhập|sign in|login/i }).click();

    // Should show error message, not navigate away
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "test-results/staging-auth/wrong-password.png", fullPage: true });

    const bodyText = await page.locator("body").innerText();
    const hasError =
      bodyText.includes("sai") ||
      bodyText.includes("incorrect") ||
      bodyText.includes("invalid") ||
      bodyText.includes("lỗi") ||
      bodyText.includes("error") ||
      bodyText.includes("không đúng");
    expect(hasError, "Should display login error message").toBeTruthy();
  });
});

test.describe("mobile viewport", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("login page renders correctly on mobile", async ({ page }) => {
    await page.goto(`${STAGING}/vi/login`, { waitUntil: "networkidle", timeout: 30_000 });
    await page.screenshot({ path: "test-results/staging-auth/mobile-login.png", fullPage: true });

    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /đăng nhập|sign in|login/i })).toBeVisible();
  });

  test("register page renders correctly on mobile", async ({ page }) => {
    await page.goto(`${STAGING}/vi/register`, { waitUntil: "networkidle", timeout: 30_000 });
    await page.screenshot({ path: "test-results/staging-auth/mobile-register.png", fullPage: true });

    await expect(page.locator('input[type="email"]')).toBeVisible();
  });
});