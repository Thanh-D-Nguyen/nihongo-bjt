import { afterEach, describe, expect, it, vi } from "vitest";

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((target: string) => {
    throw new Error(`NEXT_REDIRECT:${target}`);
  })
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock
}));

import LinkedAccountsSettingsPage from "./page";

afterEach(() => {
  redirectMock.mockClear();
});

describe("duplicate /[locale]/settings/linked-accounts redirect (WEB-447)", () => {
  it("redirects /{locale}/settings/linked-accounts to /{locale}/settings/accounts", async () => {
    for (const locale of ["vi", "en", "ja"] as const) {
      await expect(
        LinkedAccountsSettingsPage({ params: Promise.resolve({ locale }) }),
        `/${locale}/settings/linked-accounts must redirect to /${locale}/settings/accounts`
      ).rejects.toThrow(`NEXT_REDIRECT:/${locale}/settings/accounts`);
      expect(redirectMock).toHaveBeenCalledWith(`/${locale}/settings/accounts`);
    }
  });
});
