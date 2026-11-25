// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "../../../messages/en.json";
import { FeaturedNewsSection } from "../_components/homepage/featured-news-section";
import { NhkNewsListClient } from "./_components/nhk-news-list-client";
import { NhkArticleDetailClient } from "./[id]/_components/nhk-article-detail-client";
import { generateMetadata } from "./[id]/page";

const api = vi.hoisted(() => ({ article: {} }));
vi.mock("../../../lib/go-auth-provider", () => ({ useGoAuth: () => ({ userId: "learner" }) }));
vi.mock("../../../lib/learner-api", () => ({
  learnerApiFetch: vi.fn(),
  learnerApiFetchOptional: vi.fn(async () => ({ ok: true, json: async () => api.article })),
}));

const article = {
  id: "normal-test", title: "通常ニュース", sourceType: "normal" as const,
  publishedAt: "2026-05-27T00:00:00Z", imageUrl: null, difficulty: null,
  url: "https://www3.nhk.or.jp/news/test", titleWithRuby: null, audioUrl: null,
  bodyHtml: null, bodyPlain: "本文の要約", vocabulary: [], hasBody: true, canGenerateCards: false,
};

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe("NHK regression", () => {
  it("does not offer cards from a headline without extracted vocabulary", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-26T12:00:00Z"));
    const html = renderToStaticMarkup(<FeaturedNewsSection
      articlesByType={{ easy: [{ ...article, sourceType: "easy", hasBody: false }], normal: [] }}
      labels={{ ...en.homepage, newsCardsUnavailable: "No extracted vocabulary", newsContentUnavailable: "Headline only", newsStale: "Showing saved articles", newsLatestPublished: "Latest available: {time}" }}
      locale="en" onRetry={() => undefined}
    />);
    expect(html).toContain("Headline only");
    expect(html).toMatch(/disabled=""/);
    expect(html).toContain("No extracted vocabulary");
    const tabs = new DOMParser().parseFromString(html, "text/html").querySelectorAll('[role="tab"]');
    expect(Array.from(tabs, (tab) => tab.textContent)).toEqual([
      en.homepage.newsEasy,
      en.homepage.newsNormal,
      en.homepage.newsBusiness,
      en.homepage.newsLivedoor,
    ]);
    expect(html).toContain("Latest available:");
    expect(html).toContain("Showing saved articles");
  });

  it("enables cards when the API reports vocabulary is available", () => {
    const html = renderToStaticMarkup(<FeaturedNewsSection
      articlesByType={{ easy: [{ ...article, sourceType: "easy", canGenerateCards: true }], normal: [] }}
      labels={en.homepage} locale="en" onRetry={() => undefined}
    />);
    expect(html).not.toContain('disabled=""');
    expect(html).not.toContain(en.homepage.newsCardsUnavailable);
  });

  it("links normal news to internal detail pages in the homepage and list", async () => {
    const normalArticles = [article, { ...article, id: "normal-test-2" }];
    api.article = normalArticles;
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => root.render(<FeaturedNewsSection articlesByType={{ easy: [], normal: normalArticles }} labels={en.homepage} locale="en" onRetry={() => undefined} />));
    await act(async () => (container.querySelectorAll('[role="tab"]')[1] as HTMLElement).click());
    expect(container.querySelectorAll('a[href="/en/news/normal-test"]')).toHaveLength(1);
    expect(container.querySelectorAll('a[href="/en/news/normal-test-2"]')).toHaveLength(1);
    for (const link of container.querySelectorAll('a[href^="/en/news/normal-test"]')) {
      expect(link.getAttribute("aria-label")).toBe(`${en.homepage.newsReadMore} ${en.homepage.newsNormal}`);
    }
    await act(async () => root.render(<NhkNewsListClient labels={en.nhkDetail} homepageLabels={en.homepage} locale="en" />));
    await act(async () => (container.querySelectorAll('[role="tab"]')[1] as HTMLElement).click());
    expect(container.querySelectorAll('a[href="/en/news/normal-test"]')).toHaveLength(1);
    expect(container.querySelectorAll('a[href="/en/news/normal-test-2"]')).toHaveLength(1);
    await act(async () => root.unmount());
  });

  it("renders the stored plain summary and normal source breadcrumb", async () => {
    api.article = article;
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => root.render(<NhkArticleDetailClient articleId={article.id} labels={{ ...en.nhkDetail, titleNormal: "NHK news" }} locale="en" />));
    expect(container.querySelector("article")?.textContent).toContain("本文の要約");
    expect(container.querySelector("nav")?.textContent).toContain("NHK news");
    expect(Array.from(container.querySelectorAll("div")).find((el) => el.textContent === en.nhkDetail.summaryNote)?.className).toContain("bg-amber-50 ");
    await act(async () => root.unmount());
  });

  it("does not claim an empty normal article has a summary", async () => {
    api.article = { ...article, bodyPlain: null, hasBody: false };
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => root.render(<NhkArticleDetailClient articleId={article.id} labels={en.nhkDetail} locale="en" />));
    expect(container.textContent).toContain(en.nhkDetail.contentUnavailable);
    expect(container.textContent).not.toContain(en.nhkDetail.summaryNote);
    await act(async () => root.unmount());
  });

  it("uses normal source in normal article metadata", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ locale: "en", id: "normal-test" }) });
    expect(meta.title).not.toContain("easy");
  });

  it("renders StudyTrackTabs with Đọc NHK active and navigation links to /levels and /scenarios", async () => {
    api.article = [article];
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () =>
      root.render(<NhkNewsListClient labels={en.nhkDetail} homepageLabels={en.homepage} locale="vi" />)
    );

    const levelsTab = container.querySelector<HTMLAnchorElement>('a[href="/vi/levels"]');
    const scenariosTab = container.querySelector<HTMLAnchorElement>('a[href="/vi/scenarios"]');
    const readingTab = container.querySelector<HTMLAnchorElement>('a[href="/vi/news"]');

    expect(levelsTab, "/news must render StudyTrackTabs with link to /vi/levels").not.toBeNull();
    expect(scenariosTab, "/news must render StudyTrackTabs with link to /vi/scenarios").not.toBeNull();
    expect(readingTab, "/news must render active StudyTrackTabs link to /vi/news").not.toBeNull();
    expect(readingTab!.getAttribute("aria-current")).toBe("page");
    expect(levelsTab!.getAttribute("aria-current")).toBeNull();
    expect(scenariosTab!.getAttribute("aria-current")).toBeNull();
    expect(levelsTab!.textContent?.trim()).toBe("Lộ trình BJT");
    expect(scenariosTab!.textContent?.trim()).toBe("Tình huống công sở");
    expect(readingTab!.textContent?.trim()).toBe("Đọc NHK");

    await act(async () => root.unmount());
  });

  it("renders news card badges in the card body without overlapping thumbnail graphics and avoids cropping corner logos", async () => {
    api.article = [
      { ...article, id: "easy-with-img", sourceType: "easy", imageUrl: "https://www3.nhk.or.jp/news/easy-thumb.jpg", difficulty: "N4" },
      { ...article, id: "easy-no-img", sourceType: "easy", imageUrl: null, difficulty: "N4" },
    ];
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () =>
      root.render(<NhkNewsListClient labels={en.nhkDetail} homepageLabels={en.homepage} locale="en" />)
    );

    const cardWithImg = container.querySelector<HTMLAnchorElement>('a[href="/en/news/easy-with-img"]');
    const cardNoImg = container.querySelector<HTMLAnchorElement>('a[href="/en/news/easy-no-img"]');
    expect(cardWithImg).not.toBeNull();
    expect(cardNoImg).not.toBeNull();

    const thumbImg = cardWithImg!.querySelector("img");
    expect(thumbImg, "article with imageUrl must render thumbnail img").not.toBeNull();
    expect(thumbImg!.className, "thumbnail img must use object-contain so baked-in NHK corner logos are never half-cut").toContain("object-contain");
    expect(thumbImg!.className, "thumbnail img must not crop corner logos with object-cover").not.toContain("object-cover");

    const thumbBoxWithImg = thumbImg!.parentElement!;
    expect(thumbBoxWithImg.textContent, "NHK Easy badge must not overlay the thumbnail image").not.toContain(en.homepage.newsEasy);

    const fallbackBanner = Array.from(cardNoImg!.querySelectorAll("span")).find((el) =>
      el.textContent?.includes("NHK NEWS EASY")
    );
    expect(fallbackBanner, "no-image fallback must keep NHK NEWS EASY label").toBeTruthy();
    const fallbackBox = fallbackBanner!.parentElement!.parentElement!;
    expect(fallbackBox.textContent, "NHK Easy badge must not overlap the fallback NHK NEWS EASY banner").not.toContain(en.homepage.newsEasy);

    expect(cardWithImg!.textContent, "card body must still show NHK Easy badge").toContain(en.homepage.newsEasy);
    expect(cardWithImg!.textContent, "card body must still show article difficulty").toContain("N4");

    await act(async () => root.unmount());
  });
});
