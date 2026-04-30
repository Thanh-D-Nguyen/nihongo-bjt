import { describe, expect, it, vi } from "vitest";

import { DailyRepository } from "./daily.repository.js";

process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:15432/nihongo_bjt";

describe("DailyRepository learning safeguard", () => {
  it("adds life-in-Japan safeguard metadata for sensitive widget kinds", async () => {
    const repository = new DailyRepository();
    (repository as any).prisma = {
      analyticsEvent: { create: vi.fn().mockResolvedValue(undefined) },
      dailyContentItem: {
        findMany: vi.fn().mockResolvedValue([
          {
            contentDate: new Date("2026-04-01T00:00:00.000Z"),
            explanationText: "Giải thích",
            extraction: {
              extractedEntries: {
                learningObjective: "Hiểu từ vựng thuê nhà an toàn",
                remediationLinks: [{ href: "https://example.jp/housing", label: "Housing handbook" }],
                sourceDate: "2026-03-20",
                sourceTitle: "Tokyo Housing Portal",
                sourceUrl: "https://example.jp/source"
              }
            },
            id: "item-1",
            japaneseText: "賃貸契約",
            locale: "vi",
            readingText: "ちんたいけいやく",
            status: "published",
            title: "Thuê nhà",
            widgetKind: "life_housing"
          }
        ])
      },
      dailyWidgetConfig: {
        findMany: vi.fn().mockResolvedValue([{ displayOrder: 1, enabled: true, id: "cfg-1", widgetKind: "life_housing" }])
      },
      userFlashcard: { count: vi.fn().mockResolvedValue(0) }
    };

    const result = await repository.home("vi", "11111111-1111-4111-8111-111111111111");
    const item = result.widgets[0]?.item as any;

    expect(item?.learningSafeguard?.learningObjective).toContain("thuê nhà");
    expect(item?.learningSafeguard?.riskDisclaimer).toContain("không phải tư vấn");
    expect(item?.learningSafeguard?.remediationLinks).toHaveLength(1);
  });

  it("does not attach safeguard for normal daily widgets", async () => {
    const repository = new DailyRepository();
    (repository as any).prisma = {
      dailyContentItem: {
        findMany: vi.fn().mockResolvedValue([
          {
            contentDate: new Date("2026-04-01T00:00:00.000Z"),
            explanationText: "",
            extraction: { extractedEntries: {} },
            id: "item-2",
            japaneseText: "今日は晴れです",
            locale: "ja",
            readingText: "きょうははれです",
            status: "published",
            title: "天気",
            widgetKind: "weather"
          }
        ])
      },
      dailyWidgetConfig: {
        findMany: vi.fn().mockResolvedValue([{ displayOrder: 1, enabled: true, id: "cfg-2", widgetKind: "weather" }])
      },
      userFlashcard: { count: vi.fn().mockResolvedValue(0) }
    };

    const result = await repository.home("ja");
    const item = result.widgets[0]?.item as any;

    expect(item?.learningSafeguard).toBeUndefined();
  });
});
