// @vitest-environment jsdom

import React from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const { careerMe, careerRanks } = vi.hoisted(() => ({ careerMe: vi.fn(), careerRanks: vi.fn() }));
const { act } = React;

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) =>
    React.createElement("a", { href, ...props }, children)
}));
vi.mock("../../../../src/features/career-rpg/api", () => ({ careerMe, careerRanks }));
vi.mock("../../../../src/features/career-rpg/store", () => ({
  useCareerRpg: () => ({
    career: { currentRankCode: "R3", jpWorkName: "Prototype Career", skills: [] },
    npcRelations: []
  })
}));
vi.mock("../../../../src/features/career-rpg/components/career-rank-card", () => ({
  CareerRankCard: ({ state }: { state?: { currentRankCode?: string; jpWorkName?: string } }) =>
    <div>{state ? `${state.currentRankCode} ${state.jpWorkName}` : "missing-career-state"}</div>
}));
vi.mock("../../../../src/features/career-rpg/components/career-skill-radar", () => ({
  CareerSkillRadar: ({ state }: { state?: { skills?: unknown[] } }) => <div>skills:{state?.skills?.length ?? "missing"}</div>
}));

import messages from "../../../../messages/vi.json";
import { CareerPageClient } from "./career-page-client";

describe("CareerPageClient API contract", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders the persisted CareerMe response without prototype NPC or rank data", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    careerMe.mockResolvedValue({
      state: {
        userId: "learner-1",
        currentRankCode: "R1",
        rankXp: 0,
        rankXpToNext: 0,
        jpWorkName: "Career Audit",
        companyTheme: "",
        hireDate: "2026-10-08",
        lastClockInAt: null,
        streakDays: 0,
        skills: []
      },
      npcRelations: [],
      npcs: []
    });
    careerRanks.mockResolvedValue([]);

    const result = await renderCareer();
    expect(result.text).toContain("Career Audit");
    expect(result.text).toContain("R1");
    expect(result.text).not.toContain("山田 部長");
    expect(result.text).toContain("Chưa có dữ liệu quan hệ.");
    expect(result.text).toContain("Chưa có dữ liệu thứ hạng.");
  });

  it("shows an error and retry action instead of demo career state when the API fails", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    careerMe.mockRejectedValue(new Error("unavailable"));
    careerRanks.mockRejectedValue(new Error("unavailable"));

    const result = await renderCareer();
    expect(result.text).toContain("Không thể tải dữ liệu hồ sơ sự nghiệp. Vui lòng thử lại.");
    expect(result.text).not.toContain("Prototype Career");
    expect(result.text).not.toContain("山田 部長");
    expect(result.button).toBe("Thử lại");
  });
});

async function renderCareer() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<CareerPageClient labels={messages.careerRpg} locale="vi" />);
  });
  const result = { text: container.textContent ?? "", button: container.querySelector("button")?.textContent };
  await act(async () => root.unmount());
  container.remove();
  return result;
}
