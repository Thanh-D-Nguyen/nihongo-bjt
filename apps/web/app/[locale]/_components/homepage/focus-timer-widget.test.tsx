import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { FocusTimerWidget } from "./focus-timer-widget";

vi.mock("../../../_hooks/use-focus-timer", () => ({
  useFocusTimer: () => ({
    loading: false,
    activeSession: null,
    remaining: 0,
    todayMinutes: 0,
    todaySessions: 0,
    completed: false,
    startSession: vi.fn(),
    stopSession: vi.fn(),
    dismissCompleted: vi.fn()
  })
}));

describe("FocusTimerWidget", () => {
  it("sends an anonymous learner to the localized login flow", () => {
    const html = renderToStaticMarkup(
      <FocusTimerWidget isLoggedIn={false} locale="ja" signInLabel="今すぐログイン" />
    );

    expect(html).toContain('href="/ja/login?returnTo=%2Fja"');
    expect(html).toContain("今すぐログイン");
    expect(html).not.toContain("Bắt đầu tập trung");
  });

  it("keeps the focus session action for authenticated learners", () => {
    const html = renderToStaticMarkup(
      <FocusTimerWidget isLoggedIn locale="vi" signInLabel="Đăng nhập ngay" />
    );

    expect(html).toContain("Bắt đầu tập trung");
    expect(html).not.toContain('href="/vi/login');
  });
});
