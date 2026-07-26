import { describe, expect, it } from "vitest";

import {
  buildBjtQuestionStableWhere,
  selectBjtProductionQuestionId,
  type BjtQuestionStableIdentity
} from "./bjt-production-question-locator.js";

const identity: BjtQuestionStableIdentity = {
  audioScript: "担当者が納期を相談している。",
  id: "local-question-id",
  prompt: "二人は何について話していますか。",
  scenario: "物流会社の会議室",
  sectionCode: "LC_SCENE",
  skillTag: "listening-context",
  testSlug: "bjt-full-simulation-a-v1"
};

describe("BJT production question locator", () => {
  it("builds a stable content locator scoped to the test and section", () => {
    expect(buildBjtQuestionStableWhere(identity)).toEqual({
      audioScript: identity.audioScript,
      prompt: identity.prompt,
      scenario: identity.scenario,
      section: {
        code: "LC_SCENE",
        test: { slug: "bjt-full-simulation-a-v1" }
      },
      skillTag: identity.skillTag
    });
  });

  it("prefers an exact UUID match", () => {
    expect(
      selectBjtProductionQuestionId(identity, { id: "same-id" }, [{ id: "content-id" }])
    ).toEqual({ id: "same-id", matchedBy: "id" });
  });

  it("accepts exactly one stable-content match when UUIDs differ", () => {
    expect(selectBjtProductionQuestionId(identity, null, [{ id: "production-id" }])).toEqual({
      id: "production-id",
      matchedBy: "stable-content"
    });
  });

  it("rejects missing and ambiguous stable matches", () => {
    expect(() => selectBjtProductionQuestionId(identity, null, [])).toThrow(
      "No production BJT question matches"
    );
    expect(() =>
      selectBjtProductionQuestionId(identity, null, [{ id: "one" }, { id: "two" }])
    ).toThrow("Ambiguous production BJT question match");
  });
});
