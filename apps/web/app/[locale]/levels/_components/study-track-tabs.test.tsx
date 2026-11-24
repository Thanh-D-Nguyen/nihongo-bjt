// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { StudyTrackTabs, type StudyTrackKey } from "./study-track-tabs";

describe("StudyTrackTabs", () => {
  it("renders all 3 study track links with accurate active state across tracks and locales", () => {
    const cases: Array<{
      locale: "vi" | "en" | "ja";
      activeTrack: StudyTrackKey;
      expectedLabels: [string, string, string];
      expectedActiveHref: string;
    }> = [
      {
        locale: "vi",
        activeTrack: "levels",
        expectedLabels: ["Lộ trình BJT", "Tình huống công sở", "Đọc NHK"],
        expectedActiveHref: "/vi/levels"
      },
      {
        locale: "en",
        activeTrack: "scenarios",
        expectedLabels: ["BJT Roadmap", "Workplace Scenarios", "NHK Reading"],
        expectedActiveHref: "/en/scenarios"
      },
      {
        locale: "ja",
        activeTrack: "reading",
        expectedLabels: ["BJT学習パス", "職場シナリオ", "NHKニュース読解"],
        expectedActiveHref: "/ja/news"
      }
    ];

    for (const testCase of cases) {
      const html = renderToStaticMarkup(
        <StudyTrackTabs activeTrack={testCase.activeTrack} locale={testCase.locale} />
      );
      const doc = new DOMParser().parseFromString(html, "text/html");
      const links = [...doc.querySelectorAll("nav a")];

      expect(links.map((a) => a.getAttribute("href"))).toEqual([
        `/${testCase.locale}/levels`,
        `/${testCase.locale}/scenarios`,
        `/${testCase.locale}/news`
      ]);
      expect(links.map((a) => a.textContent?.trim())).toEqual(testCase.expectedLabels);

      const activeLinks = links.filter((a) => a.getAttribute("aria-current") === "page");
      expect(activeLinks).toHaveLength(1);
      expect(activeLinks[0]?.getAttribute("href")).toBe(testCase.expectedActiveHref);
    }
  });
});
