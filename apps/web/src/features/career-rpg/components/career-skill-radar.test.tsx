// @vitest-environment jsdom

import React from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

const { act } = React;

import messages from "../../../../messages/vi.json";
import { CareerSkillRadar } from "./career-skill-radar";

describe("CareerSkillRadar", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("does not present missing skill measurements as zero", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<CareerSkillRadar axisLabels={messages.careerRpg.career.skillsAxisLabels} state={{
        userId: "learner-1",
        currentRankCode: "R1",
        rankXp: 0,
        rankXpToNext: 0,
        jpWorkName: "",
        companyTheme: "",
        hireDate: "2026-10-08",
        lastClockInAt: null,
        streakDays: 0,
        skills: [{ axisCode: "keigo", value: 73 }]
      }} />);
    });

    expect(container.textContent).toContain("73");
    expect(container.textContent?.match(/—/g)).toHaveLength(5);
    expect(container.querySelector("polygon[stroke=\"#1B2A4A\"]")?.getAttribute("points")).toBe("");

    await act(async () => root.unmount());
    container.remove();
  });
});
