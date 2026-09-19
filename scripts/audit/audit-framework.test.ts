import { describe, expect, it } from "vitest";

import {
  AUDIT_RUBRIC_VERSION,
  cjkRatio,
  looksVietnamese,
  normalizeForNearDuplicate,
} from "./bjt-audit-types.js";
import {
  SEMANTIC_JUDGE_RUBRIC_VERSION,
  buildSemanticJudgeSystemPrompt,
} from "./semantic-judge-contract.js";

describe("bjt-audit-types", () => {
  it("exposes a rubric version", () => {
    expect(AUDIT_RUBRIC_VERSION).toBe("1.0.0");
  });

  it("normalizeForNearDuplicate collapses width, punctuation, digits, katakana→hiragana", () => {
    // full-width digits + trailing punctuation collapse to the same key
    const a = normalizeForNearDuplicate("会議は10時に始まります。");
    const b = normalizeForNearDuplicate("会議は１０時に始まります");
    expect(a).toBe(b);
    expect(a).not.toMatch(/[0-9。、]/);
    // katakana→hiragana folding works
    expect(normalizeForNearDuplicate("カイギ")).toBe(normalizeForNearDuplicate("かいぎ"));
    // kanji vs kana readings stay distinct (different prompts, not near-dups)
    expect(normalizeForNearDuplicate("会議")).not.toBe(normalizeForNearDuplicate("かいぎ"));
  });

  it("cjkRatio detects Japanese vs non-Japanese text", () => {
    expect(cjkRatio("取締役会で議長が述べています。")).toBeGreaterThan(0.8);
    expect(cjkRatio("This is plain English text only")).toBe(0);
    expect(cjkRatio("")).toBe(0);
  });

  it("looksVietnamese distinguishes Vietnamese from Japanese/English", () => {
    expect(looksVietnamese("Chủ tọa phát biểu về vấn đề này")).toBe(true);
    expect(looksVietnamese("取締役会で承認されました")).toBe(false);
    expect(looksVietnamese("plain english sentence here")).toBe(false);
    expect(looksVietnamese("")).toBe(false);
  });
});

describe("semantic-judge-contract", () => {
  it("has a rubric version", () => {
    expect(SEMANTIC_JUDGE_RUBRIC_VERSION).toBe("1.1.0");
  });

  it("system prompt lists all 11 dimensions and demands JSON", () => {
    const prompt = buildSemanticJudgeSystemPrompt();
    for (let i = 1; i <= 11; i++) {
      expect(prompt).toContain(`B${String(i).padStart(2, "0")}`);
    }
    expect(prompt).toContain("strict JSON");
    expect(prompt).toContain("confidence");
  });
});
