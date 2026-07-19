import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi as mock } from "vitest";

import viMessages from "../../../../messages/vi.json";

import { TodayPlanHub } from "./today-plan-hub";

const hub = {
  dueReviews: 0,
  greeting: { japanese: "おはようございます", reading: null },
  today: "2026-07-19"
};

const baseProps = {
  analytics: null,
  analyticsError: false,
  analyticsReady: true,
  hub,
  hubError: false,
  hubReady: true,
  isOffline: false,
  labels: viMessages.homepage,
  locale: "vi",
  onRetry: mock.fn()
};

describe("TodayPlanHub", () => {
  it("renders honest empty review and analytics states", () => {
    const html = renderToStaticMarkup(<TodayPlanHub {...baseProps} />);

    expect(html).toContain("Hàng đợi ôn tập đã gọn");
    expect(html).not.toContain("Ôn 0 thẻ đến hạn");
    expect(html).toContain("Chưa có bài hoàn tất");
    expect(html).toContain("Lời chào theo thời điểm");
    expect(html).not.toContain("ohayou");
    expect(html).not.toContain("<rt");
  });

  it("renders kana reading assistance without romaji when kanji is present", () => {
    const html = renderToStaticMarkup(
      <TodayPlanHub
        {...baseProps}
        hub={{ ...hub, greeting: { japanese: "お疲れさまです", reading: "おつかれさまです" } }}
      />
    );

    expect(html).toContain("お疲れさまです");
    expect(html).toContain("おつかれさまです");
    expect(html).not.toMatch(/otsukare|desu/iu);
  });

  it("renders recent accuracy and streak from learner analytics", () => {
    const html = renderToStaticMarkup(
      <TodayPlanHub
        {...baseProps}
        analytics={{
          insight: "",
          totals: {
            bjtAccuracyPct: 72.6,
            completedBjtSessions: 4,
            reviewCount: 18,
            streakDays: 5
          }
        }}
      />
    );

    expect(html).toContain("73%");
    expect(html).toContain("5");
    expect(html).toContain("Độ chính xác BJT gần đây");
    expect(html).not.toContain("BJT ước lượng");
  });

  it("matches the dashboard shape while the hub is loading", () => {
    const html = renderToStaticMarkup(
      <TodayPlanHub {...baseProps} hub={null} hubReady={false} analyticsReady={false} />
    );

    expect(html).toContain('aria-busy="true"');
    expect(html).toContain(viMessages.homepage.sectionLoadingHint);
  });

  it("keeps the main plan usable when analytics are temporarily unavailable", () => {
    const html = renderToStaticMarkup(
      <TodayPlanHub {...baseProps} analyticsError analyticsReady />
    );

    expect(html).toContain("Tạm chưa tải được số liệu");
    expect(html).toContain("Luyện BJT theo cấp độ");
  });

  it("offers a retry when the daily hub request fails", () => {
    const html = renderToStaticMarkup(<TodayPlanHub {...baseProps} hub={null} hubError hubReady />);

    expect(html).toContain("Không tải được hôm nay.");
    expect(html).toContain("Thử lại");
  });
});
