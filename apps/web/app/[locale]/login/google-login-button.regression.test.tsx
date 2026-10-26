// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ router: { replace: vi.fn() }, reload: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
vi.mock("../../../lib/go-auth-provider", () => ({ useGoAuth: () => ({ reload: mocks.reload }) }));
it("shows the Google control loading until the provider renders it", async () => {
 vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
 vi.stubEnv("NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID", "test-client");
 vi.resetModules();
 const { GoogleLoginButton } = await import("./google-login-button");
 const host = document.createElement("div");
 document.body.appendChild(host);
 const root = createRoot(host);
 try {
  await act(async () => root.render(<GoogleLoginButton locale="vi" destination="/vi" label="Google sign-in" onError={() => {}} />));
  expect(host.querySelector('[aria-busy="true"]')).not.toBeNull();
  expect(host.querySelector("button:disabled")?.textContent).toContain("Google sign-in");
  const renderButton = vi.fn((target: HTMLElement) => { target.textContent = "Provider button"; });
  Object.defineProperty(window, "google", { configurable: true, value: { accounts: { id: { initialize: vi.fn(), renderButton } } } });
  await act(async () => { document.getElementById("google-identity-services")?.dispatchEvent(new Event("load")); });
  expect(renderButton).toHaveBeenCalledOnce();
  expect(host.querySelector('[aria-busy="false"]')).not.toBeNull();
  expect(host.querySelector("button:disabled")).toBeNull();
 } finally {
  await act(async () => root.unmount());
  host.remove();
  document.getElementById("google-identity-services")?.remove();
  Reflect.deleteProperty(window, "google");
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
 }
});
