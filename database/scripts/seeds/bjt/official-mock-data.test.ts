import { describe, expect, it } from "vitest";

import {
  OFFICIAL_BJT_FORMAT_REFERENCE,
  MOCK_TIME_LIMIT_SECONDS,
  OFFICIAL_MOCK_FORMS,
  OFFICIAL_SECTION_SPECS,
  validateOfficialMockForms
} from "./official-mock-data.js";

describe("BJT official full-mock seed data", () => {
  it("ships exactly three stable 80-question / 105-minute forms", () => {
    const report = validateOfficialMockForms();

    expect(report.mockCount).toBe(3);
    expect(report.totalQuestions).toBe(240);
    for (const form of OFFICIAL_MOCK_FORMS) {
      expect(form.level).toBeNull();
      expect(form.type).toBe("official");
      expect(form.timeLimitSeconds).toBe(MOCK_TIME_LIMIT_SECONDS);
      expect(form.sections.reduce((count, section) => count + section.questions.length, 0)).toBe(
        80
      );
      expect(form.blueprintMeta.scoreLabel).toBe("estimated");
      expect(form.blueprintMeta.reference).toEqual(OFFICIAL_BJT_FORMAT_REFERENCE);
    }
  });

  it("matches the official 25 listening / 25 listening-reading / 30 reading blueprint", () => {
    const report = validateOfficialMockForms();

    expect(report.partCounts).toEqual({
      listening: 75,
      listening_reading: 75,
      reading: 90
    });
    expect(
      OFFICIAL_SECTION_SPECS.map(({ code, questionCount }) => ({
        code,
        questionCount
      }))
    ).toEqual([
      { code: "LC_SCENE", questionCount: 5 },
      { code: "LC_STATEMENT", questionCount: 10 },
      { code: "LC_INTEGRATED", questionCount: 10 },
      { code: "LR_SITUATION", questionCount: 5 },
      { code: "LR_DOCUMENT", questionCount: 10 },
      { code: "LR_INTEGRATED", questionCount: 10 },
      { code: "RC_VOCAB_GRAMMAR", questionCount: 10 },
      { code: "RC_EXPRESSION", questionCount: 10 },
      { code: "RC_INTEGRATED", questionCount: 10 }
    ]);
  });

  it("keeps prompts unique and balances answer keys and difficulty", () => {
    const report = validateOfficialMockForms();
    const prompts = OFFICIAL_MOCK_FORMS.flatMap((form) =>
      form.sections.flatMap((section) => section.questions.map((question) => question.prompt))
    );

    expect(new Set(prompts).size).toBe(prompts.length);
    expect(report.correctAnswerCounts).toEqual({
      A: 60,
      B: 60,
      C: 60,
      D: 60
    });
    expect(report.difficultyCounts).toEqual({
      easy: 60,
      standard: 120,
      hard: 60
    });
  });

  it("keeps at least 200 normalized content signatures and an independent form C bank", () => {
    const report = validateOfficialMockForms();
    const overlapsWithFormC = Object.entries(report.normalizedFormOverlaps)
      .filter(([pair]) => pair.includes("simulation-c"))
      .map(([, overlap]) => overlap);

    expect(report.normalizedSignatureCount).toBeGreaterThanOrEqual(200);
    expect(report.normalizedDuplicateCount).toBeLessThanOrEqual(40);
    expect(overlapsWithFormC).toEqual([0, 0]);
  });

  it("requires transcripts for audio items and image briefs for visual items", () => {
    for (const form of OFFICIAL_MOCK_FORMS) {
      for (const section of form.sections) {
        for (const question of section.questions) {
          if (section.code.startsWith("LC_") || section.code.startsWith("LR_")) {
            expect(question.audioScript?.trim()).toBeTruthy();
          }
          if (
            ["LC_SCENE", "LC_INTEGRATED", "LR_SITUATION", "LR_DOCUMENT", "LR_INTEGRATED"].includes(
              section.code
            )
          ) {
            expect(question.imageAlt?.trim()).toBeTruthy();
            expect(question.imagePrompt?.trim()).toBeTruthy();
          }
        }
      }
    }
  });
});
