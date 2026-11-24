// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { learnerApiFetchMock, routerPushMock, routerMock } = vi.hoisted(() => {
  const routerPushMock = vi.fn();
  return {
    learnerApiFetchMock: vi.fn(),
    routerPushMock,
    routerMock: { push: routerPushMock }
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock
}));

vi.mock("../../../../lib/learner-api", () => ({
  learnerApiFetch: (...args: unknown[]) => learnerApiFetchMock(...args)
}));

import { OnboardingFlow } from "./onboarding-flow";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const VI_LABELS = {
  dialogAria: "Thiết lập lộ trình học",
  stepCounter: "Bước {current}/{total}",
  recommendedBadge: "Đề xuất",
  back: "← Quay lại",
  next: "Tiếp theo →",
  finishStartReview: "Bắt đầu ôn tập ngay →",
  saving: "Đang lưu...",
  skip: "Bỏ qua — tôi sẽ thiết lập sau",
  saveError: "Không thể lưu lựa chọn. Vui lòng thử lại.",
  steps: {
    goalTitle: "Mục tiêu chính của bạn là gì?",
    goalSubtitle: "Chúng tôi sẽ ưu tiên nội dung BJT và công việc phù hợp",
    levelTitle: "Trình độ tiếng Nhật hiện tại của bạn?",
    levelSubtitle: "Giúp chọn đúng độ khó từ phiên học đầu tiên",
    diagnosticTitle: "Kiểm tra nhanh trình độ",
    diagnosticSubtitle: "5 câu hỏi nhanh để gợi ý trình độ phù hợp",
    timeTitle: "Mỗi ngày bạn muốn học bao lâu?",
    timeSubtitle: "Sau bước này bạn sẽ vào thẳng phiên ôn tập đầu tiên"
  },
  goals: {
    pass_bjt: { label: "Thi đỗ BJT", desc: "Chuẩn bị bài bản cho kỳ thi BJT" },
    business_japanese: { label: "Tiếng Nhật công sở", desc: "Email, họp, keigo và thuyết trình" },
    daily_conversation: {
      label: "Giao tiếp đời sống tại Nhật",
      desc: "Sinh hoạt, mua sắm, thủ tục hàng ngày"
    },
    reading_news: { label: "Đọc hiểu tin tức NHK", desc: "NHK News Web Easy, báo chí và tài liệu" },
    jlpt_prep: { label: "Ôn thi JLPT", desc: "Ngữ pháp, từ vựng và đọc hiểu" }
  },
  levels: {
    n5: { label: "N5 — Mới bắt đầu", desc: "Hiragana, từ vựng cơ bản" },
    n4: { label: "N4 — Sơ cấp", desc: "Giao tiếp đơn giản hàng ngày" },
    n3: { label: "N3 — Trung cấp", desc: "Đọc báo dễ, hội thoại công việc cơ bản" },
    n2: { label: "N2 — Trung-cao cấp", desc: "Làm việc trực tiếp bằng tiếng Nhật" },
    n1: { label: "N1 — Cao cấp", desc: "Tiếng Nhật chuyên sâu như người bản xứ" },
    unknown: { label: "Chưa biết", desc: "Làm nhanh 5 câu kiểm tra trình độ" }
  },
  times: {
    m5: { label: "5 phút", desc: "Nhanh gọn mỗi ngày" },
    m10: { label: "10 phút", desc: "Cân bằng và bền vững" },
    m20: { label: "20 phút", desc: "Tập trung chuyên sâu" },
    m30: { label: "30+ phút", desc: "Tăng tốc cho mục tiêu BJT" }
  }
};

const EN_LABELS = {
  dialogAria: "Study setup",
  stepCounter: "Step {current}/{total}",
  recommendedBadge: "Recommended",
  back: "← Back",
  next: "Next →",
  finishStartReview: "Start first review →",
  saving: "Saving...",
  skip: "Skip — I'll set this up later",
  saveError: "Could not save your preferences. Please try again.",
  steps: {
    goalTitle: "What is your main goal?",
    goalSubtitle: "We prioritize BJT and Japan work content that fits",
    levelTitle: "What is your current Japanese level?",
    levelSubtitle: "Helps match difficulty from your very first session",
    diagnosticTitle: "Quick level check",
    diagnosticSubtitle: "5 short questions to suggest a starting level",
    timeTitle: "How many minutes a day?",
    timeSubtitle: "Next up, jump straight into your first review session"
  },
  goals: {
    pass_bjt: { label: "Pass the BJT exam", desc: "Structured Business Japanese Test prep" },
    business_japanese: { label: "Workplace Japanese", desc: "Email, meetings, keigo, presentations" },
    daily_conversation: { label: "Daily life in Japan", desc: "Everyday errands, dining, transit" },
    reading_news: { label: "Read NHK news", desc: "NHK News Web Easy and articles" },
    jlpt_prep: { label: "JLPT preparation", desc: "Grammar, vocabulary, reading" }
  },
  levels: {
    n5: { label: "N5 — Beginner", desc: "Hiragana and core basics" },
    n4: { label: "N4 — Elementary", desc: "Simple daily conversation" },
    n3: { label: "N3 — Intermediate", desc: "Easy news and workplace basics" },
    n2: { label: "N2 — Upper-intermediate", desc: "Working professionally in Japanese" },
    n1: { label: "N1 — Advanced", desc: "Near-native fluency" },
    unknown: { label: "Not sure yet", desc: "Take a quick 5-question check" }
  },
  times: {
    m5: { label: "5 minutes", desc: "Quick daily habit" },
    m10: { label: "10 minutes", desc: "Balanced and steady" },
    m20: { label: "20 minutes", desc: "Focused practice" },
    m30: { label: "30+ minutes", desc: "Intensive BJT prep" }
  }
};

