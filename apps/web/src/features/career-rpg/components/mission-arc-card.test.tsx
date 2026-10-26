// @vitest-environment jsdom

import React from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

const { act } = React;

import messages from "../../../../messages/vi.json";
import type { MissionArc } from "../types";
import { MissionArcCard } from "./mission-arc-card";

const published: MissionArc = {
  slug: "arc.business-manner-basics",
  titleJa: "ビジネスマナー入門",
  titleVi: "Nhập môn phép tắc công sở Nhật",
  rankCodeEntry: "R1",
  synopsisVi: "",
  npcSlugs: [],
  chapterIds: [],
  status: "active",
  totalChapters: 0,
  completedChapters: 0,
  bossChapterId: null,
  displayOrder: 1,
  artAccent: "#94A3B8"
};

async function render(arc: MissionArc) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<MissionArcCard arc={arc} labels={messages.careerRpg.arcs} locale="vi" />);
  });
  return container;
}

describe("MissionArcCard", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders a backend arc without progress counts and does not invent a 0 / 0 progress row", async () => {
    const container = await render(published);

    expect(container.textContent).toContain("ビジネスマナー入門");
    expect(container.textContent).not.toContain(messages.careerRpg.arcs.chaptersProgress);
    expect(container.textContent).not.toContain("0 / 0");
    expect(container.querySelector("a")?.getAttribute("href")).toBe("/vi/story/arcs/arc.business-manner-basics");
  });

  it("does not crash on a status the UI does not know", async () => {
    let failure: unknown;
    let container: HTMLElement | undefined;
    try {
      container = await render({ ...published, status: "published" as MissionArc["status"] });
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeUndefined();
    expect(container?.textContent).toContain("Nhập môn phép tắc công sở Nhật");
  });

  it("still shows progress when the backend supplies chapter counts", async () => {
    const container = await render({ ...published, totalChapters: 5, completedChapters: 2 });

    expect(container.textContent).toContain("2 / 5");
  });
});
