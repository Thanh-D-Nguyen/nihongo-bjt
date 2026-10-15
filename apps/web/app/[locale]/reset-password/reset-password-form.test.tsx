// @vitest-environment jsdom

import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResetPasswordFormClient } from "./_components/reset-password-form-client";

const copy = {
  backToLogin: "Back to login",
  confirmPasswordLabel: "Confirm password",
  genericError: "Could not reset the password. Try again.",
  invalidToken: "This reset link is invalid or expired.",
  languageLabel: "Language",
  mismatch: "Passwords do not match.",
  passwordHint: "Use at least 8 characters.",
  passwordLabel: "New password",
  passwordTooLong: "Password is too long.",
  preparing: "Preparing reset form…",
  primaryCta: "Set new password",
  submitting: "Saving…",
  successMessage: "Your password has been changed. Sign in with the new password.",
};

let root: Root;
let container: HTMLDivElement;
const fetchMock = vi.fn();

async function render(token: string | null = "opaque-reset-token") {
	await act(async () => root.render(null));
	await act(async () => root.render(<StrictMode><ResetPasswordFormClient copy={copy} localePrefix="/vi" token={token} /></StrictMode>));
}

async function fill(selector: string, value: string) {
  const input = container.querySelector<HTMLInputElement>(selector)!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function submit() {
  await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("reset password form", () => {
  it("requires a new password and confirmation", async () => {
    await render();
    const password = container.querySelector<HTMLInputElement>("#new-password")!;
    expect(password.required).toBe(true);
    expect(password.minLength).toBe(8);
    expect(container.querySelector<HTMLInputElement>("#confirm-password")?.required).toBe(true);
    expect(container.querySelector<HTMLAnchorElement>('a[lang="ja"]')?.getAttribute("href")).toBe("/ja/reset-password#token=opaque-reset-token");
  });

  it("posts a confirmed password with the emailed token and shows success", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    window.history.replaceState(window.history.state, "", "/vi/reset-password#token=opaque-reset-token");
    await render(null);
    expect(window.location.hash).toBe("");
    expect(window.location.search).toBe("");
    await fill("#new-password", "updated-password-123");
    await fill("#confirm-password", "updated-password-123");
    await submit();
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/reset-password", expect.objectContaining({
      credentials: "same-origin", headers: { "content-type": "application/json" }, method: "POST",
      body: expect.any(String),
    }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({ token: "opaque-reset-token", password: "updated-password-123" });
    expect(container.textContent).toContain(copy.successMessage);
  });

  it("consumes a reset link opened in an already-mounted reset screen", async () => {
    window.history.replaceState(window.history.state, "", "/vi/reset-password");
    await render(null);
    expect(container.querySelector("[role=alert]")?.textContent).toBe(copy.invalidToken);

    await act(async () => {
      window.history.replaceState(window.history.state, "", "/vi/reset-password#token=opaque-reset-token");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });

    expect(window.location.hash).toBe("");
    expect(container.querySelector("#new-password")).not.toBeNull();

    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await fill("#new-password", "updated-password-123");
    await fill("#confirm-password", "updated-password-123");
    await submit();
    expect(container.textContent).toContain(copy.successMessage);

    await act(async () => {
      window.history.replaceState(window.history.state, "", "/vi/reset-password#token=opaque-reset-token");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(window.location.hash).toBe("");
    expect(container.querySelector("#new-password")).not.toBeNull();
  });

  it("keeps the active reset token when an unrelated in-page hash changes", async () => {
    window.history.replaceState(window.history.state, "", "/vi/reset-password#token=opaque-reset-token");
    await render(null);
    expect(window.location.hash).toBe("");
    expect(container.querySelector("#new-password")).not.toBeNull();

    await act(async () => {
      window.history.replaceState(window.history.state, "", "/vi/reset-password#main");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });

    expect(container.querySelector("#new-password")).not.toBeNull();
    expect(container.querySelector("[role=alert]")).toBeNull();
  });

  it("ignores a reset response after the active token changes", async () => {
    let resolveResponse!: (response: Response) => void;
    fetchMock.mockReturnValue(new Promise<Response>((resolve) => { resolveResponse = resolve; }));
    window.history.replaceState(window.history.state, "", "/vi/reset-password#token=first-token");
    await render(null);
    await fill("#new-password", "updated-password-123");
    await fill("#confirm-password", "updated-password-123");
    await submit();

    await act(async () => {
      window.history.replaceState(window.history.state, "", "/vi/reset-password#token=second-token");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    await act(async () => resolveResponse(new Response(JSON.stringify({ ok: true }), { status: 200 })));

    expect(container.querySelector("#new-password")).not.toBeNull();
    expect(container.textContent).not.toContain(copy.successMessage);
    await fill("#new-password", "second-password-123");
    expect(container.querySelector<HTMLButtonElement>("button[type=submit]")?.disabled).toBe(false);
  });

  it("blocks mismatched passwords and missing reset links", async () => {
    await render();
    await fill("#new-password", "updated-password-123");
    await fill("#confirm-password", "different-password-123");
    await submit();
    expect(container.textContent).toContain(copy.mismatch);
    expect(fetchMock).not.toHaveBeenCalled();
    await render(null);
    expect(container.textContent).toContain(copy.invalidToken);
    expect(container.querySelector("form")).toBeNull();
  });

  it("blocks passwords exceeding the backend UTF-8 byte limit", async () => {
    await render();
    const oversizedPassword = "日".repeat(342);
    await fill("#new-password", oversizedPassword);
    await fill("#confirm-password", oversizedPassword);
    await submit();
    expect(container.textContent).toContain(copy.passwordTooLong);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
