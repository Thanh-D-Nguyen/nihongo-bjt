// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../../messages/en.json";
import ja from "../../../messages/ja.json";
import vietnamese from "../../../messages/vi.json";

const mocks = vi.hoisted(() => ({ locale: "vi", replace: vi.fn(), reload: vi.fn() }));
vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: mocks.locale }),
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => new URLSearchParams("returnTo=/vi/learn")
}));
vi.mock("../../../lib/go-auth-provider", () => ({
  useGoAuth: () => ({ reload: mocks.reload })
}));
vi.mock("./google-login-button", () => ({
  googleLoginEnabled: true,
  GoogleLoginButton: () => <div data-testid="google-login-button" />
}));

import LoginPage, { getSafeLoginReturnTo } from "./page";
import RegisterPage from "../register/page";

let container: HTMLDivElement;
let root: Root;
const fetchMock = vi.fn();
const password = "test-password-123";

async function render(Page: typeof LoginPage) {
  await act(async () => root.render(<Page />));
}

async function fill(id: string, value: string) {
  const input = container.querySelector<HTMLInputElement>(`#${id}`);
  expect(input, `Expected field #${id}`).not.toBeNull();
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input!.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function fillCredentials(register = false) {
  if (register) await fill("displayName", " Learner ");
  await fill("email", "learner@example.com");
  await fill("password", password);
  // Leave this optional so other regressions can execute against the original page.
  if (register && container.querySelector("#confirmPassword")) {
    await fill("confirmPassword", password);
  }
}

async function submit() {
  await act(async () => {
    container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

function response(status: number, error = "internal_backend_code") {
  return new Response(JSON.stringify({ error }), { status });
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  mocks.replace.mockReset();
  mocks.reload.mockReset().mockResolvedValue(undefined);
  mocks.locale = "vi";
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("learner auth pages regression", () => {
  it.each([
    ["/vi/learn?tab=due#list", "/vi/learn?tab=due#list"],
    ["https://attacker.example/", "/vi"],
    ["//attacker.example/", "/vi"],
    ["/en/admin", "/vi"]
  ])("keeps login returnTo inside the current locale (%s)", (value, expected) => {
    expect(getSafeLoginReturnTo(value, "vi", "http://localhost:3000")).toBe(expected);
  });

  it.each([["vi", vietnamese], ["en", en], ["ja", ja]] as const)(
    "renders %s message copy and native email/password fields",
    async (locale, messages) => {
      mocks.locale = locale;
      await render(LoginPage);
      expect(container.querySelector("h1")?.textContent).toBe(messages.auth.login.title);
      expect(container.querySelector('label[for="email"]')?.textContent?.trim()).toBe(messages.auth.register.emailLabel);
      expect(container.querySelector('input[type="email"]')).not.toBeNull();
      expect(container.querySelector("button")?.textContent?.trim()).toBe(messages.auth.login.primaryCta);
      expect(container.querySelector('[role="separator"]')?.getAttribute("aria-label")).toBe(messages.auth.login.divider);
      expect(container.querySelector('[data-testid="google-login-button"]')).not.toBeNull();
      await render(RegisterPage);
      expect(container.querySelector("h1")?.textContent).toBe(messages.auth.register.title);
      expect(container.querySelector('label[for="displayName"]')?.textContent?.trim()).toBe(messages.accountInfo.displayName);
      expect(container.querySelector('label[for="confirmPassword"]')?.textContent?.trim()).toBe(messages.auth.register.confirmPasswordLabel);
      expect(container.querySelector("#confirmPassword")?.getAttribute("autocomplete")).toBe("new-password");
    }
  );

  it("shows Google sign-in separately from password", async () => {
    await render(LoginPage);

    expect(container.querySelector('[role="separator"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="google-login-button"]')).not.toBeNull();
  });

  it("rejects mismatched confirmation locally with Vietnamese copy", async () => {
    await render(RegisterPage);
    await fillCredentials(true);
    await fill("confirmPassword", "different-password");
    await submit();
    expect(container.textContent).toContain(vietnamese.auth.register.passwordsMismatch);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a short registration password locally with Vietnamese copy", async () => {
    await render(RegisterPage);
    await fillCredentials(true);
    await fill("password", "short");
    await submit();
    expect(container.textContent).toContain(vietnamese.auth.register.passwordTooShort);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["login", 401, vietnamese.auth.login.wrongCredentials],
    ["login", 500, vietnamese.auth.login.errorLoginFailed],
    ["register", 409, vietnamese.auth.register.userExists],
    ["register", 500, vietnamese.auth.register.registrationFailed]
  ] as const)("localizes %s HTTP %s errors without exposing backend codes", async (page, status, copy) => {
    const register = page === "register";
    fetchMock.mockResolvedValue(response(status));
    await render(register ? RegisterPage : LoginPage);
    await fillCredentials(register);
    await submit();
    expect(container.textContent).toContain(copy);
    expect(container.textContent).not.toContain("internal_backend_code");
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it.each([false, true])("refreshes learner auth before navigating after success (register=%s)", async (register) => {
    let finishReload!: () => void;
    mocks.reload.mockImplementation(() => new Promise<void>((resolve) => { finishReload = resolve; }));
    fetchMock.mockResolvedValue(response(200));
    await render(register ? RegisterPage : LoginPage);
    await fillCredentials(register);
    await submit();
    expect(mocks.reload).toHaveBeenCalledOnce();
    expect(mocks.replace).not.toHaveBeenCalled();
    await act(async () => finishReload());
    expect(mocks.replace).toHaveBeenCalledWith(register ? "/vi" : "/vi/learn");
    expect(fetchMock).toHaveBeenLastCalledWith("/api/auth/login", expect.objectContaining({
      credentials: "same-origin", method: "POST",
      body: JSON.stringify({ email: "learner@example.com", password })
    }));
    if (register) {
      expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/auth/register", expect.objectContaining({
        body: JSON.stringify({ email: "learner@example.com", password, displayName: "Learner" })
      }));
    }
  });

  it("preserves the login redirect when registration succeeds but auto-login fails", async () => {
    fetchMock.mockResolvedValueOnce(response(201)).mockResolvedValueOnce(response(401));
    await render(RegisterPage);
    await fillCredentials(true);
    await submit();
    expect(mocks.reload).not.toHaveBeenCalled();
    expect(mocks.replace).toHaveBeenCalledWith("/vi/login");
  });
});
