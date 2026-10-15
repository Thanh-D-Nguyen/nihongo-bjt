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
});
