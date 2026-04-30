import { beforeEach, describe, expect, it, vi } from "vitest";

import type { KuromojiToken } from "./japanese-morphology.js";
import * as morphology from "./japanese-morphology.js";
import { ReadingAssistService } from "./reading-assist.service.js";

function buildService() {
  process.env.DATABASE_URL ||= "postgresql://test:test@localhost:5432/test";

  const analytics = { ingest: vi.fn().mockResolvedValue(undefined) };
  const dictionary = {
    lookupForToken: vi.fn().mockResolvedValue({
      lexemeId: "lexeme-1",
      shortMeaningVi: "xac nhan"
    })
  };
  const flashcards = { createCardFromReadingAssist: vi.fn() };
  const service = new ReadingAssistService(analytics as any, dictionary as any, flashcards as any);

  (service as any).prisma = {
    quizSession: { findFirst: vi.fn() },
    readingTextAnalysis: {
      findUnique: vi.fn(),
      upsert: vi.fn()
    }
  };

  return { analytics, dictionary, prisma: (service as any).prisma, service };
}

function tokenized(text: string) {
  const token = {
    basic_form: text,
    pos: "noun",
    reading: "カクニン",
    surface_form: text
  } as KuromojiToken;
  return {
    normalized: text,
    spans: [{ end: text.length, start: 0, token }]
  };
}

describe("ReadingAssistService integration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("hides meanings during active authoritative timed quiz session", async () => {
    const { prisma, service } = buildService();
    vi.spyOn(morphology, "tokenizeJapanese").mockResolvedValueOnce(tokenized("確認"));

    prisma.quizSession.findFirst.mockResolvedValueOnce({ status: "in_progress" });
    prisma.readingTextAnalysis.findUnique.mockResolvedValueOnce(null);

    const result = await service.analyze({
      quizSessionId: "11111111-1111-4111-8111-111111111111",
      text: "確認",
      userId: "22222222-2222-4222-8222-222222222222"
    });

    expect(result.cached).toBe(false);
    expect(result.tokens[0]).toMatchObject({
      meaningHidden: true,
      shortMeaningVi: null
    });
  });

  it("shows meanings after authoritative quiz session is completed", async () => {
    const { prisma, service } = buildService();
    vi.spyOn(morphology, "tokenizeJapanese").mockResolvedValueOnce(tokenized("確認"));

    prisma.quizSession.findFirst.mockResolvedValueOnce({ status: "completed" });
    prisma.readingTextAnalysis.findUnique.mockResolvedValueOnce(null);

    const result = await service.analyze({
      quizSessionId: "11111111-1111-4111-8111-111111111111",
      text: "確認",
      userId: "22222222-2222-4222-8222-222222222222"
    });

    expect(result.tokens[0]).toMatchObject({
      shortMeaningVi: "xac nhan"
    });
    expect(result.tokens[0].meaningHidden).toBeUndefined();
  });

  it("prevents warm-cache leakage while active quiz exists", async () => {
    const { prisma, service } = buildService();
    prisma.readingTextAnalysis.findUnique.mockResolvedValueOnce({
      resultJson: {
        tokens: [
          {
            basicForm: "確認",
            end: 2,
            index: 0,
            lexemeId: "lexeme-1",
            partOfSpeech: "noun",
            reading: "かくにん",
            shortMeaningVi: "xac nhan",
            start: 0,
            surface: "確認"
          }
        ],
        version: 1
      },
      tokenizerVersion: "kuromoji-0.1.2"
    });
    prisma.quizSession.findFirst.mockResolvedValueOnce({ id: "active-session" });

    const result = await service.analyze({
      text: "確認",
      userId: "22222222-2222-4222-8222-222222222222"
    });

    expect(result.cached).toBe(true);
    expect(result.tokens[0]).toMatchObject({
      meaningHidden: true,
      shortMeaningVi: null
    });
  });

  it("falls back safely when tokenizer fails", async () => {
    const { service } = buildService();
    vi.spyOn(morphology, "tokenizeJapanese").mockRejectedValueOnce(new Error("tokenizer_failed"));

    const result = await service.analyze({
      text: "  念のため確認させてください。  ",
      userId: "22222222-2222-4222-8222-222222222222"
    });

    expect(result.cached).toBe(false);
    expect(result.normalized).toBe("念のため確認させてください。");
    expect(result.tokens).toEqual([]);
  });
});
