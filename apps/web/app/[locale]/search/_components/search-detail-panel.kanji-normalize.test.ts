import { describe, expect, it } from "vitest";

import { normalizeKanjiDetailDto } from "./kanji-detail-dto";

describe("normalizeKanjiDetailDto", () => {
  it("maps camelCase stroke SVG fields", () => {
    const dto = normalizeKanjiDetailDto({
      character: "会",
      id: "x",
      strokeSvgHash: "abc",
      strokeSvgPath: "https://cdn.example/a.svg",
      strokeSvgSource: "KanjiVG"
    });
    expect(dto.strokeSvgPath).toBe("https://cdn.example/a.svg");
    expect(dto.strokeSvgHash).toBe("abc");
    expect(dto.strokeSvgSource).toBe("KanjiVG");
  });

  it("maps snake_case stroke SVG fields", () => {
    const dto = normalizeKanjiDetailDto({
      character: "X",
      id: "y",
      stroke_svg_hash: "dead",
      stroke_svg_path: "/media/k.svg",
      stroke_svg_source: "test"
    });
    expect(dto.strokeSvgPath).toBe("/media/k.svg");
    expect(dto.strokeSvgHash).toBe("dead");
    expect(dto.strokeSvgSource).toBe("test");
  });

  it("returns null stroke fields when missing", () => {
    const dto = normalizeKanjiDetailDto({ character: "木", id: "z" });
    expect(dto.strokeSvgPath).toBeNull();
    expect(dto.strokeSvgHash).toBeNull();
    expect(dto.strokeSvgSource).toBeNull();
  });
});
