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
    ["vi", viMessages.pricing, "Nâng cao", "Tìm ảnh mỗi ngày", "Giao diện thẻ cao cấp"],
    ["en", enMessages.pricing, "Plus", "Daily image searches", "Premium flashcard styles"],
    ["ja", jaMessages.pricing, "プラス", "1日の画像検索", "プレミアムカードデザイン"]
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
});
