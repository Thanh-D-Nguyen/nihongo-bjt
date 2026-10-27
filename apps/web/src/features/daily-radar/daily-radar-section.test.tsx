// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { DailyRadarSection } from "./daily-radar-section";
import type { DailyRadarLabels } from "./types";

const card = { id: "one", slug: "one", category: "work", titleVi: "Unique spotlight", titleJa: "", japaneseText: "日本語の例文", readingText: "にほんご", descriptionVi: "", ctaLabelVi: "Open", moduleType: "daily_widget", module: { moduleKey: "work", titleVi: "Work", disclaimerVi: "Notice" } };
vi.mock("./api", () => ({ fetchDailyRadarHome: async () => ({ cards: [card], spotlight: card, categories: ["work"] }) }));
vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));

it("shows a spotlight only once", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const labels = new Proxy({}, { get: () => "" }) as DailyRadarLabels;
  await act(async () => root.render(<DailyRadarSection labels={labels} locale="vi" />));
  expect(host.textContent?.split("Unique spotlight")).toHaveLength(2);
  await act(async () => root.unmount());
  host.remove();
});

it("uses a dark-aware disclaimer badge on the spotlight", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const labels = new Proxy({}, { get: () => "" }) as DailyRadarLabels;
  await act(async () => root.render(<DailyRadarSection labels={labels} locale="vi" />));
  expect(host.querySelector("a .text-amber-900")?.className).toContain("radar-badge");
  await act(async () => root.unmount());
  host.remove();
});

it("retains Japanese text and reading on a featured daily widget", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const labels = new Proxy({}, { get: () => "" }) as DailyRadarLabels;
  await act(async () => root.render(<DailyRadarSection labels={labels} locale="vi" />));
  const spotlight = host.querySelector("a");
  expect(spotlight?.textContent).toContain("日本語の例文");
  expect(spotlight?.textContent).toContain("にほんご");
  expect([...spotlight!.querySelectorAll("p")].find(p => p.textContent === "にほんご")?.className).toContain("bg-black/70");
  await act(async () => root.unmount());
  host.remove();
});
