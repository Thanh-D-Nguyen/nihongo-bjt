import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchKanjiByCharacter, isSingleKanjiCharacter } from "./kanji-stroke-fetcher";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("kanji-stroke-fetcher", () => {
  it("accepts only single Han characters", () => {
    expect(isSingleKanjiCharacter("日")).toBe(true);
    expect(isSingleKanjiCharacter("：")).toBe(false);
    expect(isSingleKanjiCharacter("日語")).toBe(false);
  });

  it("deduplicates in-flight lookups for the same kanji", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [
        {
          character: "日",
          id: "kanji-1",
          strokeSvgHash: "abc",
          strokeSvgPath: "/media/day.svg",
          strokeSvgSource: "KanjiVG"
        }
      ]
    });

    const [first, second] = await Promise.all([fetchKanjiByCharacter("日"), fetchKanjiByCharacter("日")]);

    expect(first.status).toBe("ok");
    expect(second.status).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("skips non-kanji input without calling fetch", async () => {
    const result = await fetchKanjiByCharacter("：");

    expect(result.status).toBe("empty");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("retries once when the first response is 429", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 429 })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            character: "月",
            id: "kanji-3",
            strokeSvgHash: "ghi",
            strokeSvgPath: "/media/moon.svg",
            strokeSvgSource: "KanjiVG"
          }
        ]
      });

    const result = await fetchKanjiByCharacter("月");

    expect(result.status).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
