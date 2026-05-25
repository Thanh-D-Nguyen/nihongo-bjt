import { beforeEach, describe, expect, it, vi } from "vitest";

import { MagazineGenerationService } from "./magazine-generation.service.js";
import type { MagazineRepository } from "./magazine.repository.js";
import type { AiContentProvider } from "./providers/ai-content.provider.js";
import type { JmaWeatherProvider } from "./providers/jma-weather.provider.js";
import type { LotoDataProvider } from "./providers/loto-data.provider.js";

function mockRepo(): MagazineRepository {
  return {
    list: vi.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 10 }),
    getToday: vi.fn().mockResolvedValue([]),
    getBySlug: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: "test-uuid-123" }),
    markRead: vi.fn().mockResolvedValue({ ok: true }),
    delete: vi.fn().mockResolvedValue(undefined),
    existsForDate: vi.fn().mockResolvedValue(false),
  } as unknown as MagazineRepository;
}

function mockAi(): AiContentProvider {
  return {
    generate: vi.fn().mockResolvedValue({
      titleJp: "テスト記事",
      titleVi: "Bài viết test",
      summaryJp: "テストの要約",
      summaryVi: "Tóm tắt test",
      contentJson: { theme: "test" },
      vocabItems: [
        { wordJp: "試験", reading: "しけん", meaningVi: "Bài thi", pos: "名詞", jlptLevel: "N3", sentenceJp: "試験は来週です。", sentenceVi: "Bài thi tuần sau.", displayOrder: 1 },
      ],
      quizzes: [
        { questionJp: "「試験」の読み方は？", questionVi: "Cách đọc「試験」?", quizType: "reading", options: ["しけん", "しかん", "じけん", "じかん"], correctAnswer: "しけん", explanationJp: "試験（しけん）", explanationVi: "試験 (shiken)", displayOrder: 1 },
      ],
      jlptLevel: "N3",
      tokensUsed: 150,
    }),
  } as unknown as AiContentProvider;
}

function mockWeather(): JmaWeatherProvider {
  return {
    fetchTokyo: vi.fn().mockResolvedValue({ temp: 25, condition: "晴れ" }),
  } as unknown as JmaWeatherProvider;
}

function mockLoto(): LotoDataProvider {
  return {
    getHistoricalData: vi.fn().mockResolvedValue({ lastDraw: [1, 5, 12, 23, 30, 42] }),
  } as unknown as LotoDataProvider;
}

describe("MagazineGenerationService", () => {
  let service: MagazineGenerationService;
  let repo: MagazineRepository;
  let ai: AiContentProvider;
  let weather: JmaWeatherProvider;
  let loto: LotoDataProvider;

  beforeEach(() => {
    repo = mockRepo();
    ai = mockAi();
    weather = mockWeather();
    loto = mockLoto();
    service = new MagazineGenerationService(repo, ai, weather, loto);
  });

  describe("generateForDate", () => {
    it("skips generation if article already exists (idempotent)", async () => {
      (repo.existsForDate as ReturnType<typeof vi.fn>).mockResolvedValue(true);

      const result = await service.generateForDate("magazine_vocab", new Date("2026-05-25"));

      expect(result).toBeNull();
      expect(ai.generate).not.toHaveBeenCalled();
      expect(repo.create).not.toHaveBeenCalled();
    });

    it("generates and saves article when none exists", async () => {
      const date = new Date("2026-05-25");

      const result = await service.generateForDate("magazine_vocab", date, "vi");

      expect(result).toBe("test-uuid-123");
      expect(ai.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          widgetKind: "magazine_vocab",
          date,
          locale: "vi",
          realData: undefined,
        }),
      );
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: "2026-05-25-vocab-vi",
          widgetKind: "magazine_vocab",
          titleJp: "テスト記事",
          titleVi: "Bài viết test",
          status: "published",
        }),
      );
    });

    it("fetches weather data for magazine_weather kind", async () => {
      await service.generateForDate("magazine_weather", new Date("2026-05-25"));

      expect(weather.fetchTokyo).toHaveBeenCalled();
      expect(ai.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          realData: { temp: 25, condition: "晴れ" },
        }),
      );
    });

    it("fetches loto data for magazine_loto kind", async () => {
      await service.generateForDate("magazine_loto", new Date("2026-05-25"));

      expect(loto.getHistoricalData).toHaveBeenCalled();
      expect(ai.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          realData: { lastDraw: [1, 5, 12, 23, 30, 42] },
        }),
      );
    });

    it("builds correct slug from date and kind", async () => {
      await service.generateForDate("magazine_bjt_phrase", new Date("2026-01-15"), "ja");

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: "2026-01-15-bjt_phrase-ja",
        }),
      );
    });
  });

  describe("regenerate", () => {
    it("deletes existing then regenerates", async () => {
      (repo.getBySlug as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "old-id",
        widgetKind: "magazine_vocab",
        contentDate: new Date("2026-05-20"),
        locale: "vi",
      });

      const result = await service.regenerate("magazine_vocab", new Date("2026-05-20"), "vi");

      expect(repo.delete).toHaveBeenCalledWith("old-id");
      expect(result).toBe("test-uuid-123");
    });

    it("generates fresh when no existing article", async () => {
      (repo.getBySlug as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await service.regenerate("magazine_vocab", new Date("2026-05-20"), "vi");

      expect(repo.delete).not.toHaveBeenCalled();
      expect(result).toBe("test-uuid-123");
    });
  });
});
