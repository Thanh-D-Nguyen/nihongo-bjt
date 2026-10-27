// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DailyRadarSection } from "../src/features/daily-radar/daily-radar-section";
import type { DailyRadarLabels } from "../src/features/daily-radar/types";
import { BattleConfigsPanel } from "./[locale]/battle/_components/battle-configs-panel";
import type { BattlePageLabels } from "./[locale]/battle/_components/battle-types";

vi.mock("../src/features/daily-radar/api", () => ({ fetchDailyRadarHome: vi.fn(async () => ({
  cards: [1, 2, 3].map((id) => ({ id: String(id), category: "work", moduleType: "normal", module: { moduleKey: "work", titleVi: "Work" }, titleVi: "Card", descriptionVi: "Description", slug: String(id) })),
  categories: ["work"], spotlight: null
})) }));

const locales = [
  ["vi", "Cuộn sang trái", "Cuộn sang phải"],
  ["ja", "左へスクロール", "右へスクロール"],
  ["en", "Scroll left", "Scroll right"]
] as const;

describe("localized scroll controls", () => {
  let root: ReturnType<typeof createRoot>;
  afterEach(async () => { if (root) await act(() => root.unmount()); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("names and scrolls Daily Radar buttons in each locale", async () => {
    const container = document.createElement("div");
    const scrollBy = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollBy", { configurable: true, value: scrollBy });
    root = createRoot(container);
    for (const [locale, left, right] of locales) {
      await act(async () => root.render(<DailyRadarSection locale={locale} labels={{ heading: "Radar", showMore: "{n}" } as DailyRadarLabels} />));
      const leftButton = container.querySelector<HTMLButtonElement>(`button[aria-label="${left}"]`);
      const rightButton = container.querySelector<HTMLButtonElement>(`button[aria-label="${right}"]`);
      expect(leftButton, `${locale} left accessible name`).not.toBeNull();
      expect(rightButton, `${locale} right accessible name`).not.toBeNull();
      await act(() => { leftButton!.click(); rightButton!.click(); });
      expect(scrollBy).toHaveBeenCalledWith({ behavior: "smooth", left: -340 });
      expect(scrollBy).toHaveBeenCalledWith({ behavior: "smooth", left: 340 });
    }
  });

  it("names and scrolls Battle buttons in each locale", async () => {
    const container = document.createElement("div");
    const scrollBy = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollBy", { configurable: true, value: scrollBy });
    vi.spyOn(HTMLElement.prototype, "scrollLeft", "get").mockReturnValue(100);
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(1000);
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(200);
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => [{ id: "1", name: "Battle", level: "N3", gameType: "custom", questionPoolKey: "bjt_questions_active", questionCount: 5, timePerQuestionSec: 10, maxParticipants: 2, isActive: true, isUpcoming: false }] })));
    root = createRoot(container);
    for (const [locale, left, right] of locales) {
      await act(async () => root.render(<BattleConfigsPanel locale={locale} labels={{} as BattlePageLabels} onSelectConfig={() => {}} selectedConfigId={null} />));
      const leftButton = container.querySelector<HTMLButtonElement>(`button[aria-label="${left}"]`);
      const rightButton = container.querySelector<HTMLButtonElement>(`button[aria-label="${right}"]`);
      expect(leftButton, `${locale} left accessible name`).not.toBeNull();
      expect(rightButton, `${locale} right accessible name`).not.toBeNull();
      expect(leftButton!.disabled).toBe(false);
      expect(rightButton!.disabled).toBe(false);
      await act(() => { leftButton!.click(); rightButton!.click(); });
      expect(scrollBy).toHaveBeenCalledWith({ behavior: "smooth", left: -140 });
      expect(scrollBy).toHaveBeenCalledWith({ behavior: "smooth", left: 140 });
    }
  });
});
