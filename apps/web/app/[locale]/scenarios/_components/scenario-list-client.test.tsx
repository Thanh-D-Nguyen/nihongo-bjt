// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  fetch: vi.fn(),
  push: vi.fn(),
  userId: "learner-1",
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
vi.mock("../../../../lib/go-auth-provider", () => ({
  useGoAuth: () => ({ userId: state.userId }),
}));
vi.mock("../../../../lib/learner-api", () => ({ learnerApiFetch: state.fetch }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: state.push }) }));

import { ScenarioListClient } from "./scenario-list-client";

const scenarios = [{
  id: "scenario-1",
  slug: "email-late-meeting",
  titleVi: "Email xin lỗi",
  titleJa: "お詫びメール",
  descriptionVi: "Mô tả",
  difficulty: "beginner",
  category: "email",
  iconEmoji: "📧",
  estimatedMin: 3,
  _count: { steps: 3, attempts: 2 },
}];

const copy = {
  title: "Business scenarios",
  description: "Practice Japanese workplace communication.",
  difficulty: { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" },
  duration: "{count} min",
  steps: "{count} steps",
  attempts: "{count} attempts",
  empty: "No scenarios yet.",
  loadError: "Could not load scenarios.",
  retry: "Retry",
};

async function mount(locale = "en") {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<ScenarioListClient locale={locale} copy={copy} />);
  });
  return { container, root };
}

afterEach(() => {
  document.body.innerHTML = "";
  state.fetch.mockReset();
  state.push.mockReset();
  state.userId = "learner-1";
});

describe("scenario list", () => {
  it("shows localized scenario data and navigates to the selected detail", async () => {
    state.fetch.mockResolvedValueOnce(new Response(JSON.stringify(scenarios), { status: 200 }));
    const { container, root } = await mount("en");

    expect(container.textContent).toContain("お詫びメール");
    expect(container.textContent).toContain("Beginner");
    expect(container.textContent).not.toContain("Mô tả");
    await act(async () => container.querySelector("button")?.click());
    expect(state.push).toHaveBeenCalledWith("/en/scenarios/scenario-1");

    act(() => root.unmount());
  });

  it("shows a retryable error instead of treating an API failure as an empty list", async () => {
    state.fetch
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "unavailable" }), { status: 503 }))
      .mockResolvedValueOnce(new Response("[]", { status: 200 }));
    const { container, root } = await mount();

    expect(container.querySelector('[role="alert"]')?.textContent).toContain(copy.loadError);
    expect(container.textContent).not.toContain(copy.empty);
    await act(async () => container.querySelector("button")?.click());
    expect(state.fetch).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain(copy.empty);

    act(() => root.unmount());
  });

  it("does not request protected data before a learner session is available", async () => {
    state.userId = null as unknown as string;
    const { container, root } = await mount();
    expect(state.fetch).not.toHaveBeenCalled();
    act(() => root.unmount());
    container.remove();
  });
});
