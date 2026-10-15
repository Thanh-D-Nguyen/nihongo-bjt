import { afterEach, expect, it, vi } from "vitest";

const client = vi.hoisted(() => vi.fn(() => null));
vi.mock("./_components/scenario-list-client", () => ({ ScenarioListClient: client }));
vi.mock("../../../components/auth/require-auth", () => ({
  RequireAuth: ({ locale, children }: { locale: string; children: React.ReactNode }) =>
    React.createElement("auth-guard", { locale }, children),
}));

import React from "react";
import ScenariosPage from "./page";

afterEach(() => client.mockClear());

it("awaits dynamic locale params and renders the list behind the learner guard", async () => {
  const titles = { vi: "Tình huống kinh doanh", en: "Business scenarios", ja: "ビジネスシナリオ" };
  for (const locale of ["vi", "en", "ja"] as const) {
    const page = await ScenariosPage({ params: Promise.resolve({ locale }) } as never);
    expect(React.isValidElement(page)).toBe(true);
    const guarded = page as React.ReactElement<{
      locale: string;
      children: React.ReactElement<{ locale: string; copy: { title: string } }>;
    }>;
    expect(guarded.props.locale).toBe(locale);
    const child = guarded.props.children;
    expect(child.props.locale).toBe(locale);
    expect(child.props.copy.title).toBe(titles[locale]);
  }
});
