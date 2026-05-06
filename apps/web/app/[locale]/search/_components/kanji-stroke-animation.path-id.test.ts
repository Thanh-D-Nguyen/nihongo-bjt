import { describe, expect, it } from "vitest";

import { strokeNumberFromKanjiVgPathId } from "./kanji-stroke-animation";

describe("strokeNumberFromKanjiVgPathId", () => {
  it("parses KanjiVG path ids", () => {
    expect(strokeNumberFromKanjiVgPathId("kvg:04e9c-s1")).toBe(1);
    expect(strokeNumberFromKanjiVgPathId("kvg:04e9c-s7")).toBe(7);
    expect(strokeNumberFromKanjiVgPathId("prefix_s12")).toBe(12);
  });

  it("returns null when no stroke suffix", () => {
    expect(strokeNumberFromKanjiVgPathId("kvg:04e9c")).toBeNull();
    expect(strokeNumberFromKanjiVgPathId(null)).toBeNull();
  });
});
