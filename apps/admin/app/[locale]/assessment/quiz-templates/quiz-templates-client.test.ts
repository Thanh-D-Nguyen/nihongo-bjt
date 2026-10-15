import { describe, expect, it } from "vitest";

import { isQuizTemplateDeletable } from "../../../../lib/quiz-template-admin-utils";

describe("quiz template deletion eligibility", () => {
  it("allows deleting drafts only", () => {
    expect(isQuizTemplateDeletable("draft")).toBe(true);
    expect(isQuizTemplateDeletable("published")).toBe(false);
    expect(isQuizTemplateDeletable("archived")).toBe(false);
  });
});
