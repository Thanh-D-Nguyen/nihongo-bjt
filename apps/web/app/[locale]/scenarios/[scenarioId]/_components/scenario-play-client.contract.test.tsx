// @vitest-environment jsdom

import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetch: vi.fn() }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
vi.mock("../../../../../lib/go-auth-provider", () => ({
  useGoAuth: () => ({ userId: "11111111-1111-4111-8111-111111111111" })
}));
vi.mock("../../../../../lib/learner-api", () => ({ learnerApiFetch: api.fetch }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { ScenarioPlayClient } from "./scenario-play-client";

const scenario = {
  id: "22222222-2222-4222-8222-222222222222",
  titleVi: "Email xin lỗi",
  titleJa: "お詫びメール",
  maxPoints: 15,
  difficulty: "beginner",
  steps: [
    {
      id: "33333333-3333-4333-8333-333333333333",
      stepOrder: 1,
      situationVi: "Chọn tiêu đề phù hợp.",
      situationJa: "適切な件名を選ぶ。",
      speakerName: null,
      speakerRole: null,
      choices: [
        {
          id: "44444444-4444-4444-8444-444444444444",
          choiceKey: "A",
          textVi: "Xin lỗi rõ ràng",
          textJa: "明確に謝罪する"
        },
        {
          id: "55555555-5555-4555-8555-555555555555",
          choiceKey: "B",
          textVi: "Tiêu đề chung chung",
          textJa: "一般的な件名"
        }
      ]
    }
  ]
};

async function mount() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<ScenarioPlayClient locale="vi" scenarioId={scenario.id} copy={{ loadError: "load error", answerError: "answer error", completeError: "complete error", notFound: "not found", score: "{total}/{max} điểm", replay: "replay", back: "back", step: "step {current}/{total}", stepLabel: "Bước {step}:", optimal: "optimal", optimalAnswer: "optimal", suboptimalAnswer: "suboptimal", points: "points", showResult: "show result", continue: "continue", retry: "retry" }} />);
  });
  return { container, root };
}

afterEach(() => {
  document.body.innerHTML = "";
  api.fetch.mockReset();
  vi.restoreAllMocks();
});

