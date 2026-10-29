// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AutoGenDialog, type CardgenLabels } from "./auto-gen-dialog";
import { learnerApiFetch } from "../../../../lib/learner-api";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() })
}));
vi.mock("../../../../lib/go-auth-provider", () => ({
  useGoAuth: () => ({ userId: "learner-1" })
}));
vi.mock("../../../../lib/learner-api", () => ({
  learnerApiFetch: vi.fn()
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const labels: CardgenLabels = {
  title: "Auto cards",
  subtitle: "Build a deck",
  generate: "Generate",
  preview: "Preview",
  mode: "Mode",
  modes: { by_level: "By level", by_topic: "By topic", by_weak_area: "By weak area", daily_auto: "Daily" },
  sourceType: "Source",
  sources: { lexeme: "Vocabulary", grammar: "Grammar", kanji: "Kanji" },
  direction: "Direction",
  directions: { jp_to_vn: "JP to VI", vn_to_jp: "VI to JP", both: "Both" },
  count: "Count",
  generating: "Generating",
  success: "Created {count} cards",
  viewDeck: "View deck",
  previewResult: "Estimate: {count} cards",
  jobs: "Jobs",
  error: "Generic error",
  noMatches: "No content matches these options"
};

let host: HTMLDivElement | null = null;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

afterEach(() => {
  host?.remove();
  host = null;
  vi.mocked(learnerApiFetch).mockReset();
});

describe("AutoGenDialog", () => {
  it("shows the no-match message when generation returns 422", async () => {
    vi.mocked(learnerApiFetch)
      .mockResolvedValueOnce(jsonResponse(200, { availableCount: 0 }))
      .mockResolvedValueOnce(jsonResponse(422, { error: "no content matches these options" }));
    host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<AutoGenDialog open onClose={() => undefined} locale="vi" labels={labels} />);
    });
    const generate = [...host.querySelectorAll("button")].find(
      (button) => button.textContent === labels.generate
    );
    expect(generate).toBeDefined();

    await act(async () => {
      generate?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(host.textContent).toContain(labels.noMatches);
    expect(host.textContent).not.toContain(labels.error);
    act(() => root.unmount());
  });
});
