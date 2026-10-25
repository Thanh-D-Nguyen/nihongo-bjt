import { expect, test, type Page } from "@playwright/test";

async function mockGoogleSignIn(page: Page) {
  await page.addInitScript(() => {
    const login = {
      callback: (_: { credential: string }) => undefined,
      initialize(options: { callback: (response: { credential: string }) => void }) { this.callback = options.callback; },
      renderButton(element: HTMLElement) {
        const button = document.createElement("button");
        button.textContent = "Continue with Google";
        button.addEventListener("click", () => this.callback({ credential: "test-google-id-token" }));
        element.appendChild(button);
      }
    };
    Object.assign(window, { google: { accounts: { id: login } } });
  });

  let receivedToken: string | null = null;
  await page.route("**/api/auth/google", async (route) => {
    receivedToken = route.request().postDataJSON().idToken;
    await route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}', headers: { "Set-Cookie": "bjt_web_session=test-session; HttpOnly; Path=/; SameSite=Lax" } });
  });
  await page.route("**/api/auth/me", (route) => route.fulfill({ status: 200, contentType: "application/json", body: '{"id":"fake-user","displayName":"Learner","email":"test@example.com","status":"active"}' }));

  return () => receivedToken;
}

test("Google sign-in sends an ID token and preserves a non-default safe return URL", async ({ page }) => {
  const receivedToken = await mockGoogleSignIn(page);
  await page.goto("/vi/login?returnTo=%2Fvi%2Fhelp");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(page).toHaveURL(/\/vi\/help$/);
  expect(receivedToken()).toBe("test-google-id-token");
});

test("Google sign-in rejects cross-origin and wrong-locale return URLs", async ({ page }) => {
  await mockGoogleSignIn(page);
  for (const returnTo of ["https://malicious.example/vi/daily", "/ja/daily"]) {
    await page.goto(`/vi/login?returnTo=${encodeURIComponent(returnTo)}`);
    await page.getByRole("button", { name: "Continue with Google" }).click();
    await expect(page).toHaveURL(/\/vi\/?$/);
  }
});

test("Google sign-in is available on the registration page", async ({ page }) => {
  const receivedToken = await mockGoogleSignIn(page);
  await page.goto("/vi/register");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(page).toHaveURL(/\/vi\/?$/);
  expect(receivedToken()).toBe("test-google-id-token");
});
