// @vitest-environment jsdom

import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LotoHeroPrediction } from "./loto-hero-prediction";
import { LotoHistoryCard } from "./loto-history-card";
import { LotoStatsLab } from "./loto-stats-lab";
import type { LotoFeedItem, LotoNextDraw, LotoStats } from "./loto-types";

const { act } = React;
const fetchMock = vi.fn();

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

let host: HTMLDivElement;
let root: Root;

async function render(node: React.ReactNode) {
  await act(async () => {
    root.render(node);
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

function stats(overrides: Partial<LotoStats> = {}): LotoStats {
  return {
    game: "loto6",
    totalDraws: 2149,
    latestDraw: "2026-10-26",
    spec: { mainCount: 6, bonusCount: 1, maxNumber: 43, totalCombinations: 6096454 },
    frequency: Array.from({ length: 43 }, (_, index) => ({
      number: index + 1,
      count: 100 + index,
      recent: index === 6 ? 9 : 1,
      gap: index
    })),
    recentWindow: 50,
    hotNumbers: [43, 42, 41, 40, 39, 38],
    coldNumbers: [1, 2, 3, 4, 5, 6],
    overdueNumbers: [20, 21, 22, 23, 24, 25],
    oddDistribution: [10, 60, 200, 260, 200, 60, 10],
    recentDraws: [
      {
        drawNumber: 2149,
        drawDate: "2026-10-26",
        mainNumbers: [2, 11, 15, 19, 24, 36],
        bonusNumbers: [27]
      }
    ],
    accuracy: {
      samples: 24,
      avgHits: 0.92,
      baselineHits: 0.8372,
      bestHits: 3,
      distribution: [11, 6, 5, 2, 0, 0, 0],
      expectedDistribution: [0.38, 0.43, 0.16, 0.03, 0, 0, 0]
    },
    ...overrides
  };
}

describe("LotoStatsLab", () => {
  it("switches the heat map between all history and the recent window", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(stats()), { status: 200 }));
    await render(
      <LotoStatsLab game="loto6" labels={{ heatmapAll: "All", heatmapRecent: "Last {n}" }} />
    );

    const cells = () => [...host.querySelectorAll("[data-testid=frequency-cell]")];
    expect(cells()).toHaveLength(43);
    expect(cells()[6].textContent).toContain("106");

    const recent = [...host.querySelectorAll("button")].find((b) => b.textContent === "Last 50");
    expect(recent).toBeTruthy();
    await act(async () => {
      (recent as HTMLElement).click();
    });
    expect(cells()[6].textContent).toContain("9");
    expect(cells()[6].textContent).not.toContain("106");
    expect(host.textContent).toContain("C(43,6)");
    expect(host.textContent).toContain("6,096,454");
  });

  it("reports the real accuracy figures against the chance baseline", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(stats()), { status: 200 }));
    await render(<LotoStatsLab game="loto6" labels={{ accuracySamples: "{n} compared" }} />);
    expect(host.textContent).toContain("0.92");
    expect(host.textContent).toContain("0.84");
    expect(host.textContent).toContain("24 compared");
  });

  it("shows an empty comparison message when nothing has been scored yet", async () => {
    const empty = stats({
      accuracy: {
        samples: 0,
        avgHits: 0,
        baselineHits: 0.8372,
        bestHits: 0,
        distribution: [0, 0, 0, 0, 0, 0, 0],
        expectedDistribution: [0.38, 0.43, 0.16, 0.03, 0, 0, 0]
      }
    });
    fetchMock.mockResolvedValue(new Response(JSON.stringify(empty), { status: 200 }));
    await render(<LotoStatsLab game="loto6" labels={{ accuracyEmpty: "No comparisons" }} />);
    expect(host.textContent).toContain("No comparisons");
  });

  it("offers one retry after a failed load and recovers", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("down", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(stats()), { status: 200 }));
    await render(
      <LotoStatsLab game="loto6" labels={{ statsError: "Stats failed", retry: "Retry" }} />
    );
    expect(host.textContent).toContain("Stats failed");
    const retry = [...host.querySelectorAll("button")].filter((b) => b.textContent === "Retry");
    expect(retry).toHaveLength(1);
    await act(async () => {
      (retry[0] as HTMLElement).click();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(host.querySelectorAll("[data-testid=frequency-cell]")).toHaveLength(43);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("requests the stats of the selected game", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(stats({ game: "loto7" })), { status: 200 })
    );
    await render(<LotoStatsLab game="loto7" labels={{}} />);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/magazine/loto/stats?game=loto7");
  });
});

const nextDraw: LotoNextDraw = {
  id: "run-1",
  game: "loto6",
  drawNumber: 2150,
  drawNumberEstimated: false,
  drawDate: "2026-10-29",
  drawDayJp: "木曜日",
  drawTime: "18:45 JST",
  scheduleJp: "毎週 月曜・木曜 18:45 抽選",
  scheduleVi: "Thứ 2 & Thứ 5",
  sets: [{ mainNumbers: [3, 9, 14, 22, 31, 40], bonusNumbers: [], score: 0.61 }],
  jpSentence: {
    textJp: "確率は同じです。",
    reading: "かくりつはおなじです。",
    textVi: "Xác suất như nhau.",
    level: "N4",
    grammar: "〜は：chủ đề",
    vocabItems: [{ wordJp: "確率", reading: "かくりつ", meaningVi: "xác suất" }]
  },
  vocabItems: [],
  confidence: 0.61,
  daysUntil: 0
};

