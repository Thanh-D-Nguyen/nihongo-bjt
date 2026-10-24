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
  it("loads stroke metadata from detail when the list returns a summary", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: "kanji-sei", character: "政" }] })
      .mockResolvedValueOnce({ ok: true, json: async () => ({
        id: "kanji-sei", character: "政", strokeSvgPath: "data/generated/kanji-strokes/1519-0653f.svg"
      }) });
    const result = await fetchKanjiByCharacter("政");
    expect(result.status).toBe("ok");
    expect(result.status === "ok" && result.dto.strokeSvgPath).toBe("data/generated/kanji-strokes/1519-0653f.svg");
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/kanji/kanji-sei"), expect.anything());
  });
  it("accepts only single Han characters", () => {
    expect(isSingleKanjiCharacter("日")).toBe(true);
    expect(isSingleKanjiCharacter("：")).toBe(false);
    expect(isSingleKanjiCharacter("日語")).toBe(false);
  });

  it("does not cache a transient detail failure", async () => {
    const summary = { ok: true, json: async () => [{ id: "kanji-fu", character: "府" }] };
    fetchMock.mockResolvedValueOnce(summary).mockResolvedValueOnce({ ok: false, status: 503 });
    expect((await fetchKanjiByCharacter("府")).status).toBe("empty");
    fetchMock.mockResolvedValueOnce(summary).mockResolvedValueOnce({ ok: true, json: async () => ({
      id: "kanji-fu", character: "府", strokeSvgPath: "data/generated/kanji-strokes/2410-05e9c.svg"
    }) });
    expect((await fetchKanjiByCharacter("府")).status).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(4);
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
