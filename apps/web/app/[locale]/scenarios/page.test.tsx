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
  const titles = { vi: "Tình huống giao tiếp", en: "Conversation scenarios", ja: "会話シナリオ" };
  for (const locale of ["vi", "en", "ja"] as const) {
    const page = await ScenariosPage({ params: Promise.resolve({ locale }) } as never);
    expect(React.isValidElement(page)).toBe(true);
    const guarded = page as React.ReactElement<{
      locale: string;
      children: React.ReactElement<{ locale: string; copy: { title: string; categories: Record<string, string> } }>;
    }>;
    expect(guarded.props.locale).toBe(locale);
    const child = guarded.props.children;
    expect(child.props.locale).toBe(locale);
    expect(child.props.copy.title).toBe(titles[locale]);
    expect(child.props.copy.categories.shopping).toBe({ vi: "Mua sắm", en: "Shopping", ja: "買い物" }[locale]);
    for (const category of ["admin", "arrival", "banking", "beauty", "community", "delivery", "dining", "emergency", "family", "health", "housing", "repair", "shopping", "transport", "utilities", "work", "email", "phone", "meeting"]) {
      expect(child.props.copy.categories[category]).toBeTruthy();
    }
    expect(child.props.copy.categories.email).toBe({ vi: "Email", en: "Email", ja: "メール" }[locale]);
  }
});
