import { describe, expect, it, vi } from "vitest";

import { AiContentProvider } from "./ai-content.provider.js";

describe("AiContentProvider", () => {
  describe("generate (mock mode — no API key)", () => {
    it("returns valid mock content for magazine_vocab", async () => {
      // Ensure no API key → triggers mock mode
      delete process.env.OPENAI_API_KEY;

      const provider = new AiContentProvider();
      const result = await provider.generate({
        widgetKind: "magazine_vocab",
        date: new Date("2026-05-25"),
        locale: "vi",
      });

      expect(result.titleJp).toBeTruthy();
      expect(result.titleVi).toBeTruthy();
      expect(result.summaryJp).toBeTruthy();
      expect(result.summaryVi).toBeTruthy();
      expect(result.vocabItems.length).toBeGreaterThanOrEqual(1);
      expect(result.quizzes.length).toBeGreaterThanOrEqual(1);
      expect(result.jlptLevel).toMatch(/^N[1-5]$/);
      expect(result.tokensUsed).toBe(0);

      // Validate vocab item structure
      const vocab = result.vocabItems[0];
      expect(vocab.wordJp).toBeTruthy();
      expect(vocab.reading).toBeTruthy();
      expect(vocab.meaningVi).toBeTruthy();
      expect(vocab.displayOrder).toBeGreaterThanOrEqual(1);

      // Validate quiz structure
      const quiz = result.quizzes[0];
      expect(quiz.questionJp).toBeTruthy();
      expect(quiz.options.length).toBeGreaterThanOrEqual(3);
      expect(quiz.correctAnswer).toBeTruthy();
      expect(quiz.options).toContain(quiz.correctAnswer);
    });

    it("returns valid mock content for magazine_weather", async () => {
      delete process.env.OPENAI_API_KEY;

      const provider = new AiContentProvider();
      const result = await provider.generate({
        widgetKind: "magazine_weather",
        date: new Date("2026-05-25"),
        locale: "vi",
        realData: { temp: 28, condition: "曇り" },
      });

      expect(result.titleJp).toBeTruthy();
      expect(result.vocabItems.length).toBeGreaterThanOrEqual(1);
      expect(result.quizzes.length).toBeGreaterThanOrEqual(1);
    });

    it("falls back to vocab mock for unknown widget kind", async () => {
      delete process.env.OPENAI_API_KEY;

      const provider = new AiContentProvider();
      const result = await provider.generate({
        widgetKind: "unknown_kind",
        date: new Date("2026-05-25"),
        locale: "vi",
      });

      expect(result.titleJp).toBeTruthy();
      expect(result.vocabItems.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("generate (API mode — with key)", () => {
    it("calls OpenAI API when key is present", async () => {
      process.env.OPENAI_API_KEY = "test-key-123";

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    titleJp: "AI生成記事",
                    titleVi: "Bài viết AI",
                    summaryJp: "要約",
                    summaryVi: "Tóm tắt",
                    contentJson: {},
                    vocabItems: [{ wordJp: "天気", reading: "てんき", meaningVi: "Thời tiết", pos: "名詞", displayOrder: 1 }],
                    quizzes: [{ questionJp: "Q?", questionVi: "Q?", quizType: "reading", options: ["a", "b"], correctAnswer: "a", explanationJp: "E", explanationVi: "E", displayOrder: 1 }],
                    jlptLevel: "N3",
                  }),
                },
              },
            ],
            usage: { total_tokens: 200 },
          }),
      });

      const originalFetch = globalThis.fetch;
      globalThis.fetch = mockFetch;

      try {
        const provider = new AiContentProvider();
        const result = await provider.generate({
          widgetKind: "magazine_vocab",
          date: new Date("2026-05-25"),
          locale: "vi",
        });

        expect(mockFetch).toHaveBeenCalledWith(
          "https://api.openai.com/v1/chat/completions",
          expect.objectContaining({ method: "POST" }),
        );
        expect(result.titleJp).toBe("AI生成記事");
        expect(result.tokensUsed).toBe(200);
      } finally {
        globalThis.fetch = originalFetch;
        delete process.env.OPENAI_API_KEY;
      }
    });

    it("falls back to mock on API error", async () => {
      process.env.OPENAI_API_KEY = "test-key-123";

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: () => Promise.resolve("rate limited"),
      });

      const originalFetch = globalThis.fetch;
      globalThis.fetch = mockFetch;

      try {
        const provider = new AiContentProvider();
        const result = await provider.generate({
          widgetKind: "magazine_vocab",
          date: new Date("2026-05-25"),
          locale: "vi",
        });

        // Should gracefully fall back to mock
        expect(result.titleJp).toBeTruthy();
        expect(result.tokensUsed).toBe(0);
      } finally {
        globalThis.fetch = originalFetch;
        delete process.env.OPENAI_API_KEY;
      }
    });
  });
});
