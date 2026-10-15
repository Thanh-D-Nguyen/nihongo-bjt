// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ForgotPasswordFormClient } from "./_components/forgot-password-form-client";

const copy = {
  backToLogin: "Back to login",
  emailLabel: "Email",
  emailPlaceholder: "name@example.com",
  genericError: "Could not send the reset link. Try again.",
  primaryCta: "Send reset link",
  submitting: "Sending…",
  successMessage: "If an account exists, a reset link will be sent.",
  subtitle: "Enter your account email.",
  validationError: "Enter a valid email address."
};

let root: Root;
let container: HTMLDivElement;
const fetchMock = vi.fn();

async function render(localePrefix = "/vi") {
  await act(async () => root.render(<ForgotPasswordFormClient copy={copy} localePrefix={localePrefix} />));
}

async function fillEmail(value: string) {
  const input = container.querySelector<HTMLInputElement>("#forgot-email")!;
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

describe("forgot password form", () => {
  it("renders a required email field and leaves empty submission to native validation", async () => {
    await render();
    const input = container.querySelector<HTMLInputElement>("#forgot-email")!;
    expect(input.type).toBe("email");
    expect(input.required).toBe(true);
    expect(container.querySelector("form")!.noValidate).toBe(false);
  });

  it("posts the email through the real form handler and shows the generic success copy", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await render();
    await fillEmail("learner@example.com");
    await submit();
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/forgot-password", expect.objectContaining({
      credentials: "same-origin", method: "POST", body: JSON.stringify({ email: "learner@example.com", locale: "vi" })
    }));
    expect(container.textContent).toContain(copy.successMessage);
  });

  it("sends the active page locale with the recovery request", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await render("/ja");
    await fillEmail("learner@example.com");
    await submit();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({ email: "learner@example.com", locale: "ja" });
  });

  it("shows a localized generic error when delivery is unavailable", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "service unavailable" }), { status: 503 }));
    await render();
    await fillEmail("learner@example.com");
    await submit();
    expect(container.textContent).toContain(copy.genericError);
    expect(container.textContent).not.toContain("service unavailable");
    expect(container.querySelector("button")?.disabled).toBe(false);
  });
});