describe("LotoHeroPrediction", () => {
  it("shows the draw number, today badge, vocab meanings and a reading toggle", async () => {
    await render(
      <LotoHeroPrediction
        data={nextDraw}
        game="loto6"
        labels={{ today: "today", showReading: "Show reading", hideReading: "Hide reading" }}
      />
    );
    expect(host.textContent).toContain("#2150");
    expect(host.textContent).toContain("today");
    expect(host.textContent).toContain("xác suất");
    expect(host.textContent).toContain("N4");
    expect(host.textContent).toContain("かくりつはおなじです。");

    const toggle = [...host.querySelectorAll("button")].find(
      (b) => b.textContent === "Hide reading"
    );
    expect(toggle).toBeTruthy();
    await act(async () => {
      (toggle as HTMLElement).click();
    });
    expect(host.textContent).not.toContain("かくりつはおなじです。");
    expect(host.textContent).toContain("Show reading");
  });

  it("shows the schedule in the reader's language only", async () => {
    const data = { ...nextDraw, scheduleEn: "Every Monday & Thursday" };
    await render(<LotoHeroPrediction data={data} game="loto6" labels={{}} locale="en" />);
    expect(host.textContent).toContain("Every Monday & Thursday");
    expect(host.textContent).not.toContain("Thứ 2 & Thứ 5");
    await render(<LotoHeroPrediction data={data} game="loto6" labels={{}} locale="ja" />);
    expect(host.textContent).not.toContain("Thứ 2 & Thứ 5");
    expect(host.textContent).not.toContain("Every Monday");
  });

  it("marks an estimated draw number and falls back to the stand-alone vocab list", async () => {
    await render(
      <LotoHeroPrediction
        data={{
          ...nextDraw,
          drawNumberEstimated: true,
          daysUntil: 2,
          jpSentence: { ...nextDraw.jpSentence!, vocabItems: [] },
          vocabItems: [{ wordJp: "統計", reading: "とうけい", meaningVi: "thống kê" }]
        }}
        game="loto6"
        labels={{ countdown: "{days} days left" }}
      />
    );
    expect(host.textContent).toContain("#2150≈");
    expect(host.textContent).toContain("2 days left");
    expect(host.textContent).toContain("thống kê");
  });
});

function feedItem(overrides: Partial<LotoFeedItem> = {}): LotoFeedItem {
  return {
    id: "d-1",
    drawNumber: 2149,
    drawDate: "2026-10-26",
    drawDayJp: "月曜日",
    game: "loto6",
    kind: "backtest",
    sets: [{ mainNumbers: [2, 11, 15, 30, 31, 32], bonusNumbers: [], score: 0.5 }],
    result: { mainNumbers: [2, 11, 15, 19, 24, 36], bonusNumbers: [27] },
    hitCount: 3,
    bonusHit: false,
    matched: [2, 11, 15],
    jpSentence: null,
    ...overrides
  };
}

describe("LotoHistoryCard", () => {
  it("labels backtests and highlights matched numbers", async () => {
    await render(
      <LotoHistoryCard
        item={feedItem()}
        game="loto6"
        labels={{ kindBacktest: "Backtest", hitCount: "Matched {hit}/{total}" }}
      />
    );
    expect(host.textContent).toContain("Backtest");
    expect(host.textContent).toContain("Matched 3/6");
    expect(host.querySelectorAll(".bg-green-500")).toHaveLength(3);
  });

  it("renders a plain official result without a prediction row", async () => {
    await render(
      <LotoHistoryCard
        item={feedItem({ kind: "result", sets: [], hitCount: 0, matched: [] })}
        game="loto6"
        labels={{ kindResult: "Official result", prediction: "Reference" }}
      />
    );
    expect(host.textContent).toContain("Official result");
    expect(host.textContent).not.toContain("Reference");
    expect(host.querySelectorAll(".bg-green-500")).toHaveLength(0);
  });

  it("flags a matched bonus number and expands the learning sentence", async () => {
    await render(
      <LotoHistoryCard
        item={feedItem({
          kind: "published",
          bonusHit: true,
          jpSentence: {
            textJp: "確率は同じです。",
            reading: "かくりつはおなじです。",
            textVi: "Xác suất như nhau.",
            grammar: "〜は",
            vocabItems: [{ wordJp: "確率", reading: "かくりつ", meaningVi: "xác suất" }]
          }
        })}
        game="loto6"
        labels={{ bonusMatched: "Bonus matched", viewDetail: "More" }}
      />
    );
    expect(host.textContent).toContain("Bonus matched");
    expect(host.textContent).not.toContain("xác suất");
    const more = [...host.querySelectorAll("button")].find((b) =>
      b.textContent?.startsWith("More")
    );
    await act(async () => {
      (more as HTMLElement).click();
    });
    expect(host.textContent).toContain("xác suất");
    expect(host.textContent).toContain("Xác suất như nhau.");
  });
});
