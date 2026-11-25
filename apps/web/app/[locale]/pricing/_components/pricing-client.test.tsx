// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const { apiFetchMock, userId } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  userId: { value: null as string | null }
}));

vi.mock("../../../../lib/go-auth-provider", () => ({ useGoAuth: () => ({ userId: userId.value }) }));
vi.mock("../../../../lib/learner-api", () => ({ learnerApiFetch: (...args: unknown[]) => apiFetchMock(...args) }));
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) =>
    createElement("a", { href, ...props }, children)
}));

import enMessages from "../../../../messages/en.json";
import jaMessages from "../../../../messages/ja.json";
import viMessages from "../../../../messages/vi.json";
import { PricingClient } from "./pricing-client";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const mounted: Array<{ root: ReturnType<typeof createRoot>; host: HTMLDivElement }> = [];

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, status });
}

const plan = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "plus",
  nameKey: "plan.plus",
  status: "active",
  sortOrder: 1,
  config: { displayName: "Plus", displayNameVi: "Nâng cao", displayNameJa: "プラス", price: 120000 },
  entitlements: ["quiz.bjt.start", "flashcard.premium_styles"],
  quotas: [
    { key: "flashcard_reviews_per_day", limit: 30, window: "day" },
    { key: "image_search_daily", limit: 5, window: "day" }
  ]
};
const secondPaidPlan = { ...plan, id: "22222222-2222-4222-8222-222222222222", slug: "pro", config: { ...plan.config, displayName: "Pro" } };

afterEach(async () => {
  for (const { root, host } of mounted.splice(0)) {
    await act(async () => root.unmount());
    host.remove();
  }
  apiFetchMock.mockReset();
  userId.value = null;
});

async function renderPricing(locale: string, labels: typeof viMessages.pricing) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  mounted.push({ root, host });
  await act(async () => {
    root.render(<PricingClient labels={labels} locale={locale} />);
    await Promise.resolve();
  });
  return host;
}