describe("scenario play API contract", () => {
  it("uses server feedback and the persisted attempt result", async () => {
    api.fetch
      .mockResolvedValueOnce(new Response(JSON.stringify(scenario), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choiceKey: "A",
            isOptimal: true,
            pointsAwarded: 7,
            feedbackVi: "Phù hợp"
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "attempt-1", totalPoints: 7, maxPoints: 15 }), {
          status: 200
        })
      );
    const { container, root } = await mount();

    await act(async () => {
      container.querySelectorAll("button")[0]?.click();
    });
    expect(api.fetch.mock.calls[1]?.[0]).toBe(
      `/api/scenarios/steps/${scenario.steps[0].id}/answer`
    );

    await act(async () => {
      container.querySelector<HTMLButtonElement>("button.mt-4")?.click();
    });
    expect(api.fetch.mock.calls[2]?.[0]).toBe(`/api/scenarios/${scenario.id}/complete`);
    expect(JSON.parse(api.fetch.mock.calls[2]?.[1]?.body as string)).toEqual({
      choices: [{ stepOrder: 1, choiceKey: "A", points: 7 }]
    });
    expect(container.textContent).toContain("7/15 điểm");

    act(() => root.unmount());
    container.remove();
  });

  it("allows another choice after the answer request fails", async () => {
    api.fetch
      .mockResolvedValueOnce(new Response(JSON.stringify(scenario), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "unavailable" }), { status: 503 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ choiceKey: "B", isOptimal: false, pointsAwarded: 3 }), {
          status: 200
        })
      );
    const { container, root } = await mount();

    await act(async () => {
      container.querySelectorAll("button")[0]?.click();
    });
    await act(async () => {
      container.querySelectorAll("button")[1]?.click();
    });

    expect(api.fetch).toHaveBeenCalledTimes(3);
    expect(container.textContent).toContain("+3 points");

    act(() => root.unmount());
    container.remove();
  });

  it("keeps the final step open and allows retry when completion persistence fails", async () => {
    api.fetch
      .mockResolvedValueOnce(new Response(JSON.stringify(scenario), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choiceKey: "A", isOptimal: true, pointsAwarded: 7 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "unavailable" }), { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "attempt-2", totalPoints: 7, maxPoints: 15 }), { status: 200 }));
    const { container, root } = await mount();

    await act(async () => { container.querySelectorAll("button")[0]?.click(); });
    await act(async () => { container.querySelector<HTMLButtonElement>("button.mt-4")?.click(); });
    expect(container.textContent).toContain("complete error");
    expect(container.textContent).not.toContain("7/15 điểm");

    await act(async () => { container.querySelector<HTMLButtonElement>("button.mt-4")?.click(); });
    expect(api.fetch).toHaveBeenCalledTimes(4);
    expect(container.textContent).toContain("7/15 điểm");

    act(() => root.unmount());
    container.remove();
  });

  it("shows a truthful not-found state for missing scenarios", async () => {
    api.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ error: "scenario not found" }), { status: 404 }));
    const { container, root } = await mount();
    expect(container.textContent).toContain("not found");
    expect(container.textContent).not.toContain("retry");
    act(() => root.unmount());
    container.remove();
  });

  it("styles initial load failure alerts with sakura-strong and explicit retry button tokens", async () => {
    api.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ error: "unavailable" }), { status: 503 }));
    const { container, root } = await mount();
    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain("load error");
    expect(alert?.className, "load error alert must use text-sakura-strong").toContain("text-sakura-strong");
    const retryBtn = container.querySelector("button");
    expect(retryBtn?.textContent).toContain("retry");
    expect(retryBtn?.className, "load error retry button must declare explicit text-ink, bg-surface, and border-border").toContain("text-ink");
    expect(retryBtn?.className).toContain("bg-surface");
    expect(retryBtn?.className).toContain("border-border");
    act(() => root.unmount());
    container.remove();
  });

  it("applies WCAG AA contrast tokens across choices, feedback, progress fill, inline errors, and summary controls", async () => {
    api.fetch
      .mockResolvedValueOnce(new Response(JSON.stringify(scenario), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "unavailable" }), { status: 503 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choiceKey: "A",
            isOptimal: true,
            pointsAwarded: 7,
            feedbackVi: "Phù hợp",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "attempt-contrast-1", totalPoints: 7, maxPoints: 15 }), {
          status: 200,
        }),
      );
    const { container, root } = await mount();

    const progressFill = container.querySelector<HTMLDivElement>('div[style*="width"]');
    expect(progressFill?.className, "progress bar fill must use bg-matcha-strong dark:bg-matcha").toContain("bg-matcha-strong");
    expect(progressFill?.className).toContain("dark:bg-matcha");

    const choiceButtons = [...container.querySelectorAll("button")];
    const keySpan = choiceButtons[0]?.querySelector("span");
    expect(keySpan?.className, "choice key letter must use text-ink/70 instead of text-ink/40").toContain("text-ink/70");
    expect(keySpan?.className).not.toContain("text-ink/40");

    // Trigger inline answer error and verify sakura-strong text token.
    await act(async () => {
      choiceButtons[0]?.click();
    });
    const inlineAlert = container.querySelector('[role="alert"]');
    expect(inlineAlert?.className, "inline error must use text-sakura-strong").toContain("text-sakura-strong");

    // Submit optimal choice A and inspect selected border, unselected disabled state, feedback verdict/border, and Next CTA.
    await act(async () => {
      container.querySelectorAll("button")[0]?.click();
    });
    const afterAnswerButtons = [...container.querySelectorAll("button")];
    expect(afterAnswerButtons[0]?.className, "optimal selected choice must use border-matcha-strong").toContain("border-matcha-strong");
    expect(afterAnswerButtons[1]?.className, "disabled unselected choice must not retain hover flash").not.toContain("hover:bg-ink/5");

    const feedbackPanel = container.querySelector<HTMLDivElement>("div.animate-in");
    expect(feedbackPanel?.className, "optimal feedback panel must use border-matcha-strong").toContain("border-matcha-strong");
    const verdictSpan = feedbackPanel?.querySelector("span.font-bold.text-xs");
    expect(verdictSpan?.className, "feedback verdict must specify explicit text-ink").toContain("text-ink");

    const nextBtn = container.querySelector<HTMLButtonElement>("button.mt-4");
    expect(nextBtn?.className, "primary Next/Show Result CTA must use bg-matcha-strong text-white").toContain("bg-matcha-strong");
    expect(nextBtn?.className).toContain("text-white");

    // Advance to summary and verify score readout, step row indicator/text, and Replay CTA.
    await act(async () => {
      nextBtn?.click();
    });
    const scoreText = [...container.querySelectorAll("p")].find((p) => p.textContent?.includes("7/15 điểm"));
    expect(scoreText?.className, "summary score must use text-matcha-strong dark:text-matcha").toContain("text-matcha-strong");
    expect(scoreText?.className).toContain("dark:text-matcha");

    const summaryRow = [...container.querySelectorAll("div.rounded-xl")].find((d) => d.textContent?.includes("Bước 1:"));
    expect(summaryRow?.className, "summary row must specify explicit text-ink and optimal state border").toContain("text-ink");
    expect(summaryRow?.className).toContain("border-matcha-strong");
    expect(summaryRow?.className).toContain("dark:border-matcha");

    const replayBtn = [...container.querySelectorAll("button")].find((b) => b.textContent === "replay");
    expect(replayBtn?.className, "summary Replay CTA must use bg-matcha-strong text-white").toContain("bg-matcha-strong");
    expect(replayBtn?.className).toContain("text-white");

    act(() => root.unmount());
    container.remove();
  });

  it("uses sakura-strong borders for suboptimal choice selection, feedback panel, and summary rows", async () => {
    api.fetch
      .mockResolvedValueOnce(new Response(JSON.stringify(scenario), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choiceKey: "B",
            isOptimal: false,
            pointsAwarded: 2,
            feedbackVi: "Chưa tối ưu",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "attempt-contrast-2", totalPoints: 2, maxPoints: 15 }), {
          status: 200,
        }),
      );
    const { container, root } = await mount();

    await act(async () => {
      container.querySelectorAll("button")[1]?.click();
    });
    expect(container.querySelectorAll("button")[1]?.className, "suboptimal selected choice must use border-sakura-strong").toContain("border-sakura-strong");
    expect(container.querySelector<HTMLDivElement>("div.animate-in")?.className, "suboptimal feedback panel must use border-sakura-strong").toContain("border-sakura-strong");

    await act(async () => {
      container.querySelector<HTMLButtonElement>("button.mt-4")?.click();
    });
    const summaryRow = [...container.querySelectorAll("div.rounded-xl")].find((d) => d.textContent?.includes("Bước 1:"));
    expect(summaryRow?.className, "suboptimal summary row must use border-sakura-strong and text-ink").toContain("border-sakura-strong");
    expect(summaryRow?.className).toContain("text-ink");

    act(() => root.unmount());
    container.remove();
  });
});