let activeRoot: Root | null = null;
let activeContainer: HTMLDivElement | null = null;

async function renderFlow(props: {
  labels: typeof VI_LABELS;
  locale: string;
  onComplete: (didComplete?: boolean) => void;
}): Promise<HTMLDivElement> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  activeContainer = container;
  activeRoot = createRoot(container);
  const Component = OnboardingFlow as React.ComponentType<typeof props>;
  await act(async () => {
    activeRoot!.render(<Component {...props} />);
  });
  return container;
}

function findButton(container: HTMLElement, text: string): HTMLButtonElement | undefined {
  return [...container.querySelectorAll("button")].find((btn) => btn.textContent?.includes(text));
}

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockReturnValue({
      addEventListener: vi.fn(),
      matches: false,
      removeEventListener: vi.fn()
    })
  });
  learnerApiFetchMock.mockReset();
  routerPushMock.mockReset();
});

afterEach(() => {
  if (activeRoot) {
    act(() => activeRoot?.unmount());
    activeRoot = null;
  }
  activeContainer?.remove();
  activeContainer = null;
});

describe("OnboardingFlow 3-step focused flow (WEB-447)", () => {
  it("runs a 3-step goal -> level -> finish-into-review flow without topics/style/off-focus goals", async () => {
    learnerApiFetchMock.mockResolvedValue(
      new Response(JSON.stringify({ preferences: { goal: "pass_bjt" } }), { status: 200 })
    );
    const onComplete = vi.fn();

    const container = await renderFlow({ labels: VI_LABELS, locale: "vi", onComplete });

    // Step 1 of 3: Goal selection, excluding off-focus travel/general options
    expect(container.textContent, "onboarding must start at step 1/3").toContain("1/3");
    expect(container.textContent).toContain("Thi đỗ BJT");
    expect(container.textContent).not.toContain("Du lịch");
    expect(container.textContent).not.toContain("Học chung");

    await act(async () => {
      findButton(container, "Thi đỗ BJT")?.click();
    });
    await act(async () => {
      findButton(container, "Tiếp theo")?.click();
    });

    // Step 2 of 3: Current level selection
    expect(container.textContent, "second step must be step 2/3").toContain("2/3");
    expect(container.textContent).toContain("N3");
    await act(async () => {
      findButton(container, "N3")?.click();
    });
    await act(async () => {
      findButton(container, "Tiếp theo")?.click();
    });

    // Step 3 of 3: Daily minutes & finish directly into first review session (no topics or style step)
    expect(container.textContent, "third step must be step 3/3").toContain("3/3");
    expect(container.textContent).not.toContain("chủ đề");
    expect(container.textContent).not.toContain("kanjii");

    await act(async () => {
      findButton(container, "20 phút")?.click();
    });

    const finishButton = findButton(container, VI_LABELS.finishStartReview);
    expect(finishButton, "final CTA must launch the first review session").toBeTruthy();

    await act(async () => {
      finishButton?.click();
    });

    expect(learnerApiFetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = learnerApiFetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/recommendation/onboarding/preferences");
    expect(JSON.parse(String(init.body))).toEqual({
      currentLevel: 3,
      goal: "pass_bjt",
      topics: [],
      dailyMinutes: 20,
      style: "mixed"
    });
    expect(onComplete).toHaveBeenCalledWith(true);
    expect(
      routerPushMock,
      "completing onboarding must route learner into their first review session"
    ).toHaveBeenCalledWith("/vi/flashcards?tab=review");
  });

  it("localizes copy in en and skips without redirecting to review", async () => {
    learnerApiFetchMock.mockResolvedValue(
      new Response(JSON.stringify({ skipped: true }), { status: 200 })
    );
    const onComplete = vi.fn();

    const container = await renderFlow({ labels: EN_LABELS, locale: "en", onComplete });

    expect(container.textContent, "must render English localized step counter").toContain("Step 1/3");
    expect(container.textContent).toContain("Pass the BJT exam");

    const skipButton = findButton(container, EN_LABELS.skip);
    expect(skipButton, "localized skip button must render").toBeTruthy();
    await act(async () => {
      skipButton?.click();
    });

    expect(learnerApiFetchMock).toHaveBeenCalledWith("/api/recommendation/onboarding/skip", {
      method: "POST"
    });
    expect(onComplete).toHaveBeenCalledWith(false);
    expect(routerPushMock).not.toHaveBeenCalled();
  });
});
