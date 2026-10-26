import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ForYouFeedWidget } from "./for-you-feed-widget";

const auth = vi.hoisted(() => ({ userId: null, isLoading: true }));
vi.mock("../../../../lib/go-auth-provider", () => ({ useGoAuth: () => auth }));
vi.mock("../../../../lib/learner-api", () => ({ learnerApiFetchOptional: vi.fn() }));

describe("ForYouFeedWidget", () => {
  it("keeps a loading skeleton while the session is unresolved", () => {
    auth.isLoading = true;
    const html = renderToStaticMarkup(<ForYouFeedWidget locale="en" />);
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain("Đăng nhập");
  });
  it("localizes the signed-out message", () => {
    auth.isLoading = false;
    const html = renderToStaticMarkup(<ForYouFeedWidget locale="ja" />);
    expect(html).toContain("ログイン");
    expect(html).not.toContain("Đăng nhập");
  });
});
