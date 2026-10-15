import React from "react";
import { expect, it, vi } from "vitest";

const RequireAuthMock = vi.hoisted(() => vi.fn(() => null));
vi.mock("../../../../components/auth/require-auth", () => ({ RequireAuth: RequireAuthMock }));

import SubscriptionPage from "./page";

it("wraps the subscription client in the learner guard for every locale", async () => {
  for (const locale of ["vi", "en", "ja"] as const) {
    const page = await SubscriptionPage({ params: Promise.resolve({ locale }) });
    const guarded = page as React.ReactElement<{
      locale: string;
      children: React.ReactElement<{ locale: string }>;
    }>;
    expect(guarded.type).toBe(RequireAuthMock);
    expect(guarded.props.locale).toBe(locale);
    expect(guarded.props.children.props.locale).toBe(locale);
  }
});
