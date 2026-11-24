// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { learnerApiFetch } from "../../../../lib/learner-api";
import { RevengeModeWidget } from "./revenge-mode-widget";

vi.mock("../../../../lib/go-auth-provider", () => ({
  useGoAuth: () => ({ userId: "learner-1" })
}));

vi.mock("../../../../lib/learner-api", () => ({
  learnerApiFetch: vi.fn()
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const SAMPLE_QUEUE = {
  questions: [
    {
      questionId: "q-1",
      prompt: "取引先へのメールで適切な結びの表現はどれですか。",
      scenario: "ビジネスメール作成",
      skillTag: "business_email",
      options: [
        { key: "A", text: "よろしくお願いいたします", originalKey: "A" },
        { key: "B", text: "よろしくね", originalKey: "B" }
      ],
      yourAnswer: "B"
    }
  ],
  totalPending: 3
};

let host: HTMLDivElement | null = null;
let root: Root | null = null;

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function mountWidget(locale: string): HTMLDivElement {
  const container = document.createElement("div");
  document.body.append(container);
  host = container;
  root = createRoot(container);
  act(() => {
    root!.render(<RevengeModeWidget locale={locale} />);
  });
  return container;
}

afterEach(() => {
  vi.useRealTimers();
  if (root) {
    act(() => root?.unmount());
  }
  host?.remove();
  root = null;
  host = null;
  vi.clearAllMocks();
});

describe("RevengeModeWidget localization and resilience (WEB-445)", () => {
  it("renders localized idle, active quiz, and completion strings across en, ja, and vi without hardcoded bleed", async () => {
    const cases = [
      {
        locale: "en",
        title: "Review Missed Questions",
        subtitlePart: "3 missed questions",
        startCta: "Start review",
        counter: "Question 1/1",
        completeTitle: "Missed-question review complete!",
        closeLabel: "Close"
      },
      {
        locale: "ja",
        title: "間違えた問題の復習",
        subtitlePart: "3問",
        startCta: "復習を始める",
        counter: "問題 1/1",
        completeTitle: "間違えた問題の復習が完了しました！",
        closeLabel: "閉じる"
      },
      {
        locale: "vi",
        title: "Ôn lại câu BJT làm sai",
        subtitlePart: "3 câu sai",
        startCta: "Ôn lại ngay",
        counter: "Câu 1/1",
        completeTitle: "Hoàn thành lượt ôn câu sai!",
        closeLabel: "Đóng"
      }
    ];

    for (const {
      locale,
      title,
      subtitlePart,
      startCta,
      counter,
      completeTitle,
      closeLabel
    } of cases) {
      vi.useRealTimers();
      if (root) {
        act(() => root?.unmount());
        root = null;
      }
      host?.remove();
      host = null;
      vi.mocked(learnerApiFetch).mockImplementation(async (path, init) => {
        if (String(path).startsWith("/api/quiz/revenge/queue")) {
          return { ok: true, json: async () => SAMPLE_QUEUE } as Response;
        }
        if (String(path) === "/api/quiz/revenge/answer" && init?.method === "POST") {
          return {
            ok: true,
            json: async () => ({ isCorrect: true, correctOption: "A" })
          } as Response;
        }
        return { ok: false, status: 404, json: async () => ({}) } as Response;
      });

      const container = mountWidget(locale);
      await flushMicrotasks();

      expect(container.textContent ?? "", `${locale} idle card must show localized title`).toContain(
        title
      );
      expect(
        container.textContent ?? "",
        `${locale} idle card must show localized count subtitle`
      ).toContain(subtitlePart);
      expect(container.textContent ?? "", `${locale} idle card must show localized start CTA`).toContain(
        startCta
      );
      expect(
        container.textContent ?? "",
        "must not contain hardcoded English 'Revenge Mode'"
      ).not.toContain("Revenge Mode");
      expect(
        container.textContent ?? "",
        "must not contain hardcoded Vietnamese 'Trả thù ngay'"
      ).not.toContain("Trả thù ngay");

      const startButton = container.querySelector("button");
      expect(startButton).not.toBeNull();
      await act(async () => {
        startButton!.click();
      });

      expect(
        container.textContent ?? "",
        `${locale} active quiz must show localized question counter`
      ).toContain(counter);

      vi.useFakeTimers();
      const firstOption = container.querySelector("button");
      expect(firstOption).not.toBeNull();
      await act(async () => {
        firstOption!.click();
        await Promise.resolve();
        await Promise.resolve();
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1200);
      });

      expect(container.textContent ?? "", `${locale} completion must show localized title`).toContain(
        completeTitle
      );
      expect(
        container.textContent ?? "",
        `${locale} completion must show localized close label`
      ).toContain(closeLabel);
      expect(
        container.textContent ?? "",
        "must not contain hardcoded 'Trả thù xong!'"
      ).not.toContain("Trả thù xong!");
    }
  });

  it("shows localized loading status and recoverable error state on queue failure", async () => {
    let resolvePending: ((value: Response) => void) | null = null;
    vi.mocked(learnerApiFetch).mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolvePending = resolve;
        })
    );

    const container = mountWidget("en");

    const status = container.querySelector('[role="status"]');
    expect(status?.textContent ?? "", "loading skeleton must expose localized status text").toContain(
      "Loading missed questions..."
    );

    await act(async () => {
      resolvePending!({ ok: false, status: 500, json: async () => ({}) } as Response);
      await Promise.resolve();
    });

    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent ?? "", "failed queue load must show localized error message").toContain(
      "Could not load missed questions"
    );

    vi.mocked(learnerApiFetch).mockResolvedValueOnce({
      ok: true,
      json: async () => SAMPLE_QUEUE
    } as Response);

    const retryButton = alert?.querySelector("button");
    expect(retryButton?.textContent ?? "").toContain("Try again");
    await act(async () => {
      retryButton!.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent ?? "").toContain("Review Missed Questions");
  });

  it("clears selection lock and shows localized error when submitting an answer fails", async () => {
    vi.mocked(learnerApiFetch).mockImplementation(async (path, init) => {
      if (String(path).startsWith("/api/quiz/revenge/queue")) {
        return { ok: true, json: async () => SAMPLE_QUEUE } as Response;
      }
      if (String(path) === "/api/quiz/revenge/answer" && init?.method === "POST") {
        return { ok: false, status: 500, json: async () => ({}) } as Response;
      }
      return { ok: false, status: 404, json: async () => ({}) } as Response;
    });

    const container = mountWidget("en");
    await flushMicrotasks();

    await act(async () => {
      container.querySelector("button")?.click();
    });

    const optionButton = container.querySelector("button") as HTMLButtonElement | null;
    expect(optionButton).not.toBeNull();
    await act(async () => {
      optionButton!.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent ?? "", "failed answer submit must show localized error").toContain(
      "Could not submit your answer"
    );
    expect(optionButton?.disabled, "option must be re-enabled after failed answer submit").toBe(false);
  });
});
