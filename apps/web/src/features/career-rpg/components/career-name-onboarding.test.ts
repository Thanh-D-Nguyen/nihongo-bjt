import { describe, expect, it } from "vitest";

import type { UserCareerState } from "../types";
import { needsNameOnboarding } from "./career-name-onboarding";

const career = (jpWorkName: string) => ({ jpWorkName }) as UserCareerState;

describe("needsNameOnboarding", () => {
  it("prompts learners whose work name has not been set", () => {
    expect(needsNameOnboarding(career(""))).toBe(true);
    expect(needsNameOnboarding(career("   "))).toBe(true);
    expect(needsNameOnboarding(career("田中 太郎"))).toBe(false);
    expect(needsNameOnboarding(career("佐藤 ゆうき"))).toBe(false);
  });
});
