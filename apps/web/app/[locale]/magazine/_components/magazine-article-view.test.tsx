// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { MagazineArticleView } from "./magazine-article-view";

let root: Root;
let container: HTMLDivElement;

afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
});

describe("magazine article body", () => {
  it("renders the seeded vocabulary introduction in Japanese and Vietnamese", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(
      <MagazineArticleView
        article={{
          id: "article-1", slug: "vocab", widgetKind: "magazine_bjt_phrase",
          titleJp: "見出し", titleVi: "Tiêu đề", publishDate: "2026-10-08",
          contentJson: { introduction: "会議で使う表現を学びましょう。", introductionVi: "Học cách diễn đạt trong cuộc họp." },
        }}
        locale="vi"
        t={{ vocabSection: "Từ vựng", quizSection: "Quiz" } as never}
      />,
    ));
    expect(container.textContent).toContain("会議で使う表現を学びましょう。");
    expect(container.textContent).toContain("Học cách diễn đạt trong cuộc họp.");
  });

  it("renders published loto reference sets stored under content.sets", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(
      <MagazineArticleView
        article={{
          id: "article-2", slug: "loto6-prediction-2026-10-29", widgetKind: "magazine_loto6",
          titleJp: "ロト6", titleVi: "Loto6", publishDate: "2026-10-29",
          contentJson: {
            sets: [{ mainNumbers: [3, 9, 14, 22, 31, 40], bonusNumbers: [], score: 0.6 }],
            japaneseSentence: { textJp: "確率は同じです。", reading: "かくりつはおなじです。", textVi: "Xác suất như nhau." },
          },
        }}
        locale="vi"
        t={{ vocabSection: "Từ vựng", quizSection: "Quiz" } as never}
      />,
    ));
    expect(container.textContent).toContain("31");
    expect(container.textContent).toContain("確率は同じです。");
  });
});
