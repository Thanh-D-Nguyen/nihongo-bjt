// @vitest-environment jsdom

import { act, isValidElement, type ReactElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import Link from "next/link";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../../messages/en.json";
import ja from "../../../messages/ja.json";
import vietnamese from "../../../messages/vi.json";

// The root Vitest alias targets the learner app; use the real Admin helper here.
vi.mock("@/lib/auth-error-message", async () => import("../../../lib/auth-error-message"));

import AdminLoginPage from "./page";
import { AdminLoginFormClient } from "./_components/admin-login-form-client";

function elements(node: ReactNode): ReactElement<{ children?: ReactNode }>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<{ children?: ReactNode }>(node)) return [];
  return [node, ...elements(node.props.children)];
}

async function page(locale = "vi", returnTo?: string | string[]) {
  return AdminLoginPage({
    params: Promise.resolve({ locale }),
    searchParams: Promise.resolve({ returnTo })
  });
}

async function render(locale = "vi", returnTo?: string | string[]) {
  const tree = await page(locale, returnTo);
  const form = elements(tree).find((element) => element.type === AdminLoginFormClient);
  expect(form).toBeDefined();
  await act(async () => root.render(form));
}

async function fill(name: string, value: string) {
  const input = container.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function submit(email = "admin@example.com", password = "test-password") {
  await fill("email", email);
  await fill("password", password);
  await act(async () => {
    container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

let container: HTMLDivElement;
let root: Root;
const fetchMock = vi.fn();
const assignMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("fetch", fetchMock);
  const browserWindow = window;
  vi.stubGlobal("window", new Proxy(browserWindow, {
    get: (target, property) => property === "location"
      ? { assign: assignMock }
      : Reflect.get(target, property, target)
  }));
  fetchMock.mockReset().mockResolvedValue(new Response("{}", { status: 200 }));
  assignMock.mockReset();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("AUTH-002 Admin login regression", () => {
  it("describes native authentication without obsolete identity-provider instructions", () => {
    for (const messages of [vietnamese, ja, en]) {
      expect(messages.auth.login.wrongCredentials).not.toMatch(/Keycloak/i);
    }
  });
  it.each([
    [undefined, "/admin/vi"],
    ["/vi", "/admin/vi"],
    ["/vi/content?tab=drafts#item", "/admin/vi/content?tab=drafts#item"],
    ["/admin/vi/content?tab=drafts#item", "/admin/vi/content?tab=drafts#item"],
    ["/admin/vi/content/100%25?next=https%3A%2F%2Fexample.com", "/admin/vi/content/100%25?next=https%3A%2F%2Fexample.com"],
    ["/admin/ja/content", "/admin/ja/content"]
  ])("keeps successful login inside Admin: %s → %s", async (returnTo, destination) => {
    await render("vi", returnTo);
    await submit();
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/login", expect.objectContaining({
      method: "POST", credentials: "include",
      body: JSON.stringify({ email: "admin@example.com", password: "test-password" })
    }));
    expect(assignMock).toHaveBeenCalledWith(destination);
  });

  it("falls back safely for repeated returnTo query parameters", async () => {
    await render("vi", ["/vi", "//evil.example"]);
    await submit();
    expect(assignMock).toHaveBeenCalledWith("/admin/vi");
  });

  it("ignores repeated authError query parameters safely", async () => {
    const tree = await AdminLoginPage({
      params: Promise.resolve({ locale: "vi" }),
      searchParams: Promise.resolve({ authError: ["access_denied", "unavailable"] })
    });
    expect(elements(tree).some((element) => (element.props as { role?: string }).role === "alert")).toBe(false);
  });

  it.each([
    "https://evil.example/path", "//evil.example/path", "/\\evil.example/path",
    "/admin/vi\\..\\..\\evil", "/admin/vi/../en", "/admin/vi/%2e%2e/en",
    "/admin/vi/%252e%252e/en", "/admin/vi/%2e%2e%2f%2e%2e%2fvi",
    "/admin/vi/%5c..%5c..%5cevil", "/%2f%2fevil.example", "/admin/vi/%ZZ",
    "/admin/vi/%0a/evil", "/admin/vi/./content", "/admin/vi/.. ", "/admin/vi-evil/content", "/learn"
  ])("rejects unsafe or non-Admin returnTo %s", async (returnTo) => {
    await render("vi", returnTo);
    await submit();
    expect(assignMock).toHaveBeenCalledWith("/admin/vi");
  });

  it.each([["vi", vietnamese], ["ja", ja], ["en", en]] as const)(
    "uses %s validation copy before sending empty credentials", async (locale, messages) => {
      await render(locale);
      await submit("", "");
      expect(container.querySelector('[role="alert"]')?.textContent).toBe(messages.auth.login.validationError);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(assignMock).not.toHaveBeenCalled();
    }
  );

  it.each([["", "test-password"], ["   ", "test-password"], ["admin@example.com", ""]])(
    "rejects incomplete credentials (%s)", async (email, password) => {
      await render();
      await submit(email, password);
      expect(container.querySelector('[role="alert"]')?.textContent).toBe(vietnamese.auth.login.validationError);
      expect(fetchMock).not.toHaveBeenCalled();
    }
  );

  it.each([["vi", vietnamese], ["ja", ja], ["en", en]] as const)(
    "maps Go invalid credentials to %s localized copy", async (locale, messages) => {
      fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "invalid credentials" }), { status: 401 }));
      await render(locale);
      await submit();
      expect(container.querySelector('[role="alert"]')?.textContent).toBe(messages.auth.login.wrongCredentials);
      expect(assignMock).not.toHaveBeenCalled();
    }
  );

  it("keeps unknown backend errors generic", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "internal_backend_code" }), { status: 500 }));
    await render();
    await submit();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(vietnamese.auth.errors.generic);
    expect(assignMock).not.toHaveBeenCalled();
  });

  it("gives each locale Link a unique React key", async () => {
    const links = elements(await page()).filter((element) => element.type === Link);
    expect(links).toHaveLength(3);
    expect(links.map((link) => link.key)).toEqual(["vi", "ja", "en"]);
  });
});
