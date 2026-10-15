import { describe, expect, it } from "vitest";

import { detailPathForKind } from "./search-client";

describe("search result detail routes", () => {
  it("uses the canonical content detail routes", () => {
    expect(detailPathForKind("lexeme", "word/id")).toBe("/api/content/lexemes/word%2Fid");
    expect(detailPathForKind("kanji", "kanji-id")).toBe("/api/kanji/kanji-id");
    expect(detailPathForKind("grammar", "grammar-id")).toBe("/api/content/grammar/grammar-id");
  });

  it("does not request a separate detail route for example and lesson hits", () => {
    expect(detailPathForKind("example", "example-id")).toBeNull();
    expect(detailPathForKind("lesson", "lesson-id")).toBeNull();
  });
});
