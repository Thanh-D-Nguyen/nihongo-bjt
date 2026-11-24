import { afterEach, describe, expect, it, vi } from "vitest";

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((target: string) => {
    throw new Error(`NEXT_REDIRECT:${target}`);
  })
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock
}));

import OnboardingPage from "./page";

afterEach(() => {
  redirectMock.mockClear();
});

describe("legacy /[locale]/onboarding redirect (WEB-447)", () => {
  it("redirects /{locale}/onboarding to /{locale} for supported locales", async () => {
    for (const locale of ["vi", "en", "ja"] as const) {
      await expect(
        OnboardingPage({ params: Promise.resolve({ locale }) }),
        `/${locale}/onboarding must redirect to /${locale}`
      ).rejects.toThrow(`NEXT_REDIRECT:/${locale}`);
      expect(redirectMock).toHaveBeenCalledWith(`/${locale}`);
    }
  });
});
