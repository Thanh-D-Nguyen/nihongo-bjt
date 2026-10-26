// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "../../../messages/en.json";
import { FeaturedNewsSection } from "../_components/homepage/featured-news-section";
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
    expect(Array.from(tabs, (tab) => tab.textContent)).toEqual([en.homepage.newsEasy, en.homepage.newsNormal]);
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

  it("renders the stored plain summary and normal source breadcrumb", async () => {
    api.article = article;
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => root.render(<NhkArticleDetailClient articleId={article.id} labels={{ ...en.nhkDetail, titleNormal: "NHK news" }} locale="en" />));
    expect(container.querySelector("article")?.textContent).toContain("本文の要約");
    expect(container.querySelector("nav")?.textContent).toContain("NHK news");
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
});
