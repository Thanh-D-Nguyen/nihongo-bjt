// @vitest-environment jsdom

import React from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const { act } = React;
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

vi.mock("next/navigation", () => ({ usePathname: () => window.location.pathname }));

import { AnnouncementStrip } from "./announcement-strip";

const announcement = {
  id: "promo-1",
  type: "promo",
  format: "modal",
  message: "Promotion",
  titleVi: "Promotion title",
  bodyVi: "Promotion body",
  allowCloseButton: true
};
const secondAnnouncement = { ...announcement, id: "promo-2", titleVi: "Second promotion" };

async function renderStrip(path: string, data = [announcement]) {
  window.history.replaceState({}, "", path);
  document.documentElement.lang = path.split("/")[1] || "vi";
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => data
    })
  );
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<AnnouncementStrip />);
    await Promise.resolve();
    await Promise.resolve();
  });
  return { container, root };
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("AnnouncementStrip learner modal placement", () => {
  it("does not cover Cardgen actions with a modal announcement", async () => {
    const { root } = await renderStrip("/vi/cardgen");
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    await act(async () => root.unmount());
  });

  it("shows the legacy announcement message in Vietnamese", async () => {
    const legacy = { ...announcement, type: "info", format: "banner", titleVi: "", message: "Thông báo tiếng Việt" };
    const { container, root } = await renderStrip("/vi/magazine/loto", [legacy]);
    expect(container.querySelector('[role="status"]')?.textContent).toContain("Thông báo tiếng Việt");
    await act(async () => root.unmount());
  });

  it("uses an English CMS title instead of the legacy Vietnamese message", async () => {
    const localized = {
      ...announcement,
      type: "info",
      format: "banner",
      message: "Thông báo tiếng Việt",
      titleEn: "English announcement"
    };
    const { container, root } = await renderStrip("/en/magazine/loto", [localized]);
    const text = container.querySelector('[role="status"]')?.textContent ?? "";
    expect(text).toContain("English announcement");
    expect(text).not.toContain("Thông báo tiếng Việt");
    await act(async () => root.unmount());
  });

  it("hides a Japanese announcement when only its English translation exists", async () => {
    const englishOnly = {
      ...announcement,
      type: "info",
      format: "banner",
      message: "Thông báo tiếng Việt",
      titleEn: "English announcement"
    };
    const { container, root } = await renderStrip("/ja/magazine/loto", [englishOnly]);
    expect(container.querySelector('[role="status"]')).toBeNull();
    await act(async () => root.unmount());
  });

  it("shows at most one modal on the home route after dismissal", async () => {
    const { root } = await renderStrip("/vi", [announcement, secondAnnouncement]);
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    const dismissButton = [...document.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Để sau")
    );
    expect(dismissButton).toBeDefined();
    await act(async () => dismissButton?.click());
    await act(async () => new Promise((resolve) => setTimeout(resolve, 350)));
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    await act(async () => root.unmount());
  });
});
