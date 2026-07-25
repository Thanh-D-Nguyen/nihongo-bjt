import { describe, expect, it, vi } from "vitest";

import type { KuromojiToken } from "./japanese-morphology.js";
import { DictionaryLookupService } from "./dictionary-lookup.service.js";

const token = (
  surface: string,
  basicForm: string,
  reading: string
): KuromojiToken => ({
  basic_form: basicForm,
  pos: "名詞",
  reading,
  surface_form: surface,
  word_id: 1
});

describe("DictionaryLookupService", () => {
  it("resolves a whole prompt with one lexeme query", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        headword: "確認",
        id: "lexeme-confirm",
        reading: "かくにん",
        senses: [{ meaningVi: "xác nhận" }],
        shortMeaningVi: null
      },
      {
        headword: "日程",
        id: "lexeme-schedule",
        reading: "にってい",
        senses: [],
        shortMeaningVi: "lịch trình"
      }
    ]);
    const service = new DictionaryLookupService();
    Object.defineProperty(service, "prisma", {
      value: { lexeme: { findMany } }
    });

    const result = await service.lookupForTokens([
      token("確認", "確認", "カクニン"),
      token("日程", "日程", "ニッテイ")
    ]);

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(result).toEqual([
      { lexemeId: "lexeme-confirm", shortMeaningVi: "xác nhận" },
      { lexemeId: "lexeme-schedule", shortMeaningVi: "lịch trình" }
    ]);
  });
});
