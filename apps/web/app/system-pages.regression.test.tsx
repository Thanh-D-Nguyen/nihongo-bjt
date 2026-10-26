// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ useParams: () => ({ locale: "vi" }), usePathname: () => "/vi/missing" }));
import LocaleError from "./[locale]/error";
import NotFound from "./not-found";

async function render(element: React.ReactNode) {
 vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
 const host = document.createElement("div");
 document.body.appendChild(host);
 const root = createRoot(host);
 await act(async () => root.render(element));
 const html = host.innerHTML;
 await act(async () => root.unmount());
 host.remove();
 vi.unstubAllGlobals();
 return html;
}
describe("system pages", () => {
 it("shows a safe error reference with theme-aware recovery", async () => {
  const html = await render(<LocaleError error={Object.assign(new Error("private database detail"), { digest: "support-123" })} reset={() => {}} />);
  expect(html).toContain("support-123");
  expect(html).not.toContain("private database detail");
  expect(html).toContain("bg-paper");
 });
 it("provides navigation around the not-found state", async () => {
  const html = await render(<NotFound />);
  expect(html).toContain("<header");
  expect(html).toContain("<footer");
  expect(html).toContain('href="/vi"');
 });
});