describe("PricingClient contracts", () => {
  it.each([
    ["vi", viMessages.pricing, "Nâng cao", "Tìm ảnh", "Giao diện thẻ cao cấp"],
    ["en", enMessages.pricing, "Plus", "Image searches", "Premium flashcard styles"],
    ["ja", jaMessages.pricing, "プラス", "画像検索", "プレミアムカードデザイン"]
  ])("renders complete public %s plan data", async (locale, labels, displayName, quota, entitlement) => {
    apiFetchMock.mockResolvedValue(response([plan]));
    const host = await renderPricing(locale, labels);

    expect(apiFetchMock).toHaveBeenCalledExactlyOnceWith("/api/learner/monetization/plans");
    expect(host.textContent).toContain(displayName);
    expect(host.textContent).toContain(quota);
    expect(host.textContent).toContain(entitlement);
    expect(host.textContent).toContain(locale === "ja" ? "フラッシュカード復習" : locale === "vi" ? "Ôn thẻ flashcard" : "Flashcard reviews");
    expect(host.textContent).toContain(locale === "ja" ? "BJTクイズ" : locale === "vi" ? "Làm bài kiểm tra BJT" : "BJT quizzes");
    expect(host.textContent).not.toContain("image_search_daily");
    expect(host.textContent).not.toContain("flashcard.premium_styles");
  });

  it("loads subscription only from the authenticated session endpoint", async () => {
    userId.value = "learner-id";
    apiFetchMock.mockImplementation(async (path: string) => path.endsWith("/plans")
      ? response([plan, secondPaidPlan])
      : response({ subscription: { id: "sub-id", planId: plan.id, status: "active" } }));
    const host = await renderPricing("vi", viMessages.pricing);

    expect(apiFetchMock).toHaveBeenNthCalledWith(2, "/api/learner/monetization/subscription");
    expect(host.textContent).toContain(viMessages.pricing.current);
  });

  it("sends the selected plan ID and labels the result as pending", async () => {
    userId.value = "learner-id";
    apiFetchMock.mockImplementation(async (path: string) => path.endsWith("/plans")
      ? response([plan, secondPaidPlan])
      : path.endsWith("/subscription")
        ? response({ subscription: null })
        : response({ subscriptionId: "pending-id", status: "pending" }));
    const host = await renderPricing("vi", viMessages.pricing);
    const upgrade = Array.from(host.querySelectorAll("button")).find((button) => button.textContent === viMessages.pricing.upgrade);
    expect(upgrade).toBeTruthy();
    await act(async () => {
      upgrade?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(apiFetchMock).toHaveBeenCalledWith("/api/learner/monetization/checkout", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ planId: plan.id })
    }));
    expect(host.textContent).toContain(viMessages.pricing.checkoutPending);
    expect(host.querySelectorAll('button:disabled')).toHaveLength(2);
    expect(host.querySelector('button:disabled')?.textContent).toBe(viMessages.pricing.checkoutPendingShort);
  });

  it("keeps an active plan visible while an upgrade is pending", async () => {
    userId.value = "learner-id";
    apiFetchMock.mockImplementation(async (path: string) => path.endsWith("/plans")
      ? response([plan, secondPaidPlan])
      : response({
        subscription: { id: "active-id", planId: plan.id, status: "active" },
        pendingSubscription: { id: "pending-id", planId: secondPaidPlan.id, status: "pending" }
      }));
    const host = await renderPricing("vi", viMessages.pricing);

    expect(host.textContent).toContain(viMessages.pricing.current);
    expect(host.querySelectorAll('button:disabled')).toHaveLength(1);
    expect(host.querySelector('button:disabled')?.textContent).toBe(viMessages.pricing.checkoutPendingShort);
  });

  async function expectQuotaLine(locale: string, labels: typeof viMessages.pricing, expected: string) {
    apiFetchMock.mockResolvedValue(response([plan]));
    const host = await renderPricing(locale, labels);
    const line = Array.from(host.querySelectorAll("p")).find((p) => p.textContent?.includes(expected.split(":")[0]));
    // Each child node is a separate flex item / accessibility text run; a separator living in its own
    // whitespace-only-trimmed run collapses to "label:value".
    const runs = Array.from(line?.childNodes ?? []).map((node) => (node.textContent ?? "").trim()).filter(Boolean);
    expect(runs.join(""), "each quota feature line must render as one text run with a space after the colon").toBe(expected);
  }

  it("renders vi quota feature lines as one run with a space after the colon", () =>
    expectQuotaLine("vi", viMessages.pricing, "Ôn thẻ flashcard: 30/ngày"));
  it("renders en quota feature lines as one run with a space after the colon", () =>
    expectQuotaLine("en", enMessages.pricing, "Flashcard reviews: 30/day"));
  it("renders ja quota feature lines as one run with a space after the colon", () =>
    expectQuotaLine("ja", jaMessages.pricing, "フラッシュカード復習: 30/日"));

  it("avoids redundant per-day wording on image_search_daily while keeping the exact quota numbers", async () => {
    await expectQuotaLine("vi", viMessages.pricing, "Tìm ảnh: 5/ngày");
    await expectQuotaLine("en", enMessages.pricing, "Image searches: 5/day");
    await expectQuotaLine("ja", jaMessages.pricing, "画像検索: 5/日");
  });

  it("renders a localized CTA on the free plan card for guests and non-current learners", async () => {
    const freePlan = {
      ...plan,
      id: "33333333-3333-4333-8333-333333333333",
      slug: "free",
      config: { displayName: "Free", displayNameVi: "Miễn phí", displayNameJa: "無料", price: 0 },
      entitlements: ["learner.basic"],
      quotas: [{ key: "image_search_daily", limit: 5, window: "day" }]
    };
    apiFetchMock.mockResolvedValue(response([freePlan, plan]));
    const host = await renderPricing("vi", viMessages.pricing);
    const freeCard = Array.from(host.querySelectorAll("h3")).find((heading) => heading.textContent === "Miễn phí")?.parentElement;
    const guestCta = freeCard?.querySelector<HTMLAnchorElement>('a[href="/vi/register"]');
    expect(guestCta, "free plan card must render a guest start-learning CTA").not.toBeNull();
    expect(guestCta?.textContent?.trim()).toBe("Bắt đầu học ngay");

    userId.value = "learner-id";
    apiFetchMock.mockImplementation(async (path: string) => path.endsWith("/plans")
      ? response([freePlan, plan])
      : response({ subscription: null }));
    const authedHost = await renderPricing("vi", viMessages.pricing);
    const authedFreeCard = Array.from(authedHost.querySelectorAll("h3")).find((heading) => heading.textContent === "Miễn phí")?.parentElement;
    const learnerCta = authedFreeCard?.querySelector<HTMLAnchorElement>('a[href="/vi/levels"]');
    expect(learnerCta, "free plan card must link signed-in learners to learning track when not marked current").not.toBeNull();
  });

  it("does not repeat the free plan name as its price", async () => {
    const freePlan = {
      ...plan,
      id: "33333333-3333-4333-8333-333333333333",
      slug: "free",
      config: { displayName: "Free", displayNameVi: "Miễn phí", displayNameJa: "無料", price: 0 },
      entitlements: ["learner.basic"]
    };
    apiFetchMock.mockResolvedValue(response([freePlan, plan]));
    const host = await renderPricing("vi", viMessages.pricing);
    const card = Array.from(host.querySelectorAll("h3")).find((heading) => heading.textContent === "Miễn phí")?.parentElement;
    expect(card?.textContent?.split("Miễn phí").length, "free plan card must show its name once, not again as the price").toBe(2);
    expect(card?.textContent).toContain("0đ");
  });

  it("reports API failures and gives the learner a retry action", async () => {
    apiFetchMock.mockResolvedValueOnce(response({ message: "unavailable" }, 503)).mockResolvedValue(response([plan]));
    const host = await renderPricing("vi", viMessages.pricing);

    expect(host.textContent).toContain(viMessages.pricing.error);
    const retry = host.querySelector("button");
    expect(retry?.textContent).toContain(viMessages.pricing.retry);
    await act(async () => {
      retry?.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(host.textContent).toContain("Nâng cao");
  });

  it("themes standard and recommended plan card borders for dark mode while preserving light styling", async () => {
    const recommendedPlan = {
      ...secondPaidPlan,
      config: { ...secondPaidPlan.config, displayNameVi: "Chuyên nghiệp", recommended: true }
    };
    apiFetchMock.mockResolvedValue(response([plan, recommendedPlan]));
    const host = await renderPricing("vi", viMessages.pricing);

    const standardCard = Array.from(host.querySelectorAll("h3")).find((h) => h.textContent === "Nâng cao")?.parentElement;
    const recommendedCard = Array.from(host.querySelectorAll("h3")).find((h) => h.textContent === "Chuyên nghiệp")?.parentElement;

    expect(standardCard?.className, "standard pricing card must use theme border tokens for dark visibility").toContain("border-border");
    expect(standardCard?.className).toContain("dark:border-border-hover");
    expect(standardCard?.className).toContain("bg-surface");
    expect(standardCard?.className).not.toContain("border-slate-200");

    expect(recommendedCard?.className, "recommended pricing card must use dark accent border/ring tokens").toContain("dark:border-accent");
    expect(recommendedCard?.className).toContain("dark:ring-accent/30");
    expect(recommendedCard?.className).toContain("bg-surface");
  });
});
